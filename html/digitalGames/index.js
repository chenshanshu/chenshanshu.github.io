class DigitalGames {
    constructor(params) {
        this.globalParams = params
        this.globalParams.threshold = this.globalParams.width / 2
        this.length = Math.pow(params.rank, 2)
        this.gameBox = document.getElementById('gameBox')
    }
    init() {
        this.getDigitals()
        this.initCanvas()
    }
    getDigitals() {
        let digitalList = Array(this.length - 1).fill(0).map((item, index) => {
            return {
                val: index + 1
            }
        })
        let len = digitalList.length
        while (--len > 0) {
            let random = Math.floor(Math.random() * len)
            digitalList[len] = [digitalList[random], digitalList[random] = digitalList[len]][0]
        }
        digitalList.push({
            val: '',
            isEmpty: true
        })
        this.digitalList = []
        while (digitalList.length) {
            let arr = digitalList.splice(0, this.globalParams.rank)
            this.digitalList.push(arr)
        }
    }
    initCanvas() {
        this.canvas = document.createElement('canvas')
        this.canvas.width = this.globalParams.rank * this.globalParams.width + 2
        this.canvas.height = this.globalParams.rank * this.globalParams.width + 2
        this.gameBox.appendChild(this.canvas)
        this.drawCanvas({
            isInit: true
        })
        this.globalParams.moveCount = 0;
        this.initCanvasEvent()
    }
    drawCanvas(params) {
        let ctx = this.canvas.getContext('2d')
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.font = '20px Georgia'
        ctx.fillStyle = '#efefef'
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
        if (params && params.isInit) {
            for (let i = 0; i < this.globalParams.rank; i++) {
                for (let j = 0; j < this.globalParams.rank; j++) {
                    let item = this.digitalList[i][j]
                    item.x = i
                    item.y = j
                    item.posLeft = item.y * this.globalParams.width + 1
                    item.posTop = item.x * this.globalParams.width + 1
                    if (!item.val) {
                        this.globalParams.emptyPos = item
                    } else {
                        ctx.fillStyle = '#fff'
                        ctx.fillRect(item.posLeft + 1, item.posTop + 1, this.globalParams.width - 2, this.globalParams.width - 2)
                        ctx.strokeRect(item.posLeft, item.posTop, this.globalParams.width, this.globalParams.width)
                        ctx.fillStyle = '#333'
                        ctx.fillText(item.val, item.posLeft + this.globalParams.width / 2, item.posTop + this.globalParams.width / 2)
                    }
                }
            }
        } else {
            let checkFlag = true
            let checkTemp = 0
            for (let i = 0; i < this.globalParams.rank; i++) {
                for (let j = 0; j < this.globalParams.rank; j++) {
                    let item = this.digitalList[i][j]
                    if (item.val) {
                        if (checkFlag && checkTemp < item.val) {
                            checkTemp = item.val
                        } else if (checkTemp > item.val) {
                            checkFlag = false
                        }
                    }
                    item.x = i
                    item.y = j
                    item.posLeft = item.y * 100 + 1
                    item.posTop = item.x * 100 + 1
                    if (!item.val) {
                        this.globalParams.emptyPos = item
                    } else {
                        ctx.fillStyle = '#fff'
                        ctx.fillRect((item.moveLeft || item.posLeft) + 1, (item.moveTop || item.posTop) + 1, this.globalParams.width - 2, this.globalParams.width - 2)
                        ctx.strokeRect((item.moveLeft || item.posLeft), (item.moveTop || item.posTop), this.globalParams.width, this.globalParams.width)
                        ctx.fillStyle = '#333'
                        ctx.fillText(item.val, (item.moveLeft || item.posLeft) + this.globalParams.width / 2, (item.moveTop || item.posTop) + this.globalParams.width / 2)
                    }
                }
            }

            if (checkFlag) {
                document.getElementById('gameTip').innerHTML = '<span>you win</span>'
            }
        }

    }
    initCanvasEvent() {
        function handleMousedown(e) {
            this.globalParams.startPos = {
                clientX: e.clientX,
                clientY: e.clientY,
            }
            let y = Math.floor(e.offsetX / this.globalParams.width)
            let x = Math.floor(e.offsetY / this.globalParams.width)
            this.globalParams.chooseItem = this.digitalList[x][y]
            if (this.globalParams.emptyPos.x === x && this.globalParams.emptyPos.y - y === -1) {
                this.globalParams.moveAble = true
                this.globalParams.moveDirection = 4 //向左
            } else if (this.globalParams.emptyPos.x - x === 1 && this.globalParams.emptyPos.y === y) {
                this.globalParams.moveAble = true
                this.globalParams.moveDirection = 3 //向下
            } else if (this.globalParams.emptyPos.x === x && this.globalParams.emptyPos.y - y === 1) {
                this.globalParams.moveAble = true
                this.globalParams.moveDirection = 2 //向右
            } else if (this.globalParams.emptyPos.x - x === -1 && this.globalParams.emptyPos.y === y) {
                this.globalParams.moveAble = true
                this.globalParams.moveDirection = 1 //向上
            } else {
                this.globalParams.moveAble = false
            }
        }

        function handleMousemove(e) {
            if (!this.globalParams.moveAble) return
            const movePos = {
                clientX: e.clientX,
                clientY: e.clientY
            }
            const xMove = 1.5 * (movePos['clientX'] - this.globalParams.startPos['clientX'])
            const yMove = 1.5 * (movePos['clientY'] - this.globalParams.startPos['clientY'])
            if (this.globalParams.moveDirection === 2 && xMove > 0) {
                this.globalParams.chooseItem['moveLeft'] = this.globalParams.chooseItem['posLeft'] + xMove
            } else if (this.globalParams.moveDirection === 4 && xMove < 0) {
                this.globalParams.chooseItem['moveLeft'] = this.globalParams.chooseItem['posLeft'] + xMove
            } else if (this.globalParams.moveDirection === 1 && yMove < 0) {
                this.globalParams.chooseItem['moveTop'] = this.globalParams.chooseItem['posTop'] + yMove
            } else if (this.globalParams.moveDirection === 3 && yMove > 0) {
                this.globalParams.chooseItem['moveTop'] = this.globalParams.chooseItem['posTop'] + yMove
            } else {
                return
            }
            this.drawCanvas()
            if (Math.abs(xMove) > this.globalParams.width * 0.65 || Math.abs(yMove) > this.globalParams.width * 0.65) {
                this.digitalList[this.globalParams.emptyPos.x][this.globalParams.emptyPos.y] = this.globalParams.chooseItem
                this.digitalList[this.globalParams.chooseItem.x][this.globalParams.chooseItem.y] = this.globalParams.emptyPos
                this.globalParams.moveCount++
                stopEvents.call(this)
            }
        }

        function stopEvents(e) {
            this.globalParams.moveAble = false
            if (this.globalParams.chooseItem) {
                this.globalParams.chooseItem['moveLeft'] = 0
                this.globalParams.chooseItem['moveTop'] = 0
            }
            const tip = document.getElementById('gameTip')
            tip.innerText = '您已经移动' + this.globalParams.moveCount + '次'
            this.drawCanvas()
        }
        this.canvas.addEventListener('mousedown', handleMousedown.bind(this))
        this.canvas.addEventListener('mousemove', handleMousemove.bind(this))
        this.canvas.addEventListener('mouseup', stopEvents.bind(this))
        this.canvas.addEventListener('mouseleave', stopEvents.bind(this))
    }
    autoMove() {

        /**
         * 空格向左移动
         * @param {*} params 
         * params.time 动画时长 ms
         * params.direction 1：向上；2：向右；3：向下；4：向左
         */
        function move(params) {
            let directionList = params.directionList || []
            const animalTime = params.time || 250
            const direction = directionList.shift() || params.direction
            const p = Math.pow(animalTime, 2) / this.globalParams.width
            const emptyPos = this.globalParams.emptyPos
            let moveItem
            if (direction === 1 && emptyPos.x - 1 >= 0) {
                moveItem = this.digitalList[emptyPos.x - 1][emptyPos.y]
            } else if (direction === 2 && emptyPos.y + 1 <= this.globalParams.rank) {
                moveItem = this.digitalList[emptyPos.x][emptyPos.y + 1]
            } else if (direction === 3 && emptyPos.x + 1 <= this.globalParams.rank) {
                moveItem = this.digitalList[emptyPos.x + 1][emptyPos.y]
            } else if (direction === 4 && emptyPos.y - 1 >= 0) {
                moveItem = this.digitalList[emptyPos.x][emptyPos.y - 1]
            } else {
                return
            }
            const startTime = new Date().getTime()
            let animalId = requestAnimationFrame(animationRender.bind(this))

            function animationRender() {
                const timeRange = new Date().getTime() - startTime
                let moveDistance = Math.pow(timeRange, 2) / p
                moveDistance = moveDistance > this.globalParams.width ? this.globalParams.width : moveDistance
                if (moveDistance >= this.globalParams.width) {
                    handleExchange.call(this, moveItem, emptyPos)
                    cancelAnimationFrame(animalId)
                    if (params.callback && typeof params.callback === 'function') {
                        params.callback.call(this)
                    }
                    if (directionList.length > 0) {
                        move.call(this, {
                            directionList: directionList
                        })
                    }
                } else {
                    if (direction === 1) {
                        moveItem['moveTop'] = moveItem['posTop'] + moveDistance
                    } else if (direction === 2) {
                        moveItem['moveLeft'] = moveItem['posLeft'] - moveDistance
                    } else if (direction === 3) {
                        moveItem['moveTop'] = moveItem['posTop'] - moveDistance
                    } else if (direction === 4) {
                        moveItem['moveLeft'] = moveItem['posLeft'] + moveDistance
                    }
                    this.drawCanvas()
                    animalId = requestAnimationFrame(animationRender.bind(this))
                }
            }
        }

        /**
         * 交换两个元素的位置
         * @param {*} a 
         * @param {*} b 
         */
        function handleExchange(a, b) {
            a['moveLeft'] = a['moveTop'] = b['moveLeft'] = b['moveTop'] = 0
            this.digitalList[a.x][a.y] = b
            this.digitalList[b.x][b.y] = a
            this.drawCanvas()
        }
        /**
         * 将空格移到目标前方
         * @param {*} val 
         */

        function moveToTarget(val) {
            const globalParams = this.globalParams
            const digitalList = this.digitalList
            console.log(JSON.stringify(digitalList))
            // 找到需要移动的元素
            // 将空格移到该元素前面

            let moveVal = 0 //需要移动的值
            let aim = null //需要移动的目标
            for (let i = 0; i < globalParams.rank; i++) {
                for (let j = 0; j < globalParams.rank; j++) {
                    let currentVal = i * globalParams.rank + j + 1;
                    if (digitalList[i][j]['val'] !== currentVal && !moveVal) {
                        moveVal = currentVal
                    } else if (digitalList[i][j]['val'] === moveVal) {
                        aim = digitalList[i][j]
                    }
                    if (aim) break
                }
                if (aim) break
            }

            const target = (aim.y == 0 || aim.x == globalParams.rank - 1) ? [aim.x - 1, aim.y] : [aim.x, aim.y - 1]
            const emptyPos = [globalParams.emptyPos.x, globalParams.emptyPos.y]

            let movingPos = [emptyPos[0], emptyPos[1]]
            let directionList = []
            let count = 100

            while (movingPos[0] !== target[0] || movingPos[1] !== target[1]) {
                count--
                if (count <= 0) break
                let direction
                if (aim.y < movingPos[1]) {
                    direction = 4
                } else if (aim.x > movingPos[0]) {
                    direction = 3
                } else if (aim.x < movingPos[0]) {
                    direction = 1
                } else if (aim.y > movingPos[1]) {
                    direction = 2
                }
                if ((aim.x === movingPos[0]) && (movingPos[1] - aim.y === 1)) {
                    direction = aim.x === 0 ? 3 : 1
                } else if ((aim.y === movingPos[1]) && (movingPos[0] - aim.x === 1)) {
                    direction = aim.y === 0 ? 2 : 4
                } else if (aim.y === 0 && movingPos[1] === 1 && movingPos[0] === aim.x + 1) {
                    direction = 1
                }
                direction && directionList.push(direction)
                if (direction === 1) {
                    movingPos[0]--
                } else if (direction === 2) {
                    movingPos[1]++
                } else if (direction === 3) {
                    movingPos[0]++
                } else if (direction === 4) {
                    movingPos[1]--
                }
            }

            move.call(this, {
                directionList: directionList,
                callback: () => {

                }
            })
        }
        moveToTarget.call(this)
    }
}