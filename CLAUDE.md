# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**时光绿径待办 (TimeGreen Path Todo)** — WeChat Mini Program todo app with Node.js/Express backend and MySQL 5.5. Features: todo CRUD with drag-and-drop, combo (folder) system with collaboration/shared todos, calendar, voice input, charts, community posts, check-in, work reports, admin panel, offline-first sync.

## Architecture

```
WeChat Mini Program  ←→  HTTP/JSON  ←→  Express.js API (ECS)  ←→  MySQL 5.5
                                              ↑
                                        website/ (Vite+React, WIP)
```

Backend on port 3000. MySQL 5.5 — no JSON column support, only one TIMESTAMP with `CURRENT_TIMESTAMP`. Migrations at `backend/migrations/`.

## Commands

```bash
# Backend
cd backend
npm install
npm run dev              # nodemon on port 3000
npm start                # production

# Backend .env required: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET, WECHAT_APPID, WECHAT_SECRET

# Web version (Vite+React, WIP)
cd website
npm install
npm run dev

# Miniprogram: open root in WeChat Developer Tools (project.config.json is pre-configured)
```

## Key Patterns

### API Response Format
All backend endpoints return: `{ success: boolean, data?: any, message?: string }`

### Auth
- Frontend: JWT stored in `wx.getStorageSync('authToken')`, sent as `Authorization: Bearer <token>`
- Backend: `authMiddleware` (required) / `optionalAuth` (attaches user if token present) / `isAdmin`
- Token expiry: 7 days via `jsonwebtoken`
- Backend middleware at `backend/middleware/auth.js`

### Frontend API Client (`utils/api.js`)
Centralized `request()` wrapper around `wx.request()`. Exports 19 domain modules:
`authApi`, `todosApi`, `tagsApi`, `combosApi`, `collabApi`, `notifyApi`, `configApi`, `adminApi`, `commentsApi`, `shareApi`, `communityApi`, `userApi`, `checkinApi`, `workReportApi`, `reportTemplateApi`

All auto-attach JWT, handle 401 → login redirect, handle 403 → permission error.

### Offline Sync (`utils/sync.js`)
- Each todo stored as individual `todo_{id}` in `wx.getStorageSync()`
- Index maintained in `todos_index` key
- Sync strategies: `incremental` (default, diff-based), `full` (fallback), `cloud-wins`, `local-wins`
- Timestamp-based conflict resolution via `mergeChanges()`
- Legacy migration from old array-based storage to per-todo key-value

### Backend Structure
- `backend/app.js` mounts 22 route groups via `app.use('/prefix', routeModule)`
- Each route file creates an `express.Router()`, imports controller, exports router
- Controllers at `backend/controllers/`, routes at `backend/routes/`
- Database access via `backend/config/database.js`: provides `query(sql, params)` and `transaction(callback)` helpers
- Connection pool: mysql2, pool size 10

### Navigation Bar
Custom component-based nav bar calculated in `app.js` onLaunch from system info + menu button bounding rect. Stored in `globalData`: `navBarHeight`, `menuTop`, `menuRight`, `menuHeight`.

### SubPackages / Preload
WeChat subPackages for code splitting. Preload rules in `app.json`:
- todo page preloads combo+pages+profile
- community-home preloads community+pages+profile
- more preloads tools

### Logging
**Frontend** (`utils/logger.js`): Global `logger` object (no import needed). Env-aware sampling: DEBUG (dev) / INFO (trial, 10%) / WARN (production, 1%). ERRORs batch-reported to `POST /log/report` every 10s. Usage: `logger.info('TODO', 'FETCH', 'message', { data })`, `logger.error('TODO', 'FETCH', 'message', err)`.

**Backend** (`backend/utils/logger.js`): Structured logger with modules (AUTH, TODO, COMBO, DB, API, SYSTEM, etc.). Usage: `logger.systemInfo('action', 'message', data)`, `logger.apiWarn('404', 'msg', data)`, `logger.dbError('query', 'msg', err)`.

### Database Conventions (MySQL 5.5)
- TEXT fields used for serialized arrays/objects (no JSON column type)
- `TIMESTAMP DEFAULT CURRENT_TIMESTAMP` — only one per table
- Migration files prefixed with numbers in `backend/migrations/`, run in order
- Internationalized strings stored in utf8mb4 charset

### Collaboration System
- Combo roles: owner / admin / member (defined in `collabController.js`)
- Join flow: send request → owner/admin approves/rejects
- Shared todo completion modes: `all` (everyone must complete), `any` (anyone completes), `assign` (specific person)
- Comments on shared todos via `/comments` endpoints

### Community System
- Posts: create, edit, delete with images/files/progress data from combos
- Polls: create, vote, close, anonymous mode (`packageCommunity/`, `controllers/pollController.js`)
- @mentions: search users via `/users/search`
- Reports: users report content, admin moderates

### Share Snapshots
- Todo snapshots shared via links with optional password
- Auto-expire after time limit (cleanup every hour via `cleanupExpiredSnapshots()`)
- Visitors tracked in `share_visitors` table
- Password stored as bcrypt hash (migration 025)

## Page Structure

| Package | Root | Pages |
|---------|------|-------|
| Main tabs | `pages/` | todo, calendar, community-home, stats, more |
| Admin | `packageAdmin/` | index, users, user-detail, notices, notice-edit, changelog, changelog-edit, reports, report-detail, admin-manage |
| Combo | `packageCombo/` | combo-edit, combo-detail, combo-posts, collaboration, combo-stats, report-board, report-templates |
| Tools | `packageTools/` | eating, password-generator, motivation, star, acknowledge, join-collab, trash, datamanage, tag-manage |
| Pages | `packagePages/` | add-todo, changelog, daily-stats, guide, login, notice, todo-detail, share-config, todo-search, user-center, checkin, checkinLeaderboard, report-detail, report-edit |
| Community | `packageCommunity/` | post-detail, post-edit |
| Profile | `packageProfile/` | user-home |

## What's Incomplete / Known Gaps
- No test suite for backend or frontend
- Web version (`website/`) functional but not deployed
- Dark mode not implemented
- Notification retry not implemented (one-shot only)
