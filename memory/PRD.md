# Telegram Market Intelligence Platform - PRD v12.0

## Product Vision
**Telegram Market Intelligence Terminal** - полная система для объективного анализа Telegram-каналов с иерархией:
1. **Channel Level** → Utility + Lifecycle + Similar Channels
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

### U-8: Recommendation Engine ✅ (NEW - 2026-02-21)
**Similar Channels** - структурированная релевантность без ML

Similarity scoring weights:
```
similarity =
  0.35 * utilityDistance +
  0.25 * engagementDistance +
  0.15 * growthDistance +
  0.15 * stabilityDistance +
  0.10 * sizeDistance +
  8 * lifecycleDistance
```

Filters:
- Same category (preferred)
- fraudRisk < 0.5
- Lifecycle proximity bonus

Diversity: избегает показ 6 одинаковых lifecycle

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

### Recommendations (U-8 NEW)
```
GET /api/telegram-intel/channel/:username/similar?limit=6
GET /api/telegram-intel/health
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
| `/telegram/:username` | Channel detail + Similar Channels (U-8) |

---

## Components

### SimilarChannelsPanel (U-8)
Location: `/app/frontend/src/components/telegram/SimilarChannelsPanel.jsx`

Features:
- Grid of 6 similar channel cards
- Category + Lifecycle badges
- Metrics: Utility, Growth, ER, Fraud
- Similarity reasons
- Links to channel detail pages

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
- [x] U-8: Recommendation Engine (2026-02-21)
- [x] PHASE 6: Bot Delivery

---

## Next Steps (P1)

### U-9: Lifecycle Transitions (Weekly)
- Track transitions: EMERGING → EXPANDING → MATURE → SATURATED → DECLINING
- Weekly alerts when channels change lifecycle
- Historical lifecycle data

### Channel Page Redesign
- Utility-first header ✅
- Lifecycle badge prominent ✅
- Similar Channels section ✅ (U-8)
- Sector comparison (pending)

---

## Technical Notes

### Backend Architecture
- Python FastAPI (port 8001) - proxy server
- Node.js Fastify (port 8002) - Telegram Intel module
- MongoDB - data storage

### Mock Mode
- TG_UTILITY_MOCK=1 enables mock data adapter
- 5 test channels: alpha_crypto, defi_news, whale_alerts, nft_insider, shitcoin_casino

---

**Last Updated:** 2026-02-21
**Version:** 12.0.0
**Status:** U-8 Recommendation Engine Complete ✅
