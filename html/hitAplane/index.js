const {
    Phaser
} = require("../static/phaser3")

let viewWidth = document.body.clientWidth
let viewHeight = document.body.clientHeight
viewWidth = viewWidth > 420 ? 420 : viewWidth
viewHeight = viewHeight > 812 ? 812 : viewHeight
const DPR = window.devicePixelRatio

class InitScene extends Phaser.Scene {
    constructor() {
        super({
            key: 'InitScene'
        })
    }
    startBtn = null;
    preload() {
        this.load.image('initBG', 'assets/imgs/startBG.png')
        this.load.image('startBtn', 'assets/imgs/start_btn.png')
    }
    created() {
        this.add.image(viewWidth / 2, viewHeight / 2, 'initBG').setScale(viewWidth / 320, viewHeight / 568)
        this.startBtn = this.add.sprite(viewWidth / 2, viewHeight / 2 + 140, 'startBtn').setInteractive().setScale(.5)
        this.startBtn.on('pointerup', function () {
            Gamepad.scene.start('GameScene')
            Gamepad.scene.sleep('InitScene')
        })
    }
    update() {}

}
const config = {
    type: Phaser.AUTO,
    width: viewWidth,
    height: viewHeight,
    antialias: true,
    zoom: 0.99999999,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: {
                y: 0
            },
            debug: false
        },

    },
    scene: [InitScene]
}
const game = new Phaser.Game(config)

class GameScene extends Phaser.Scene {
    constructor() {
        super({
            key: 'GameScene'
        })
    }
    cursors = null
    initData() {
        this.isGameOver = false
        this.x = viewWidth / 2
        this.y = viewHeight - 200
        this.speed = 0.4
    }
    preload() {
        this.load.image('gameBG', 'assets/imgs/gameBG.png')
        this.load.spritesheet('myPlane', 'assets/imgs/myPlane.png', {
            frameWidth: 66,
            frameHeight: 82
        })
    }
    

}