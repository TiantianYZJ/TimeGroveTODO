const app = getApp();

Page({
  data: {
    inputValue: '',
    todos: [],
    

    latestNoticeTitle: "",  // 最新公告标题
    latestNoticeContent: "", // 最新公告内容
    navigatorProps: {
      url: '/pages/more/more',
    },
  },

  onShareAppMessage() {
    return {
      title: '时光绿径待办-您的每日任务足迹管家',
      path: '/pages/todo/todo',
      imageUrl: '/images/sharelogo.jpg'
    }
  },

  onShareTimeline() {
    return {
      title: '时光绿径待办-您的每日任务足迹管家',
      path: '/pages/todo/todo',
      imageUrl: '/images/sharelogo.jpg'
    }
  },

  // 页面加载时获取最新公告
  onLoad() {
    const notices = app.globalData.notices || [];
    if (notices.length > 0) {
      this.setData({
        latestNoticeTitle: notices[0].title+" ",
        latestNoticeContent: notices[0].content
      });
    }
  },

  onShow() {
    const todos = wx.getStorageSync('todos') || []
    this.setData({ todos })
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
})
