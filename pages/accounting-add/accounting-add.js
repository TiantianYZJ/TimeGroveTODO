Page({
  data: {
    form: {
      type: 'expense',
      amount: '',
      category: '',
      date: new Date().toISOString().split('T')[0],
      account: '现金',
      remark: '',
      cycle: 'none'
    },
    // 分类选项（示例数据）
    categories: [
      { label: '餐饮', value: '餐饮' },
      { label: '交通', value: '交通' },
      { label: '购物', value: '购物' },
      { label: '工资', value: '工资' }
    ],
    // 账户选项
    accounts: ['现金', '微信支付', '支付宝', '银行卡'],
    typeOptions: [
      { label: '支出', value: 'expense' },
      { label: '收入', value: 'income' }
    ]
  },

  // 统一表单处理
  handleFormChange(e) {
    const { field } = e.currentTarget.dataset
    this.setData({
      [`form.${field}`]: e.detail.value
    })
  },

  // 保存记录
  handleSubmit() {
    const { form } = this.data
    if (!this.validateForm()) return
    
    const pages = getCurrentPages()
    const prevPage = pages[pages.length - 2]
    const newRecord = {
      ...form,
      id: Date.now(),
      amount: Number(form.amount),
      createTime: Date.now()
    }
    
    // 更新本地存储
    const records = wx.getStorageSync('accountList') || []
    records.push(newRecord)
    wx.setStorageSync('accountList', records)
    
    // 更新前页数据
    prevPage.loadAccounts()
    prevPage.calculateStats()
    
    wx.showToast({ title: '保存成功' })
    wx.navigateBack()
  },

  // 表单验证
  validateForm() {
    const { amount, category } = this.data.form
    if (!amount || isNaN(amount)) {
      wx.showToast({ title: '请输入有效金额', icon: 'none' })
      return false
    }
    if (!category) {
      wx.showToast({ title: '请选择分类', icon: 'none' })
      return false
    }
    return true
  }
})