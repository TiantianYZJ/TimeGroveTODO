# 🌿 时光绿径待办 (TimeGreen Path Todo)

A full-featured todo mini-program for WeChat, backed by a Node.js/Express API. Designed for both personal task management and team collaboration.

> Search "时光绿径待办" in WeChat to try the live version.

---

## Features

**Core**
- Create/complete/edit/delete todos with dates, times, locations, tags, images, and priority
- Drag-and-drop reordering
- Voice input via WeChat speech recognition
- Filter by tag and combo (folder)
- Calendar view with dot markers for each day's tasks
- Dark green theme with custom navigation bar

**Combo (Folder) System**
- Group todos into combos for organization
- Share combos with other users for collaboration
- Role-based access (owner / admin / member) with join approval flow

**Shared Todos & Collaboration**
- Assign shared todos to specific members
- Three completion modes: all members, any member, or a designated member
- Real-time comments on shared todos

**Offline-First Sync**
- Local Storage as primary data source, async sync to backend
- Timestamp-based conflict resolution with merge strategy
- Incremental sync (diff-based) by default, with full-sync fallback

**Community**
- Post system with images, likes, comments, @mentions
- Polls (multi-option voting, anonymous mode)
- Combo posts (share combo progress to community)
- Report system for moderation

**Extras**
- Daily check-in with streak tracking and leaderboard
- Work reports with customizable templates & report board
- Stats & charts (daily, weekly, monthly)
- Share todo snapshots via links with optional password
- Password generator, random lunch picker, motivational quotes
- Admin panel with user management and analytics
- Trash (soft-delete with restore)
- Tag management with colors and icons

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | WeChat Mini Program (native: WXML + WXSS + JS) |
| UI Kit | [TDesign Miniprogram](https://tdesign.tencent.com/miniprogram/) |
| Calendar | [@lspriv/wx-calendar](https://github.com/lspriv/wx-calendar) |
| Charts | ec-canvas (ECharts wrapper) |
| Backend | Node.js + Express.js (ECS: 2C2G) |
| Database | MySQL 5.5.62 |
| Auth | WeChat OAuth + JWT |
| Notifications | WeChat Template Messages |
| Image Hosting | Third-party image bed (60-day auto-cleanup) |

> ⚠️ MySQL 5.5 has no JSON column type and only one TIMESTAMP with `CURRENT_TIMESTAMP` — the backend uses TEXT columns for serialized data. See `backend/migrations/` for workaround patterns.

---

## Architecture

```
WeChat Mini Program  ←→  HTTP/JSON  ←→  Express.js API (ECS)  ←→  MySQL 5.5
                                              ↑
                                        website/ (Vite+React, in development)
```

**Backend routes:** `/auth`, `/todos`, `/tags`, `/combos`, `/collab`, `/notify`, `/upload`, `/config`, `/admin`, `/comments`, `/share`, `/posts`, `/likes`, `/post-comments`, `/reports`, `/users`, `/checkin`, `/work-reports`, `/files`, `/polls`

**Database tables (24):** `users`, `todos`, `tags`, `todo_tags`, `combos`, `combo_items`, `collab_todos`, `collab_members`, `collab_messages`, `posts`, `post_likes`, `post_images`, `post_comments`, `comment_likes`, `notices`, `changelogs`, `reports`, `qr_sessions`, `share_snapshots`, `share_visitors`, `checkin_logs`, `work_reports`, `report_templates`, `sync_logs`, `files`

---

## Project Structure

```
├── app.js                     # Mini program entry: auth, sync, nav bar, config
├── app.json                   # Pages, subPackages, preload rules, tab bar
├── pages/                     # Main tab pages (todo, calendar, stats, more)
├── packageCombo/              # Combo system (detail, edit, collab, stats)
├── packageCommunity/          # Community (post detail, post edit)
├── packageAdmin/              # Admin panel
├── packageTools/              # Utilities (trash, password gen, etc.)
├── packagePages/              # Feature pages (login, add-todo, checkin, etc.)
├── packageProfile/            # User profile
├── utils/                     # Shared frontend utilities
│   ├── api.js                 # API client (19 domain modules)
│   ├── sync.js                # Offline sync engine
│   ├── util.js                # Date/time formatting
│   └── logger.js              # Frontend logger (env-aware sampling)
├── backend/                   # Express.js server
│   ├── app.js                 # Server entry, mounts 22 route groups
│   ├── config/database.js     # MySQL connection pool
│   ├── middleware/auth.js      # JWT auth, optionalAuth, isAdmin
│   ├── controllers/           # 22 controllers
│   ├── routes/                # 22 route files
│   ├── services/              # wechatService, qrcodeSession, fileCleanup
│   ├── migrations/            # 35+ incremental SQL migrations
│   └── utils/                 # logger, ipLocator, checkinBadgeHelper
└── website/                   # Web version (Vite + React, WIP)
```

---

## Quick Start

### Prerequisites

- [WeChat Developer Tools](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
- Node.js 16+
- MySQL 5.5

### Mini Program

1. Open the project root in WeChat Developer Tools
2. `project.config.json` is pre-configured — just run

### Backend

```bash
cd backend
npm install

# Create .env file with:
# DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
# JWT_SECRET, WECHAT_APPID, WECHAT_SECRET

# Run migrations (import in numeric order from backend/migrations/)
# Import initial schema from database.sql

npm start        # Production (port 3000)
npm run dev      # Development with nodemon
```

### Web Version (WIP)

```bash
cd website
npm install
npm run dev      # Vite dev server
```

---

## Key Technical Details

- **No DOM**: WeChat Mini Program uses data binding only — no direct DOM manipulation
- **Offline sync**: Each todo stored as `todo_{id}` in `wx.getStorageSync()`. Index maintained in `todos_index`. Start-up diff sync reduces bandwidth
- **Collab permissions**: owner / admin / member roles with custom approval flow
- **Auto-cleanup**: Share snapshots expire after 60 days; unused uploaded images cleaned periodically
- **Frontend logger**: Env-aware sampling (DEBUG dev / INFO trial / WARN production), ERRORs batch-reported to backend

---

## What's Incomplete

- Web version (Vite + React) — functional but not live
- Dark mode — entire design system is light-only; substantial rework needed
- Notification retry — currently one-shot push, no retry on failure
- Tests — no test suite implemented yet

---

## License

GPL v3
