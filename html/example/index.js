class Example {
    constructor() {
        this.imgList = [
            'https://gimg2.baidu.com/image_search/src=http%3A%2F%2Fpic.soutu123.cn%2Felement_origin_min_pic%2F16%2F09%2F03%2F1557ca75a671e45.jpg%21%2Ffw%2F700%2Fquality%2F90%2Funsharp%2Ftrue%2Fcompress%2Ftrue&refer=http%3A%2F%2Fpic.soutu123.cn&app=2002&size=f9999,10000&q=a80&n=0&g=0n&fmt=auto?sec=1666150531&t=e2dc364881aa8075857916d93c23bb89',
            'https://gimg2.baidu.com/image_search/src=http%3A%2F%2Fimg.taopic.com%2Fuploads%2Fallimg%2F110903%2F1485-110Z313541624.jpg&refer=http%3A%2F%2Fimg.taopic.com&app=2002&size=f9999,10000&q=a80&n=0&g=0n&fmt=auto?sec=1666150531&t=b68ea68b20ded692510fc6f36d2ffce3',
            'https://gimg2.baidu.com/image_search/src=http%3A%2F%2Fpic1.win4000.com%2Fwallpaper%2F2018-12-07%2F5c09e8f3204ef.jpg&refer=http%3A%2F%2Fpic1.win4000.com&app=2002&size=f9999,10000&q=a80&n=0&g=0n&fmt=auto?sec=1666150531&t=8a112e67569f3fbfff1aebf0a1f8d22a',
            'https://gimg2.baidu.com/image_search/src=http%3A%2F%2Fup.enterdesk.com%2Fedpic_source%2Fb3%2F8b%2F5f%2Fb38b5f15efb334e81a9abb5d805703c9.jpg&refer=http%3A%2F%2Fup.enterdesk.com&app=2002&size=f9999,10000&q=a80&n=0&g=0n&fmt=auto?sec=1666150531&t=f628c77fa61bd8b07a7e54a845e64218',
            'https://img0.baidu.com/it/u=1770675731,2717084640&fm=253&fmt=auto&app=120&f=JPEG?w=1422&h=800',
            'https://gimg2.baidu.com/image_search/src=http%3A%2F%2Fpic1.win4000.com%2Fwallpaper%2F2018-04-26%2F5ae161164f7aa.jpg%3Fdown&refer=http%3A%2F%2Fpic1.win4000.com&app=2002&size=f9999,10000&q=a80&n=0&g=0n&fmt=auto?sec=1666150635&t=289dbf85fd3dd40b9058f58d6b9d6a05',
            'https://gimg2.baidu.com/image_search/src=http%3A%2F%2Fup.enterdesk.com%2Fphoto%2F2009-6-4%2Fenterdesk.com-65F8960EEFCF5AA85517E9758F5401E4.jpg&refer=http%3A%2F%2Fup.enterdesk.com&app=2002&size=f9999,10000&q=a80&n=0&g=0n&fmt=auto?sec=1666150635&t=18a1744188186d15c2a5babd18b9f4e3'
        ]
        this.box = document.getElementById('gameBox')
        this.guidao = document.getElementById('guidao')

    }
    init() {
        this.imgList.forEach((item, index) => {
            let img = document.createElement('img')
            img.classList.add('img-item')
            img.src = item
            img.draggable = true
            this.box.appendChild(img)
            img.ondrag = this.handleDrag
        })
    }
    handleDrag(e){
        console.log(e)
    }
}
const instance = new Example()
instance.init()