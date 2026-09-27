import type { Subject, WorkSession } from "@/lib/supabase/types";

/**
 * CORRIGER UNE SÉANCE — une durée oubliée, une mauvaise matière, un chrono
 * resté ouvert toute la nuit.
 *
 * Jusqu'ici une séance enregistrée ne se corrigeait plus : un chrono oublié
 * (9 h « de maths ») gonflait pour toujours le budget de la semaine, la
 * Progression et le « déjà 2 h de maths » de Next Move. Les séances sont LA
 * source de vérité du temps (règle du Sprint 2.6) : elles doivent pouvoir
 * être rectifiées.
 *
 * Une correction garde l'identifiant, le travail et le chapitre rattachés,
 * recalcule `ended_at` depuis le début et la durée (une séance reste un
 * intervalle cohérent), et pose `updated_at` pour la synchronisation.
 *
 * Fonctions pures.
 */

/** Une séance ne dépasse pas 12 h : au-delà, c'est un chrono oublié, pas du travail. */
export const SESSION_MAX_MINUTES = 12 * 60;

/** Au-delà de 3 h d'affilée, l'arrêt du chrono demande confirmation. */
export const LONG_SESSION_MINUTES = 3 * 60;

export interface SessionPatch {
  subject: Subject;
  /** Durée en minutes, entière. */
  minutes: number;
  /** Début, `AAAA-MM-JJTHH:MM` en heure LOCALE (la valeur d'un `<input type="datetime-local">`). */
  startLocal: string;
  note: string;
}

export type SessionEditError = "durée" | "début" | "futur";

/** `AAAA-MM-JJTHH:MM` local → `Date`, ou `null` si la valeur est illisible. */
export function parseLocalDateTime(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  const date = new Date(year, month - 1, day, hour, minute);
  // Rejette les dates qui « débordent » (31 février → 3 mars).
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

/** L'inverse de `parseLocalDateTime` — pour pré-remplir le champ. */
export function toLocalDateTime(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** La correction, ou la raison du refus. Une séance ne peut pas commencer dans le futur. */
export function editSession(session: WorkSession, patch: SessionPatch, now: Date = new Date()): { session: WorkSession } | { error: SessionEditError } {
  const minutes = Math.round(patch.minutes);
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > SESSION_MAX_MINUTES) return { error: "durée" };
  const start = parseLocalDateTime(patch.startLocal);
  if (!start) return { error: "début" };
  // Ni début ni FIN dans le futur : une fin future fausserait les totaux, et
  // son horodatage l'emporterait sur toute correction ultérieure à la synchro.
  if (start.getTime() + minutes * 60_000 > now.getTime()) return { error: "futur" };

  const note = patch.note.trim();
  return {
    session: {
      ...session,
      subject: patch.subject,
      started_at: start.toISOString(),
      ended_at: new Date(start.getTime() + minutes * 60_000).toISOString(),
      duration_seconds: minutes * 60,
      note: note ? note.slice(0, 280) : null,
      updated_at: now.toISOString(),
    },
  };
}

export const SESSION_EDIT_ERRORS: Record<SessionEditError, string> = {
  durée: `La durée doit être comprise entre 1 min et ${SESSION_MAX_MINUTES / 60} h.`,
  début: "La date de début est illisible.",
  futur: "Une séance ne peut pas se terminer dans le futur : vérifie le début et la durée.",
};
