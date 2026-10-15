/**
 * 点灯游戏核心逻辑
 * 盘面为长度 n*n 的 0/1 数组，1 表示灯亮；按下一格会切换自身及上下左右的灯
 */
const LightsOut = {
  /** 按下第 i 格受影响的格子 */
  affected(i, n) {
    const r = Math.floor(i / n)
    const c = i % n
    const list = [i]
    if (r > 0) list.push(i - n)
    if (r < n - 1) list.push(i + n)
    if (c > 0) list.push(i - 1)
    if (c < n - 1) list.push(i + 1)
    return list
  },

  /** 在盘面上按下第 i 格（原地修改） */
  press(board, i, n) {
    this.affected(i, n).forEach((k) => { board[k] ^= 1 })
  },

  /**
   * 生成题目：从全灭状态随机按若干格，保证一定有解
   * @returns {number[]} 盘面
   */
  generate(n) {
    const board = new Array(n * n).fill(0)
    do {
      for (let i = 0; i < n * n; i++) {
        if (Math.random() < 0.5) this.press(board, i, n)
      }
    } while (board.every((v) => !v))
    return board
  },

  /**
   * GF(2) 高斯消元求解：返回需要按下的格子（步数最少的解），无解返回 null
   * 方程：A·x = board（mod 2），A 的第 j 列表示按下第 j 格影响的格子
   */
  solve(board, n) {
    const size = n * n
    // 增广矩阵，每行 size+1 个元素
    const m = []
    for (let i = 0; i < size; i++) {
      const row = new Uint8Array(size + 1)
      this.affected(i, n).forEach((j) => { row[j] = 1 })
      row[size] = board[i]
      m.push(row)
    }

    const pivotCols = []
    let rank = 0
    for (let col = 0; col < size && rank < size; col++) {
      let p = rank
      while (p < size && !m[p][col]) p++
      if (p === size) continue
      ;[m[rank], m[p]] = [m[p], m[rank]]
      for (let r = 0; r < size; r++) {
        if (r !== rank && m[r][col]) {
          for (let k = col; k <= size; k++) m[r][k] ^= m[rank][k]
        }
      }
      pivotCols.push(col)
      rank++
    }
    // 存在 0 = 1 的行则无解
    for (let r = rank; r < size; r++) if (m[r][size]) return null

    const isPivot = new Uint8Array(size)
    pivotCols.forEach((c) => { isPivot[c] = 1 })
    const freeCols = []
    for (let c = 0; c < size; c++) if (!isPivot[c]) freeCols.push(c)

    // 枚举自由变量取值，选出按键最少的解（自由变量通常很少，最多 2^4 种）
    let best = null
    for (let mask = 0; mask < 1 << freeCols.length; mask++) {
      const x = new Uint8Array(size)
      freeCols.forEach((c, k) => { x[c] = (mask >> k) & 1 })
      pivotCols.forEach((c, r) => {
        let v = m[r][size]
        freeCols.forEach((f) => { if (m[r][f] && x[f]) v ^= 1 })
        x[c] = v
      })
      const presses = []
      x.forEach((v, i) => { if (v) presses.push(i) })
      if (!best || presses.length < best.length) best = presses
    }
    return best
  }
}
