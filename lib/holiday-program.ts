import { PARIS, type IcsEvent } from "@/lib/ics";
import type { Subject } from "@/lib/supabase/types";

/**
 * PROGRAMME DE FIN DE VACANCES — du jeudi 22 octobre au dimanche 1er novembre 2026 (rentrée : lundi 2 novembre).
 *
 * UNE SÉANCE = un créneau daté, DEUX OU TROIS TEMPS (Anki, exercices, bilan) et, quand il y en a une,
 * SA FICHE (un PDF de `public/exercices/`). Le matin : un bloc de 90 min avec une fiche neuve. L'après-midi :
 * un bloc d'une heure pour RÉÉCRIRE PROPREMENT ce qui a été raté (le point faible repéré sur la feuille 1 est la
 * rédaction, pas le calcul). Deux jours de repos complet (dimanches 25 octobre et 1er novembre).
 *
 * C'est une donnée, pas un moteur : le plan n'est pas recalculé, il est ÉCRIT ici et modifié à la main (par Claude,
 * sur demande de l'élève). Une séance modifiée garde son `id` : les liens et le calendrier Apple se mettent à jour.
 *
 * Hypothèses (à corriger si elles sont fausses) : rentrée le lundi 2 novembre (vacances de la Toussaint 2026) ;
 * créneaux le matin (9 h 30 ou 10 h) et l'après-midi (15 h) ; l'élève est en première année.
 */

export type SessionKind = "matin" | "apres-midi" | "repos";

export interface ProgramStep {
  label: string;
  minutes: number;
  detail: string;
}

export type FicheKey = "grille" | "f1" | "f2" | "f3" | "f4" | "f5" | "f6";

export const FICHES: Record<FicheKey, { label: string; file: string }> = {
  grille: { label: "Grille de rédaction", file: "grille-redaction.pdf" },
  f1: { label: "Fiche 1 — Reprise des erreurs", file: "fiche-1-reprise.pdf" },
  f2: { label: "Fiche 2 — Équivalents et DL en rafale", file: "fiche-2-equivalents-dl.pdf" },
  f3: { label: "Fiche 3 — Suites implicites et développements asymptotiques", file: "fiche-3-suites-implicites.pdf" },
  f4: { label: "Fiche 4 — Étude locale et globale de fonctions", file: "fiche-4-etude-fonctions.pdf" },
  f5: { label: "Fiche 5 — Compléments", file: "fiche-5-complements.pdf" },
  f6: { label: "Fiche 6 — Problème de synthèse", file: "fiche-6-probleme.pdf" },
};

export interface ProgramSession {
  /** `AAAA-MM-JJ-matin` : stable, c'est l'identifiant de l'événement du calendrier et de l'adresse de la page. */
  id: string;
  date: string;
  /** « 09:30 » — absent pour un jour de repos. */
  start: string | null;
  end: string | null;
  kind: SessionKind;
  title: string;
  subject: Subject | null;
  chapter: string;
  steps: ProgramStep[];
  /** La fiche à travailler, et quels exercices. */
  fiche: { key: FicheKey; exercises: string } | null;
  /** Une phrase de contexte, ce qu'il faut garder en tête. */
  note: string;
  /** Version du contenu : à incrémenter quand on le change, pour que le calendrier Apple le prenne. */
  version: number;
}

export const PROGRAM_START = "2026-10-22";
export const PROGRAM_END = "2026-11-01";
export const RENTREE = "2026-11-02";
/** Alarme avant le début d'une séance, en minutes. */
export const ALARM_MINUTES = 15;

const ANKI = (minutes = 20): ProgramStep => ({
  label: "Anki",
  minutes,
  detail: "Ton paquet « Techniques asymptotiques » (ou, à défaut, les cartes dues de maths). Réponds de tête avant de retourner la carte.",
});
const EXOS = (minutes: number, detail: string): ProgramStep => ({ label: "Exercices", minutes, detail });
const BILAN = (minutes = 15): ProgramStep => ({
  label: "Bilan",
  minutes,
  detail: "Relis avec la grille de rédaction, puis note le résultat (réussi, partiel ou échec), l'aide utilisée et la cause : depuis la montre ou dans TaekdHub.",
});
const REECRIRE = (minutes: number, detail: string): ProgramStep => ({ label: "Mise au propre", minutes, detail });

const MATHS: Subject = "Mathématiques";
const ASYMPT = "Analyse asymptotique";

export const HOLIDAY_PROGRAM: ProgramSession[] = [
  {
    id: "2026-10-22-matin", date: "2026-10-22", start: "09:30", end: "11:00", kind: "matin", title: "Reprise des erreurs (1/2)", subject: MATHS, chapter: ASYMPT,
    steps: [ANKI(), EXOS(55, "Fiche 1, exercices R1 à R3, sans indice et sans regarder ta copie de la feuille 1 : recommence à zéro."), BILAN()],
    fiche: { key: "f1", exercises: "R1 à R3" },
    note: "Ce sont tes trois questions les plus fausses de la feuille 1. Le but n'est pas de les réussir vite, c'est de les rédiger juste.", version: 1,
  },
  {
    id: "2026-10-22-apres-midi", date: "2026-10-22", start: "15:00", end: "16:00", kind: "apres-midi", title: "Reprise des erreurs (2/2)", subject: MATHS, chapter: ASYMPT,
    steps: [EXOS(45, "Fiche 1, exercices R4 à R6 : la série de Bertrand, les intégrales I_n, le développement asymptotique de la suite des racines."), BILAN()],
    fiche: { key: "f1", exercises: "R4 à R6" },
    note: "Pour l'exercice R4, l'outil à chercher est la comparaison à une intégrale.", version: 1,
  },
  {
    id: "2026-10-23-matin", date: "2026-10-23", start: "09:30", end: "11:00", kind: "matin", title: "Équivalents et DL en rafale", subject: MATHS, chapter: ASYMPT,
    steps: [ANKI(), EXOS(55, "Fiche 2 : douze développements limités puis huit limites. Avant chaque DL, écris l'ordre dont tu as besoin."), BILAN()],
    fiche: { key: "f2", exercises: "Exercices 1 et 2" },
    note: "Vitesse et exactitude : chaque coefficient relu une fois.", version: 1,
  },
  {
    id: "2026-10-23-apres-midi", date: "2026-10-23", start: "15:00", end: "16:00", kind: "apres-midi", title: "Mise au propre : DL et limites", subject: MATHS, chapter: ASYMPT,
    steps: [REECRIRE(45, "Choisis les deux calculs les plus ratés de la fiche 2 et rédige-les proprement, comme sur une copie."), BILAN()],
    fiche: { key: "grille", exercises: "relue à chaque question" },
    note: "Une réponse juste mal rédigée perd des points : écris les ordres, les hypothèses et la flèche des limites.", version: 1,
  },
  {
    id: "2026-10-24-matin", date: "2026-10-24", start: "10:00", end: "11:30", kind: "matin", title: "Suites implicites et développements asymptotiques", subject: MATHS, chapter: ASYMPT,
    steps: [ANKI(), EXOS(55, "Fiche 3 : la suite e^x = n − x, les racines de tan x = x, la réciproque d'une fonction."), BILAN()],
    fiche: { key: "f3", exercises: "Exercices 1 à 3" },
    note: "C'est le cœur du chapitre pour les concours : la méthode « équivalent, réinjection, terme suivant ».", version: 1,
  },
  {
    id: "2026-10-24-apres-midi", date: "2026-10-24", start: "15:00", end: "16:00", kind: "apres-midi", title: "Mise au propre : suites implicites", subject: MATHS, chapter: ASYMPT,
    steps: [REECRIRE(45, "Rédige l'exercice 2 de la fiche 3 (tan x = x) comme au concours : existence, unicité, limite, équivalent, deuxième terme."), BILAN()],
    fiche: { key: "grille", exercises: "relue à chaque question" },
    note: "Chaque étape d'une suite implicite se justifie : monotonie, bijection, passage à la limite avec sa flèche.", version: 1,
  },
  {
    id: "2026-10-25-repos", date: "2026-10-25", start: null, end: null, kind: "repos", title: "Repos complet", subject: null, chapter: "",
    steps: [],
    fiche: null,
    note: "Pas de travail. L'heure change cette nuit (on recule d'une heure) : dors. Un jour de repos fait partie du programme.", version: 1,
  },
  {
    id: "2026-10-26-matin", date: "2026-10-26", start: "09:30", end: "11:00", kind: "matin", title: "Étude de fonctions et asymptotes", subject: MATHS, chapter: ASYMPT,
    steps: [ANKI(), EXOS(55, "Fiche 4 : comportements locaux, puis l'étude complète de la fonction (x²−1) ln |(1+x)/(1−x)|. Règle, repères et courbe soignée."), BILAN()],
    fiche: { key: "f4", exercises: "Exercices 1 à 3" },
    note: "Le développement asymptotique donne l'asymptote et la position : ne trace la courbe qu'après.", version: 1,
  },
  {
    id: "2026-10-26-apres-midi", date: "2026-10-26", start: "15:00", end: "16:00", kind: "apres-midi", title: "Mise au propre : étude de fonction et courbe", subject: MATHS, chapter: ASYMPT,
    steps: [REECRIRE(45, "Rédige proprement l'exercice 3 de la fiche 4 (la fonction (x²+1) arctan x / x), avec son tableau de variations et sa courbe."), BILAN()],
    fiche: { key: "grille", exercises: "relue à chaque question" },
    note: "Ordre d'une copie : domaine, parité, limites, dérivée, signe, tableau, tangentes et asymptotes, courbe.", version: 1,
  },
  {
    id: "2026-10-27-matin", date: "2026-10-27", start: "09:30", end: "11:00", kind: "matin", title: "Compléments : équivalents de suites, suites adjacentes", subject: MATHS, chapter: ASYMPT,
    steps: [ANKI(), EXOS(55, "Fiche 5 : sept équivalents de suites, la suite avec u_n + u_{n+1} ∼ 1/n, des suites adjacentes, la suite des radicaux emboîtés."), BILAN()],
    fiche: { key: "f5", exercises: "Exercices 1 à 4" },
    note: "Plusieurs exercices courts : tiens le chrono, passe à la suite si tu bloques plus de dix minutes.", version: 1,
  },
  {
    id: "2026-10-27-apres-midi", date: "2026-10-27", start: "15:00", end: "16:00", kind: "apres-midi", title: "Mise au propre : suites", subject: MATHS, chapter: ASYMPT,
    steps: [REECRIRE(45, "Rédige l'exercice 2 de la fiche 5 (u_n décroissante et u_n + u_{n+1} ∼ 1/n) : limite, équivalent, et ce qui change sans la décroissance."), BILAN()],
    fiche: { key: "grille", exercises: "relue à chaque question" },
    note: "Dans cet exercice, c'est l'hypothèse de décroissance qui sert : dis où elle intervient.", version: 1,
  },
  {
    id: "2026-10-28-matin", date: "2026-10-28", start: "09:30", end: "11:00", kind: "matin", title: "Reprise ciblée", subject: MATHS, chapter: ASYMPT,
    steps: [ANKI(), EXOS(55, "Reprends dans les tableaux de suivi des fiches 2 à 5 les trois questions les moins réussies et refais-les sans indice."), BILAN()],
    fiche: null,
    note: "Pas de fiche neuve : ce créneau sert à réparer ce qui a vraiment coincé cette semaine.", version: 1,
  },
  {
    id: "2026-10-28-apres-midi", date: "2026-10-28", start: "15:00", end: "16:00", kind: "apres-midi", title: "Cours et cartes", subject: MATHS, chapter: ASYMPT,
    steps: [{ label: "Cours", minutes: 30, detail: "Relis ton cours d'analyse asymptotique avec ses démonstrations de base (équivalents, DL usuels, comparaison)." }, ANKI(30)],
    fiche: null,
    note: "Prépare le problème de demain : les DL usuels et les règles sur les équivalents doivent être sus par cœur.", version: 1,
  },
  {
    id: "2026-10-29-matin", date: "2026-10-29", start: "09:30", end: "11:30", kind: "matin", title: "Problème de synthèse (conditions de DS)", subject: MATHS, chapter: ASYMPT,
    steps: [EXOS(105, "Fiche 6 : étude complète d'une fonction puis suites implicites. Deux heures en tout, sans cours ni notes, copie rédigée au propre."), BILAN()],
    fiche: { key: "f6", exercises: "Problème, parties 1 et 2" },
    note: "Comme un devoir surveillé : gère ton temps, passe à la question suivante si tu bloques, reviens-y à la fin.", version: 1,
  },
  {
    id: "2026-10-29-apres-midi", date: "2026-10-29", start: "15:00", end: "16:00", kind: "apres-midi", title: "Auto-correction du problème", subject: MATHS, chapter: ASYMPT,
    steps: [REECRIRE(45, "Relis ta copie avec la grille de rédaction, repère cinq points à corriger et réécris proprement deux questions."), BILAN()],
    fiche: { key: "grille", exercises: "relue à chaque question" },
    note: "Demain, tu m'envoies la copie : je la corrige ligne par ligne (justifié, admis ou faux).", version: 1,
  },
  {
    id: "2026-10-30-matin", date: "2026-10-30", start: "09:30", end: "11:00", kind: "matin", title: "Correction du problème", subject: MATHS, chapter: ASYMPT,
    steps: [{ label: "Correction", minutes: 60, detail: "Envoie ta copie du problème à Claude : correction ligne par ligne, points de méthode, pièges." }, ANKI(), BILAN(10)],
    fiche: null,
    note: "Le résultat de cette correction alimente ton historique d'exercices et le bilan par chapitre.", version: 1,
  },
  {
    id: "2026-10-30-apres-midi", date: "2026-10-30", start: "15:00", end: "15:45", kind: "apres-midi", title: "Anki et grille", subject: MATHS, chapter: ASYMPT,
    steps: [ANKI(30), { label: "Grille", minutes: 15, detail: "Relis la grille de rédaction et coche les points que tu as encore ratés cette semaine." }],
    fiche: { key: "grille", exercises: "relue en entier" },
    note: "Court et léger : on garde de l'énergie pour la rentrée.", version: 1,
  },
  {
    id: "2026-10-31-matin", date: "2026-10-31", start: "10:00", end: "11:00", kind: "matin", title: "Bilan de la semaine", subject: MATHS, chapter: ASYMPT,
    steps: [{ label: "Bilan", minutes: 40, detail: "Rassemble les tableaux de suivi : qu'est-ce qui a coincé, qu'est-ce qui est acquis ? Envoie-moi le résultat." }, ANKI()],
    fiche: null,
    note: "On prépare la rentrée : les fiches suivantes se bâtissent sur ce qui a coincé, pas sur ce qui est facile.", version: 1,
  },
  {
    id: "2026-11-01-repos", date: "2026-11-01", start: null, end: null, kind: "repos", title: "Repos avant la rentrée", subject: null, chapter: "",
    steps: [],
    fiche: null,
    note: "Pas de travail. Prépare simplement ton sac et ton emploi du temps de lundi.", version: 1,
  },
];

export function sessionById(id: string, program: readonly ProgramSession[] = HOLIDAY_PROGRAM): ProgramSession | null {
  return program.find((session) => session.id === id) ?? null;
}

export function sessionMinutes(session: ProgramSession): number {
  if (!session.start || !session.end) return 0;
  const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  return toMinutes(session.end) - toMinutes(session.start);
}

export function ficheUrl(key: FicheKey): string {
  return `/exercices/${FICHES[key].file}`;
}

export interface ProgramStats {
  workMinutes: number;
  workDays: number;
  restDays: number;
  sessions: number;
}

export function programStats(program: readonly ProgramSession[] = HOLIDAY_PROGRAM): ProgramStats {
  const workDays = new Set(program.filter((session) => session.kind !== "repos").map((session) => session.date));
  return {
    workMinutes: program.reduce((sum, session) => sum + sessionMinutes(session), 0),
    workDays: workDays.size,
    restDays: program.filter((session) => session.kind === "repos").length,
    sessions: program.filter((session) => session.kind !== "repos").length,
  };
}

/** Les jours du programme, dans l'ordre, avec leurs séances. */
export function programDays(program: readonly ProgramSession[] = HOLIDAY_PROGRAM): { date: string; sessions: ProgramSession[] }[] {
  const days = new Map<string, ProgramSession[]>();
  for (const session of [...program].sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? "").localeCompare(b.start ?? ""))) {
    days.set(session.date, [...(days.get(session.date) ?? []), session]);
  }
  return [...days.entries()].map(([date, sessions]) => ({ date, sessions }));
}

/** « jeudi 22 octobre ». */
export function dayLabel(date: string): string {
  return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}

export function hoursLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, "0")}`;
}

const PARIS_CLOCK = new Intl.DateTimeFormat("en-CA", { timeZone: PARIS, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

/** L'heure de Paris, « AAAA-MM-JJTHH:mm » : le programme est écrit en heure de Paris, quel que soit le fuseau de l'appareil. */
export function parisClock(date: Date): string {
  const parts = PARIS_CLOCK.formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** La séance en cours ou, à défaut, la prochaine — `now` est l'heure de Paris, « AAAA-MM-JJTHH:mm ». */
export function nextSession(nowParis: string, program: readonly ProgramSession[] = HOLIDAY_PROGRAM): ProgramSession | null {
  const timed = program.filter((session) => session.start && session.end).sort((a, b) => `${a.date}T${a.start}`.localeCompare(`${b.date}T${b.start}`));
  return timed.find((session) => `${session.date}T${session.end}` > nowParis) ?? null;
}

/** Les événements du calendrier Apple : une séance = un événement avec son alarme, un repos = un événement sur la journée. */
export function programToIcsEvents(baseUrl: string, program: readonly ProgramSession[] = HOLIDAY_PROGRAM): IcsEvent[] {
  return program.map((session): IcsEvent => {
    const url = `${baseUrl}/seance/${session.id}`;
    if (session.kind === "repos") {
      return { uid: `${session.id}@taekdhub`, summary: `😴 ${session.title}`, description: `${session.note}\n\n${url}`, url, allDay: session.date, busy: false, categories: ["Repos"], sequence: session.version };
    }
    const lines = [
      `${session.start}–${session.end} (${sessionMinutes(session)} min) · ${session.chapter}`,
      "",
      ...session.steps.map((step, index) => `${index + 1}. ${step.label} — ${step.minutes} min : ${step.detail}`),
    ];
    if (session.fiche) lines.push("", `Fiche : ${FICHES[session.fiche.key].label} (${session.fiche.exercises})`, `PDF : ${baseUrl}${ficheUrl(session.fiche.key)}`);
    lines.push("", session.note, "", `Ouvrir la séance : ${url}`);
    return {
      uid: `${session.id}@taekdhub`,
      summary: `${session.kind === "matin" ? "📐" : "✍️"} Maths · ${session.title}`,
      description: lines.join("\n"),
      url,
      start: `${session.date}T${session.start}`,
      end: `${session.date}T${session.end}`,
      alarms: [ALARM_MINUTES],
      categories: ["Maths", "Fin de vacances"],
      busy: true,
      sequence: session.version,
    };
  });
}
