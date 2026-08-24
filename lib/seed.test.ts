import { describe, expect, it } from "vitest";
import { parseExerciseImportPayload } from "@/lib/exercise-import";
import bank from "@/datasets/exercices-banque-complete.json";

/**
 * Validation automatique de la banque groupée (Sprint qualité de l'import —
 * voir lib/seed.ts). Ce fichier est amorcé tel quel dans le navigateur de
 * chaque nouvel utilisateur : une entrée malformée ou dupliquée n'y serait
 * jamais détectée avant qu'un utilisateur réel ne l'ouvre. Ces tests
 * rejouent EXACTEMENT le même pipeline que le seeding réel
 * (`parseExerciseImportPayload`, lib/seed.ts#buildSeed) pour l'attraper à la
 * compilation/CI, jamais en production.
 */
describe("datasets/exercices-banque-complete.json — validation automatique", () => {
  it("chaque entrée s'importe sans erreur via le pipeline d'import réel", () => {
    const { errors } = parseExerciseImportPayload(bank, []);
    expect(errors).toEqual([]);
  });

  it("aucun titre vide, aucune source vide (déjà garanti par le parseur, revérifié explicitement ici)", () => {
    for (const entry of bank as Array<Record<string, unknown>>) {
      expect(typeof entry.title === "string" && entry.title.trim().length > 0).toBe(true);
      expect(typeof entry.source === "string" && entry.source.trim().length > 0).toBe(true);
    }
  });

  it("aucun titre en double au sein d'une même matière (déduplication de contenu)", () => {
    const seen = new Map<string, string>();
    const duplicates: string[] = [];
    for (const entry of bank as Array<{ subject: string; title: string }>) {
      const key = `${entry.subject}::${entry.title.trim().toLowerCase()}`;
      if (seen.has(key)) duplicates.push(entry.title);
      else seen.set(key, entry.title);
    }
    expect(duplicates).toEqual([]);
  });

  it("un exercice avec correction ne peut pas avoir une correction identique à un autre exercice de la même matière (correction mal recopiée d'un exercice à l'autre)", () => {
    const bySubject = new Map<string, Map<string, string[]>>();
    for (const entry of bank as Array<{ subject: string; title: string; correction?: string }>) {
      const correction = entry.correction?.trim();
      if (!correction) continue;
      const bucket = bySubject.get(entry.subject) ?? new Map<string, string[]>();
      bucket.set(correction, [...(bucket.get(correction) ?? []), entry.title]);
      bySubject.set(entry.subject, bucket);
    }
    const collisions: string[] = [];
    for (const bucket of bySubject.values()) {
      for (const titles of bucket.values()) {
        if (titles.length > 1) collisions.push(titles.join(" / "));
      }
    }
    expect(collisions).toEqual([]);
  });

  it("une correction non vide se termine sur un résultat concret, pas sur la seule annonce d'un calcul (garde contre les corrections tronquées — Sprint expansion)", () => {
    // Ne détecte pas TOUTES les corrections tronquées (heuristique volontairement
    // ciblée, voir l'audit pédagogique) : uniquement le cas le plus flagrant où la
    // toute dernière phrase de la correction ANNONCE un résultat sans jamais le
    // donner, immédiatement suivie de la fin du texte — jamais un faux positif sur
    // une correction purement conceptuelle (qui n'annonce rien de chiffré).
    const dangling = /\b(on obtient donc|d'où|soit)\s*:?\s*$/i;
    const offenders: string[] = [];
    for (const entry of bank as Array<{ title: string; correction?: string }>) {
      const correction = entry.correction?.trim();
      if (!correction) continue;
      if (dangling.test(correction)) offenders.push(entry.title);
    }
    expect(offenders).toEqual([]);
  });
});

/**
 * Sprint "Phase 6 — Expansion pédagogique" : validation ciblée de la vague
 * ajoutée à la banque (voir le rapport de mission), pour que la couverture
 * gagnée ne puisse pas régresser silencieusement dans une réécriture future
 * du fichier — sans dupliquer les vérifications déjà génériques ci-dessus.
 */
describe("datasets/exercices-banque-complete.json — vague d'expansion (Phase 6)", () => {
  it("la banque contient au moins 230 exercices (195 + la vague d'expansion)", () => {
    expect((bank as unknown[]).length).toBeGreaterThanOrEqual(230);
  });

  it("les chapitres explicitement ciblés par l'expansion existent avec plusieurs exercices actifs", () => {
    const active = (bank as Array<{ subject: string; chapter?: string; archived?: boolean }>).filter((e) => !e.archived);
    const countFor = (subject: string, chapter: string) => active.filter((e) => e.subject === subject && e.chapter === chapter).length;

    expect(countFor("Mathématiques", "Arithmétique dans Z")).toBeGreaterThanOrEqual(4);
    expect(countFor("Mathématiques", "Développements limités")).toBeGreaterThanOrEqual(5);
    expect(countFor("Mathématiques", "Algèbre linéaire")).toBeGreaterThanOrEqual(8);
    expect(countFor("Chimie", "Cinétique chimique")).toBeGreaterThanOrEqual(3);
    expect(countFor("Chimie", "Structure de la matière")).toBeGreaterThanOrEqual(3);
    expect(countFor("Informatique TC", "Les entiers")).toBeGreaterThanOrEqual(2);
  });

  it("le sommet de la pyramide de difficulté (4 et 5) a été renforcé au-delà de l'état pré-expansion (13 exercices actifs)", () => {
    const active = (bank as Array<{ difficulty: number; archived?: boolean }>).filter((e) => !e.archived);
    const topTier = active.filter((e) => e.difficulty >= 4).length;
    expect(topTier).toBeGreaterThan(13);
  });
});
