// app.js
App({
  globalData: {
    notices: [
      {
        title: "2025年4月26日-更新公告",
        date: "2025-04-26",
        content: `本次更新包含以下内容：
1、“更多”-“数据管理”页生成数据包后支持一键转发，可发给自己/朋友；
2、美化“公告”页；
3、美化“更新日志”页；
4、修复已知问题。

历史更新请前往 “更多”->“更新日志” 查看。
有问题欢迎在 右上角“···”->“投诉与反馈” 说明，谢谢！`
      },
      {
        title: "暂停维护说明",
        date: "2025-04-20",
        content: `本人为初中生，因临近期中考及生地会考，学习进度紧张，所以做出暂停维护的决定。今后（2025.4.20至2025.7）将不定期进行更新，拟7月份后继续维护。谢谢理解！`
      },
      {
      title: "2025年4月20日-更新公告",
      date: "2025-04-20",
      content: `本次更新包含以下内容：
1、新增公告栏；
2、优化界面交互体验；
3、“日历”页支持查看当天待办（基础框架已支持，后续将加入更多功能）；
4、修复已知问题。

历史更新请前往 “更多”->“更新日志” 查看。
有问题欢迎在 右上角“···”->“投诉与反馈” 说明，谢谢！`
    }],
  },

  updateCalendarCache(todos) {
    const cache = {};
    todos.forEach(todo => {
      const date = new Date(todo.setDate);
      const key = `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2,'0')}-${date.getDate().toString().padStart(2,'0')}`;
      
      if (!cache[key]) {
          cache[key] = {
              count: 0,
              sampleText: todo.text
          };
      }
      cache[key].count++;
    });
    
    this.globalData.calendarCache = cache;
  },

  /**
   * 当小程序初始化完成时，会触发 onLaunch（全局只触发一次）
   */
  onLaunch: function(){
    this.updateCalendarCache(wx.getStorageSync('todos') || []);
    this.login()  // 调用
  },
 
  login:function(){
    // wx.login()获取code
    wx.login({
      success:(res)=>{
        console.log("code: " + res.code);
      }
    })
  },


  /**
   * 当小程序启动，或从后台进入前台显示，会触发 onShow
   */
  onShow: function (options) {
    
  },

  /**
   * 当小程序从前台进入后台，会触发 onHide
   */
  onHide: function () {
    
  },

  /**
   * 当小程序发生脚本错误，或者 api 调用失败时，会触发 onError 并带上错误信息
   */
  onError: function (msg) {
    
  }
})
