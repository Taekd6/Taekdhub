import { describe, expect, it } from "vitest";
import { buildCalendar, escapeText, foldLine, formatUtc, nextDay, parisToUtc } from "@/lib/ics";

const NOW = new Date("2026-10-21T20:00:00Z");

describe("parisToUtc — le changement d'heure du dimanche 25 octobre 2026", () => {
  it("avant le changement (heure d'été, UTC+2)", () => {
    expect(formatUtc(parisToUtc("2026-10-24T09:30"))).toBe("20261024T073000Z");
    expect(formatUtc(parisToUtc("2026-10-22T15:00"))).toBe("20261022T130000Z");
  });

  it("après le changement (heure d'hiver, UTC+1)", () => {
    expect(formatUtc(parisToUtc("2026-10-26T09:30"))).toBe("20261026T083000Z");
    expect(formatUtc(parisToUtc("2026-11-01T15:00"))).toBe("20261101T140000Z");
  });

  it("le jour même du changement : 02:00 reste en heure d'été, 12:00 est en heure d'hiver", () => {
    expect(formatUtc(parisToUtc("2026-10-25T01:30"))).toBe("20261024T233000Z");
    expect(formatUtc(parisToUtc("2026-10-25T12:00"))).toBe("20261025T110000Z");
  });

  it("l'été et le passage de mars (UTC+1 puis UTC+2)", () => {
    expect(formatUtc(parisToUtc("2026-07-14T10:00"))).toBe("20260714T080000Z");
    expect(formatUtc(parisToUtc("2026-03-28T10:00"))).toBe("20260328T090000Z");
    expect(formatUtc(parisToUtc("2026-03-30T10:00"))).toBe("20260330T080000Z");
  });

  it("refuse une heure illisible", () => {
    expect(() => parisToUtc("demain 9h")).toThrow();
  });
});

describe("texte", () => {
  it("échappe ; , \\ et les sauts de ligne", () => {
    expect(escapeText("a;b,c\\d\ne")).toBe("a\;b\\,c\\\\d\\ne");
  });

  it("jour suivant, à travers un changement de mois", () => {
    expect(nextDay("2026-10-31")).toBe("2026-11-01");
    expect(nextDay("2026-10-25")).toBe("2026-10-26");
  });
});

describe("foldLine — 75 octets, jamais un caractère coupé", () => {
  const bytes = (line: string) => new TextEncoder().encode(line).length;

  it("ne touche pas une ligne courte", () => {
    expect(foldLine("SUMMARY:Court")).toEqual(["SUMMARY:Court"]);
  });

  it("replie une longue ligne ASCII : 75 octets au plus, continuation par une espace", () => {
    const parts = foldLine("DESCRIPTION:" + "x".repeat(200));
    expect(parts.length).toBeGreaterThan(2);
    expect(parts.every((part) => bytes(part) <= 75)).toBe(true);
    expect(parts.slice(1).every((part) => part.startsWith(" "))).toBe(true);
    expect(parts.map((part, index) => (index === 0 ? part : part.slice(1))).join("")).toBe("DESCRIPTION:" + "x".repeat(200));
  });

  it("compte les OCTETS : des « é » (2 octets) ne dépassent jamais 75", () => {
    const line = "SUMMARY:" + "é".repeat(120);
    const parts = foldLine(line);
    expect(parts.every((part) => bytes(part) <= 75)).toBe(true);
    expect(parts.map((part, index) => (index === 0 ? part : part.slice(1))).join("")).toBe(line);
  });
});

describe("buildCalendar", () => {
  const events = [
    { uid: "a@taekdhub", summary: "Maths — reprise", description: "Anki 20 min\nExercices 55 min", url: "https://exemple.test/seance/a", start: "2026-10-22T09:30", end: "2026-10-22T11:00", alarms: [15, 0], categories: ["Maths"] },
    { uid: "b@taekdhub", summary: "Repos", allDay: "2026-10-25", busy: false },
  ];
  const text = buildCalendar({ name: "TaekdHub — fin de vacances", now: NOW }, events);
  const lines = text.split("\r\n");

  it("structure : calendrier, deux événements, deux alarmes, fin de ligne CRLF", () => {
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines[lines.length - 2]).toBe("END:VCALENDAR");
    expect(text.endsWith("\r\n")).toBe(true);
    expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(text.match(/BEGIN:VALARM/g)).toHaveLength(2);
    expect(text).not.toMatch(/[^\r]\n/);
  });

  it("événement horaire en UTC, alarme 15 min avant et au début", () => {
    expect(text).toContain("DTSTART:20261022T073000Z");
    expect(text).toContain("DTEND:20261022T090000Z");
    expect(text).toContain("TRIGGER:-PT15M");
    expect(text).toContain("TRIGGER:PT0S");
    expect(text).toContain("UID:a@taekdhub");
  });

  it("événement sur la journée : dates, fin exclusive, transparent, sans alarme", () => {
    expect(text).toContain("DTSTART;VALUE=DATE:20261025");
    expect(text).toContain("DTEND;VALUE=DATE:20261026");
    expect(text).toContain("TRANSP:TRANSPARENT");
  });

  it("description échappée (le saut de ligne devient \\n) et abonnement rafraîchi", () => {
    expect(text).toContain("DESCRIPTION:Anki 20 min\\nExercices 55 min");
    expect(text).toContain("REFRESH-INTERVAL;VALUE=DURATION:PT6H");
  });

  it("aucune ligne ne dépasse 75 octets", () => {
    const long = buildCalendar({ name: "x", now: NOW }, [{ ...events[0], description: "é".repeat(300) }]);
    expect(long.split("\r\n").every((line) => new TextEncoder().encode(line).length <= 75)).toBe(true);
  });

  it("refuse un événement sans date", () => {
    expect(() => buildCalendar({ name: "x", now: NOW }, [{ uid: "c", summary: "sans date" }])).toThrow();
  });

  it("deux générations du même contenu sont identiques (UID et horodatage stables)", () => {
    expect(buildCalendar({ name: "n", now: NOW }, events)).toBe(buildCalendar({ name: "n", now: NOW }, events));
  });
});
