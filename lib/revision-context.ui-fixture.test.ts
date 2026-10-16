import { describe, expect, it } from "vitest";
import fixture from "@/lib/__fixtures__/ui-capture.json";
import { buildRevisionContext, revisionInputFrom } from "@/lib/revision-context";

/**
 * DONNÉES ÉCRITES PAR LA VRAIE INTERFACE de TaekdHub (Chromium, voir
 * scripts/e2e/capture-ui-data.mjs) : une khôlle saisie dans Échéances, son
 * programme choisi dans la boîte « Programme », deux débriefs IA collés puis
 * enregistrés, deux restitutions de démonstration enregistrées. Toutes les
 * données de test portent « [TEST] » ; aucune n'est réelle (élève).
 *
 * Distinction à garder en tête :
 *   RÉEL      la forme exacte des données, telle que l'application les stocke ;
 *   SIMULÉ    le contenu (dates, résultats, causes) : saisi par un script de test.
 * L'outil MCP lui-même (lecture de Supabase) n'est pas appelé ici : il lit les
 * mêmes collections JSON, que ce test lui donne directement.
 */
const NOW = new Date(2026, 9, 16, 18, 0);

function context(filter = {}) {
  return buildRevisionContext(revisionInputFrom(JSON.parse(JSON.stringify(fixture)), [], NOW), filter);
}

describe("sur des données écrites par la vraie interface", () => {
  it("les données sont bien de test et complètes : échéance, chapitre, débriefs, restitutions", () => {
    expect((fixture.workItems as { title: string }[]).every((item) => item.title.startsWith("[TEST]"))).toBe(true);
    expect(fixture.workItems).toHaveLength(1);
    expect(fixture.chapterMemory).toHaveLength(1);
    expect(fixture.grades).toHaveLength(2);
    expect((fixture.attempts as { origin: string }[]).filter((attempt) => attempt.origin === "démonstration")).toHaveLength(2);
  });

  it("la prochaine khôlle est retrouvée avec le programme saisi dans l'application, rattaché au programme officiel", () => {
    const ctx = context({ type: "colle" });
    expect(ctx.echeances.map((e) => e.echeance.titre)).toEqual(["[TEST] Khôlle maths vendredi"]);
    const [exam] = ctx.echeances;
    expect(exam.echeance).toMatchObject({ type: "khôlle", date: "2026-10-23", dans_jours: 7, matiere: "Mathématiques" });
    expect(exam.programme.connu).toBe(true);
    expect(exam.chapitres.map((c) => c.chapitre)).toEqual([{ id: "m1-applications-lineaires", titre: "Applications linéaires" }]);
  });

  it("la démonstration du chapitre est rattachée ; celles des autres chapitres de la matière ne le sont pas", () => {
    const [exam] = context({ type: "colle" }).echeances;
    expect(exam.chapitres[0].demonstrations.map((d) => d.id)).toEqual(["m1-theoreme-du-rang"]);
    expect(JSON.stringify(exam)).not.toContain("m1-cauchy-schwarz");
    expect(exam.chapitres[0].demonstrations[0]).toMatchObject({ etat: "Restitution incomplète", restitutions_enregistrees: 2 });
  });

  it("les recommandations s'appuient sur les débriefs et restitutions réellement enregistrés, avec leurs faits", () => {
    const ctx = context({ type: "colle" });
    const [exam] = ctx.echeances;
    expect(exam.chapitres[0].difficulte).toMatchObject({ niveau: "récurrente", donnees_suffisantes: true });
    expect(exam.chapitres[0].erreurs_ouvertes_evaluations_precedentes.map((e) => e.evaluation).sort()).toEqual(["[TEST] DS 1 — applications linéaires", "[TEST] DS 2 — applications linéaires"]);
    const first = ctx.priorites[0];
    expect(first).toMatchObject({ demonstration: "m1-theoreme-du-rang", chapitre: "Applications linéaires" });
    expect(first.pourquoi_ce_rang).toMatch(/restitution observée ratée/);
    // La carte n'est pas connue de TaekdHub : on propose de l'ajouter, jamais de « revoir » une carte dont on ignore l'existence.
    expect(first.action).toBe("ajouter-carte-anki");
    expect(ctx.priorites.map((p) => p.action)).toEqual(expect.arrayContaining(["rappel-actif"]));
    for (const priority of ctx.priorites) {
      expect(priority.pourquoi.length).toBeGreaterThan(0);
      expect(priority.verification).toBeTruthy();
    }
  });

  it("aucun relevé Anki : l'état d'Anki est déclaré inconnu, rien n'est inventé", () => {
    const ctx = context({ type: "colle" });
    expect(ctx.anki).toMatch(/Aucun relevé Anki enregistré/);
    expect(ctx.echeances[0].chapitres[0].anki).toBeNull();
    expect(ctx.echeances[0].chapitres[0].demonstrations[0].carte_anki.dans_anki).toBe("inconnu");
  });

  it("aucun DS n'est daté : le contexte le dit au lieu d'inventer une préparation", () => {
    const ctx = context({ type: "DS" });
    expect(ctx.echeances).toEqual([]);
    expect(ctx.priorites).toEqual([]);
    expect(ctx.donnees_manquantes.join(" ")).toMatch(/Aucune DS datée/);
  });

  it("filtres par matière et par chapitre", () => {
    expect(context({ subject: "Physique" }).echeances).toEqual([]);
    expect(context({ chapterId: "m1-applications-lineaires" }).echeances[0].chapitres).toHaveLength(1);
    expect(context({ chapterId: "m2-reduction" }).echeances[0].chapitres).toEqual([]);
  });
});
