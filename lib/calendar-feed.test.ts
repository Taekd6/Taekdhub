import { describe, expect, it } from "vitest";
import { MIN_CALENDAR_TOKEN_LENGTH, handleCalendarFeed, tokenFromSegment, type CalendarFeedEnv } from "@/lib/calendar-feed";

const TOKEN = "jeton-calendrier-factice-".padEnd(MIN_CALENDAR_TOKEN_LENGTH + 8, "x");
const env = (overrides: Partial<CalendarFeedEnv> = {}): CalendarFeedEnv => ({ token: TOKEN, baseUrl: "https://exemple.test", now: () => new Date("2026-10-21T20:00:00Z"), ...overrides });

describe("flux du calendrier Apple — fermé par défaut", () => {
  it.each([["sans jeton configuré", undefined], ["jeton configuré trop court", "court"]])("503 %s", async (_name, token) => {
    const response = handleCalendarFeed(`${TOKEN}.ics`, env({ token }));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("BEGIN:VCALENDAR");
  });

  it.each([["sans jeton", undefined], ["faux jeton", "faux.ics"], ["jeton tronqué", `${TOKEN.slice(0, -1)}.ics`]])("401 %s", (_name, segment) => {
    expect(handleCalendarFeed(segment, env()).status).toBe(401);
  });

  it("le jeton valide, avec ou sans « .ics », donne le calendrier", async () => {
    for (const segment of [`${TOKEN}.ics`, TOKEN]) {
      const response = handleCalendarFeed(segment, env());
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/calendar");
      const text = await response.text();
      expect(text.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
      expect(text).toContain("https://exemple.test/seance/2026-10-22-matin");
    }
  });

  it("ne renvoie jamais le jeton dans le contenu", async () => {
    expect(await handleCalendarFeed(`${TOKEN}.ics`, env()).text()).not.toContain(TOKEN);
  });

  it("tokenFromSegment", () => {
    expect(tokenFromSegment("abc.ics")).toBe("abc");
    expect(tokenFromSegment("abc")).toBe("abc");
    expect(tokenFromSegment(undefined)).toBeUndefined();
  });
});
