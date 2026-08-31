import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { snapshotOnOpen } from "@/hooks/use-work-timer";

/**
 * LES COUTURES DE SÉANCE QUI NE TIENNENT À AUCUN AUTRE TEST.
 *
 * Une revue indépendante a produit le constat le plus utile de ce chantier :
 * les deux correctifs les plus graves pouvaient être intégralement dévissés
 * — retour aux `useState`, `writePendingAttempt` supprimé, effacement du
 * brouillon remis avant la sauvegarde — sans qu'un seul des 402 tests
 * rougisse. Motif : tous les tests vivent dans `lib/`, aucun n'atteint
 * `components/` ni `hooks/`, et le projet teste volontairement la logique
 * pure sans environnement navigateur (voir vitest.config.ts).
 *
 * Ce fichier lit donc les sources, exactement comme lib/design-system.test.ts
 * le fait pour l'échelle `hairline`, et pour la même raison : ajouter jsdom
 * et testing-library pour huit assertions coûterait plus que ça ne rapporte.
 *
 * ## Ce que ce fichier est, et n'est pas
 * L'essentiel est ici des gardes STRUCTURELS, pas des tests de comportement :
 * ils prouvent que le câblage est en place, pas qu'il fonctionne. Ce qu'il
 * fait réellement est vérifié en navigateur (rechargement pendant et après la
 * séance, quota de stockage refusé, isolation entre exercices). Leur valeur
 * est d'échouer le jour où quelqu'un défait une couture par inadvertance —
 * ce qui est déjà arrivé une fois entre deux commits de ce même chantier.
 *
 * Une exception assumée : `snapshotOnOpen` (hooks/use-work-timer.ts) est une
 * transition PURE, donc vérifiable pour de vrai — elle l'est ci-dessous, avec
 * en plus le garde structurel qui prouve que le mode focus l'emprunte bien.
 *
 * Un garde structurel se périme s'il vérifie une orthographe plutôt qu'une
 * intention : chacun ci-dessous cite donc le défaut réel qu'il empêche de
 * revenir, pour qu'on sache quoi en faire le jour où il gêne.
 */

const read = (relative: string) => readFileSync(path.resolve(process.cwd(), relative), "utf8");

const FOCUS_VIEW = "components/exercises/focus-view.tsx";
const SESSION_RUNNER = "components/session/session-runner.tsx";
const EXERCISE_MANAGER = "components/exercises/exercise-manager.tsx";
const TIMER = "components/timer.tsx";
const EXERCISE_DETAIL = "components/exercises/exercise-detail.tsx";

describe("l'aide utilisée doit survivre à un rechargement", () => {
  it("le mode focus lit l'aide depuis le contexte PERSISTÉ du chrono", () => {
    // Défaut d'origine : `hintCount` et `correctionRevealed` étaient de
    // simples états React. Un rechargement en cours de séance rendait le
    // temps mais remettait l'aide à zéro — et `0`/`false` ne sont pas des
    // trous, ce sont des preuves POSITIVES d'autonomie.
    expect(read(FOCUS_VIEW)).toContain("resumeAid(context)");
  });

  it("il ne garde AUCUN état React parallèle pour l'aide", () => {
    // La couture se défait silencieusement en réintroduisant un `useState` :
    // le code compile, l'écran se comporte pareil, et le signal redevient
    // faux au premier rechargement.
    const source = read(FOCUS_VIEW);
    expect(source).not.toMatch(/useState[^\n]*hintCount/i);
    expect(source).not.toMatch(/setHintCount/);
    expect(source).not.toMatch(/setCorrectionRevealed/);
  });

  it("les révélations d'aide utilisent la forme fonctionnelle de `setContext`", () => {
    // Deux gestes dans le même tour de boucle se reconstruisaient depuis le
    // contexte du rendu courant : le second écrasait le premier, et un clic
    // réel de l'élève disparaissait.
    const source = read(FOCUS_VIEW);
    expect(source).toContain("setContext((previous)");
    expect(source).not.toMatch(/setContext\(\{\s*\.\.\.context/);
  });
});

describe("une séance ne peut pas disparaître entre l'arrêt du chrono et la sauvegarde", () => {
  it("le brouillon est écrit dès que le chrono s'arrête", () => {
    // `stop()` efface la clé du chrono de façon synchrone : sans cette
    // écriture, la séance n'existe plus que dans un `useState`, et l'écran de
    // résultat attend indéfiniment. Reproduit : 42 minutes perdues.
    expect(read(FOCUS_VIEW)).toContain("writePendingAttempt(draft)");
  });

  it("le brouillon n'est effacé QU'APRÈS une sauvegarde réussie", () => {
    // Dans l'ordre inverse, un refus d'écriture (quota, mode privé) détruisait
    // la dernière trace de la séance. L'idempotence ne dépend pas de cet
    // ordre : elle vient de l'identifiant, dans `appendAttempt`.
    const source = read(FOCUS_VIEW);
    const sauvegarde = source.indexOf("saveSessions(withAttempt)");
    const effacement = source.indexOf("clearPendingAttempt(item.id)");
    expect(sauvegarde).toBeGreaterThan(-1);
    expect(effacement).toBeGreaterThan(-1);
    expect(effacement).toBeGreaterThan(sauvegarde);
  });

  it("les deux écrans qui rouvrent un focus interrompu cherchent aussi le brouillon", () => {
    // La clé du chrono est déjà effacée à ce stade : ne chercher qu'elle
    // revenait à ne jamais rouvrir l'écran de résultat, donc à abandonner le
    // brouillon qu'on venait de sauver.
    for (const file of [SESSION_RUNNER, EXERCISE_MANAGER]) {
      expect(read(file)).toContain("PENDING_ATTEMPT_PREFIX");
    }
  });
});

describe("rouvrir un écran ne relance pas un chrono mis en pause", () => {
  /**
   * Les trois cas ci-dessous sont de VRAIS tests de comportement, pas des
   * gardes structurels : `snapshotOnOpen` est la transition pure extraite de
   * `useWorkTimer` précisément pour être vérifiable ici. Le garde structurel
   * qui les accompagne (« le mode focus ouvre avec `resumeOrStart` ») est
   * juste en dessous — il faut les deux, sinon le correctif se dévisse en
   * rebranchant `start()` sans qu'aucune de ces assertions ne bouge.
   */
  const pausee = { startedAt: "2026-01-01T08:00:00.000Z", accumulatedSeconds: 1200, runningSince: null, context: { exerciseId: "ex-1" } };

  it("une séance EN PAUSE est rendue telle quelle", () => {
    // Défaut réel : pause à 0:02, rechargement, le chrono repartait tout
    // seul et affichait 0:07 cinq secondes plus tard. `start()` ne se gardait
    // que du cas « déjà en train de tourner ». Le temps que l'élève venait
    // d'annoncer ne pas passer à travailler entrait dans `duration_seconds`.
    const next = snapshotOnOpen(pausee, { exerciseId: "ex-1" }, "2026-01-01T09:00:00.000Z");
    expect(next.runningSince).toBeNull();
    expect(next.accumulatedSeconds).toBe(1200);
    expect(next.startedAt).toBe("2026-01-01T08:00:00.000Z");
  });

  it("une séance EN COURS garde son intervalle, jamais réarmé à l'ouverture", () => {
    // Réarmer `runningSince` à l'ouverture perdrait le temps écoulé depuis le
    // début de l'intervalle en cours — y compris celui du rechargement.
    const enCours = { ...pausee, runningSince: "2026-01-01T08:20:00.000Z" };
    expect(snapshotOnOpen(enCours, { exerciseId: "ex-1" }, "2026-01-01T09:00:00.000Z").runningSince).toBe("2026-01-01T08:20:00.000Z");
  });

  it("sans séance persistée, ouvrir EST la décision de s'y mettre", () => {
    // L'autre moitié de la règle : le chrono ne doit pas rester à l'arrêt
    // tant que l'élève ne pense pas à le lancer (du temps de travail réel
    // disparaissait silencieusement).
    const next = snapshotOnOpen(null, { exerciseId: "ex-1" }, "2026-01-01T09:00:00.000Z");
    expect(next.runningSince).toBe("2026-01-01T09:00:00.000Z");
    expect(next.accumulatedSeconds).toBe(0);
  });

  it("le mode focus ouvre avec `resumeOrStart`, jamais avec `start`", () => {
    // Le garde qui empêche de rebrancher l'ancien appel : `start()` reste
    // légitime pour le chronomètre libre (components/timer.tsx), où il est
    // déclenché par un bouton, mais pas pour une ouverture d'écran.
    const source = read(FOCUS_VIEW);
    expect(source).toContain("resumeOrStart();");
    expect(source).not.toMatch(/^\s*start\(\);/m);
  });
});

describe("l'écran ne doit pas montrer un exercice périmé", () => {
  it("la séance relit l'exercice en focus dans la banque à jour", () => {
    // `recommendations` est figé au démarrage de la séance : passer sa copie
    // à FocusView faisait revenir le sélecteur de statut sur l'ancienne
    // valeur juste après un clic — reproduit en navigateur, « maîtrisé »
    // écrit dans `prepahub:exercises` mais « à faire » affiché à l'écran.
    // ExerciseManager, lui, a toujours relu la banque (`exercises.find`).
    const source = read(SESSION_RUNNER);
    expect(source).toContain("exercises.find((item) => item.id === currentFocusExercise.exercise.id)");
    expect(source).not.toContain("item={currentFocusExercise.exercise}");
  });
});

describe("aucun moteur ne doit recevoir une aide inventée", () => {
  it("la fiche d'un exercice signale les aides qu'elle révèle", () => {
    // `components/exercises/exercise-detail.tsx` a ses PROPRES boutons
    // « Afficher l'indice N » et « Afficher la correction ». Sans ce
    // signalement, y lire la solution puis déclarer « Réussi » en Focus
    // enregistrait `hints_used: 0, correction_viewed: false` — la preuve
    // d'autonomie maximale, pour un élève qui venait de tout lire.
    const source = read(EXERCISE_DETAIL);
    expect(source).toContain('markAidSeen(item.id, "hint")');
    expect(source).toContain('markAidSeen(item.id, "correction")');
  });

  it("le mode focus n'affirme `0` / `false` qu'après avoir consulté ce marqueur", () => {
    expect(read(FOCUS_VIEW)).toContain("resolveAttemptAid({ hintCount, correctionRevealed }, readAidSeen(item.id))");
  });

  it("une séance libre du chronomètre déclare `null`, jamais `false`", () => {
    // Sans exercice il n'y a aucune correction à révéler : `false`
    // affirmerait que l'élève a conclu sans la lire.
    expect(read(TIMER)).toContain("correction_viewed: null");
    expect(read(TIMER)).not.toContain("correction_viewed: false");
  });

  it("la tentative n'est comptée sur la fiche que si elle vient d'ENTRER dans l'historique", () => {
    // Si le stockage refuse d'effacer le brouillon (mode privé, quota),
    // l'écran de résultat peut revenir pour une séance DÉJÀ enregistrée.
    // `appendAttempt` empêche le doublon de séance — il rend le tableau reçu
    // à l'identique — mais rien n'empêchait `attempts` de monter une seconde
    // fois. Reproduit en navigateur : `attempts: 2` pour une seule tentative.
    const source = read(FOCUS_VIEW);
    expect(source).toContain("const alreadyRecorded = withAttempt === sessions;");
    expect(source).toContain("if (!alreadyRecorded &&");
  });

  it("aucun accès brut à sessionStorage : tout passe par les accès gardés", () => {
    // Un `getItem` qui lève (Safari privé, données de site bloquées)
    // remontait tout l'arbre React : `/session` et `/timer` s'affichaient
    // entièrement blanches. Les accès gardés vivent dans lib/storage.ts.
    for (const file of [FOCUS_VIEW, SESSION_RUNNER, EXERCISE_MANAGER, TIMER, EXERCISE_DETAIL, "hooks/use-work-timer.ts", "lib/attempt.ts"]) {
      expect(read(file)).not.toMatch(/\bsessionStorage\.(getItem|setItem|removeItem|key|length)/);
    }
  });

  it("le seuil d'une minute reste attaché aux compteurs de la fiche", () => {
    // `attempts` et `last_worked_at` ne doivent pas se mettre à jour sur une
    // séance que tous les moteurs refusent de compter.
    expect(read(FOCUS_VIEW)).toContain("secondsToWholeMinutes(finalSession.duration_seconds) > 0");
  });
});
