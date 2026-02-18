# Telegram Intelligence Platform - PRD v8.0

## Original Problem Statement
Production-grade изолированный Telegram Intelligence модуль с:
- Phases 1-4: Scoring Engine (Alpha, Credibility, NetworkAlpha, Fraud, Temporal) ✅
- Block UI-1: Production Leaderboard ✅
- Block UI-2: Channel Detail Page ✅
- Block UI-6: Movers Page ✅
- Block GOV-1: Governance Admin ✅
- Block ALERTS: Alerts Engine ✅
- **Momentum Engine (M-1, M-2, M-3)** ✅
- **PATCH-1: Unified Leaderboard with mode=intel|momentum** ✅
- **PATCH-2: Movers with metric=momentumScore** ✅
- **PATCH-3: Materialized Leaderboards** ✅
- **BLOCK 5.1: Watchlist Core** ✅
- **BLOCK 5.2: Personalized Alerts Engine** ✅
- **PHASE 6: Bot Delivery Layer** ✅ (NEW)

---

## What's Been Implemented (2026-02-18)

### PHASE 6: Bot Delivery Layer ✅ (NEW)

**Backend:**
- `TgBotConnectionModel` - stores user Telegram bot connections with preferences
- `bot.service.ts` - Telegram Bot API integration for sending push notifications
- `bot.routes.ts` - REST API endpoints for bot management

**API Endpoints:**
```
GET /api/telegram-intel/bot/status
POST /api/telegram-intel/bot/connect
DELETE /api/telegram-intel/bot/disconnect
PATCH /api/telegram-intel/bot/preferences
POST /api/telegram-intel/bot/test
POST /api/telegram-intel/bot/webhook
POST /api/admin/telegram-intel/bot/deliver
GET /api/admin/telegram-intel/bot/stats
GET /api/admin/telegram-intel/bot/connections
POST /api/admin/telegram-intel/bot/webhook/set
```

**Frontend:**
- `TelegramBotConnect.jsx` - Full connection UI with:
  - Connect flow with deep link generation
  - Preferences management (severity, alert types, quiet hours)
  - Test notification button
  - Disconnect option
- Integrated into `TelegramAlertsPage.jsx`

**Bot Commands:**
- `/start <token>` - Connect web account to Telegram
- `/start` - Welcome message
- `/settings` - View notification settings
- `/help` - Help information
- `/stop` - Pause notifications

---

## Previous Implementations

### BLOCK 5.1: Watchlist Core ✅
- User watchlist with notes, tags, alert settings
- Score change tracking since added

### BLOCK 5.2: Personalized Alerts Engine ✅
- User-specific alerts based on watchlist
- Alert types: INTEL_SPIKE/DUMP, MOMENTUM_SPIKE/DUMP, FRAUD_SPIKE, TIER_CHANGE, NEW_RISER

### Momentum Engine ✅
- M-1: Momentum Metrics Layer
- M-2: Momentum Scoring Engine
- M-3: UI Integration

---

## Frontend Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/telegram` | TelegramLeaderboardPage | Intel/Momentum toggle |
| `/telegram?mode=momentum` | TelegramLeaderboardPage | Momentum view |
| `/telegram/movers` | TelegramMoversPage | Score change analytics |
| `/telegram/alerts` | TelegramAlertsPage | Personal + System alerts + Bot Connect |
| `/telegram/watchlist` | TelegramWatchlistPage | User's watchlist |
| `/telegram/:username` | TelegramChannelPage | Channel detail |

---

## Architecture

```
Telegram Intelligence Module
├── Backend (Node.js/Fastify)
│   ├── Bot Delivery (PHASE 6) - NEW
│   │   ├── delivery/tg_bot_connections.model.ts
│   │   ├── delivery/bot.service.ts
│   │   └── delivery/bot.routes.ts
│   ├── Watchlist (BLOCK 5.1)
│   ├── User Alerts (BLOCK 5.2)
│   ├── Momentum Engine
│   └── Scoring Engine
│
├── Frontend (React)
│   ├── components/telegram/
│   │   ├── TelegramBotConnect.jsx - NEW
│   │   ├── WatchlistButton.jsx
│   │   ├── UserAlertsPanel.jsx
│   │   └── ...
│   └── pages/
│       ├── TelegramAlertsPage.jsx (updated)
│       └── ...
│
└── Data Pipeline
    1. Ingestion → 2. Metrics → 3. IntelScore
    4. Momentum → 5. User Alerts → 6. Bot Delivery
```

---

## Configuration

**Required Environment Variables:**
- `TG_BOT_TOKEN` - Telegram Bot API token (from @BotFather)
- `MONGODB_URI` - MongoDB connection string
- `TG_SECRETS_KEY` - Fernet key for encrypted credentials (optional)

**Bot Webhook Setup:**
```bash
POST /api/admin/telegram-intel/bot/webhook/set
Body: { "url": "https://your-domain.com/api/telegram-intel/bot/webhook" }
```

---

## Prioritized Backlog

### P0 (Critical - Completed)
1. [x] BLOCK 5.1: Watchlist Core
2. [x] BLOCK 5.2: Personalized Alerts Engine
3. [x] PHASE 6: Bot Delivery Layer

### P1 (High - Next)
1. [ ] Scheduled delivery job (cron for pending alerts)
2. [ ] Webhook verification (Telegram signature check)
3. [ ] Rate limiting for bot API

### P2 (Medium)
1. [ ] Email notifications
2. [ ] Config Version Editor UI
3. [ ] Export to CSV/Excel

### P3 (Future)
1. [ ] Websocket real-time alerts
2. [ ] PATCH-3B: Split items for 100k+ scale

---

**Last Updated:** 2026-02-18
**Version:** 8.0.0
**Status:** PHASE 6 Complete ✅
