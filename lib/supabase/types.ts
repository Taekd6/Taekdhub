/**
 * Matières suivies par l'élève (voir lib/study.ts pour les métadonnées
 * d'affichage — code court, couleur).
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
 * Une séance de travail chronométrée (Chrono) ou déclarée après coup (saisie rapide).
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
   * HÉRITAGE — renvoi vers un exercice de l'ancienne banque intégrée,
   * supprimée : l'élève travaille désormais sur ses propres feuilles et ne
   * déclare que du temps et des notes. Le champ reste dans le type pour que
   * les séances déjà stockées et les anciennes sauvegardes se relisent sans
   * perte (voir `normalizeSession`, lib/storage.ts), mais plus rien ne
   * l'affiche ni ne s'en sert. Toute nouvelle séance l'écrit à `null`.
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
   * HÉRITAGE, même statut que `exercise_id` : résultat déclaré en fin de
   * tentative sur un exercice de l'ancienne banque, et nombre d'indices
   * révélés par l'ancien copilote. Conservés à la lecture (anciennes
   * séances, anciennes sauvegardes), jamais affichés, jamais exploités ;
   * toute nouvelle séance les écrit à `null`.
   */
  result: AttemptResult | null;
  hints_used: number | null;
  /**
   * Travail planifié (`WorkItem`, lib/storage.ts) auquel cette séance a été
   * consacrée, ou `null` pour une séance qui n'en servait aucun — cas de
   * toutes les séances antérieures à ce champ, et de toute séance libre.
   *
   * C'est l'UNIQUE lien entre le temps réellement passé et le travail à
   * faire, et il est posé ici — sur la séance — plutôt que sur le `WorkItem`
   * pour deux raisons.
   *
   * D'abord parce que `WorkItem` ne doit stocker AUCUNE durée réalisée
   * (règle du Sprint 2.6 : aucune durée cumulée recopiée, pour éliminer tout
   * risque de divergence). Le temps fait sur un DM se SOMME depuis
   * les séances, il ne se recopie pas.
   *
   * Ensuite parce qu'une séance est une ligne NEUVE à chaque fois : deux
   * onglets ouverts ne se disputent jamais la même. Un tableau
   * `sessionIds[]` porté par le `WorkItem`, lui, serait réécrit à chaque
   * séance, et la fusion par identifiant de lib/storage.ts#mergeStored y
   * perdrait des entrées dès qu'une copie React est périmée.
   *
   * Champ purement local : `work_items` n'a pas de miroir Supabase (comme
   * `Preferences`), donc la colonne correspondante n'existe pas
   * en base. Il est ignoré côté serveur, exactement comme `Preferences`.
   */
  work_item_id: string | null;
}

/** Résultat d'une tentative sur un exercice de l'ancienne banque — héritage, voir `WorkSession.result`. */
export type AttemptResult = "réussi" | "partiel" | "échoué";
