import type { CalendarEvent, ProductivityTask } from "@/lib/productivity-engine";

export interface AppleCalendarEventPayload {
  id?: string;
  title?: string;
  startDate?: string;
  endDate?: string;
  isAllDay?: boolean;
}

export interface AppleReminderPayload {
  id?: string;
  title?: string;
  dueDate?: string | null;
  priority?: number;
  isCompleted?: boolean;
  estimatedMinutes?: number;
}

export interface AppleProductivityPayload {
  calendarEvents?: AppleCalendarEventPayload[];
  reminders?: AppleReminderPayload[];
}

function requiredString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function safeDate(value: unknown): string | null {
  const raw = requiredString(value);
  if (!raw) return null;
  const timestamp = new Date(raw).getTime();
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function mapReminderPriority(value: unknown): ProductivityTask["priority"] {
  if (typeof value !== "number") return "normal";
  if (value >= 3) return "urgent";
  if (value === 2) return "high";
  if (value === 1) return "normal";
  return "low";
}

export function normalizeAppleProductivityPayload(payload: AppleProductivityPayload): {
  events: CalendarEvent[];
  tasks: ProductivityTask[];
} {
  const events: CalendarEvent[] = (payload.calendarEvents ?? [])
    .map((event, index) => {
      const startsAt = safeDate(event.startDate);
      const endsAt = safeDate(event.endDate);
      const title = requiredString(event.title);
      if (!startsAt || !endsAt || !title || new Date(endsAt).getTime() <= new Date(startsAt).getTime()) return null;
      return {
        id: requiredString(event.id) ?? `apple-event:${index}:${startsAt}`,
        title,
        startsAt,
        endsAt,
        allDay: Boolean(event.isAllDay),
        source: "apple-calendar",
      } as CalendarEvent;
    })
    .filter((event): event is CalendarEvent => event !== null);

  const tasks: ProductivityTask[] = (payload.reminders ?? [])
    .map((reminder, index) => {
      const title = requiredString(reminder.title);
      if (!title) return null;
      return {
        id: requiredString(reminder.id) ?? `apple-reminder:${index}:${title}`,
        title,
        dueAt: reminder.dueDate == null ? null : safeDate(reminder.dueDate),
        estimatedMinutes: Math.max(15, typeof reminder.estimatedMinutes === "number" ? reminder.estimatedMinutes : 20),
        priority: mapReminderPriority(reminder.priority),
        status: reminder.isCompleted ? "done" : "todo",
        area: "personal",
        source: "apple-reminders",
      } as ProductivityTask;
    })
    .filter((task): task is ProductivityTask => task !== null);

  return { events, tasks };
}
