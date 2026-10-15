/**
 * 五子棋 AI：基于棋型打分
 * 棋盘为 size*size 的一维数组，0 空，1 黑，2 白
 */
const GomokuAI = (function () {
  const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]]

  /**
   * 棋型分值表：1 己方棋子，0 空位
   * 按分值从高到低排列，同一方向只取最高的一种
   */
  const PATTERNS = [
    ['11111', 1000000],
    ['011110', 50000],                       // 活四
    ['11110', 3000], ['01111', 3000],        // 冲四
    ['11011', 3000], ['10111', 3000], ['11101', 3000],
    ['01110', 2500],                         // 活三
    ['011010', 2000], ['010110', 2000],      // 跳活三
    ['11100', 300], ['00111', 300],          // 眠三
    ['11010', 250], ['01011', 250], ['10110', 250], ['01101', 250],
    ['10011', 200], ['11001', 200], ['10101', 200],
    ['0110', 150], ['01010', 120], ['010010', 100], // 活二
    ['11000', 20], ['00011', 20], ['10100', 15], ['00101', 15], // 眠二
    ['010', 5]
  ]

  /**
   * 取得以 (r, c) 为中心某方向上的一行（前后各 5 格），
   * 己方棋子记 '1'，空位记 '0'，对方棋子或棋盘外记 '2'
   */
  function lineString(board, size, r, c, dr, dc, player) {
    let s = ''
    for (let k = -5; k <= 5; k++) {
      const rr = r + dr * k
      const cc = c + dc * k
      if (rr < 0 || rr >= size || cc < 0 || cc >= size) s += '2'
      else {
        const v = board[rr * size + cc]
        s += v === player ? '1' : v === 0 ? '0' : '2'
      }
    }
    return s
  }

  /** 一行字符串中匹配到的最高棋型分 */
  function patternScore(s) {
    for (const [p, score] of PATTERNS) {
      if (s.includes(p)) return score
    }
    return 0
  }

  /** 在 (r, c) 落子后，player 在四个方向上新增的棋型分 */
  function pointScore(board, size, r, c, player) {
    let total = 0
    for (const [dr, dc] of DIRS) {
      const before = lineString(board, size, r, c, dr, dc, player)
      const after = before.slice(0, 5) + '1' + before.slice(6)
      total += patternScore(after) - patternScore(before)
    }
    return total
  }

  /** 候选点：已有棋子周围 2 格内的空位 */
  function candidates(board, size) {
    const set = new Set()
    let hasStone = false
    for (let i = 0; i < board.length; i++) {
      if (!board[i]) continue
      hasStone = true
      const r = Math.floor(i / size)
      const c = i % size
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const rr = r + dr
          const cc = c + dc
          if (rr >= 0 && rr < size && cc >= 0 && cc < size && !board[rr * size + cc]) set.add(rr * size + cc)
        }
      }
    }
    if (!hasStone) return [Math.floor(size / 2) * size + Math.floor(size / 2)]
    return [...set]
  }

  /** 给所有候选点打分：进攻分 + 防守分 */
  function rank(board, size, me, defenseWeight) {
    const opp = 3 - me
    return candidates(board, size).map((i) => {
      const r = Math.floor(i / size)
      const c = i % size
      const attack = pointScore(board, size, r, c, me)
      const defense = pointScore(board, size, r, c, opp)
      return { i, attack, defense, score: attack + defense * defenseWeight }
    }).sort((a, b) => b.score - a.score)
  }

  /**
   * 判断最后一手是否连成五子，返回连成的格子下标，否则返回 null
   */
  function checkWin(board, size, i) {
    const player = board[i]
    if (!player) return null
    const r = Math.floor(i / size)
    const c = i % size
    for (const [dr, dc] of DIRS) {
      const line = [i]
      for (const sign of [1, -1]) {
        let rr = r + dr * sign
        let cc = c + dc * sign
        while (rr >= 0 && rr < size && cc >= 0 && cc < size && board[rr * size + cc] === player) {
          line.push(rr * size + cc)
          rr += dr * sign
          cc += dc * sign
        }
      }
      if (line.length >= 5) return line
    }
    return null
  }

  /**
   * 计算电脑落子位置
   * @param {number[]} board 棋盘
   * @param {number} size 边长
   * @param {number} me 电脑执子（1 黑 / 2 白）
   * @param {'easy'|'hard'} level 难度
   */
  function bestMove(board, size, me, level = 'hard') {
    const list = rank(board, size, me, level === 'hard' ? 0.9 : 0.8)
    if (list.length === 1) return list[0].i

    // 能直接赢就赢，对方下一步能赢就堵
    const win = list.find((m) => m.attack >= 900000)
    if (win) return win.i
    const block = list.find((m) => m.defense >= 900000)
    if (block) return block.i

    if (level === 'hard') {
      // 能形成活四（下一步必胜）就走
      const four = list.find((m) => m.attack >= 40000)
      if (four) return four.i
      // 对方能形成活四时必须拦截，在拦截点里选进攻最好的
      const stops = list.filter((m) => m.defense >= 40000)
      if (stops.length) return stops.sort((a, b) => b.attack - a.attack)[0].i
    }

    if (level === 'easy') {
      // 简单难度：在前几名里随机挑一个，留出破绽
      const limit = list[0].score - Math.abs(list[0].score) * 0.4
      const top = list.filter((m) => m.score >= limit).slice(0, 4)
      return top[Math.floor(Math.random() * top.length)].i
    }

    // 困难难度：对前若干候选点向前看一步，扣除对手应手中最大的进攻威胁
    // （只看对手的进攻分，否则对手“堵我”的分数会反过来压低我的进攻）
    const opp = 3 - me
    let best = list[0]
    let bestValue = -Infinity
    for (const m of list.slice(0, 10)) {
      board[m.i] = me
      const replies = rank(board, size, opp, 0)
      board[m.i] = 0
      const threat = replies.length ? Math.max(...replies.map((x) => x.attack)) : 0
      const value = m.score - threat * 0.5
      if (value > bestValue) {
        bestValue = value
        best = m
      }
    }
    return best.i
  }

  return { bestMove, checkWin }
})()
