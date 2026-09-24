import { dayKey, subjects, todaySeconds, totalSeconds } from "@/lib/study";
import { sessionsInWeek, startOfWeek } from "@/lib/week";
import type { Subject, WorkSession } from "@/lib/supabase/types";

/**
 * EMPILEMENTS PAR MATIÈRE — les deux figures de l'accueil.
 *
 *   `todayBySubject`   la légende de « Ma journée », matière par matière
 *                      (l'anneau, lui, est désormais d'un seul tenant, à
 *                      l'accent — le découpage en segments gris a été
 *                      retiré avec `ringSegments` / `SegmentRing`) ;
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
