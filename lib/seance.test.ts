import { describe, expect, it } from "vitest";
import { chapterForTask } from "@/lib/seance";

describe("chapitre d'une tâche", () => {
  it("retrouve le chapitre d'Exos depuis le titre", () => {
    expect(chapterForTask({ title: "Physique : cours systèmes ouverts + cartes Anki physique", subject: "Physique" })?.id).toBe("p2-thermo-ouverts");
    expect(chapterForTask({ title: "Physique : cours diffusion thermique", subject: "Physique" })?.id).toBe("p2-diffusion");
    expect(chapterForTask({ title: "Physique : Classiques diffusion thermique (incontournables MP)", subject: "Physique" })?.id).toBe("p2-diffusion");
    expect(chapterForTask({ title: "Rapport d'étape TIPE (M. Balavoine)", subject: "Physique", note: "transformations" })).toBeNull();
    expect(chapterForTask({ title: "Physique : CCINP MP 2021, III.2 (Q18–Q25)", subject: "Physique", note: "Coche Q18 à Q25 dans Exos → Thermodynamique en systèmes ouverts." })?.id).toBe("p2-thermo-ouverts");
    expect(chapterForTask({ title: "Anki : cartes du jour", subject: null })).toBeNull();
  });
});
