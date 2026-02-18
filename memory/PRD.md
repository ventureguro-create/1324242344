# Telegram Market Intelligence Platform - PRD v10.0

## Product Vision
**Telegram Market Intelligence Terminal** - платформа для объективного анализа Telegram-каналов по измеряемым метрикам.

---

## Architecture: Utility-First (Complete)

### Core Metric: Utility Score (0-100)
```
Utility = 
  25% Engagement (views/subs) +
  20% Growth (30d change) +
  15% Stability (view consistency) +
  15% Originality (1 - forward ratio) +
  15% Activity (posts/day) +
  10% FraudInverse (1 - fraud risk)
```

### Tier System
| Tier | Score | Badge Color |
|------|-------|-------------|
| A+   | 85+   | Emerald     |
| A    | 75-84 | Blue        |
| B    | 60-74 | Sky         |
| C    | 40-59 | Amber       |
| D    | <40   | Gray        |

---

## What's Been Implemented

### U-2: Frontend Dual Mode ✅
- Default mode: **Utility** (not Intel)
- Toggle: `[Utility] [Advanced] [Momentum]`
- New columns: Utility | Growth | ER | Stability | Original | Fraud
- Growth Badges: 🔥 Hot (>20%), ⚡ Rising (>10%), ❄️ Cooling (<-5%)

### U-3: Category Intelligence ✅
- Category filtering in leaderboard
- Sector-level aggregation

### U-4: Growth Acceleration ✅
- `acceleration = growth7 - (growth30 / 4)`
- Tiers: EXPLODING | ACCELERATING | STABLE | DECELERATING

### U-5: Sector Heatmap ✅
- New page: `/telegram/sectors`
- Market summary: Total Channels, Avg Utility, Avg Growth, Hot Sectors
- Sector table with progress bars
- Trend indicators per category

---

## API Endpoints

### Utility
```
GET /api/telegram-intel/intel/list?mode=utility
GET /api/telegram-intel/utility/list
GET /api/telegram-intel/utility/channel/:username
GET /api/telegram-intel/utility/explain
```

### Sector
```
GET /api/telegram-intel/sector/overview
GET /api/telegram-intel/sector/:category
```

### Bot Delivery (PHASE 6)
```
GET/POST /api/telegram-intel/bot/status|connect|preferences|test|webhook
```

---

## Frontend Routes

| Route | Description |
|-------|-------------|
| `/telegram` | Utility Leaderboard (default) |
| `/telegram?mode=intel` | Advanced Intel mode |
| `/telegram?mode=momentum` | Momentum mode |
| `/telegram/sectors` | Sector Heatmap |
| `/telegram/movers` | Score changes |
| `/telegram/alerts` | Personal + System alerts |
| `/telegram/watchlist` | User's watchlist |
| `/telegram/:username` | Channel detail |

---

## Tech Stack
- **Backend**: Node.js/Fastify + TypeScript
- **Frontend**: React + Tailwind CSS
- **Database**: MongoDB
- **Proxy**: Python FastAPI → Node.js

---

## Prioritized Backlog

### Complete ✅
- [x] U-1: Utility Engine
- [x] U-2: Frontend Dual Mode
- [x] U-3: Category Intelligence
- [x] U-4: Growth Acceleration
- [x] U-5: Sector Heatmap
- [x] PHASE 6: Bot Delivery

### P1 (Next)
- [ ] Channel Page Utility-first redesign
- [ ] Category filtering in UI
- [ ] Sector rotation tracker (ΔAcceleration)

### P2 (Future)
- [ ] Real-time websocket alerts
- [ ] Export to CSV
- [ ] Scheduled alert delivery job

---

**Last Updated:** 2026-02-18
**Version:** 10.0.0
**Status:** U-2 through U-5 Complete ✅
