Page({
  data: {
    inputValue: '',
    setDate: '',  // 初始值改为今天
    setTime: '',  // 新增时间字段
    remarks: '',
    location: null, // 新增位置字段
    editing: false,
    editIndex: -1,

    // 添加日历相关数据
    showCalendar: false,
    minDate: new Date(2025, 3, 3).getTime(),
    maxDate: new Date(new Date().getFullYear() + 5, 0, 1).getTime(),
    value: new Date().getTime(), // 初始值为今天
    
    // 复用calendar页的format逻辑
    format(day) {
      const { date } = day;
      const key = `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2,'0')}-${date.getDate().toString().padStart(2,'0')}`;
      const cache = getApp().globalData.calendarCache[key];

      if (cache) {
          day.prefix = `${cache.count}项`;
          day.suffix = cache.sampleText.substring(0,3) + (cache.sampleText.length >3 ? '..' : '');
          day.className = 't-calendar__day--top';
      }
      return day;
    },
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

  onLoad(options) {
    // 新增：设置默认日期为今天
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '-')
    this.setData({ 
      setDate: today,
      setTime: this.data.setTime || '12:00' // 设置默认时间
    })

    if (options.voiceText) {
      this.setData({
        inputValue: decodeURIComponent(options.voiceText),
        isVoiceMode: true // 新增语音模式标识
      });
    }
    
    if (options.edit) { // 编辑模式
      // 新增location解析
      const location = options.location ? JSON.parse(decodeURIComponent(options.location)) : null
      
      this.setData({
        inputValue: decodeURIComponent(options.text),
        setDate: options.setDate, // 改为setDate
        setTime: options.setTime || '12:00', // 新增时间参数
        remarks: decodeURIComponent(options.remarks),
        location, // 新增位置数据
        isEdit: true,
        editIndex: options.index
      })
    }
  },

  // 修改输入处理逻辑
  handleInputChange(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({
      [field]: e.detail.value,
    });
  },

  // 修改备注处理逻辑
  handleRemarksChange(e) {
    this.setData({
      remarks: e.detail.value,
    });
  },

  // 新增日期选择处理
  bindDateChange(e) {
    this.setData({
      setDate: e.detail.value
    })
  },

  // 新增日历交互方法
  showCalendar() {
    wx.showLoading({ title: '加载中...' })
    this.setData({ showCalendar: true });
    wx.hideLoading()
  },

  handleCalendarClose() {
    this.setData({ showCalendar: false });
  },

  handleCalendarConfirm(e) {
    const selectedDate = this.formatDate(new Date(e.detail.value));
    this.setData({
      setDate: selectedDate,
    });
  },
  
  // 保持原有日期格式方法
  formatDate(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 新增时间选择处理
  bindTimeChange(e) {
    this.setData({
      setTime: e.detail.value,
    });
  },


  // 新增备注输入处理
  onRemarksInput(e) {
    this.setData({
      remarks: e.detail.value
    })
  },

  // 新增输入处理
  onInput(e) {
    this.setData({
      inputValue: e.detail.value
    })
  },

  // 新增位置选择方法
  chooseLocation() {
    const that = this
    wx.chooseLocation({
      success(res) {
        that.setData({
          location: {
            name: res.name,
            address: res.address,
            latitude: res.latitude,
            longitude: res.longitude
          },
        });
      }
    })
  },

  // 修改提交方法
  addTodo() {
    const pages = getCurrentPages()
    const prevPage = pages[pages.length - 2]
    const app = getApp()
    
    if (this.data.isEdit) { // 编辑模式
      const todos = wx.getStorageSync('todos')
      todos[this.data.editIndex] = {
        text: this.data.inputValue,
        setDate: this.data.setDate,
        setTime: this.data.setTime, // 新增时间存储
        remarks: this.data.remarks,
        completed: todos[this.data.editIndex].completed, // 保留完成状态
        location: this.data.location // 新增位置保存
      }
      wx.setStorageSync('todos', todos)
      app.updateCalendarCache(todos);
      prevPage.setData({ todos })
      wx.navigateBack()
    } else { 
      const text = this.data.inputValue.trim()
      const setDate = this.data.setDate // 获取当前日期值
      
      if (!text || !setDate || !this.data.setTime) {  // 新增日期校验
        wx.showToast({ 
          title: !text ? '请填写事项内容' : !setDate ? '请选择日期' : '请选择时间', 
          icon: 'none' 
        })
        return
      }
      
      const pages = getCurrentPages()
      const prevPage = pages[pages.length - 2]
      prevPage.addTodoFromChild(
        text, 
        this.data.setDate,
        this.data.setTime,  // 新增时间参数
        this.data.remarks, 
        this.data.location
      )
      wx.navigateBack()
    }
  },
})