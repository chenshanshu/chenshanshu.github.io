function ImgClip(params) {
    this.resize = false
    this.defaultParams = params || {}
    this.clipData = {}
    this.init()
}
ImgClip.prototype = {
    constructor: ImgClip,
    init: function () {
        this.canvas = document.getElementsByClassName('clipCanvas')[0]
        this.resultCanvas = document.getElementsByClassName('resultCanvas')[0];
        this.ctx = this.canvas.getContext('2d');
        this.getPicture({
            callback: function () {
                this.draw()
                this.initEvents()
            }.bind(this)
        })
        document.getElementById('originImg').addEventListener('change', function (e) {
            var files = e.target.files
            if (files.length === 0) return
            this.resize = false
            this.defaultParams.src = window.URL.createObjectURL(files[0])
            // var read = new FileReader()
            // read.readAsDataURL(file)
            // read.onload = function(){
            //     console.log(read.result)
            // }
            this.getPicture({
                callback: function () {
                    this.draw()
                    this.initEvents()
                }.bind(this)
            })
        }.bind(this))
        this.initProgressBar({
            dom: document.getElementById('rotateProgress'),
            val: 0.5,
            callback: function (params) {
                var percent = parseInt(params.percent) / 100
                this.clipData['rotate'] = (360 * percent - 180) / 180 * Math.PI
                this.draw({
                    callback: this.handleClip.bind(this)
                })
            }.bind(this)
        })
        this.initProgressBar({
            dom: document.getElementById('sizeProgress'),
            val: 0.5,
            callback: function (params) {
                var percent = parseInt(params.percent) / 100
                this.clipData['scale'] = percent + 0.5
                this.draw({
                    callback: this.handleClip.bind(this)
                })
            }.bind(this)
        })
    },
    getPicture: function (params) {
        if (!this.defaultParams.src) return
        var image = new Image()
        image.crossOrigin = ''
        image.onload = function (e) {
            this.originPic = image;
            if (params && params.callback && typeof params.callback === 'function') {
                params.callback()
            }
        }.bind(this)
        image.src = this.defaultParams.src
    },
    draw: function (params) {
        params = params || {}
        var imgWidth = this.originPic.width
        var imgHeight = this.originPic.height
        var canvasWidth = this.canvas.width
        var canvasHeight = this.canvas.height
        if (!this.resize) {
            this.resize = true
            var diagonal = Math.sqrt(imgWidth * imgWidth + imgHeight * imgHeight)
            diagonal = Math.ceil(diagonal)
            diagonal = diagonal > 1000 ? 1000 : diagonal
            this.canvas.width = this.canvas.height = diagonal
            canvasWidth = canvasHeight = diagonal
        }
        var ctx = this.ctx
        ctx.save()
        ctx.beginPath()
        ctx.fillStyle = "#ffffff"
        ctx.clearRect(0, 0, canvasWidth, canvasHeight)
        ctx.fillRect(0, 0, canvasWidth, canvasHeight)
        ctx.translate(parseInt(canvasWidth / 2), parseInt(canvasWidth / 2))
        if (this.clipData['rotate']) {
            ctx.rotate(this.clipData['rotate'])
        }
        if (this.clipData['scale']) {
            ctx.scale(this.clipData['scale'], this.clipData['scale'])
        }
        ctx.translate(-parseInt(canvasWidth / 2), -parseInt(canvasWidth / 2))
        ctx.drawImage(this.originPic, 0, 0, imgWidth, imgHeight, parseInt((canvasWidth - imgWidth) / 2), parseInt((canvasHeight - imgHeight) / 2), imgWidth, imgHeight)
        ctx.closePath()
        ctx.restore()

        if (this.clipData['checked']) {
            this.clipTarget = ctx.getImageData(this.clipData.x, this.clipData.y, this.clipData.width, this.clipData.height)
            ctx.beginPath()
            ctx.fillStyle = "rgba(0,0,0,0.3)"
            ctx.fillRect(0, 0, canvasWidth, canvasHeight)
            ctx.strokeStyle = '#0075eb';
            ctx.lineWidth = 1;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.moveTo(this.clipData.x - 1, this.clipData.y - 1)
            ctx.lineTo(this.clipData.x + this.clipData.width + 1, this.clipData.y - 1)
            ctx.lineTo(this.clipData.x + this.clipData.width + 1, this.clipData.y + this.clipData.height + 1)
            ctx.lineTo(this.clipData.x - 1, this.clipData.y + this.clipData.height + 1)
            ctx.lineTo(this.clipData.x - 1, this.clipData.y - 1)
            ctx.stroke()
            ctx.putImageData(this.clipTarget, this.clipData.x, this.clipData.y);
            ctx.closePath()
        } else {
            this.clipTarget = null
        }
        if (params.callback && typeof params.callback === 'function') {
            params.callback()
        }
    },
    initEvents: function () {
        var startPos //初始位置
        var movedPos //终点位置
        var mouseType = 0 //0：选择；1：移动;
        var inMouseDown = false; //鼠标点击状态
        this.canvas.onmousedown = function (event) {
            inMouseDown = true
            startPos = {
                x: event.offsetX,
                y: event.offsetY
            }
            if (this.clipData) {
                startPos['tx'] = startPos.x - this.clipData.x
                startPos['ty'] = startPos.y - this.clipData.y
                startPos['maxX'] = this.canvas.width - this.clipData.width
                startPos['maxY'] = this.canvas.height - this.clipData.height
                if ((startPos.x >= this.clipData.x && startPos.x <= this.clipData.x + this.clipData.width) && (startPos.y >= this.clipData.y && startPos.y <= this.clipData.y + this.clipData.height)) {
                    mouseType = 1
                } else {
                    mouseType = 0
                    this.clipData['x'] = 0
                    this.clipData['y'] = 0
                    this.clipData['width'] = 0
                    this.clipData['height'] = 0
                }
            }
            this.canvas.onmousemove = function (event) {
                movedPos = {
                    x: event.offsetX,
                    y: event.offsetY
                }
                mouseType ? handleMove.call(this) : handleChoose.call(this)
            }.bind(this)
        }.bind(this)
        this.canvas.onmouseleave = this.canvas.onmouseup = function () {
            if (inMouseDown) {
                inMouseDown = false
                this.canvas.onmousemove = null
                this.handleClip()
            }
        }.bind(this)

        function handleMove() {
            var x = movedPos.x - startPos.tx
            var y = movedPos.y - startPos.ty
            if (x < 0) x = 0
            if (y < 0) y = 0
            if (x > startPos.maxX) x = startPos.maxX
            if (y > startPos.maxY) y = startPos.maxY
            this.clipData['x'] = x
            this.clipData['y'] = y
            this.draw()
        }

        function handleChoose() {
            var clipWidth = Math.abs(movedPos.x - startPos.x)
            var clipHeight = Math.abs(movedPos.y - startPos.y)
            var clipwh = Math.min(clipWidth, clipHeight)
            if (movedPos.x > startPos.x && movedPos.y > startPos.y) {
                this.clipData['x'] = startPos.x
                this.clipData['y'] = startPos.y
                this.clipData['width'] = this.defaultParams.isSquare ? clipwh : clipWidth
                this.clipData['height'] = this.defaultParams.isSquare ? clipwh : clipHeight
                this.clipData['checked'] = true
            } else {
                this.clipData['x'] = 0
                this.clipData['y'] = 0
                this.clipData['width'] = 0
                this.clipData['height'] = 0
                this.clipData['checked'] = false
            }
            this.draw()
        }
    },
    handleClip: function () {
        if (!this.clipTarget) return
        this.resultCanvas.width = this.clipTarget.width
        this.resultCanvas.height = this.clipTarget.height
        var ctx = this.resultCanvas.getContext('2d')
        ctx.clearRect(0, 0, this.clipTarget.width, this.clipTarget.height)
        this.resultCanvas.getContext('2d').putImageData(this.clipTarget, 0, 0)
        var dataUrl = this.resultCanvas.toDataURL('image/jpeg', 1)
        document.getElementsByClassName('resultPic')[0].src = dataUrl
        console.log('裁剪结果', this.clipData)
    },
    initProgressBar: function (params) {
        params = params || {}
        var dom = params.dom
        var btn = dom.querySelector('.progressbar__btn')
        var startPos = {}
        var inMouseDown
        var historyPercent
        if (params.val) {
            var left = (dom.offsetWidth - btn.offsetWidth) * params.val
            btn.style.left = left + 'px'
            btn.innerText = parseInt(params.val * 100) + '%'
        }
        btn.onmousedown = function (event) {
            inMouseDown = true
            startPos['x'] = event.clientX
            startPos['y'] = event.clientY
            startPos['left'] = btn.offsetLeft
        }
        document.body.addEventListener('mousemove', mouseMove)
        document.body.addEventListener('mouseup', mouseup)
        document.body.addEventListener('mouseleave', mouseup)

        function mouseMove(e) {
            if (!inMouseDown || startPos.x === e.clientX) return
            var left = e.clientX - startPos.x + startPos.left
            var maxL = dom.offsetWidth - btn.offsetWidth
            if (left < 0) left = 0
            if (left > maxL) left = maxL
            btn.style.left = left + 'px'
            var proportion = left / maxL
            var percent = parseInt(proportion * 100) + '%'
            btn.innerText = percent
            if (historyPercent != percent) {
                historyPercent = percent
                if (params.callback && typeof params.callback === 'function') {
                    params.callback({
                        proportion: proportion,
                        percent: percent
                    })
                }
            }
        }

        function mouseup(e) {
            inMouseDown = false
        }
    }
}