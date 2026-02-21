# Telegram Market Intelligence Platform - PRD v11.0

## Product Vision
**Telegram Market Intelligence Terminal** - полная система для объективного анализа Telegram-каналов с иерархией:
1. **Channel Level** → Utility + Lifecycle
2. **Sector Level** → Heatmap + Benchmarks  
3. **Macro Level** → Rotation Tracker

---

## Architecture Complete

### U-1: Utility Engine ✅
```
Utility = 25% Engagement + 20% Growth + 15% Stability + 15% Originality + 15% Activity + 10% FraudInverse
```

### U-6: Sector Rotation ✅
- Daily sector snapshots
- ΔAcceleration, ΔUtility, ΔGrowth tracking
- Status: ROTATING_IN (≥+3%), ROTATING_OUT (≤-3%), STABLE

### U-7: Channel Lifecycle ✅
| Stage | Condition |
|-------|-----------|
| EMERGING | High growth + small channel OR high acceleration |
| EXPANDING | growth30 > 15% + acceleration > 3% |
| MATURE | Stable growth + high utility + high stability |
| SATURATED | Low growth + decelerating + good utility |
| DECLINING | Negative growth OR strong deceleration |
| STABLE | Default state |

---

## API Endpoints

### Utility
```
GET /api/telegram-intel/intel/list?mode=utility
GET /api/telegram-intel/utility/explain
```

### Sector
```
GET /api/telegram-intel/sector/overview
GET /api/telegram-intel/sector/rotation?days=7|14|30
POST /api/admin/telegram-intel/sector/snapshot
```

### Lifecycle
```
GET /api/telegram-intel/lifecycle
GET /api/telegram-intel/lifecycle/:username
GET /api/telegram-intel/lifecycle/stage/:stage
```

---

## Frontend Routes

| Route | Description |
|-------|-------------|
| `/telegram` | Utility Leaderboard + Lifecycle |
| `/telegram/sectors` | Sector Heatmap |
| `/telegram/rotation` | Sector Rotation Tracker |
| `/telegram/alerts` | Alerts + Bot Connect |
| `/telegram/watchlist` | User's watchlist |
| `/telegram/:username` | Channel detail |

---

## Leaderboard Columns (Utility Mode)

| Channel | Tier | Utility | Lifecycle | Growth | ER | Fraud |

---

## What's Been Implemented

### Complete ✅
- [x] U-1: Utility Engine
- [x] U-2: Frontend Dual Mode
- [x] U-3: Category Intelligence
- [x] U-4: Growth Acceleration
- [x] U-5: Sector Heatmap
- [x] U-6: Sector Rotation
- [x] U-7: Channel Lifecycle
- [x] PHASE 6: Bot Delivery

---

## Next Steps (P1)

### U-8: Recommendation Engine
- "Similar channels" based on category + lifecycle
- "You may also like" suggestions

### Channel Page Redesign
- Utility-first header
- Lifecycle badge prominent
- Sector comparison

---

**Last Updated:** 2026-02-21
**Version:** 11.0.0
**Status:** U-6 + U-7 Complete ✅
