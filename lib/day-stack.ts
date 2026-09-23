import { dayKey, subjects, todaySeconds, totalSeconds } from "@/lib/study";
import { sessionsInWeek, startOfWeek } from "@/lib/week";
import type { Subject, WorkSession } from "@/lib/supabase/types";

/**
 * EMPILEMENTS PAR MATIÈRE — les deux figures colorées de l'accueil.
 *
 *   `todayBySubject`   l'anneau du jour, un segment par matière ;
 *   `weekDayStacks`    la semaine en sept colonnes (lundi → dimanche),
 *                      chacune empilée par matière.
 *
 * AUCUNE NOUVELLE DÉFINITION DU TEMPS. « Aujourd'hui » est celui de
 * lib/study.ts#todaySeconds (jour calendaire ET déjà commencé) et « cette
 * semaine » celui de lib/week.ts#sessionsInWeek (lundi 00:00 → maintenant) :
 * l'anneau et les colonnes ne peuvent donc jamais afficher un autre total
 * que l'objectif du jour et le bilan de la semaine juste à côté. Une séance
 * compte pour le jour où elle a COMMENCÉ, comme partout ailleurs.
 *
 * En SECONDES, jamais en minutes arrondies par matière : sept arrondis
 * additionnés s'écarteraient du total arrondi une seule fois, et le dernier
 * segment de l'anneau mentirait d'une minute ou deux.
 */

export interface SubjectSeconds {
  subject: Subject;
  seconds: number;
}

/** Temps d'aujourd'hui par matière, dans l'ordre de lib/study.ts#subjects — matières à zéro exclues. */
export function todayBySubject(sessions: WorkSession[], now: Date = new Date()): SubjectSeconds[] {
  return subjects
    .map((subject) => ({
      subject,
      seconds: todaySeconds(
        sessions.filter((session) => session.subject === subject),
        now
      ),
    }))
    .filter((entry) => entry.seconds > 0);
}

export interface DayStack {
  /** `AAAA-MM-JJ` local — identifiant stable de la colonne. */
  key: string;
  /** Initiale du jour (« L », « M »…) — ambiguë seule, d'où `longLabel`. */
  label: string;
  /** « lundi 21 septembre » — lu par les lecteurs d'écran et au survol. */
  longLabel: string;
  isToday: boolean;
  /** Jour pas encore commencé : la colonne est vide PAR CONSTRUCTION, pas par absence de travail. */
  isFuture: boolean;
  totalSeconds: number;
  /** Matières travaillées ce jour-là, dans l'ordre de lib/study.ts#subjects, sans les zéros. */
  segments: SubjectSeconds[];
}

const INITIALS = ["L", "M", "M", "J", "V", "S", "D"];
const longFormatter = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

/** Les sept jours de la semaine en cours, lundi → dimanche, toujours sept entrées. */
export function weekDayStacks(sessions: WorkSession[], now: Date = new Date()): DayStack[] {
  const monday = startOfWeek(now);
  const weekSessions = sessionsInWeek(sessions, monday, now);
  const todayKey = dayKey(now);

  return INITIALS.map((label, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const key = dayKey(date);
    const daySessions = weekSessions.filter((session) => dayKey(session.started_at) === key);
    const segments = subjects
      .map((subject) => ({ subject, seconds: totalSeconds(daySessions.filter((session) => session.subject === subject)) }))
      .filter((entry) => entry.seconds > 0);
    return {
      key,
      label,
      longLabel: longFormatter.format(date),
      isToday: key === todayKey,
      isFuture: key > todayKey,
      totalSeconds: segments.reduce((sum, entry) => sum + entry.seconds, 0),
      segments,
    };
  });
}

export interface RingSegment {
  subject: Subject;
  /** Début et longueur, en fraction du tour (0–1). */
  start: number;
  length: number;
}

/**
 * Découpe l'anneau du jour : chaque matière occupe la part de l'OBJECTIF
 * qu'elle a remplie, et l'ensemble plafonne au tour complet. Au-delà de
 * l'objectif, les parts sont remises à l'échelle pour que l'anneau reste
 * fermé et proportionné — il dit alors « objectif atteint, et voici avec
 * quoi », pas « 140 % ».
 *
 * `gap` (fraction du tour) sépare deux segments voisins ; il n'est retiré
 * qu'à un segment assez long pour le porter, pour qu'une séance de cinq
 * minutes reste un point visible et ne disparaisse pas.
 */
export function ringSegments(parts: SubjectSeconds[], goalSeconds: number, gap = 0): RingSegment[] {
  const total = parts.reduce((sum, part) => sum + part.seconds, 0);
  if (total <= 0) return [];
  const scale = goalSeconds > 0 && total <= goalSeconds ? 1 / goalSeconds : 1 / total;
  const segments: RingSegment[] = [];
  let cursor = 0;
  for (const part of parts) {
    const share = part.seconds * scale;
    const usable = parts.length > 1 && share > gap * 2 ? share - gap : share;
    segments.push({ subject: part.subject, start: cursor, length: Math.max(0, usable) });
    cursor += share;
  }
  return segments;
}
