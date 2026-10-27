import { describe, expect, it } from "vitest";
import { checkFeedUrl, eventsInRange, kindOfTitle, maskFeedUrl, normalizeCalendarFeeds, subjectOfTitle } from "@/lib/calendar";

/* Un extrait au format d'un export Google : fuseau Europe/Paris, cours hebdomadaires, un cours annulé (EXDATE), un déplacé (RECURRENCE-ID). */
const ICS = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//Google Inc//Google Calendar 70.9054//EN",
  "BEGIN:VTIMEZONE",
  "TZID:Europe/Paris",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "DTSTART:19700329T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "DTSTART:19701025T030000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
  // Lundi 8 h–10 h, chaque semaine depuis le 7 septembre ; annulé le 19 octobre.
  "BEGIN:VEVENT",
  "UID:maths-lundi@google.com",
  "DTSTART;TZID=Europe/Paris:20260907T080000",
  "DTEND;TZID=Europe/Paris:20260907T100000",
  "RRULE:FREQ=WEEKLY;BYDAY=MO",
  "EXDATE;TZID=Europe/Paris:20261019T080000",
  "SUMMARY:Mathématiques",
  "LOCATION:D10",
  "END:VEVENT",
  // Lundi 13 h 15–17 h : DS ; celui du 2 novembre est déplacé à 14 h.
  "BEGIN:VEVENT",
  "UID:ds@google.com",
  "DTSTART;TZID=Europe/Paris:20260907T131500",
  "DTEND;TZID=Europe/Paris:20260907T170000",
  "RRULE:FREQ=WEEKLY;BYDAY=MO",
  "SUMMARY:DS",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:ds@google.com",
  "RECURRENCE-ID;TZID=Europe/Paris:20261102T131500",
  "DTSTART;TZID=Europe/Paris:20261102T140000",
  "DTEND;TZID=Europe/Paris:20261102T180000",
  "SUMMARY:DS de physique",
  "END:VEVENT",
  // Un rendez-vous ponctuel, et un événement annulé.
  "BEGIN:VEVENT",
  "UID:oral@icloud.com",
  "DTSTART;TZID=Europe/Paris:20261105T080000",
  "DTEND;TZID=Europe/Paris:20261105T100000",
  "SUMMARY:Anglais\\, passage à l'oral",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:annule@google.com",
  "DTSTART;TZID=Europe/Paris:20261103T090000",
  "DTEND;TZID=Europe/Paris:20261103T100000",
  "STATUS:CANCELLED",
  "SUMMARY:Physique",
  "END:VEVENT",
  // Journée entière.
  "BEGIN:VEVENT",
  "UID:toussaint@google.com",
  "DTSTART;VALUE=DATE:20261101",
  "DTEND;VALUE=DATE:20261102",
  "SUMMARY:Toussaint",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

const range = (from: string, to: string) => [new Date(from), new Date(to)] as const;

describe("eventsInRange", () => {
  it("déplie les cours hebdomadaires sur la semaine demandée, à la bonne heure de Paris", () => {
    const [from, to] = range("2026-10-26T00:00:00+01:00", "2026-11-02T00:00:00+01:00");
    const events = eventsInRange(ICS, "edt", from, to)!;
    const maths = events.filter((e) => e.title === "Mathématiques");
    expect(maths).toHaveLength(1);
    // Après le passage à l'heure d'hiver (25 octobre) : 8 h à Paris = 7 h UTC.
    expect(maths[0].start).toBe("2026-10-26T07:00:00.000Z");
    expect(maths[0].location).toBe("D10");
    expect(maths[0].subject).toBe("Mathématiques");
  });

  it("respecte l'heure d'été avant le 25 octobre", () => {
    const [from, to] = range("2026-10-12T00:00:00+02:00", "2026-10-13T00:00:00+02:00");
    const maths = eventsInRange(ICS, "edt", from, to)!.find((e) => e.title === "Mathématiques")!;
    expect(maths.start).toBe("2026-10-12T06:00:00.000Z");
  });

  it("n'affiche pas un cours annulé (EXDATE) ni un événement CANCELLED", () => {
    const [from, to] = range("2026-10-19T00:00:00+02:00", "2026-10-20T00:00:00+02:00");
    expect(eventsInRange(ICS, "edt", from, to)!.some((e) => e.title === "Mathématiques")).toBe(false);
    const [f2, t2] = range("2026-11-03T00:00:00+01:00", "2026-11-04T00:00:00+01:00");
    expect(eventsInRange(ICS, "edt", f2, t2)!.some((e) => e.title === "Physique")).toBe(false);
  });

  it("applique une occurrence déplacée (RECURRENCE-ID)", () => {
    const [from, to] = range("2026-11-02T00:00:00+01:00", "2026-11-03T00:00:00+01:00");
    const ds = eventsInRange(ICS, "edt", from, to)!.filter((e) => e.kind === "ds");
    expect(ds).toHaveLength(1);
    expect(ds[0].title).toBe("DS de physique");
    expect(ds[0].start).toBe("2026-11-02T13:00:00.000Z");
    expect(ds[0].subject).toBe("Physique");
  });

  it("garde les événements ponctuels et les journées entières", () => {
    const [from, to] = range("2026-11-01T00:00:00+01:00", "2026-11-08T00:00:00+01:00");
    const events = eventsInRange(ICS, "perso", from, to)!;
    const oral = events.find((e) => e.title.startsWith("Anglais"))!;
    expect(oral.kind).toBe("colle");
    expect(oral.subject).toBe("Anglais");
    const toussaint = events.find((e) => e.title === "Toussaint")!;
    expect(toussaint.allDay).toBe(true);
    expect(toussaint.start).toBe("2026-11-01");
  });

  it("renvoie null pour un fichier illisible, sans lever", () => {
    expect(eventsInRange("pas un agenda", "x", new Date(), new Date())).toBeNull();
  });
});

describe("adresses d'agenda", () => {
  it("accepte Google et iCloud, convertit webcal en https", () => {
    expect(checkFeedUrl("https://calendar.google.com/calendar/ical/abc%40group/private-123/basic.ics")).toMatchObject({ ok: true });
    const icloud = checkFeedUrl("webcal://p42-caldav.icloud.com/published/2/MTIz");
    expect(icloud).toEqual({ ok: true, url: "https://p42-caldav.icloud.com/published/2/MTIz" });
  });

  it("refuse tout autre hôte, http, et les adresses internes", () => {
    for (const bad of ["http://calendar.google.com/x.ics", "https://evil.example.com/a.ics", "https://169.254.169.254/latest", "https://localhost/a.ics", "https://calendar.google.com.evil.io/a.ics", "https://u:p@calendar.google.com/a", ""]) {
      expect(checkFeedUrl(bad).ok).toBe(false);
    }
  });

  it("ne montre jamais le jeton secret", () => {
    expect(maskFeedUrl("https://calendar.google.com/calendar/ical/me/private-SECRET/basic.ics")).toBe("calendar.google.com/…");
  });

  it("normalise la liste : adresses invalides et doublons écartés", () => {
    const feeds = normalizeCalendarFeeds([
      { id: "edt", label: "EDT", url: "webcal://calendar.google.com/a.ics" },
      { id: "dup", label: "Doublon", url: "https://calendar.google.com/a.ics" },
      { id: "bad", label: "Mauvais", url: "https://evil.example.com/a.ics" },
      "n'importe quoi",
    ]);
    expect(feeds).toEqual([{ id: "edt", label: "EDT", url: "https://calendar.google.com/a.ics" }]);
    expect(normalizeCalendarFeeds(undefined)).toEqual([]);
  });
});

describe("classement d'après le titre", () => {
  it.each([
    ["Mathématiques", "cours", "Mathématiques"],
    ["Td Maths", "td", "Mathématiques"],
    ["TP physique", "tp", "Physique"],
    ["DS", "ds", null],
    ["Préparation au DS", "ds", null],
    ["Colle de francais ", "colle", "Français"],
    ["INFO Option", "cours", "Informatique Spé"],
    ["Info TC", "cours", "Informatique TC"],
    ["TIPE", "cours", null],
    ["Dentiste", "perso", null],
  ] as const)("%s → %s", (title, kind, subject) => {
    expect(kindOfTitle(title)).toBe(kind);
    expect(subjectOfTitle(title)).toBe(subject);
  });
});
