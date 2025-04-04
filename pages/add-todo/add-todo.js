Page({
  data: {
    inputValue: '',
    dueDate: '',  // 初始值改为今天
    remarks: '',
    startDate: '2023-01-01',
    endDate: '2030-12-31'
  },

  onLoad(options) {
    // 新增：设置默认日期为今天
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '-')
    this.setData({ dueDate: today })
    
    if (options.edit) { // 编辑模式
      this.setData({
        inputValue: decodeURIComponent(options.text),
        dueDate: options.dueDate,
        remarks: decodeURIComponent(options.remarks),
        isEdit: true,
        editIndex: options.index
      })
    }
  },

  // 新增日期选择处理
  bindDateChange(e) {
    this.setData({
      dueDate: e.detail.value
    })
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

  // 修改提交方法
  addTodo() {
    const pages = getCurrentPages()
    const prevPage = pages[pages.length - 2]
    
    if (this.data.isEdit) { // 编辑模式
      const todos = wx.getStorageSync('todos')
      todos[this.data.editIndex] = {
        text: this.data.inputValue,
        dueDate: this.data.dueDate,
        remarks: this.data.remarks,
        completed: todos[this.data.editIndex].completed // 保留完成状态
      }
      wx.setStorageSync('todos', todos)
      prevPage.setData({ todos })
      wx.navigateBack()
    } else { 
      const text = this.data.inputValue.trim()
      const dueDate = this.data.dueDate // 获取当前日期值
      
      if (!text || !dueDate) {  // 新增日期校验
        wx.showToast({ 
          title: !text ? '请填写事项内容' : '请选择截止日期', 
          icon: 'none' 
        })
        return
      }
      
      const pages = getCurrentPages()
      const prevPage = pages[pages.length - 2]
      prevPage.addTodoFromChild(text, this.data.dueDate, this.data.remarks)
      wx.navigateBack()
    }
  },
  
  goBack() {
    wx.navigateBack()
  }
})