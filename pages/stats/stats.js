Page({
  data: {
    total: 0,
    completed: 0,
    progress: 0,
    categoryStats: [],
    lastUpdated: null,
    locationStats: []
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

  onShow() {
    const todos = wx.getStorageSync('todos') || [];
    this.updateStats(todos);
  },

  // 在 updateStats 方法中添加百分比计算
  // 在updateStats方法中添加位置统计
  updateStats(todos) {
    const completed = todos.filter(item => item.completed).length;
    const total = todos.length;
    const progress = total ? Math.min((completed / total * 100), 100).toFixed(0) : 0;
    const { markers, points, center } = this.analyzeMapMarkers(todos);
    
    // 分类统计
    const categoryStats = this.calculateCategoryStats(todos).map(item => ({
      ...item,
      percent: (item.completed / item.total * 100).toFixed(0) + '%' // 新增百分比计算
    }));
    
    // 最近更新时间
    const lastUpdated = this.getLastUpdatedTime(todos);

    // 新增位置统计
    const locationStats = this.analyzeLocations(todos);
    const locationTotal = locationStats.reduce((sum, item) => sum + item.count, 0);

    this.setData({
      total,
      completed,
      progress,
      categoryStats,
      lastUpdated,
      locationStats,
      locationTotal,  // 新增总次数字段
      locationMarkers: markers,
      locationPoints: points,
      mapCenter: center
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
  },
  
  // 新增分析方法
  analyzeLocations(todos) {
    const locations = todos
      .filter(t => t.location)
      .map(t => t.location.name)
      .filter(Boolean);
      
    return Object.entries(
      locations.reduce((acc, name) => {
        acc[name] = (acc[name] || 0) + 1;
        return acc;
      }, {})
    ).map(([name, count]) => ({ name, count }));
  },

  // 新增地图标记分析方法
  // 修改analyzeMapMarkers方法
  analyzeMapMarkers(todos) {
    const locations = todos
      .filter(t => t.location?.latitude && t.location?.longitude)
      .map(t => t.location);
  
    // 计算几何中心
    let center = { latitude: 39.90403, longitude: 116.407526 }; // 默认北京
    if (locations.length > 0) {
      const sum = locations.reduce((acc, cur) => ({
        lat: acc.lat + cur.latitude,
        lng: acc.lng + cur.longitude
      }), { lat: 0, lng: 0 });
      
      center = {
        latitude: sum.lat / locations.length,
        longitude: sum.lng / locations.length
      };
    }
  
    // 生成标记点
    const markers = locations.map((loc, index) => ({
      id: index,
      latitude: loc.latitude,
      longitude: loc.longitude,
      title: loc.name,
      iconPath: '/images/marker.png',
      width: 30,
      height: 30
    }));
  
    return { 
      markers,
      points: locations, // 直接使用原始坐标数组
      center 
    };
  },

  generateShareImage() {
    wx.showToast({ title: '正在开发，敬请期待', icon: 'none' })
    return

    wx.showLoading({ title: '生成截图中...', mask: true })
    
    // 获取设备信息
    const { pixelRatio } = wx.getWindowInfo()
    
    // 创建截图查询
    const query = wx.createSelectorQuery()
    query.selectAll('.capture-area').boundingClientRect()
    
    query.exec(async (res) => {
      const containers = res[0]
      if (!containers || containers.length === 0) {
        wx.showToast({ title: '截图区域获取失败', icon: 'error' })
        return
      }

      try {
        // 创建临时canvas
        const ctx = wx.createCanvasContext('shareCanvas')
        
        // 遍历所有截图区域
        let totalHeight = 0
        const canvasWidth = 750 // 小程序标准宽度
        
        // 预绘制背景
        ctx.setFillStyle('#ffffff')
        ctx.fillRect(0, 0, canvasWidth, 3000) // 预填充足够高度
        
        // 绘制每个卡片区域
        for (const container of containers) {
          const { tempFilePath } = await wx.canvasToTempFilePath({
            x: container.left,
            y: container.top,
            width: container.width,
            height: container.height,
            destWidth: container.width * pixelRatio,
            destHeight: container.height * pixelRatio
          })
          
          ctx.drawImage(tempFilePath, 0, totalHeight, canvasWidth, container.height)
          totalHeight += container.height + 20 // 添加间隔
        }

        // 生成最终图片
        ctx.draw(true, async () => {
          const { tempFilePath } = await wx.canvasToTempFilePath({
            canvasId: 'shareCanvas',
            destWidth: canvasWidth,
            destHeight: totalHeight
          })

          wx.hideLoading()
          wx.shareFileMessage({
            filePath: tempFilePath,
            fileName: '统计报告.png'
          })
        })
      } catch (e) {
        wx.hideLoading()
        console.error('截图失败:', e)
        wx.showToast({ 
          title: '生成失败: ' + (e.errMsg || '未知错误'),
          icon: 'none',
          duration: 3000
        })
      }
    })
  },
})