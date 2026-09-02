import { describe, expect, it } from "vitest";
import { normalizeAppleProductivityPayload } from "@/lib/apple-productivity-bridge";

describe("apple productivity bridge", () => {
  it("normalizes calendar events and reminders", () => {
    const result = normalizeAppleProductivityPayload({
      calendarEvents: [
        {
          id: "event-1",
          title: "Cours de maths",
          startDate: "2026-08-24T08:00:00+02:00",
          endDate: "2026-08-24T10:00:00+02:00",
        },
      ],
      reminders: [
        {
          id: "reminder-1",
          title: "Réviser intégrales",
          dueDate: "2026-08-24T18:00:00+02:00",
          priority: 3,
          isCompleted: false,
          estimatedMinutes: 45,
        },
      ],
    });

    expect(result.events[0]).toMatchObject({ id: "event-1", title: "Cours de maths" });
    expect(result.tasks[0]).toMatchObject({ id: "reminder-1", priority: "urgent", estimatedMinutes: 45, status: "todo" });
  });

  it("drops malformed calendar entries but keeps valid reminders", () => {
    const result = normalizeAppleProductivityPayload({
      calendarEvents: [
        { title: "Invalide", startDate: "not-a-date", endDate: "2026-08-24T10:00:00Z" },
        { title: "Valide", startDate: "2026-08-24T10:00:00Z", endDate: "2026-08-24T11:00:00Z", isAllDay: true },
      ],
      reminders: [{ title: "Tâche" }],
    });

    expect(result.events).toHaveLength(1);
    expect(result.events[0].allDay).toBe(true);
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].estimatedMinutes).toBe(20);
  });
});
