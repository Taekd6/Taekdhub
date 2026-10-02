import type { Subject } from "@/lib/supabase/types";

/**
 * LE FORMULAIRE — ce qui se sait par cœur, et qu'on ne redémontre pas le
 * jour du concours : développements limités, primitives, trigonométrie,
 * lois de la physique, relations de chimie.
 *
 * Une carte = un RECTO (ce qu'on demande) et un VERSO (ce qu'il faut
 * savoir écrire). Écrit en Unicode, sans LaTeX : l'écran l'affiche tel quel,
 * hors ligne, sans bibliothèque.
 *
 * Identifiants STABLES (l'historique des tirages s'y rattache) : on ajoute
 * des cartes, on ne renomme pas un identifiant.
 */

export interface FormulaCard {
  id: string;
  subject: Subject;
  /** Rubrique : « DL usuels », « Électromagnétisme »… */
  group: string;
  front: string;
  back: string;
}

type Entry = [id: string, front: string, back: string];

function cards(subject: Subject, group: string, entries: Entry[]): FormulaCard[] {
  return entries.map(([id, front, back]) => ({ id, subject, group, front, back }));
}

export const FORMULAIRE: readonly FormulaCard[] = [
  ...cards("Mathématiques", "DL usuels en 0", [
    ["dl-exp", "DL de eˣ à l'ordre n", "eˣ = 1 + x + x²/2! + … + xⁿ/n! + o(xⁿ)"],
    ["dl-ln", "DL de ln(1 + x) à l'ordre n", "ln(1 + x) = x − x²/2 + x³/3 − … + (−1)ⁿ⁺¹ xⁿ/n + o(xⁿ)"],
    ["dl-inv", "DL de 1/(1 − x) à l'ordre n", "1/(1 − x) = 1 + x + x² + … + xⁿ + o(xⁿ)"],
    ["dl-puiss", "DL de (1 + x)^α à l'ordre 2", "(1 + x)^α = 1 + αx + α(α − 1)/2 · x² + o(x²)"],
    ["dl-sin", "DL de sin x à l'ordre 5", "sin x = x − x³/6 + x⁵/120 + o(x⁵)"],
    ["dl-cos", "DL de cos x à l'ordre 4", "cos x = 1 − x²/2 + x⁴/24 + o(x⁴)"],
    ["dl-tan", "DL de tan x à l'ordre 3", "tan x = x + x³/3 + o(x³)"],
    ["dl-arctan", "DL de arctan x à l'ordre 5", "arctan x = x − x³/3 + x⁵/5 + o(x⁵)"],
    ["dl-sh", "DL de sh x et ch x à l'ordre 4", "sh x = x + x³/6 + o(x⁴) ; ch x = 1 + x²/2 + x⁴/24 + o(x⁴)"],
    ["dl-sqrt", "DL de √(1 + x) à l'ordre 2", "√(1 + x) = 1 + x/2 − x²/8 + o(x²)"],
  ]),
  ...cards("Mathématiques", "Primitives", [
    ["prim-arctan", "Primitive de 1/(1 + x²)", "arctan x"],
    ["prim-arcsin", "Primitive de 1/√(1 − x²) sur ]−1, 1[", "arcsin x"],
    ["prim-tan", "Primitive de tan x", "−ln|cos x|"],
    ["prim-ln", "Primitive de ln x", "x ln x − x"],
    ["prim-a2", "Primitive de 1/(x² + a²), a > 0", "(1/a) arctan(x/a)"],
    ["prim-ipp", "Intégration par parties", "∫ₐᵇ u′v = [uv]ₐᵇ − ∫ₐᵇ uv′ (u, v de classe C¹)"],
  ]),
  ...cards("Mathématiques", "Trigonométrie", [
    ["trig-cos-sum", "cos(a + b)", "cos a cos b − sin a sin b"],
    ["trig-sin-sum", "sin(a + b)", "sin a cos b + cos a sin b"],
    ["trig-tan-sum", "tan(a + b)", "(tan a + tan b)/(1 − tan a tan b)"],
    ["trig-cos2", "cos²x et sin²x en fonction de cos 2x", "cos²x = (1 + cos 2x)/2 ; sin²x = (1 − cos 2x)/2"],
    ["trig-cospq", "cos p + cos q", "2 cos((p + q)/2) cos((p − q)/2)"],
    ["trig-tanhalf", "cos x et sin x en fonction de t = tan(x/2)", "cos x = (1 − t²)/(1 + t²) ; sin x = 2t/(1 + t²)"],
  ]),
  ...cards("Mathématiques", "Sommes et séries", [
    ["sum-k", "Σ k pour k de 1 à n", "n(n + 1)/2"],
    ["sum-k2", "Σ k² pour k de 1 à n", "n(n + 1)(2n + 1)/6"],
    ["sum-k3", "Σ k³ pour k de 1 à n", "(n(n + 1)/2)²"],
    ["sum-geo", "Σ qᵏ pour k de 0 à n (q ≠ 1)", "(1 − qⁿ⁺¹)/(1 − q)"],
    ["serie-basel", "Σ 1/n² (n ≥ 1)", "π²/6"],
    ["serie-riemann", "Convergence de Σ 1/n^α", "Converge si et seulement si α > 1"],
    ["stirling", "Formule de Stirling", "n! ~ √(2πn) (n/e)ⁿ"],
    ["gauss-int", "∫ e^(−x²) sur ℝ", "√π"],
  ]),
  ...cards("Mathématiques", "Algèbre linéaire", [
    ["alg-rang", "Théorème du rang (u : E → F, E de dimension finie)", "dim E = rg u + dim Ker u"],
    ["alg-grassmann", "Formule de Grassmann", "dim(F + G) = dim F + dim G − dim(F ∩ G)"],
    ["alg-vandermonde", "Déterminant de Vandermonde V(x₁, …, xₙ)", "Π_{1 ≤ i < j ≤ n} (xⱼ − xᵢ)"],
    ["alg-chgt-base", "Changement de base pour un endomorphisme", "A′ = P⁻¹ A P (P : matrice de passage de l'ancienne vers la nouvelle base)"],
    ["alg-cs", "Inégalité de Cauchy-Schwarz", "|⟨x, y⟩| ≤ ‖x‖ ‖y‖, égalité si et seulement si x et y sont colinéaires"],
  ]),
  ...cards("Mathématiques", "Probabilités", [
    ["proba-binom", "Espérance et variance de B(n, p)", "E = np ; V = np(1 − p)"],
    ["proba-geom", "Espérance et variance de G(p)", "E = 1/p ; V = (1 − p)/p²"],
    ["proba-poisson", "Espérance et variance de P(λ)", "E = λ ; V = λ"],
    ["proba-bt", "Inégalité de Bienaymé-Tchebychev", "P(|X − E(X)| ≥ ε) ≤ V(X)/ε²"],
    ["proba-markov", "Inégalité de Markov (X ≥ 0)", "P(X ≥ a) ≤ E(X)/a"],
    ["proba-gen", "Espérance par la fonction génératrice G_X", "E(X) = G_X′(1) (si G_X est dérivable en 1)"],
  ]),
  ...cards("Physique", "Mécanique", [
    ["meca-pendule", "Période du pendule simple (petites oscillations)", "T = 2π √(ℓ/g)"],
    ["meca-ressort", "Pulsation d'un ressort (masse m, raideur k)", "ω₀ = √(k/m)"],
    ["meca-kepler", "Troisième loi de Kepler", "T²/a³ = 4π²/(G M)"],
    ["meca-orbite", "Vitesse d'un satellite en orbite circulaire de rayon r", "v = √(G M/r)"],
    ["meca-liberation", "Vitesse de libération depuis une planète de rayon R", "v = √(2 G M/R)"],
    ["meca-tmc", "Théorème du moment cinétique (axe fixe Δ)", "J_Δ θ̈ = Σ M_Δ(forces extérieures)"],
  ]),
  ...cards("Physique", "Électricité", [
    ["elec-rc", "Constante de temps d'un circuit RC, d'un circuit RL", "τ = RC ; τ = L/R"],
    ["elec-rlc", "Pulsation propre et facteur de qualité d'un RLC série", "ω₀ = 1/√(LC) ; Q = (1/R) √(L/C)"],
    ["elec-energies", "Énergie d'un condensateur, d'une bobine", "½ C u² ; ½ L i²"],
    ["elec-imp", "Impédances complexes de R, L, C", "R ; jLω ; 1/(jCω)"],
  ]),
  ...cards("Physique", "Thermodynamique", [
    ["thermo-laplace", "Loi de Laplace (gaz parfait, adiabatique réversible)", "P V^γ = constante"],
    ["thermo-carnot", "Rendement de Carnot d'un moteur ditherme", "η = 1 − T_f/T_c"],
    ["thermo-dS-gp", "ΔS d'un gaz parfait (variables T, V)", "ΔS = n C_v,m ln(T₂/T₁) + n R ln(V₂/V₁)"],
    ["thermo-fourier", "Loi de Fourier", "j_th = −λ grad T"],
    ["thermo-diffusion", "Ordre de grandeur du temps de diffusion sur une longueur L", "τ ~ L²/D"],
    ["thermo-hydro", "Statique des fluides", "dP/dz = −ρ g (axe z vers le haut)"],
  ]),
  ...cards("Physique", "Électromagnétisme", [
    ["em-gauss", "Théorème de Gauss", "∯ E · dS = Q_int/ε₀"],
    ["em-ampere", "Théorème d'Ampère", "∮ B · dℓ = μ₀ I_enlacé"],
    ["em-fil-E", "Champ d'un fil infini de charge linéique λ", "E = λ/(2π ε₀ r)"],
    ["em-fil-B", "Champ d'un fil infini parcouru par I", "B = μ₀ I/(2π r)"],
    ["em-solenoide", "Champ dans un solénoïde infini (n spires par mètre)", "B = μ₀ n I"],
    ["em-condo", "Capacité d'un condensateur plan", "C = ε₀ S/e"],
    ["em-mf", "Équation de Maxwell-Faraday", "rot E = −∂B/∂t"],
    ["em-ma", "Équation de Maxwell-Ampère", "rot B = μ₀ j + μ₀ ε₀ ∂E/∂t"],
    ["em-poynting", "Vecteur de Poynting", "Π = (E ∧ B)/μ₀"],
    ["em-c", "Vitesse de la lumière en fonction de μ₀ et ε₀", "c = 1/√(μ₀ ε₀)"],
    ["em-peau", "Épaisseur de peau dans un conducteur de conductivité γ", "δ = √(2/(μ₀ γ ω))"],
    ["em-plasma", "Relation de dispersion dans un plasma", "k² = (ω² − ω_p²)/c²"],
    ["em-faraday", "Loi de Faraday", "e = −dΦ/dt"],
  ]),
  ...cards("Physique", "Ondes et optique", [
    ["onde-dalembert", "Équation de d'Alembert à une dimension", "∂²f/∂x² − (1/c²) ∂²f/∂t² = 0"],
    ["opt-fresnel", "Formule de Fresnel (deux ondes cohérentes)", "I = I₁ + I₂ + 2 √(I₁ I₂) cos Δφ"],
    ["opt-young", "Interfrange des trous d'Young (écart a, écran à D)", "i = λ D/a"],
    ["opt-diffraction", "Demi-angle de diffraction par une ouverture de taille a", "θ ≈ λ/a"],
    ["opt-descartes", "Relation de conjugaison de Descartes (lentille mince)", "1/OA′ − 1/OA = 1/f′"],
    ["opt-snell", "Loi de Snell-Descartes pour la réfraction", "n₁ sin i₁ = n₂ sin i₂"],
  ]),
  ...cards("Physique", "Quantique", [
    ["q-planck", "Relation de Planck-Einstein", "E = h ν"],
    ["q-debroglie", "Relation de de Broglie", "λ = h/p"],
    ["q-heisenberg", "Inégalité de Heisenberg spatiale", "Δx · Δp ≥ ħ/2"],
    ["q-puits", "Énergies d'une particule dans un puits infini de largeur L", "Eₙ = n² h²/(8 m L²)"],
  ]),
  ...cards("Chimie", "Cinétique et équilibres", [
    ["ch-arrhenius", "Loi d'Arrhenius", "k = A exp(−Eₐ/(R T))"],
    ["ch-ordre1", "Temps de demi-réaction d'une réaction d'ordre 1", "t₁/₂ = ln 2/k"],
    ["ch-dg-k", "Lien entre ΔᵣG° et la constante d'équilibre", "ΔᵣG° = −R T ln K°"],
    ["ch-vanthoff", "Relation de van 't Hoff", "d ln K°/dT = ΔᵣH°/(R T²)"],
  ]),
  ...cards("Chimie", "Solutions aqueuses", [
    ["ch-henderson", "pH d'un mélange acide faible / base conjuguée", "pH = pKₐ + log([A⁻]/[AH])"],
    ["ch-acide-faible", "pH d'un acide faible peu dissocié (concentration c)", "pH = ½ (pKₐ − log c)"],
    ["ch-nernst", "Formule de Nernst à 25 °C", "E = E° + (0,06/n) log(a_ox^α / a_red^β)"],
    ["ch-dg-e", "Lien entre ΔᵣG° et les potentiels standard", "ΔᵣG° = −n F ΔE°"],
    ["ch-faraday", "Constante de Faraday", "F = Nₐ e ≈ 96 500 C·mol⁻¹"],
  ]),
  ...cards("Chimie", "Cristallographie", [
    ["ch-cfc-pop", "Population et coordinence de la maille CFC", "4 atomes par maille ; coordinence 12"],
    ["ch-cfc-compacite", "Compacité de la structure CFC", "π/(3√2) ≈ 0,74"],
    ["ch-cfc-contact", "Condition de contact dans un CFC (arête a, rayon r)", "a√2 = 4r (contact selon la diagonale d'une face)"],
  ]),
];

export const FORMULAIRE_SUBJECTS: readonly Subject[] = ["Mathématiques", "Physique", "Chimie"];

/** Les rubriques d'une matière, dans l'ordre du formulaire. */
export function formulaGroups(subject: Subject): string[] {
  const out: string[] = [];
  for (const card of FORMULAIRE) if (card.subject === subject && !out.includes(card.group)) out.push(card.group);
  return out;
}
