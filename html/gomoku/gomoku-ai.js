/**
 * 五子棋 AI
 * - 简单：棋型打分 + 随机扰动
 * - 困难：强制应对优先级 + 2 层 αβ
 * - 专家：强制应对 + 3 层 αβ + 更强防守权重
 *
 * 棋盘：size*size 一维数组，0 空，1 黑，2 白
 */
const GomokuAI = (function () {
  const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]]

  /** 棋型：1 己方，0 空，2 对方/边 */
  const PATTERNS = [
    ['11111', 1000000],
    ['011110', 100000], // 活四
    ['11110', 10000], ['01111', 10000], // 冲四
    ['11011', 10000], ['10111', 10000], ['11101', 10000],
    ['01110', 5000], // 活三
    ['011010', 4500], ['010110', 4500],
    ['11100', 500], ['00111', 500],
    ['11010', 480], ['01011', 480], ['10110', 480], ['01101', 480],
    ['10011', 400], ['11001', 400], ['10101', 400],
    ['0110', 200], ['01010', 160], ['010010', 140],
    ['11000', 30], ['00011', 30], ['10100', 25], ['00101', 25],
    ['010', 8]
  ]

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

  function patternScore(s) {
    for (const [p, score] of PATTERNS) {
      if (s.includes(p)) return score
    }
    return 0
  }

  /** 落子后四向棋型增量分 */
  function pointScore(board, size, r, c, player) {
    let total = 0
    for (const [dr, dc] of DIRS) {
      const before = lineString(board, size, r, c, dr, dc, player)
      const after = before.slice(0, 5) + '1' + before.slice(6)
      total += patternScore(after) - patternScore(before)
    }
    return total
  }

  /**
   * 统计落子后形成的关键威胁数量
   * win / openFour / four / openThree
   */
  function countThreats(board, size, i, player) {
    const r = Math.floor(i / size)
    const c = i % size
    let win = 0
    let openFour = 0
    let four = 0
    let openThree = 0
    for (const [dr, dc] of DIRS) {
      const before = lineString(board, size, r, c, dr, dc, player)
      const after = before.slice(0, 5) + '1' + before.slice(6)
      if (after.includes('11111')) win++
      else if (after.includes('011110')) openFour++
      else if (
        after.includes('11110') || after.includes('01111') ||
        after.includes('11011') || after.includes('10111') || after.includes('11101')
      ) four++
      else if (
        after.includes('01110') || after.includes('011010') || after.includes('010110')
      ) openThree++
    }
    return { win, openFour, four, openThree }
  }

  /** 候选点：已有子周围 radius 格 */
  function candidates(board, size, radius) {
    const set = new Set()
    let hasStone = false
    for (let i = 0; i < board.length; i++) {
      if (!board[i]) continue
      hasStone = true
      const r = Math.floor(i / size)
      const c = i % size
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          const rr = r + dr
          const cc = c + dc
          if (rr >= 0 && rr < size && cc >= 0 && cc < size && !board[rr * size + cc]) {
            set.add(rr * size + cc)
          }
        }
      }
    }
    if (!hasStone) return [Math.floor(size / 2) * size + Math.floor(size / 2)]
    return [...set]
  }

  function rank(board, size, me, defenseWeight, radius) {
    const opp = 3 - me
    return candidates(board, size, radius).map((i) => {
      const r = Math.floor(i / size)
      const c = i % size
      const attack = pointScore(board, size, r, c, me)
      const defense = pointScore(board, size, r, c, opp)
      const at = countThreats(board, size, i, me)
      const dt = countThreats(board, size, i, opp)
      // 组合威胁加成：双活三 / 冲四+活三 等
      let combo = 0
      if (at.openFour || at.four >= 2 || (at.four && at.openThree) || at.openThree >= 2) {
        combo += 80000
      }
      if (dt.openFour || dt.four >= 2 || (dt.four && dt.openThree) || dt.openThree >= 2) {
        combo += 75000 * defenseWeight
      }
      return {
        i,
        attack,
        defense,
        score: attack + defense * defenseWeight + combo
      }
    }).sort((a, b) => b.score - a.score)
  }

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

  /** 局面静态评估（相对 me） */
  function evaluateBoard(board, size, me) {
    const opp = 3 - me
    let score = 0
    const empties = candidates(board, size, 2)
    // 只在候选空点上估「下一步能形成什么」，近似局面分
    for (const i of empties) {
      const r = Math.floor(i / size)
      const c = i % size
      score += pointScore(board, size, r, c, me) * 0.15
      score -= pointScore(board, size, r, c, opp) * 0.18
    }
    return score
  }

  /**
   * 强制应对：赢 / 堵赢 / 活四 / 堵活四 / 双威胁
   * 找不到则返回 -1
   */
  function forcedMove(board, size, me) {
    const opp = 3 - me
    const spots = candidates(board, size, 3)

    // 1. 自己能赢
    for (const i of spots) {
      board[i] = me
      const win = checkWin(board, size, i)
      board[i] = 0
      if (win) return i
    }
    // 2. 对方下一步能赢 → 必须堵
    for (const i of spots) {
      board[i] = opp
      const win = checkWin(board, size, i)
      board[i] = 0
      if (win) return i
    }
    // 3. 自己活四
    for (const i of spots) {
      const t = countThreats(board, size, i, me)
      if (t.openFour) return i
    }
    // 4. 堵对方活四
    const blockFours = []
    for (const i of spots) {
      const t = countThreats(board, size, i, opp)
      if (t.openFour) blockFours.push(i)
    }
    if (blockFours.length) {
      // 在堵点里选对自己进攻最好的
      return blockFours.sort((a, b) => {
        const ra = Math.floor(a / size)
        const ca = a % size
        const rb = Math.floor(b / size)
        const cb = b % size
        return pointScore(board, size, rb, cb, me) - pointScore(board, size, ra, ca, me)
      })[0]
    }
    // 5. 自己双威胁（冲四+活三 / 双活三 / 双冲四）
    for (const i of spots) {
      const t = countThreats(board, size, i, me)
      if (t.four >= 2 || (t.four && t.openThree) || t.openThree >= 2) return i
    }
    // 6. 堵对方双威胁
    const blockDouble = []
    for (const i of spots) {
      const t = countThreats(board, size, i, opp)
      if (t.four >= 2 || (t.four && t.openThree) || t.openThree >= 2) blockDouble.push(i)
    }
    if (blockDouble.length) {
      return blockDouble.sort((a, b) => {
        const ra = Math.floor(a / size)
        const ca = a % size
        const rb = Math.floor(b / size)
        const cb = b % size
        return pointScore(board, size, rb, cb, me) - pointScore(board, size, ra, ca, me)
      })[0]
    }
    return -1
  }

  function minimax(board, size, me, depth, maximizing, alpha, beta, deadline) {
    if (Date.now() >= deadline) return evaluateBoard(board, size, me)
    if (depth <= 0) return evaluateBoard(board, size, me)

    const player = maximizing ? me : 3 - me
    const list = rank(board, size, player, maximizing ? 1.1 : 1.2, 2).slice(0, 12)
    if (!list.length) return 0

    if (maximizing) {
      let best = -Infinity
      for (const m of list) {
        board[m.i] = me
        if (checkWin(board, size, m.i)) {
          board[m.i] = 0
          return 5000000 + depth
        }
        const v = minimax(board, size, me, depth - 1, false, alpha, beta, deadline)
        board[m.i] = 0
        if (v > best) best = v
        if (best > alpha) alpha = best
        if (beta <= alpha) break
        if (Date.now() >= deadline) break
      }
      return best
    }

    let best = Infinity
    const opp = 3 - me
    for (const m of list) {
      board[m.i] = opp
      if (checkWin(board, size, m.i)) {
        board[m.i] = 0
        return -5000000 - depth
      }
      const v = minimax(board, size, me, depth - 1, true, alpha, beta, deadline)
      board[m.i] = 0
      if (v < best) best = v
      if (best < beta) beta = best
      if (beta <= alpha) break
      if (Date.now() >= deadline) break
    }
    return best
  }

  /** 各难度思考时限（毫秒） */
  const LEVEL_TIME = {
    easy: 200,
    hard: 500,
    expert: 2000
  }

  /**
   * @param {'easy'|'hard'|'expert'} level
   */
  function bestMove(board, size, me, level = 'hard') {
    const timeMs = LEVEL_TIME[level] || 500
    const cfg = {
      easy: { defense: 0.85, radius: 2, depth: 0, top: 4, random: true },
      hard: { defense: 1.15, radius: 2, depth: 2, top: 8, random: false },
      expert: { defense: 1.35, radius: 3, depth: 3, top: 10, random: false }
    }[level] || { defense: 1.15, radius: 2, depth: 2, top: 8, random: false }

    // 强制应对优先（赢/堵/活四/双威胁）
    if (level !== 'easy') {
      const forced = forcedMove(board, size, me)
      if (forced >= 0) return forced
    } else {
      // 简单也至少堵连五、抢连五
      const spots = candidates(board, size, 2)
      for (const i of spots) {
        board[i] = me
        const w = checkWin(board, size, i)
        board[i] = 0
        if (w) return i
      }
      for (const i of spots) {
        board[i] = 3 - me
        const w = checkWin(board, size, i)
        board[i] = 0
        if (w) return i
      }
    }

    const list = rank(board, size, me, cfg.defense, cfg.radius)
    if (!list.length) return Math.floor(size * size / 2)
    if (list.length === 1) return list[0].i

    if (cfg.random) {
      const limit = list[0].score - Math.abs(list[0].score) * 0.4
      const top = list.filter((m) => m.score >= limit).slice(0, 4)
      return top[Math.floor(Math.random() * top.length)].i
    }

    // 困难 / 专家：αβ 搜索（超时立即返回当前最佳）
    const deadline = Date.now() + timeMs
    let best = list[0]
    let bestVal = -Infinity
    for (const m of list.slice(0, cfg.top)) {
      if (Date.now() >= deadline) break
      board[m.i] = me
      if (checkWin(board, size, m.i)) {
        board[m.i] = 0
        return m.i
      }
      const val = minimax(board, size, me, cfg.depth, false, -Infinity, Infinity, deadline)
      board[m.i] = 0
      const mixed = val + m.score * 0.02
      if (mixed > bestVal) {
        bestVal = mixed
        best = m
      }
    }
    return best.i
  }

  /** 极速兜底：只做强制应对 + 打分，不做深搜 */
  function quickMove(board, size, me) {
    const forced = forcedMove(board, size, me)
    if (forced >= 0) return forced
    const list = rank(board, size, me, 1.2, 2)
    return list.length ? list[0].i : Math.floor(size * size / 2)
  }

  return { bestMove, checkWin, quickMove, LEVEL_TIME }
})()
