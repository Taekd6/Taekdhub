/**
 * Matières couvertes par la banque d'exercices (voir lib/study.ts pour les
 * métadonnées d'affichage — code court, couleur).
 */
export type Subject =
  | "Mathématiques"
  | "Physique"
  | "Chimie"
  | "Informatique TC"
  | "Informatique Spé"
  | "Français"
  | "Anglais";

/**
 * Cycle de vie d'un exercice dans la banque.
 * "à revoir" et "maîtrisé" distinguent un exercice déjà traité mais fragile
 * d'un exercice réellement acquis — cette distinction sert de fondation aux
 * futurs sprints (répétition espacée notamment) sans en implémenter la logique ici.
 *
 * Ne représente PAS le degré de maîtrise (voir `Exercise.mastery`, un concept
 * volontairement distinct — décision Sprint 2.5, à ne jamais fusionner).
 */
export type ExerciseStatus = "à faire" | "en cours" | "à revoir" | "maîtrisé";

/** Nature de l'exercice — sert à filtrer une banque qui mélangera TD, annales, colles… */
export type ExerciseType = "TD" | "DM" | "DS" | "Colle" | "TP" | "Annale" | "Concours" | "Personnel";

/**
 * Niveau de programme requis pour résoudre l'exercice EN ENTIER — indépendant
 * du concours d'origine et de `Difficulty` (voir plus bas). Un exercice CCINP
 * peut être "sup" ; un exercice Mines-Ponts peut nécessiter la Spé : le
 * concours ne détermine jamais ce champ, seul le contenu mathématique/physique
 * réellement requis le détermine.
 *
 * `null` = non classifié (exercice personnel/de cours, ou fiche créée avant
 * l'introduction de ce champ — jamais interprété comme "sup" par défaut).
 */
export type ProgrammeLevel = "sup" | "spe" | "sup_spe";

/**
 * Statut de réutilisation vérifié pour un exercice importé d'une source
 * externe (concours notamment) — les sujets SCEI/CCINP/e3a/Centrale/Mines-Ponts
 * sont publiés en libre consultation mais sans licence de redistribution
 * explicite publiée ; ce champ enregistre l'état de vérification réel, jamais
 * une présomption. "à vérifier" est un état d'attente, pas un état importable
 * (voir lib/exercise-import.ts).
 */
export type LicenseStatus = "libre" | "à vérifier" | "restreint";

/** Filière de concours d'origine — `null` quand l'exercice n'en vient pas. */
export type Filiere = "MP" | "MPI" | "PC" | "PSI" | "PT" | "TSI";

/**
 * NIVEAU DE VÉRIFICATION de la provenance — le champ qui empêche de faire
 * passer pour un sujet de concours ce qui n'en est pas un.
 *
 * "concours-verifie" : concours, session, épreuve ET numéro d'exercice sont
 *   tous connus. C'est le seul niveau qui autorise l'affichage complet
 *   « CCINP 2023 · Maths 1 · exercice 4 ».
 * "concours-partiel" : l'exercice vient bien d'un concours et l'épreuve est
 *   identifiée, mais la session ne l'est pas — cas des recueils d'oraux,
 *   qui classent par concours sans dater chaque exercice. L'interface
 *   affiche alors « session inconnue » plutôt que d'inventer une année.
 * "enseignant" : feuille de TD, DM ou DS d'un professeur.
 * "originale" : écrit pour TaekdHub. Ne peut JAMAIS porter de concours.
 *
 * Le pipeline d'import fait respecter ces règles (lib/exercise-import.ts) :
 * un exercice ne peut pas se déclarer d'un niveau que ses métadonnées ne
 * justifient pas.
 */
export type Provenance = "concours-verifie" | "concours-partiel" | "enseignant" | "originale";

/**
 * Palier PÉDAGOGIQUE de l'exercice (Sprint 4) — où il se situe dans la
 * progression d'apprentissage, DISTINCT de `Difficulty` (sa difficulté
 * intrinsèque) et de `ProgrammeLevel` (le prérequis strict pour le résoudre).
 * Deux exercices de même `level` peuvent avoir des `difficulty` différentes,
 * et inversement.
 *
 * 1 = Automatismes (très courts, réflexe/rapidité)
 * 2 = Classiques (méthodes fondamentales à maîtriser)
 * 3 = Consolidation (combine ou approfondit plusieurs classiques)
 * 4 = Transition (fait le pont entre deux années/chapitres)
 * 5 = Concours (plus long/subtil, format épreuve)
 * 6 = Expert (nettement au-dessus de l'attendu courant)
 *
 * Ces paliers sont désormais une simple ÉTIQUETTE PÉDAGOGIQUE : ils ne
 * décident plus de la visibilité d'un exercice. Les paliers 4 et 6 étaient
 * jusqu'ici archivés d'office à l'import, parce que l'élève était en Sup et
 * que rien de deuxième année ne devait entrer dans ses recommandations. Il
 * est maintenant en MP : cette règle masquait exactement le contenu à
 * travailler, elle a donc été retirée de lib/exercise-import.ts. `archived`
 * redevient un choix de l'élève.
 */
export type ExerciseLevel = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Difficulté INTRINSÈQUE de l'exercice (indépendante de l'élève qui le
 * résout). Ne jamais mélanger avec `Exercise.mastery` (le degré de maîtrise
 * de l'élève) — NI avec le prestige du concours d'origine (`Exercise.competition`) :
 * un CCINP peut être difficile, un Mines-Ponts peut être accessible. Ce champ
 * s'évalue toujours à l'intérieur du niveau de programme réel de l'exercice
 * (voir `ProgrammeLevel`), jamais déduit automatiquement de la source.
 */
export type Difficulty = 1 | 2 | 3 | 4 | 5;

/** Degré de maîtrise de l'élève sur cet exercice, par paliers de 25 — distinct de `Difficulty` et de `ExerciseStatus` (voir plus haut). */
export type Mastery = 0 | 25 | 50 | 75 | 100;

/**
 * Une séance de travail chronométrée (Timer ou FocusView).
 * Unité de durée : SECONDES (`duration_seconds`), toujours un nombre entier.
 * C'est la source de vérité utilisée par le Dashboard, la Heatmap, le Streak
 * et les Statistiques — voir lib/study.ts et lib/gamification.ts.
 *
 * Miroir de la table `work_sessions` (supabase/migrations/0001_initial.sql,
 * étendue par 0003_sprint25_definitive_model.sql). `user_id` n'est pas repris
 * ici : c'est une colonne gérée par Supabase/RLS (default auth.uid()) qui n'a
 * pas de sens tant que l'app fonctionne en local-first sans authentification
 * branchée.
 */
export interface WorkSession {
  id: string;
  subject: Subject;
  /**
   * Exercice concerné par cette séance, ou null pour une séance libre (Timer
   * principal, sans exercice sélectionné). Lien réel introduit au Sprint 2.5 :
   * avant cela, seul `note` référençait l'exercice sous forme de texte.
   * C'est l'UNIQUE source de vérité du temps passé par exercice depuis le
   * Sprint 2.6 : `Exercise` ne stocke plus aucune durée cumulée — voir
   * `minutesSpentOnExercise` dans lib/study.ts, qui la calcule à la demande
   * en sommant les séances dont `exercise_id` correspond.
   */
  exercise_id: string | null;
  /** Horodatage ISO du début réel de la séance. */
  started_at: string;
  /** Horodatage ISO de fin, ou null si la séance n'a jamais été clôturée proprement. */
  ended_at: string | null;
  /** Durée totale en SECONDES (jamais en minutes — voir lib/utils.ts pour les conversions). */
  duration_seconds: number;
  note: string | null;
  /** Horodatage ISO de création de l'enregistrement (mirroir de `created_at` en base). */
  created_at: string;
  /**
   * Résultat de la tentative, saisi par l'élève en fin de séance focus
   * (voir focus-view.tsx) — `null` si non renseigné : soit une séance libre
   * (Timer principal, sans exercice), soit l'utilisateur a passé l'étape
   * ("Passer"), soit — le cas le plus fréquent — une séance antérieure à
   * l'introduction de ce champ. Jamais déduit ni deviné a posteriori : une
   * séance sans résultat reste un simple signal de temps passé, exactement
   * comme avant ce champ (voir `normalizeSession`, lib/storage.ts).
   *
   * Distinct de `Exercise.status`/`Exercise.mastery` (auto-évalués par
   * l'élève sur la fiche, à un instant donné) : `result` est un fait
   * ponctuel attaché à CETTE tentative précise, jamais réécrit après coup.
   * `lib/recommendation.ts` l'utilise comme signal supplémentaire, sans
   * jamais modifier `status`/`mastery` lui-même.
   */
  result: AttemptResult | null;
  /**
   * Nombre d'indices révélés durant CETTE tentative (0 si aucun), ou `null`
   * quand l'information n'a jamais été enregistrée — séance antérieure à ce
   * champ, ou séance libre depuis le Timer (aucun exercice, donc aucun
   * indice possible).
   *
   * `null` et `0` ne veulent PAS dire la même chose et ne doivent jamais
   * être confondus : `0` est une preuve positive que l'élève s'en est sorti
   * seul — le signal le plus fort dont dispose le moteur ; `null` signifie
   * simplement qu'on ne sait pas. Traiter `null` comme `0` reviendrait à
   * créditer rétroactivement des mois d'historique d'une autonomie jamais
   * observée (voir `normalizeSession`, lib/storage.ts).
   *
   * Signal volontairement brut : c'est un FAIT de la tentative, jamais une
   * interprétation. Toute la lecture pédagogique (« a-t-il eu besoin d'aide
   * ? », « ce chapitre est-il fragile ? ») vit dans lib/recommendation.ts,
   * comme pour `result`.
   */
  hints_used: number | null;
}

/** Résultat d'une tentative de travail sur un exercice — voir `WorkSession.result`. */
export type AttemptResult = "réussi" | "partiel" | "échoué";

/**
 * Une fiche d'exercice — l'unité de base de la banque d'exercices.
 *
 * ## Titre vs chapitre (Sprint 2.5)
 * `title` (libre, obligatoire) décrit l'exercice lui-même. `chapter_id`
 * (nullable) référencera une entrée du futur catalogue de chapitres
 * (lib/chapters.ts, aujourd'hui vide pour chaque matière). Ces deux notions
 * sont volontairement distinctes et ne doivent jamais être fusionnées.
 * `chapter_id` vaut `null` pour tout exercice tant qu'aucun chapitre n'a été
 * assigné — catalogue vide aujourd'hui, à peupler dans un sprint dédié.
 *
 * ## Durées
 * `estimated_minutes` (MINUTES) est la seule durée stockée sur `Exercise` —
 * une estimation posée par l'utilisateur (planification). Le temps
 * RÉELLEMENT passé n'est PAS stocké ici (depuis le Sprint 2.6, pour éliminer
 * tout risque de divergence) : il se calcule à la demande via
 * `minutesSpentOnExercise` (lib/study.ts), qui somme les `WorkSession.duration_seconds`
 * dont `exercise_id` correspond. Ni l'estimation ni ce calcul n'alimentent la
 * Heatmap, le Streak ou les Statistiques globales, qui se basent sur
 * l'ensemble des `WorkSession` sans filtrer par exercice (voir lib/study.ts
 * et lib/gamification.ts).
 *
 * ## Difficulté, maîtrise, statut — trois concepts distincts
 * - `difficulty` : difficulté intrinsèque de l'exercice (voir `Difficulty`).
 * - `mastery` : degré de maîtrise de l'élève, par paliers de 25 (voir `Mastery`).
 * - `status` : étape du cycle de vie (à faire / en cours / à revoir / maîtrisé).
 * Ne jamais mélanger ces trois notions (décision Sprint 2.5).
 *
 * ## Un seul levier manuel : `favorite`
 * L'élève dispose d'UNE façon de dire « celui-là compte pour moi » — l'étoile
 * (`favorite`), présente sur chaque carte et filtrable. L'ancienne échelle
 * `priority` (1-5) exprimait exactement la même intention avec une seconde
 * granularité, un second poids dans le moteur et un réglage caché dans le
 * détail : deux leviers pour une seule intention, dont un que personne
 * n'ouvrait sur 402 exercices. Supprimée.
 *
 * ## Tentatives et dernière activité
 * `attempts` est incrémenté AUTOMATIQUEMENT (Sprint 2.5) et `last_worked_at`
 * est mis à jour (Sprint 2.6) à chaque séance focus achevée sur cet exercice
 * avec au moins une minute enregistrée — aucun des deux n'a de contrôle
 * manuel dans l'interface. `last_worked_at` ne reflète plus la simple
 * ouverture de la fiche (comportement de `last_opened_at` avant le Sprint 2.6).
 *
 * ## Réservé pour de futurs sprints (non implémenté, architecture compatible)
 * Ces notions ont été anticipées mais n'ont ni champ ni logique aujourd'hui :
 * - `next_revision` (répétition espacée) : une date de prochaine révision.
 * - `attachments` : pièces jointes (photo/PDF de correction, énoncé scanné…).
 * - `review_history` : historique structuré des révisions (au-delà du simple
 *   compteur `attempts`).
 * Elles pourront être ajoutées sans casser ce modèle (nouveaux champs
 * optionnels ou objets annexes reliés par `id`).
 *
 * Miroir de la table `exercises` (supabase/migrations/0001_initial.sql,
 * étendue par 0002_sprint2a_exercise_bank.sql, 0003_sprint25_definitive_model.sql
 * puis 0004_sprint26_duration_derived.sql — qui supprime la colonne
 * `duration_minutes`). Comme pour WorkSession, `user_id`
 * (géré par Supabase/RLS) n'est pas repris. Les colonnes `not null default
 * ...` de la base sont typées comme requises ici, et non optionnelles : les
 * valeurs par défaut sont appliquées une seule fois, à la lecture, dans
 * lib/storage.ts (compatibilité avec d'anciennes données locales — y compris
 * la migration des formes Sprint 1 / Sprint 2A, voir les fonctions
 * `migrate*` dans ce même fichier).
 */
export interface Exercise {
  id: string;
  subject: Subject;
  /** Décrit l'exercice lui-même — voir la note "Titre vs chapitre" ci-dessus. */
  title: string;
  /**
   * Corps complet de l'énoncé — ce que l'élève doit réellement lire pour
   * traiter l'exercice, distinct de `title` (l'intitulé court). Texte brut
   * pouvant contenir des segments LaTeX (`$…$` inline, `$$…$$` en bloc),
   * rendus par le composant `RichMath` (components/rich-math.tsx) partout où
   * l'énoncé est affiché — jamais interprété comme du Markdown.
   *
   * `""` par défaut : la quasi-totalité des exercices existants (import massé
   * avant ce champ) n'ont pas encore d'énoncé saisi ; une chaîne vide n'est
   * jamais interprétée comme une erreur, juste comme "à compléter" — voir
   * `normalizeExercise` (lib/storage.ts) pour la migration des anciennes
   * données et `parseExerciseImportPayload` (lib/exercise-import.ts) pour
   * l'import (champ optionnel, absent → `""`).
   */
  statement: string;
  /** Référence vers le futur catalogue de chapitres (lib/chapters.ts), ou null tant qu'aucun chapitre n'est assigné. */
  chapter_id: string | null;
  /** Origine libre de l'exercice (ex. "TD8", "Centrale", "Prof"). */
  source: string;
  /** Année associée à la source, distincte de `source` (ex. 2022 pour "Centrale 2022"), ou null si non pertinente/non renseignée. */
  year: number | null;
  /**
   * Concours d'origine normalisé (ex. "CCINP", "Mines-Ponts", "e3a", "Centrale",
   * "PT"), distinct de `source` (texte libre affiché, ex. "CCINP 2022 MP Maths 1").
   * `null` si l'exercice ne vient pas d'un concours (TD, cours, personnel…).
   * X/ENS n'apparaissent jamais ici dans le dataset principal — voir `ProgrammeLevel`.
   */
  competition: string | null;
  /**
   * Niveau de programme réellement requis — voir `ProgrammeLevel`. `null` =
   * non classifié. Étiquette informative (distinguer une révision de Sup d'un
   * chapitre de Spé) : elle ne conditionne plus l'archivage à l'import.
   */
  programme_level: ProgrammeLevel | null;
  /** Statut de réutilisation vérifié — voir `LicenseStatus`. `null` = non renseigné (exercice non issu d'une source externe, typiquement). */
  license_status: LicenseStatus | null;
  /** Identifiant externe (ex. référence SCEI), si disponible, sinon null. */
  external_id: string | null;
  /** Épreuve d'origine (« Oral », « Maths 1 », « Maths 2 »…) — `null` hors concours. */
  epreuve: string | null;
  /** Filière du sujet — voir `Filiere`. `null` hors concours ou si inconnue. */
  filiere: Filiere | null;
  /** Numéro ou identifiant de l'exercice dans le sujet d'origine. */
  exercise_number: string | null;
  /** Niveau de vérification de la provenance — voir `Provenance`. */
  provenance: Provenance;
  /** URL vers la source originale, si disponible, sinon null. */
  source_url: string | null;
  /**
   * Notions explicitement requises pour résoudre l'exercice (ex. "développements
   * limités", "réduction des endomorphismes") — la contrainte pédagogique
   * absolue "jamais de Spé implicite dans une catégorie faisable maintenant"
   * se vérifie ici, pas en le déduisant de `programme_level` seul. `[]` si
   * non renseigné (jamais interprété comme "aucun prérequis").
   */
  prerequisites: string[];
  /** Pourquoi cet exercice existe — ce qu'il cherche réellement à entraîner (ex. "transfert : même méthode qu'un DL, contexte matriciel"). `null` si non renseigné. */
  pedagogical_goal: string | null;
  /** Palier pédagogique (1 à 6) — voir `ExerciseLevel`. `null` = non classifié. */
  level: ExerciseLevel | null;
  type: ExerciseType;
  /** Difficulté intrinsèque — voir `Difficulty`. */
  difficulty: Difficulty;
  /** Degré de maîtrise de l'élève — voir `Mastery`. */
  mastery: Mastery;
  status: ExerciseStatus;
  /** Temps estimé par l'utilisateur, en MINUTES, ou null si non renseigné. */
  estimated_minutes: number | null;
  /** Nombre de tentatives — incrémenté automatiquement (voir la note ci-dessus). */
  attempts: number;
  note: string | null;
  created_at: string;
  /** Horodatage ISO de dernière modification de la fiche (n'importe quel champ). */
  updated_at: string;
  tags: string[];
  favorite: boolean;
  archived: boolean;
  hints: string[];
  correction: string | null;
  /** Fin de la dernière séance focus achevée (≥ 1 minute) sur cet exercice — voir "Tentatives et dernière activité" ci-dessus. Anciennement `last_opened_at` (mis à jour à l'ouverture de la fiche), renommé et resémantisé au Sprint 2.6. */
  last_worked_at: string | null;
}
