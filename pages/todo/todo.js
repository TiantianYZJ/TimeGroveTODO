Page({
  data: {
    inputValue: '',
    todos: [],
  },

  onShow() {
    const todos = wx.getStorageSync('todos') || []
    this.setData({ todos })
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

  deleteTodo(e) {
    const index = e.currentTarget.dataset.index
    const that = this
    
    wx.showModal({
      title: '删除确认',
      content: '该操作不可撤销，确定继续吗？',
      confirmText: '删除',
      confirmColor: '#ff4d4f',
      success(res) {
        if (res.confirm) {
          // 添加删除动画
          that.setData({
            [`todos[${index}]._animate`]: 'remove-animation'
          }, () => {
            setTimeout(() => {
              // 删除后立即刷新
              const todos = that.data.todos.filter((_, i) => i !== index)
              that.setData({ todos })
              wx.setStorageSync('todos', todos)
              
              // 添加页面强制刷新
              const pages = getCurrentPages()
              if(pages.length > 1) {
                const prevPage = pages[pages.length - 2]
                prevPage.onShow()
              }
            }, 300)
          })
        }
      }
    })
  },
  // 新增日期格式化方法（在 Page 对象中）
  formatDate(date) {
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    return `${year}-${month}-${day}`
  },

  // 修改新增待办方法
  addTodoFromChild(text, dueDate, remarks) {  // 修正参数名为 dueDate
    const newTodo = {
      text,
      dueDate: dueDate || this.formatDate(new Date()),  // 保持字段名为 dueDate
      remarks,  // 保持字段名为 remarks
      completed: false,
      time: new Date().toLocaleString()
    }
    this.setData({
      todos: [newTodo, ...this.data.todos]
    }, () => {
      setTimeout(() => {
        const todos = this.data.todos.map(item => ({...item, _animate: ''}))
        this.setData({ todos })
      }, 300)
    })
    wx.setStorageSync('todos', this.data.todos)
  }
})
