//引入插件：微信同声传译
const plugin = requirePlugin('WechatSI');
//获取全局唯一的语音识别管理器recordRecoManager
const manager = plugin.getRecordRecognitionManager();
 
Page({
  data: {
    //语音
    recordState: false, //录音状态
    content:'',//识别的内容
  },
  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    console.log('load');
    //识别语音
    this.initRecord();
  },

  onShow(){
    // 获取录音授权
    this.getRecordAuth()
  },

  // 权限询问
  getRecordAuth: function() {
    wx.getSetting({
      success: (res) => {
        if (!res.authSetting['scope.record']) {
          wx.authorize({
            scope: 'scope.record',
            success() {
                // 用户已经同意小程序使用录音功能，后续调用 wx.startRecord 接口不会弹窗询问
                console.log("succ auth")
            }, fail: () => {
                console.log("fail auth")
                this.userAuthFail('scope.record', '请授权录音服务，用于获取语音识别').then(authRecordRes => {
                  console.log(authRecordRes);
                }).catch(authRecordErr => {
                  console.log(authRecordErr);
                  wx.showToast({
                    title: authRecordErr,
                    icon: 'none',
                    duration: 2000,
                  })
                })
            }
          })
        } else {
          console.log("record has been authed")
        }
      }, fail(res) {
          console.log("fail")
          console.log(res)
      }
    })
  },

    /**
  * 用户拒绝授权
  * @param {string} scope 需授权的权限
  * @param {string} tip 权限对应的提示
  */
  userAuthFail(scope, tip) {
    return new Promise((resolve, reject) => {
      wx.showModal({
        title: '提示',
        content: tip,
        confirmText: '去授权',
        cancelText: '不授权',
        success(res) {
          if (res.confirm) {
            wx.openSetting({
              success: (res) => {
                resolve(res.authSetting[scope])
              }
            })
          }
          if (res.cancel) {
            reject('您拒绝了授权')
          }
        },
      })
    })
  },

  // 手动输入内容
  conInput: function (e) {
    this.setData({
      content:e.detail.value,
    })
  },
  //识别语音 -- 初始化
  initRecord: function () {
    const that = this;
    // 有新的识别内容返回，则会调用此事件
    manager.onRecognize = function (res) {
      console.log(res)
      if (res.result === '') return
      const text = that.data.content + res.result
      that.setData({
        content: text
      })
    }
    // 正常开始录音识别时会调用此事件
    manager.onStart = function (res) {
      console.log("成功开始识别", res)
    }
    // 识别错误事件
    manager.onError = function (res) {
      console.error("error msg", res)
    }
    //识别结束事件
    manager.onStop = function (res) {
      var text = that.data.content + res.result;
      that.setData({
        content: text
      })
    }
  },
  //语音  --按住说话
  touchStart: function (e) {
    console.log('start');
    this.setData({
      recordState: true  //录音状态
    })
    // 语音开始识别
    manager.start({
      lang: 'zh_CN',// 识别的语言
    })
  },
  //语音  --松开结束
  touchEnd: function (e) {
    console.log('end');
    this.setData({
      recordState: false
    })
    // 语音结束识别
    manager.stop();
  },

})