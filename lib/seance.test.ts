import { describe, expect, it } from "vitest";
import { chapterForTask } from "@/lib/seance";

describe("chapitre d'une tâche", () => {
  it("retrouve le chapitre d'Exos depuis le titre", () => {
    expect(chapterForTask({ title: "Physique : cours systèmes ouverts + cartes Anki physique", subject: "Physique" })?.id).toBe("p2-thermo-ouverts");
    expect(chapterForTask({ title: "Physique : cours diffusion thermique", subject: "Physique" })?.id).toBe("p2-diffusion");
    expect(chapterForTask({ title: "Physique : Classiques diffusion thermique (incontournables MP)", subject: "Physique" })?.id).toBe("p2-diffusion");
    expect(chapterForTask({ title: "Anki : cartes du jour", subject: null })).toBeNull();
  });
});
