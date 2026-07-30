function catchCat(params){
    this.defaultParams = params || {}
    this.init()
}
catchCat.prototype = {
    constructor: catchCat,
    init: function(){
        var parent = document.getElementById(this.defaultParams.parent) || document.body
        this.canvas = document.createElement('canvas')
        this.ctx = this.canvas.getContext('2d')
        this.canvas.width = 200
        this.canvas.height = 200
        console.log(this.canvas)
        parent.appendChild(this.canvas)
    },
    draw: function(){
        var ctx = this.ctx;


    }
}

