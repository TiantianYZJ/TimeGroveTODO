# Apple 设计原则整改方案

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 基于 Apple 设计原则审查结果，对时光绿径待办小程序进行可执行的精细化整改，提升交互流畅度和视觉一致性

**Architecture:** 整改分 4 个优先级阶段逐步推进：P0 基础体验（按需反馈、排版统一）→ P1 动效系统升级（可中断动画 + 弹簧物理）→ P2 材料与空间优化（毛玻璃层级减薄、路径对称）→ P3 包容性（减少动效、降低透明）。每阶段按页面渐进式改造，优先改造核心页面（todo、todo-detail、add-todo）。

**Tech Stack:** 微信小程序 WXML/WXSS/JS，TDesign Miniprogram 组件，CSS `@keyframes` / `transition` / `backdrop-filter`

**CSS 颜色规范约定：** 所有设计中已统一使用 `#00b26a` 小写作为 primary-color。本计划所有样式变更均遵循此约定。

---

## 改造范围一览

| 阶段 | 核心改造页面 | 涉及 CSS 文件 | 涉及 JS 文件 |
|------|------------|-------------|------------|
| P0 | todo, todo-detail, add-todo, calendar | todo.wxss, calendar.wxss, add-todo.wxss | todo.js |
| P1 | todo, todo-detail, calendar, community-home | todo.wxss, calendar.wxss, app.wxss | todo.js, calendar.js |
| P2 | 所有弹窗页面 | todo.wxss, post-detail.wxss, add-todo.wxss | — |
| P3 | 全局 | app.wxss, 所有 page wxss | app.js |

---

## P0 — 基础体验（优先级最高）

### Task 0.1：全局 `:active` 反馈标准化

**文件修改：**
- 修改：`E:\WechatDevelop\TimeGreen Path Todo\app.wxss`

**问题：** 目前许多可点击元素（搜索框、公告栏、部分 `t-cell`）在按下时没有即时视觉反馈，反馈只在 `bindtap` 释放时触发。Apple 原则要求"在 pointer-down 时即刻反馈"。

**改造方案：** 在 `app.wxss` 新增全局通用反馈类，并在所有 `bindtap` 上统一应用 `hover-class` 或 `:active` 样式。

- [ ] **Step 1: 在 app.wxss 末尾追加全局交互反馈类**

```css
/* ========== P0: 全局交互反馈 ========== */

/* 通用点击反馈 - 触按即响应 */
.press-fade:active {
  opacity: 0.7;
  transition: opacity 80ms ease-out;
}

.press-scale:active {
  transform: scale(0.97);
  transition: transform 80ms ease-out;
}

.press-bg:active {
  background: rgba(0, 0, 0, 0.05) !important;
  transition: background 80ms ease-out;
}
```

- [ ] **Step 2: 为搜索框、公告栏添加即时按下反馈**

修改 `pages/todo/todo.wxml:19-24`：

```diff
-    <view class="search-box" bindtap="onSearchConfirm">
+    <view class="search-box press-fade" bindtap="onSearchConfirm">
```

修改 `pages/todo/todo.wxml:51`：

```diff
-  <view class="custom-notice" bindtap="navigateToNotice">
+  <view class="custom-notice press-scale" bindtap="navigateToNotice">
```

- [ ] **Step 3: 统一各页面 header 标题的 hover 反馈**

在 `app.wxss` 添加：

```css
/* 自定义导航栏反馈 */
.nav-header:active {
  opacity: 0.8;
  transition: opacity 80ms ease-out;
}
```

在所有页面的 header 区域添加 `press-fade` 类（若 header 本身可点击）。

---

### Task 0.2：排版一致性整改

**文件修改：**
- 修改：`E:\WechatDevelop\TimeGreen Path Todo\app.wxss`
- 修改：`E:\WechatDevelop\TimeGreen Path Todo\pages\todo\todo.wxss`
- 修改：`E:\WechatDevelop\TimeGreen Path Todo\pages\todo-detail\todo-detail.wxss`

**问题：** 
- `#00b26a` 与 `#00B26A` 大小写混用（CSS 中 hex 大小写不敏感，但为规范统一应全小写）
- 多页面基础字号不一致：todo.wxss `34rpx` 标题，todo-detail `48rpx` 标题，stats `44rpx` 数据
- 低对比度：`#999` 在浅灰背景上可读性差

- [ ] **Step 1: 统一颜色值为全小写**

搜索所有 WXSS 文件中的 `#00B26A`，替换为 `#00b26a`：

```bash
# 查找所有包含大写 B26A 的文件，使用 grep（本命令供开发时参考）
# 需要替换的文件至少包括：stats.wxss, todo-detail.wxss
```

在以下文件中替换：

`pages/stats/stats.wxss`:
```diff
-  color: #00B26A;
+  color: #00b26a;
```
（搜索所有出现并替换）

- [ ] **Step 2: 建立全局文字色阶变量**

在 `app.wxss` 的 `page {}` 块中添加：

```css
page {
  /* ...已有变量... */
  /* 文字色阶 - 统一使用 */
  --text-primary: #2d3436;
  --text-secondary: #666666;
  --text-tertiary: #999999;
  --text-disabled: #cccccc;
}
```

- [ ] **Step 3: 调整关键页面字号为统一阶梯**

| 用途 | 推荐值 | 当前值 | 文件 |
|------|--------|--------|------|
| 大标题（统计数字） | `44rpx` | `44rpx` ✅ | stats.wxss |
| 页面标题（待办名） | `40rpx` | `48rpx` | todo-detail.wxss |
| 卡片标题（待办文字） | `34rpx` | `34rpx` ✅ | todo.wxss |
| 正文/表单标签 | `30rpx` | `30rpx` ✅ | add-todo.wxss |
| 辅助文字 | `26rpx` | `26rpx` ✅ | todo.wxss |
| 小标签/角标 | `22rpx` | `22rpx` ✅ | todo.wxss |

无需额外修改——目前各层级字号的阶梯已经合理。

---

## P1 — 动效系统升级

### Task 1.1：completed 完成态动画改为可中断弹簧

**文件修改：**
- 修改：`E:\WechatDevelop\TimeGreen Path Todo\pages\todo\todo.wxss`
- 修改：`E:\WechatDevelop\TimeGreen Path Todo\pages\todo\todo.js`

**问题：** 完成态切换的 `completePulse` 动画使用 `@keyframes` + `cubic-bezier`，无法被手势中断。改为基于 `transition` 的版本。

- [ ] **Step 1: 将 `completePulse` 从 `@keyframes` 改为 `transition` 驱动的变色**

替换 todo.wxss 中的 `@keyframes completePulse` 和相关类：

```css
/* ========== 完成态切换过渡（可中断） ========== */
.todo-item.first-complete {
  transition:
    background 0.6s cubic-bezier(0.34, 1.56, 0.64, 1),
    box-shadow 0.6s cubic-bezier(0.34, 1.56, 0.64, 1),
    transform 0.4s cubic-bezier(0.23, 1, 0.32, 1);
}

/* 完成态样式 - 直接设置最终值，由 transition 驱动 */
.todo-item.completed {
  background: linear-gradient(135deg, #ecfdf5 0%, #90e0b7 100%) !important;
  box-shadow: 0 4rpx 16rpx rgba(76,175,80,0.15);
}
```

注意：保留 `.todo-item.completed` 的样式定义，移除 `@keyframes completePulse` 整个块。

- [ ] **Step 2: 简化 `toggleTodo` 中的 `setTimeout` 链**

在 `todo.js` 中，完成态切换后 600ms 清除 `_animate` 的逻辑可以保留（用于移除 CSS 类），但取消 `_togglingIds` 锁。删除或注释掉 `_togglingIds` 相关检查和设置：

```diff
-    if (this.data._togglingIds[todoId]) {
-      return;
-    }
-    
-    this.setData({
-      [`_togglingIds.${todoId}`]: true
-    });
```

以及所有 `_togglingIds` 引用。不阻塞用户操作。

---

### Task 1.2：公告栏入场动画改为可中断 transition

**文件修改：**
- 修改：`E:\WechatDevelop\TimeGreen Path Todo\pages\todo\todo.wxss`

**问题：** 公告栏使用 `@keyframes noticeSlideIn` 弹性入场动画，同样不可中断。

- [ ] **Step 1: 替换 `noticeSlideIn` 为 transition**

移除：

```css
@keyframes noticeSlideIn {
  0% { opacity: 0; transform: translateY(-20rpx) scale(0.95); }
  60% { opacity: 1; transform: translateY(4rpx) scale(1.02); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
```

在 `.custom-notice` 中添加 `transition`：

```css
.custom-notice {
  /* ...已有属性... */
  transition: 
    opacity 0.4s cubic-bezier(0.23, 1, 0.32, 1),
    transform 0.4s cubic-bezier(0.23, 1, 0.32, 1);
  animation: none; /* 移除旧 animation */
}
```

---

### Task 1.3：拖拽排序添加速度传递

**文件修改：**
- 修改：`E:\WechatDevelop\TimeGreen Path Todo\pages\todo\todo.js`
- 修改：`E:\WechatDevelop\TimeGreen Path Todo\pages\todo\todo.wxss`

**问题：** 拖拽释放时没有速度跟踪，直接插入。Apple 原则要求释放时传递速度作为初始弹簧速度。

- [ ] **Step 1: 在 `_handleDragMove` 中添加速度跟踪缓冲**

在 `todo.js` 的 data 中添加新字段（在 `onLoad` 或 data 块中）：

```js
// 在 data 中追加：
_velocityHistory: [],    // 存储最近 5 帧的 {time, y}
_dragFrameId: null,      // requestAnimationFrame id
```

- [ ] **Step 2: 实现速度采集**

在 `_handleDragMove` 中，每次 touchmove 记录位置和时间戳：

```js
_handleDragMove(touch) {
  const now = Date.now();
  const history = this.data._velocityHistory || [];
  history.push({ time: now, y: touch.pageY });
  // 保留最近 5 个采样点
  if (history.length > 5) {
    history.shift();
  }
  this.setData({ _velocityHistory: history });

  /* ...已有光标位置更新逻辑... */
}
```

- [ ] **Step 3: 在 `_handleDragEnd` 中计算速度并传递给插入动画**

```diff
_handleDragEnd() {
-    const { _originalTodos, placeholderIndex, dragIndex } = this.data;
+    const { _originalTodos, placeholderIndex, dragIndex, _velocityHistory } = this.data;

+    // 计算释放速度（px/秒）
+    let releaseVelocity = 0;
+    if (_velocityHistory && _velocityHistory.length >= 2) {
+      const last = _velocityHistory[_velocityHistory.length - 1];
+      const first = _velocityHistory[0];
+      const dt = (last.time - first.time) / 1000; // 秒
+      if (dt > 0) {
+        releaseVelocity = (last.y - first.y) / dt;
+      }
+    }

    const finalTodos = [..._originalTodos];
    const movedItem = finalTodos.splice(dragIndex, 1)[0];
    // ...已有插入逻辑...
    
    this.setData({
      // ...已有状态重置...
+      _velocityHistory: [],
    });
    
    // 保存到本地存储
    setLocalTodos(finalTodos);
    getApp().updateCalendarCache(finalTodos);
    
    wx.vibrateShort({ type: 'light' });
    
+    // 使用速度信息触发惯性动画（未来可扩展）
+    if (Math.abs(releaseVelocity) > 300) {
+      // 高速释放——可在未来版本添加弹性着陆动画
+      console.log('fast release:', releaseVelocity);
+    }
  },
```

- [ ] **Step 4: 添加拖拽释放后的弹性回调动画样式**

在 `todo.wxss` 中追加：

```css
/* 拖拽释放后的弹性着陆 */
.todo-item.drop-land {
  animation: dropLand 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

@keyframes dropLand {
  0% {
    transform: scale(1.03);
  }
  50% {
    transform: scale(0.98);
  }
  100% {
    transform: scale(1);
  }
}
```

在 `_handleDragEnd` 中，给被拖拽项短暂添加 `drop-land` 类，300ms 后移除。

---

### Task 1.4：天气卡片浮动动画温和化

**文件修改：**
- 修改：`E:\WechatDevelop\TimeGreen Path Todo\pages\todo\todo.wxss`

**问题：** 天气卡片的 `weatherFloat` 每 6 秒循环浮动 6rpx，持续不断的微动会分散注意力。

- [ ] **Step 1: 降低浮动幅度和频率，或改为仅初始入场动画**

```css
.weather-card {
  /* ...已有属性... */
  animation: weatherFloat 8s ease-in-out infinite;
}

@keyframes weatherFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4rpx); } /* 从 6rpx 减为 4rpx */
}
```

---

## P2 — 材料与空间优化

### Task 2.1：弹窗毛玻璃层级减薄

**文件修改：**
- 修改：`E:\WechatDevelop\TimeGreen Path Todo\pages\todo\todo.wxss`
- 修改：`E:\WechatDevelop\TimeGreen Path Todo\packagePages\add-todo\add-todo.wxss`
- 修改：`E:\WechatDevelop\TimeGreen Path Todo\packagePages\todo-detail\todo-detail.wxss`
- 修改：`E:\WechatDevelop\TimeGreen Path Todo\packageCommunity\post-detail\post-detail.wxss`

**问题：** 多层毛玻璃叠加（弹窗背景 + 内容区域子元素各自有 `backdrop-filter`）导致文字可读性下降。Apple 原则：不要在一个浅色半透明表面上叠加另一个。

- [ ] **Step 1: 弹窗内容区去除二次 backdrop-filter**

搜索所有 `rgba(255, 255, 255, 0.78)` + `backdrop-filter` 同时出现的位置。典型位置：

`todo.wxss` 中的 `.invite-popup`, `.approval-popup`, `.login-popup`, `.copy-popup`, `.share-popup`：
- 这些弹窗的 container 已有 `backdrop-filter`
- 内部的 `.invite-popup-content`, `.approval-scroll` 等不需要再重复加透明背景

对于有内部容器的弹窗，内部使用纯白/近白实色背景：

```diff
.invite-popup-content {
-  background: rgba(255, 255, 255, 0.78);
-  backdrop-filter: blur(24rpx) saturate(180%);
+  background: #ffffff;
+  /* 不使用 backdrop-filter，外层 t-popup 已处理 */
}
```

同理处理所有弹窗内部子元素。

- [ ] **Step 2: add-todo 的组合选择弹出层去叠层**

修改 `add-todo.wxss`：

```diff
.combo-popup-content {
-  background: rgba(255, 255, 255, 0.78);
-  backdrop-filter: blur(24rpx) saturate(180%);
+  background: #ffffff;
}
```

- [ ] **Step 3: todo-detail 评论弹窗去叠层**

修改 `todo-detail.wxss`：

```diff
.comment-popup {
-  background: rgba(255, 255, 255, 0.78);
-  backdrop-filter: blur(24rpx) saturate(180%);
+  background: #ffffff;
}
```

保留 `.comment-input-bar` 的毛玻璃——它浮动在评论列表底部，需要半透明效果：

```css
.comment-input-bar {
  /* 保留 backdrop-filter：这是浮动的输入条，需要半透明分离感 */
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(24rpx) saturate(180%);
}
```

---

### Task 2.2：页面跳转对称过渡

**文件修改：**
- 修改：`E:\WechatDevelop\TimeGreen Path Todo\app.wxss`

**问题：** 所有子页面 `navigateTo` 进入时无入场动画，返回时也无出场动画。Apple 原则：进入和退出应沿相同路径。

微信小程序不支持自定义路由过渡动画，但可以通过以下方式改善感知：

- [ ] **Step 1: 利用 wx.navigateTo 的动画参数**

在 `app.wxss` 添加全局页面过渡：

```css
/* 页面切换动画（微信小程序支持） */
.page {
  animation: pageIn 0.3s cubic-bezier(0.23, 1, 0.32, 1);
}

@keyframes pageIn {
  from {
    opacity: 0;
    transform: translateX(30rpx);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
```

注意：微信小程序 `page` 选择器是支持的。需在各页面最外层 view 添加 `class="page"`。

---

## P3 — 包容性设计

### Task 3.1：`prefers-reduced-motion` 降级

**文件修改：**
- 修改：`E:\WechatDevelop\TimeGreen Path Todo\app.wxss`
- 修改：`E:\WechatDevelop\TimeGreen Path Todo\pages\todo\todo.wxss`

**问题：** 所有动画没有为减少动效模式提供降级方案。Apple 原则：减少动效 ≠ 没有反馈，而是温和的等效替代。

- [ ] **Step 1: 在 app.wxss 添加全局减少动效降级方案**

```css
/* ========== 减少动效降级 ========== */
@media (prefers-reduced-motion: reduce) {
  /* 关闭所有非必要的循环动画 */
  .weather-card,
  .custom-notice,
  .notice-new-dot {
    animation: none !important;
  }
  
  /* 完成态切换用简单的 opacity/fade 替代弹性动画 */
  .todo-item.first-complete {
    animation: none !important;
    transition: opacity 0.3s ease;
  }
  
  /* 卡片入场/出场用 opacity fade */
  .todo-item.add-animation {
    animation: fadeIn 0.2s ease forwards !important;
  }
  
  .todo-item.remove-animation {
    animation: fadeOut 0.2s ease forwards !important;
  }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes fadeOut {
  from { opacity: 1; }
  to { opacity: 0; }
}
```

- [ ] **Step 2: 在 todo.wxss 添加天气卡片和公告栏的降级**

```css
@media (prefers-reduced-motion: reduce) {
  .custom-notice {
    animation: none !important;
    opacity: 1;
  }
  
  .weather-card {
    animation: none !important;
    transform: none !important;
  }
}
```

---

### Task 3.2：`prefers-reduced-transparency` 降级

**文件修改：**
- 修改：`E:\WechatDevelop\TimeGreen Path Todo\app.wxss`

**问题：** 所有毛玻璃表面没有为降低透明度模式提供实色后备。

- [ ] **Step 1: 在 app.wxss 添加透明度降级**

```css
@media (prefers-reduced-transparency: reduce) {
  /* 顶部栏实色后备 */
  .top {
    background: #e3f5eb !important;
    backdrop-filter: none !important;
  }
  
  /* 弹窗实色后备 */
  .invite-popup,
  .approval-popup,
  .login-popup,
  .copy-popup,
  .comment-popup,
  .combo-popup-content,
  .visitor-popup {
    background: #ffffff !important;
    backdrop-filter: none !important;
    border: 1rpx solid #e0e0e0 !important;
  }
}
```

---

## P4 — 按页面优化（渐进式）

### Task 4.1：待办页（todo）优化

**文件修改：**
- 修改：`E:\WechatDevelop\TimeGreen Path Todo\pages\todo\todo.wxml`
- 修改：`E:\WechatDevelop\TimeGreen Path Todo\pages\todo\todo.wxss`
- 修改：`E:\WechatDevelop\TimeGreen Path Todo\pages\todo\todo.js`

- [ ] **Step 1: FAB 按钮重叠修复**

目前 3 个 FAB（返回顶部、语音、添加）自上而下排列，在短屏手机上可能重叠。确保间隔：

```diff
<t-fab
  wx:if="{{showBackTop}}"
  icon="arrow-up"
  bind:click="onToTop"
-  style="right: 32rpx; bottom: 268rpx;"
+  style="right: 32rpx; bottom: calc(150rpx + 128rpx);"
/>
```

- [ ] **Step 2: 搜索框加图标微动效**

在 `todo.wxml` 的搜索框添加微交互——点击时搜索图标轻微旋转：

```css
/* 在 todo.wxss 追加 */
.search-box:active .search-icon {
  transform: rotate(10deg) scale(0.9);
  transition: transform 0.15s ease;
}
```

---

### Task 4.2：待办详情页（todo-detail）优化

**文件修改：**
- 修改：`E:\WechatDevelop\TimeGreen Path Todo\packagePages\todo-detail\todo-detail.wxss`
- 修改：`E:\WechatDevelop\TimeGreen Path Todo\packagePages\todo-detail\todo-detail.wxml`

- [ ] **Step 1: 为长内容页面添加粘性导航**

当前页面极长（子任务 + 评论 + 共享进度），用户在底部评论时无法快速跳转。在 WXML 中添加 sticky TOC（若 wx-if 条件为评论可见）：

```xml
<view wx:if="{{subtaskList.length > 0 || comments.length > 0}}" class="page-toc">
  <view class="toc-item {{_currentSection === 'detail' ? 'active' : ''}}" data-section="detail" bindtap="scrollToSection">详情</view>
  <view wx:if="{{subtaskList.length > 0}}" class="toc-item {{_currentSection === 'subtask' ? 'active' : ''}}" data-section="subtask" bindtap="scrollToSection">子任务</view>
  <view wx:if="{{comments.length > 0}}" class="toc-item {{_currentSection === 'comment' ? 'active' : ''}}" data-section="comment" bindtap="scrollToSection">评论</view>
</view>
```

```css
.page-toc {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  gap: 16rpx;
  padding: 16rpx 20rpx;
  background: rgba(255,255,255,0.9);
  backdrop-filter: blur(12rpx);
  border-radius: 32rpx;
  margin: 16rpx 0;
}

.toc-item {
  padding: 8rpx 24rpx;
  border-radius: 32rpx;
  font-size: 26rpx;
  color: #666;
  background: #f5f5f5;
}

.toc-item.active {
  background: #00b26a;
  color: #fff;
}
```

- [ ] **Step 2: 图片区域加入场动画**

```css
.todo-image {
  /* ...已有属性... */
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.todo-image:active {
  transform: scale(0.95);
  box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.15);
}
```

---

### Task 4.3：日历页（calendar）解耦

**文件修改：**
- 修改：`E:\WechatDevelop\TimeGreen Path Todo\pages\calendar\calendar.wxss`

- [ ] **Step 1: 移除 `@import` 耦合，内联所需样式**

```diff
- @import "../todo/todo.wxss";
```

改为在 `calendar.wxss` 中仅引入真正需要的样式（如 `.header`, `.title`, `.top`, `.btn-wrapper` 等与 todo 共享的布局样式）：

```css
/* ========== 顶部栏（与 todo 页共享布局） ========== */
.top {
  top: 0;
  left: 0;
  right: 0;
  z-index: 999;
  position: fixed;
  background: #e3f5eb99;
  backdrop-filter: blur(20rpx) saturate(180%);
}

.header {
  padding: 0 30rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 88rpx;
}

.title {
  font-size: 50rpx;
  font-weight: 600;
  color: #2d3436;
  flex: 1;
}

/* ========== 左滑操作按钮（来自 todo 共享） ========== */
.btn-wrapper { height: 100%; }
.btn {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  width: 110rpx;
  height: 100%;
  color: white;
}
.delete-btn { background-color: #e34d59; }
.edit-btn { background-color: #ed7b2f; }
```

同理处理 `post-detail.wxss` 中的 `@import "../../pages/todo/todo.wxss"`。

---

### Task 4.4：更多页（more）优化

**文件修改：**
- 修改：`E:\WechatDevelop\TimeGreen Path Todo\pages\more\more.wxml`

- [ ] **Step 1: 工具网格适配**

当前 t-grid 设置 `column="{{4}}"` 但只有 2 项。改为自动适配：

```diff
-    <t-grid column="{{4}}" hover="{{true}}" theme="card">
+    <t-grid column="{{Math.min(toolItems.length, 4)}}" hover="{{true}}" theme="card">
```

或在 WXML 中直接设为 2（更简单）：

```xml
<t-grid column="{{2}}" hover="{{true}}" theme="card">
```

---

### Task 4.5：统计页（stats）导航优化

**文件修改：**
- 修改：`E:\WechatDevelop\TimeGreen Path Todo\pages\stats\stats.wxml`
- 修改：`E:\WechatDevelop\TimeGreen Path Todo\pages\stats\stats.wxss`

- [ ] **Step 1: 添加章节锚点快速导航**

```xml
<view class="section-nav">
  <view class="nav-chip {{_activeSection === 'overview' ? 'active' : ''}}" data-section="overview" bindtap="scrollToSection">概览</view>
  <view class="nav-chip {{_activeSection === 'trend' ? 'active' : ''}}" data-section="trend" bindtap="scrollToSection">趋势</view>
  <view class="nav-chip {{_activeSection === 'time' ? 'active' : ''}}" data-section="time" bindtap="scrollToSection">时间</view>
  <view class="nav-chip {{_activeSection === 'location' ? 'active' : ''}}" data-section="location" bindtap="scrollToSection">位置</view>
</view>
```

```css
.section-nav {
  display: flex;
  gap: 12rpx;
  padding: 16rpx 20rpx;
  overflow-x: auto;
  white-space: nowrap;
}

.nav-chip {
  padding: 8rpx 24rpx;
  border-radius: 32rpx;
  font-size: 26rpx;
  color: #666;
  background: #f0f0f0;
  flex-shrink: 0;
}

.nav-chip.active {
  background: #00b26a;
  color: #fff;
}
```

---

## 实施优先级

```
P0（此轮优先实施）:
  └ Task 0.1 → Task 0.2 → Task 2.1 → Task 4.1

P1（动效系统）:
  └ Task 1.1 → Task 1.2 → Task 1.3 → Task 1.4

P2（空间一致性）:
  └ Task 4.3 → Task 2.2 → Task 4.4 → Task 4.5

P3（包容性）:
  └ Task 3.1 → Task 3.2 → Task 4.2
```

---

## 验证方法

每个 Task 实施后：

1. **视觉验证：** 在微信开发者工具中检查样式是否正确应用，无样式冲突
2. **交互验证：** 真机预览确认动画/反馈在 iOS 和 Android 上行为一致
3. **回归验证：** 确认现有功能（拖拽排序、完成切换、弹窗交互）不受影响
4. **可访问性验证：** 在系统设置中开启"减弱动效"和"降低透明度"，确认降级样式生效

---
