/**
 * 数独求解与出题
 * 盘面为长度 81 的数组，0 表示空格
 */
const Sudoku = {
  /** 每格所在宫的编号 */
  box(i) {
    return Math.floor(Math.floor(i / 9) / 3) * 3 + Math.floor((i % 9) / 3)
  },

  /**
   * 回溯求解（每次选择候选数最少的格子）
   * @param {number[]} board 盘面
   * @param {number} limit 找到多少个解后停止（判断唯一解时传 2）
   * @param {boolean} random 是否随机尝试候选数（用于生成终盘）
   * @returns {{ count: number, solution: number[]|null }}
   */
  solve(board, limit = 1, random = false) {
    const b = board.slice()
    const rows = new Array(9).fill(0)
    const cols = new Array(9).fill(0)
    const boxes = new Array(9).fill(0)
    for (let i = 0; i < 81; i++) {
      const v = b[i]
      if (!v) continue
      const bit = 1 << v
      const r = Math.floor(i / 9)
      const c = i % 9
      const x = this.box(i)
      // 题面本身有冲突则无解
      if ((rows[r] | cols[c] | boxes[x]) & bit) return { count: 0, solution: null }
      rows[r] |= bit
      cols[c] |= bit
      boxes[x] |= bit
    }

    let count = 0
    let solution = null
    const search = () => {
      // 找候选数最少的空格
      let best = -1
      let bestMask = 0
      let bestCount = 10
      for (let i = 0; i < 81; i++) {
        if (b[i]) continue
        const used = rows[Math.floor(i / 9)] | cols[i % 9] | boxes[this.box(i)]
        const mask = ~used & 0x3fe
        let n = 0
        for (let m = mask; m; m &= m - 1) n++
        if (n < bestCount) {
          best = i
          bestMask = mask
          bestCount = n
          if (n <= 1) break
        }
      }
      if (best === -1) {
        count++
        if (!solution) solution = b.slice()
        return count >= limit
      }
      if (!bestCount) return false

      const digits = []
      for (let v = 1; v <= 9; v++) if (bestMask & (1 << v)) digits.push(v)
      if (random) digits.sort(() => Math.random() - 0.5)

      const r = Math.floor(best / 9)
      const c = best % 9
      const x = this.box(best)
      for (const v of digits) {
        const bit = 1 << v
        b[best] = v
        rows[r] |= bit
        cols[c] |= bit
        boxes[x] |= bit
        if (search()) return true
        rows[r] &= ~bit
        cols[c] &= ~bit
        boxes[x] &= ~bit
      }
      b[best] = 0
      return false
    }
    search()
    return { count, solution }
  },

  /** 是否只有唯一解 */
  isUnique(board) {
    return this.solve(board, 2).count === 1
  },

  /**
   * 生成题目：先随机生成完整终盘，再随机挖空并保证唯一解
   * @param {'easy'|'medium'|'hard'} level 难度，对应保留的提示数
   */
  generate(level = 'easy') {
    const clues = { easy: 40, medium: 32, hard: 26 }[level] || 40
    const solution = this.solve(new Array(81).fill(0), 1, true).solution
    const puzzle = solution.slice()
    const order = [...Array(81).keys()].sort(() => Math.random() - 0.5)
    let filled = 81
    for (const i of order) {
      if (filled <= clues) break
      const keep = puzzle[i]
      puzzle[i] = 0
      if (this.isUnique(puzzle)) filled--
      else puzzle[i] = keep
    }
    return { puzzle, solution }
  }
}
