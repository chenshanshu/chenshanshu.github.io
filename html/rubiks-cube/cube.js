/**
 * 3×3 魔方状态逻辑（与渲染解耦）
 *
 * 坐标系：X 右、Y 上、Z 前，坐标取值 -1 / 0 / 1
 * 每个小方块记录位置与朝向（四元数用旋转矩阵 3×3 表示，元素为 -1/0/1）
 *
 * 面记号：U=上 D=下 F=前 B=后 L=左 R=右
 * 拧转：face + 角度，1 = 顺时针 90°，-1 = 逆时针，2 = 180°
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory()
  else root.RubiksCube = factory()
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict'

  /** 六面颜色（与真实魔方约定一致） */
  var FACE_COLORS = {
    U: '#ffffff',
    D: '#ffd500',
    F: '#009b48',
    B: '#0046ad',
    L: '#ff5800',
    R: '#b71234'
  }

  /** 各面外法线（初始朝向） */
  var FACE_NORMALS = {
    U: [0, 1, 0],
    D: [0, -1, 0],
    F: [0, 0, 1],
    B: [0, 0, -1],
    L: [-1, 0, 0],
    R: [1, 0, 0]
  }

  /** 拧转轴：绕该轴正方向看去的顺时针 */
  var FACE_AXIS = {
    U: [0, 1, 0],
    D: [0, -1, 0],
    F: [0, 0, 1],
    B: [0, 0, -1],
    L: [-1, 0, 0],
    R: [1, 0, 0]
  }

  /** 该层由哪个坐标轴筛选、取何值 */
  var FACE_LAYER = {
    U: { axis: 1, value: 1 },
    D: { axis: 1, value: -1 },
    F: { axis: 2, value: 1 },
    B: { axis: 2, value: -1 },
    L: { axis: 0, value: -1 },
    R: { axis: 0, value: 1 }
  }

  function cloneVec(v) {
    return [v[0], v[1], v[2]]
  }

  function cloneMat(m) {
    return [
      [m[0][0], m[0][1], m[0][2]],
      [m[1][0], m[1][1], m[1][2]],
      [m[2][0], m[2][1], m[2][2]]
    ]
  }

  function identityMat() {
    return [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1]
    ]
  }

  /** 绕轴旋转 90° * turns（turns 为 ±1 或 ±2）后的整数坐标 */
  function rotateVec(v, axis, turns) {
    var x = v[0]
    var y = v[1]
    var z = v[2]
    var t = ((turns % 4) + 4) % 4
    for (var i = 0; i < t; i++) {
      if (axis[0]) {
        // 绕 +X：y→-z, z→y；绕 -X 则反向
        var ny = axis[0] > 0 ? -z : z
        var nz = axis[0] > 0 ? y : -y
        y = ny
        z = nz
      } else if (axis[1]) {
        var nx = axis[1] > 0 ? z : -z
        nz = axis[1] > 0 ? -x : x
        x = nx
        z = nz
      } else {
        nx = axis[2] > 0 ? -y : y
        ny = axis[2] > 0 ? x : -x
        x = nx
        y = ny
      }
    }
    return [Math.round(x), Math.round(y), Math.round(z)]
  }

  /** 旋转矩阵右乘「绕轴转 turns*90°」 */
  function rotateMat(m, axis, turns) {
    var cols = [
      rotateVec([m[0][0], m[1][0], m[2][0]], axis, turns),
      rotateVec([m[0][1], m[1][1], m[2][1]], axis, turns),
      rotateVec([m[0][2], m[1][2], m[2][2]], axis, turns)
    ]
    return [
      [cols[0][0], cols[1][0], cols[2][0]],
      [cols[0][1], cols[1][1], cols[2][1]],
      [cols[0][2], cols[1][2], cols[2][2]]
    ]
  }

  /** 小方块在世界方向上露出的颜色（无色面返回 null） */
  function colorOnWorldNormal(cubie, worldNormal) {
    // 把世界法线变回局部轴，看对应初始面
    var local = [
      cubie.ori[0][0] * worldNormal[0] + cubie.ori[1][0] * worldNormal[1] + cubie.ori[2][0] * worldNormal[2],
      cubie.ori[0][1] * worldNormal[0] + cubie.ori[1][1] * worldNormal[1] + cubie.ori[2][1] * worldNormal[2],
      cubie.ori[0][2] * worldNormal[0] + cubie.ori[1][2] * worldNormal[1] + cubie.ori[2][2] * worldNormal[2]
    ]
    local = [Math.round(local[0]), Math.round(local[1]), Math.round(local[2])]
    for (var face in FACE_NORMALS) {
      var n = FACE_NORMALS[face]
      if (n[0] === local[0] && n[1] === local[1] && n[2] === local[2]) {
        // 该小块初始是否带有这面颜色
        return cubie.stickers[face] || null
      }
    }
    return null
  }

  function createCubies() {
    var list = []
    for (var x = -1; x <= 1; x++) {
      for (var y = -1; y <= 1; y++) {
        for (var z = -1; z <= 1; z++) {
          if (!x && !y && !z) continue // 跳过看不见的中心核
          var stickers = {}
          if (y === 1) stickers.U = FACE_COLORS.U
          if (y === -1) stickers.D = FACE_COLORS.D
          if (z === 1) stickers.F = FACE_COLORS.F
          if (z === -1) stickers.B = FACE_COLORS.B
          if (x === -1) stickers.L = FACE_COLORS.L
          if (x === 1) stickers.R = FACE_COLORS.R
          list.push({
            pos: [x, y, z],
            ori: identityMat(),
            stickers: stickers
          })
        }
      }
    }
    return list
  }

  /**
   * @constructor
   */
  function RubiksCube() {
    this.reset()
  }

  RubiksCube.FACE_COLORS = FACE_COLORS
  RubiksCube.FACE_NORMALS = FACE_NORMALS
  RubiksCube.FACE_AXIS = FACE_AXIS
  RubiksCube.FACE_LAYER = FACE_LAYER

  RubiksCube.prototype = {
    reset: function () {
      this.cubies = createCubies()
      this.history = []
      return this
    },

    /** 深拷贝当前状态（用于动画前快照） */
    cloneCubies: function () {
      return this.cubies.map(function (c) {
        return {
          pos: cloneVec(c.pos),
          ori: cloneMat(c.ori),
          stickers: Object.assign({}, c.stickers)
        }
      })
    },

    /**
     * 拧转一层（立即更新状态，不带动画）
     * @param {string} face U/D/F/B/L/R
     * @param {number} turns 1 顺时针，-1 逆时针，2 或 -2 为 180°
     * @param {boolean} [record=true] 是否记入历史
     */
    twist: function (face, turns, record) {
      var layer = FACE_LAYER[face]
      var axis = FACE_AXIS[face]
      if (!layer) throw new Error('未知面: ' + face)
      turns = turns | 0
      if (!turns) return this

      this.cubies.forEach(function (c) {
        if (c.pos[layer.axis] !== layer.value) return
        c.pos = rotateVec(c.pos, axis, turns)
        c.ori = rotateMat(c.ori, axis, turns)
      })

      if (record !== false) {
        this.history.push({ face: face, turns: turns })
      }
      return this
    },

    /** 解析单步记号，如 "R" "R'" "R2" "Uw" 不支持，仅基本六面 */
    parseMove: function (notation) {
      var m = String(notation).trim().match(/^([UDFBLR])('|2)?$/i)
      if (!m) return null
      var face = m[1].toUpperCase()
      var turns = m[2] === "'" ? -1 : m[2] === '2' ? 2 : 1
      return { face: face, turns: turns }
    },

    /** 执行一串记号，空格分隔 */
    apply: function (seq, record) {
      var self = this
      String(seq).trim().split(/\s+/).forEach(function (token) {
        if (!token) return
        var mv = self.parseMove(token)
        if (mv) self.twist(mv.face, mv.turns, record)
      })
      return this
    },

    /** 随机打乱，返回打乱公式 */
    scramble: function (length) {
      length = length || 25
      var faces = ['U', 'D', 'F', 'B', 'L', 'R']
      var turnsOpts = [1, -1, 2]
      var moves = []
      var last = ''
      var prevAxis = ''
      // 轴分组：相对面不能连续（U/D、F/B、L/R）
      var axisOf = { U: 'y', D: 'y', F: 'z', B: 'z', L: 'x', R: 'x' }

      for (var i = 0; i < length; i++) {
        var face
        do {
          face = faces[Math.floor(Math.random() * 6)]
        } while (face === last || (axisOf[face] === prevAxis && i > 0 && Math.random() < 0.7 && face !== last))
        // 简化：禁止同一面连续
        while (face === last) face = faces[Math.floor(Math.random() * 6)]

        var turns = turnsOpts[Math.floor(Math.random() * 3)]
        this.twist(face, turns, true)
        moves.push(face + (turns === -1 ? "'" : turns === 2 ? '2' : ''))
        last = face
        prevAxis = axisOf[face]
      }
      return moves.join(' ')
    },

    /** 是否已还原 */
    isSolved: function () {
      return this.cubies.every(function (c) {
        // 朝向为单位阵且位置与初始 stickers 对应
        var ori = c.ori
        var id =
          ori[0][0] === 1 && ori[0][1] === 0 && ori[0][2] === 0 &&
          ori[1][0] === 0 && ori[1][1] === 1 && ori[1][2] === 0 &&
          ori[2][0] === 0 && ori[2][1] === 0 && ori[2][2] === 1
        if (!id) return false
        // 位置上的颜色：检查每个有贴纸的轴向
        for (var face in c.stickers) {
          var n = FACE_NORMALS[face]
          var expectPos = [n[0], n[1], n[2]]
          // 角块/棱块：贴纸面的法线方向应对应位置分量
          for (var i = 0; i < 3; i++) {
            if (expectPos[i] !== 0 && c.pos[i] !== expectPos[i]) return false
          }
        }
        return true
      })
    },

    /** 逆转一步 */
    inverse: function (move) {
      var t = move.turns
      if (t === 2 || t === -2) return { face: move.face, turns: 2 }
      return { face: move.face, turns: -t }
    },

    /** 把历史转成自动还原公式（逆序逆操作） */
    solveFromHistory: function () {
      var seq = []
      for (var i = this.history.length - 1; i >= 0; i--) {
        var inv = this.inverse(this.history[i])
        seq.push(inv.face + (inv.turns === -1 ? "'" : inv.turns === 2 ? '2' : ''))
      }
      return seq
    },

    /** 将一步格式化为记号 */
    formatMove: function (face, turns) {
      return face + (turns === -1 ? "'" : turns === 2 || turns === -2 ? '2' : '')
    },

    /** 某层包含的小块下标 */
    layerIndices: function (face) {
      var layer = FACE_LAYER[face]
      var idx = []
      this.cubies.forEach(function (c, i) {
        if (c.pos[layer.axis] === layer.value) idx.push(i)
      })
      return idx
    }
  }

  return RubiksCube
})
