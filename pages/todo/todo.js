const app = getApp();
const weatherKey = 'SdnJZGqS_c7zVlCnj';

//引入插件：微信同声传译
const plugin = requirePlugin('WechatSI');
//获取全局唯一的语音识别管理器recordRecoManager
const manager = plugin.getRecordRecognitionManager();

Page({
  data: {
    inputValue: '',
    todos: [],
    

    latestNoticeTitle: "",  // 最新公告标题
    latestNoticeContent: "", // 最新公告内容
    navigatorProps: {
      url: '/pages/more/more',
    },

    //语音
    recordState: false, //录音状态
    content:'',//识别的内容
  },

  onShareAppMessage() {
    return {
      title: '时光绿径待办-您的每日任务足迹管家',
      path: '/pages/todo/todo',
      imageUrl: 'https://pic1.imgdb.cn/item/6814180958cb8da5c8d64852.png'
    }
  },

  onShareTimeline() {
    return {
      title: '时光绿径待办-您的每日任务足迹管家',
      path: '/pages/todo/todo',
      imageUrl: 'https://pic1.imgdb.cn/item/6814180958cb8da5c8d64852.png'
    }
  },

  // 页面加载时获取最新公告
  onLoad() {
    //识别语音
    this.initRecord();
    const notices = app.globalData.notices || [];
    if (notices.length > 0) {
      this.setData({
        latestNoticeTitle: notices[0].title+" ",
        latestNoticeContent: notices[0].content,
        weather: getApp().globalData.weather 
      });
    }
  },

  onShow() {
    const todos = wx.getStorageSync('todos') || []
    this.setData({ 
      todos,
      isLoading: true  // 确保初始状态为加载中
    });
  
    // 强制刷新天气数据
    this.loadWeather();
    
    // 获取录音授权
    this.getRecordAuth()
  },

  // 显示最新公告弹窗
  showLatestNotice() {
    wx.showModal({
      title: this.data.latestNoticeTitle,
      content: this.data.latestNoticeContent.replace(/\n/g, '\n'),
      showCancel: false,
      confirmText: "知道了"
    });
  },

  navigateToNotice() {
    wx.navigateTo({
      url: '/pages/notice/notice'
    });
  },

  // 新增本地天气请求方法
  loadWeather() {
    const that = this;
    wx.request({
      url: 'https://api.seniverse.com/v3/weather/now.json',
      data: {
        key: weatherKey,
        location: 'ip',
        language: 'zh-Hans',
        unit: 'c'
      },
      success(res) {
        if (res.data.results?.[0]?.now) {
          const weatherData = res.data.results[0];
          // 同时更新全局和本地数据
          getApp().globalData.weather = {
            city: weatherData.location.name,
            code: weatherData.now.code,
            text: weatherData.now.text,
            temperature: weatherData.now.temperature,
            last_update: weatherData.last_update
          };
          that.setData({ 
            weather: getApp().globalData.weather,
            isLoading: false
          });
        }
      },
      fail() {
        that.setData({ isLoading: false });
        wx.showToast({ title: '天气获取失败', icon: 'none' });
      }
    });
  },

  showWeather() {
    wx.showModal({
      title: '实时天气信息',
      content: `城市：${this.data.weather?.city || '未知'}
天气：${this.data.weather?.text || '未知'}
温度：${this.data.weather?.temperature || '未知'}℃
最后更新时间：${this.data.weather?.last_update || '未知'}

注：天气信息来自心知天气`,
      showCancel: false,
      confirmText: "知道了"
    }) 
  },

  onInput(e) {
    this.setData({ inputValue: e.detail.value })
  },

  // 跳转到待办详情
  navigateToDetail(e) {
    const index = e.currentTarget.dataset.index
    wx.navigateTo({
      url: `/pages/todo-detail/todo-detail?index=${index}`
    })
  },

  navigateToAdd() {
    wx.navigateTo({
      url: '/pages/add-todo/add-todo'
    })
  },
  
  toggleTodo(e) {
    const index = e.currentTarget.dataset.index
    const todos = this.data.todos.map((item, i) => 
      i === index ? {...item, completed: !item.completed} : item
    )
    
    this.setData({ todos })
    wx.setStorageSync('todos', todos)
  },

  deleteTodo(index) { // 改为直接接收index参数
    const that = this
    wx.showModal({
      title: '删除确认',
      content: '该操作不可撤销，确定继续吗？',
      confirmText: '删除',
      confirmColor: '#ff4d4f',
      success(res) {
        if (res.confirm) {
          that.setData({
            [`todos[${index}]._animate`]: 'remove-animation'
          }, () => {
            setTimeout(() => {
              const todos = that.data.todos.filter((_, i) => i !== index)
              that.setData({ todos })
              wx.setStorageSync('todos', todos)
              getApp().updateCalendarCache(todos);
            }, 300)
          })
        }
      }
    })
  },

  // 修改滑动操作处理逻辑
  handleSwipeAction(e) {
    const index = parseInt(e.currentTarget.dataset.index) // 确保转换为数字
    const todo = this.data.todos[index]
    
    if (!todo) return
    
    const actionType = e.currentTarget.dataset.type
    switch(actionType) {
      case 'delete':
        this.deleteTodo(index);
        break;
      case 'edit':
        this.editTodo(index);
        break;
    }
  },

  // 新增统一编辑方法
  editTodo(index) {
    const todo = this.data.todos[index];
    wx.navigateTo({
      url: `/pages/add-todo/add-todo?edit=1&index=${index}&text=${encodeURIComponent(todo.text)}&setDate=${todo.setDate}&remarks=${encodeURIComponent(todo.remarks || '')}&location=${encodeURIComponent(JSON.stringify(todo.location))}`
    });
  },

  // 新增日期格式化方法（在 Page 对象中）
  formatDate(date) {
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    return `${year}-${month}-${day}`
  },

  // 修改新增待办方法
  addTodoFromChild(text, date, remarks, location) {
    const newTodo = {
      text,
      setDate: date, // 强制使用当天日期
      remarks,
      completed: false,
      time: new Date().toLocaleString(),
      location // 新增位置字段
    }
    const todos = [newTodo, ...this.data.todos]
    this.setData({ todos })
    wx.setStorageSync('todos', todos)
    getApp().updateCalendarCache(todos);
    wx.showToast({ title: '已添加', icon: 'success' })
  },

  showClearConfirm() {
    wx.showModal({
      title: '清空确认',
      content: '这将永久删除所有待办事项，确定继续吗？',
      confirmText: '彻底清空',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          this.showFinalConfirm();
        }
      }
    });
  },

  showFinalConfirm() {
    wx.showModal({
      title: '最后一次确认',
      content: '此操作不可恢复！请再次确认',
      confirmText: '我确定',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          this.clearAllTodos();
        }
      }
    });
  },

  clearAllTodos() {
    this.setData({ todos: [] });
    wx.setStorageSync('todos', []);
    app.updateCalendarCache([]);
    wx.showToast({
      title: '已清空',
      icon: 'success',
      duration: 2000
    });
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
      const text = res.result
      that.setData({
        content: text
      })
      
      if (text === '') {
        wx.showModal({
          title: '语音识别未成功',
          content: `未能识别到有效内容，请尝试：
      
1. 长按麦克风按钮保持1秒以上；
2. 在安静环境下清晰说出待办内容；
3. 避免使用专业术语或生僻词汇；
4. 确认手机麦克风权限已开启。

也可以直接使用文字输入创建待办`,
          confirmText: '知道了',
          showCancel: false
        })
      }
    }
    // 正常开始录音识别时会调用此事件
    manager.onStart = function (res) {
      console.log("成功开始识别", res)
    }
    // 识别错误事件
    manager.onError = function (res) {
      wx.hideLoading();
      console.error("error msg", res)
      wx.showModal({
        title: '识别服务异常',
        content: `语音识别暂时不可用，可能因为：
        
1. 没有识别到文字；
2. 网络连接不稳定；
3. 识别服务超载；
4. 在上一轮识别未完成的情况下开启了第二轮识别。

建议检查网络后重试，或使用文字输入`,
        success(res) {
          if (res.confirm) {
            that.getRecordAuth() // 重新获取授权
          }
        }
      })
    }
    //识别结束事件
    manager.onStop = function (res) {
      const text = res.result;
      that.setData({ content: text });
      wx.hideLoading();

      if (text) {
        // 自动跳转添加页面
        wx.navigateTo({
          url: `/pages/add-todo/add-todo?voiceText=${encodeURIComponent(text)}`
        });
      }
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
    wx.showToast({
      icon: 'none',
      title: '识别已开始，松手结束录音',
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

    wx.showLoading({
      title: '正在解析...'
    });
  },
})
