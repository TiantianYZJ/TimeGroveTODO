Page({
  data: {
    total: 0,
    completed: 0,
    progress: 0,
    categoryStats: [],
    lastUpdated: "",
    locationStats: []
  },

  onShareAppMessage() {
    return {
      title: '时光绿径待办-您的每日任务足迹管家',
      path: '/pages/todo/todo',
      imageUrl: 'https://pic1.imgdb.cn/item/6814180958cb8da5c8d64852.png'
    }
  },

  onShareTimeline() {
    return {
      title: '时光绿径待办-您的每日任务足迹管家',
      path: '/pages/todo/todo',
      imageUrl: 'https://pic1.imgdb.cn/item/6814180958cb8da5c8d64852.png'
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
    const lastDate = new Date();
    // 确保分钟数始终是两位数
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

  // 在现有代码中添加生成分享图片方法
  generateShareImage() {
    const that = this;
    wx.showLoading({ title: '生成中...' });
    
    // 新版 Canvas API
    wx.createSelectorQuery()
    .select('#shareCanvas')
    .fields({ node: true, size: true })
    .exec(async (res) => {
      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      const dpr = wx.getWindowInfo().pixelRatio;
      function drawRoundRect(x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.arcTo(x + width, y, x + width, y + height, radius);
        ctx.arcTo(x + width, y + height, x, y + height, radius);
        ctx.arcTo(x, y + height, x, y, radius);
        ctx.arcTo(x, y, x + width, y, radius);
        ctx.closePath();
      }
        
      canvas.width = 750 * dpr;
      canvas.height = 1000 * dpr;
      ctx.scale(dpr, dpr);

      // 新版 Canvas 绘制逻辑
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 750, 1000);
      
      // 添加渐变背景
      const gradient = ctx.createLinearGradient(0, 0, 750, 0);
      gradient.addColorStop(0, '#f0faf5');
      gradient.addColorStop(1, '#ffffff');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 750, 180);

      // 标题样式优化
      ctx.font = 'bold 36px "PingFang SC"';
      ctx.fillStyle = '#2d3436';
      ctx.fillText('📊 待办统计报告', 50, 100);
      ctx.beginPath();
      ctx.moveTo(50, 120);
      ctx.lineTo(220, 120);
      ctx.strokeStyle = '#00B26A';
      ctx.lineWidth = 3;
      ctx.stroke();

      // 核心指标面板美化
      ctx.beginPath();
      drawRoundRect(40, 140, 670, 100, 16);
      ctx.fillStyle = 'rgba(0,178,106,0.1)';
      ctx.fill();
      
      ctx.font = '28px sans-serif';
      ctx.fillStyle = '#00B26A';
      ctx.fillText('✅ 总待办', 60, 180);
      ctx.fillText('🎯 已完成', 280, 180);
      ctx.fillText('📈 完成率', 500, 180);
      
      ctx.font = 'bold 32px sans-serif';
      ctx.fillStyle = '#2d3436';
      ctx.fillText(this.data.total, 60, 220);
      ctx.fillText(this.data.completed, 280, 220); 
      ctx.fillText(`${this.data.progress}%`, 500, 220);

      // 分类统计美化（添加图标和阴影）
      let yPos = 280;
      ctx.font = 'bold 30px sans-serif';
      ctx.fillStyle = '#2d3436';
      ctx.fillText('📋 分类完成率', 50, yPos);
      yPos += 40;

      this.data.categoryStats.forEach((item, index) => {
        // 带圆角的进度条
        ctx.beginPath();
        drawRoundRect(50, yPos, 650, 30, 15);
        ctx.fillStyle = 'rgba(76,175,80,0.15)';
        ctx.fill();
        
        ctx.beginPath();
        drawRoundRect(50, yPos, 650 * (item.completed / item.total), 30, 15);
        ctx.fillStyle = '#00B26A';
        ctx.fill();
        
        // 文字添加阴影
        ctx.shadowColor = 'rgba(0,0,0,0.1)';
        ctx.shadowBlur = 4;
        ctx.fillStyle = '#ffffff';
        ctx.font = '24px sans-serif';
        ctx.fillText(`${item.completed}/${item.total} (${item.percent})`, 60, yPos + 20);
        ctx.shadowBlur = 0; // 重置阴影
        
        yPos += 50;
      });

      // 位置分布优化（添加图标）
      yPos += 40;
      ctx.font = 'bold 30px sans-serif';
      ctx.fillStyle = '#2d3436';
      ctx.fillText('📍 高频地点', 50, yPos);
      yPos += 40;

      this.data.locationStats.slice(0,5).forEach((item, index) => {
        // 圆形图标
        ctx.beginPath();
        ctx.arc(60, yPos-7, 12, 0, Math.PI * 2);
        ctx.fillStyle = '#00B26A';
        ctx.fill();
        
        ctx.fillStyle = '#666';
        ctx.font = '28px sans-serif';
        ctx.fillText(`${item.name}: ${item.count}次（${(item.count/this.data.locationTotal*100).toFixed(1)}%）`, 80, yPos + 4);
        yPos += 40;
      });

      // 更新时间样式优化
      ctx.fillStyle = '#999';
      ctx.font = 'italic 24px sans-serif';
      ctx.fillText(`⏰ 数据更新于：${this.data.lastUpdated}`, 50, 980);

      // 生成图片
      wx.canvasToTempFilePath({
        canvas,
        success: res => {
          wx.hideLoading();
          wx.shareFileMessage({
            filePath: res.tempFilePath,
            fileName: '待办统计报告.png'
          });
          // 弹出分享菜单
          wx.showShareImageMenu({
            path: res.tempFilePath,
            success: () => {
              wx.shareFileMessage({
                filePath: res.tempFilePath,
                fileName: '待办统计报告.png'
              });
            }
          });
        },
        fail: () => {
          wx.hideLoading();
          wx.showToast({ title: '生成失败', icon: 'none' });
        }
      });
    });
  },
})