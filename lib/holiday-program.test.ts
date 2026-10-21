import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildCalendar } from "@/lib/ics";
import { FICHES, HOLIDAY_PROGRAM, PROGRAM_END, PROGRAM_START, RENTREE, dayLabel, hoursLabel, nextSession, programDays, programStats, parisClock, programToIcsEvents, sessionById, sessionMinutes } from "@/lib/holiday-program";

const BASE = "https://exemple.test";
const timed = HOLIDAY_PROGRAM.filter((session) => session.kind !== "repos");

describe("le programme de fin de vacances", () => {
  it("couvre du jeudi 22 octobre au dimanche 1er novembre, avant la rentrée du 2", () => {
    const dates = HOLIDAY_PROGRAM.map((session) => session.date).sort();
    expect(dates[0]).toBe(PROGRAM_START);
    expect(dates[dates.length - 1]).toBe(PROGRAM_END);
    expect(PROGRAM_END < RENTREE).toBe(true);
    expect(dayLabel("2026-10-22")).toBe("jeudi 22 octobre");
    expect(dayLabel("2026-11-01")).toBe("dimanche 1 novembre");
  });

  it("identifiants uniques, de la forme date-moment", () => {
    const ids = HOLIDAY_PROGRAM.map((session) => session.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const session of HOLIDAY_PROGRAM) expect(session.id.startsWith(session.date)).toBe(true);
  });

  it("chaque séance horaire : heures valides, la fin après le début, avant 17 h, et sa durée = la somme de ses temps", () => {
    for (const session of timed) {
      expect(session.start, session.id).toMatch(/^\d{2}:\d{2}$/);
      expect(session.end, session.id).toMatch(/^\d{2}:\d{2}$/);
      expect(sessionMinutes(session), session.id).toBeGreaterThan(0);
      expect(session.end! <= "17:00", session.id).toBe(true);
      expect(session.steps.reduce((sum, step) => sum + step.minutes, 0), session.id).toBe(sessionMinutes(session));
    }
  });

  it("aucun chevauchement dans une journée", () => {
    for (const day of programDays()) {
      const worked = day.sessions.filter((session) => session.start);
      for (let index = 1; index < worked.length; index += 1) expect(worked[index].start! >= worked[index - 1].end!, day.date).toBe(true);
    }
  });

  it("deux jours de repos complet, les dimanches, sans séance ni fiche", () => {
    const rest = HOLIDAY_PROGRAM.filter((session) => session.kind === "repos");
    expect(rest.map((session) => session.date)).toEqual(["2026-10-25", "2026-11-01"]);
    for (const session of rest) {
      expect(new Date(`${session.date}T12:00:00Z`).getUTCDay()).toBe(0);
      expect(session.steps).toEqual([]);
      expect(session.fiche).toBeNull();
      expect(programDays().find((day) => day.date === session.date)!.sessions).toHaveLength(1);
    }
  });

  it("chaque fiche citée existe réellement dans public/exercices", () => {
    for (const [key, fiche] of Object.entries(FICHES)) expect(existsSync(`public/exercices/${fiche.file}`), key).toBe(true);
    for (const session of HOLIDAY_PROGRAM) if (session.fiche) expect(FICHES[session.fiche.key], session.id).toBeDefined();
  });

  it("charge raisonnable : jamais plus de 3 h 30 par jour, et le total est celui annoncé", () => {
    for (const day of programDays()) expect(day.sessions.reduce((sum, session) => sum + sessionMinutes(session), 0), day.date).toBeLessThanOrEqual(210);
    const stats = programStats();
    expect(stats.restDays).toBe(2);
    expect(stats.workDays).toBe(9);
    expect(stats.workMinutes).toBe(1275);
    expect(hoursLabel(stats.workMinutes)).toBe("21 h 15");
  });

  it("parisClock : l'heure de Paris, avant et après le changement d'heure", () => {
    expect(parisClock(new Date("2026-10-24T07:30:00Z"))).toBe("2026-10-24T09:30");
    expect(parisClock(new Date("2026-10-26T08:30:00Z"))).toBe("2026-10-26T09:30");
    expect(parisClock(new Date("2026-10-24T22:30:00Z"))).toBe("2026-10-25T00:30");
  });

  it("sessionById et nextSession", () => {
    expect(sessionById("2026-10-22-matin")?.title).toBe("Reprise des erreurs (1/2)");
    expect(sessionById("inconnue")).toBeNull();
    expect(nextSession("2026-10-21T22:00")?.id).toBe("2026-10-22-matin");
    expect(nextSession("2026-10-22T10:00")?.id).toBe("2026-10-22-matin"); // en cours
    expect(nextSession("2026-10-22T11:30")?.id).toBe("2026-10-22-apres-midi");
    expect(nextSession("2026-10-25T09:00")?.id).toBe("2026-10-26-matin"); // le repos n'est pas une séance
    expect(nextSession("2026-11-01T20:00")).toBeNull();
  });
});

describe("le calendrier Apple (ICS)", () => {
  const events = programToIcsEvents(BASE);
  const text = buildCalendar({ name: "Fin de vacances", now: new Date("2026-10-21T20:00:00Z") }, events);

  it("un événement par séance et par jour de repos, avec un UID stable", () => {
    expect(events).toHaveLength(HOLIDAY_PROGRAM.length);
    expect(events.map((event) => event.uid)).toEqual(HOLIDAY_PROGRAM.map((session) => `${session.id}@taekdhub`));
  });

  it("une alarme 15 minutes avant chaque séance, aucune le jour de repos", () => {
    for (const event of events) {
      if (event.allDay) expect(event.alarms ?? []).toEqual([]);
      else expect(event.alarms).toEqual([15]);
    }
    expect(text.match(/TRIGGER:-PT15M/g)).toHaveLength(timed.length);
  });

  it("le lien de chaque événement ouvre sa séance, et la description cite sa fiche", () => {
    const first = events[0];
    expect(first.url).toBe(`${BASE}/seance/2026-10-22-matin`);
    expect(first.description).toContain(`${BASE}/exercices/fiche-1-reprise.pdf`);
    expect(first.description).toContain("1. Anki — 20 min");
  });

  it("les heures sont justes de part et d'autre du changement d'heure du 25 octobre", () => {
    expect(text).toContain("DTSTART:20261022T073000Z"); // jeudi 09:30, UTC+2
    expect(text).toContain("DTSTART:20261024T080000Z"); // samedi 10:00, UTC+2
    expect(text).toContain("DTSTART:20261026T083000Z"); // lundi 09:30, UTC+1 (après le changement d'heure)
    expect(text).toContain("DTSTART:20261030T083000Z"); // vendredi 30 octobre 09:30, UTC+1
    expect(text).toContain("DTSTART;VALUE=DATE:20261025");
  });

  it("le fichier est un calendrier valide : CRLF, lignes de 75 octets au plus", () => {
    expect(text.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(text.split("\r\n").every((line) => new TextEncoder().encode(line).length <= 75)).toBe(true);
  });
});
