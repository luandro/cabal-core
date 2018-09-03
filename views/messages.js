var View = require('kappa-view-level')
var through = require('through2')
var readonly = require('read-only-stream')
var charwise = require('charwise')
var xtend = require('xtend')
var EventEmitter = require('events').EventEmitter
var isValidMessage = require("../util").isValidMessage

module.exports = function (lvl) {
  var events = new EventEmitter()

  return View(lvl, {
    map: function (msg) {
      if (!isValidMessage || !msg.value.timestamp) return []

      // If the message is from <<THE FUTURE>>, index it at _now_.
      var timestamp = msg.value.timestamp
      var now = new Date().getTime()
      if (timestamp > now) timestamp = now

      if (msg.value.type.startsWith('chat/') && msg.value.content.channel) {
        var key = 'msg!' + msg.value.content.channel + '!' + charwise.encode(timestamp)
        return [
          [key, msg]
        ]
      } else {
        return []
      }
    },

    indexed: function (msgs) {
      msgs
        .filter(isValidMessage)
        .filter(msg => msg.value.type.startsWith('chat/') && msg.value.content.channel)
        .sort(cmpMsg)
        .forEach(function (msg) {
          events.emit('message', msg)
          events.emit(msg.value.content.channel, msg)
        })
    },

    api: {
      read: function (core, channel, opts) {
        opts = opts || {}

        var t = through.obj()

        if (opts.gt) opts.gt = 'msg!' + channel + '!' + charwise.encode(opts.gt)  + '!'
        else opts.gt = 'msg!' + channel + '!'
        if (opts.lt) opts.lt = 'msg!' + channel + '!' + charwise.encode(opts.lt)  + '~'
        else opts.lt = 'msg!' + channel + '~'

        this.ready(function () {
          var v = lvl.createValueStream(xtend(opts, {
            reverse: true
          }))
          v.pipe(t)
        })

        return readonly(t)
      },

      events: events
    }
  })
}

function cmpMsg (a, b) {
  return a.value.timestamp - b.value.timestamp
}
