import { describe, expect, it } from "vitest";
import { createChapter } from "@/lib/chapter-memory";
import { addLockCards } from "@/lib/course-lock";
import { createErrorEntry } from "@/lib/error-log";
import { createGrade } from "@/lib/grades";
import { buildFreshness, buildHermesEcheances, buildHermesToday, HERMES_SCHEMA_VERSION, STALE_AFTER_HOURS } from "@/lib/hermes-snapshot";
import { computeNextMove, topReasons } from "@/lib/next-move/engine";
import { recordProposal } from "@/lib/next-move/history";
import { PROGRAMME, PROGRAMME_BY_ID } from "@/lib/programme-data";
import { createReviewItem } from "@/lib/review-items";
import { ERROR_TYPE_META } from "@/lib/error-log";
import { MOVE_KIND_LABEL } from "@/lib/next-move/engine";
import { buildTodaySnapshot } from "@/lib/today-snapshot";
import { subjects } from "@/lib/study";
import { createWorkItem } from "@/lib/work-items";
import { WORK_ITEM_KIND_META } from "@/lib/work-items";
import type { NextMoveInput } from "@/lib/next-move/engine";
import { normalizePreferences } from "@/lib/storage";

/**
 * LA VUE D'HERMES NE CONTIENT AUCUN TEXTE LIBRE — ni directement, ni
 * indirectement.
 *
 * Méthode : un élève dont CHAQUE champ de texte porte une chaîne témoin
 * (`ZSENTINELZ_…`), des identifiants reconnaissables, et dont les phrases du
 * moteur (raisons, historique, clés d'exercices) en recopient forcément
 * certaines. La réponse entière est ensuite sérialisée : aucun témoin, aucun
 * identifiant. Un second contrôle, plus sévère, exige que CHAQUE chaîne de la
 * réponse appartienne à une liste fermée.
 */

const S = "ZSENTINELZ";
const NOW = new Date(2026, 8, 24, 10, 0);
const day = (offset: number) => {
  const date = new Date(NOW);
  date.setDate(date.getDate() + offset);
  return date.toLocaleDateString("en-CA");
};
const NO_TARGETS = { Mathématiques: 0, Physique: 0, Chimie: 0, "Informatique TC": 0, "Informatique Spé": 0, Français: 0, Anglais: 0 };

const IDS = { dm: "id-secret-echeance-dm", ds: "id-secret-echeance-ds", exo: "id-secret-echeance-exo", attempt: "id-secret-tentative", log: "id-secret-annale", memory: "id-secret-chapitre-libre", card: "id-secret-fiche" };

/** Un élève complet : tout ce qui est saisissable porte un témoin. */
function student() {
  const workItems = [
    { ...createWorkItem({ title: `DM ${S}_TITRE_DM`, kind: "dm", subject: "Mathématiques", estimatedMinutes: 120, dueDate: day(1), important: true }, NOW), id: IDS.dm, note: `${S}_NOTE_DM` },
    { ...createWorkItem({ title: `DS ${S}_TITRE_DS`, kind: "ds", subject: "Physique", estimatedMinutes: 90, dueDate: day(6) }, NOW), id: IDS.ds, note: `${S}_NOTE_DS` },
    { ...createWorkItem({ title: `Feuille ${S}_TITRE_EXO`, kind: "exercices", subject: "Chimie", estimatedMinutes: 60, dueDate: day(11) }, NOW), id: IDS.exo },
    // Terminée / abandonnée : ne doit apparaître nulle part.
    { ...createWorkItem({ title: `Fini ${S}_TITRE_FINI`, kind: "dm", subject: "Mathématiques", estimatedMinutes: 30, dueDate: day(2) }, NOW), id: "id-secret-termine", status: "terminé" as const },
  ];
  const sessions = [
    { id: "s1", subject: "Mathématiques", exercise_id: null, started_at: new Date(2026, 8, 23, 18).toISOString(), ended_at: new Date(2026, 8, 23, 19).toISOString(), duration_seconds: 3600, note: `${S}_NOTE_SEANCE`, created_at: new Date(2026, 8, 23, 19).toISOString(), result: null, hints_used: null, work_item_id: IDS.dm },
  ];
  const memoryProgramme = { ...createChapter({ subject: "Mathématiques", title: `Réduction des endomorphismes ${S}_MEMOIRE`, learnedAt: "2026-08-01" }, new Date(2026, 7, 1, 12), "id-secret-chapitre-programme") };
  const memoryLibre = { ...createChapter({ subject: "Physique", title: `${S}_CHAPITRE_LIBRE`, learnedAt: "2026-08-01" }, new Date(2026, 7, 1, 12), IDS.memory) };
  const locks = addLockCards([], [
    { matiere: "maths", chapitre: "Réduction", recto: `${S}_RECTO_1`, verso: `${S}_VERSO_1`, raison: `${S}_RAISON_1` },
    { matiere: "physique", chapitre: `${S}_CHAPITRE_VERROU_LIBRE`, recto: `${S}_RECTO_2`, verso: `${S}_VERSO_2`, raison: `${S}_RAISON_2` },
  ], new Date(2026, 8, 20, 12));
  const reviewItems = [...(locks.ok ? locks.items : []), { ...createReviewItem({ subject: "Chimie", text: `${S}_FICHE_ORDINAIRE`, kind: "à revoir" }, new Date(2026, 8, 10))!, id: IDS.card }];
  const errors = [createErrorEntry({ subject: "Mathématiques", type: "calcul", source: "exercice", description: `${S}_ERREUR_DESCRIPTION`, fix: `${S}_ERREUR_CORRECTION`, date: day(-2) }, NOW)!];
  const attempts = [
    { id: IDS.attempt, exerciseKey: `exercice:${S.toLowerCase()}-exo`, label: `Exercice ${S}_LIBELLE`, subject: "Mathématiques", chapterId: "m2-reduction", origin: "exercice", day: day(-3), createdAt: new Date(2026, 8, 21, 18).toISOString(), updatedAt: new Date(2026, 8, 21, 18).toISOString(), result: "échec", help: "sans", minutes: 20, plannedMinutes: 15, cause: "cours", lackOfTime: false, gradeId: null, note: `${S}_NOTE_TENTATIVE`, analysis: { missed: `${S}_A1`, derailedAt: `${S}_A2`, tool: `${S}_A3`, cue: `${S}_A4` } },
  ];
  const grades = [createGrade({ subject: "Physique", title: `${S}_NOTE_TITRE`, kind: "ds", date: day(-8), score: 12, maxScore: 20 }, NOW)!];
  const checkins = [{ date: day(-1), sleepHours: 7, energy: 3, stress: 2, note: `${S}_NOTE_CHECKIN`, updatedAt: new Date(2026, 8, 23, 21).toISOString() }];
  const ankiSnapshots = [
    { id: "anki:2026-09-23", day: day(-1), takenAt: new Date(2026, 8, 23, 20).toISOString(), source: "fichier", decks: [{ name: `MP::${S}_PAQUET`, total: 40, due: 7, reviewed30: 20, failed30: 3, mature: 10, lapsing: 1 }], reviewsByDay: [], manual: null },
  ];
  const preferences = normalizePreferences({ displayName: `${S}_PRENOM`, contestDate: "2027-04-20", eveningMinimums: [{}, {}, {}, {}, {}, {}, {}], weeklySubjectTargets: NO_TARGETS, capacityByWeekday: [240, 240, 240, 240, 240, 240, 240], planningMarginPercent: 0 });
  const base: NextMoveInput = { sessions: sessions as never, workItems, grades, reviewItems, errors, checkins, chapterMemory: [memoryProgramme, memoryLibre], preferences, history: [], now: NOW, availableMinutes: null };
  // L'historique recopie les raisons du moteur, qui citent les titres : le pire cas indirect.
  const plan = computeNextMove(base);
  const nextMoves = plan.primary ? recordProposal([], plan.primary, 30, topReasons(plan.primary, 4), NOW, "id-secret-recommandation") : [];
  const collections: Record<string, unknown> = { sessions, workItems, grades, reviewItems, errors, checkins, chapterMemory: [memoryProgramme, memoryLibre], nextMoves, preferences, attempts, ankiSnapshots };
  const annales = [
    { id: IDS.log, created_at: new Date(2026, 8, 22, 17).toISOString(), matiere: "maths", chapitre: `Réduction ${S}_ANNALE_CHAPITRE`, source: `${S}_ANNALE_SOURCE`, niveau: "Mines", resultat: "échec", indices: 2, temps_min: 40, temps_prevu: 30, aide: "indices", commentaire: `${S}_ANNALE_COMMENTAIRE`, erreurs: [`${S}_ANNALE_ERREUR`] },
    { id: "id-secret-annale-2", created_at: new Date(2026, 8, 21, 17).toISOString(), matiere: `${S}_MATIERE_INCONNUE`, chapitre: `${S}_ANNALE_CHAPITRE_LIBRE`, source: `${S}_ANNALE_SOURCE_2`, niveau: "CCINP", resultat: "réussi", indices: 0, temps_min: 20, temps_prevu: 20, aide: "sans", commentaire: null, erreurs: [] },
    { id: "id-secret-annale-3", created_at: new Date(2026, 8, 20, 17).toISOString(), matiere: "maths", chapitre: `Réduction ${S}_ANNALE_CHAPITRE`, source: `${S}_ANNALE_SOURCE`, niveau: "Mines", resultat: "échec", indices: 1, temps_min: 35, temps_prevu: 30, aide: "indices", commentaire: null, erreurs: [] },
  ];
  const stamps = Object.fromEntries(Object.keys(collections).map((name) => [name, new Date(2026, 8, 24, 9, 30).toISOString()]));
  return { collections, annales, stamps };
}

const { collections, annales, stamps } = student();
const today = buildHermesToday(collections, annales, stamps, NOW);
const echeances = buildHermesEcheances(collections, stamps, NOW);
const everything = JSON.stringify({ today, echeances });

/** Toutes les chaînes d'une valeur JSON, avec leur chemin. */
function strings(value: unknown, path = "$"): Array<{ path: string; value: string }> {
  if (typeof value === "string") return [{ path, value }];
  if (Array.isArray(value)) return value.flatMap((entry, index) => strings(entry, `${path}[${index}]`));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([key, entry]) => strings(entry, `${path}.${key}`));
  return [];
}

describe("vue d'Hermes — le jeu de données de test est bien riche (garde-fou contre un test vide)", () => {
  it("la vue de Claude, elle, contient bien les textes libres : le test mesure quelque chose", () => {
    const claude = JSON.stringify(buildTodaySnapshot(collections, annales, NOW));
    for (const witness of [`${S}_TITRE_DM`, `${S}_RECTO_1`, `${S}_ERREUR_DESCRIPTION`, `${S}_ANNALE_SOURCE`]) expect(claude).toContain(witness);
  });

  it("la vue d'Hermes est riche : échéances, verrous, erreurs, chapitres, annales, Anki, prochain mouvement", () => {
    expect(today.echeances.length).toBeGreaterThanOrEqual(2);
    expect(today.prochain_mouvement).not.toBeNull();
    expect(today.verrous.length).toBe(2);
    expect(today.erreurs_recentes).toHaveLength(1);
    expect(today.chapitres_qui_s_effacent.length).toBeGreaterThanOrEqual(1);
    expect(today.a_refaire_sans_aide.length).toBeGreaterThanOrEqual(1);
    expect(today.annales.total).toBe(3);
    expect(today.anki.cartes_dues?.nombre).toBe(7);
    expect(echeances.echeances.length).toBe(3);
  });
});

describe("vue d'Hermes — aucun texte libre, même indirect", () => {
  it("aucune chaîne témoin, sous aucune forme (casse, accents, tirets)", () => {
    expect(everything).not.toMatch(/zsentinelz/i);
    expect(everything.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()).not.toContain("sentinel");
  });

  it("aucun identifiant d'échéance, de tentative, de fiche, d'annale, de chapitre libre ou de recommandation", () => {
    for (const id of [...Object.values(IDS), "id-secret-termine", "id-secret-annale-2", "id-secret-annale-3", "id-secret-chapitre-programme", "id-secret-recommandation"]) expect(everything).not.toContain(id);
    expect(everything).not.toMatch(/id-secret/);
  });

  it("aucune clé de recommandation ni d'exercice (elles recopient le libellé simplifié)", () => {
    expect(everything).not.toMatch(/échéance:|refaire:|transfert:|rappel:|annale:|exercice:|verrou:|cours:/);
  });

  it("les données de l'élève ne fuient pas : prénom, notes, fiches, textes d'erreurs, paquets Anki", () => {
    for (const text of ["PRENOM", "NOTE_TITRE", "FICHE_ORDINAIRE", "ERREUR_DESCRIPTION", "PAQUET", "NOTE_CHECKIN", "NOTE_SEANCE"]) expect(everything).not.toContain(text);
  });

  it("CONTRÔLE SÉVÈRE : chaque chaîne de la réponse appartient à une liste fermée", () => {
    const programmeTitles = new Set(PROGRAMME.map((chapter) => chapter.title));
    const closed = new Set<string>([
      ...subjects,
      ...Object.keys(MOVE_KIND_LABEL),
      "pause",
      ...Object.values(WORK_ITEM_KIND_META).map((meta) => meta.label),
      ...Object.values(ERROR_TYPE_META).map((meta) => meta.label),
      ...programmeTitles,
      ...PROGRAMME_BY_ID.keys(),
      // statuts du jour, constats, niveaux, états, sources Anki, résultats d'annales
      "ok", "calme", "vide", "repos", "trop-court",
      "cours", "démonstration", "méthode", "application", "difficile", "calcul", "temps", "démarrage",
      "établi", "signal", "tient", "fragile", "inconnu",
      "ankiconnect", "fichier", "manuel",
      "réussi", "partiel", "échec",
    ]);
    const isoDate = /^\d{4}-\d{2}-\d{2}$/;
    const isoInstant = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
    const termId = /^[a-zà-ÿ0-9:-]{1,48}$/;
    const outside = strings({ today, echeances }).filter(({ path, value }) => {
      if (path.endsWith(".precision")) return false; // phrase fixe du code, vérifiée à part
      if (path.endsWith(".raisons[0].id") || /\.raisons\[\d+\]\.id$/.test(path)) return !termId.test(value);
      if (/\.fraicheur\.collections\./.test(path) || isoDate.test(value) || isoInstant.test(value)) return !(isoDate.test(value) || isoInstant.test(value));
      return !closed.has(value);
    });
    expect(outside).toEqual([]);
  });

  it("les clés de chaque objet d'échéance sont exactement celles prévues : ni id, ni titre, ni note, ni chapitres", () => {
    const allowed = ["dans_jours", "date", "important", "matiere", "reste_min", "type"];
    for (const entry of [...today.echeances, ...echeances.echeances]) expect(Object.keys(entry).sort()).toEqual(allowed);
  });

  it("les chapitres tapés par l'élève sont ramenés au programme officiel, ou à null", () => {
    const ids = (refs: Array<{ chapitre: { id: string } | null }>) => new Set(refs.map((entry) => entry.chapitre?.id ?? null));
    expect(ids(today.chapitres_qui_s_effacent)).toEqual(new Set(["m2-reduction", null]));
    expect(ids(today.verrous)).toEqual(new Set(["m2-reduction", null]));
    expect(today.annales.chapitres_qui_bloquent.every((weak) => weak.chapitre === null || PROGRAMME_BY_ID.has(weak.chapitre.id))).toBe(true);
  });

  it("les raisons du prochain mouvement ne portent que des identifiants techniques et des points", () => {
    for (const reason of today.prochain_mouvement!.raisons) {
      expect(Object.keys(reason).sort()).toEqual(["id", "points"]);
      expect(reason.id).toMatch(/^[a-zà-ÿ0-9:-]+$/);
    }
  });

  it("aucune matière saisie à la main ne traverse : une matière inconnue devient null", () => {
    expect(today.annales.dernieres.some((entry) => entry.matiere === null)).toBe(true);
  });
});

describe("list_echeances pour Hermes", () => {
  it("ne renvoie que les échéances à faire, à venir, la plus proche d'abord, sans terminé ni abandonné", () => {
    expect(echeances.echeances.map((entry) => entry.dans_jours)).toEqual([1, 6, 11]);
    expect(echeances.echeances.map((entry) => entry.type)).toEqual([WORK_ITEM_KIND_META.dm.label, WORK_ITEM_KIND_META.ds.label, WORK_ITEM_KIND_META.exercices.label]);
  });

  it("le paramètre `jours` borne l'horizon", () => {
    expect(buildHermesEcheances(collections, stamps, NOW, 6).echeances).toHaveLength(2);
    expect(buildHermesEcheances(collections, stamps, NOW, 0).echeances).toHaveLength(0);
  });

  it("une échéance passée n'y figure pas, comme dans l'outil de Claude", () => {
    const late = { ...collections, workItems: [createWorkItem({ title: `${S}_RETARD`, kind: "dm", subject: "Chimie", estimatedMinutes: 30, dueDate: day(-3) }, NOW)] };
    expect(buildHermesEcheances(late, stamps, NOW).echeances).toEqual([]);
  });

  it("des collections absentes ou abîmées donnent des listes vides, sans exception", () => {
    expect(() => buildHermesEcheances({}, {}, NOW)).not.toThrow();
    expect(() => buildHermesToday({ workItems: "x", sessions: 42 }, "n'importe quoi", {}, NOW)).not.toThrow();
    expect(buildHermesEcheances({ workItems: { a: 1 } }, {}, NOW).echeances).toEqual([]);
  });
});

describe("fraîcheur — une absence de synchronisation récente, pas une preuve d'erreur", () => {
  const at = (hoursAgo: number) => new Date(NOW.getTime() - hoursAgo * 3_600_000).toISOString();
  const fresh = (stampsInput: Record<string, string | null | undefined>) => buildFreshness(stampsInput, NOW);

  it("expose la version du format et l'instant de génération", () => {
    expect(fresh({}).schema_version).toBe(HERMES_SCHEMA_VERSION);
    expect(fresh({}).generated_at).toBe(NOW.toISOString());
  });

  it(`récent (< ${STALE_AFTER_HOURS} h) : pas ancien ; au-delà : ancien`, () => {
    expect(fresh({ sessions: at(10) }).fraicheur.donnees_anciennes).toBe(false);
    expect(fresh({ sessions: at(STALE_AFTER_HOURS) }).fraicheur.donnees_anciennes).toBe(false);
    expect(fresh({ sessions: at(STALE_AFTER_HOURS + 1) }).fraicheur.donnees_anciennes).toBe(true);
    expect(fresh({ sessions: at(72) }).fraicheur.anciennete_heures).toBe(72);
  });

  it("la collection de travail la plus récente décide ; une préférence récente ne rajeunit pas un travail ancien", () => {
    expect(fresh({ sessions: at(100), errors: at(5) }).fraicheur.donnees_anciennes).toBe(false);
    expect(fresh({ sessions: at(100), preferences: at(1), checkins: at(1) }).fraicheur.donnees_anciennes).toBe(true);
  });

  it("rien de synchronisé : ancien, sans date inventée", () => {
    const empty = fresh({}).fraicheur;
    expect(empty.donnees_anciennes).toBe(true);
    expect(empty.derniere_synchro_travail).toBeNull();
    expect(empty.anciennete_heures).toBeNull();
  });

  it("des noms de collection inconnus et des dates illisibles ne traversent pas", () => {
    const result = fresh({ sessions: at(1), [`${S}_inconnue`]: at(1), errors: "pas-une-date" }).fraicheur.collections;
    expect(Object.keys(result).sort()).toEqual(["errors", "sessions"]);
    expect(result.errors).toBeNull();
  });

  it("dit clairement ce que le signal veut dire, et ce qu'il ne dit pas", () => {
    const { precision, seuil_heures } = fresh({}).fraicheur;
    expect(seuil_heures).toBe(48);
    expect(precision).toMatch(/absence de synchronisation récente/i);
    expect(precision).toMatch(/pas des données nécessairement incorrectes/i);
  });

  it("la fraîcheur accompagne les deux outils", () => {
    expect(today.meta.fraicheur.donnees_anciennes).toBe(false);
    expect(echeances.meta.fraicheur.donnees_anciennes).toBe(false);
    expect(buildHermesToday(collections, annales, { sessions: at(100) }, NOW).meta.fraicheur.donnees_anciennes).toBe(true);
  });
});
