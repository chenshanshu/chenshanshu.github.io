/**
 * 数字华容道求解器
 *
 * 策略：分层还原
 * 1. 盘面大于 3×3 时，先还原最上一行，再还原最左一列，区域缩小一圈后重复；
 *    每行/列的最后两块需要一起放置，用“两块 + 空格”的 BFS 搜索；
 * 2. 剩下右下角 3×3 时，用 IDA*（曼哈顿距离启发）求最优解。
 *
 * 所有方法返回“空格依次移动到的格子下标”数组。
 */
const PuzzleSolver = {
  /**
   * @param {number[]} board 一维盘面，0 表示空格，目标为 1..n²-1 依次排列、空格在最后
   * @param {number} n 阶数
   * @returns {number[]} 空格移动路径
   */
  solve(board, n) {
    const N = n * n
    const b = board.slice()
    const locked = new Array(N).fill(false)
    const moves = []

    // 在副本上执行路径，并记录到总步骤中
    const apply = (path) => {
      if (!path) throw new Error('求解失败')
      for (const to of path) {
        const from = b.indexOf(0)
        b[from] = b[to]
        b[to] = 0
        moves.push(to)
      }
    }
    const placeSingle = (idx) => {
      apply(this._bfsSingle(b, n, locked, idx + 1, idx))
      locked[idx] = true
    }
    const placePair = (ia, ib) => {
      apply(this._bfsPair(b, n, locked, ia + 1, ia, ib + 1, ib))
      locked[ia] = locked[ib] = true
    }

    let k = 0
    while (n - k > 3) {
      // 还原第 k 行：前面逐块放置，最后两块一起放置
      for (let c = k; c < n - 2; c++) placeSingle(k * n + c)
      placePair(k * n + n - 2, k * n + n - 1)
      // 还原第 k 列：同理
      for (let r = k + 1; r < n - 2; r++) placeSingle(r * n + k)
      placePair((n - 2) * n + k, (n - 1) * n + k)
      k++
    }
    apply(this._idaFinal(b, n, k))
    return moves
  },

  /** 计算格子的上下左右相邻格 */
  _neighbors(n) {
    const list = []
    for (let i = 0; i < n * n; i++) {
      const r = Math.floor(i / n)
      const c = i % n
      const nb = []
      if (r > 0) nb.push(i - n)
      if (r < n - 1) nb.push(i + n)
      if (c > 0) nb.push(i - 1)
      if (c < n - 1) nb.push(i + 1)
      list.push(nb)
    }
    return list
  },

  /**
   * BFS：把单个数字移动到目标格，空格不能进入已锁定的格子
   * 状态 = (数字位置, 空格位置)
   */
  _bfsSingle(b, n, locked, value, target) {
    const N = n * n
    const tile0 = b.indexOf(value)
    if (tile0 === target) return []
    const nbs = this._neighbors(n)
    const prev = new Int32Array(N * N).fill(-1)
    const start = tile0 * N + b.indexOf(0)
    prev[start] = start
    const queue = [start]
    for (let qi = 0; qi < queue.length; qi++) {
      const s = queue[qi]
      const t = Math.floor(s / N)
      const e = s % N
      if (t === target) return this._trace(prev, s, start, N)
      for (const c of nbs[e]) {
        if (locked[c]) continue
        const ns = (c === t ? e : t) * N + c
        if (prev[ns] !== -1) continue
        prev[ns] = s
        queue.push(ns)
      }
    }
    return null
  },

  /**
   * BFS：同时把两个数字移动到各自目标格（用于每行/列最后两块）
   * 状态 = (数字A位置, 数字B位置, 空格位置)
   */
  _bfsPair(b, n, locked, va, ta, vb, tb) {
    const N = n * n
    const a0 = b.indexOf(va)
    const b0 = b.indexOf(vb)
    if (a0 === ta && b0 === tb) return []
    const nbs = this._neighbors(n)
    const prev = new Int32Array(N * N * N).fill(-1)
    const start = (a0 * N + b0) * N + b.indexOf(0)
    prev[start] = start
    const queue = [start]
    for (let qi = 0; qi < queue.length; qi++) {
      const s = queue[qi]
      const e = s % N
      const pb = Math.floor(s / N) % N
      const pa = Math.floor(s / N / N)
      if (pa === ta && pb === tb) return this._trace(prev, s, start, N)
      for (const c of nbs[e]) {
        if (locked[c]) continue
        const na = c === pa ? e : pa
        const nb = c === pb ? e : pb
        const ns = (na * N + nb) * N + c
        if (prev[ns] !== -1) continue
        prev[ns] = s
        queue.push(ns)
      }
    }
    return null
  },

  /** 根据 BFS 前驱表还原空格路径（状态最低位即空格位置） */
  _trace(prev, end, start, N) {
    const path = []
    for (let s = end; s !== start; s = prev[s]) path.push(s % N)
    return path.reverse()
  },

  /**
   * IDA*：还原右下角 3×3 区域（起点为第 k 行第 k 列）
   */
  _idaFinal(b, n, k) {
    const cells = []
    for (let r = k; r < n; r++) {
      for (let c = k; c < n; c++) cells.push(r * n + c)
    }
    const m = n - k
    const local = cells.map((i) => b[i])
    // 数字 v 的目标格在局部区域中的下标
    const goal = new Map()
    cells.forEach((g, li) => goal.set(g + 1, li))
    const dist = (v, li) => {
      const gl = goal.get(v)
      return Math.abs(Math.floor(li / m) - Math.floor(gl / m)) + Math.abs((li % m) - (gl % m))
    }
    const nbs = this._neighbors(m)

    let h0 = 0
    local.forEach((v, li) => { if (v) h0 += dist(v, li) })
    let blank = local.indexOf(0)
    const path = []

    // 深度优先搜索，超过阈值时返回下一轮的最小阈值
    const dfs = (g, h, bound, prevBlank) => {
      if (h === 0) return true
      const f = g + h
      if (f > bound) return f
      let min = Infinity
      for (const c of nbs[blank]) {
        if (c === prevBlank) continue
        const v = local[c]
        const nh = h - dist(v, c) + dist(v, blank)
        const old = blank
        local[old] = v
        local[c] = 0
        blank = c
        path.push(c)
        const t = dfs(g + 1, nh, bound, old)
        if (t === true) return true
        path.pop()
        blank = old
        local[c] = v
        local[old] = 0
        if (t < min) min = t
      }
      return min
    }

    let bound = h0
    while (true) {
      const t = dfs(0, h0, bound, -1)
      if (t === true) break
      if (t === Infinity || t > 60) return null
      bound = t
    }
    return path.map((li) => cells[li])
  }
}

/**
 * 数字华容道游戏
 */
class DigitalGames {
  /**
   * @param {HTMLElement} container 棋盘容器
   * @param {object} options
   *   rank 阶数；onMove(steps) 每走一步；onWin({ steps, auto }) 完成；onAutoChange(running) 自动还原状态变化
   */
  constructor(container, options = {}) {
    this.container = container
    this.options = options
    this.rank = options.rank || 4
    this.board = []
    this.tiles = new Map()
    this.steps = 0
    this.finished = false
    this.autoTimer = null
    this.usedAuto = false

    this.container.addEventListener('click', (e) => {
      const tile = e.target.closest('.tile')
      if (tile) this.clickTile(Number(tile.dataset.value))
    })
  }

  /** 开始新游戏 */
  start(rank = this.rank) {
    this.stopAuto()
    this.rank = rank
    this.steps = 0
    this.finished = false
    this.usedAuto = false
    this.board = this._shuffle(rank)
    this._render()
    this._emit('onMove', 0)
  }

  /**
   * 生成保证有解的随机盘面
   * 空格固定在右下角时，数字排列的逆序数为偶数才有解；
   * 之后再让空格随机游走，打散空格位置（不影响可解性）
   */
  _shuffle(n) {
    const N = n * n
    let board
    do {
      const nums = Array.from({ length: N - 1 }, (_, i) => i + 1)
      for (let i = nums.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[nums[i], nums[j]] = [nums[j], nums[i]]
      }
      let inversions = 0
      for (let i = 0; i < nums.length; i++) {
        for (let j = i + 1; j < nums.length; j++) if (nums[i] > nums[j]) inversions++
      }
      if (inversions % 2) [nums[0], nums[1]] = [nums[1], nums[0]]
      board = [...nums, 0]

      const nbs = PuzzleSolver._neighbors(n)
      let blank = N - 1
      let last = -1
      for (let i = 0; i < N * 4; i++) {
        const options = nbs[blank].filter((c) => c !== last)
        const next = options[Math.floor(Math.random() * options.length)]
        board[blank] = board[next]
        board[next] = 0
        last = blank
        blank = next
      }
    } while (this._isSolved(board))
    return board
  }

  /** 创建数字方块 DOM */
  _render() {
    const n = this.rank
    this.container.innerHTML = ''
    this.container.style.setProperty('--n', n)
    this.tiles.clear()
    this.board.forEach((v) => {
      if (!v) return
      const el = document.createElement('div')
      el.className = 'tile'
      el.dataset.value = v
      el.innerHTML = `<span>${v}</span>`
      this.container.appendChild(el)
      this.tiles.set(v, el)
    })
    this._updateTiles()
  }

  /** 按盘面更新所有方块位置；在正确位置的方块高亮 */
  _updateTiles() {
    const n = this.rank
    this.board.forEach((v, i) => {
      if (!v) return
      const el = this.tiles.get(v)
      el.style.transform = `translate(${(i % n) * 100}%, ${Math.floor(i / n) * 100}%)`
      el.classList.toggle('is-correct', v === i + 1)
    })
  }

  _isSolved(board = this.board) {
    const N = board.length
    for (let i = 0; i < N - 1; i++) if (board[i] !== i + 1) return false
    return board[N - 1] === 0
  }

  /** 空格移动到相邻格 dest（即 dest 上的数字滑入空格） */
  _moveBlankTo(dest) {
    const blank = this.board.indexOf(0)
    this.board[blank] = this.board[dest]
    this.board[dest] = 0
    this.steps++
    this._updateTiles()
    this._emit('onMove', this.steps)
    if (this._isSolved()) {
      this.finished = true
      this.stopAuto()
      this._emit('onWin', { steps: this.steps, auto: this.usedAuto })
    }
  }

  /**
   * 点击数字：与空格同行或同列时，整行/整列一起滑动
   */
  clickTile(value) {
    if (this.finished || this.autoTimer) return
    const n = this.rank
    const idx = this.board.indexOf(value)
    let blank = this.board.indexOf(0)
    const sameRow = Math.floor(idx / n) === Math.floor(blank / n)
    const sameCol = idx % n === blank % n
    if (!sameRow && !sameCol) return
    const step = sameRow ? (idx > blank ? 1 : -1) : (idx > blank ? n : -n)
    while (blank !== idx && !this.finished) {
      blank += step
      this._moveBlankTo(blank)
    }
  }

  /**
   * 方向键：数字朝该方向滑入空格
   * @param {'up'|'down'|'left'|'right'} dir
   */
  move(dir) {
    if (this.finished || this.autoTimer) return
    const n = this.rank
    const blank = this.board.indexOf(0)
    const r = Math.floor(blank / n)
    const c = blank % n
    // 数字向上滑 = 空格向下移动，其余同理
    const dest = {
      up: r < n - 1 ? blank + n : -1,
      down: r > 0 ? blank - n : -1,
      left: c < n - 1 ? blank + 1 : -1,
      right: c > 0 ? blank - 1 : -1
    }[dir]
    if (dest >= 0) this._moveBlankTo(dest)
  }

  /** 提示：高亮下一步应移动的数字 */
  hint() {
    if (this.finished || this.autoTimer) return
    const path = PuzzleSolver.solve(this.board, this.rank)
    if (!path.length) return
    const el = this.tiles.get(this.board[path[0]])
    el.classList.remove('is-hint')
    void el.offsetWidth
    el.classList.add('is-hint')
  }

  /**
   * 自动还原：计算完整解法后按间隔逐步执行
   * @param {number} interval 每步间隔 ms
   */
  autoSolve(interval = 150) {
    if (this.finished || this.autoTimer) return
    const path = PuzzleSolver.solve(this.board, this.rank)
    this.usedAuto = true
    this.container.style.setProperty('--speed', Math.min(interval * 0.8, 200) + 'ms')
    let i = 0
    const tick = () => {
      if (i >= path.length || this.finished) return this.stopAuto()
      this._moveBlankTo(path[i++])
      if (this.autoTimer) this.autoTimer = setTimeout(tick, interval)
    }
    this.autoTimer = setTimeout(tick, interval)
    this._emit('onAutoChange', true)
    return path.length
  }

  /** 停止自动还原 */
  stopAuto() {
    if (!this.autoTimer) return
    clearTimeout(this.autoTimer)
    this.autoTimer = null
    this.container.style.removeProperty('--speed')
    this._emit('onAutoChange', false)
  }

  _emit(name, payload) {
    if (typeof this.options[name] === 'function') this.options[name](payload)
  }
}
