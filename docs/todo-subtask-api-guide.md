# 时光绿径待办 — 待办与子待办系统 Web 前端接入指南

> **适用对象**：Web 前端开发者（React / Vue）
> **基础 URL**：`https://api.yzjtiantian.cn`
> **关联文档**：[通用 API 接入规范](api-integration-spec.md)

---

## 目录

1. [系统概述](#1-系统概述)
2. [数据模型](#2-数据模型)
3. [TypeScript 类型定义](#3-typescript-类型定义)
4. [API 端点详解](#4-api-端点详解)
   - [4.1 获取待办列表](#41-获取待办列表)
   - [4.2 创建待办](#42-创建待办)
   - [4.3 获取待办详情](#43-获取待办详情)
   - [4.4 更新待办](#44-更新待办)
   - [4.5 删除待办](#45-删除待办)
   - [4.6 批量获取待办](#46-批量获取待办)
   - [4.7 批量移动待办](#47-批量移动待办)
   - [4.8 数据同步](#48-数据同步)
   - [4.9 回收站操作](#49-回收站操作)
5. [子待办更新语义详解](#5-子待办更新语义详解)
6. [Web 前端集成最佳实践](#6-web-前端集成最佳实践)
7. [附录：完整数据流示例](#7-附录完整数据流示例)

---

## 1. 系统概述

### 1.1 架构

```
Web 前端 (React/Vue) ──HTTP/JSON──▶ Express API ──▶ MySQL 5.5
                                        ▲
微信小程序 ───────HTTP/JSON─────────────┘
```

待办与子待办共享**同一张数据库表**，通过 `parent_id` 字段实现层级关系。子待办可以无限嵌套，但 API 使用**扁平列表**传输，前端通过 `parentId` 字段自行构建树形结构。

### 1.2 核心数据流

```
创建待办 (含子待办)
  POST /todos/create { text, subtasks: [...] }
  └─▶ 后端事务内递归插入父待办 + 所有子待办
  └─▶ 返回扁平子待办列表

更新待办 (含子待办变更)
  PUT /todos/:id { subtasks: [...] }
  └─▶ 全量替换：后端自动 diff 增/删/改
  └─▶ 传入完整子树，未出现的已有子待办会被软删除

查询待办列表
  GET /todos/list?parent_id=null    → 仅根待办
  GET /todos/list?parent_id=<id>    → 指定父待办的直接子级
```

### 1.3 待办 ID 体系

| 字段 | 生成方式 | 示例 | 用途 |
|------|----------|------|------|
| `id` (API 响应) | 后端 `todo_id` 字段 | `todo_1720000000000_abc123` | 客户端稳定标识，创建时本地生成 |
| `dbId` (内部) | 数据库自增 | `1` | 仅服务端使用 |

创建待办时，前端需调用 `generateTodoId()` 生成 `todo_<timestamp>_<random9>` 格式的 ID。这确保了离线创建也能获得全局唯一标识。

---

## 2. 数据模型

### 2.1 待办 (Todo)

```
┌─────────────────────────────────────────┐
│              todos 表                     │
├─────────────────────────────────────────┤
│ id              BIGINT PK AI (服务端内部)  │
│ todo_id         VARCHAR(64) (客户端 ID)    │
│ user_id         BIGINT                    │
│ parent_id       VARCHAR(64) ←── 核心字段   │
│ text            VARCHAR(256)              │
│ set_date        DATE                      │
│ set_time        TIME                      │
│ remarks         TEXT                      │
│ completed       BIGINT (0=未完成, 否则为完成时间戳ms) │
│ is_star         TINYINT                   │
│ priority        VARCHAR(8) (p1-p4)        │
│ combo_id        BIGINT (所属组合)          │
│ tags            TEXT (JSON 数组)           │
│ images          TEXT (JSON 数组)           │
│ version         INT (乐观锁)              │
│ is_deleted      TINYINT                   │
│ created_at      TIMESTAMP                 │
│ updated_at      DATETIME                  │
└─────────────────────────────────────────┘
```

### 2.2 层级关系

子待办是**完整的待办记录**，通过 `parent_id` 指向父待办的 `todo_id`：

```
todo_id: "todo_xxx_root"
  parentId: null
  text: "买年货"
  │
  ├── todo_id: "todo_xxx_sub1"
  │     parentId: "todo_xxx_root"
  │     text: "买零食"
  │     │
  │     └── todo_id: "todo_xxx_sub1_1"
  │           parentId: "todo_xxx_sub1"
  │           text: "洽洽原味瓜子"
  │
  └── todo_id: "todo_xxx_sub2"
        parentId: "todo_xxx_root"
        text: "买春联"
```

**重要**：子待办创建时自动从父待办继承 `setDate`、`setTime`、`priority`、`comboId`，无需手动传入。

---

## 3. TypeScript 类型定义

```typescript
// ====== 待办核心类型 ======
export interface Todo {
  id: string               // todo_id，如 "todo_1720000000000_abc123"
  todoId?: string          // 同 id，部分场景备用
  userId: number
  text: string             // 内容（最大 200 字）
  setDate?: string         // "YYYY-MM-DD"
  setTime?: string         // "HH:mm"
  remarks?: string
  locationText?: string
  location?: {
    name: string
    address: string
    latitude: number
    longitude: number
  } | null
  completed: number        // 0=未完成，时间戳(ms)=完成时间
  isStar: boolean
  priority?: string        // "p1" | "p2" | "p3" | "p4"
  tags?: number[]          // 标签 ID 数组
  images?: string[]
  version: number          // 乐观锁版本号
  isDeleted: boolean
  comboId?: number
  parentId?: string        // null=根待办，有值=子待办
  time: number             // 创建时间戳(ms)
  createdAt?: string       // ISO 格式
  updatedAt?: number       // 更新时间戳(ms)
}

/** 子待办输入（创建/更新时传入，支持无限嵌套） */
export interface SubtaskInput {
  id?: string              // 编辑已有子待办时传入，新建不传
  text: string
  completed?: boolean      // 更新时可选
  subtasks?: SubtaskInput[] // 递归嵌套
}

/** 写入待办时的请求体 */
export type TodoWriteInput = Partial<Omit<Todo, 'tags' | 'parentId'>> & {
  tagIds?: number[]
  subtasks?: SubtaskInput[]
  location?: { name: string; address: string; latitude: number; longitude: number } | null
  /** 后端使用 snake_case parent_id（唯一不一致的字段） */
  parent_id?: string | null
}

// ====== API 响应类型 ======
export interface TodoListResponse {
  success: boolean
  todos: Todo[]
  total: number
  page: number
  pageSize: number
}

export interface TodoItemResponse {
  success: boolean
  todo: Todo
}

export interface TodoCreateResponse {
  success: boolean
  message: string
  todo: Todo
  subtasks?: Todo[]        // 创建子待办时返回（扁平列表）
  newSubtodos?: Todo[]     // 更新时新建的子待办（仅新建项）
}

export interface TodoDeletedResponse {
  success: boolean
  todos: Todo[]
}
```

---

## 4. API 端点详解

### 4.1 获取待办列表

```
GET /todos/list
Authorization: Bearer <token>
```

#### 查询参数

| 参数 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| `page` | number | 否 | 1 | 页码（从 1 开始） |
| `pageSize` | number | 否 | 50 | 每页条数 |
| `date` | string | 否 | — | 按到期日期筛选 `YYYY-MM-DD` |
| `completed` | string | 否 | — | `0`=未完成，`1`=已完成 |
| `search` | string | 否 | — | 关键词搜索（空格分隔多关键词） |
| `tagIds` | string | 否 | — | 标签 ID，逗号分隔 |
| `comboId` | number | 否 | — | 所属组合 ID |
| `parent_id` | string | 否 | — | **核心参数**：`null`=仅根待办，不传=仅根待办，传入 ID=获取直接子级 |
| `includeDeleted` | string | 否 | — | `true`=包含已删除 |

**重要**：`parent_id` 不传或传 `null` 时，后端默认 `WHERE parent_id IS NULL`——即只返回根级待办。获取子待办必须显式传入父待办的 `id`。

#### 请求样例

```
GET /todos/list?page=1&pageSize=50&date=2026-07-13&completed=0
```

#### 响应

```json
{
  "success": true,
  "todos": [
    {
      "id": "todo_1720000000000_abc123",
      "text": "买年货",
      "completed": 0,
      "priority": "p1",
      "setDate": "2026-07-13",
      "parentId": null,
      "comboId": null,
      "isStar": false,
      "version": 3,
      "tags": [1, 2],
      "remarks": "过年前准备好",
      "time": 1720000000000,
      "createdAt": "2026-07-13T10:00:00.000Z",
      "updatedAt": 1720000100000
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 50
}
```

#### Web 前端集成示例（React + Zustand）

```typescript
// stores/todoStore.ts
import { create } from 'zustand'
import { todosApi } from '@/api/todos'
import type { Todo } from '@/types'

interface TodoState {
  todos: Todo[]
  subtaskMap: Record<string, Todo[]>  // parentId -> children
  loading: boolean

  fetchTodos: (filters?: { date?: string; completed?: 0 | 1 }) => Promise<void>
  fetchSubtodos: (parentId: string) => Promise<void>
}

export const useTodoStore = create<TodoState>((set, get) => ({
  todos: [],
  subtaskMap: {},
  loading: false,

  fetchTodos: async (filters) => {
    set({ loading: true })
    try {
      const allTodos: Todo[] = []
      let page = 1
      const pageSize = 100
      while (true) {
        // parent_id 不传 → 仅根待办
        const res = await todosApi.getList({ page, pageSize, ...filters })
        const batch = res.todos || []
        allTodos.push(...batch)
        if (allTodos.length >= (res.total || 0) || batch.length < pageSize) break
        page++
        if (page > 20) break  // 安全上限
      }
      set({ todos: allTodos })
    } finally {
      set({ loading: false })
    }
  },

  fetchSubtodos: async (parentId) => {
    // 显式传入 parent_id → 获取该父待办的直接子级
    const res = await todosApi.getList({ parent_id: parentId })
    set({
      subtaskMap: {
        ...get().subtaskMap,
        [parentId]: res.todos || [],
      },
    })
  },
}))

// 使用示例（React 组件）
function TodoDetail({ todoId }: { todoId: string }) {
  const subtasks = useTodoStore((s) => s.subtaskMap[todoId])
  const fetchSubtodos = useTodoStore((s) => s.fetchSubtodos)

  useEffect(() => {
    if (todoId) fetchSubtodos(todoId)
  }, [todoId])

  return (
    <div className="subtask-list">
      <p className="progress">{subtasks?.filter(t => t.completed).length} / {subtasks?.length} 已完成</p>
      {subtasks?.map(st => (
        <div key={st.id} className="subtask-item">
          <input type="checkbox" checked={!!st.completed} readOnly />
          <span>{st.text}</span>
        </div>
      ))}
    </div>
  )
}
```

#### 小程序对接示例

```javascript
// 小程序 getList 调用
wx.request({
  url: 'https://api.yzjtiantian.cn/todos/list',
  method: 'GET',
  header: {
    'Authorization': 'Bearer ' + wx.getStorageSync('authToken')
  },
  data: {
    page: 1,
    pageSize: 50,
    date: '2026-07-13',
    completed: 0
    // parent_id 不传 → 仅根待办
  },
  success: (res) => {
    if (res.data.success) {
      const todos = res.data.todos    // 根级待办列表
      const total = res.data.total    // 总数
    }
  }
})

// 获取子待办
wx.request({
  url: 'https://api.yzjtiantian.cn/todos/list',
  method: 'GET',
  header: {
    'Authorization': 'Bearer ' + wx.getStorageSync('authToken')
  },
  data: {
    parent_id: 'todo_1720000000000_abc123'  // 父待办 ID
  },
  success: (res) => {
    if (res.data.success) {
      const subtasks = res.data.todos  // 直接子待办列表
    }
  }
})
```

---

### 4.2 创建待办

```
POST /todos/create
Authorization: Bearer <token>
Content-Type: application/json
```

#### 请求字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `text` | string | 是 | 待办内容（最大 200 字） |
| `priority` | string | 否 | `p1`~`p4`，默认 `p2` |
| `setDate` | string | 否 | `YYYY-MM-DD` |
| `setTime` | string | 否 | `HH:mm` |
| `comboId` | number | 否 | 所属组合 ID |
| `parentId` / `parent_id` | string | 否 | 父待办 ID（创建子待办时传入） |
| `remarks` | string | 否 | 备注 |
| `tagIds` | number[] | 否 | 标签 ID 数组 |
| `isStar` | boolean | 否 | 是否星标 |
| `images` | string[] | 否 | 图片 URL 数组 |
| `location` | object | 否 | `{ name, address, latitude, longitude }` |
| `subtasks` | SubtaskInput[] | 否 | **嵌套子待办**（见下方说明） |

> 不传 `subtasks` 或传空数组时行为一致，仅创建单条待办。

#### 请求样例（含子待办）

```json
{
  "text": "买年货",
  "priority": "p1",
  "setDate": "2026-07-13",
  "comboId": null,
  "tagIds": [1, 2],
  "remarks": "过年前准备好",
  "subtasks": [
    {
      "text": "买零食",
      "subtasks": [
        { "text": "洽洽原味瓜子" },
        { "text": "焦糖味瓜子" }
      ]
    },
    {
      "text": "买春联"
    }
  ]
}
```

#### 响应（含子待办）

```json
{
  "success": true,
  "message": "待办创建成功",
  "todo": {
    "id": "todo_1720000000000_abc123",
    "text": "买年货",
    "parentId": null,
    "completed": 0,
    "priority": "p1",
    "setDate": "2026-07-13",
    "comboId": null,
    "tags": [1, 2],
    "remarks": "过年前准备好",
    "version": 1,
    "isStar": false,
    "time": 1720000000000,
    "createdAt": "2026-07-13T10:00:00.000Z",
    "updatedAt": 1720000000000
  },
  "subtasks": [
    {
      "id": "todo_1720000000000_def456",
      "text": "买零食",
      "parentId": "todo_1720000000000_abc123",
      "completed": 0,
      "priority": "p1",
      "version": 1
    },
    {
      "id": "todo_1720000000000_ghi789",
      "text": "洽洽原味瓜子",
      "parentId": "todo_1720000000000_def456",
      "completed": 0,
      "priority": "p1",
      "version": 1
    },
    {
      "id": "todo_1720000000000_jkl012",
      "text": "焦糖味瓜子",
      "parentId": "todo_1720000000000_def456",
      "completed": 0,
      "priority": "p1",
      "version": 1
    },
    {
      "id": "todo_1720000000000_mno345",
      "text": "买春联",
      "parentId": "todo_1720000000000_abc123",
      "completed": 0,
      "priority": "p1",
      "version": 1
    }
  ]
}
```

**注意**：
- `subtasks` 是**扁平列表**，包含所有层级的子待办。
- 前端需**缓存返回的 `id`**，后续编辑时必须传入这些 `id` 来引用已有子待办。
- 后端自动继承 `setDate`、`setTime`、`priority`、`comboId` 到所有子待办。

#### Web 前端集成示例

```typescript
// stores/todoStore.ts（追加到前面的 store）
createTodo: async (data: TodoWriteInput) => {
  const res = await todosApi.create(data)
  if (res.success && res.todo) {
    const newTodos = [...get().todos, res.todo]
    // 批量创建的子待办追加到列表中
    if (res.subtasks && res.subtasks.length > 0) {
      newTodos.push(...res.subtasks)
      // 缓存子待办到 subtaskMap
      set({
        subtaskMap: {
          ...get().subtaskMap,
          [res.todo.id]: res.subtasks.filter(st => st.parentId === res.todo.id),
        },
      })
    }
    set({ todos: newTodos })
    return res.todo
  }
  throw new Error(res.message || '创建失败')
}

// 组件中创建待办
async function handleCreate() {
  const newTodo = await useTodoStore.getState().createTodo({
    text: '买年货',
    priority: 'p1',
    subtasks: [
      { text: '买零食', subtasks: [{ text: '洽洽原味瓜子' }] },
      { text: '买春联' },
    ],
  })
  console.log('创建成功:', newTodo.id)
}
```

#### 小程序对接示例

```javascript
// 生成 todo_id（小程序端）
function generateTodoId() {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 11)
  return `todo_${timestamp}_${random}`
}

// 创建待办（含子待办）
wx.request({
  url: 'https://api.yzjtiantian.cn/todos/create',
  method: 'POST',
  header: {
    'Authorization': 'Bearer ' + wx.getStorageSync('authToken'),
    'Content-Type': 'application/json'
  },
  data: {
    text: '买年货',
    priority: 'p1',
    setDate: '2026-07-13',
    subtasks: [
      { text: '买零食', subtasks: [{ text: '洽洽原味瓜子' }] },
      { text: '买春联' }
    ]
  },
  success: (res) => {
    const { todo, subtasks } = res.data
    // todo.id — 父待办 ID
    // subtasks — 所有子待办（扁平列表）
    // 前端存储到本地
    saveTodo(todo)
    subtasks.forEach(st => saveTodo(st))
  }
})
```

---

### 4.3 获取待办详情

```
GET /todos/:id
Authorization: Bearer <token>
```

#### 请求样例

```
GET /todos/todo_1720000000000_abc123
```

#### 响应

```json
{
  "success": true,
  "todo": {
    "id": "todo_1720000000000_abc123",
    "text": "买年货",
    "parentId": null,
    "completed": 0,
    "priority": "p1",
    "version": 3,
    "tags": [1, 2],
    "time": 1720000000000,
    "updatedAt": 1720000100000
  }
}
```

**注意**：该接口不返回子待办列表。如需获取子待办，请使用 `GET /todos/list?parent_id={id}`。

---

### 4.4 更新待办

```
PUT /todos/:id
Authorization: Bearer <token>
Content-Type: application/json
```

#### 请求字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `text` | string | 否 | 新内容 |
| `completed` | boolean | 否 | `true`=完成，`false`=取消完成 |
| `priority` | string | 否 | `p1`~`p4` |
| `setDate` | string | 否 | `YYYY-MM-DD` |
| `setTime` | string | 否 | `HH:mm` |
| `remarks` | string | 否 | 备注 |
| `tagIds` | number[] | 否 | 标签 ID 数组 |
| `comboId` | number | 否 | 所属组合 ID |
| `parentId` / `parent_id` | string | 否 | 移动到新父待办 |
| `isStar` | boolean | 否 | 星标 |
| `version` | number | 否 | **乐观锁版本号**，从 `todo.version` 获取 |
| `subtasks` | SubtaskInput[] | 否 | **子待办全量替换**（见下方说明） |

#### 请求样例（仅更新文本和优先级）

```json
{
  "text": "买年货（更新版）",
  "priority": "p2",
  "version": 3
}
```

#### 请求样例（含子待办全量替换）

```json
{
  "text": "买年货",
  "version": 3,
  "subtasks": [
    {
      "id": "todo_1720000000000_def456",
      "text": "买更多零食（编辑了文字）",
      "completed": true
    },
    {
      "text": "全新的子待办（没有id，新建的）",
      "subtasks": [
        { "text": "新子待办的嵌套" }
      ]
    }
  ]
}
```

#### 响应（含子待办操作）

```json
{
  "success": true,
  "message": "待办更新成功",
  "todo": {
    "id": "todo_1720000000000_abc123",
    "text": "买年货",
    "version": 4
  },
  "newSubtodos": [
    {
      "id": "todo_1720000000000_pqr678",
      "text": "全新的子待办",
      "parentId": "todo_1720000000000_abc123",
      "completed": 0,
      "version": 1
    }
  ]
}
```

> `newSubtodos` 仅在本次请求确实创建了新子待办时出现。更新已有子待办不会出现在此数组中。

#### 子待办更新语义（重要）

```
subtasks 数组 = 当前父待办下所有子待办的完整列表

后端自动计算差异：

  ┌─ 有 id → 更新已有子待办
  │
  ├─ 无 id → 创建新子待办
  │
  └─ 数据库中存在但请求中未出现 → 递归软删除（含所有后代）
```

**前端必须把完整子树传回**，否则不在列表中的子待办会被删除。

#### Web 前端集成示例

```typescript
// 更新待办（含子待办全量替换）
async function handleUpdateSubtasks(parentId: string, subtasks: SubtaskInput[]) {
  const todo = useTodoStore.getState().todos.find(t => t.id === parentId)
  await todosApi.update(parentId, {
    version: (todo?.version || 1) + 1,
    updatedAt: Date.now(),
    subtasks,  // 传入完整子树
  })
  // 刷新子待办缓存
  await useTodoStore.getState().fetchSubtodos(parentId)
}

// 添加单个子待办
async function handleAddSubtask(parentId: string, text: string) {
  const existing = useTodoStore.getState().subtaskMap[parentId] || []
  await handleUpdateSubtasks(parentId, [
    ...existing.map(st => ({
      id: st.id,
      text: st.text,
      completed: !!st.completed,
    })),
    { text },  // 新增
  ])
}

// 切换子待办完成状态
async function handleToggleSubtask(subtask: Todo) {
  const parentId = subtask.parentId!
  const siblings = useTodoStore.getState().subtaskMap[parentId] || []
  await handleUpdateSubtasks(parentId, siblings.map(st =>
    st.id === subtask.id
      ? { id: st.id, text: st.text, completed: !st.completed }
      : { id: st.id, text: st.text, completed: !!st.completed }
  ))
}
```

#### 小程序对接示例

```javascript
// 更新子待办列表（全量替换）
wx.request({
  url: 'https://api.yzjtiantian.cn/todos/todo_1720000000000_abc123',
  method: 'PUT',
  header: {
    'Authorization': 'Bearer ' + wx.getStorageSync('authToken'),
    'Content-Type': 'application/json'
  },
  data: {
    version: 3,
    subtasks: [
      { id: 'todo_xxx_def456', text: '买更多零食', completed: true },
      { text: '全新子待办' }
    ]
  },
  success: (res) => {
    if (res.data.success) {
      const { todo, newSubtodos } = res.data
      // newSubtodos 包含新建的子待办（需缓存 id）
      newSubtodos?.forEach(st => saveTodo(st))
    }
  }
})
```

---

### 4.5 删除待办

```
DELETE /todos/:id
Authorization: Bearer <token>
```

删除待办时**递归软删除所有后代**（子待办、孙待办……），不会产生飘零数据。

#### 响应

```json
{
  "success": true,
  "message": "删除成功"
}
```

#### Web 前端集成示例

```typescript
// 删除待办
async function handleDelete(id: string) {
  const todo = useTodoStore.getState().todos.find(t => t.id === id)
  // 如果有子待办，提示用户
  if (todo && useTodoStore.getState().subtaskMap[id]?.length > 0) {
    const confirmed = window.confirm('删除后所有子待办将一并删除，确认？')
    if (!confirmed) return
  }
  await useTodoStore.getState().deleteTodo(id)
}
```

---

### 4.6 批量获取待办

```
POST /todos/batch
Authorization: Bearer <token>
Content-Type: application/json
```

#### 请求

```json
{
  "ids": ["todo_1720000000000_abc123", "todo_1720000000000_def456"]
}
```

#### 响应

```json
{
  "success": true,
  "todos": [
    { "id": "todo_1720000000000_abc123", "text": "买年货", ... },
    { "id": "todo_1720000000000_def456", "text": "买零食", ... }
  ]
}
```

---

### 4.7 批量移动待办

```
POST /todos/batch-move
Authorization: Bearer <token>
Content-Type: application/json
```

#### 请求

```json
{
  "todoIds": ["todo_1720000000000_abc123", "todo_1720000000000_def456"],
  "comboId": null
}
```

`comboId: null` 表示移出组合（变为无组合待办）。`comboId: 5` 表示移动到 ID 为 5 的组合。

---

### 4.8 数据同步

待办系统采用**离线优先**架构，数据以客户端本地存储为主，云端为备份和跨设备同步层。

#### 增量同步 `POST /todos/sync`

```
POST /todos/sync
Authorization: Bearer <token>
Content-Type: application/json
```

**请求：**

```json
{
  "localChanges": [
    {
      "todo_id": "todo_1720000000000_abc123",
      "text": "买年货",
      "completed": 0,
      "version": 3,
      "updatedAt": 1720000100000,
      "parentId": null,
      "setDate": "2026-07-13",
      "priority": "p1",
      "tags": "[1,2]",
      "isStar": false,
      "isDeleted": false,
      "time": 1720000000000
    }
  ],
  "localDeletedIds": ["todo_1720000000000_def456"],
  "lastSyncTime": "2026-07-12T10:00:00.000Z"
}
```

**响应：**

```json
{
  "success": true,
  "cloudChanges": [
    {
      "todo_id": "todo_1720000000000_ghi789",
      "text": "远端新建的待办",
      "completed": 0,
      "version": 1,
      "updatedAt": 1720050000000
    }
  ],
  "cloudDeletedIds": ["todo_1720000000000_jkl012"],
  "syncedAt": "2026-07-13T10:00:00.000Z"
}
```

#### 全量同步 `GET /todos/full-sync`

```
GET /todos/full-sync?page=1&pageSize=500
```

首次同步或增量同步出错时的回退方案。返回用户所有待办（含已删除）。

#### Web 前端同步策略示例

```typescript
// 同步服务
class SyncService {
  private lastSyncAt: string | null = null

  async incrementalSync() {
    const localChanges = this.getLocalChanges()
    const localDeletedIds = this.getLocalDeletedIds()

    const res = await todosApi.sync({
      localChanges,
      localDeletedIds,
      lastSyncAt: this.lastSyncAt,
    })

    if (res.success) {
      // 合并云端变更到本地
      this.mergeCloudChanges(res.cloudChanges, res.cloudDeletedIds)
      this.lastSyncAt = res.syncedAt
    }
  }

  private getLocalChanges() {
    // 读取本地 storage 中 lastSyncAt 之后变更的数据
  }

  private mergeCloudChanges(changes: Todo[], deletedIds: string[]) {
    const store = useTodoStore.getState()
    // 冲突解决：保留 updatedAt 较新的版本
    const mergedTodos = store.todos.map(local => {
      const cloud = changes.find(c => c.todoId === local.id)
      if (cloud && (cloud.updatedAt || 0) > (local.updatedAt || 0)) {
        return { ...local, ...cloud }
      }
      return local
    })
    // 添加云端新建的待办
    changes.forEach(c => {
      if (!mergedTodos.find(t => t.id === c.todoId)) {
        mergedTodos.push(c as unknown as Todo)
      }
    })
    // 移除已删除的
    set({ todos: mergedTodos.filter(t => !deletedIds.includes(t.id)) })
  }
}
```

---

### 4.9 回收站操作

#### 获取已删除列表

```
GET /todos/deleted
Authorization: Bearer <token>
```

返回 30 天内的软删除待办（含所有后代）。

```json
{
  "success": true,
  "todos": [
    { "id": "todo_xxx", "text": "已删除的待办", "isDeleted": true, "deletedAt": "..." }
  ]
}
```

#### 恢复

```
POST /todos/restore/:todoId
Authorization: Bearer <token>
```

#### 永久删除

```
DELETE /todos/permanent/:todoId
Authorization: Bearer <token>
```

---

## 5. 子待办更新语义详解

### 5.1 全量替换模式

更新待办的 `subtasks` 字段使用**全量替换（full replacement）** 语义，而非增量 patch。

```
前端传入: [A, B, C]          ← 当前想要的完整列表
数据库现有: [A, B, D, E]      ← 数据库中已有的子待办

后端处理:
  A: 已有 ID → 更新
  B: 已有 ID → 更新
  C: 无 ID   → 新建
  D: 在 DB 但不在请求中 → 递归软删除（含后代）
  E: 在 DB 但不在请求中 → 递归软删除（含后代）

最终数据库: [A_updated, B_updated, C_new]
```

### 5.2 前端处理策略

```typescript
// 推荐模式：读取 → 修改 → 全量写入
async function editSubtask(parentId: string, subtaskId: string, newText: string) {
  const store = useTodoStore.getState()
  const parent = store.todos.find(t => t.id === parentId)
  const children = store.subtaskMap[parentId] || []

  // 1. 读取当前完整子树
  const currentSubtasks: SubtaskInput[] = children.map(st => ({
    id: st.id,
    text: st.text,
    completed: !!st.completed,
    subtasks: st.parentId === st.id ? undefined : [],  // 嵌套处理略
  }))

  // 2. 修改目标子待办
  const updated = currentSubtasks.map(st =>
    st.id === subtaskId ? { ...st, text: newText } : st
  )

  // 3. 全量写入
  await todosApi.update(parentId, {
    version: (parent?.version || 1) + 1,
    updatedAt: Date.now(),
    subtasks: updated,
  })

  // 4. 刷新缓存
  await store.fetchSubtodos(parentId)
}

// 简化的"添加一个子待办"模式
async function addOneSubtask(parentId: string, text: string) {
  const store = useTodoStore.getState()
  const parent = store.todos.find(t => t.id === parentId)
  const children = store.subtaskMap[parentId] || []

  // 保留现有 + 追加新的
  await todosApi.update(parentId, {
    version: (parent?.version || 1) + 1,
    subtasks: [
      ...children.map(st => ({ id: st.id, text: st.text, completed: !!st.completed })),
      { text },  // 无 id → 新建
    ],
  })

  await store.fetchSubtodos(parentId)
}
```

### 5.3 常见错误

| 错误场景 | 问题 | 正确做法 |
|----------|------|----------|
| 只传新子待办，忘了传已有的 | 已有子待办被软删除 | 每次全量替换 |
| 编辑子待办时没传 `completed` | 完成状态被重置为 `false` | 传入完整字段 |
| 更新时没传 `version` | 乐观锁不生效，可能有数据覆盖 | 从 `todo.version` 获取 |
| 修改子待办后未刷新 `subtaskMap` | 界面显示旧数据 | 调用 `fetchSubtodos` |
| 传入的 `subtasks` 为空数组 | 所有子待办被删除 | 不传 `subtasks` 字段 |

---

## 6. Web 前端集成最佳实践

### 6.1 Zustand Store 推荐模式

```typescript
// stores/todoStore.ts — 完整结构

interface TodoState {
  // 数据
  todos: Todo[]
  subtaskMap: Record<string, Todo[]>  // parentId → [children]
  deletedTodos: Todo[]
  loading: boolean

  // 列表操作
  fetchTodos: (filters?: TodoListFilters) => Promise<void>
  fetchSubtodos: (parentId: string) => Promise<void>

  // 写入操作
  createTodo: (data: TodoWriteInput) => Promise<Todo>
  updateTodo: (id: string, data: TodoWriteInput) => Promise<void>
  deleteTodo: (id: string) => Promise<void>
  toggleComplete: (id: string) => Promise<void>
  toggleStar: (id: string) => Promise<void>

  // 批量操作
  batchMove: (todoIds: string[], comboId: number | null) => Promise<void>

  // 回收站
  restoreTodo: (id: string) => Promise<void>
  permanentDelete: (id: string) => Promise<void>
  fetchDeleted: () => Promise<void>
}
```

### 6.2 subtaskMap 缓存策略

`subtaskMap` 按需加载，不在初始化时全量拉取：

```typescript
// ✅ 正确：惰性加载
function SubtaskSection({ parentId }: { parentId: string }) {
  const subtasks = useTodoStore(s => s.subtaskMap[parentId])
  const fetchSubtodos = useTodoStore(s => s.fetchSubtodos)

  useEffect(() => {
    if (!subtasks) {
      fetchSubtodos(parentId)  // 首次展开时才加载
    }
  }, [parentId])

  if (!subtasks) return <Skeleton />  // 加载状态
  return <SubtaskList items={subtasks} />
}

// 用于计算进度
function SubtaskProgress({ parentId }: { parentId: string }) {
  const subtasks = useTodoStore(s => s.subtaskMap[parentId]) || []
  const done = subtasks.filter(t => t.completed).length
  return <span>{done}/{subtasks.length}</span>
}
```

### 6.3 乐观更新与错误回滚

```typescript
async function optimisticToggleComplete(id: string) {
  const store = useTodoStore.getState()
  const prevTodos = store.todos  // 保存快照用于回滚

  // 乐观更新 UI
  store.updateTodoState(id, {
    completed: Date.now(),
    updatedAt: Date.now(),
    version: store.todos.find(t => t.id === id)!.version + 1,
  })

  try {
    await todosApi.update(id, {
      completed: Date.now(),
      version: prevTodos.find(t => t.id === id)!.version + 1,
    })
  } catch (err) {
    // 回滚
    store.setTodos(prevTodos)
    console.error('同步失败，已回滚', err)
  }
}
```

### 6.4 版本号冲突处理（409）

```typescript
async function handleVersionConflict(err: any, id: string, retryData: TodoWriteInput) {
  if (err.response?.status === 409) {
    // 服务端返回最新版本信息
    const { currentVersion, serverData } = err.response.data
    console.warn(`版本冲突：本地=${retryData.version}，服务端=${currentVersion}`)

    // 提示用户或自动合并
    const merged = window.confirm(
      `待办已被其他设备修改，是否刷新后重试？`
    )

    if (merged) {
      // 用服务端数据覆盖本地，再重新提交
      await useTodoStore.getState().fetchTodos()
      return todosApi.update(id, {
        ...retryData,
        version: currentVersion,
      })
    }
  }
  throw err
}
```

---

## 7. 附录：完整数据流示例

### 7.1 创建含子待办的待办 → 查询列表 → 更新子待办 → 删除

#### Step 1: 创建

```
POST /todos/create
{
  "text": "网站重构",
  "priority": "p1",
  "tagIds": [1],
  "subtasks": [
    { "text": "重构 API 层", "subtasks": [
        { "text": "设计接口规范" },
        { "text": "实现 Controller" }
    ]},
    { "text": "重构前端页面" }
  ]
}
```
```
响应: {
  "todo": { "id": "todo_100_a1", "text": "网站重构", ... },
  "subtasks": [
    { "id": "todo_100_b1", "text": "重构 API 层", "parentId": "todo_100_a1" },
    { "id": "todo_100_c1", "text": "设计接口规范", "parentId": "todo_100_b1" },
    { "id": "todo_100_c2", "text": "实现 Controller", "parentId": "todo_100_b1" },
    { "id": "todo_100_b2", "text": "重构前端页面", "parentId": "todo_100_a1" }
  ]
}
```

#### Step 2: 查询根待办

```
GET /todos/list
```
```
响应: { "todos": [{"id":"todo_100_a1","text":"网站重构",...}], "total": 1 }
```

#### Step 3: 查询子待办

```
GET /todos/list?parent_id=todo_100_a1
```
```
响应: {
  "todos": [
    {"id":"todo_100_b1","text":"重构 API 层","parentId":"todo_100_a1","completed":0},
    {"id":"todo_100_b2","text":"重构前端页面","parentId":"todo_100_a1","completed":0}
  ],
  "total": 2
}
```

#### Step 4: 更新子待办（标记"重构 API 层"完成，新增一个子待办）

```
PUT /todos/todo_100_a1
{
  "version": 1,
  "subtasks": [
    { "id": "todo_100_b1", "text": "重构 API 层", "completed": true,
      "subtasks": [
        { "id": "todo_100_c1", "text": "设计接口规范", "completed": true },
        { "id": "todo_100_c2", "text": "实现 Controller", "completed": true }
      ]
    },
    { "id": "todo_100_b2", "text": "重构前端页面" },
    { "text": "编写测试" }   // 新建
  ]
}
```

#### Step 5: 删除待办（级联删除所有子待办）

```
DELETE /todos/todo_100_a1
```
```
响应: { "success": true, "message": "删除成功" }
```

---

### 7.2 常见 HTTP 状态码速查

| 状态码 | 含义 | 处理方式 |
|--------|------|----------|
| 200 | 成功 | 正常处理 |
| 400 | 参数错误 | 检查请求字段格式 |
| 401 | Token 过期/无效 | 跳转登录页 |
| 403 | 无权限 | 提示用户无操作权限 |
| 404 | 待办不存在 | 提示"待办已删除" |
| 409 | 版本冲突 | 刷新后重试或合并 |
| 500 | 服务端错误 | 提示"系统繁忙，请稍后重试" |

---

> **更新记录**
>
> | 日期 | 更新内容 |
> |------|----------|
> | 2026-07-13 | 初稿，基于后端 `todoController.js` 1,344 行实现编写 |
