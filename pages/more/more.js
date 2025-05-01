Page({
  data: {
    serviceFab: {
      openType: 'contact'
    },
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
})