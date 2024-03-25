let viewWidth = document.body.clientWidth > 420 ? 420 : document.body.clientWidth
let viewHeight = document.body.clientHeight > 812 ? 812 : document.body.clientHeight
const DPR = window.devicePixelRatio

// 创建场景，场景1（初始化游戏）
class InitScene extends Phaser.Scene {
    constructor() {
        super({ key: 'InitScene' })
    }
    // 开始按钮
    startBtn = null
    preload() {
        this.load.image('initBG', 'assets/imgs/startBG.png')
        this.load.image('startBtn', 'assets/imgs/start_btn.png')
    }
    create() {
        // 设置缩放让背景拉伸铺满全屏
        this.add.image(viewWidth / 2, viewHeight / 2, 'initBG').setScale(viewWidth / 320, viewHeight / 568)
        this.startBtn = this.add.sprite(viewWidth / 2, viewHeight / 2 + 140, 'startBtn').setInteractive().setScale(.5)
        this.startBtn.on('pointerup', function () {
            game.scene.start('GameScene')
            game.scene.sleep('InitScene')
        })
    }
    update() {}
}

// 创建场景， 场景2（游戏中）
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' })
    }
    // 我方飞机
    player = null
    // 背景
    bg = null
    // 键盘管理器
    cursors = null
    // 我方飞机子弹对象池
    myBullets = null
    // 敌方飞机对象池
    enemyPlanes1 = null
    enemyPlanes2 = null
    enemyPlanes3 = null
    // 生产敌机流水线
    enemyTimer = null
    // 万物生产总流水线
    productionLineRunTimer = null
    // 道具对象池
    supplys1 = null
    supplys2 = null
    // 记分文字
    scoreText = null
    // 连发道具延时器
    myBulletQuantityTimer = []
    // 音效
    sounds = {
        do: null, // 我机子弹
        bulletQuantity: null, // 吃到连发道具
        bigboom: null, // 吃到炸弹道具
        bgm: null, // 背景音乐
        gameover: null, // 游戏结束
    }
    initData() {
        // 我方飞机x，y(非实时，用于拖拽和初始化使用，获取实时直接player.x/player.y)
        this.x = viewWidth / 2
        this.y = viewHeight - 200
        // 游戏全局速度控制
        this.speed = 0.4
        // 游戏结束
        this.isGameOver = false
        // 我方飞机子弹连发数量
        this.myBulletQuantity = 1
        // 记分
        this.score = 0
        this.scoreText?.setText('Score: ' + this.score)
        this.draw = false
        this.input.on('pointermove', pointer => {
            if (this.draw) {
                this.player.x = this.x + pointer.x - pointer.downX
                this.player.y = this.y + pointer.y - pointer.downY
            }
        })
        this.myBulletQuantityTimer.forEach(item => clearTimeout(item))
        this.sounds.bgm.play()
    }
    preload() {
        this.load.image('gameBG', 'assets/imgs/gameBG.png')
        this.load.image('myBullet', 'assets/imgs/bomb.png')
        this.load.image('bulletSupply', 'assets/imgs/bullet_supply.png')
        this.load.image('bombSupply', 'assets/imgs/bomb_supply.png')
        this.load.spritesheet('myPlane', 'assets/imgs/myPlane.png', { frameWidth: 66, frameHeight: 82 })
        this.load.spritesheet('smallPlane', 'assets/imgs/smallPlane.png', { frameWidth: 34, frameHeight: 24 })
        this.load.spritesheet('midPlane', 'assets/imgs/midPlane.png', { frameWidth: 46, frameHeight: 64 })
        this.load.spritesheet('bigPlane', 'assets/imgs/bigPlane.png', { frameWidth: 110, frameHeight: 170 })
        this.load.image('startBtn', 'assets/imgs/start_btn.png')
        this.load.audio('do', 'assets/audio/ndo.mp3')
        this.load.audio('bulletQuantity', 'assets/audio/chi.mp3')
        this.load.audio('bigboom', 'assets/audio/bigboom.mp3')
        this.load.audio('gameover', 'assets/audio/gameover.mp3')
        this.load.audio('bgm', 'assets/audio/bgm.mp3')
    }
    create() {
        this.sounds.do = this.sound.add('do')
        this.sounds.bulletQuantity = this.sound.add('bulletQuantity', { volume: .6 })
        this.sounds.bigboom = this.sound.add('bigboom')
        this.sounds.gameover = this.sound.add('gameover')
        this.sounds.bgm = this.sound.add('bgm', { loop: true })
        this.initData()
        this.bg = this.add.tileSprite(viewWidth / 2, viewHeight / 2, viewWidth, viewHeight, 'gameBG')
        this.player = this.physics.add.sprite(this.x, this.y, 'myPlane').setInteractive()
        this.player.setCollideWorldBounds(true)
        this.player.body.setGravityY(0) // 重力
        // this.player.depth = 99 // 相当于css的z-index
        // 我方飞机正常游戏动画
        this.anims.create({
            key: 'myPlaneRun',
            frames: this.anims.generateFrameNumbers('myPlane', { start: 0, end: 1 }),
            frameRate: 8,
            repeat: -1
        })
        // 我方飞机爆炸动画
        this.anims.create({
            key: 'myPlaneBoom',
            frames: this.anims.generateFrameNumbers('myPlane', { start: 2, end: 5 }),
            frameRate: 8,
        })
        // 敌方小飞机正常游戏动画
        this.anims.create({
            key: 'smallPlaneRun',
            frames: [ { key: 'smallPlane', frame: 0 } ],
            frameRate: 8
        })
        // 敌方小飞机爆炸动画
        this.anims.create({
            key: 'smallPlaneBoom',
            frames: this.anims.generateFrameNumbers('smallPlane', { start: 1, end: 4 }),
            frameRate: 32,
        })
        // 敌方中飞机正常游戏动画
        this.anims.create({
            key: 'midPlaneRun',
            frames: [ { key: 'midPlane', frame: 0 } ],
            frameRate: 8
        })
        // 敌方中飞机挨打动画
        this.anims.create({
            key: 'midPlaneAida',
            frames: [ { key: 'midPlane', frame: 1 } ],
            frameRate: 8
        })
        // 敌方中飞机爆炸动画
        this.anims.create({
            key: 'midPlaneBoom',
            frames: this.anims.generateFrameNumbers('midPlane', { start: 2, end: 5 }),
            frameRate: 32,
        })
        // 敌方大飞机正常游戏动画
        this.anims.create({
            key: 'bigPlaneRun',
            frames: [ { key: 'bigPlane', frame: 0 } ],
            frameRate: 8
        })
        // 敌方大飞机挨打动画
        this.anims.create({
            key: 'bigPlaneAida',
            frames: [ { key: 'bigPlane', frame: 1 } ],
            frameRate: 8
        })
        // 敌方大飞机爆炸动画
        this.anims.create({
            key: 'bigPlaneBoom',
            frames: this.anims.generateFrameNumbers('bigPlane', { start: 2, end: 7 }),
            frameRate: 38,
        })
        this.cursors = this.input.keyboard.createCursorKeys()
        // 拖拽式控制我方飞机移动
        this.player.on('pointerdown', () => {
            this.draw = true
            this.x = this.player.x
            this.y = this.player.y
        })
        this.input.on('pointerup', () => {
            this.draw = false
        })
        // 初始化我方飞机子弹对象池
        this.myBullets = this.physics.add.group()
        // 自动发射子弹
        this.time.addEvent({
            delay: 260,
            loop: true,
            callback: () => {
                !this.isGameOver && this.createMyBullet()
            }
        })
        // 初始化敌方飞机对象池
        this.enemyPlanes1 = this.physics.add.group()
        this.enemyPlanes2 = this.physics.add.group()
        this.enemyPlanes3 = this.physics.add.group()
        // 流水线启动
        this.productionLineRun()
        // 初始化道具对象池
        this.supplys1 = this.physics.add.group()
        // 初始化道具对象池
        this.supplys2 = this.physics.add.group()
        // 敌机与我方飞机子弹碰撞检测
        this.physics.add.overlap(this.myBullets, this.enemyPlanes1, this.enemyAndMyBulletCollision, null, this)
        this.physics.add.overlap(this.myBullets, this.enemyPlanes2, this.enemyAndMyBulletCollision, null, this)
        this.physics.add.overlap(this.myBullets, this.enemyPlanes3, this.enemyAndMyBulletCollision, null, this)
        // 敌机与我方飞机碰撞检测
        this.physics.add.overlap(this.player, this.enemyPlanes1, this.enemyAndMyPlaneCollision, null, this)
        this.physics.add.overlap(this.player, this.enemyPlanes2, this.enemyAndMyPlaneCollision, null, this)
        this.physics.add.overlap(this.player, this.enemyPlanes3, this.enemyAndMyPlaneCollision, null, this)
        // 道具与我方飞机碰撞检测
        this.physics.add.overlap(this.player, this.supplys1, this.supplyAndMyPlaneCollision, null, this)
        this.physics.add.overlap(this.player, this.supplys2, this.supplyAndMyPlaneCollision, null, this)
        // 记分
        this.scoreText = this.add.text(16, 16, 'score: 0', { fontSize: '28px', fill: '#000' })
        this.scoreText.depth = 99
    }
    update() {
        if (this.isGameOver) {
            // game over
            this.player.anims.play('myPlaneBoom', true)
        } else {
            this.bg.tilePositionY -= this.speed
            this.player.anims.play('myPlaneRun', true)
            // 键盘控制我方飞机
            if (this.cursors.left.isDown) {
                this.player.setVelocityX(-260)
            } else if (this.cursors.right.isDown) {
                this.player.setVelocityX(260)
            } else {
                this.player.setVelocityX(0)
            }
            if (this.cursors.up.isDown) {
                this.player.setVelocityY(-260)
            } else if (this.cursors.down.isDown) {
                this.player.setVelocityY(260)
            } else {
                this.player.setVelocityY(0)
            }
            // 我方飞机子弹对象池子弹边界检测，使用killAndHide进行复用提高性能
            this.myBullets.getChildren().forEach(item => {
                if (item.active && item.y < -item.height) {
                    this.myBullets.killAndHide(item)
                }
            })
            // 敌方飞机对象池边界检测，使用killAndHide进行复用提高性能
            this.enemyPlanes1.getChildren().forEach(item => {
                if (item.active && item.y > viewHeight + item.height) {
                    this.enemyPlanes1.killAndHide(item)
                }
            })
            this.enemyPlanes2.getChildren().forEach(item => {
                if (item.active && item.y > viewHeight + item.height) {
                    this.enemyPlanes2.killAndHide(item)
                }
            })
            this.enemyPlanes3.getChildren().forEach(item => {
                if (item.active && item.y > viewHeight + item.height) {
                    this.enemyPlanes3.killAndHide(item)
                }
            })
            // 道具对象池边界检测，使用killAndHide进行复用提高性能
            this.supplys1.getChildren().forEach(item => {
                if (item.active && item.y > viewHeight + item.height) {
                    this.supplys1.killAndHide(item)
                }
            })
            this.supplys2.getChildren().forEach(item => {
                if (item.active && item.y > viewHeight + item.height) {
                    this.supplys2.killAndHide(item)
                }
            })
        }
    }
    // 生成我方飞机子弹
    createMyBullet() {
        // 动态子弹连发x坐标处理
        for (let i = 0; i < this.myBulletQuantity; i++) {
            let x = 
                i < this.myBulletQuantity / 2
                ? 
                (
                    this.myBulletQuantity % 2 != 0 && i > this.myBulletQuantity / 2 - 1
                    ?
                    this.player.x
                    :
                    this.player.x - ((this.myBulletQuantity - i - this.myBulletQuantity / 2 - (this.myBulletQuantity % 2 != 0 ? 0.5 : 0)) * 20)
                )
                :
                this.player.x + (i - this.myBulletQuantity / 2 + (this.myBulletQuantity % 2 != 0 ? 0.5 : 1)) * 20
            // 从对象池取子弹
            const tmpMyBullet = this.myBullets.get(x, this.player.y - this.player.height / 2 + 10, 'myBullet')
            tmpMyBullet.name = 'myBullet'
            tmpMyBullet.setVelocity(0, -500)
            tmpMyBullet.setScale(0.6, 1)
            tmpMyBullet.setActive(true)
            tmpMyBullet.setVisible(true)
            this.sounds.do.play()
        }
    }
    // 流水线作坊开始运作
    productionLineRun() {
        this.productionLineRunTimer = this.time.addEvent({
            delay: 2000,
            loop: true,
            callback: () => {
                // 敌机生产
                this.speed = this.speed >= 1.8 ? 1.8 : this.speed + 0.05
                this.enemyTimer?.destroy()
                this.enemyTimer = this.time.addEvent({
                    delay: 700 - this.speed * 280,
                    loop: true,
                    callback: () => {
                        let index = Math.floor(Math.random() * 8)
                        if (index < 4) {
                            this.createEnemySmallPlane()
                        } else if (index >= 4 && index < 7) {
                            this.createEnemyMidPlane()
                        } else {
                            this.createEnemyBigPlane()
                        }
                    }
                })
                // 道具生产
                const num = Math.ceil(Math.random() * 6)
                if (num < 4) {
                    this.createSupply('bulletSupply')
                } else if (num < 6) {
                    this.createSupply('bombSupply')
                }
            }
        })
    }
    // 生成敌方小飞机
    createEnemySmallPlane() {
        let x = 17 + Math.ceil(Math.random() * (viewWidth - 34))
        let y = -12
        const tmpenemyPlane = this.enemyPlanes1.get(x, y, 'smallPlane')
        tmpenemyPlane.name = 'smallPlane'
        tmpenemyPlane.hp = 1
        tmpenemyPlane.setVelocity(0, this.speed / 4 * 10 * 60)
        tmpenemyPlane.setActive(true)
        tmpenemyPlane.setVisible(true)
        tmpenemyPlane.anims.play('smallPlaneRun')
    }
    // 生成敌方中飞机
    createEnemyMidPlane() {
        let x = 23 + Math.ceil(Math.random() * (viewWidth - 46))
        let y = -32
        const tmpenemyPlane = this.enemyPlanes2.get(x, y, 'midPlane')
        tmpenemyPlane.name = 'midPlane'
        tmpenemyPlane.hp = 3
        tmpenemyPlane.setVelocity(0, this.speed / 4 * 10 * 60)
        tmpenemyPlane.setActive(true)
        tmpenemyPlane.setVisible(true)
        tmpenemyPlane.anims.play('midPlaneRun')
    }
    // 生成敌方大飞机
    createEnemyBigPlane() {
        let x = 55 + Math.ceil(Math.random() * (viewWidth - 110))
        let y = -85
        const tmpenemyPlane = this.enemyPlanes3.get(x, y, 'bigPlane')
        tmpenemyPlane.name = 'bigPlane'
        tmpenemyPlane.hp = 5
        tmpenemyPlane.setVelocity(0, this.speed / 4 * 10 * 60)
        tmpenemyPlane.setActive(true)
        tmpenemyPlane.setVisible(true)
        tmpenemyPlane.anims.play('bigPlaneRun')
    }
    // 生成道具
    createSupply(type) {
        let x = 30 + Math.ceil(Math.random() * (viewWidth - 60))
        let y = -55
        let tmpsupply = null
        if (type == 'bulletSupply') {
            tmpsupply = this.supplys1.get(x, y, type)
        } else if (type == 'bombSupply') {
            tmpsupply = this.supplys2.get(x, y, type)
        }
        tmpsupply.name = type
        tmpsupply.setVelocity(0, 60)
        tmpsupply.setActive(true)
        tmpsupply.setVisible(true)
    }
    // 敌机与我方飞机子弹碰撞检测
    enemyAndMyBulletCollision(myBullet, enemyPlane) {
        if (myBullet.active && enemyPlane.active) {
            let animNames = []
            let enemyPlanes = null
            switch (enemyPlane.name) {
                case 'midPlane':
                    animNames = ['midPlaneAida', 'midPlaneBoom']
                    enemyPlanes = this.enemyPlanes2
                    break
                case 'bigPlane':
                    animNames = ['bigPlaneAida', 'bigPlaneBoom']
                    enemyPlanes = this.enemyPlanes3
                    break
                case 'smallPlane':
                    animNames = ['', 'smallPlaneBoom']
                    enemyPlanes = this.enemyPlanes1
                    break
                default:
                    break
            }
            enemyPlane.hp -= 1
            // 显示敌机挨打动画
            if (enemyPlane.hp > 0) {
                enemyPlane.anims.play(animNames[0])
            }
            // 血量没了显示敌机爆炸动画，0.36s后消失
            if (enemyPlane.hp == 0) {
                enemyPlane.anims.play(animNames[1])
                enemyPlane.setVelocity(0, 0)
                setTimeout(() => {
                    enemyPlanes.killAndHide(enemyPlane)
                }, 180)
                this.score += 10
                this.scoreText.setText('Score: ' + this.score)
            }
            // 防止敌机在爆炸动画中使子弹消失
            if (enemyPlane.hp >= 0) {
                this.myBullets.killAndHide(myBullet)
            }
        }
    }
    // 敌机与我方飞机碰撞检测
    enemyAndMyPlaneCollision(myPlane, enemyPlane) {
        if (enemyPlane.hp > 0 && enemyPlane.active) {
            this.sounds.bgm.stop()
            this.sounds.gameover.play()
            this.isGameOver = true
            this.productionLineRunTimer.destroy()
            this.enemyTimer?.destroy()
            this.physics.pause()
            this.input.off('pointermove')
            let startBtn = this.add.sprite(viewWidth / 2, viewHeight / 2, 'startBtn').setInteractive().setScale(.5)
            startBtn.on('pointerup', () => {
                startBtn.destroy()
                this.initData()
                this.myBullets.getChildren().forEach(item => {
                    this.myBullets.killAndHide(item)
                })
                this.enemyPlanes1.getChildren().forEach(item => {
                    this.enemyPlanes1.killAndHide(item)
                })
                this.enemyPlanes2.getChildren().forEach(item => {
                    this.enemyPlanes2.killAndHide(item)
                })
                this.enemyPlanes3.getChildren().forEach(item => {
                    this.enemyPlanes3.killAndHide(item)
                })
                this.supplys1.getChildren().forEach(item => {
                    this.supplys1.killAndHide(item)
                })
                this.supplys2.getChildren().forEach(item => {
                    this.supplys2.killAndHide(item)
                })
                this.player.x = this.x
                this.player.y = this.y
                this.productionLineRun()
                this.physics.resume()
            })
        }
    }
    // 道具与我方飞机碰撞检测
    supplyAndMyPlaneCollision(myPlane, supply) {
        if (supply.active) {
            if (supply.name == 'bulletSupply') {
                if (this.myBulletQuantity < 9) {
                    this.myBulletQuantity++
                    let timer = setTimeout(() => {
                        this.myBulletQuantity--
                        this.myBulletQuantityTimer.splice(this.myBulletQuantityTimer.indexOf(timer), 1)
                    }, 12000)
                    this.myBulletQuantityTimer.push(timer)
                }
                this.sounds.bulletQuantity.play()
                this.supplys1.killAndHide(supply)
            } else if (supply.name == 'bombSupply') {
                this.enemyPlanes1.getChildren().forEach(item => {
                    if (item.active) {
                        item.hp = 0
                        item.anims.play('smallPlaneBoom')
                        item.setVelocity(0, 0)
                        setTimeout(() => {
                            this.enemyPlanes1.killAndHide(item)
                        }, 180)
                        this.score += 10
                        this.scoreText.setText('Score: ' + this.score)
                    }
                })
                this.enemyPlanes2.getChildren().forEach(item => {
                    if (item.active) {
                        item.hp = 0
                        item.anims.play('midPlaneBoom')
                        item.setVelocity(0, 0)
                        setTimeout(() => {
                            this.enemyPlanes2.killAndHide(item)
                        }, 180)
                        this.score += 10
                        this.scoreText.setText('Score: ' + this.score)
                    }
                })
                this.enemyPlanes3.getChildren().forEach(item => {
                    if (item.active) {
                        item.hp = 0
                        item.anims.play('bigPlaneBoom')
                        item.setVelocity(0, 0)
                        setTimeout(() => {
                            this.enemyPlanes3.killAndHide(item)
                        }, 180)
                        this.score += 10
                        this.scoreText.setText('Score: ' + this.score)
                    }
                })
                this.sounds.bigboom.play()
                this.supplys2.killAndHide(supply)
            }
        }
    }
}

const config = {
    type: Phaser.AUTO,
    width: viewWidth,
    height: viewHeight,
    antialias: true,
    zoom: 0.99999999,
    resolution: DPR || 1,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: [InitScene, GameScene],
    audio: {
        disableWebAudio: false
    }
}
const game = new Phaser.Game(config)