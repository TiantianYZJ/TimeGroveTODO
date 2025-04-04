Page({
  data: {
    total: 0,
    completed: 0,
    progress: 0,
    categoryStats: [],
    lastUpdated: null
  },

  onShow() {
    const todos = wx.getStorageSync('todos') || [];
    this.updateStats(todos);
  },

  // 在 updateStats 方法中添加百分比计算
  updateStats(todos) {
    const completed = todos.filter(item => item.completed).length;
    const total = todos.length;
    const progress = total ? Math.min((completed / total * 100), 100).toFixed(0) : 0;
    
    // 分类统计
    const categoryStats = this.calculateCategoryStats(todos).map(item => ({
      ...item,
      percent: (item.completed / item.total * 100).toFixed(0) + '%' // 新增百分比计算
    }));
    
    // 最近更新时间
    const lastUpdated = this.getLastUpdatedTime(todos);

    this.setData({
      total,
      completed,
      progress,
      categoryStats,
      lastUpdated
    });
  },

  calculateCategoryStats(todos) {
    const categoryMap = {};
    todos.forEach(todo => {
      const category = todo.category || '';
      if (!categoryMap[category]) {
        categoryMap[category] = { total: 0, completed: 0 };
      }
      categoryMap[category].total++;
      if (todo.completed) categoryMap[category].completed++;
    });
    return Object.keys(categoryMap).map(category => ({
      category,
      ...categoryMap[category]
    }));
  },

  getLastUpdatedTime(todos) {
    if (!todos.length) return null;
    const sorted = [...todos].sort((a, b) => 
      new Date(b.time) - new Date(a.time)
    );
    const lastDate = new Date(sorted[0].time);
    return `${lastDate.getMonth() + 1}月${lastDate.getDate()}日 ${lastDate.getHours()}:${lastDate.getMinutes().toString().padStart(2, '0')}`;
  }
})