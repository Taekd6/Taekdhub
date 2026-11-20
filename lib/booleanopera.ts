/**
 * BOOLEANOPERA — le relevé de TON suivi sur booleanopera.fr, rangé dans TaekdHub.
 *
 * Booleanopera n'a pas d'API : son bilan n'est lisible que connecté, dans
 * le navigateur. Le SIGNET (`bookmarkletHref`) tourne donc sur booleanopera.fr,
 * avec ta session, lit la page « Mon bilan » et ouvre TaekdHub avec les
 * chiffres dans le FRAGMENT de l'adresse (`#bo=…`). Un fragment n'est jamais
 * envoyé à un serveur : rien ne transite hors de ton navigateur, aucun mot de
 * passe ni jeton n'est lu ni stocké.
 *
 * Ce sont des chiffres de l'instant du relevé (`takenAt`), pas un état en direct.
 */

export interface BooleanoperaReport {
  takenAt: string;
  /** Briques pointées sur le site. */
  bricks: number;
  acquired: number;
  inProgress: number;
  toReview: number;
  /** Passages au tableau enregistrés. */
  boardPassages: number;
  /** Assignations (cours et TD) faites / en cours. */
  assignmentsDone: number;
  assignmentsOpen: number;
}

const MAX = 100_000;

function num(raw: unknown): number {
  return typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? Math.min(MAX, Math.round(raw)) : 0;
}

export function normalizeBooleanopera(raw: unknown): BooleanoperaReport | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const item = raw as Record<string, unknown>;
  if (typeof item.takenAt !== "string" || Number.isNaN(new Date(item.takenAt).getTime())) return null;
  return {
    takenAt: new Date(item.takenAt).toISOString(),
    bricks: num(item.bricks),
    acquired: num(item.acquired),
    inProgress: num(item.inProgress),
    toReview: num(item.toReview),
    boardPassages: num(item.boardPassages),
    assignmentsDone: num(item.assignmentsDone),
    assignmentsOpen: num(item.assignmentsOpen),
  };
}

const first = (text: string, pattern: RegExp): number[] | null => {
  const match = text.match(pattern);
  return match ? match.slice(1).map((value) => Number(value)) : null;
};

/** Lit le texte de la page « Bilan » de Booleanopera. Renvoie null si rien de reconnaissable. */
export function parseBilanText(text: string, now: Date): BooleanoperaReport | null {
  const flat = text.replace(/\s+/g, " ");
  const passages = first(flat, /(\d+) passage\(s\)/);
  const assignments = first(flat, /(\d+) faites? • (\d+) en cours/);
  const bricks = first(flat, /(\d+) briques? pointées?/);
  const status = first(flat, /(\d+) acquises? • (\d+) en cours • (\d+) à revoir/);
  if (!passages && !assignments && !bricks && !status) return null;
  return normalizeBooleanopera({
    takenAt: now.toISOString(),
    bricks: bricks?.[0],
    acquired: status?.[0],
    inProgress: status?.[1],
    toReview: status?.[2],
    boardPassages: passages?.[0],
    assignmentsDone: assignments?.[0],
    assignmentsOpen: assignments?.[1],
  });
}

const FRAGMENT_KEY = "bo=";

export function encodeFragment(report: BooleanoperaReport): string {
  const json = JSON.stringify(report);
  const base64 = typeof btoa === "function" ? btoa(unescape(encodeURIComponent(json))) : Buffer.from(json, "utf8").toString("base64");
  return FRAGMENT_KEY + base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Lit `#bo=…` ; refuse tout ce qui n'est pas un relevé valide. */
export function decodeFragment(hash: string): BooleanoperaReport | null {
  const raw = hash.replace(/^#/, "");
  if (!raw.startsWith(FRAGMENT_KEY) || raw.length > 2000) return null;
  try {
    const base64 = raw.slice(FRAGMENT_KEY.length).replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json = typeof atob === "function" ? decodeURIComponent(escape(atob(padded))) : Buffer.from(padded, "base64").toString("utf8");
    return normalizeBooleanopera(JSON.parse(json));
  } catch {
    return null;
  }
}

/**
 * Le signet (`javascript:`), à glisser dans la barre de favoris et à lancer
 * sur booleanopera.fr une fois connecté. Il lit « Mon bilan » (lien `/classe/…`
 * de la barre de navigation), applique le même analyseur que `parseBilanText`
 * et ouvre TaekdHub.
 */
export function bookmarkletHref(origin: string): string {
  const target = JSON.stringify(`${origin.replace(/\/$/, "")}/exos`);
  const code = `(async()=>{try{if(!/booleanopera\\.fr$/.test(location.hostname)){alert("Lance ce signet sur booleanopera.fr, une fois connecté.");return}
const a=document.querySelector('a[href^="/classe/"]');if(!a){alert("Connecte-toi d'abord à Booleanopera.");return}
const h=await (await fetch(a.getAttribute("href"),{credentials:"same-origin"})).text();
const t=new DOMParser().parseFromString(h,"text/html").body.innerText.replace(/\\s+/g," ");
const f=(r)=>{const m=t.match(r);return m?m.slice(1).map(Number):null};
const p=f(/(\\d+) passage\\(s\\)/),s=f(/(\\d+) faites? • (\\d+) en cours/),b=f(/(\\d+) briques? pointées?/),k=f(/(\\d+) acquises? • (\\d+) en cours • (\\d+) à revoir/);
if(!p&&!s&&!b&&!k){alert("Bilan illisible.");return}
const r={takenAt:new Date().toISOString(),bricks:b?b[0]:0,acquired:k?k[0]:0,inProgress:k?k[1]:0,toReview:k?k[2]:0,boardPassages:p?p[0]:0,assignmentsDone:s?s[0]:0,assignmentsOpen:s?s[1]:0};
const e=btoa(unescape(encodeURIComponent(JSON.stringify(r)))).replace(/\\+/g,"-").replace(/\\//g,"_").replace(/=+$/,"");
location.href=${target}+"#bo="+e}catch(x){alert("Relevé impossible : "+x.message)}})()`;
  return "javascript:" + encodeURIComponent(code.replace(/\n/g, ""));
}
