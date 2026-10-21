import { PARIS, type IcsEvent } from "@/lib/ics";
import type { Subject } from "@/lib/supabase/types";

/**
 * PROGRAMME DE FIN DE VACANCES — du jeudi 22 octobre au dimanche 1er novembre 2026 (rentrée : lundi 2 novembre),
 * et ÉCHÉANCES (DS, colles, tests de vocabulaire, devoirs à rendre) jusqu'en janvier.
 *
 * UNE SÉANCE = un créneau daté, un seul sujet, des temps dans l'ordre et, quand il y en a une, SA FICHE
 * (un PDF de `public/exercices/`). Quand il n'y a pas de fiche, la séance s'appuie sur les TD de l'élève (numéros
 * d'exercices cités) : la fiche manquante est écrite la veille, d'après ce qui a été fait (voir la note de séance).
 *
 * Charge : au moins 5 h de maths ou de physique par jour de travail (voulu par l'élève), PLUS l'anglais, le français et l'informatique, un jour de repos complet (dimanche 25 octobre), un dimanche léger
 * (1er novembre). Le vocabulaire d'anglais est appris TOUS LES JOURS, par petits paquets (répétition espacée),
 * pour que le test du 5 novembre ne se prépare pas la veille.
 *
 * C'est une donnée, pas un moteur : le plan n'est pas recalculé, il est ÉCRIT ici et modifié à la main (par Claude,
 * sur demande de l'élève). Une séance modifiée garde son `id` : les liens et le calendrier Apple se mettent à jour.
 *
 * Hypothèses (à corriger si elles sont fausses) : rentrée le lundi 2 novembre (vacances de la Toussaint 2026) ;
 * le DS de français à faire pendant les vacances dure 4 h ; heure du DS de physique du 2 novembre inconnue (4 h).
 */

export type SessionKind = "matin" | "apres-midi" | "soir" | "repos";

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

const step = (label: string, minutes: number, detail: string): ProgramStep => ({ label, minutes, detail });
const BILAN = (minutes = 15): ProgramStep =>
  step("Bilan", minutes, "Relis avec la grille de rédaction, puis note le résultat (réussi, partiel ou échec), l'aide utilisée et la cause : depuis la montre ou dans TaekdHub.");

const MATHS: Subject = "Mathématiques";
const PHYS: Subject = "Physique";
const ANGLAIS: Subject = "Anglais";
const FRANCAIS: Subject = "Français";
const INFO: Subject = "Informatique Spé";

const VOCAB_CHAPTER = "Vocabulaire — partie 10, « Concepts et relations abstraites » (p. 435-453)";
const FICHE_LA_VEILLE = "Ta fiche d'exercices arrive la veille au soir, d'après ce que tu as fait : en attendant, travaille avec les exercices de ton TD cités ci-dessus.";

/** Une séance de vocabulaire : apprendre le nouveau paquet, tester la veille (J+1) et d'il y a trois jours (J+3). */
function vocab(date: string, pages: string, minutes = 25): ProgramSession {
  return {
    id: `${date}-soir`, date, start: "20:00", end: `20:${String(minutes).padStart(2, "0")}`, kind: "soir", title: `Vocabulaire : pages ${pages}`, subject: ANGLAIS, chapter: VOCAB_CHAPTER,
    steps: [step("Apprendre", minutes - 10, `Pages ${pages} : lis les mots à voix haute, puis cache la colonne anglaise et rappelle-toi chaque mot de tête.`), step("Réviser", 10, "Teste-toi sur les pages de la veille, puis sur celles d'il y a trois jours : tes erreurs reviendront demain.")],
    fiche: null,
    note: "Chaque jour un peu : le test du 5 novembre (parties 435-453) se prépare maintenant, pas la veille. Le vocabulaire est entièrement en anglais.", version: 1,
  };
}

/** Une séance Anki : les cartes dues, de tête, sans regarder la réponse avant d'avoir répondu. */
function anki(date: string, start: string, end: string): ProgramSession {
  return {
    id: `${date}-anki`, date, start, end, kind: "apres-midi", title: "Anki : cartes dues", subject: MATHS, chapter: "Mémorisation (maths, puis physique)",
    steps: [step("Cartes dues", 30, "Ton paquet de maths (celui de ChatGPT, une fois relu), puis les cartes de physique s'il en reste. Réponds de tête avant de retourner la carte ; note « à revoir » si tu hésites plus de cinq secondes.")],
    fiche: null,
    note: "Trente minutes pendant une pause : c'est la méthode qui retient le plus par minute passée. Ne rattrape pas un retard d'un coup : fais seulement les cartes du jour.", version: 1,
  };
}

const PROGRAM_SOURCE: ProgramSession[] = [
  // ── Jeudi 22 octobre ──────────────────────────────────────────────────────────────────────
  {
    id: "2026-10-22-matin", date: "2026-10-22", start: "09:30", end: "11:30", kind: "matin", title: "Reprise des erreurs de tes copies", subject: MATHS, chapter: "Analyse (reprise de première année)",
    steps: [step("Exercices", 95, "Fiche 1, exercices R1 à R6, sans indice et sans regarder ta copie de la feuille 1 : recommence à zéro."), BILAN(25)],
    fiche: { key: "f1", exercises: "R1 à R6" },
    note: "Ce sont tes questions les plus fausses de la feuille 1. Le but n'est pas de les réussir vite, c'est de les rédiger juste. Pour R4, pense à la comparaison à une intégrale.", version: 2,
  },
  {
    id: "2026-10-22-apres-midi", date: "2026-10-22", start: "14:30", end: "16:30", kind: "apres-midi", title: "Électronique : filtres et régimes transitoires", subject: PHYS, chapter: "Électronique et électricité",
    steps: [step("Cours", 30, "Relis ton cours sur les filtres (fonction de transfert, diagramme de Bode, ordre 1 et 2) et sur les régimes transitoires."), step("Exercices", 75, "Trois exercices de ton TD ou d'annales, sans notes. Trace chaque diagramme de Bode asymptotique avant de calculer."), BILAN()],
    fiche: null, note: `DS de physique du lundi 2 novembre : l'électronique y pèse lourd. ${FICHE_LA_VEILLE}`, version: 1,
  },
  {
    id: "2026-10-22-fin-apres-midi", date: "2026-10-22", start: "16:45", end: "17:45", kind: "apres-midi", title: "DM de physique (1/3)", subject: PHYS, chapter: "DM à rendre lundi 2 novembre",
    steps: [step("Lecture et brouillon", 15, "Lis tout le sujet, repère les trois questions que tu sais faire tout de suite."), step("Rédaction", 45, "Rédige proprement la première partie, avec les schémas.")],
    fiche: null, note: "Le DM est à rendre lundi : trois séances, pas une nuit blanche le dimanche.", version: 1,
  },
  vocab("2026-10-22", "435-436"),
  // ── Vendredi 23 octobre ───────────────────────────────────────────────────────────────────
  {
    id: "2026-10-23-matin", date: "2026-10-23", start: "09:30", end: "11:30", kind: "matin", title: "Réduction : exercices de niveau concours", subject: MATHS, chapter: "Réduction des endomorphismes et des matrices",
    steps: [step("Exercices", 95, "TD « Réduction », exercices 11, 12 et 13 (CCINP) : sans notes, une copie rédigée par exercice."), BILAN(25)],
    fiche: null, note: `Les exercices 4 à 10, 17, 19 et 22 de ce TD sont ceux que tu as déjà cochés. ${FICHE_LA_VEILLE}`, version: 1,
  },
  {
    id: "2026-10-23-apres-midi", date: "2026-10-23", start: "14:30", end: "16:30", kind: "apres-midi", title: "Thermodynamique : premier et deuxième principe, système ouvert", subject: PHYS, chapter: "Thermodynamique",
    steps: [step("Cours", 30, "Relis les bilans d'énergie et d'entropie pour un système ouvert en régime stationnaire."), step("Exercices", 75, "Trois exercices de ton TD de thermo (cycles, détente, turbine ou compresseur) : écris chaque bilan avant d'appliquer les formules."), BILAN()],
    fiche: null, note: `Tu es au deuxième principe pour un système ouvert : c'est le cœur du DS de lundi. ${FICHE_LA_VEILLE}`, version: 1,
  },
  {
    id: "2026-10-23-fin-apres-midi", date: "2026-10-23", start: "16:45", end: "17:45", kind: "apres-midi", title: "DM de physique (2/3)", subject: PHYS, chapter: "DM à rendre lundi 2 novembre",
    steps: [step("Rédaction", 60, "Rédige proprement la deuxième partie, avec les schémas et les applications numériques.")],
    fiche: null, note: "Si une question te bloque plus de dix minutes, note-la et passe : on y revient mercredi.", version: 1,
  },
  vocab("2026-10-23", "437-438"),
  // ── Samedi 24 octobre ─────────────────────────────────────────────────────────────────────
  {
    id: "2026-10-24-matin", date: "2026-10-24", start: "09:00", end: "13:00", kind: "matin", title: "DS de français en conditions", subject: FRANCAIS, chapter: "DS à rendre lundi 2 novembre",
    steps: [step("Épreuve", 240, "Quatre heures d'affilée, sans notes ni téléphone : fais-le comme le vrai devoir, copie rédigée au propre.")],
    fiche: null, note: "La durée de quatre heures est une hypothèse : corrige-la si le sujet en annonce une autre.", version: 1,
  },
  vocab("2026-10-24", "439-440"),
  // ── Dimanche 25 octobre ───────────────────────────────────────────────────────────────────
  {
    id: "2026-10-25-repos", date: "2026-10-25", start: null, end: null, kind: "repos", title: "Repos complet", subject: null, chapter: "",
    steps: [], fiche: null,
    note: "Pas de travail, sauf quinze minutes de vocabulaire ce soir. L'heure change cette nuit (on recule d'une heure) : dors. Un jour de repos fait partie du programme.", version: 2,
  },
  { ...vocab("2026-10-25", "441-442", 15), title: "Vocabulaire : quinze minutes", steps: [step("Réviser", 15, "Reprends seulement les pages 435 à 440 : cache la colonne anglaise et rappelle-toi chaque mot. Rien de nouveau aujourd'hui.")] },
  // ── Lundi 26 octobre ──────────────────────────────────────────────────────────────────────
  {
    id: "2026-10-26-matin", date: "2026-10-26", start: "09:30", end: "11:30", kind: "matin", title: "Séries numériques : exercices de niveau concours", subject: MATHS, chapter: "Séries",
    steps: [step("Exercices", 95, "TD « Séries », exercices 1 (CCINP), 3 et 4 : sans notes, une copie rédigée par exercice."), BILAN(25)],
    fiche: null, note: `Séries entières et séries de fonctions arrivent ensuite : la solidité sur les séries numériques est leur base. ${FICHE_LA_VEILLE}`, version: 1,
  },
  {
    id: "2026-10-26-apres-midi", date: "2026-10-26", start: "14:30", end: "16:30", kind: "apres-midi", title: "Thermodynamique : exercices", subject: PHYS, chapter: "Thermodynamique",
    steps: [step("Exercices", 105, "Trois exercices d'annales sur les systèmes ouverts et les machines, chronométrés."), BILAN()],
    fiche: null, note: FICHE_LA_VEILLE, version: 1,
  },
  {
    id: "2026-10-26-fin-apres-midi", date: "2026-10-26", start: "16:45", end: "17:45", kind: "apres-midi", title: "DM de maths (1/3)", subject: MATHS, chapter: "DM à rendre lundi 2 novembre",
    steps: [step("Lecture et brouillon", 15, "Lis tout le sujet, repère les questions faciles et celles qui demandent une idée."), step("Rédaction", 45, "Rédige proprement la première partie.")],
    fiche: null, note: "Rédige comme sur une copie de concours : hypothèses, théorème utilisé, conclusion.", version: 1,
  },
  vocab("2026-10-26", "441-442"),
  // ── Mardi 27 octobre ──────────────────────────────────────────────────────────────────────
  {
    id: "2026-10-27-matin", date: "2026-10-27", start: "09:30", end: "11:30", kind: "matin", title: "Espaces vectoriels normés : normes et suites", subject: MATHS, chapter: "Suites et espaces vectoriels normés",
    steps: [step("Exercices", 95, "TD « Suites – Espaces vectoriels normés », exercices 1 à 4 (normes, boules, norme intégrale) : sans notes."), BILAN(25)],
    fiche: null, note: `Dans chaque exercice sur une norme, vérifie les trois axiomes séparément : l'inégalité triangulaire est celle qu'on oublie de justifier. ${FICHE_LA_VEILLE}`, version: 1,
  },
  {
    id: "2026-10-27-apres-midi", date: "2026-10-27", start: "14:30", end: "16:30", kind: "apres-midi", title: "Électronique : sujet type DS", subject: PHYS, chapter: "Électronique et électricité",
    steps: [step("Exercices", 105, "Un sujet complet d'annales d'électronique (filtres, transitoires, ALI), en 1 h 45 sans notes."), BILAN()],
    fiche: null, note: FICHE_LA_VEILLE, version: 1,
  },
  {
    id: "2026-10-27-fin-apres-midi", date: "2026-10-27", start: "16:45", end: "17:45", kind: "apres-midi", title: "DM de maths (2/3)", subject: MATHS, chapter: "DM à rendre lundi 2 novembre",
    steps: [step("Rédaction", 60, "Rédige proprement la deuxième partie.")],
    fiche: null, note: "Garde mercredi pour les questions qui te résistent encore.", version: 1,
  },
  vocab("2026-10-27", "443-444"),
  // ── Mercredi 28 octobre ───────────────────────────────────────────────────────────────────
  {
    id: "2026-10-28-matin", date: "2026-10-28", start: "09:30", end: "11:30", kind: "matin", title: "DM de maths : finition", subject: MATHS, chapter: "DM à rendre lundi 2 novembre",
    steps: [step("Questions restantes", 90, "Les questions qui te résistaient : essaie chacune vingt minutes, puis note précisément ce qui te manque."), step("Relecture", 30, "Relis l'ensemble : chaque réponse est justifiée, chaque notation définie.")],
    fiche: null, note: "Le DM sera relu une dernière fois vendredi.", version: 1,
  },
  {
    id: "2026-10-28-apres-midi", date: "2026-10-28", start: "14:30", end: "16:30", kind: "apres-midi", title: "DM de physique : finition", subject: PHYS, chapter: "DM à rendre lundi 2 novembre",
    steps: [step("Questions restantes", 90, "Les questions notées jeudi et vendredi : essaie chacune vingt minutes."), step("Relecture", 30, "Unités, chiffres significatifs, schémas : relis tout.")],
    fiche: null, note: "Dimanche, plus rien à faire sur ce DM.", version: 1,
  },
  vocab("2026-10-28", "445-446"),
  // ── Jeudi 29 octobre ──────────────────────────────────────────────────────────────────────
  {
    id: "2026-10-29-matin", date: "2026-10-29", start: "09:00", end: "13:00", kind: "matin", title: "DS blanc de physique en conditions", subject: PHYS, chapter: "Électronique, thermodynamique, électrostatique",
    steps: [step("Épreuve", 240, "Quatre heures, sans notes ni téléphone : électronique, thermo (système ouvert) et une partie d'électrostatique. Copie rédigée au propre.")],
    fiche: null, note: `C'est la répétition du DS de lundi, à la même durée. ${FICHE_LA_VEILLE}`, version: 1,
  },
  {
    id: "2026-10-29-apres-midi", date: "2026-10-29", start: "15:00", end: "16:00", kind: "apres-midi", title: "Réduction, puis premier contact avec les séries entières", subject: MATHS, chapter: "Réduction et séries entières",
    steps: [step("Réduction", 35, "TD « Réduction », exercice 16 ou 21 au choix, une question rédigée proprement."), step("Séries entières", 25, "Lis la définition du rayon de convergence et le lemme d'Abel, sans exercice : on reprend dès que ton cours démarre.")],
    fiche: null, note: "Le but n'est pas d'avancer vite, c'est d'arriver au cours de séries entières en terrain connu.", version: 1,
  },
  vocab("2026-10-29", "447-448"),
  // ── Vendredi 30 octobre ───────────────────────────────────────────────────────────────────
  {
    id: "2026-10-30-matin", date: "2026-10-30", start: "09:30", end: "11:30", kind: "matin", title: "Préparer la colle de maths du 3 novembre", subject: MATHS, chapter: "Programme de colle (à confirmer)",
    steps: [step("Cours", 40, "Relis le cours du programme de colle et les démonstrations à savoir refaire."), step("Exercices", 65, "Deux exercices types de colle, chacun dit à voix haute en cinq minutes au tableau (ou devant un mur)."), BILAN(15)],
    fiche: null, note: "Le programme de colle se lit dans ton cahier de prépa : envoie-le-moi pour que je cale les exercices dessus.", version: 1,
  },
  {
    id: "2026-10-30-apres-midi", date: "2026-10-30", start: "14:30", end: "16:30", kind: "apres-midi", title: "Correction du blanc et points faibles", subject: PHYS, chapter: "Électronique, thermodynamique, électrostatique",
    steps: [step("Correction", 60, "Corrige ton DS blanc avec le corrigé : repère les points perdus, ligne par ligne."), step("Reprise", 45, "Refais proprement les deux questions les plus ratées."), BILAN(15)],
    fiche: null, note: "Envoie-moi ta copie du blanc : je la corrige avec toi, comme pour les maths.", version: 1,
  },
  {
    id: "2026-10-30-fin-apres-midi", date: "2026-10-30", start: "16:45", end: "17:45", kind: "apres-midi", title: "Relecture finale des deux DM et un exercice à refaire", subject: MATHS, chapter: "DM à rendre lundi 2 novembre",
    steps: [step("Relecture", 30, "Relis les deux DM une dernière fois, dans la pochette où tu les rendras lundi."), step("Exercice à refaire", 30, "Reprends l'exercice de la semaine que tu as le moins bien rédigé et refais-le sans ta copie.")],
    fiche: null, note: "Ensuite, plus aucune retouche : un DM rendu vaut mieux qu'un DM parfait.", version: 1,
  },
  vocab("2026-10-30", "449-450"),
  // ── Samedi 31 octobre ─────────────────────────────────────────────────────────────────────
  {
    id: "2026-10-31-apres-midi", date: "2026-10-31", start: "14:30", end: "16:30", kind: "apres-midi", title: "Électrostatique et électronique : fiche de synthèse", subject: PHYS, chapter: "Électrostatique, électronique",
    steps: [step("Questions variées", 70, "Vingt questions courtes sur l'électrostatique (champ, potentiel, théorème de Gauss, conducteurs), réponse de tête avant de vérifier."), step("Fiche", 40, "Écris sur une page les formules et les méthodes à connaître, sans regarder ton cours."), BILAN(10)],
    fiche: null, note: "Ton professeur pose beaucoup de petites questions sur plein de sujets : la rapidité de rappel compte plus que la profondeur.", version: 1,
  },
  vocab("2026-10-31", "451-453"),
  // ── Dimanche 1er novembre ─────────────────────────────────────────────────────────────────
  {
    id: "2026-11-01-repos", date: "2026-11-01", start: null, end: null, kind: "repos", title: "Repos avant la rentrée", subject: null, chapter: "",
    steps: [], fiche: null,
    note: "Pas de travail, sauf dix minutes de vocabulaire ce soir. Prépare ton sac et ton emploi du temps de lundi : DS de physique, DM et DS de français à rendre.", version: 2,
  },
  { ...vocab("2026-11-01", "435-453", 15), title: "Vocabulaire : relecture", start: "20:00", end: "20:15", steps: [step("Réviser", 15, "Relis rapidement les pages 435 à 453, puis teste-toi sur dix mots au hasard. Rien de nouveau.")] },
  {
    id: "2026-10-24-phys", date: "2026-10-24", start: "14:30", end: "16:30", kind: "apres-midi", title: "Électrostatique : questions variées", subject: PHYS, chapter: "Électrostatique",
    steps: [step("Questions variées", 105, "Une vingtaine de questions courtes (champ, potentiel, théorème de Gauss, conducteurs), réponse de tête avant de vérifier."), step("Bilan", 15, "Note ce que tu as hésité à répondre : c'est ce qui reviendra demain.")],
    fiche: null, note: "Ton professeur pose beaucoup de petites questions sur plein de sujets : la rapidité de rappel compte autant que la profondeur.", version: 1,
  },
  {
    id: "2026-10-24-anglais", date: "2026-10-24", start: "17:00", end: "17:45", kind: "soir", title: "Anglais : compréhension et expression", subject: ANGLAIS, chapter: "Anglais écrit",
    steps: [step("Lecture", 20, "Lis un article de presse en anglais (une page)."), step("Résumé", 25, "Résume-le en cent mots, puis note dix mots utiles à ajouter à ton vocabulaire.")],
    fiche: null, note: "Prépare les DS d'anglais (19 novembre, 17 décembre) : lire vite, résumer juste, écrire dans un anglais précis.", version: 1,
  },
  {
    id: "2026-10-26-francais", date: "2026-10-26", start: "18:00", end: "19:00", kind: "soir", title: "Français-philo : lecture et fiche", subject: FRANCAIS, chapter: "Programme de français-philosophie (à préciser)",
    steps: [step("Lecture", 40, "Avance dans l'œuvre ou les textes au programme du DS du 30 novembre."), step("Fiche", 20, "Note trois citations et l'idée que chacune illustre.")],
    fiche: null, note: "Le programme exact est à me préciser : en attendant, ce créneau est réservé à la lecture.", version: 1,
  },
  {
    id: "2026-10-27-info", date: "2026-10-27", start: "18:00", end: "19:30", kind: "soir", title: "Informatique : exercices", subject: INFO, chapter: "Informatique",
    steps: [step("Exercices", 75, "Un exercice de ton TD d'informatique ou d'annales (algorithmique, SQL) : écris le code sur papier d'abord, puis teste-le."), step("Bilan", 15, "Note ce qui a bloqué : syntaxe, idée ou complexité.")],
    fiche: null, note: "Le contenu exact est à préciser : en attendant, ce créneau est réservé à l'informatique que tu avances de ton côté.", version: 1,
  },
  {
    id: "2026-10-28-phys", date: "2026-10-28", start: "16:45", end: "17:45", kind: "apres-midi", title: "Thermodynamique : un sujet d'annales", subject: PHYS, chapter: "Thermodynamique",
    steps: [step("Sujet", 50, "Un sujet complet d'annales sur les systèmes ouverts, chronométré."), step("Bilan", 10, "Compare avec le corrigé : écris où tu as perdu des points.")],
    fiche: null, note: "Entraîne-toi à écrire le bilan avant d'appliquer les formules.", version: 1,
  },
  {
    id: "2026-10-28-anglais", date: "2026-10-28", start: "18:00", end: "18:45", kind: "soir", title: "Anglais : compréhension et expression", subject: ANGLAIS, chapter: "Anglais écrit",
    steps: [step("Lecture", 20, "Lis un article de presse en anglais (une page)."), step("Résumé", 25, "Résume-le en cent mots, puis note dix mots utiles.")],
    fiche: null, note: "Même exercice que samedi : lire vite, résumer juste.", version: 1,
  },
  {
    id: "2026-10-29-info", date: "2026-10-29", start: "16:15", end: "17:45", kind: "apres-midi", title: "Informatique : exercices", subject: INFO, chapter: "Informatique",
    steps: [step("Exercices", 75, "Un exercice de ton TD d'informatique ou d'annales : écris le code sur papier d'abord."), step("Bilan", 15, "Note ce qui a bloqué.")],
    fiche: null, note: "Le contenu exact est à préciser.", version: 1,
  },
  {
    id: "2026-10-30-francais", date: "2026-10-30", start: "18:00", end: "19:00", kind: "soir", title: "Français-philo : lecture et fiche", subject: FRANCAIS, chapter: "Programme de français-philosophie (à préciser)",
    steps: [step("Lecture", 40, "Avance dans l'œuvre ou les textes au programme du DS du 30 novembre."), step("Fiche", 20, "Note trois citations et l'idée que chacune illustre.")],
    fiche: null, note: "Le programme exact est à me préciser.", version: 1,
  },
  {
    id: "2026-10-31-matin", date: "2026-10-31", start: "10:00", end: "12:00", kind: "matin", title: "Maths : dernier passage sur tes erreurs", subject: MATHS, chapter: "Reprise de la semaine",
    steps: [step("Exercices", 100, "Refais, sans notes, les trois exercices de maths de la semaine que tu as le moins bien rédigés."), step("Bilan", 20, "Relis avec la grille de rédaction et note ce qui reste fragile.")],
    fiche: null, note: "Dernière séance de maths avant la rentrée : on consolide, on n'ouvre rien de nouveau.", version: 1,
  },
  {
    id: "2026-10-31-info", date: "2026-10-31", start: "17:00", end: "18:30", kind: "apres-midi", title: "Informatique : exercices", subject: INFO, chapter: "Informatique",
    steps: [step("Exercices", 75, "Un exercice de ton TD d'informatique ou d'annales : écris le code sur papier d'abord."), step("Bilan", 15, "Note ce qui a bloqué.")],
    fiche: null, note: "Le contenu exact est à préciser.", version: 1,
  },
  // ── Anki, chaque jour de travail, pendant une pause ──────────────────────────────────────
  anki("2026-10-22", "12:15", "12:45"),
  anki("2026-10-23", "12:15", "12:45"),
  anki("2026-10-24", "13:30", "14:00"),
  anki("2026-10-26", "12:15", "12:45"),
  anki("2026-10-27", "12:15", "12:45"),
  anki("2026-10-28", "12:15", "12:45"),
  anki("2026-10-29", "13:30", "14:00"),
  anki("2026-10-30", "12:15", "12:45"),
  anki("2026-10-31", "12:15", "12:45"),
];

/** Dans l'ordre du temps : c'est l'ordre des séances « précédente » et « suivante » de la page d'une séance. */
export const HOLIDAY_PROGRAM: ProgramSession[] = [...PROGRAM_SOURCE].sort((a, b) => `${a.date}T${a.start ?? "00:00"}`.localeCompare(`${b.date}T${b.start ?? "00:00"}`) || a.id.localeCompare(b.id));

/**
 * LES ÉCHÉANCES — DS, colles, tests de vocabulaire, devoirs à rendre. Un événement par échéance dans Calendrier Apple,
 * avec des alarmes lointaines (14, 7, 3 et 1 jour) : c'est l'alerte « attention, ça approche », jamais plus.
 *
 * Sources : « Calendrier des DS 2026-2027 » (version du 31 août 2026), planning de colles du groupe G9, feuille d'anglais
 * de l'année. Les semaines de colle SC1 à SC5 sont passées ; SC10 n'est pas reprise (les deux colles tombent à la même heure :
 * lecture à confirmer).
 */
export type DeadlineKind = "ds" | "colle" | "devoir" | "oral" | "vocab";

export interface Deadline {
  id: string;
  date: string;
  /** Absents pour un événement sur la journée (heure inconnue). */
  start: string | null;
  end: string | null;
  kind: DeadlineKind;
  title: string;
  subject: Subject;
  place: string;
  note: string;
  /** Alarmes éloignées, en jours avant l'échéance. */
  alarmDays: number[];
  version: number;
}

const FAR = [14, 7, 3, 1];
const NEAR = [7, 3, 1];

export const DEADLINES: Deadline[] = [
  { id: "2026-11-02-ds-physique", date: "2026-11-02", start: null, end: null, kind: "ds", title: "DS de physique-chimie (4 h)", subject: PHYS, place: "", note: "Surtout électronique et thermodynamique ; l'électrostatique peut tomber en questions variées. Heure à préciser.", alarmDays: FAR, version: 1 },
  { id: "2026-11-02-dm-maths", date: "2026-11-02", start: null, end: null, kind: "devoir", title: "DM de maths à rendre", subject: MATHS, place: "", note: "Trois séances prévues : 26, 27 et 28 octobre.", alarmDays: NEAR, version: 1 },
  { id: "2026-11-02-dm-physique", date: "2026-11-02", start: null, end: null, kind: "devoir", title: "DM de physique à rendre", subject: PHYS, place: "", note: "Trois séances prévues : 22, 23 et 28 octobre.", alarmDays: NEAR, version: 1 },
  { id: "2026-11-02-ds-francais", date: "2026-11-02", start: null, end: null, kind: "devoir", title: "DS de français à rendre", subject: FRANCAIS, place: "", note: "À faire en conditions pendant les vacances : samedi 24 octobre.", alarmDays: NEAR, version: 1 },
  { id: "2026-11-03-colle-maths", date: "2026-11-03", start: "13:00", end: "14:00", kind: "colle", title: "Colle de maths", subject: MATHS, place: "D11", note: "Semaine de colle SC6, groupe G9. Programme à lire dans le cahier de prépa.", alarmDays: NEAR, version: 1 },
    { id: "2026-11-05-test-vocab", date: "2026-11-05", start: null, end: null, kind: "vocab", title: "Test de vocabulaire d'anglais : partie 10 (p. 435-453)", subject: ANGLAIS, place: "", note: "« Concepts et relations abstraites », Le mot et l'idée 2. Le vocabulaire est en anglais.", alarmDays: FAR, version: 1 },
  { id: "2026-11-10-colle-physique", date: "2026-11-10", start: "12:00", end: "13:00", kind: "colle", title: "Colle de physique", subject: PHYS, place: "F2-21", note: "Semaine de colle SC7 (M Poncet), groupe G9. Le mercredi 11 novembre est férié.", alarmDays: NEAR, version: 1 },
  { id: "2026-11-13-colle-maths", date: "2026-11-13", start: "13:00", end: "14:00", kind: "colle", title: "Colle de maths", subject: MATHS, place: "B2-31", note: "Semaine de colle SC7, groupe G9.", alarmDays: NEAR, version: 1 },
  { id: "2026-11-16-ds-maths", date: "2026-11-16", start: null, end: null, kind: "ds", title: "DS de maths", subject: MATHS, place: "", note: "Calendrier des DS, SA10.", alarmDays: FAR, version: 1 },
  { id: "2026-11-17-colle-maths", date: "2026-11-17", start: "12:00", end: "13:00", kind: "colle", title: "Colle de maths", subject: MATHS, place: "F1-08", note: "Semaine de colle SC8, groupe G9.", alarmDays: NEAR, version: 1 },
  { id: "2026-11-18-colle-anglais", date: "2026-11-18", start: "16:00", end: "17:00", kind: "colle", title: "Colle d'anglais", subject: ANGLAIS, place: "B2-25", note: "Semaine de colle SC8 (Mme Charderon), groupe G9.", alarmDays: NEAR, version: 1 },
  { id: "2026-11-19-ds-anglais", date: "2026-11-19", start: "08:00", end: "09:30", kind: "ds", title: "DS d'anglais (format Mines-Ponts)", subject: ANGLAIS, place: "", note: "Jeudi 19 novembre, de 8 h à 9 h 30.", alarmDays: FAR, version: 1 },
  { id: "2026-11-23-ds-physique", date: "2026-11-23", start: null, end: null, kind: "ds", title: "DS de physique-chimie", subject: PHYS, place: "", note: "Calendrier des DS, SA11.", alarmDays: FAR, version: 1 },
  { id: "2026-11-26-colle-anglais", date: "2026-11-26", start: "17:00", end: "18:00", kind: "colle", title: "Colle d'anglais", subject: ANGLAIS, place: "B3-21", note: "Semaine de colle SC9 (Mme Courtinat), groupe G9.", alarmDays: NEAR, version: 1 },
  { id: "2026-11-27-colle-maths", date: "2026-11-27", start: "16:00", end: "17:00", kind: "colle", title: "Colle de maths", subject: MATHS, place: "B3-32", note: "Semaine de colle SC9, groupe G9.", alarmDays: NEAR, version: 1 },
  { id: "2026-11-30-ds-francais", date: "2026-11-30", start: null, end: null, kind: "ds", title: "DS de français-philosophie", subject: FRANCAIS, place: "", note: "Calendrier des DS, SA12.", alarmDays: FAR, version: 1 },
  { id: "2026-12-07-ds-maths", date: "2026-12-07", start: null, end: null, kind: "ds", title: "DS de maths", subject: MATHS, place: "", note: "Calendrier des DS, SA13.", alarmDays: FAR, version: 1 },
  { id: "2026-12-14-ds-info", date: "2026-12-14", start: null, end: null, kind: "ds", title: "DS d'informatique", subject: "Informatique Spé", place: "", note: "Calendrier des DS, SA14.", alarmDays: FAR, version: 1 },
  { id: "2026-12-17-ds-anglais", date: "2026-12-17", start: "08:00", end: "12:00", kind: "ds", title: "DS d'anglais (format Centrale)", subject: ANGLAIS, place: "", note: "Jeudi 17 décembre, de 8 h à 12 h (pas d'anglais en cours le 10 décembre : maths).", alarmDays: FAR, version: 1 },
  { id: "2027-01-07-test-vocab", date: "2027-01-07", start: null, end: null, kind: "vocab", title: "Test de vocabulaire d'anglais : partie 3 (p. 129-175)", subject: ANGLAIS, place: "", note: "« La psychologie de l'homme », Le mot et l'idée 2.", alarmDays: FAR, version: 1 },
  { id: "2027-01-11-ds-physique", date: "2027-01-11", start: null, end: null, kind: "ds", title: "DS de physique-chimie", subject: PHYS, place: "", note: "Calendrier des DS, SA16.", alarmDays: FAR, version: 1 },
  { id: "2027-01-18-ds-francais", date: "2027-01-18", start: null, end: null, kind: "ds", title: "DS de français-philosophie", subject: FRANCAIS, place: "", note: "Calendrier des DS, SA17.", alarmDays: FAR, version: 1 },
  { id: "2027-01-21-ds-anglais", date: "2027-01-21", start: "08:00", end: "09:30", kind: "ds", title: "DS d'anglais (format Mines-Ponts)", subject: ANGLAIS, place: "", note: "Jeudi 21 janvier, de 8 h à 9 h 30.", alarmDays: FAR, version: 1 },
  { id: "2027-01-25-ds-maths", date: "2027-01-25", start: null, end: null, kind: "ds", title: "DS de maths", subject: MATHS, place: "", note: "Calendrier des DS, SA18.", alarmDays: FAR, version: 1 },
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
  const minutesByDay = new Map<string, number>();
  for (const session of program) minutesByDay.set(session.date, (minutesByDay.get(session.date) ?? 0) + sessionMinutes(session));
  return {
    workMinutes: program.reduce((sum, session) => sum + sessionMinutes(session), 0),
    // Un jour de travail : au moins une heure. Un dimanche de repos garde quinze minutes de vocabulaire, c'est tout.
    workDays: [...minutesByDay.values()].filter((minutes) => minutes >= 60).length,
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

const SUBJECT_ICON: Partial<Record<Subject, string>> = { Mathématiques: "📐", Physique: "⚡️", Anglais: "🇬🇧", Français: "📖", Chimie: "🧪", "Informatique Spé": "💻" };
const SUBJECT_SHORT: Partial<Record<Subject, string>> = { Mathématiques: "Maths", Physique: "Physique", Anglais: "Anglais", Français: "Français", Chimie: "Chimie", "Informatique Spé": "Info" };

const subjectIcon = (subject: Subject | null): string => (subject && SUBJECT_ICON[subject]) || "✍️";
const subjectShort = (subject: Subject | null): string => (subject && SUBJECT_SHORT[subject]) || subject || "Travail";

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
      summary: `${subjectIcon(session.subject)} ${subjectShort(session.subject)} · ${session.title}`,
      description: lines.join("\n"),
      url,
      start: `${session.date}T${session.start}`,
      end: `${session.date}T${session.end}`,
      alarms: [ALARM_MINUTES],
      categories: [subjectShort(session.subject), "Séance"],
      busy: true,
      sequence: session.version,
    };
  });
}

const DEADLINE_ICON: Record<DeadlineKind, string> = { ds: "🚨", colle: "🗣️", devoir: "📥", oral: "🎤", vocab: "🔤" };
/** Un événement sur la journée sonne à 9 h ce jour-là ; une colle ou un oral horaire sonne aussi une heure avant. */
const ALL_DAY_ALARM_HOUR = 9;

/** Minutes avant le début de l'événement pour sonner `days` jours plus tôt (à 9 h pour un événement sur la journée). */
export function deadlineAlarmMinutes(days: number, allDay: boolean): number {
  return days * 1440 - (allDay ? ALL_DAY_ALARM_HOUR * 60 : 0);
}

/** L'instant (heure de Paris, « AAAA-MM-JJTHH:mm ») où sonne une alarme de `minutes` avant l'événement. */
function alarmFiresAt(deadline: Deadline, minutes: number): string {
  const startMs = Date.parse(`${deadline.date}T${deadline.start ?? "00:00"}:00Z`);
  return new Date(startMs - minutes * 60_000).toISOString().slice(0, 16);
}

/** Les échéances : alarmes lointaines (14, 7, 3, 1 jour), sauf celles déjà passées à `nowParis` (« AAAA-MM-JJTHH:mm »). */
export function deadlinesToIcsEvents(baseUrl: string, nowParis: string, deadlines: readonly Deadline[] = DEADLINES): IcsEvent[] {
  return deadlines.map((deadline): IcsEvent => {
    const allDay = !deadline.start || !deadline.end;
    const alarms = deadline.alarmDays.map((days) => deadlineAlarmMinutes(days, allDay));
    if (!allDay && deadline.kind !== "devoir" && deadline.kind !== "ds") alarms.push(60);
    const future = alarms.filter((minutes) => alarmFiresAt(deadline, minutes) > nowParis).sort((a, b) => b - a);
    const lines = [...(deadline.place ? [`Salle ${deadline.place}`] : []), deadline.note, "", `Le programme : ${baseUrl}/calendrier`];
    const base = { uid: `${deadline.id}@taekdhub`, summary: `${DEADLINE_ICON[deadline.kind]} ${deadline.title}${deadline.place ? ` (${deadline.place})` : ""}`, description: lines.join("\n"), url: `${baseUrl}/calendrier`, alarms: future, categories: [subjectShort(deadline.subject), "Échéance"], busy: !allDay, sequence: deadline.version };
    return allDay ? { ...base, allDay: deadline.date } : { ...base, start: `${deadline.date}T${deadline.start}`, end: `${deadline.date}T${deadline.end}` };
  });
}

/** Tout le calendrier : les séances puis les échéances. */
export function calendarEvents(baseUrl: string, now: Date): IcsEvent[] {
  return [...programToIcsEvents(baseUrl), ...deadlinesToIcsEvents(baseUrl, parisClock(now))];
}
