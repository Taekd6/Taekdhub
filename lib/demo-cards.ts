/**
 * CARTE ANKI DE DÉMONSTRATION — le type de note, et le rendu d'une
 * démonstration en champs Anki.
 *
 * MODULE PUR, sans import d'application : le même code sert l'application
 * (aperçu, AnkiConnect) et le script de génération du paquet
 * (`scripts/export-demo-notes.mjs`, qui l'exécute directement avec Node).
 *
 * CE QUE LA CARTE EXIGE
 *   recto   le nom, les HYPOTHÈSES, la consigne « sans support », et une
 *           grande zone vide pour reconstruire la preuve. Jamais l'énoncé ni
 *           la preuve : la restitution précède le verso.
 *   verso   l'énoncé exact, la preuve étape par étape (avec ses
 *           justifications), les points critiques à vérifier.
 *
 * AUCUN JAVASCRIPT dans le modèle. Le « tableau blanc » est celui d'Anki :
 * le bloc vide du recto laisse la place d'écrire, et la consigne renvoie au
 * Scratchpad d'AnkiMobile (iPhone, iPad, Apple Pencil) ou au Whiteboard
 * d'AnkiDroid. Sur ordinateur, Anki n'a pas de tableau intégré : papier.
 * Un modèle sans script s'affiche de la même façon partout et n'a pas à être
 * entretenu quand Anki évolue.
 *
 * RÉFÉRENCE STABLE. Le champ `Ref` (« th-demo-<id> ») identifie la
 * démonstration dans TaekdHub ET dans Anki. Le GUID de la note en est tiré :
 * réimporter une version corrigée met la note à jour au lieu de la
 * dupliquer, et l'historique de révision reste dans Anki. TaekdHub ne stocke
 * jamais d'identifiant interne de note Anki (propre à une collection) : il
 * retrouve la note par `Ref`.
 */

export interface DemoStep {
  text: string;
  /** La justification qui fait tenir l'étape (théorème invoqué, hypothèse utilisée). */
  why?: string;
}

export interface Demonstration {
  /** Stable pour toujours : `m1-theoreme-du-rang`. Jamais renommé (il est dans les observations et dans Anki). */
  id: string;
  /** Chapitre de la carte du programme (lib/programme-data.ts). */
  chapterId: string;
  title: string;
  kind: "théorème" | "proposition" | "lemme";
  hypotheses: string[];
  /** L'énoncé exact, conclusion comprise. */
  statement: string;
  steps: DemoStep[];
  critical: string[];
  /**
   * D'où vient la rédaction — affiché au verso. L'énoncé et la preuve sont une
   * rédaction classique, pas le texte de ton cours : on le dit.
   */
  sources?: string[];
}

export const DEMO_MODEL_NAME = "TaekdHub — Démonstration";
export const DEMO_TAG = "démonstration";
export const DEMO_FIELDS = ["Nom", "Hypotheses", "Enonce", "Preuve", "Critiques", "Ref", "Chapitre", "Source"] as const;

export const DEMO_QFMT = `<div class="th-demo">
  <div class="th-kind">Démonstration à restituer</div>
  <div class="th-name">{{Nom}}</div>
  {{#Hypotheses}}<div class="th-hyp"><b>Hypothèses</b>{{Hypotheses}}</div>{{/Hypotheses}}
  <div class="th-task">Sans support : énonce précisément le résultat, puis démontre-le en entier — au tableau, sur papier ou au Scratchpad. Ne retourne la carte qu'après.</div>
  <div class="th-board" aria-label="Zone de travail"></div>
</div>`;

export const DEMO_AFMT = `<div class="th-demo">
  <div class="th-kind">Référence</div>
  <div class="th-name">{{Nom}}</div>
  <div class="th-block"><b>Énoncé</b><div class="th-statement">{{Enonce}}</div></div>
  <div class="th-block"><b>Démonstration</b>{{Preuve}}</div>
  {{#Critiques}}<div class="th-block th-critical"><b>Points critiques à vérifier dans ta restitution</b>{{Critiques}}</div>{{/Critiques}}
  {{#Source}}<div class="th-source">{{Source}}</div>{{/Source}}
  <div class="th-ref">{{Chapitre}} · {{Ref}}</div>
</div>`;

export const DEMO_CSS = `.card { font-family: -apple-system, "Segoe UI", sans-serif; font-size: 19px; line-height: 1.45; text-align: left; color: #1f2430; background: #fbfaf7; }
.th-demo { max-width: 40rem; margin: 0 auto; }
.th-kind { font-size: 0.72em; letter-spacing: .08em; text-transform: uppercase; color: #8a8f9c; }
.th-name { font-size: 1.25em; font-weight: 700; margin: .2em 0 .7em; }
.th-hyp ul, .th-block ul, .th-block ol { margin: .3em 0 .6em 1.2em; padding: 0; }
.th-hyp b, .th-block b { display: block; font-size: .85em; color: #5b6272; }
.th-task { margin: .9em 0; padding: .6em .8em; border-left: 3px solid #1f2430; background: #f0eee8; }
.th-board { min-height: 45vh; border: 1.5px dashed #b8bcc7; border-radius: 10px; }
.th-block { margin: .8em 0; }
.th-statement { margin: .3em 0; }
.th-why { display: block; font-size: .85em; color: #5b6272; }
.th-critical { padding: .5em .8em; border-left: 3px solid #b3402f; background: #f7ecea; }
.th-source { margin-top: 1em; font-size: .75em; color: #5b6272; }
.th-ref { margin-top: .6em; font-size: .7em; color: #8a8f9c; }
.nightMode .card, .night_mode .card { color: #e8e9ee; background: #1d1f26; }
.nightMode .th-task, .night_mode .th-task { background: #2a2d37; border-color: #e8e9ee; }
.nightMode .th-critical, .night_mode .th-critical { background: #34262a; }`;

export function demoRef(id: string): string {
  return `th-demo-${id}`;
}

function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function list(tag: "ul" | "ol", items: string[]): string {
  return items.length === 0 ? "" : `<${tag}>${items.map((item) => `<li>${item}</li>`).join("")}</${tag}>`;
}

/** Les champs Anki d'une démonstration — du texte échappé, jamais de HTML venu des données. */
export function renderDemoFields(demo: Demonstration, chapterTitle: string): Record<(typeof DEMO_FIELDS)[number], string> {
  return {
    Nom: esc(`${demo.title}`),
    Hypotheses: list("ul", demo.hypotheses.map(esc)),
    Enonce: esc(demo.statement).replace(/\n/g, "<br>"),
    Preuve: list(
      "ol",
      demo.steps.map((step) => `${esc(step.text)}${step.why ? `<span class="th-why">↳ ${esc(step.why)}</span>` : ""}`)
    ),
    Critiques: list("ul", demo.critical.map(esc)),
    Ref: demoRef(demo.id),
    Chapitre: esc(chapterTitle),
    Source: (demo.sources ?? []).map(esc).join("<br>"),
  };
}

export interface DemoNote {
  ref: string;
  deck: string;
  fields: Record<(typeof DEMO_FIELDS)[number], string>;
  tags: string[];
}

export function demoNote(demo: Demonstration, deck: string, chapterTitle: string): DemoNote {
  return { ref: demoRef(demo.id), deck, fields: renderDemoFields(demo, chapterTitle), tags: ["taekdhub", DEMO_TAG, demo.kind] };
}

/** Le type de note, tel que la collection (AnkiConnect `createModel`) ou le paquet le veut. */
export const DEMO_MODEL = {
  modelName: DEMO_MODEL_NAME,
  inOrderFields: [...DEMO_FIELDS],
  css: DEMO_CSS,
  cardTemplates: [{ Name: "Restitution", Front: DEMO_QFMT, Back: DEMO_AFMT }],
};

/** Ce que la face avant d'une note rendrait, avec les champs substitués (aperçu dans l'application — Anki fait le vrai rendu). */
export function previewFace(face: "front" | "back", fields: Record<string, string>): string {
  const template = face === "front" ? DEMO_QFMT : DEMO_AFMT;
  return template
    .replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, name: string, inner: string) => (fields[name] ? inner : ""))
    .replace(/\{\{(\w+)\}\}/g, (_, name: string) => fields[name] ?? "");
}
