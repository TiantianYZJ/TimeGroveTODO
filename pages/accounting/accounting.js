Page({
  data: {
    accountList: [],
    categories: ['餐饮', '交通', '购物', '工资'],
    filterType: 'all', // 新增筛选类型
    sortOrder: 'desc'  // 新增排序方式
  },

  onShow() {
    this.loadAccounts();
    this.calculateStats();
  },

  // 从存储加载数据
  // 在Page()内补充以下方法
  
  // 预算设置跳转
  navToBudget() {
    wx.navigateTo({ url: '/pages/accounting-budget/accounting-budget' })
  },
  
  // 分类点击事件（补充在快速入口的grid-item）
  handleCategoryTap(e) {
    const category = e.currentTarget.dataset.item
    this.setData({ 
      filterType: 'custom',
      filteredCategory: category
    }, () => {
      this.loadAccounts()
    })
  },
  
  // 修改原handleFilter方法
  handleFilter(e) {
    const type = e.detail.value // 修正获取方式
    this.setData({ filterType: type }, () => {
      this.loadAccounts()
    })
  },
  
  // 修改原loadAccounts方法
  loadAccounts() {
    let accounts = wx.getStorageSync('accountList') || []
    
    // 添加筛选逻辑
    if (this.data.filterType === 'income') {
      accounts = accounts.filter(item => item.type === 'income')
    } else if (this.data.filterType === 'expense') {
      accounts = accounts.filter(item => item.type === 'expense')
    } else if (this.data.filterType === 'custom') {
      accounts = accounts.filter(item => 
        item.category === this.data.filteredCategory
      )
    }
  
    this.setData({ accountList: this.sortAccounts(accounts) })
  },

  // 新增统计计算逻辑
  calculateStats() {
    const { accountList } = this.data;
    let totalIncome = 0, totalExpense = 0;
    
    accountList.forEach(item => {
      if (item.type === 'income') totalIncome += item.amount;
      else totalExpense += item.amount;
    });

    this.setData({
      totalIncome,
      totalExpense,
      remainingBudget: 2000 - totalExpense // 示例预算值
    });
  },

  // 新增排序逻辑
  sortAccounts(accounts) {
    return accounts.sort((a, b) => 
      this.data.sortOrder === 'desc' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)
    );
  },

  // 新增排序切换
  handleFilter(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ filterType: type }, () => {
      this.loadAccounts();
    });
  },

  // 新增排序切换
  toggleSort() {
    this.setData({ 
      sortOrder: this.data.sortOrder === 'asc' ? 'desc' : 'asc' 
    }, () => {
      this.loadAccounts();
    });
  },

  navToAdd() {
    wx.navigateTo({ url: '/pages/accounting-add/accounting-add' })
  },

  // 滑动删除处理
  handleDelete(e) {
    const index = e.currentTarget.dataset.index
    this.data.accountList.splice(index, 1)
    this.setData({ accountList: this.data.accountList })
  }
});