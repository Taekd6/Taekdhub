import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildCalendar } from "@/lib/ics";
import { DEADLINES, FICHES, HOLIDAY_PROGRAM, PROGRAM_END, PROGRAM_START, RENTREE, dayLabel, hoursLabel, nextSession, programDays, programStats, parisClock, calendarEvents, deadlineAlarmMinutes, deadlinesToIcsEvents, programToIcsEvents, sessionById, sessionMinutes } from "@/lib/holiday-program";

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

  it("chaque séance horaire : heures valides, la fin après le début, entre 9 h et 21 h, et sa durée = la somme de ses temps", () => {
    for (const session of timed) {
      expect(session.start, session.id).toMatch(/^\d{2}:\d{2}$/);
      expect(session.end, session.id).toMatch(/^\d{2}:\d{2}$/);
      expect(sessionMinutes(session), session.id).toBeGreaterThan(0);
      expect(session.start! >= "09:00" && session.end! <= "21:00", session.id).toBe(true);
      expect(session.steps.reduce((sum, step) => sum + step.minutes, 0), session.id).toBe(sessionMinutes(session));
    }
  });

  it("aucun chevauchement dans une journée", () => {
    for (const day of programDays()) {
      const worked = day.sessions.filter((session) => session.start);
      for (let index = 1; index < worked.length; index += 1) expect(worked[index].start! >= worked[index - 1].end!, day.date).toBe(true);
    }
  });

  it("deux jours de repos, les dimanches : pas de fiche, rien de plus que quinze minutes de vocabulaire", () => {
    const rest = HOLIDAY_PROGRAM.filter((session) => session.kind === "repos");
    expect(rest.map((session) => session.date)).toEqual(["2026-10-25", "2026-11-01"]);
    for (const session of rest) {
      expect(new Date(`${session.date}T12:00:00Z`).getUTCDay()).toBe(0);
      expect(session.steps).toEqual([]);
      expect(session.fiche).toBeNull();
      const others = programDays().find((day) => day.date === session.date)!.sessions.filter((entry) => entry.kind !== "repos");
      expect(others.reduce((sum, entry) => sum + sessionMinutes(entry), 0), session.date).toBeLessThanOrEqual(15);
    }
  });

  it("l'anglais est travaillé tous les jours, du 22 octobre au 1er novembre", () => {
    for (const day of programDays()) expect(day.sessions.some((session) => session.subject === "Anglais"), day.date).toBe(true);
  });

  it("chaque fiche citée existe réellement dans public/exercices", () => {
    for (const [key, fiche] of Object.entries(FICHES)) expect(existsSync(`public/exercices/${fiche.file}`), key).toBe(true);
    for (const session of HOLIDAY_PROGRAM) if (session.fiche) expect(FICHES[session.fiche.key], session.id).toBeDefined();
  });

  it("charge raisonnable : jamais plus de 6 h par jour, et le total est celui annoncé", () => {
    for (const day of programDays()) expect(day.sessions.reduce((sum, session) => sum + sessionMinutes(session), 0), day.date).toBeLessThanOrEqual(360);
    const stats = programStats();
    expect(stats.restDays).toBe(2);
    expect(stats.workDays).toBe(9);
    expect(stats.workMinutes).toBe(2805);
    expect(hoursLabel(stats.workMinutes)).toBe("46 h 45");
  });

  it("parisClock : l'heure de Paris, avant et après le changement d'heure", () => {
    expect(parisClock(new Date("2026-10-24T07:30:00Z"))).toBe("2026-10-24T09:30");
    expect(parisClock(new Date("2026-10-26T08:30:00Z"))).toBe("2026-10-26T09:30");
    expect(parisClock(new Date("2026-10-24T22:30:00Z"))).toBe("2026-10-25T00:30");
  });

  it("sessionById et nextSession", () => {
    expect(sessionById("2026-10-22-matin")?.title).toBe("Reprise des erreurs de tes copies");
    expect(sessionById("inconnue")).toBeNull();
    expect(nextSession("2026-10-21T22:00")?.id).toBe("2026-10-22-matin");
    expect(nextSession("2026-10-22T10:00")?.id).toBe("2026-10-22-matin"); // en cours
    expect(nextSession("2026-10-22T11:30")?.id).toBe("2026-10-22-anki");
    expect(nextSession("2026-10-22T12:45")?.id).toBe("2026-10-22-apres-midi");
    expect(nextSession("2026-10-25T09:00")?.id).toBe("2026-10-25-soir"); // le repos n'est pas une séance
    expect(nextSession("2026-10-25T21:00")?.id).toBe("2026-10-26-matin");
    expect(nextSession("2026-11-01T20:30")).toBeNull();
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
    expect(first.description).toContain("1. Exercices — 95 min");
  });

  it("les heures sont justes de part et d'autre du changement d'heure du 25 octobre", () => {
    expect(text).toContain("DTSTART:20261022T073000Z"); // jeudi 09:30, UTC+2
    expect(text).toContain("DTSTART:20261024T070000Z"); // samedi 09:00, UTC+2
    expect(text).toContain("DTSTART:20261026T083000Z"); // lundi 09:30, UTC+1 (après le changement d'heure)
    expect(text).toContain("DTSTART:20261030T083000Z"); // vendredi 30 octobre 09:30, UTC+1
    expect(text).toContain("DTSTART;VALUE=DATE:20261025");
  });

  it("le fichier est un calendrier valide : CRLF, lignes de 75 octets au plus", () => {
    expect(text.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(text.split("\r\n").every((line) => new TextEncoder().encode(line).length <= 75)).toBe(true);
  });
});

describe("les échéances", () => {
  const WEEKDAY: Record<string, number> = { "2026-11-02": 1, "2026-11-03": 2, "2026-11-05": 4, "2026-11-10": 2, "2026-11-13": 5, "2026-11-16": 1, "2026-11-17": 2, "2026-11-18": 3, "2026-11-19": 4, "2026-11-23": 1, "2026-11-26": 4, "2026-11-27": 5, "2026-11-30": 1, "2026-12-07": 1, "2026-12-14": 1, "2026-12-17": 4, "2027-01-07": 4, "2027-01-11": 1, "2027-01-18": 1, "2027-01-21": 4, "2027-01-25": 1 };

  it("identifiants uniques, dans l'ordre des dates, avec les jours de la semaine du calendrier des DS", () => {
    const ids = DEADLINES.map((deadline) => deadline.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(DEADLINES.map((deadline) => deadline.date)).toEqual([...DEADLINES.map((deadline) => deadline.date)].sort());
    for (const deadline of DEADLINES) {
      expect(deadline.id.startsWith(deadline.date), deadline.id).toBe(true);
      expect(new Date(`${deadline.date}T12:00:00Z`).getUTCDay(), deadline.id).toBe(WEEKDAY[deadline.date]);
      expect(Boolean(deadline.start), deadline.id).toBe(Boolean(deadline.end));
    }
  });

  it("le lundi 2 novembre : le DS de physique-chimie et les trois devoirs à rendre", () => {
    expect(DEADLINES.filter((deadline) => deadline.date === "2026-11-02").map((deadline) => deadline.id)).toEqual(["2026-11-02-ds-physique", "2026-11-02-dm-maths", "2026-11-02-dm-physique", "2026-11-02-ds-francais"]);
  });

  it("alarmes : un événement sur la journée sonne à 9 h, un événement horaire à l'heure exacte, jamais dans le passé", () => {
    expect(deadlineAlarmMinutes(7, true)).toBe(9540);
    expect(deadlineAlarmMinutes(7, false)).toBe(10080);
    const events = deadlinesToIcsEvents(BASE, "2026-10-21T22:00");
    const ds = events.find((event) => event.uid === "2026-11-02-ds-physique@taekdhub")!;
    expect(ds.alarms).toEqual([7, 3, 1].map((days) => deadlineAlarmMinutes(days, true))); // le « 14 jours » (19 octobre) est déjà passé
    const colle = events.find((event) => event.uid === "2026-11-03-colle-maths@taekdhub")!;
    expect(colle.alarms).toEqual([10080, 4320, 1440, 60]);
    expect(colle.start).toBe("2026-11-03T13:00");
    const longTerm = events.find((event) => event.uid === "2026-11-19-ds-anglais@taekdhub")!;
    expect(longTerm.alarms).toEqual([20160, 10080, 4320, 1440]);
  });

  it("le calendrier complet : séances puis échéances, UID tous distincts, fichier valide", () => {
    const all = calendarEvents(BASE, new Date("2026-10-21T20:00:00Z"));
    expect(all).toHaveLength(HOLIDAY_PROGRAM.length + DEADLINES.length);
    expect(new Set(all.map((event) => event.uid)).size).toBe(all.length);
    const text = buildCalendar({ name: "TaekdHub", now: new Date("2026-10-21T20:00:00Z") }, all);
    expect(text.split("\r\n").every((line) => new TextEncoder().encode(line).length <= 75)).toBe(true);
    expect(text).toContain("DTSTART;VALUE=DATE:20261102");
    expect(text).toContain("DTSTART:20261103T120000Z"); // colle de maths mardi 3 novembre 13:00, UTC+1
    expect(text).toContain("TRIGGER:-PT9540M");
  });
});
