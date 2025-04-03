Page({
  data: {
    inputValue: ''
  },

  onInput(e) {
    this.setData({ inputValue: e.detail.value })
  },

  addTodo() {
    const text = this.data.inputValue.trim()
    if (!text) return
    
    const pages = getCurrentPages()
    const prevPage = pages[pages.length - 2]
    prevPage.addTodoFromChild(text)
    
    wx.navigateBack()
  },

  goBack() {
    wx.navigateBack()
  }
})