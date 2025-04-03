Page({
  data: {
    inputValue: '',
    todos: []
  },

  onLoad() {
    // 加载本地存储的待办事项
    const todos = wx.getStorageSync('todos') || []
    this.setData({ todos })
  },

  onInput(e) {
    this.setData({ inputValue: e.detail.value })
  },

  // 在Page对象中添加
  navigateToAdd() {
    wx.navigateTo({
      url: '/pages/add-todo/add-todo'
    })
  },
  
  // 修改原addTodo方法为
  addTodoFromChild(text) {
    const newTodo = {
      text,
      completed: false,
      time: new Date().toLocaleString()
    }
  
    const todos = [newTodo, ...this.data.todos]
    this.setData({ todos })
    wx.setStorageSync('todos', todos)
    wx.showToast({ title: '已添加', icon: 'success' })
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
    const todos = this.data.todos.filter((_, i) => i !== index)
    
    this.setData({ todos })
    wx.setStorageSync('todos', todos)
    wx.showToast({ title: '已删除', icon: 'success' })
  }
})