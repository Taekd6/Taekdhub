import { describe, expect, it } from "vitest";
import { paperTitle, parseWikiChapter } from "@/lib/wikiprepa";

const card = (slug: string, q: string, extra: string) =>
  `<div class="card"><h3>${slug}, Q${q}</h3>${extra}<a href="/concours/ecrit/${slug}/corrige#q${q}">Indice et corrigé de ${slug}, Q${q}</a></div>`;

describe("lecture d'une page de chapitre Wikiprepa", () => {
  it("une question par lien, avec badge, temps et difficulté", () => {
    const html = `<html><p>Classiques : Incontournables (60)</p><script>var x = "<a href='/concours/ecrit/faux_x_mp_2020/corrige#q1'>"</script><body>
      ${card("ccinp_physique-chimie_mp_2021", "21", "<span>Incontournable</span><p>Temps estimé : ≈ 6 min</p><p>Difficulté : Application directe</p>")}
      ${card("banque-pt_physique-b_pt_2025", "1", "<p>Temps estimé : ≈ 4 min</p><p>Difficulté : Intermédiaire</p>")}
      ${card("ccinp_physique-chimie_mp_2021", "21", "")}
    </body></html>`;
    const qs = parseWikiChapter(html);
    expect(qs).toHaveLength(2);
    expect(qs[0]).toMatchObject({ slug: "ccinp_physique-chimie_mp_2021", question: "21", url: "https://wikiprepa.fr/concours/ecrit/ccinp_physique-chimie_mp_2021/corrige#q21", filiere: "MP", annee: 2021, incontournable: true, minutes: 6, difficulte: "Application directe" });
    expect(qs[1]).toMatchObject({ filiere: "PT", incontournable: false, minutes: 4, difficulte: "Intermédiaire" });
  });
  it("titre lisible de l'épreuve", () => {
    expect(paperTitle("ccinp_physique-chimie_mp_2021").titre).toBe("CCINP Physique-Chimie MP 2021");
    expect(paperTitle("centrale_physique-chimie-1_mp_2020").titre).toBe("CentraleSupélec Physique-Chimie 1 MP 2020");
  });
});

describe("sujets de maths et ordre", () => {
  it("relève les sujets sans ancre, une fois chacun", async () => {
    const { parseWikiSubjects, filiereRank } = await import("@/lib/wikiprepa");
    const html = `<a href="/concours/ecrit/mines_maths-1_mp-mpi_2025">A</a><a href="/concours/ecrit/mines_maths-1_mp-mpi_2025">B</a><a href="/concours/ecrit/centrale_maths-2_pc_2025">C</a><a href="/concours/ecrit/x_y_mp_2020/corrige#q3">D</a>`;
    const sujets = parseWikiSubjects(html);
    expect(sujets.map((s) => s.slug)).toEqual(["mines_maths-1_mp-mpi_2025", "centrale_maths-2_pc_2025"]);
    expect(filiereRank(sujets[0].filiere)).toBe(0);
    expect(filiereRank(sujets[1].filiere)).toBe(1);
  });
});
