# Telegram Market Intelligence Platform - PRD v14.0

## Product Vision
**Telegram Market Intelligence Terminal** - терминал для анализа Telegram-каналов внутри FOMO платформы.

---

## Финальная Архитектура (UI-FREEZE-1)

### A) Главная страница /telegram (Entities Overview)
**Цель**: найти и отобрать полезные TG-каналы

Компоненты:
- Search bar
- Stats cards (Funds, Projects)
- Social platform icons
- Ad Mode / Filter buttons
- Entities Table с колонками:
  - Channel/Group (avatar + title)
  - Type (Channel/Group)
  - Members
  - Avg Reach
  - Growth (7D) — colored (+green/-red)
  - Activity (High/Medium/Low badges)
  - Red Flags (count + flag icon)
  - FOMO Score (score + star + engagement + thumbs up)
- Pagination

### B) Страница канала /telegram/:username (Channel Overview)
**Цель**: понять "почему этот канал хороший/плохой"

Layout: 2-column grid (8+4 cols)

**Left Column (8 cols):**
- Channel Header (avatar, title, type, buttons)
- Top Cards Row (Subscribers, Views/Post, Messages/Day, Activity)
- Activity Overview, Audience Snapshot, Product Overview (3-col)
- Engagement Timeline (chart with 24H/7D/30D/90D)
- Recent Posts

**Right Column (4 cols):**
- AI Summary (auto-generated)
- Channel Snapshot (Live)
- Health & Safety (progress bars)
- Related Channels

### C) Compare Modal
- Side-by-side comparison
- Sections: Basics, AI Summary, Activity Overview, Audience Snapshot, Channel Snapshot, Health & Safety, Product Overview

---

## Что Анализируем (Market Utility Terminal)

1. **Охват/Reach** — views/post, median views
2. **Рост/Growth** — reach/activity/audience changes
3. **Активность/Activity** — posts/day, active days
4. **Вовлечение/Engagement** — forwards/replies/reactions
5. **Стабильность/Stability** — без искусственных графиков
6. **Red Flags** — fraud/promo/spike detection

Alpha/NetAlpha/Credibility/Momentum — внутренние продвинутые режимы на detail странице.

---

## Реализованные Блоки

### Complete ✅
- [x] U-1 to U-10: Utility Engine, Lifecycle, Transitions, Signals
- [x] UI-FREEZE-1: Entities Overview (2026-02-21)
- [x] UI-FREEZE-1: Channel Overview (2026-02-21)
- [x] UI-FREEZE-1: Compare Modal (2026-02-21)

---

## API Endpoints (Контракты)

### GET /api/telegram-intel/utility/list
```typescript
type TgListItem = {
  username: string;
  title: string;
  avatarUrl?: string | null;
  type: "channel" | "group";
  members?: number | null;
  avgReach30?: number | null;
  growth7?: number | null;
  activityLabel: "High" | "Medium" | "Low";
  redFlagsCount: number;
  utilityScore: number;
  updatedAt: string;
};
```

### GET /api/telegram-intel/channel/:username/overview
Полный контракт для detail page с profile, topCards, aiSummary, activityOverview, audienceSnapshot, productOverview, channelSnapshot, healthSafety, relatedChannels, timeline, recentPosts.

### GET /api/telegram-intel/compare?left=:u1&right=:u2
Сравнение двух каналов.

---

## Frontend Routes

| Route | Page | Status |
|-------|------|--------|
| `/telegram` | Entities Overview | ✅ UI-FREEZE |
| `/telegram/:username` | Channel Overview | ✅ UI-FREEZE |
| `/telegram/leaderboard` | Legacy Leaderboard | Legacy |
| `/telegram/transitions` | Lifecycle Transitions | ✅ |
| `/telegram/signals` | Actionable Signals | ✅ |

---

## Дорожная Карта

### Этап 1 — UI как на референсе ✅ COMPLETE
- [x] /telegram = Entities Overview
- [x] /telegram/:username = Channel Overview
- [x] Compare modal

### Этап 2 — Фильтры (NEXT)
- [ ] Filter drawer: category, type, members range, avg reach, growth7, posts/day, engagement, redflags max, language
- [ ] URL sync
- [ ] Presets: "Fast growing", "High reach low spam", "New emerging"

### Этап 3 — Реальные данные MTProto
- [ ] Подключить ingestion runtime
- [ ] Обновления по расписанию
- [ ] "last updated" в UI

### Этап 4 — Pro-слой
- [ ] Расширенные формулы
- [ ] AI summary
- [ ] Export

---

## Technical Notes

### Stack
- React + React Router (not Next.js)
- Tailwind CSS
- Light theme only (no dark mode)
- Lucide React icons

### Backend
- Python FastAPI (port 8001) - proxy/wrapper
- Node.js Lite (port 8002) - Telegram Intel API (telegram-lite.mjs)
- MongoDB

### Backend Architecture (2026-02-21)
Due to TypeScript compilation OOM issues in the environment, a lightweight JavaScript-only backend was created:
- **`/app/backend/src/telegram-lite.mjs`** - Standalone JS server that handles:
  - `GET /api/telegram-intel/utility/list` - Channel list with filtering
  - `GET /api/telegram-intel/channel/:username/overview` - Channel detail
  - `GET /api/telegram-intel/compare` - Channel comparison
- Uses MongoDB aggregation for data when available, falls back to mock data
- No TypeScript compilation needed at runtime
- Python wrapper (`server.py`) proxies all `/api/telegram-intel/*` routes to port 8002

---

**Last Updated:** 2026-02-21
**Version:** 14.1.0
**Status:** Backend Fixed ✅, Live Data Connected ✅
