# Telegram Market Intelligence Platform - PRD v9.0

## Original Problem Statement
Переход от Alpha Intelligence к **Telegram Market Intelligence Terminal** с объективными метриками:
- ~~Alpha как главный смысл~~ → Utility-first approach
- Discovery Engine
- Growth & Health Analytics  
- Channel Utility Index
- Personal Workspace

---

## Architecture Change: BLOCK U-1 ✅ (NEW)

### Utility-First Re-Architecture

**Было:**
```
Intel Score = Alpha + Credibility + NetworkAlpha - Fraud
```

**Стало:**
```
Utility Score = 
  25% Engagement +
  20% Growth +
  15% Stability +
  15% Originality +
  15% Activity +
  10% FraudInverse
```

### Tier System
| Tier | Score Range |
|------|-------------|
| A+   | 85-100      |
| A    | 75-84       |
| B    | 60-74       |
| C    | 40-59       |
| D    | 0-39        |

### API Endpoints (NEW)
```
GET /api/telegram-intel/intel/list?mode=utility  # Unified endpoint
GET /api/telegram-intel/utility/list              # Standalone
GET /api/telegram-intel/utility/channel/:username
GET /api/telegram-intel/utility/explain           # Formula explanation
```

### Response Shape
```json
{
  "ok": true,
  "mode": "utility",
  "total": 100,
  "items": [{
    "username": "alpha_crypto",
    "utilityScore": 82,
    "utilityTier": "A",
    "growth30": 18.2,
    "engagementRate": 0.14,
    "stability": 0.76,
    "forwardRatio": 0.18,
    "fraudRisk": 0.12,
    "explain": { ... }
  }],
  "stats": {
    "avgUtility": 65,
    "avgGrowth30": 8.5,
    "avgEngagement": 0.11
  }
}
```

---

## What's Been Implemented

### BLOCK U-1: Utility Engine ✅ (2026-02-18)
- `utility.types.ts` - Type definitions
- `utility.scoring.ts` - Scoring formula + tier mapping
- `utility.data.ts` - MongoDB adapter + mock data
- `utility.service.ts` - Business logic
- `utility.routes.ts` - REST endpoints
- Patched `leaderboard.routes.ts` for mode=utility

### Previous Implementations
- PHASE 6: Bot Delivery Layer ✅
- BLOCK 5.2: Personalized Alerts ✅
- BLOCK 5.1: Watchlist Core ✅
- Momentum Engine ✅
- PATCH-1,2,3: Materialized Leaderboards ✅

---

## Leaderboard Modes

| Mode | Endpoint | Description |
|------|----------|-------------|
| `utility` | `?mode=utility` | Objective metrics (DEFAULT) |
| `intel` | `?mode=intel` | Full intel score |
| `momentum` | `?mode=momentum` | Growth velocity |

---

## Frontend Routes

| Route | Description |
|-------|-------------|
| `/telegram` | Leaderboard (Utility/Intel/Momentum toggle) |
| `/telegram/movers` | Score change analytics |
| `/telegram/alerts` | Personal alerts + Bot Connect |
| `/telegram/watchlist` | User's watchlist |
| `/telegram/:username` | Channel detail |

---

## Prioritized Backlog

### P0 (Complete)
- [x] BLOCK U-1: Utility Engine
- [x] PHASE 6: Bot Delivery
- [x] BLOCK 5.1+5.2: Watchlist + Alerts

### P1 (Next - Frontend)
- [ ] **BLOCK U-2**: Frontend toggle Utility | Advanced
- [ ] New Leaderboard columns: Utility | Growth | ER | Stability | Fraud
- [ ] Channel Page re-structure with Utility focus

### P2 (Medium)
- [ ] Category filtering (Trading/News/NFT/VC)
- [ ] Growth Acceleration metric
- [ ] Scheduled delivery job

### P3 (Future)
- [ ] Export to CSV
- [ ] Real-time websocket alerts

---

**Last Updated:** 2026-02-18
**Version:** 9.0.0
**Status:** BLOCK U-1 Complete ✅
