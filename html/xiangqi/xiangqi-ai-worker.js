/**
 * 象棋 AI Worker：在后台线程搜棋，避免卡住页面
 * 主线程可随时 terminate，超时强制收招
 */
/* global Xiangqi */
importScripts('./xiangqi.js')

self.onmessage = function (e) {
  var data = e.data || {}
  try {
    var g = new Xiangqi()
    g.board = (data.board || []).map(function (row) { return row.slice() })
    g.turn = data.turn || 'red'
    g.history = []
    g.winner = null
    var mv = g.bestMove(data.level || 'hard')
    self.postMessage({ ok: true, move: mv })
  } catch (err) {
    self.postMessage({ ok: false, error: String(err && err.message || err) })
  }
}
