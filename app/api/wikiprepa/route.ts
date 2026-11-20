import { parseWikiChapter, parseWikiChapterList, WIKI_BASE, WIKI_SLUG } from "@/lib/wikiprepa";

/**
 * GET /api/wikiprepa?chapitre=<slug> → les questions d'un chapitre Wikiprepa
 * (voir lib/wikiprepa.ts). Lit seulement wikiprepa.fr, slug vérifié : ce
 * n'est pas un relais ouvert. Réponse mise en cache un jour.
 */
export const revalidate = 86400;

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  if (params.has("liste")) {
    try {
      const res = await fetch(`${WIKI_BASE}/concours/chapitres`, { headers: { "user-agent": "TaekdHub (outil perso de suivi de révisions)" }, next: { revalidate: 86400 }, signal: AbortSignal.timeout(15000) });
      if (!res.ok) return Response.json({ error: `Wikiprepa : ${res.status}.` }, { status: 502 });
      return Response.json({ chapitres: parseWikiChapterList(await res.text()) }, { headers: { "cache-control": "public, s-maxage=86400" } });
    } catch {
      return Response.json({ error: "Wikiprepa ne répond pas." }, { status: 502 });
    }
  }
  const slug = params.get("chapitre") ?? "";
  if (!WIKI_SLUG.test(slug) || slug.length > 80) return Response.json({ error: "Chapitre inconnu." }, { status: 400 });
  let res: Response;
  try {
    res = await fetch(`${WIKI_BASE}/concours/chapitre/${slug}`, {
      headers: { "user-agent": "TaekdHub (outil perso de suivi de révisions)", accept: "text/html" },
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    return Response.json({ error: "Wikiprepa ne répond pas." }, { status: 502 });
  }
  if (!res.ok) return Response.json({ error: `Wikiprepa : ${res.status}.` }, { status: res.status === 404 ? 404 : 502 });
  const html = await res.text();
  const questions = parseWikiChapter(html);
  if (params.has("resume")) {
    const by = (key: "filiere" | "difficulte") => Object.fromEntries([...new Set(questions.map((q) => q[key] ?? "?"))].map((v) => [v, questions.filter((q) => (q[key] ?? "?") === v).length]));
    return Response.json({ chapitre: slug, taille: html.length, total: questions.length, incontournables: questions.filter((q) => q.incontournable).length, filieres: by("filiere"), difficultes: by("difficulte"), exemples: questions.slice(0, 3), liens: (html.match(/\/concours\/ecrit\/[a-z0-9_-]+(?:\/[a-z#0-9-]*)?/gi) ?? []).slice(0, 8) });
  }
  const keep = params.has("classiques") ? questions.filter((q) => q.incontournable) : questions;
  return Response.json(
    { chapitre: slug, source: `${WIKI_BASE}/concours/chapitre/${slug}`, taille: html.length, total: questions.length, incontournables: questions.filter((q) => q.incontournable).length, questions: keep },
    { headers: { "cache-control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
  );
}
