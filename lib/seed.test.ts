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
});
