const app = getApp();

Page({
  data: {
    todo: {},
    showCalendar: false,
    defaultDate: null,
    currentIndex: -1, // 新增当前索引
    shareButton: {
      openType: 'share'
    },
  },

  onShareAppMessage() {
    const currentTodo = this.data.todo;
    const sharePath = `/pages/todo-detail/todo-detail?isShare=1&text=${encodeURIComponent(currentTodo.text)}&setDate=${currentTodo.setDate}&setTime=${currentTodo.setTime || '12:00'}&remarks=${encodeURIComponent(currentTodo.remarks || '')}&location=${encodeURIComponent(JSON.stringify(currentTodo.location))}`;
    return {
      title: '我分享了一项待办：' + currentTodo.text,
      path: sharePath,
      imageUrl: 'https://pic1.imgdb.cn/item/6814180958cb8da5c8d64852.png'
    }
  },

  // 新增添加到待办方法
  addToMyTodos() {
    const newTodo = {
      ...this.data.todo,
      setDate: this.formatDate(new Date()),
      time: new Date().toLocaleString(),
      completed: false
    }
    const todos = [newTodo, ...wx.getStorageSync('todos') || []]
    wx.setStorageSync('todos', todos)
    app.updateCalendarCache(todos);
    wx.showToast({ title: '已添加', icon: 'success' })
    wx.navigateBack()
  },

  onLoad(options) {
    if(options.isShare === '1') {
      console.log(options)

      // 被分享方直接使用传入的参数构建todo对象
      const setDate = new Date(options.setDate);
      const formattedDate = this.formatRichDate(setDate);

      // 修复位置参数解析逻辑
      const locationParam = options.location;  // 添加默认值防止undefined
      let parsedLocation = false;
      try {
        parsedLocation = JSON.parse(decodeURIComponent(locationParam));
      } catch (e) {
        console.error('位置参数解析失败:', e);
      }

      console.log(parsedLocation)
      // 被分享方直接使用传入的参数构建todo对象
      this.setData({
        todo: {
          text: decodeURIComponent(options.text),
          setDate: options.setDate, // 保持原始日期字符串
          setTime: options.setTime || '12:00', // 新增时间参数
          remarks: decodeURIComponent(options.remarks || ''),
          location: parsedLocation
        },
        formattedDate, // 添加格式化后的日期
        isShare: true
      })
    } else {
      // 原有本地访问逻辑
      const index = options.index
      this.setData({ currentIndex: index })
      const todos = wx.getStorageSync('todos') || []
      const todo = todos[index]
      
      const setDate = new Date(todo.setDate)
      const formattedDate = this.formatRichDate(setDate)
  
      this.setData({ 
        todo,
        formattedDate,
        setTime: todo.setTime || '12:00', // 兼容旧数据
        isShare: false
      })
    }
  },

  // 新增日期格式化方法
  formatRichDate(targetDate) {
    // 添加空值校验
    if (!targetDate || !(targetDate instanceof Date)) {
      console.error('无效的日期对象:', targetDate);
      return '日期格式错误';
    }
    
    // 添加默认时间处理
    const time = this.data.todo.setTime || '12:00';

    const today = new Date().setHours(0,0,0,0)
    const targetTime = targetDate.setHours(0,0,0,0)
    const dayDiff = Math.round((targetTime - today) / (1000 * 3600 * 24))
    
    // 周几显示
    const weekDays = ['日', '一', '二', '三', '四', '五', '六']
    const weekDay = weekDays[targetDate.getDay()]
  
    // 相对时间描述
    let relative = ''
    if(dayDiff > 0) {
      relative = `${dayDiff}天后`
    } else if(dayDiff < 0) {
      relative = `${Math.abs(dayDiff)}天前`
    } else {
      relative = '今天'
    }
  
    // 组装最终格式
    return `${this.formatDate(targetDate)} ${time} 周${weekDay}（${relative}）`
  },

  // 保持原有的 formatDate 方法
  formatDate(date) {
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    return `${year}-${month}-${day}`
  },

  // 在 onShow 中更新日期
  onShow() {
    const todos = wx.getStorageSync('todos')
    if (!todos[this.data.currentIndex]) {
      wx.navigateBack()
      return
    }
  
    const todo = todos[this.data.currentIndex]
    const setDate = new Date(todo.setDate)
    
    this.setData({
      todo,
      formattedDate: this.formatRichDate(setDate) // 每次显示都更新
    })
  },

  showCalendar() {
    this.setData({ showCalendar: true })
  },

  onCloseCalendar() {
    this.setData({ showCalendar: false })
  },

  // 新增删除方法
  deleteTodo() {
    const that = this
    wx.showModal({
      title: '删除确认',
      content: '该操作不可撤销，确定继续吗？',
      confirmText: '删除',
      confirmColor: '#ff4d4f',
      success(res) {
        if (res.confirm) {
          const todos = wx.getStorageSync('todos')
          todos.splice(that.data.currentIndex, 1)
          wx.setStorageSync('todos', todos)
          app.updateCalendarCache(todos);
          wx.navigateBack()
          wx.showToast({ title: '删除成功' })
        }
      }
    })
  },

  // 新增编辑方法
  editTodo() {
    const todo = this.data.todo  // 新增这行获取当前待办数据
    wx.navigateTo({
      url: `/pages/add-todo/add-todo?edit=1&text=${encodeURIComponent(todo.text)}&setDate=${todo.setDate}&setTime=${todo.setTime || '12:00'}&remarks=${encodeURIComponent(todo.remarks || '')}&index=${this.data.currentIndex}&location=${encodeURIComponent(JSON.stringify(todo.location))}`
    })
  },
  
  // 在原有代码基础上添加
  onShow() {
    const todos = wx.getStorageSync('todos')
    
    // 处理可能被删除的情况
    if (!todos[this.data.currentIndex]) {
      wx.navigateBack()
      return
    }

    const todo = todos[this.data.currentIndex]
    const setDate = new Date(todo.setDate)
    const today = new Date()
    const timeDiff = setDate.getTime() - today.setHours(0,0,0,0)

    this.setData({
      todo,
      setDate: todo.setDate,
      formattedDate: this.formatRichDate(setDate) // 每次显示都更新
    })
  },

  navigateToLocation() {
    const { latitude, longitude, name } = this.data.todo.location
    wx.openLocation({
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      name: name || '目标位置',
      scale: 18
    })
  },

  copyTitle() {
    wx.setClipboardData({
      data: this.data.todo.text,
      success: () => wx.showToast({ title: '标题已复制' })
    })
  },

  copyDate() {
    // 从原始数据获取标准日期格式
    const stdDate = this.formatDate(new Date(this.data.todo.setDate)) +' '+ this.data.todo.setTime
    wx.setClipboardData({
      data: stdDate,
      success: () => wx.showToast({ title: '时间已复制' })
    })
  },
  
  copyRemarks() {
    wx.setClipboardData({
      data: this.data.todo.remarks || '',
      success: () => wx.showToast({ title: '备注已复制' })
    })
  },

  copyLocation() {
    wx.setClipboardData({
      data: this.data.todo.location.name,
      success: () => wx.showToast({ title: '位置名称已复制' })
    })
  },
})
