/**
 * 五子棋 AI Worker：后台搜棋，主线程可超时 terminate
 */
/* global GomokuAI */
importScripts('./gomoku-ai.js')

self.onmessage = function (e) {
  var data = e.data || {}
  try {
    var board = (data.board || []).slice()
    var i = GomokuAI.bestMove(board, data.size || 15, data.me || 2, data.level || 'hard')
    self.postMessage({ ok: true, i: i })
  } catch (err) {
    self.postMessage({ ok: false, error: String(err && err.message || err) })
  }
}
