import { getChaptersForSubject } from "@/lib/chapters";
import { canonicalLabel } from "@/lib/utils";
import { DEFAULT_MASTERY, type Chapter } from "@/lib/storage";
import { exerciseTypes, subjects } from "@/lib/study";
import type { NewExerciseInput } from "@/components/exercises/exercise-form";
import type { Difficulty, Exercise, ExerciseLevel, ExerciseType, Filiere, LicenseStatus, ProgrammeLevel, Provenance, Subject } from "@/lib/supabase/types";

/**
 * Import en masse d'exercices (Sprint infrastructure banque) — un fichier
 * JSON (tableau d'objets) plutôt qu'un exercice à la fois via le formulaire.
 * Volontairement STRICT sur les valeurs énumérées (matière, type) : contrairement
 * à `validateBackupPayload` (lib/storage.ts, permissif car il migre d'anciennes
 * sauvegardes internes), ici la source est un fichier écrit par l'utilisateur
 * — une erreur explicite par ligne vaut mieux qu'une matière silencieusement
 * remplacée par une autre.
 */

/**
 * Concours acceptés dans le dataset principal, par ordre de priorité pour la
 * prépa MP (consigne produit) — clé : alias reconnus en entrée (minuscules,
 * sans accent/tiret normalisés), valeur : libellé canonique stocké sur
 * `Exercise.competition`. e3a et Banque PT sont acceptés mais doivent rester
 * minoritaires dans le dataset (vérifié au niveau du rapport, pas ici).
 */
const COMPETITION_ALIASES: Record<string, string> = {
  ccinp: "CCINP",
  ccp: "CCINP",
  "mines-ponts": "Mines-Ponts",
  minesponts: "Mines-Ponts",
  "mines ponts": "Mines-Ponts",
  e3a: "e3a",
  "e3a-polytech": "e3a",
  "e3a polytech": "e3a",
  pt: "PT",
  "banque pt": "PT",
  centrale: "Centrale",
  "centrale-supelec": "Centrale",
  "centrale supelec": "Centrale",
  "centrale-supélec": "Centrale",
  // Autres banques réellement passées par un élève de MP. X et ENS restent
  // volontairement hors périmètre (voir EXCLUDED_COMPETITIONS).
  "tpe-eivp": "TPE-EIVP", tpe: "TPE-EIVP", eivp: "TPE-EIVP",
  ensiie: "ENSIIE",
  imt: "IMT", "mines-telecom": "IMT", "mines-télécom": "IMT", enstim: "IMT",
};

/**
 * Explicitement HORS périmètre, jamais importés quelle que soit la casse ou
 * l'orthographe : choix de l'élève, qui ne prépare pas ces concours et ne
 * veut pas que leurs exercices viennent gonfler sa banque.
 */
const FILIERES: readonly Filiere[] = ["MP", "MPI", "PC", "PSI", "PT", "TSI"];
const PROVENANCES: readonly Provenance[] = ["concours-verifie", "concours-partiel", "enseignant", "originale"];

const EXCLUDED_COMPETITIONS = new Set(["x", "ens", "polytechnique", "ens ulm", "ens lyon", "ens paris-saclay", "ens cachan", "ens rennes", "x-ens", "x/ens"]);

function normalizeCompetitionKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Construit un Exercise complet à partir des champs saisis — seule source de
 * vérité pour les valeurs par défaut (priorité, maîtrise, statut initial…),
 * réutilisée par components/exercises/exercise-manager.tsx#create ET par
 * l'import en masse ci-dessous, pour ne jamais les faire diverger. */
export function createExerciseFromInput(input: NewExerciseInput): Exercise {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    subject: input.subject,
    title: input.title,
    statement: input.statement ?? "",
    chapter_id: input.chapterId,
    source: input.source,
    year: input.year ?? null,
    competition: input.competition ?? null,
    programme_level: input.programmeLevel ?? null,
    license_status: input.licenseStatus ?? null,
    external_id: input.externalId ?? null,
    epreuve: input.epreuve ?? null,
    filieres: input.filieres ?? [],
    exercise_number: input.exerciseNumber ?? null,
    // Le niveau de provenance n'est jamais deviné à la hausse : sans
    // déclaration explicite, un exercice portant un concours est au mieux
    // « partiel », et un exercice sans concours est une création propre.
    provenance: input.provenance ?? (input.competition ? "concours-partiel" : "originale"),
    source_url: input.sourceUrl ?? null,
    prerequisites: input.prerequisites ?? [],
    pedagogical_goal: input.pedagogicalGoal ?? null,
    level: input.level ?? null,
    type: input.type,
    difficulty: input.difficulty,
    mastery: DEFAULT_MASTERY,
    status: "à faire",
    estimated_minutes: input.estimatedMinutes,
    attempts: 0,
    note: input.note || null,
    created_at: now,
    updated_at: now,
    tags: input.tags,
    hints: input.hints,
    correction: input.correction || null,
    favorite: false,
    archived: input.archived ?? false,
    last_worked_at: null,
  };
}

export interface ExerciseImportRowError {
  index: number;
  message: string;
}

export interface ParsedImportRow {
  index: number;
  input: NewExerciseInput;
  /** Libellé de chapitre tel qu'écrit dans le fichier — `null` si non renseigné. */
  chapterLabel: string | null;
  /** `true` si `chapterLabel` ne correspond à aucun chapitre existant pour cette matière : sera créé au moment de la validation par l'utilisateur, jamais silencieusement. */
  isNewChapter: boolean;
}

export interface ExerciseImportParseResult {
  rows: ParsedImportRow[];
  errors: ExerciseImportRowError[];
  /**
   * Lignes écartées parce qu'elles existent DÉJÀ — dans la banque de l'élève
   * ou plus haut dans le fichier lui-même. Distinguées des `errors` : ce
   * n'est pas un fichier mal formé, c'est un import qu'on a déjà fait. Sans
   * cette détection, réimporter le même recueil doublait la banque en
   * silence, et l'élève retombait deux fois sur le même exercice.
   */
  duplicates: ExerciseImportRowError[];
}

/**
 * Clés d'identité d'un exercice.
 *
 * L'identifiant externe FAIT FOI quand il existe : il vient de la source et
 * désigne un exercice précis. Deux exercices d'une même banque peuvent très
 * bien porter le même intitulé — « Montrer que f est de classe C¹ » n'a rien
 * d'unique — et les confondre reviendrait à en perdre un. On ne cherche donc
 * sur le titre QUE lorsque aucun identifiant n'est fourni.
 *
 * En revanche on ENREGISTRE les deux clés : une fiche sans identifiant
 * importée plus tard, mais de même titre, doit bien être reconnue.
 */
function identityKeys(subject: string, title: string, externalId: string | null): { lookup: string[]; register: string[] } {
  const titleKey = `titre::${subject}::${canonicalLabel(title)}`;
  if (externalId) {
    const idKey = `id::${externalId}`;
    return { lookup: [idKey], register: [idKey, titleKey] };
  }
  return { lookup: [titleKey], register: [titleKey] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseListField(value: unknown, splitOn: string): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
  if (typeof value === "string") return value.split(splitOn).map((item) => item.trim()).filter(Boolean);
  return [];
}

/**
 * Valide et normalise un fichier JSON importé — un tableau d'objets, un par
 * exercice. Chaque ligne est traitée indépendamment : une ligne invalide
 * n'empêche jamais les autres d'être importées, elle est simplement listée
 * dans `errors` pour que l'utilisateur puisse la corriger et réessayer.
 */
export function parseExerciseImportPayload(
  raw: unknown,
  chapters: Chapter[],
  existing: Exercise[] = []
): ExerciseImportParseResult {
  const rows: ParsedImportRow[] = [];
  const errors: ExerciseImportRowError[] = [];
  const duplicates: ExerciseImportRowError[] = [];

  if (!Array.isArray(raw)) {
    errors.push({ index: 0, message: "Le fichier doit contenir un tableau JSON (une entrée par exercice)." });
    return { rows, errors, duplicates };
  }

  const seen = new Set<string>();
  for (const exercise of existing) {
    for (const key of identityKeys(exercise.subject, exercise.title, exercise.external_id).register) seen.add(key);
  }

  raw.forEach((entry, index) => {
    const label = `Ligne ${index + 1}`;
    if (!isRecord(entry)) {
      errors.push({ index, message: `${label} — ce n'est pas un objet JSON valide.` });
      return;
    }

    const title = asTrimmedString(entry.title);
    if (!title) {
      errors.push({ index, message: `${label} — champ "title" manquant.` });
      return;
    }

    const source = asTrimmedString(entry.source);
    if (!source) {
      errors.push({ index, message: `${label} ("${title}") — champ "source" manquant.` });
      return;
    }

    // Un exercice SANS énoncé est un cul-de-sac : le mode focus n'affiche
    // rien à chercher ("Aucun énoncé renseigné pour cet exercice", voir
    // components/exercises/focus-view.tsx) et renvoie l'élève éditer la fiche
    // lui-même — impossible pour du contenu de banque dont il n'a pas la
    // source papier. Quinze fiches de ce type avaient traversé l'import et
    // s'étaient installées durablement dans la banque de l'élève. La porte se
    // ferme ICI, à la frontière, plutôt que d'être rattrapée en aval.
    const statement = typeof entry.statement === "string" ? entry.statement.trim() : "";
    if (!statement) {
      errors.push({ index, message: `${label} ("${title}") — champ "statement" manquant ou vide : un exercice sans énoncé n'est pas travaillable.` });
      return;
    }

    const subjectRaw = asTrimmedString(entry.subject);
    const subject = subjectRaw && (subjects as string[]).includes(subjectRaw) ? (subjectRaw as Subject) : null;
    if (!subject) {
      errors.push({
        index,
        message: `${label} ("${title}") — matière invalide${subjectRaw ? ` ("${subjectRaw}")` : " (absente)"}. Attendu : ${subjects.join(", ")}.`,
      });
      return;
    }

    const typeRaw = asTrimmedString(entry.type);
    if (typeRaw && !(exerciseTypes as string[]).includes(typeRaw)) {
      errors.push({ index, message: `${label} ("${title}") — type invalide ("${typeRaw}"). Attendu : ${exerciseTypes.join(", ")}.` });
      return;
    }
    const type: ExerciseType = (typeRaw as ExerciseType) ?? "Personnel";

    const difficultyRaw = entry.difficulty;
    if (difficultyRaw !== undefined && difficultyRaw !== null && (typeof difficultyRaw !== "number" || difficultyRaw < 1 || difficultyRaw > 5)) {
      errors.push({ index, message: `${label} ("${title}") — difficulté invalide (attendu un nombre entre 1 et 5).` });
      return;
    }
    const difficulty = (difficultyRaw ? (Math.round(difficultyRaw as number) as Difficulty) : 3) as Difficulty;

    const estimatedRaw = entry.estimatedMinutes ?? entry.estimated_minutes;
    const estimatedMinutes = typeof estimatedRaw === "number" && estimatedRaw > 0 ? Math.round(estimatedRaw) : null;

    // Concours (Sprint infrastructure banque concours) : X/ENS explicitement
    // hors périmètre, tout autre concours reconnu est normalisé vers son
    // libellé canonique — voir COMPETITION_ALIASES.
    const competitionRaw = asTrimmedString(entry.competition);
    let competition: string | null = null;
    if (competitionRaw) {
      const key = normalizeCompetitionKey(competitionRaw);
      if (EXCLUDED_COMPETITIONS.has(key)) {
        errors.push({ index, message: `${label} ("${title}") — X/ENS est hors périmètre (choix de l'élève), non importé.` });
        return;
      }
      competition = COMPETITION_ALIASES[key] ?? null;
      if (!competition) {
        errors.push({
          index,
          message: `${label} ("${title}") — concours non reconnu ("${competitionRaw}"). Attendu : ${[...new Set(Object.values(COMPETITION_ALIASES))].join(", ")}.`,
        });
        return;
      }
    }

    const archived = entry.archived === true;

    /**
     * Niveau de programme — désormais une simple ÉTIQUETTE, plus une mise en
     * quarantaine.
     *
     * Ce pipeline a été écrit quand l'élève était en Sup. Il imposait alors
     * trois règles cohérentes entre elles : un exercice de concours actif
     * devait être "sup", un exercice "spe" devait être importé archivé, et
     * les paliers 4 (transition Spé) et 6 (expert) aussi. Objectif de
     * l'époque : que rien de deuxième année ne se glisse dans les
     * recommandations d'un élève qui n'avait pas encore vu le cours.
     *
     * L'élève est maintenant en MP. Ces trois règles disent donc exactement
     * l'inverse de ce qu'il faut : elles archivent — c'est-à-dire rendent
     * invisibles à la liste ET au moteur de recommandation — précisément le
     * contenu qu'il doit travailler. Sur les 440 exercices amorcés, les 18
     * classés "spe" étaient tous archivés, ce qui ne laissait aucun exercice
     * actif sur la réduction des endomorphismes, les séries entières, les
     * préhilbertiens ou les intégrales généralisées.
     *
     * Les trois gardes sont donc retirées. `programme_level` reste stocké et
     * reste utile (savoir ce qui est révision de Sup et ce qui est programme
     * de Spé), mais il ne décide plus de la visibilité. `archived` redevient
     * ce qu'il devrait toujours être : un choix de l'élève, pas une déduction
     * du pipeline d'import.
     */
    const programmeLevelRaw = asTrimmedString(entry.programmeLevel ?? entry.programme_level);
    let programmeLevel: ProgrammeLevel | null = null;
    if (programmeLevelRaw) {
      if (!["sup", "spe", "sup_spe"].includes(programmeLevelRaw)) {
        errors.push({ index, message: `${label} ("${title}") — programmeLevel invalide ("${programmeLevelRaw}"). Attendu : sup, spe, sup_spe.` });
        return;
      }
      programmeLevel = programmeLevelRaw as ProgrammeLevel;
    }

    // Palier pédagogique — voir la note sur `programmeLevel` ci-dessus : le
    // palier décrit où l'exercice se situe dans la progression, il ne décide
    // plus de sa visibilité. Un exercice de palier « concours » a toute sa
    // place dans les recommandations d'un élève de MP.
    const levelRaw = entry.level;
    let level: ExerciseLevel | null = null;
    if (levelRaw !== undefined && levelRaw !== null) {
      if (typeof levelRaw !== "number" || !Number.isInteger(levelRaw) || levelRaw < 1 || levelRaw > 6) {
        errors.push({ index, message: `${label} ("${title}") — level invalide (${levelRaw}). Attendu : un entier de 1 à 6.` });
        return;
      }
      level = levelRaw as ExerciseLevel;
    }

    const licenseStatusRaw = asTrimmedString(entry.licenseStatus ?? entry.license_status);
    let licenseStatus: LicenseStatus | null = null;
    if (licenseStatusRaw) {
      if (!["libre", "à vérifier", "restreint"].includes(licenseStatusRaw)) {
        errors.push({ index, message: `${label} ("${title}") — licenseStatus invalide ("${licenseStatusRaw}"). Attendu : libre, à vérifier, restreint.` });
        return;
      }
      if (licenseStatusRaw === "restreint") {
        errors.push({ index, message: `${label} ("${title}") — statut de licence "restreint" : non importable.` });
        return;
      }
      licenseStatus = licenseStatusRaw as LicenseStatus;
    } else if (competition) {
      // Concours sans statut de licence explicite : jamais présumé "libre"
      // (voir note sur l'absence de licence publiée par les concours) —
      // enregistré comme à vérifier plutôt que silencieusement omis.
      licenseStatus = "à vérifier";
    }

    const chapterLabelRaw = asTrimmedString(entry.chapter);

    const yearRaw = entry.year;
    if (yearRaw !== undefined && yearRaw !== null && (typeof yearRaw !== "number" || yearRaw < 1900 || yearRaw > 2100)) {
      errors.push({ index, message: `${label} ("${title}") — année invalide (attendu un nombre, ex. 2022).` });
      return;
    }
    const year = typeof yearRaw === "number" ? yearRaw : null;

    /**
     * PROVENANCE — la garantie qu'un exercice ne se fait jamais passer pour
     * un sujet de concours qu'il n'est pas.
     *
     * Le niveau déclaré doit être JUSTIFIÉ par les métadonnées fournies :
     * un exercice ne peut pas s'annoncer « concours vérifié » sans dire de
     * quelle session ni de quelle épreuve il sort. Inversement, un exercice
     * écrit pour TaekdHub ne peut pas porter de concours. Ces règles sont
     * appliquées ici, à la frontière, plutôt que laissées à la discipline de
     * celui qui rédige le fichier d'import.
     */
    const epreuve = asTrimmedString(entry.epreuve);
    const exerciseNumber = asTrimmedString(entry.exerciseNumber ?? entry.exercise_number);
    // `filiere` (une valeur) et `filieres` (une liste, ou une chaîne séparée
    // par des virgules) sont tous deux acceptés : un sujet publié pour deux
    // filières doit pouvoir le dire.
    const filiereValues = [...parseListField(entry.filieres, ","), ...(asTrimmedString(entry.filiere) ? [asTrimmedString(entry.filiere)!] : [])];
    const unknownFiliere = filiereValues.find((value) => !(FILIERES as string[]).includes(value));
    if (unknownFiliere) {
      errors.push({ index, message: `${label} ("${title}") — filière invalide ("${unknownFiliere}"). Attendu : ${FILIERES.join(", ")}.` });
      return;
    }
    const filieres = [...new Set(filiereValues)] as Filiere[];

    const provenanceRaw = asTrimmedString(entry.provenance);
    if (provenanceRaw && !(PROVENANCES as string[]).includes(provenanceRaw)) {
      errors.push({ index, message: `${label} ("${title}") — provenance invalide ("${provenanceRaw}"). Attendu : ${PROVENANCES.join(", ")}.` });
      return;
    }
    const provenance: Provenance = (provenanceRaw as Provenance) ?? (competition ? "concours-partiel" : "originale");
    const claimsConcours = provenance === "concours-verifie" || provenance === "concours-partiel";

    if (claimsConcours && !competition) {
      errors.push({ index, message: `${label} ("${title}") — provenance "${provenance}" sans champ "competition" : impossible d'annoncer un exercice de concours sans nommer le concours.` });
      return;
    }
    if (!claimsConcours && competition) {
      errors.push({ index, message: `${label} ("${title}") — provenance "${provenance}" avec un concours renseigné ("${competition}") : un exercice qui n'est pas issu d'un concours ne doit jamais en porter le nom.` });
      return;
    }
    // Volontairement, « concours-partiel » n'exige PAS l'épreuve : c'est
    // précisément le niveau des exercices dont on connaît le concours sans
    // connaître le détail de la session. Exiger davantage pousserait à
    // inventer une épreuve pour satisfaire le validateur — l'inverse du but.
    if (provenance === "concours-verifie" && (year === null || !exerciseNumber)) {
      const missing = [year === null ? '"year"' : null, !exerciseNumber ? '"exerciseNumber"' : null].filter(Boolean).join(" et ");
      errors.push({
        index,
        message: `${label} ("${title}") — provenance "concours-verifie" exige concours + session + épreuve + numéro d'exercice ; il manque ${missing}. Si la session est inconnue, déclarer "concours-partiel".`,
      });
      return;
    }
    if (claimsConcours && !chapterLabelRaw) {
      errors.push({ index, message: `${label} ("${title}") — exercice de concours sans champ "chapter" : il serait introuvable dans la banque.` });
      return;
    }
    if (claimsConcours && year !== null && (year < 1970 || year > new Date().getFullYear() + 1)) {
      errors.push({ index, message: `${label} ("${title}") — année de session incohérente (${year}).` });
      return;
    }

    const externalId = asTrimmedString(entry.externalId ?? entry.external_id);
    const sourceUrl = asTrimmedString(entry.sourceUrl ?? entry.source_url);
    const prerequisites = parseListField(entry.prerequisites, ",");
    const pedagogicalGoal = asTrimmedString(entry.pedagogicalGoal ?? entry.pedagogical_goal);

    const chapterLabel = chapterLabelRaw;
    let chapterId: string | null = null;
    let isNewChapter = false;
    if (chapterLabel) {
      const existing = getChaptersForSubject(chapters, subject).find((chapter) => chapter.label.toLowerCase() === chapterLabel.toLowerCase());
      if (existing) chapterId = existing.id;
      else isNewChapter = true;
    }

    const keys = identityKeys(subject, title, externalId);
    const clash = keys.lookup.find((key) => seen.has(key));
    if (clash) {
      duplicates.push({
        index,
        message: `${label} ("${title}") — déjà présent dans la banque${clash.startsWith("id::") ? ` (identifiant ${externalId})` : ""} : non réimporté.`,
      });
      return;
    }
    for (const key of keys.register) seen.add(key);

    rows.push({
      index,
      chapterLabel,
      isNewChapter,
      input: {
        subject,
        title,
        statement,
        source,
        type,
        difficulty,
        chapterId,
        tags: parseListField(entry.tags, ","),
        estimatedMinutes,
        note: asTrimmedString(entry.note) ?? "",
        hints: parseListField(entry.hints, "\n"),
        correction: asTrimmedString(entry.correction) ?? "",
        year,
        competition,
        programmeLevel,
        licenseStatus,
        externalId,
        sourceUrl,
        prerequisites,
        pedagogicalGoal,
        archived,
        level,
        epreuve,
        filieres,
        exerciseNumber,
        provenance,
      },
    });
  });

  return { rows, errors, duplicates };
}

/**
 * Modèle téléchargeable — démontre le format attendu avec des valeurs
 * clairement identifiées comme placeholders (pas de faux contenu de prépa
 * présenté comme réel, aucun énoncé, aucune attribution à une année/un sujet
 * précis). Seuls `title`, `source` et `subject` sont obligatoires ; tous les
 * autres champs sont optionnels. `programmeLevel: "sup"` est obligatoire dès
 * que `competition` est renseigné (dataset filtré sur le programme de Sup) —
 * X/ENS sont rejetés à l'import, quel que soit `programmeLevel`.
 * `statement` est obligatoire lui aussi : un exercice sans énoncé n'est pas
 * travaillable dans l'app (voir `parseExerciseImportPayload`).
 */
export const EXERCISE_IMPORT_TEMPLATE = [
  {
    title: "Exemple à remplacer — Calcul de dérivées",
    // `statement` (optionnel) : énoncé complet, en texte brut avec LaTeX
    // inline ($…$) ou en bloc ($$…$$) — rendu par RichMath dans l'app.
    statement: "Soit $f(x) = x^2 e^{-x}$. Calculer $f'(x)$ puis étudier son signe sur $\\mathbb{R}$.",
    source: "Modèle d'import TaekdHub",
    subject: "Mathématiques",
    type: "TD",
    difficulty: 3,
    chapter: "Exemple de chapitre",
    estimatedMinutes: 20,
    tags: ["exemple"],
    hints: ["Premier indice, léger.", "Deuxième indice, plus précis."],
    correction: "",
    note: "Remplace ce contenu par tes propres exercices avant d'importer.",
  },
  {
    title: "Exemple à remplacer — sans les champs optionnels",
    statement: "Énoncé à remplacer — seuls title, statement, source et subject sont obligatoires.",
    source: "Modèle d'import TaekdHub",
    subject: "Physique",
    type: "DM",
    difficulty: 2,
  },
  {
    title: "Exemple à remplacer — exercice de concours (champs infra)",
    statement: "Énoncé à remplacer par celui du sujet réel.",
    source: "Modèle d'import TaekdHub — remplace par la vraie référence (ex. \"CCINP 2022 MP Maths 1\")",
    subject: "Mathématiques",
    type: "Concours",
    difficulty: 3,
    chapter: "Exemple de chapitre",
    competition: "CCINP",
    // Provenance : "concours-verifie" exige concours + session + épreuve +
    // numéro. Sans l'un d'eux, déclarer "concours-partiel" — l'import refuse
    // une revendication que les métadonnées ne soutiennent pas.
    provenance: "concours-verifie",
    epreuve: "Maths 1",
    filiere: "MP",
    exerciseNumber: "3",
    programmeLevel: "sup",
    licenseStatus: "à vérifier",
    year: 2022,
    externalId: "",
    sourceUrl: "",
    prerequisites: ["développements limités"],
    pedagogicalGoal: "exemple de champ — décrit ce que l'exercice cherche réellement à entraîner",
  },
  {
    title: "Exemple à remplacer — pilier de Spé (hors recommandations actives)",
    statement: "Énoncé à remplacer — une notion de 2e année, à débloquer une fois le cours vu.",
    source: "Modèle d'import TaekdHub",
    subject: "Mathématiques",
    type: "TD",
    difficulty: 2,
    programmeLevel: "spe",
    archived: true,
    prerequisites: ["réduction des endomorphismes"],
    pedagogicalGoal: "introduction en douceur à une notion de 2e année, à débloquer soi-même une fois le cours vu",
  },
];

export function downloadExerciseImportTemplate(): void {
  const data = JSON.stringify(EXERCISE_IMPORT_TEMPLATE, null, 2);
  const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "taekdhub-modele-import-exercices.json";
  anchor.click();
  URL.revokeObjectURL(url);
}
