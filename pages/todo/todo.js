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
    const todos = wx.getStorageSync('todos');
    
    // 新增首次使用判断
    if (!todos || todos.length === 0) {
      this.initDefaultTodos();
    } else {
      this.setData({ todos });
    }

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

    // 强制刷新天气数据
    this.loadWeather();
  },

  // 新增初始化默认数据方法
  initDefaultTodos() {
    const defaultTodos = [
      {
        text: '欢迎使用时光绿径待办！',
        setDate: new Date().toISOString().split('T')[0],
        setTime: '12:00',
        remarks: '您的每日任务足迹管家',
        completed: false,
        time: new Date().toLocaleString()
      },
      {
        text: '点击右下角“+”按钮',
        setDate: new Date().toISOString().split('T')[0],
        setTime: '12:00',
        remarks: '创建你的第一个待办',
        completed: false,
        time: new Date().toLocaleString()
      },
      {
        text: '试试语音快速创建待办',
        setDate: new Date().toISOString().split('T')[0],
        setTime: '12:00',
        remarks: '按下底部麦克风按钮后说话，松手结束',
        completed: false,
        time: new Date().toLocaleString()
      },
      {
        text: '点击︎待办卡片可查看待办详情',
        setDate: new Date().toISOString().split('T')[0],
        setTime: '12:00',
        remarks: `◆ 高效管理，一步到位
✅ 待办事项支持多种附加信息，支持一键地点导航（医院/写字楼/社区一键直达）
✅ 可视化数据看板，待办完成情况进度条+地理位置图，数据看得见
 
◆ 匠心设计，持续进化
✅ 清爽绿意界面，缓解事务焦虑
✅ 每周迭代升级，已更新数十项实用功能（位置显示/长按复制/数据分析等）

◆数据安全，保驾护航
✅ 数据本地储存不上云，有效防止数据泄露
✅ 数据随时导出分享，可转发分享好友
✅ 数据支持一键恢复，重要事务永不遗漏`,
        completed: false,
        time: new Date().toLocaleString()
      },
      {
        text: '点击右侧方框即可完成待办',
        setDate: new Date().toISOString().split('T')[0],
        setTime: '12:00',
        remarks: '再次点击取消完成',
        completed: false,
        time: new Date().toLocaleString()
      },
      {
        text: '←——————按住后滑动︎●',
        setDate: new Date().toISOString().split('T')[0],
        setTime: '12:00',
        remarks: '可快速编辑、删除待办',
        completed: false,
        time: new Date().toLocaleString()
      },
    ];

    this.setData({ todos: defaultTodos });
    wx.setStorageSync('todos', defaultTodos);
    getApp().updateCalendarCache(defaultTodos);
  },

  onShow() {
    const todos = wx.getStorageSync('todos') || []
    this.setData({ 
      todos,
      isLoading: true  // 确保初始状态为加载中
    });
    
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
    
    // 新增获取位置权限判断
    wx.getLocation({
      type: 'wgs84',
      success: (locationRes) => {
        // 成功获取经纬度后发起请求
        wx.request({
          url: 'https://api.seniverse.com/v3/weather/now.json',
          data: {
            key: weatherKey,
            // 使用获取到的经纬度
            location: `${locationRes.latitude}:${locationRes.longitude}`,
            language: 'zh-Hans',
            unit: 'c'
          },
          success(res) {
            if (res.data.results?.[0]?.now) {
              const weatherData = res.data.results[0];
              
              // 新增日期格式化
              const rawDate = weatherData.last_update;
              const dateObj = new Date(rawDate);
              const formattedDate = `${dateObj.getFullYear()}年${ 
                (dateObj.getMonth() + 1).toString().padStart(2, '0')}月${
                dateObj.getDate().toString().padStart(2, '0')}日 ${
                dateObj.getHours().toString().padStart(2, '0')}:${
                dateObj.getMinutes().toString().padStart(2, '0')}`;
    
              // 同时更新全局和本地数据
              getApp().globalData.weather = {
                city: weatherData.location.name,
                code: weatherData.now.code,
                text: weatherData.now.text,
                temperature: weatherData.now.temperature,
                last_update: formattedDate  // 使用格式化后的日期
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
      fail: (err) => {
        console.error('位置获取失败，使用IP定位', err);
        // 失败时回退到IP定位
        wx.request({
          url: 'https://api.seniverse.com/v3/weather/now.json',
          data: {
            key: weatherKey,
            location: 'ip', // 保留原有IP定位作为备用方案
            language: 'zh-Hans',
            unit: 'c'
          },
          success(res) {
            if (res.data.results?.[0]?.now) {
              const weatherData = res.data.results[0];
              
              // 新增日期格式化
              const rawDate = weatherData.last_update;
              const dateObj = new Date(rawDate);
              const formattedDate = `${dateObj.getFullYear()}年${ 
                (dateObj.getMonth() + 1).toString().padStart(2, '0')}月${
                dateObj.getDate().toString().padStart(2, '0')}日 ${
                dateObj.getHours().toString().padStart(2, '0')}:${
                dateObj.getMinutes().toString().padStart(2, '0')}`;
    
              // 同时更新全局和本地数据
              getApp().globalData.weather = {
                city: weatherData.location.name,
                code: weatherData.now.code,
                text: weatherData.now.text,
                temperature: weatherData.now.temperature,
                last_update: formattedDate  // 使用格式化后的日期
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
      }
    });
  },

  showWeather() {
    wx.showModal({
      title: '实时天气信息',
      content: `所在城市：${this.data.weather?.city || '未知'}
天气：${this.data.weather?.text || '未知'}
温度：${this.data.weather?.temperature || '未知'}℃
最后更新时间：${this.data.weather?.last_update || '未知'}

由心知天气提供气象数据`,
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
  addTodoFromChild(text, setDate, setTime, remarks, location) {
    const newTodo = {
      text,
      setDate,
      setTime,  // 新增时间字段
      remarks,
      location,
      completed: false,
      time: new Date().toLocaleString()
    }
    
    const todos = [newTodo, ...this.data.todos]
    this.setData({ todos })
    wx.setStorageSync('todos', todos)
    getApp().updateCalendarCache(todos)
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
          content: `未能识别到有效内容。可能是您在上一轮识别为完成时开启了第二轮识别。
若不是以上情况，请尝试：
1. 长按麦克风按钮保持1秒以上；
2. 在安静环境下清晰说出待办内容；
4. 确认手机麦克风权限已开启。

您也可以直接使用文字输入创建待办`,
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
        content: `未能识别到有效内容。可能是您在上一轮识别为完成时开启了第二轮识别。
若不是以上情况，请尝试：
1. 长按麦克风按钮保持1秒以上；
2. 在安静环境下清晰说出待办内容；
4. 确认手机麦克风权限已开启。

您也可以直接使用文字输入创建待办`,
        success(res) {
          if (res.confirm) {
            that.getRecordAuth() // 重新获取授权
          }
        }
      })
    }
    //识别结束事件
    manager.onStop = function (res) {
      var text = res.result;
  
      // 新增末尾标点过滤
      if (text && text.length > 0) {
        const lastChar = text[text.length - 1]
        if (['。', '.', '，', ','].includes(lastChar)) {
          text = text.slice(0, -1)
        }
      }

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
      title: '正在识别...'
    });
  },
})
