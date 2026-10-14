# TaekdHub Productivity OS

## Architecture

`lib/productivity-engine.ts` is the deterministic core. It accepts only normalized `CalendarEvent`, `ProductivityTask`, work windows and settings; it does not know Apple, HTTP, React, localStorage or Supabase. It returns an explainable `DailyProductivityPlan`, including `PlanningDecision` records.

`lib/productivity-bridge.ts` converts the existing academic plan into `study` tasks. It composes `plan.ts` and `next-action.ts`; academic selection rules remain in their existing modules.

`lib/apple-productivity-bridge.ts` and `lib/productivity-protocol.ts` are transport adapters. They normalize Apple Shortcuts data without giving the browser any direct Apple Calendar or Reminders access. `lib/productivity-adaptation.ts` replans the unfinished day; `lib/productivity-review.ts` creates the compact end-of-day result.

## Planning rules

The engine merges overlapping calendar events, blocks all-day events by default, excludes short gaps, preserves a reserve, observes minimum breaks, caps a session at 90 minutes and a default day at 240 minutes. These settings are overridable per call and are designed to become user preferences later.

Ranking is deterministic: task priority, overdue/near deadline, age, a small academic signal and short-task fit contribute to a score. Equal scores are ordered by ID. The plan never silently drops remaining work: it reports `unscheduledTaskIds`.

## Apple Shortcuts protocol

`POST /api/productivity/sync` accepts JSON. The stable envelope is version `1.0` and accepts both the Shortcuts names (`events`, `reminders`, `timestamp`) and canonical names (`calendarEvents`, `generatedAt`). Invalid individual events are ignored; an invalid envelope returns HTTP 400.

```json
{
  "schemaVersion": "1.0",
  "source": "apple-shortcuts",
  "timestamp": "2026-08-24T06:00:00Z",
  "timezone": "Europe/Paris",
  "events": [{ "id": "calendar-1", "title": "Cours", "startDate": "2026-08-24T08:00:00+02:00", "endDate": "2026-08-24T10:00:00+02:00" }],
  "reminders": [{ "id": "reminder-1", "title": "DM maths", "dueDate": "2026-08-24T18:00:00+02:00", "priority": 3 }]
}
```

The response includes `schemaVersion`, `generatedAt`, `timezone`, `plan`, `blocks`, `unscheduledTasks` and a small `summary`. A Shortcut can: collect Calendar events and Reminders, turn them into this JSON, use `Get Contents of URL` with POST, then display or create Calendar blocks from the response. Writing Calendar/Reminders back is intentionally not implemented by the web app.

Set `PRODUCTIVITY_SYNC_TOKEN` in Vercel and send `Authorization: Bearer <token>` to require a shared secret. The endpoint stores nothing and no Apple credential belongs in this repository. If the variable is absent, deployment owners must protect the endpoint at their infrastructure boundary before exposing it publicly.

## Persistence and next integration

Immediate plan state and productivity settings should be stored in new namespaced localStorage keys, separately from existing TaekdHub data. Cloud history, decisions and completed-block telemetry can later be added behind an optional Supabase service. No existing localStorage format changes in this branch.

The next product step is a small Daily Copilot surface consuming `buildDailyCopilotPlan`; it should render at most five decisions and use the returned reasons verbatim. Apple authentication, bi-directional Calendar writes and reminder updates require explicit user-side Shortcut or OAuth design and are not claimed as operational here.
