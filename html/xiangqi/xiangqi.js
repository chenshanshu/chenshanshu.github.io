/**
 * 中国象棋：规则、走法生成、将军/将死判定、简易 AI
 *
 * 棋盘：9 列 × 10 行，坐标 (x, y)，x=0..8，y=0..9
 * 红方在下方（y 大），黑方在上方（y 小）；红方先手
 * 棋子编码：大写为红，小写为黑 —— K 帅/将 A 仕/士 B 相/象 N 马 R 车 C 炮 P 兵/卒
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory()
  else root.Xiangqi = factory()
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict'

  var COLS = 9
  var ROWS = 10

  /** 初始局面（FEN 风格一行一行，从上到下、从左到右） */
  var START =
    'rnbakabnr/' +
    '9/' +
    '1c5c1/' +
    'p1p1p1p1p/' +
    '9/' +
    '9/' +
    'P1P1P1P1P/' +
    '1C5C1/' +
    '9/' +
    'RNBAKABNR'

  var PIECE_VALUE = {
    K: 10000, A: 120, B: 120, N: 270, R: 600, C: 285, P: 30,
    k: -10000, a: -120, b: -120, n: -270, r: -600, c: -285, p: -30
  }

  /** 简易位置分（红方视角，黑方对称翻转） */
  var POS = {
    P: [
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0],
      [9, 0, 9, 0, 15, 0, 9, 0, 9],
      [12, 0, 18, 0, 20, 0, 18, 0, 12],
      [18, 27, 30, 30, 35, 30, 30, 27, 18],
      [18, 25, 28, 30, 32, 30, 28, 25, 18],
      [15, 20, 25, 25, 25, 25, 25, 20, 15],
      [10, 15, 18, 20, 20, 20, 18, 15, 10],
      [5, 8, 10, 12, 12, 12, 10, 8, 5]
    ],
    N: [
      [0, 0, 2, 0, 0, 0, 2, 0, 0],
      [0, 2, 0, 6, 0, 6, 0, 2, 0],
      [2, 0, 8, 8, 10, 8, 8, 0, 2],
      [0, 6, 8, 10, 12, 10, 8, 6, 0],
      [0, 0, 10, 12, 14, 12, 10, 0, 0],
      [0, 0, 10, 12, 14, 12, 10, 0, 0],
      [0, 6, 8, 10, 12, 10, 8, 6, 0],
      [2, 0, 8, 8, 10, 8, 8, 0, 2],
      [0, 2, 0, 6, 0, 6, 0, 2, 0],
      [0, 0, 2, 0, 0, 0, 2, 0, 0]
    ],
    C: [
      [0, 0, 2, 6, 6, 6, 2, 0, 0],
      [0, 2, 4, 6, 6, 6, 4, 2, 0],
      [2, 4, 6, 8, 8, 8, 6, 4, 2],
      [4, 6, 8, 10, 10, 10, 8, 6, 4],
      [4, 6, 8, 10, 12, 10, 8, 6, 4],
      [4, 6, 8, 10, 12, 10, 8, 6, 4],
      [4, 6, 8, 10, 10, 10, 8, 6, 4],
      [2, 4, 6, 8, 8, 8, 6, 4, 2],
      [0, 2, 4, 6, 6, 6, 4, 2, 0],
      [0, 0, 2, 6, 6, 6, 2, 0, 0]
    ],
    R: [
      [6, 8, 8, 10, 12, 10, 8, 8, 6],
      [6, 10, 10, 12, 14, 12, 10, 10, 6],
      [6, 10, 12, 12, 14, 12, 12, 10, 6],
      [8, 12, 12, 14, 16, 14, 12, 12, 8],
      [10, 14, 14, 16, 18, 16, 14, 14, 10],
      [10, 14, 14, 16, 18, 16, 14, 14, 10],
      [8, 12, 12, 14, 16, 14, 12, 12, 8],
      [6, 10, 12, 12, 14, 12, 12, 10, 6],
      [6, 10, 10, 12, 14, 12, 10, 10, 6],
      [6, 8, 8, 10, 12, 10, 8, 8, 6]
    ]
  }

  var NAMES = {
    K: '帅', A: '仕', B: '相', N: '马', R: '车', C: '炮', P: '兵',
    k: '将', a: '士', b: '象', n: '马', r: '车', c: '炮', p: '卒'
  }

  function inBoard(x, y) {
    return x >= 0 && x < COLS && y >= 0 && y < ROWS
  }

  function isRed(p) {
    return p && p === p.toUpperCase()
  }

  function sameSide(a, b) {
    return a && b && isRed(a) === isRed(b)
  }

  function inPalace(x, y, red) {
    if (x < 3 || x > 5) return false
    return red ? y >= 7 && y <= 9 : y >= 0 && y <= 2
  }

  function crossedRiver(y, red) {
    return red ? y <= 4 : y >= 5
  }

  function parseBoard(fen) {
    var board = []
    for (var y = 0; y < ROWS; y++) board.push(new Array(COLS).fill(null))
    var rows = fen.split('/')
    for (var r = 0; r < ROWS; r++) {
      var x = 0
      for (var i = 0; i < rows[r].length; i++) {
        var ch = rows[r][i]
        if (/\d/.test(ch)) x += Number(ch)
        else {
          board[r][x] = ch
          x++
        }
      }
    }
    return board
  }

  function cloneBoard(board) {
    return board.map(function (row) { return row.slice() })
  }

  function findKing(board, red) {
    var target = red ? 'K' : 'k'
    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) {
        if (board[y][x] === target) return { x: x, y: y }
      }
    }
    return null
  }

  /** 将帅照面：同一列、中间无子 */
  function flyingGeneral(board) {
    var rk = findKing(board, true)
    var bk = findKing(board, false)
    if (!rk || !bk || rk.x !== bk.x) return false
    var x = rk.x
    var y0 = Math.min(rk.y, bk.y) + 1
    var y1 = Math.max(rk.y, bk.y)
    for (var y = y0; y < y1; y++) if (board[y][x]) return false
    return true
  }

  function Xiangqi(fen) {
    this.reset(fen)
  }

  Xiangqi.COLS = COLS
  Xiangqi.ROWS = ROWS
  Xiangqi.NAMES = NAMES
  Xiangqi.START = START

  Xiangqi.prototype = {
    reset: function (fen) {
      this.board = parseBoard(fen || START)
      this.turn = 'red' // red | black
      this.history = []
      this.winner = null // 'red' | 'black' | 'draw'
      return this
    },

    pieceAt: function (x, y) {
      return inBoard(x, y) ? this.board[y][x] : null
    },

    /** 生成某子的伪合法走法（尚未过滤自杀） */
    genPseudo: function (x, y, board) {
      board = board || this.board
      var p = board[y][x]
      if (!p) return []
      var red = isRed(p)
      var type = p.toUpperCase()
      var moves = []

      function add(tx, ty) {
        if (!inBoard(tx, ty)) return
        var t = board[ty][tx]
        if (sameSide(p, t)) return
        moves.push({ from: { x: x, y: y }, to: { x: tx, y: ty }, capture: t || null })
      }

      if (type === 'K') {
        ;[[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(function (d) {
          var tx = x + d[0]
          var ty = y + d[1]
          if (inPalace(tx, ty, red)) add(tx, ty)
        })
      } else if (type === 'A') {
        ;[[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (d) {
          var tx = x + d[0]
          var ty = y + d[1]
          if (inPalace(tx, ty, red)) add(tx, ty)
        })
      } else if (type === 'B') {
        ;[[2, 2], [2, -2], [-2, 2], [-2, -2]].forEach(function (d) {
          var tx = x + d[0]
          var ty = y + d[1]
          var mx = x + d[0] / 2
          var my = y + d[1] / 2
          if (!inBoard(tx, ty)) return
          if (board[my][mx]) return // 塞象眼
          // 不过河：红方只能在 y>=5（己方），黑方只能在 y<=4
          if (red ? ty < 5 : ty > 4) return
          add(tx, ty)
        })
      } else if (type === 'N') {
        var hops = [
          [1, 0, 1, 1], [1, 0, 1, -1], [-1, 0, -1, 1], [-1, 0, -1, -1],
          [0, 1, 1, 1], [0, 1, -1, 1], [0, -1, 1, -1], [0, -1, -1, -1]
        ]
        hops.forEach(function (h) {
          var bx = x + h[0]
          var by = y + h[1]
          if (!inBoard(bx, by) || board[by][bx]) return // 蹩马腿
          add(x + h[0] + h[2], y + h[1] + h[3])
        })
      } else if (type === 'R') {
        ;[[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
          for (var i = 1; i < 10; i++) {
            var tx = x + d[0] * i
            var ty = y + d[1] * i
            if (!inBoard(tx, ty)) break
            if (!board[ty][tx]) add(tx, ty)
            else {
              add(tx, ty)
              break
            }
          }
        })
      } else if (type === 'C') {
        ;[[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
          var jumped = false
          for (var i = 1; i < 10; i++) {
            var tx = x + d[0] * i
            var ty = y + d[1] * i
            if (!inBoard(tx, ty)) break
            var t = board[ty][tx]
            if (!jumped) {
              if (!t) add(tx, ty)
              else jumped = true
            } else {
              if (t) {
                add(tx, ty)
                break
              }
            }
          }
        })
      } else if (type === 'P') {
        var fwd = red ? -1 : 1
        add(x, y + fwd)
        if (crossedRiver(y, red)) {
          add(x - 1, y)
          add(x + 1, y)
        }
      }
      return moves
    },

    /** 走一步（不检查合法性），返回被吃子 */
    applyMove: function (board, move) {
      var cap = board[move.to.y][move.to.x]
      board[move.to.y][move.to.x] = board[move.from.y][move.from.x]
      board[move.from.y][move.from.x] = null
      return cap
    },

    /** 撤销一步（与 applyMove 配对，供 AI 搜索复用同一棋盘） */
    unmakeMove: function (board, move, capture) {
      board[move.from.y][move.from.x] = board[move.to.y][move.to.x]
      board[move.to.y][move.to.x] = capture
    },

    /** 指定颜色是否被将军 */
    inCheck: function (red, board) {
      board = board || this.board
      if (flyingGeneral(board)) return true
      var king = findKing(board, red)
      if (!king) return true
      for (var y = 0; y < ROWS; y++) {
        for (var x = 0; x < COLS; x++) {
          var p = board[y][x]
          if (!p || isRed(p) === red) continue
          var ms = this.genPseudo(x, y, board)
          for (var i = 0; i < ms.length; i++) {
            if (ms[i].to.x === king.x && ms[i].to.y === king.y) return true
          }
        }
      }
      return false
    },

    /** 某方全部合法走法 */
    legalMoves: function (red) {
      if (red === undefined) red = this.turn === 'red'
      var list = []
      var self = this
      for (var y = 0; y < ROWS; y++) {
        for (var x = 0; x < COLS; x++) {
          var p = this.board[y][x]
          if (!p || isRed(p) !== red) continue
          this.genPseudo(x, y).forEach(function (m) {
            var b = cloneBoard(self.board)
            self.applyMove(b, m)
            if (!self.inCheck(red, b) && !flyingGeneral(b)) list.push(m)
          })
        }
      }
      return list
    },

    /** 从某格出发的合法走法 */
    legalFrom: function (x, y) {
      var p = this.board[y][x]
      if (!p) return []
      var red = isRed(p)
      if ((red && this.turn !== 'red') || (!red && this.turn !== 'black')) return []
      var self = this
      return this.genPseudo(x, y).filter(function (m) {
        var b = cloneBoard(self.board)
        self.applyMove(b, m)
        return !self.inCheck(red, b) && !flyingGeneral(b)
      })
    },

    /** 执行合法走法；非法返回 false */
    move: function (fromX, fromY, toX, toY) {
      if (this.winner) return false
      var legal = this.legalFrom(fromX, fromY)
      var move = null
      for (var i = 0; i < legal.length; i++) {
        if (legal[i].to.x === toX && legal[i].to.y === toY) {
          move = legal[i]
          break
        }
      }
      if (!move) return false

      var piece = this.board[fromY][fromX]
      var cap = this.applyMove(this.board, move)
      this.history.push({
        from: { x: fromX, y: fromY },
        to: { x: toX, y: toY },
        piece: piece,
        capture: cap,
        turn: this.turn
      })
      this.turn = this.turn === 'red' ? 'black' : 'red'
      this._updateWinner()
      return true
    },

    undo: function () {
      var h = this.history.pop()
      if (!h) return false
      this.board[h.from.y][h.from.x] = h.piece
      this.board[h.to.y][h.to.x] = h.capture
      this.turn = h.turn
      this.winner = null
      return true
    },

    _updateWinner: function () {
      var redToMove = this.turn === 'red'
      var moves = this.legalMoves(redToMove)
      if (moves.length) {
        this.winner = null
        return
      }
      // 无子可动：被将则为将死，否则困毙（按惯例算对方胜）
      this.winner = redToMove ? 'black' : 'red'
    },

    isCheck: function () {
      return this.inCheck(this.turn === 'red')
    },

    /** 局面评估：红方为正 */
    evaluate: function (board) {
      board = board || this.board
      var score = 0
      for (var y = 0; y < ROWS; y++) {
        for (var x = 0; x < COLS; x++) {
          var p = board[y][x]
          if (!p) continue
          score += PIECE_VALUE[p] || 0
          var t = p.toUpperCase()
          var table = POS[t]
          if (table) {
            var py = isRed(p) ? y : ROWS - 1 - y
            var s = table[py][x] || 0
            score += isRed(p) ? s : -s
          }
        }
      }
      return score
    },

    /**
     * AI 搜索最佳着法（迭代加深 + 限时，避免专家档卡死页面）
     * @param {'easy'|'hard'|'expert'} level
     */
    bestMove: function (level) {
      var red = this.turn === 'red'
      var cfg = {
        easy: { maxDepth: 1, qDepth: 0, timeMs: 80, random: true },
        hard: { maxDepth: 4, qDepth: 2, timeMs: 500, random: false },
        expert: { maxDepth: 5, qDepth: 3, timeMs: 900, random: false }
      }[level] || { maxDepth: 1, qDepth: 0, timeMs: 80, random: true }

      var rootMoves = this.legalMoves(red)
      if (!rootMoves.length) return null
      this._sortMoves(rootMoves)

      if (cfg.random && rootMoves.length > 1 && Math.random() < 0.35) {
        return rootMoves[Math.floor(Math.random() * Math.min(4, rootMoves.length))]
      }

      // 只用一份工作棋盘，搜索中 apply/unmake，避免每层 clone
      var board = cloneBoard(this.board)
      this._deadline = Date.now() + cfg.timeMs
      this._timedOut = false

      var best = rootMoves[0]
      // 迭代加深：超时则退回上一层完整结果
      for (var d = 1; d <= cfg.maxDepth; d++) {
        this._timedOut = false
        var trial = this._searchRoot(board, rootMoves, d, red, cfg.qDepth)
        if (this._timedOut) break
        if (trial) best = trial
      }
      return best
    },

    /** 根节点搜一层完整深度，返回最佳着法 */
    _searchRoot: function (board, rootMoves, depth, red, qDepth) {
      var best = null
      var bestScore = red ? -Infinity : Infinity
      var useQ = qDepth > 0

      for (var i = 0; i < rootMoves.length; i++) {
        if (Date.now() >= this._deadline) {
          this._timedOut = true
          break
        }
        var m = rootMoves[i]
        var cap = this.applyMove(board, m)
        var score = this._minimax(board, depth - 1, !red, -Infinity, Infinity, useQ, qDepth)
        this.unmakeMove(board, m, cap)
        if (this._timedOut) break
        if (red ? score > bestScore : score < bestScore) {
          bestScore = score
          best = m
        }
      }
      // 把本轮最佳着挪到列表前面，利于下一轮加深剪枝
      if (best) {
        var idx = rootMoves.indexOf(best)
        if (idx > 0) {
          rootMoves.splice(idx, 1)
          rootMoves.unshift(best)
        }
      }
      return best
    },

    /** 吃子价值高的着法排前 */
    _sortMoves: function (moves) {
      moves.sort(function (a, b) {
        var ca = a.capture || (a.m && a.m.capture)
        var cb = b.capture || (b.m && b.m.capture)
        var va = ca ? Math.abs(PIECE_VALUE[ca] || 0) : 0
        var vb = cb ? Math.abs(PIECE_VALUE[cb] || 0) : 0
        return vb - va
      })
    },

    /**
     * 生成合法着法（不克隆棋盘）；onlyCapture 时只保留吃子
     */
    _genLegal: function (board, redToMove, onlyCapture) {
      var moves = []
      for (var y = 0; y < ROWS; y++) {
        for (var x = 0; x < COLS; x++) {
          var p = board[y][x]
          if (!p || isRed(p) !== redToMove) continue
          var pseudo = this.genPseudo(x, y, board)
          for (var i = 0; i < pseudo.length; i++) {
            var m = pseudo[i]
            if (onlyCapture && !m.capture) continue
            var cap = this.applyMove(board, m)
            var ok = !this.inCheck(redToMove, board) && !flyingGeneral(board)
            this.unmakeMove(board, m, cap)
            if (ok) moves.push(m)
          }
        }
      }
      this._sortMoves(moves)
      return moves
    },

    /**
     * @param {boolean} useQuiescence 深度用尽后继续搜吃子
     * @param {number} qDepth 静默搜索层数
     */
    _minimax: function (board, depth, redToMove, alpha, beta, useQuiescence, qDepth) {
      if (Date.now() >= this._deadline) {
        this._timedOut = true
        return this.evaluate(board)
      }

      if (depth <= 0) {
        if (useQuiescence) return this._quiesce(board, redToMove, alpha, beta, qDepth)
        return this.evaluate(board)
      }

      var moves = this._genLegal(board, redToMove, false)
      if (!moves.length) {
        return redToMove ? -8000 - depth : 8000 + depth
      }

      if (redToMove) {
        var max = -Infinity
        for (var j = 0; j < moves.length; j++) {
          if (this._timedOut) break
          var m = moves[j]
          var cap = this.applyMove(board, m)
          var s = this._minimax(board, depth - 1, false, alpha, beta, useQuiescence, qDepth)
          this.unmakeMove(board, m, cap)
          if (s > max) max = s
          if (max > alpha) alpha = max
          if (beta <= alpha) break
        }
        return max
      }
      var min = Infinity
      for (var k = 0; k < moves.length; k++) {
        if (this._timedOut) break
        var m2 = moves[k]
        var cap2 = this.applyMove(board, m2)
        var s2 = this._minimax(board, depth - 1, true, alpha, beta, useQuiescence, qDepth)
        this.unmakeMove(board, m2, cap2)
        if (s2 < min) min = s2
        if (min < beta) beta = min
        if (beta <= alpha) break
      }
      return min
    },

    /** 静默搜索：只延伸吃子 */
    _quiesce: function (board, redToMove, alpha, beta, qDepth) {
      if (Date.now() >= this._deadline) {
        this._timedOut = true
        return this.evaluate(board)
      }

      var stand = this.evaluate(board)
      if (qDepth <= 0) return stand

      if (redToMove) {
        if (stand >= beta) return beta
        if (stand > alpha) alpha = stand
      } else {
        if (stand <= alpha) return alpha
        if (stand < beta) beta = stand
      }

      var inChk = this.inCheck(redToMove, board)
      var moves = this._genLegal(board, redToMove, !inChk)
      if (!moves.length) return stand

      if (redToMove) {
        for (var i = 0; i < moves.length; i++) {
          if (this._timedOut) break
          var m = moves[i]
          var cap = this.applyMove(board, m)
          var s = this._quiesce(board, false, alpha, beta, qDepth - 1)
          this.unmakeMove(board, m, cap)
          if (s > alpha) alpha = s
          if (alpha >= beta) return beta
        }
        return alpha
      }
      for (var j = 0; j < moves.length; j++) {
        if (this._timedOut) break
        var m2 = moves[j]
        var cap2 = this.applyMove(board, m2)
        var s2 = this._quiesce(board, true, alpha, beta, qDepth - 1)
        this.unmakeMove(board, m2, cap2)
        if (s2 < beta) beta = s2
        if (beta <= alpha) return alpha
      }
      return beta
    }
  }

  return Xiangqi
})
