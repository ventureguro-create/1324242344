# Telegram Market Intelligence Platform - PRD v13.0

## Product Vision
**Telegram Market Intelligence Terminal** - полная система для объективного анализа Telegram-каналов:
1. **Channel Level** → Utility + Lifecycle + Similar Channels
2. **Sector Level** → Heatmap + Benchmarks  
3. **Macro Level** → Rotation Tracker
4. **Intelligence Level** → Transitions + Signals (NEW)

---

## Architecture Complete

### U-1: Utility Engine ✅
```
Utility = 25% Engagement + 20% Growth + 15% Stability + 15% Originality + 15% Activity + 10% FraudInverse
```

### U-6: Sector Rotation ✅
- Daily sector snapshots
- ΔAcceleration, ΔUtility, ΔGrowth tracking

### U-7: Channel Lifecycle ✅
| Stage | Condition |
|-------|-----------|
| EMERGING | High growth + small channel OR high acceleration |
| EXPANDING | growth30 > 15% + acceleration > 3% |
| MATURE | Stable growth + high utility + high stability |
| SATURATED | Low growth + decelerating + good utility |
| DECLINING | Negative growth OR strong deceleration |
| STABLE | Default state |

### U-8: Recommendation Engine ✅
- Similar Channels based on utility metrics
- Similarity scoring: 35% utility + 25% ER + 15% growth + 15% stability + 10% size

### U-9: Lifecycle Transitions ✅ (NEW - 2026-02-21)
Tracks lifecycle stage changes over time.

**Impact Score Formula:**
```
impact = 0.45 * ΔUtility + 0.35 * ΔAcceleration + 0.20 * (ΔER * 100) - 0.30 * (ΔFraud * 100)
```

**Transition Types:**
| From | To | Signal |
|------|----|--------|
| EMERGING → EXPANDING | Strong growth signal |
| EXPANDING → MATURE | Confirmed growth |
| MATURE → SATURATED | Caution |
| ANY → DECLINING | Risk |

### U-10: Signal Engine ✅ (NEW - 2026-02-21)
Actionable intelligence from utility, rotation, lifecycle.

**Signal Types:**
| Type | Description | Scoring |
|------|-------------|---------|
| SUBSCRIBE_CANDIDATE | Good channels to follow | 45% utility + 25% ER + 20% acc + 10% fraud |
| RISING_UTILITY | Utility + acceleration increase | 50% utility + 35% acc + 15% fraud |
| LIFECYCLE_PROMOTION | Stage upgrades | 50% impact + 30% Δacc + 20% fraud |
| QUALITY_ALERT | Risk signals | 40% fraud + 30% declining + 30% decel |

**Severity Levels:**
- HIGH (score >= 80): Immediate attention
- MED (score 60-79): Monitor closely
- LOW (score < 60): Background signal

---

## API Endpoints

### Utility
```
GET /api/telegram-intel/intel/list?mode=utility
GET /api/telegram-intel/channel/:username/similar?limit=6
```

### Lifecycle
```
GET /api/telegram-intel/lifecycle
GET /api/telegram-intel/lifecycle/transitions?days=7&filter=EMERGING_TO_EXPANDING
POST /api/admin/telegram-intel/lifecycle/transitions/run?days=7
```

### Signals (U-10)
```
GET /api/telegram-intel/signals?days=7&type=SUBSCRIBE_CANDIDATE&severity=HIGH
GET /api/telegram-intel/signals/:id
POST /api/admin/telegram-intel/signals/run?days=7
```

---

## Frontend Routes

| Route | Description |
|-------|-------------|
| `/telegram` | Utility Leaderboard |
| `/telegram/sectors` | Sector Heatmap |
| `/telegram/rotation` | Sector Rotation |
| `/telegram/transitions` | Lifecycle Transitions (U-9) |
| `/telegram/signals` | Actionable Signals (U-10) |
| `/telegram/:username` | Channel Detail + Similar |

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
- [x] U-9: Lifecycle Transitions (2026-02-21)
- [x] U-10: Signal Engine (2026-02-21)
- [x] PHASE 6: Bot Delivery

---

## Next Steps (P1)

### U-11: Delivery Layer
- Push signals to Telegram via bot
- In-app notifications
- Personalized thresholds for watchlist

### Channel Page Enhancements
- Signal badges on channel cards
- Recent transitions indicator
- Alert subscription button

---

## Technical Notes

### Backend Architecture
- Python FastAPI (port 8001) - proxy server
- Node.js Fastify (port 8002) - Telegram Intel module
- MongoDB - data storage

### Mock Mode
- TG_UTILITY_MOCK=1 enables mock data adapter
- 5 test channels with realistic transitions and signals

---

**Last Updated:** 2026-02-21
**Version:** 13.0.0
**Status:** U-9 + U-10 Complete ✅
