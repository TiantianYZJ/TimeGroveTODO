Page({
  data: {
    exportData: "",
    importData: "",
    qrcodePath: "",
    isShare: 0,
  },

  formatDate(date) {
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    return `${year}-${month}-${day}`
  },

  onShareAppMessage() {
    const dateStr = this.formatDate(new Date())
    return {
      title: `${dateStr} 待办数据导出`,
      path: `/pages/datamanage/datamanage?isShare=1&data=${encodeURIComponent(this.data.exportData)}`,
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

  onLoad(options) {
    if (options.isShare === '1') {
      wx.setNavigationBarTitle({
        title: `待办数据备份`
      })
      this.setData({
        importData: decodeURIComponent(options.data || ''),
        isShare: options.isShare,
      })
    }
  },

  // 生成导出数据
  generateExport() {
    const todos = wx.getStorageSync('todos') || []
    // 字段顺序：[text, setDate, completed, remarks, location]
    const compressed = todos.map(t => [
      t.text,
      t.setDate,
      t.completed,
      t.remarks || null,  // 空备注不存储
      t.location || null  // 空位置不存储
    ])
    this.setData({
      exportData: JSON.stringify(compressed)
    })
  },

  // 新增复制方法
  copyData() {
    wx.setClipboardData({
      data: this.data.exportData,
      success: () => wx.showToast({ title: '已复制' })
    })
  },

  // 导入数据
  handleImport(e) {
    if (!this.data.importData) {
      wx.showToast({ title: '请输入数据', icon: 'none' });
      return;
    }
    const mode = e.currentTarget.dataset.mode;
    const app = getApp();
    
    // 新增二次确认
    wx.showModal({
      title: '操作确认',
      content: `确定要${mode === 'overwrite' ? '覆盖' : '合并'}数据吗？该操作不可撤销`,
      confirmText: '确定',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          try {
            const compressedData = JSON.parse(this.data.importData)
            // 数组转对象逻辑
            const newData = compressedData.map(arr => ({
              text: arr[0] || '',
              setDate: arr[1],
              completed: !!arr[2],
              remarks: arr[3] || '',
              location: arr[4] || null,
              time: new Date().toLocaleString()
            }))
            
            const oldData = wx.getStorageSync('todos') || []
            
            const finalData = mode === 'overwrite' ? 
              newData : 
              [...oldData, ...newData.filter(item => 
                !oldData.some(old => old.text === item.text && old.date === item.date)
              )];

            wx.setStorageSync('todos', finalData);
            app.updateCalendarCache(finalData);
            wx.showToast({ title: `已${mode === 'overwrite' ? '覆盖' : '合并'}${newData.length}条` });
          } catch (e) {
            wx.showToast({ title: '数据格式错误', icon: 'error' });
          }
        }
      }
    })
  },

  // 扫描二维码
  scanQRCode() {
    wx.scanCode({
      success: (res) => {
        this.setData({ importData: res.result })
      }
    })
  },

  // 新增输入处理方法
  handleInput(e) {
    this.setData({
      importData: e.detail.value
    })
  },
})
