Page({
  data: {
    contributors: [
      {
        name: "TiantianYZJ.（作者）",
        contributions: ["UI设计", "代码编写", "功能测试"],
        avatar: "https://pic1.imgdb.cn/item/6815679258cb8da5c8d71802.jpg"
      },
      {
        name: "wendy",
        contributions: ["建议反馈", "功能测试", "需求分析"],
        avatar: "https://pic1.imgdb.cn/item/6813885858cb8da5c8d638ae.jpg"
      },
      {
        name: "Scarlett",
        contributions: ["功能建议", "宣传推广"],
        avatar: "https://pic1.imgdb.cn/item/68138acc58cb8da5c8d6397d.jpg"
      },
      {
        name: "苹果大王", 
        contributions: ["功能建议"],
        avatar: "https://pic1.imgdb.cn/item/6813884c58cb8da5c8d638ad.jpg"
      },
      {
        name: "忆江槐.", 
        contributions: ["功能建议"],
        avatar: "https://pic1.imgdb.cn/item/6814dd7d58cb8da5c8d70635.png"
      },
      {
        name: "zp、", 
        contributions: ["功能建议"],
        avatar: "https://pic1.imgdb.cn/item/68176bbf58cb8da5c8dc5a2d.jpg"
      },
    ],

    serviceFab: {
      openType: 'contact'
    },
  },

  onShareAppMessage() {
    return {
      title: '时光绿径待办-致谢',
      path: '/pages/acknowledge/acknowledge',
      imageUrl: 'https://pic1.imgdb.cn/item/6814180958cb8da5c8d64852.png'
    }
  },

  onShareTimeline() {
    return {
      title: '时光绿径待办-致谢',
      path: '/pages/acknowledge/acknowledge',
      imageUrl: 'https://pic1.imgdb.cn/item/6814180958cb8da5c8d64852.png'
    }
  },
})