const { WxCalendar } = require('@lspriv/wx-calendar/lib');
const { LunarPlugin } = require('@lspriv/wc-plugin-lunar');

WxCalendar.use(LunarPlugin);

Page({
  data: {
    minDate: new Date(2025, 3, 3).getTime(),
    maxDate: new Date(new Date().getFullYear() + 5, 0, 1).getTime(),
    today: new Date().getTime(),
    marks: [], // 初始化marks数组

    format(day) {
      const { date } = day;
      const key = `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2,'0')}-${date.getDate().toString().padStart(2,'0')}`;
      const cache = getApp().globalData.calendarCache[key];

      if (cache) {
          day.prefix = cache.count;
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

  handleLoad(e) {
    console.log('日历加载完成', e.detail);
    this.calendar = this.selectComponent('#calendar');
    
    // 转换全局缓存为marks格式
    this.convertMarks();
    
    // 新增初始化选中逻辑
    setTimeout(() => {
      // 获取今日日期对象
      const today = new Date();
      const todayDetail = {
        year: today.getFullYear(),
        month: today.getMonth() + 1, // 月份需要+1
        day: today.getDate()
      };
      
      // 手动触发确认事件
      this.handleConfirm({
        detail: {
          checked: todayDetail
        }
      });
    }, 300);
  },

  // 保持与全局缓存一致的格式化方法
  formatDate(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  convertMarks() {
    const cache = getApp().globalData.calendarCache;
    const marks = [];
    
    for (const key in cache) {
      const date = new Date(key);
      marks.push({
        date: date.getTime(),
        type: 'schedule',
        text: cache[key].sampleText?.split(',')[0]?.trim()
      });
    }
    
    this.setData({ marks });
  },

  // 添加清空选中状态的方法
  clearSelection() {
    this.setData({ 
      selectedTodos: [],
      selectedDate: ''
    });
  },

  parseTime(timeStr) {
    const [hours, minutes] = (timeStr || '00:00').split(':').map(Number);
    return hours * 60 + minutes; // 转换为分钟数方便比较
  },

  handleConfirm(e) {
    const { checked } = e.detail;
    
    // 创建标准日期对象
    const standardDate = new Date(
      checked.year,
      checked.month - 1, // 月份需要-1
      checked.day
    );
    
    // 使用标准化格式方法
    const currentKey = this.formatDate(standardDate);

    // 获取待办事项并去重
    const todos = wx.getStorageSync('todos') || [];
    const uniqueTodos = new Map();
    
    const filtered = todos.filter(todo => {
      try {
        // 统一处理日期格式
        const todoDate = new Date(todo.setDate);
        const todoKey = this.formatDate(todoDate);
        
        // 创建唯一标识（内容+日期+备注）
        const uniqueId = `${todo.text}|${todoKey}|${todo.remarks || ''}`;
        
        // 匹配日期且未重复
        if (todoKey === currentKey && !uniqueTodos.has(uniqueId)) {
          uniqueTodos.set(uniqueId, true);
          return true;
        }
        return false;
      } catch (e) {
        console.error('日期解析错误:', todo.setDate);
        return false;
      }
    });

    // 新增时间排序逻辑
    const sorted = filtered.sort((a, b) => {
      const aTime = this.parseTime(a.setTime || '23:59');
      const bTime = this.parseTime(b.setTime || '23:59');
      return aTime - bTime;
    });

    console.log('选中日期:', currentKey);
    console.log('排序后的待办事项:', sorted);

    this.setData({
      selectedTodos: filtered,
      selectedDate: currentKey
    });
  },

  // 复用todo页方法
  navigateToDetail(e) {
    const selectedIndex = e.currentTarget.dataset.index;
    // 获取当前展示的待办项
    const currentTodo = this.data.selectedTodos[selectedIndex];
    
    // 在全局todos中查找真实索引
    const todos = wx.getStorageSync('todos');
    const realIndex = todos.findIndex(t => 
        t.text === currentTodo.text && 
        t.setDate === currentTodo.setDate &&
        t.setTime === currentTodo.setTime
    );
    
    wx.navigateTo({
        url: `/pages/todo-detail/todo-detail?index=${realIndex}`
    });
  },

  toggleTodo(e) {
    const index = e.currentTarget.dataset.index;
    const todos = wx.getStorageSync('todos');
    
    // 获取当前展示的待办项
    const currentTodo = this.data.selectedTodos[index];
    
    // 在全局todos中查找真实索引
    const realIndex = todos.findIndex(t => 
      t.text === currentTodo.text && 
      t.setDate === currentTodo.setDate &&
      t.setTime === currentTodo.setTime
    );
    
    if (realIndex !== -1) {
      // 更新真实索引项的完成状态
      todos[realIndex].completed = !todos[realIndex].completed;
      wx.setStorageSync('todos', todos);
      
      // 重新过滤当天待办（保持当前选中日期）
      const filtered = todos.filter(todo => 
        this.formatDate(new Date(todo.setDate)) === this.data.selectedDate
      );
      
      this.setData({ 
        selectedTodos: filtered.sort((a, b) => 
          this.parseTime(a.setTime || '23:59') - this.parseTime(b.setTime || '23:59')
        ) 
      });
      getApp().updateCalendarCache(todos);
    }
  },

  // 复用todo页的删除逻辑（约第171行）
  deleteTodo(index) {
    const that = this
    wx.showModal({
      title: '删除确认',
      content: '该操作不可撤销，确定继续吗？',
      confirmText: '删除',
      confirmColor: '#ff4d4f',
      success(res) {
        if (res.confirm) {
          const todos = wx.getStorageSync('todos')
          todos.splice(index, 1)
          wx.setStorageSync('todos', todos)
          that.setData({
            selectedTodos: that.data.selectedTodos.filter((_, i) => i !== index)
          })
          getApp().updateCalendarCache(todos)
        }
      }
    })
  },

  // 复用编辑逻辑（约第184行）
  editTodo(index) {
    const todo = this.data.selectedTodos[index]
    wx.navigateTo({
      url: `/pages/add-todo/add-todo?edit=1&index=${index}&text=${encodeURIComponent(todo.text)}&setDate=${todo.setDate}&setTime=${todo.setTime || '12:00'}&remarks=${encodeURIComponent(todo.remarks || '')}&location=${encodeURIComponent(JSON.stringify(todo.location))}`
    })
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

// 使用
// 小程序基础库 SDKVersion >= 3.0.0

// 1.安装
// npm i @lspriv/wx-calendar -S
// 2.构建
// 微信小程序开发工具菜单栏：工具 --> 构建 npm 官方文档

// 3.引入配置
// 在页面或全局配置文件中配置

// {
//     "usingComponents": {
//         "calendar": "@lspriv/wx-calendar"
//     }
// }
// 4.页面使用
// 在页面wxml文件中使用

// <calendar id="calendar" bindload="handleLoad" />
// const { WxCalendar } = require('@lspriv/wx-calendar/lib');
// const { LunarPlugin } = require('@lspriv/wc-plugin-lunar');
// // 使用农历插件
// WxCalendar.use(LunarPlugin);

// Page({
//   handleLoad(detail) {
//     console.log('calendar load', detail);
    
//     const calendar = this.selectComponent('#calendar');
//     console.log('calendar', calendar);
//   }
// })
// 5.类型检查
// 由于小程序构建npm的特殊性，日历组件本身是非纯js库，为了获得正确的的类型提示，需要在小程序根目录的jsconfig.json或是tsconfig.json文件中指明路径。

// {
//   "compilerOptions": {
//     "paths": {
//       "@lspriv/wx-calendar/*": [
//           "./node_modules/@lspriv/wx-calendar/dist/*"
//         ]
//     }
//   }
// }
// Important

// 请在 bindload 事件后执行 selectComponent('#calendar') 操作。

// 二次开发
// alpha分支是最新开发分支，develop是测试包分支，master是稳定包分支

// 启动
// npm install
// # 启动，默认skyline配置
// npm run dev
// # 设置webview
// # npm run dev @webview 或者 npm run dev @W
// 打包
// npm run build
// 发包（预览包）
// npm run package
// Note

// 这个发包命令执行了打包、发包和推送仓库三部分，所以不必重复执行打包命令

// 测试
// 测试尚未写完

// 多端支持
// Donut
// 需要开启以下选项，开发工具右上角 -> 详情 -> 本地设置

// 使用 SWC 编译脚本文件
// 编译 worklet 代码
// Android XWeb SDK，在 project.miniapp.json中开启
// UniApp
// 项目根目录下创建 components 文件夹，将打包后dist里的文件拷贝过来放到单独的一个文件夹，比如 components/wx-calendar/**
// 在 pages.json 的 globalStyle 中配置 usingComponents
// {
//    "globalStyle": {
//      "wx-calendar": "/components/wx-calendar"
//    } 
// }
// 注意事项请参考 UniApp小程序自定义组件支持

// Taro
// 请使用日历组件 Taro插件

// Note

// 如果在 Taro 项目引用了小程序原生的组件，那么该项目将不再具备多端转换的能力。

// 类型说明
// 以下出现的类型定义：

// type CalendarDay = {
//   year: number; // 年
//   month: number; // 月
//   day: number; // 日
// };
// Props 属性
// 以下所有属性都是可选填属性

// 属性	类型	说明	默认值
// view	string	视图	month [week|schedule]
// marks	array	日程、角标和节假日标记	[]
// vibrate	boolean	点选日期是否震动	true
// darkmode	boolean	深色模式（跟随系统）	false
// date	string|number	选中日期	xxxx-xx-xx|timestamp
// weekstart	number	周首日，0|1|2|3|4|5|6	0
// style	string	设置主题样式变量	''
// font	string	设置字体	''
// areas	array	自定义布局区域	['header', 'title', 'subinfo', 'today', 'viewbar', 'dragbar']
// viewGesture	boolean	是否滑动手势控制视图	true
// sameChecked	boolean	保持选中日期样式一致	false
// customNavBar	boolean	组件所在页面是否自定义导航栏	true
// alignDate	string	日期排布（居中｜基线对齐）	center [center|baseline]
// showRest	boolean	非本月日期是否显示	true
// Tip

// 1.7.0+版本已经移除了固定视图属性，新增手势控制属性 viewGesture ，用以下方式实现固定视图，有更高的自由度

// 固定视图的新方式

// <!-- 固定为周视图 -->
// <!-- view 默认初始视图 -->
// <!-- view-gesture 取消手势控制 -->
// <!-- areas 只保留四个区域，将viewbar和dragbar移除 -->
// <calendar 
//   view="week"
//   view-gesture="{{ false }}"
//   areas="{{ ['header', 'title', 'subinfo', 'today'] }}"
// />
// Tip

// 关于属性 marks

// // 标记里的日期，要么输入年月日year｜month｜day，要么输入日期 date
// type CalendarMark = {
//   year?: number; // 年
//   month?: number; // 月 
//   day?: number; // 日
//   date?: string | number | Date; // 日期 yyyy-mm-dd | timestamp | Date
//   type: 'schedule' | 'corner' | 'festival' | 'solar'; // 日程｜角标｜节假日 | 日期文字
//   text: string; // 内容
//   style?: string | Record<string, string | number>; // 标记样式
// }
// // 样式标记
// type CalendarStyleMark = {
//   year?: number; // 年
//   month?: number; // 月 
//   day?: number; // 日
//   date?: string | number | Date; // 日期 yyyy-mm-dd | timestamp | 
//   style: string | Record<string, string | number>;
// }
// 角标内容最好一个字符长度，只对一个字符校正了位置，多出的请自行调整位置

// Important

// 如果组件所在页面未开启自定义导航栏，请设置属性 customNavBar 为 false

// Events 事件
// bindload 日历加载完成

// type LoadEventDetail = {
//     checked: CalenderDay; // 当前选择日期
//     view: 'week' | 'month' | 'schedule'; // 当前视图
//     range: [start: CalenderDay, end: CalenderDay]; // 当前渲染的月份范围
// }
// 获取组件实例

// <calendar id="calendar" bindload="handleLoad" />
// import { CalendarExport } from '@lspriv/wx-calendar/lib';

// Page({
//   handleLoad() {
//     const calendar = this.selectComponent('#calendar') as CalendarExport; 
//     // 如果你使用了其他插件，比如 WxCalendar.use(AnyPlugin)，则可以
//     // const calendar = ... as CalendarExport<[typeof AnyPlugin]>;
//   }
// });
// bindclick 日期点击

// type LoadEventDetail = {
//     checked: CalenderDay; // 当前点击日期
//     view: 'week' | 'month' | 'schedule'; // 当前视图
// }
// Note

// 日期点击事件，若有必要请自行防抖处理

// bindchange 日期选中变化

// type ChangeEventDetail = {
//     checked: CalenderDay; // 当前选择日期
//     view: 'week' | 'month' | 'schedule'; // 当前视图
//     range: [start: CalenderDay, end: CalenderDay]; // 当前渲染的月份范围
// }
// bindviewchange 面板视图变化

// type ViewChangeEventDetail = {
//     checked: CalenderDay; // 当前选择日期
//     view: 'week' | 'month' | 'schedule'; // 当前视图
// }
// bindschedule 点击日程触发

// type ScheduleEventDetail = {
//     schedules?: Array<ScheduleEventDetail>; // 所有日程
//     schedule?: ScheduleEventDetail; // 当前点击日程
//     all: boolean; // 是否所有日程
// }
// Methods 方法
// checked 选中日期

// {
//   /**
//    * @param date 选中日期
//    * yyyy-mm-dd | timestamp | Date | CalendarDay
//    */
//   (date: string | number | Date | CalendarDay): Promise<void>;
// }
// toggleView 切换视图

// {
//   /**
//    * @param [view] 要切换的视图
//    * 当view未指定时，会在周月视图之间切换
//    */
//   (view?: 'month' | 'week' | 'schedule'): void;
// }
// openAnnual 打开年度面板

// {
//   (): Promise<void>;
// }
// getMarks 获取完整的日期标记

// {
//   /**
//    * @param date 获取日期
//    */
//   (date: CalendarDay): PluginEntireMarks;
// }
// getPlugin 获取插件实例

// {
//   /**
//    * @param key 插件的KEY
//    */
//   (key: string): InstanceType<PluginConstructor>;
// }
// updateDates 更新日期数据

// {
//   /**
//    * 若不指定哪些日期更新，默认刷新全部
//    */
//   (dates?: Array<CalendarDay>): Promise<void>;
// }
// 样式
// 组件开启了样式隔离，仅可以调整字体大小和色号，可通过传入style属性修改以下css变量调整主题

// .wcc {
//     --wc-primary: #409EFF; /* 主题色 */
    
//     /* 浅色主题 */
//     --wc-bg-light: #FFF; /* 主背景色 */
//     --wc-title-color-light: #333; /* 左上角日期标题 */
//     --wc-title-sub-color-light: #7A7A7A; /* 左上角日期标题的右侧描述 */
//     --wc-opt-color-light: #409EFF; /* 视图控制条主色 */
//     --wc-week-color-light: #ABABAB; /* 星期 */
//     --wc-date-color-light: #333; /* 日期 */
//     --wc-mark-color-light: #ABABAB; /* 日期下方信息 */
//     --wc-dot-color-light: #ABABAB; /* 日期上方‘･’ */
//     --wc-schedule-color-light: #409EFF; /* 日程默认 */
//     --wc-schedule-bg-light: #EAEEF2; /* 日程默认背景 */
//     --wc-today-color-light: #409EFF; /* 日期（今日） */
//     --wc-solar-color-light: #409EFF; /* 日期下方信息默认（节气，节假日） */
//     --wc-checked-color-light: #333; /* 被选日期 */
//     --wc-checked-mark-color-light: #ABABAB; /* 被选日期下方信息 */
//     --wc-checked-dot-color-light: #ABABAB; /* 被选日期上方‘･’ */
//     --wc-checked-today-color-light: #FFF; /* 被选日期（今日） */
//     --wc-checked-bg-light: #F5F5F5; /* 被选日期背景圆圈 */
//     --wc-checked-today-bg-light: #409EFF; /* 被选日期背景圆圈（今日） */
//     --wc-control-bg-light: #DFDFDF; /* 底部控制条背景 */
//     --wc-annual-bg-light: #FFF; /* 年面板背景 */
//     --wc-annual-title-color-light: #333; /* 年面板左上角标题 */
//     --wc-annual-title-sub-color-light: #7A7A7A; /* 年面板左上角标题右侧信息 */
//     --wc-annual-cv-month-color-light: #333; /* 年面板月份标题颜色 */
//     --wc-annual-cv-week-color-light: #ABABAB; /* 年面板星期颜色 */
//     --wc-annual-cv-date-color-light: #333; /* 年面板普通日期颜色 */
//     --wc-annual-cv-rest-color-light: #ABABAB; /* 年面板休息日颜色 */
//     --wc-annual-cv-checked-color-light: #FFF; /* 年面板普通日期选中时颜色 */
//     --wc-annual-cv-checked-bg-light: #F5F5F5; /* 年面板普通日期选中时背景颜色 */
//     --wc-annual-cv-present-color-light: #409EFF; /* 年面板当前月份标题和今日选中时颜色 */

//     /* 深色主题，以下和浅色主题一一对应 */
//     --wc-bg-dark: #000;
//     --wc-title-color-dark: #E5E5E5;
//     --wc-title-sub-color-dark: #7A7A7A;
//     --wc-opt-color-dark: #409EFF;
//     --wc-week-color-dark: #ABABAB;
//     --wc-date-color-dark: #E5E5E5;
//     --wc-mark-color-dark: #5F5F5F;
//     --wc-dot-color-dark: #ABABAB;
//     --wc-schedule-color-dark: #66B1FF;
//     --wc-schedule-bg-dark: #332D2D80;
//     --wc-today-color-dark: #409EFF;
//     --wc-solar-color-dark: #409EFF;
//     --wc-checked-color-dark: #E5E5E5;
//     --wc-checked-mark-color-dark: #5F5F5F;
//     --wc-checked-dot-color-dark: #ABABAB;
//     --wc-checked-today-color-dark: #E5E5E5;
//     --wc-checked-bg-dark: #262626;
//     --wc-checked-today-bg-dark: #409EFF;
//     --wc-control-bg-dark: #262626;
//     --wc-annual-bg-dark: #000;
//     --wc-annual-title-color-dark: #E5E5E5;
//     --wc-annual-title-sub-color-dark: #3F3F3F;
//     --wc-annual-cv-month-color-dark: #D9D9D9; 
//     --wc-annual-cv-week-color-dark: #484848; 
//     --wc-annual-cv-date-color-dark: #D9D9D9; 
//     --wc-annual-cv-rest-color-dark: #484848; 
//     --wc-annual-cv-checked-color-dark: #D9D9D9; 
//     --wc-annual-cv-checked-bg-dark: #262626;
//     --wc-annual-cv-present-color-dark: #409EFF; 

//     /** 字号 */
//     --wc-title-size: 46rpx; /** 左上角日期标题字号 */ 
//     --wc-title-sub-size: 20rpx; /** 左上角日期标题右侧描述信息字号 */ 
//     --wc-operator-size: 22rpx; /** 视图控制按钮字号 */ 
//     --wc-week-size: 20rpx; /** 星期字号 */ 
//     --wc-date-size: 36rpx; /** 日期字体字号 */ 
//     --wc-mark-size: 20rpx; /** 日期下方信息字体字号 */
//     --wc-dot-size: 10rpx; /** 日期上方‘･’大小 */
//     --wc-dot-offset-x: 0; /** 日期上方‘･’水平偏移量 */ 
//     --wc-dot-offset-y: 0; /** 日期上方‘･’垂直偏移量 */ 
//     --wc-corner-size: 16rpx; /** 日期角标字体字号 */ 
//     --wc-schedule-size: 16rpx; /** 日程字体字号 */ 
//     --wc-annual-title-size: 50rpx; /** 年面板左上角年份标题字体字号 */ 
//     --wc-annual-title-sub-size: 18rpx; /** 年面板左上角年份标题右侧信息字体字号 */ 
// }
// 修改样式

// <calendar style="--wc-bg-light: #000;" />
// 插件
// 插件使用
// const { WxCalendar } = require('@lspriv/wx-calendar/lib');
// const { YourPlugin } = require('anywhere');

// // WxCalendar.clearPlugin(); 清理预设插件

// WxCalendar.use(YourPlugin, options); // options 插件选项

// Component({
//     ...
// })
// 插件开发
// 基础部分
// import { Plugin } from '@lspriv/wx-calendar/lib';

// class MyPlugin implements Plugin {
//   /**
//    * 插件的 KEY 是必须的，没有此插件会被过滤掉
//    */
//   static KEY = 'my-plugin' as const;

//   /**
//    * 构造函数，参数为用户传入的插件选项。
//    * 此构造器可选择实现，如果没有提供选项配置或是其他初始化过程的话。
//    */
//   constructor(options?: Record<string, any>) {
//     // options 引入时的插件选项
//   }
// }
// 生命周期
// 注册日历组件的三个生命周期钩子 created attached detacched。

// import { Plugin, PluginService, CalendarData } from '@lspriv/wx-calendar/lib';

// class MyPlugin implements Plugin {

//   /**
//    * 插件初始化，可选择实现该方法
//    * 在日历组件 created 阶段最后，在插件实例化后
//    * @param service PliginService实例
//    */
//   PLUGIN_ON_INITIALIZE(service: PluginService): void {
//     // 获取日历组件实例
//     const component = service.component;
//   }

//   /**
//    * 组件挂载，可选择实现该方法
//    * 在日历组件 attached 阶段中，此时组件的所有工具类已完成实例化，视图数据即将更新。
//    * 你可以在此方法里修改视图更新数据 sets，还可以调整一些工具实例的初始值。
//    * @param service PliginService实例
//    * @param sets 视图数据
//    */
//   PLUGIN_ON_ATTACH(service: PluginService, sets: Partial<CalendarData>): void {

//   }

//   /**
//    * 组件销毁，可选择实现该方法
//    * 在日历组件 detacched 阶段中
//    * @param service PliginService实例
//    */
//   PLUGIN_ON_DETACHED(service: PluginService): void {

//   }
// }
// 数据标记
// 添加修改和删除日期标记，以及完善补充日程数据。

// import { 
//   Plugin, 
//   WcYear, 
//   CalendarDay, 
//   TrackDateResult, 
//   TrackYearResult, 
//   WcScheduleInfo,
//   getMarkKey, 
//   getAnnualMarkKey 
// } from '@lspriv/wx-calendar/lib';

// class MyPlugin implements Plugin {
//   /**
//    * 捕获日期，可选择实现该方法
//    * 在此添加修改和删除【周/月/日程视图面板】的日期标记
//    * @param date 日期
//    */
//   PLUGIN_TRACK_DATE(date: CalendarDay): TrackDateResult | null {
//     // do something...
//     return {
//       schedule: [{ text: '', color: '', bgColor: '', key: getMarkKey('id', MyPlugin.KEY) }], // 设置日程数组，可选
//       corner: { text: '', color: '' }, // 设置角标，可选
//       festival: { text: '', color: '' }, // 设置节假日，可选
//       style: { backgroundColor: '', color: '' } // 设置日期样式，也可传字符串形式（如 'background-color: #409EFF;color: #fff;'），可选
//     };
//   };

//   /**
//    * 捕获年份，可选择实现该方法
//    * 在此添加修改和删除【年面板】的日期标记
//    * @param year 年
//    */
//   PLUGIN_TRACK_YEAR(year: WcYear): TrackYearResult | null {
//     // do something...

//     return {
//       subinfo: [
//         { text: '乙巳蛇年', color: '#F56C6C' },
//         { text: '农历初一', color: '#409EFF' }
//       ], 
//       marks: new Map([
//         [getAnnualMarkKey({ month: 10, day: 6 }), { rwtype: 'rest' }], // 休息日，置灰
//         [getAnnualMarkKey({ month: 10, day: 7 }), { rwtype: 'work' }], // 工作日，正常
//         [getAnnualMarkKey({ month: 10, day: 12 }), { sub: '#F56C6C' }] // 自定义颜色下标
//         [getAnnualMarkKey({ month: 10, day: 20 }), { 
//           style: {
//             color: { light: '#fff', dark: '#000' }, // 日期字体颜色, light浅色模式下，dark深色模式下
//             bgColor: { light: '#409EFF', dark: '#409EFF' }, // 日期背景颜色
//             opacity: { light: 1, dark: 1 }, // 不支持 0
//             bgTLRadius: { light: 50, dark: 50 }, // 日期背景左上圆角半径
//             bgTRRadius: { light: 0, dark: 0 }, // 日期背景右上圆角半径
//             bgBLRadius: { light: 0, dark: 0 }, // 日期背景左下圆角半径
//             bgBRRadius: { light: 50, dark: 50 }, // 日期背景右下圆角半径
//             bgWidth: { light: 'dateCol', dark: 'dateCol' } // 日期背景宽度，deteCol为列宽
//           } 
//         }]
//       ])
//     }
//   };

//   /**
//    * 捕获日程信息（点击日程时执行），可选择实现该方法
//    * @param date 日期
//    * @param id 插件内标记, 由 getMarkKey 生成 key 时传入的 id，详见 PLUGIN_TRACK_DATE
//    */
//   PLUGIN_TRACK_SCHEDULE(date: CalendarDay, id:? string): WcScheduleInfo {

//   }
// }
// 动作捕捉
// 捕获用户的手势动作，此时动作已完成，但在日历组件默认行为之前。

// import { Plugin, PluginService, EventIntercept } from '@lspriv/wx-calendar/lib';

// class MyPlugin implements Plugin {

//   /**
//    * 拦截日期点击动作，可选择实现该方法
//    * @param service PliginService实例
//    * @param event 事件参数
//    * @param intercept 拦截器
//    */
//   PLUGIN_CATCH_TAP(service: PluginService, event: TouchEvent, intercept: EventIntercept): void {
//      // 获取日历组件实例
//     const component = service.component;
//     // 若不想事件继续传播
//     if (...) intercept();
//     // intercept(0) 直接退出 
//     // intercept(1) 继续向其他插件传播，但不会执行日历组件默认行为
//   }

//   /**
//    * 拦截日期跳转动作（如跳转到今日或者调用toDate方法），可选择实现该方法
//    * @param service PliginService实例
//    * @param date 要跳转的日期
//    * @param intercept 拦截器
//    */
//   PLUGIN_CATCH_MANUAL(service: PluginService, date: CalendarDay, intercept: EventIntercept): void {}
// }
// Note

// 本日历统计共有七个主要的动作，当前仅提供日期点击动作和日期跳转动作的捕获，七个动作分别是

// 日期点击
// 日期跳转（今日按钮点击跳转到今日或者调用toDate方法）
// 头部标题点击（打开年面板）
// 视图按钮点击（按钮切换视图）
// 垂直手势滑动（手势切换视图）
// 水平手势滑动（swiper滑动滑块）
// 年面板点击月份（主面板跳转到某月）
// 事件响应
// 响应日历组件事件 load click change viewChange。

// import { Plugin, PluginService, CalendarEventDetail, OnceEmitter } from '@lspriv/wx-calendar/lib';

// class MyPlugin implements Plugin {

//   /**
//    * 日历加载完成，可选择实现该方法
//    * @param service PliginService实例
//    * @param detail 响应数据
//    * @param emiter 事件触发器
//    */
//   PLUGIN_ON_LOAD(service: PluginService, detail: CalendarEventDetail, emiter: OnceEmitter): void {
//     // 获取日历组件实例
//     const component = service.component;

//     emiter.cancel(); // 取消日历组件触发 bindload 事件。
//     // emiter.emit(detail); 劫持触发 bindload 事件，和 emiter.cancel 只能二选一。
//   }

//    /**
//    * 日期点击事件，可选择实现该方法
//    * @param service PliginService实例
//    * @param detail 响应数据
//    * @param emiter 事件触发器
//    */
//   PLUGIN_ON_CLICK(service: PluginService, detail: CalendarEventDetail, emiter: OnceEmitter): void {
    
//   }

//    /**
//    * 日期选中变化，可选择实现该方法
//    * @param service PliginService实例
//    * @param detail 响应数据
//    * @param emiter 事件触发器
//    */
//   PLUGIN_ON_CHANGE(service: PluginService, detail: CalendarEventDetail, emiter: OnceEmitter): void {
    
//   }

//   /**
//    * 视图变化，可选择实现该方法
//    * @param service PliginService实例
//    * @param detail 响应数据
//    * @param emiter 事件触发器
//    */
//   PLUGIN_ON_VIEWCHANGE(service: PluginService, detail: CalendarEventDetail, emiter: OnceEmitter): void {

//   }
// }
// 其他
// import { Plugin, CalendarDay, PluginService, DateRange } from '@lspriv/wx-calendar/lib';

// class MyPlugin implements Plugin {
//   /**
//    * 日期过滤器（提供给其他组件调用的），可选择实现该方法
//    * @param service PliginService实例
//    * @param dates 待过滤的日期数组
//    */
//   PLUGIN_DATES_FILTER(service: PluginService, dates: Array<CalendarDay | DateRange>): Array<Calendar | DateRange> {
//      // 获取日历组件实例
//     const component = service.component;

//     return [
//       [{ year: 2024, month: 6, day: 1 } , { year: 2024, month: 6, day: 28 }], // 日期范围
//       { year: 2024, month: 7, day: 1 } // 单点日期
//     ]
//   }
// }
// 使用装饰器声明上述钩子
// import { WcPlugin, Track, Catch, On, Filter } from '@lspriv/wx-calendar/lib';

// export const MY_PLUGIN_KEY = 'my-plugin';

// @WcPlugin(MY_PLUGIN_KEY) // 声明插件和KEY
// class MyPlugin {

//   @Track('date')
//   trackDate() {}

//   @Track('year')
//   trackYear() {}

//   @Catch('tap')
//   catchTap() {}

//   @On('load')
//   onLoad() {}

//   @Filter
//   datesFilter() {}
// }
// 插件说明
// 数据标记 后引入的插件数据覆盖先引入的插件数据
// 动作捕捉 后引入的先执行
// 响应事件 按插件的引入顺序响应事件，先引入的先响应