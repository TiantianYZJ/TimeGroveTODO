Page({
  data: {
    minDate: new Date(2025, 3, 3).getTime(),
    maxDate: new Date(new Date().getFullYear() + 5, 0, 1).getTime(),
    today: new Date().getTime(),

    format(day) {
      const { date } = day;
      const key = `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2,'0')}-${date.getDate().toString().padStart(2,'0')}`;
      const cache = getApp().globalData.calendarCache[key];

      if (cache) {
          day.prefix = `${cache.count}项`;
          day.suffix = cache.sampleText.substring(0,3) + (cache.sampleText.length >3 ? '..' : '');
          day.className = 't-calendar__day--top';
      }
      return day;
    },

    selectedTodos: [],
    selectedDate: '',
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

  // 保持与全局缓存一致的格式化方法
  formatDate(date) {
    return `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2,'0')}-${date.getDate().toString().padStart(2,'0')}`;
  },

  handleCalendar(e) {
    const { type } = e.currentTarget.dataset;
    this.setData({ type, visible: true });
  },

  handleConfirm(e) {
    console.log('handleConfirm', e);
    const { value } = e.detail;

    // 调整为与全局缓存一致的日期格式
    const selectedDate = new Date(value);
    const year = selectedDate.getFullYear();
    const month = (selectedDate.getMonth() + 1).toString().padStart(2, '0');
    const date = selectedDate.getDate().toString().padStart(2, '0');
    const currentKey = `${year}-${month}-${date}`;

    // 获取并过滤待办事项（匹配全局缓存格式）
    const todos = wx.getStorageSync('todos') || [];
    const filtered = todos.filter(todo => {
      const todoDate = new Date(todo.setDate);
      return this.formatDate(todoDate) === currentKey;
    });

    this.setData({
      selectedTodos: filtered,
      selectedDate: currentKey
    });
  },

   // 复用todo页方法
   navigateToDetail(e) {
    const index = e.currentTarget.dataset.index;
    wx.navigateTo({
      url: `/pages/todo-detail/todo-detail?index=${index}`
    });
  },

  toggleTodo(e) {
    const index = e.currentTarget.dataset.index;
    const todos = wx.getStorageSync('todos');
    todos[index].completed = !todos[index].completed;
    wx.setStorageSync('todos', todos);
    this.setData({ selectedTodos: todos });
    getApp().updateCalendarCache(todos);
  },

  // 复用操作按钮逻辑
  handleSwipeAction(e) {
    const { type, index } = e.currentTarget.dataset;
    if (type === 'edit') {
      this.editTodo(index);
    } else if (type === 'delete') {
      this.deleteTodo(index);
    }
  }
});