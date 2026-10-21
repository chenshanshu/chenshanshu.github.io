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
          if (red ? ty > 4 : ty < 5) return // 不过河
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
     * AI 搜索最佳着法
     * @param {'easy'|'hard'} level 简单深度 1，困难深度 2 + 吃子延伸
     */
    bestMove: function (level) {
      var red = this.turn === 'red'
      var depth = level === 'hard' ? 3 : 1
      var moves = this.legalMoves(red)
      if (!moves.length) return null

      // 吃子优先排序，利于剪枝
      moves.sort(function (a, b) {
        var va = a.capture ? Math.abs(PIECE_VALUE[a.capture] || 0) : 0
        var vb = b.capture ? Math.abs(PIECE_VALUE[b.capture] || 0) : 0
        return vb - va
      })

      if (level === 'easy' && moves.length > 1 && Math.random() < 0.35) {
        // 简单难度：有时在前几步里随机挑
        return moves[Math.floor(Math.random() * Math.min(4, moves.length))]
      }

      var self = this
      var best = moves[0]
      var bestScore = red ? -Infinity : Infinity

      for (var i = 0; i < moves.length; i++) {
        var m = moves[i]
        var b = cloneBoard(this.board)
        this.applyMove(b, m)
        var score = this._minimax(b, depth - 1, !red, -Infinity, Infinity)
        if (red ? score > bestScore : score < bestScore) {
          bestScore = score
          best = m
        }
      }
      return best
    },

    _minimax: function (board, depth, redToMove, alpha, beta) {
      if (depth <= 0) return this.evaluate(board)

      // 生成走法
      var moves = []
      for (var y = 0; y < ROWS; y++) {
        for (var x = 0; x < COLS; x++) {
          var p = board[y][x]
          if (!p || isRed(p) !== redToMove) continue
          var pseudo = this.genPseudo(x, y, board)
          for (var i = 0; i < pseudo.length; i++) {
            var m = pseudo[i]
            var nb = cloneBoard(board)
            this.applyMove(nb, m)
            if (!this.inCheck(redToMove, nb) && !flyingGeneral(nb)) moves.push({ m: m, b: nb })
          }
        }
      }

      if (!moves.length) {
        // 无棋可走：若被将则输，否则也判负（困毙）
        return redToMove ? -8000 - depth : 8000 + depth
      }

      moves.sort(function (a, b) {
        var va = a.m.capture ? Math.abs(PIECE_VALUE[a.m.capture] || 0) : 0
        var vb = b.m.capture ? Math.abs(PIECE_VALUE[b.m.capture] || 0) : 0
        return vb - va
      })

      if (redToMove) {
        var max = -Infinity
        for (var j = 0; j < moves.length; j++) {
          var s = this._minimax(moves[j].b, depth - 1, false, alpha, beta)
          if (s > max) max = s
          if (max > alpha) alpha = max
          if (beta <= alpha) break
        }
        return max
      }
      var min = Infinity
      for (var k = 0; k < moves.length; k++) {
        var s2 = this._minimax(moves[k].b, depth - 1, true, alpha, beta)
        if (s2 < min) min = s2
        if (min < beta) beta = min
        if (beta <= alpha) break
      }
      return min
    }
  }

  return Xiangqi
})
