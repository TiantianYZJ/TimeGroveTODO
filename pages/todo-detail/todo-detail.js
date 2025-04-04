Page({
  data: {
    todo: {},
    showCalendar: false,
    defaultDate: null,
    currentIndex: -1, // 新增当前索引
  },

  onLoad(options) {
    const index = options.index
    this.setData({ currentIndex: index }) // 存储当前索引
    const todos = wx.getStorageSync('todos')
    const todo = todos[index]
    
    // 计算剩余天数
    const dueDate = new Date(todo.dueDate)
    const today = new Date()
    const timeDiff = dueDate.getTime() - today.setHours(0,0,0,0)
    const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24))
    
    // 计算时间戳
    const now = Date.now()
    const defaultDate = dueDate.getTime()

    this.setData({ 
      todo,
      daysLeft: daysLeft > 0 ? daysLeft : 0,  // 确保不显示负数
      defaultDate,
      minDate: now,
      maxDate: defaultDate
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
      content: '确定要删除该待办事项吗？',
      success(res) {
        if (res.confirm) {
          const todos = wx.getStorageSync('todos')
          todos.splice(that.data.currentIndex, 1)
          wx.setStorageSync('todos', todos)
          wx.navigateBack()
          wx.showToast({ title: '删除成功' })
        }
      }
    })
  },

  // 新增编辑方法
  editTodo() {
    const todo = this.data.todo
    wx.navigateTo({
      url: `/pages/add-todo/add-todo?edit=1&text=${encodeURIComponent(todo.text)}&dueDate=${todo.dueDate}&remarks=${encodeURIComponent(todo.remarks || '')}&index=${this.data.currentIndex}`
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
    const dueDate = new Date(todo.dueDate)
    const today = new Date()
    const timeDiff = dueDate.getTime() - today.setHours(0,0,0,0)
    const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24))
    
    // 重新计算时间范围
    const now = Date.now()
    const newMaxDate = dueDate.getTime()

    this.setData({
      todo,
      daysLeft: daysLeft > 0 ? daysLeft : 0,
      minDate: now,
      maxDate: newMaxDate
    })
  },
})
