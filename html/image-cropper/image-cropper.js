/**
 * ImageCropper 图片旋转裁剪插件
 *
 * 用法：
 *   <link rel="stylesheet" href="image-cropper.css">
 *   <script src="image-cropper.js"></script>
 *   var clipper = new ImageCropper('#box', { aspectRatio: 1, onCrop: function (canvas) {} })
 *
 * 支持 UMD：浏览器全局变量 window.ImageCropper / CommonJS / AMD。
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory)
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory()
  } else {
    root.ImageCropper = factory()
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict'

  /** 默认配置 */
  var DEFAULTS = {
    src: '', // 初始图片地址，可为 url / dataURL / blob url
    height: 420, // 舞台高度(px)，宽度自适应容器
    aspectRatio: NaN, // 裁剪框宽高比，NaN 或 0 表示自由比例
    ratios: [
      { label: '自由', value: NaN },
      { label: '1:1', value: 1 },
      { label: '4:3', value: 4 / 3 },
      { label: '3:4', value: 3 / 4 },
      { label: '16:9', value: 16 / 9 },
      { label: '一寸', value: 25 / 35 }
    ],
    toolbar: true, // 是否显示内置工具栏
    minCropSize: 40, // 裁剪框最小边长(px)
    minZoom: 0.1, // 最小缩放(相对“适应舞台”的比例)
    maxZoom: 5, // 最大缩放
    initCropRatio: 0.8, // 初始裁剪框占图片显示区域的比例
    crossOrigin: 'anonymous', // 跨域图片设置，否则导出时 canvas 会被污染
    output: {
      type: 'image/png', // 导出格式
      quality: 0.92, // jpeg/webp 质量
      maxSize: 4096 // 导出图片最长边上限
    },
    confirmText: '确认裁剪',
    onReady: null, // 图片加载完成 function(instance)
    onChange: null, // 旋转/缩放/裁剪框变化 function(data)
    onCrop: null, // 点击确认裁剪 function(canvas, data)
    onError: null // 图片加载失败 function(error)
  }

  /** 8 个拖拽手柄及其方向：x/y 为 -1 左上，1 右下，0 不变 */
  var HANDLES = {
    nw: [-1, -1], n: [0, -1], ne: [1, -1], e: [1, 0],
    se: [1, 1], s: [0, 1], sw: [-1, 1], w: [-1, 0]
  }

  /** 工具栏图标（内联 SVG，避免外部依赖） */
  var ICONS = {
    upload: '<path d="M12 16V4m0 0L7 9m5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
    rotateLeft: '<path d="M4 4v6h6"/><path d="M5.5 15a7.5 7.5 0 1 0 1.8-7.8L4 10"/>',
    rotateRight: '<path d="M20 4v6h-6"/><path d="M18.5 15a7.5 7.5 0 1 1-1.8-7.8L20 10"/>',
    flipX: '<path d="M12 3v18"/><path d="M8 7 3 12l5 5V7z"/><path d="m16 7 5 5-5 5V7z"/>',
    flipY: '<path d="M3 12h18"/><path d="M7 8l5-5 5 5H7z"/><path d="m7 16 5 5 5-5H7z"/>',
    reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>'
  }

  /* ---------------- 工具函数 ---------------- */

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v))
  }

  function isRatio(v) {
    return typeof v === 'number' && isFinite(v) && v > 0
  }

  /** 角度归一化到 [-180, 180) */
  function normalizeDeg(deg) {
    return ((deg + 180) % 360 + 360) % 360 - 180
  }

  /** 创建带 class 的元素 */
  function createEl(tag, className, html) {
    var node = document.createElement(tag)
    if (className) node.className = className
    if (html != null) node.innerHTML = html
    return node
  }

  function svg(name) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round">' + ICONS[name] + '</svg>'
  }

  /** 浅合并配置（output 单独合并） */
  function mergeOptions(options) {
    var result = {}
    var key
    for (key in DEFAULTS) result[key] = DEFAULTS[key]
    for (key in options || {}) result[key] = options[key]
    result.output = {}
    for (key in DEFAULTS.output) result.output[key] = DEFAULTS.output[key]
    for (key in (options && options.output) || {}) result.output[key] = options.output[key]
    return result
  }

  /* ---------------- 构造函数 ---------------- */

  /**
   * @param {string|HTMLElement} target 挂载容器
   * @param {object} options 配置项，见 DEFAULTS
   */
  function ImageCropper(target, options) {
    var container = typeof target === 'string' ? document.querySelector(target) : target
    if (!container) throw new Error('ImageCropper: 未找到挂载容器')

    this.container = container
    this.options = mergeOptions(options)
    this.aspectRatio = isRatio(this.options.aspectRatio) ? this.options.aspectRatio : NaN

    // 图片变换状态：中心偏移、缩放、旋转角度、翻转
    this.image = null
    this.state = { scale: 1, fitScale: 1, rotate: 0, flipX: 1, flipY: 1, tx: 0, ty: 0 }
    // 裁剪框（舞台坐标，单位 px）
    this.crop = { x: 0, y: 0, w: 0, h: 0 }
    this.stageW = 0
    this.stageH = 0
    this._drag = null
    this._objectUrl = null

    this._buildDom()
    this._bindEvents()
    this._measure()
    this._render()

    if (this.options.src) this.load(this.options.src).catch(function () {})
  }

  ImageCropper.prototype = {
    constructor: ImageCropper,

    /* ---------- DOM 构建 ---------- */

    _buildDom: function () {
      var opts = this.options
      var root = createEl('div', 'ic')

      // 舞台：画布 + 裁剪框 + 空状态
      var stage = createEl('div', 'ic-stage')
      stage.style.height = opts.height + 'px'
      var canvas = createEl('canvas', 'ic-canvas')
      var cropEl = createEl('div', 'ic-crop')
      cropEl.appendChild(createEl('div', 'ic-crop__grid'))
      var sizeEl = createEl('div', 'ic-crop__size')
      cropEl.appendChild(sizeEl)
      Object.keys(HANDLES).forEach(function (name) {
        var handle = createEl('span', 'ic-handle ic-handle--' + name)
        handle.setAttribute('data-handle', name)
        cropEl.appendChild(handle)
      })
      var empty = createEl('div', 'ic-empty',
        svg('upload') + '<p>点击或拖拽图片到这里</p><span>支持 JPG / PNG / WEBP</span>')

      stage.appendChild(canvas)
      stage.appendChild(cropEl)
      stage.appendChild(empty)
      root.appendChild(stage)

      // 隐藏的文件选择框
      var fileInput = createEl('input')
      fileInput.type = 'file'
      fileInput.accept = 'image/*'
      fileInput.hidden = true
      root.appendChild(fileInput)

      if (opts.toolbar) root.appendChild(this._buildToolbar())

      this.container.innerHTML = ''
      this.container.appendChild(root)

      this.root = root
      this.stage = stage
      this.canvas = canvas
      this.ctx = canvas.getContext('2d')
      this.cropEl = cropEl
      this.sizeEl = sizeEl
      this.emptyEl = empty
      this.fileInput = fileInput
    },

    _buildToolbar: function () {
      var opts = this.options
      var self = this
      var bar = createEl('div', 'ic-toolbar')

      // 比例选择
      var ratioRow = createEl('div', 'ic-ratios')
      this.ratioBtns = opts.ratios.map(function (item) {
        var btn = createEl('button', 'ic-chip', item.label)
        btn.type = 'button'
        btn.onclick = function () { self.setAspectRatio(item.value) }
        ratioRow.appendChild(btn)
        return { el: btn, value: item.value }
      })
      bar.appendChild(ratioRow)

      // 旋转 / 缩放滑块
      var sliders = createEl('div', 'ic-sliders')
      this.rotateSlider = this._buildSlider(sliders, '旋转', -180, 180, 1, function (v) {
        self.rotateTo(v)
      })
      this.zoomSlider = this._buildSlider(sliders, '缩放',
        Math.round(opts.minZoom * 100), Math.round(opts.maxZoom * 100), 1, function (v) {
          self.zoomTo(v / 100)
        })
      bar.appendChild(sliders)

      // 操作按钮
      var actions = createEl('div', 'ic-actions')
      var tools = createEl('div', 'ic-tools')
      ;[
        ['upload', '上传图片', function () { self.fileInput.click() }],
        ['rotateLeft', '向左旋转 90°', function () { self.rotate(-90) }],
        ['rotateRight', '向右旋转 90°', function () { self.rotate(90) }],
        ['flipX', '水平翻转', function () { self.flip('x') }],
        ['flipY', '垂直翻转', function () { self.flip('y') }],
        ['reset', '重置', function () { self.reset() }]
      ].forEach(function (cfg) {
        var btn = createEl('button', 'ic-icon-btn', svg(cfg[0]))
        btn.type = 'button'
        btn.title = cfg[1]
        btn.setAttribute('aria-label', cfg[1])
        btn.onclick = cfg[2]
        tools.appendChild(btn)
      })
      var confirm = createEl('button', 'ic-btn-primary', opts.confirmText)
      confirm.type = 'button'
      confirm.onclick = function () { self.confirm() }
      actions.appendChild(tools)
      actions.appendChild(confirm)
      bar.appendChild(actions)

      this.confirmBtn = confirm
      return bar
    },

    /** 创建一个带标签和数值显示的滑块 */
    _buildSlider: function (parent, label, min, max, step, onInput) {
      var row = createEl('label', 'ic-slider')
      var name = createEl('span', 'ic-slider__label', label)
      var input = createEl('input')
      input.type = 'range'
      input.min = min
      input.max = max
      input.step = step
      var value = createEl('span', 'ic-slider__value')
      input.addEventListener('input', function () { onInput(Number(input.value)) })
      row.appendChild(name)
      row.appendChild(input)
      row.appendChild(value)
      parent.appendChild(row)
      return { input: input, value: value }
    },

    /* ---------- 事件绑定 ---------- */

    _bindEvents: function () {
      var self = this
      var stage = this.stage

      this._onPointerDown = function (e) { self._pointerDown(e) }
      this._onPointerMove = function (e) { self._pointerMove(e) }
      this._onPointerUp = function (e) { self._pointerUp(e) }
      this._onWheel = function (e) { self._wheel(e) }
      this._onFileChange = function (e) {
        var file = e.target.files && e.target.files[0]
        // 失败已通过 onError 通知，这里避免未处理的 Promise 报错
        if (file) self.load(file).catch(function () {})
        e.target.value = ''
      }
      this._onDragOver = function (e) {
        e.preventDefault()
        stage.classList.add('is-dragover')
      }
      this._onDragLeave = function () { stage.classList.remove('is-dragover') }
      this._onDrop = function (e) {
        e.preventDefault()
        stage.classList.remove('is-dragover')
        var file = e.dataTransfer.files && e.dataTransfer.files[0]
        if (file && /^image\//.test(file.type)) self.load(file).catch(function () {})
      }
      this._onEmptyClick = function () { self.fileInput.click() }

      stage.addEventListener('pointerdown', this._onPointerDown)
      stage.addEventListener('pointermove', this._onPointerMove)
      stage.addEventListener('pointerup', this._onPointerUp)
      stage.addEventListener('pointercancel', this._onPointerUp)
      stage.addEventListener('wheel', this._onWheel, { passive: false })
      stage.addEventListener('dragover', this._onDragOver)
      stage.addEventListener('dragleave', this._onDragLeave)
      stage.addEventListener('drop', this._onDrop)
      this.emptyEl.addEventListener('click', this._onEmptyClick)
      this.fileInput.addEventListener('change', this._onFileChange)

      // 容器尺寸变化时等比调整画面，保持用户当前的编辑状态
      if (typeof ResizeObserver !== 'undefined') {
        this._resizeObserver = new ResizeObserver(function () { self._handleResize() })
        this._resizeObserver.observe(stage)
      }
    },

    _pointerDown: function (e) {
      if (!this.image) return
      if (e.pointerType === 'mouse' && e.button !== 0) return
      var handle = e.target.getAttribute && e.target.getAttribute('data-handle')
      var mode = handle ? 'resize' : (this.cropEl.contains(e.target) ? 'move' : 'pan')
      this._drag = {
        mode: mode,
        dir: handle ? HANDLES[handle] : null,
        startX: e.clientX,
        startY: e.clientY,
        crop: { x: this.crop.x, y: this.crop.y, w: this.crop.w, h: this.crop.h },
        tx: this.state.tx,
        ty: this.state.ty
      }
      this.stage.setPointerCapture(e.pointerId)
      this.stage.classList.add('is-dragging')
      e.preventDefault()
    },

    _pointerMove: function (e) {
      var drag = this._drag
      if (!drag) return
      var dx = e.clientX - drag.startX
      var dy = e.clientY - drag.startY

      if (drag.mode === 'pan') {
        this.state.tx = drag.tx + dx
        this.state.ty = drag.ty + dy
        this._render()
      } else if (drag.mode === 'move') {
        this.crop.x = clamp(drag.crop.x + dx, 0, this.stageW - drag.crop.w)
        this.crop.y = clamp(drag.crop.y + dy, 0, this.stageH - drag.crop.h)
        this._updateCropBox()
      } else {
        this.crop = this._resizeCrop(drag.crop, drag.dir, dx, dy)
        this._updateCropBox()
      }
    },

    _pointerUp: function (e) {
      if (!this._drag) return
      this._drag = null
      this.stage.classList.remove('is-dragging')
      if (this.stage.hasPointerCapture(e.pointerId)) this.stage.releasePointerCapture(e.pointerId)
      this._emitChange()
    },

    /** 滚轮缩放，以鼠标位置为缩放中心 */
    _wheel: function (e) {
      if (!this.image) return
      e.preventDefault()
      var rect = this.stage.getBoundingClientRect()
      var factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
      this.zoomTo(this.getZoom() * factor, {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      })
    },

    /**
     * 根据手柄方向计算新的裁剪框，保证不越界、不小于最小尺寸，并保持宽高比
     */
    _resizeCrop: function (r0, dir, dx, dy) {
      var W = this.stageW
      var H = this.stageH
      var ratio = this.aspectRatio
      var min = this.options.minCropSize
      var cx = r0.x + r0.w / 2
      var cy = r0.y + r0.h / 2
      // 固定不动的锚点（拖拽手柄的对边）
      var ax = dir[0] > 0 ? r0.x : r0.x + r0.w
      var ay = dir[1] > 0 ? r0.y : r0.y + r0.h

      var w = dir[0] ? r0.w + dir[0] * dx : r0.w
      var h = dir[1] ? r0.h + dir[1] * dy : r0.h

      // 允许的最大尺寸：单边拖拽时另一方向以中心为基准向两侧扩展
      var maxW = dir[0] > 0 ? W - ax : dir[0] < 0 ? ax : 2 * Math.min(cx, W - cx)
      var maxH = dir[1] > 0 ? H - ay : dir[1] < 0 ? ay : 2 * Math.min(cy, H - cy)

      if (isRatio(ratio)) {
        if (dir[0] && dir[1]) {
          // 角手柄：以变化更大的一边为准
          if (w / ratio > h) h = w / ratio
          else w = h * ratio
        } else if (dir[0]) {
          h = w / ratio
        } else {
          w = h * ratio
        }
        w = Math.max(w, min * Math.max(1, ratio))
        w = Math.min(w, maxW, maxH * ratio)
        h = w / ratio
      } else {
        w = clamp(w, min, maxW)
        h = clamp(h, min, maxH)
      }

      return {
        x: dir[0] > 0 ? ax : dir[0] < 0 ? ax - w : cx - w / 2,
        y: dir[1] > 0 ? ay : dir[1] < 0 ? ay - h : cy - h / 2,
        w: w,
        h: h
      }
    },

    /* ---------- 尺寸与渲染 ---------- */

    /** 读取舞台尺寸并同步画布分辨率（兼容高清屏） */
    _measure: function () {
      var rect = this.stage.getBoundingClientRect()
      var dpr = window.devicePixelRatio || 1
      this.stageW = rect.width
      this.stageH = rect.height
      this.canvas.width = Math.round(rect.width * dpr)
      this.canvas.height = Math.round(rect.height * dpr)
      this.dpr = dpr
    },

    _handleResize: function () {
      var oldW = this.stageW
      var oldH = this.stageH
      this._measure()
      if (!this.image || !oldW || !oldH) return this._render()

      // 按尺寸变化比例同步缩放图片和裁剪框
      var k = Math.min(this.stageW / oldW, this.stageH / oldH)
      var s = this.state
      var cx = (oldW / 2 + s.tx) * k
      var cy = (oldH / 2 + s.ty) * k
      s.scale *= k
      s.fitScale *= k
      s.tx = cx - this.stageW / 2
      s.ty = cy - this.stageH / 2

      var c = this.crop
      c.w = Math.min(c.w * k, this.stageW)
      c.h = Math.min(c.h * k, this.stageH)
      c.x = clamp(c.x * k, 0, this.stageW - c.w)
      c.y = clamp(c.y * k, 0, this.stageH - c.h)
      this._render()
    },

    /** 按当前变换把原图绘制到指定 ctx（舞台坐标系） */
    _drawImage: function (ctx) {
      var s = this.state
      var img = this.image
      ctx.save()
      ctx.translate(this.stageW / 2 + s.tx, this.stageH / 2 + s.ty)
      ctx.rotate(s.rotate * Math.PI / 180)
      ctx.scale(s.scale * s.flipX, s.scale * s.flipY)
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2)
      ctx.restore()
    },

    _render: function () {
      var ctx = this.ctx
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
      ctx.clearRect(0, 0, this.stageW, this.stageH)
      if (this.image) this._drawImage(ctx)
      this._updateCropBox()
      this._updateToolbar()
    },

    _updateCropBox: function () {
      var c = this.crop
      var visible = !!this.image
      this.cropEl.style.display = visible ? 'block' : 'none'
      this.emptyEl.style.display = visible ? 'none' : 'flex'
      this.root.classList.toggle('is-empty', !visible)
      if (!visible) return
      this.cropEl.style.transform = 'translate(' + c.x + 'px,' + c.y + 'px)'
      this.cropEl.style.width = c.w + 'px'
      this.cropEl.style.height = c.h + 'px'
      var size = this._outputSize()
      this.sizeEl.textContent = size.width + ' × ' + size.height
    },

    _updateToolbar: function () {
      if (!this.options.toolbar) return
      var s = this.state
      var rotate = Math.round(s.rotate)
      var zoom = Math.round(this.getZoom() * 100)
      this.rotateSlider.input.value = rotate
      this.rotateSlider.value.textContent = rotate + '°'
      this.zoomSlider.input.value = zoom
      this.zoomSlider.value.textContent = zoom + '%'
      var ratio = this.aspectRatio
      this.ratioBtns.forEach(function (item) {
        var active = isRatio(item.value) ? Math.abs(item.value - ratio) < 1e-6 : !isRatio(ratio)
        item.el.classList.toggle('is-active', active)
      })
      var disabled = !this.image
      this.root.querySelectorAll('.ic-toolbar button, .ic-toolbar input').forEach(function (node) {
        if (node.title !== '上传图片') node.disabled = disabled
      })
    },

    /** 初始化：图片适应舞台居中，裁剪框居中于图片显示区域 */
    _fit: function () {
      var img = this.image
      var W = this.stageW
      var H = this.stageH
      var fit = Math.min(W / img.naturalWidth, H / img.naturalHeight)
      this.state = { scale: fit, fitScale: fit, rotate: 0, flipX: 1, flipY: 1, tx: 0, ty: 0 }
      this._initCrop()
    },

    /** 在图片显示区域内按比例生成居中裁剪框 */
    _initCrop: function () {
      var img = this.image
      var s = this.state
      var W = this.stageW
      var H = this.stageH
      var areaW = Math.min(img.naturalWidth * s.fitScale, W) * this.options.initCropRatio
      var areaH = Math.min(img.naturalHeight * s.fitScale, H) * this.options.initCropRatio
      var w = areaW
      var h = areaH
      if (isRatio(this.aspectRatio)) {
        if (areaW / areaH > this.aspectRatio) w = areaH * this.aspectRatio
        else h = areaW / this.aspectRatio
      }
      this.crop = { x: (W - w) / 2, y: (H - h) / 2, w: w, h: h }
    },

    /** 导出图片的默认像素尺寸（对应原图分辨率） */
    _outputSize: function () {
      var c = this.crop
      var w = c.w / this.state.scale
      var h = c.h / this.state.scale
      var max = this.options.output.maxSize
      var k = Math.max(w, h) > max ? max / Math.max(w, h) : 1
      return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) }
    },

    _emitChange: function () {
      if (typeof this.options.onChange === 'function') this.options.onChange(this.getData())
    },

    /* ---------- 公开 API ---------- */

    /**
     * 加载图片
     * @param {string|File|Blob} source 图片地址或文件
     * @returns {Promise<ImageCropper>}
     */
    load: function (source) {
      var self = this
      if (this._objectUrl) {
        URL.revokeObjectURL(this._objectUrl)
        this._objectUrl = null
      }
      var src = source
      if (typeof Blob !== 'undefined' && source instanceof Blob) {
        src = this._objectUrl = URL.createObjectURL(source)
      }

      return new Promise(function (resolve, reject) {
        var img = new Image()
        // 仅远程地址需要跨域设置，blob/data 地址设置后反而可能失败
        if (self.options.crossOrigin && /^https?:/i.test(src)) img.crossOrigin = self.options.crossOrigin
        img.onload = function () {
          self.image = img
          self._measure()
          self._fit()
          self._render()
          if (typeof self.options.onReady === 'function') self.options.onReady(self)
          self._emitChange()
          resolve(self)
        }
        img.onerror = function () {
          var err = new Error('ImageCropper: 图片加载失败 ' + src)
          if (typeof self.options.onError === 'function') self.options.onError(err)
          reject(err)
        }
        img.src = src
      })
    },

    /** 相对旋转（角度），以裁剪框中心为旋转中心 */
    rotate: function (deg) {
      return this.rotateTo(this.state.rotate + deg)
    },

    /** 旋转到指定角度 */
    rotateTo: function (deg) {
      if (!this.image) return this
      var s = this.state
      var target = normalizeDeg(deg)
      var delta = (target - s.rotate) * Math.PI / 180
      // 图片中心绕裁剪框中心旋转，保证旋转时裁剪内容不跑偏
      var px = this.crop.x + this.crop.w / 2
      var py = this.crop.y + this.crop.h / 2
      var cx = this.stageW / 2 + s.tx - px
      var cy = this.stageH / 2 + s.ty - py
      var cos = Math.cos(delta)
      var sin = Math.sin(delta)
      s.tx = px + cx * cos - cy * sin - this.stageW / 2
      s.ty = py + cx * sin + cy * cos - this.stageH / 2
      s.rotate = target
      this._render()
      this._emitChange()
      return this
    },

    /**
     * 翻转（屏幕方向），以裁剪框中心为镜像轴
     * @param {'x'|'y'} axis x 水平翻转，y 垂直翻转
     */
    flip: function (axis) {
      if (!this.image) return this
      var s = this.state
      // 屏幕镜像 = 局部镜像 + 旋转角取反
      s.rotate = normalizeDeg(-s.rotate)
      if (axis === 'y') {
        s.flipY *= -1
        var py = this.crop.y + this.crop.h / 2
        s.ty = 2 * py - (this.stageH / 2 + s.ty) - this.stageH / 2
      } else {
        s.flipX *= -1
        var px = this.crop.x + this.crop.w / 2
        s.tx = 2 * px - (this.stageW / 2 + s.tx) - this.stageW / 2
      }
      this._render()
      this._emitChange()
      return this
    },

    /** 当前缩放倍数（相对“适应舞台”尺寸） */
    getZoom: function () {
      return this.state.scale / this.state.fitScale
    },

    /**
     * 缩放到指定倍数
     * @param {number} zoom 倍数，1 为适应舞台
     * @param {{x:number,y:number}} [pivot] 缩放中心(舞台坐标)，默认裁剪框中心
     */
    zoomTo: function (zoom, pivot) {
      if (!this.image) return this
      var s = this.state
      var next = clamp(zoom, this.options.minZoom, this.options.maxZoom) * s.fitScale
      var p = pivot || { x: this.crop.x + this.crop.w / 2, y: this.crop.y + this.crop.h / 2 }
      var k = next / s.scale
      var cx = this.stageW / 2 + s.tx
      var cy = this.stageH / 2 + s.ty
      s.tx = p.x + (cx - p.x) * k - this.stageW / 2
      s.ty = p.y + (cy - p.y) * k - this.stageH / 2
      s.scale = next
      this._render()
      this._emitChange()
      return this
    },

    /** 相对缩放，如 zoom(0.1) 放大 10% */
    zoom: function (delta) {
      return this.zoomTo(this.getZoom() + delta)
    },

    /**
     * 设置裁剪框宽高比
     * @param {number} ratio 宽/高，NaN 或 0 为自由比例
     */
    setAspectRatio: function (ratio) {
      this.aspectRatio = isRatio(ratio) ? ratio : NaN
      if (!this.image) return this._updateToolbar(), this
      if (isRatio(this.aspectRatio)) {
        // 以当前裁剪框中心为基准，在不越界的前提下尽量保持面积
        var c = this.crop
        var cx = c.x + c.w / 2
        var cy = c.y + c.h / 2
        var area = c.w * c.h
        var w = Math.sqrt(area * this.aspectRatio)
        var maxW = 2 * Math.min(cx, this.stageW - cx)
        var maxH = 2 * Math.min(cy, this.stageH - cy)
        w = Math.min(w, maxW, maxH * this.aspectRatio)
        var h = w / this.aspectRatio
        this.crop = { x: cx - w / 2, y: cy - h / 2, w: w, h: h }
      }
      this._render()
      this._emitChange()
      return this
    },

    /** 重置旋转、缩放、翻转和裁剪框 */
    reset: function () {
      if (!this.image) return this
      this._fit()
      this._render()
      this._emitChange()
      return this
    },

    /** 获取当前编辑参数 */
    getData: function () {
      var s = this.state
      var size = this.image ? this._outputSize() : { width: 0, height: 0 }
      return {
        rotate: s.rotate,
        zoom: this.getZoom(),
        flipX: s.flipX === -1,
        flipY: s.flipY === -1,
        aspectRatio: this.aspectRatio,
        cropBox: { x: this.crop.x, y: this.crop.y, width: this.crop.w, height: this.crop.h },
        outputWidth: size.width,
        outputHeight: size.height
      }
    },

    /**
     * 获取裁剪结果画布（按原图分辨率导出）
     * @param {object} [opts] { width, height, fillColor }
     *   width/height 指定输出尺寸（只传一个则按比例计算）；fillColor 透明区域填充色
     * @returns {HTMLCanvasElement|null}
     */
    getCroppedCanvas: function (opts) {
      if (!this.image) return null
      opts = opts || {}
      var c = this.crop
      var size = this._outputSize()
      var outW = opts.width || (opts.height ? Math.round(opts.height * c.w / c.h) : size.width)
      var outH = opts.height || (opts.width ? Math.round(opts.width * c.h / c.w) : size.height)

      var canvas = document.createElement('canvas')
      canvas.width = outW
      canvas.height = outH
      var ctx = canvas.getContext('2d')
      if (opts.fillColor) {
        ctx.fillStyle = opts.fillColor
        ctx.fillRect(0, 0, outW, outH)
      }
      // 把舞台中的裁剪区域映射到输出画布
      ctx.scale(outW / c.w, outH / c.h)
      ctx.translate(-c.x, -c.y)
      this._drawImage(ctx)
      return canvas
    },

    /**
     * 导出 dataURL
     * @param {object} [opts] 同 getCroppedCanvas，另支持 type / quality
     */
    toDataURL: function (opts) {
      opts = this._exportOpts(opts)
      var canvas = this.getCroppedCanvas(opts)
      return canvas ? canvas.toDataURL(opts.type, opts.quality) : ''
    },

    /**
     * 导出 Blob
     * @returns {Promise<Blob|null>}
     */
    toBlob: function (opts) {
      opts = this._exportOpts(opts)
      var canvas = this.getCroppedCanvas(opts)
      return new Promise(function (resolve) {
        if (!canvas) return resolve(null)
        canvas.toBlob(resolve, opts.type, opts.quality)
      })
    },

    /** 合并导出参数；jpeg 不支持透明，默认白底 */
    _exportOpts: function (opts) {
      var result = {}
      var key
      for (key in this.options.output) result[key] = this.options.output[key]
      for (key in opts || {}) result[key] = opts[key]
      if (/jpe?g/i.test(result.type) && !result.fillColor) result.fillColor = '#ffffff'
      return result
    },

    /** 确认裁剪：触发 onCrop 回调并返回画布 */
    confirm: function () {
      var canvas = this.getCroppedCanvas(this._exportOpts())
      if (canvas && typeof this.options.onCrop === 'function') {
        this.options.onCrop(canvas, this.getData())
      }
      return canvas
    },

    /** 销毁实例，移除事件和 DOM */
    destroy: function () {
      var stage = this.stage
      stage.removeEventListener('pointerdown', this._onPointerDown)
      stage.removeEventListener('pointermove', this._onPointerMove)
      stage.removeEventListener('pointerup', this._onPointerUp)
      stage.removeEventListener('pointercancel', this._onPointerUp)
      stage.removeEventListener('wheel', this._onWheel)
      stage.removeEventListener('dragover', this._onDragOver)
      stage.removeEventListener('dragleave', this._onDragLeave)
      stage.removeEventListener('drop', this._onDrop)
      if (this._resizeObserver) this._resizeObserver.disconnect()
      if (this._objectUrl) URL.revokeObjectURL(this._objectUrl)
      this.container.innerHTML = ''
      this.image = null
    }
  }

  ImageCropper.DEFAULTS = DEFAULTS
  return ImageCropper
})
