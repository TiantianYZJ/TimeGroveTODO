Page({
  data: {
    mealTypes: ['早餐', '午餐', '晚餐', '宵夜'],
    selectedMeal: null,
    todayFood: '',
    foodList: {
      breakfast: [
        '鲜肉小笼包', '豆浆油条', '鸡蛋灌饼', '皮蛋瘦肉粥', '三明治', '茶叶蛋',
        '广式肠粉', '生煎馒头', '牛肉锅贴', '豆腐脑', '糯米鸡', '叉烧包', 
        '红糖发糕', '南瓜粥', '煎饼果子', '芝麻烧饼', '虾饺皇', '奶黄包'
      ],
      lunch: [
        '红烧牛肉面', '黄焖鸡米饭', '鱼香肉丝盖饭', '麻辣香锅', '日式豚骨拉面', '海南鸡饭',
        '台式卤肉饭', '冬阴功海鲜汤', '孜然羊肉炒饭', '韩式部队锅', '意式肉酱面', 
        '泰式绿咖喱鸡', '新疆大盘鸡', '湖南小炒肉', '东北地三鲜', '云南过桥米线',
        '上海葱油拌面', '福建沙县蒸饺'
      ],
      dinner: [
        '番茄牛腩煲', '清蒸鲈鱼', '黑椒牛排套餐', '韩式石锅拌饭', '台式卤肉饭', '酸菜鱼',
        '北京烤鸭卷饼', '法式红酒烩牛肉', '日式寿喜锅', '川味毛血旺', '广式腊味煲仔饭',
        '泰式柠檬鱼', '西班牙海鲜饭', '湖南剁椒鱼头', '陕西油泼面', '重庆辣子鸡',
        '潮汕牛肉火锅', '苏式松鼠桂鱼'
      ],
      midnight: [
        '烧烤套餐', '小龙虾', '炒方便面', '关东煮', '粥铺套餐', '炸鸡啤酒',
        '麻辣烫', '臭豆腐', '烤冷面', '鸡蛋汉堡', '章鱼小丸子', '铁板豆腐',
        '韩式炒年糕', '港式碗仔翅', '柳州螺蛳粉', '成都串串香', '潮汕砂锅粥',
        '南京鸭血粉丝', '武汉热干面'
      ]
    }
  },

  handleMealSelect(e) {
    const index = e.detail.value
    this.setData({
      selectedMeal: this.data.mealTypes[index],
      todayFood: '' // 清空已选结果
    })
  },

  pickRandomFood() {
    const { selectedMeal, foodList } = this.data
    if (!selectedMeal) {
      wx.showToast({ title: '请先选择餐时', icon: 'none' })
      return
    }

    // 获取对应餐型的key
    const mealKey = selectedMeal === '早餐' ? 'breakfast' :
      selectedMeal === '午餐' ? 'lunch' :
      selectedMeal === '晚餐' ? 'dinner' : 'midnight'
    
    const foods = foodList[mealKey]
    const randomIndex = Math.floor(Math.random() * foods.length)
    
    // 添加动画效果
    this.setData({ todayFood: '' }, () => {
      setTimeout(() => {
        this.setData({ 
          todayFood: foods[randomIndex],
          animation: 'fade-in 0.5s ease-out'
        })
      }, 50)
    })
  }
})