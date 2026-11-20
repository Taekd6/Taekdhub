import { parseWikiChapter, WIKI_BASE, WIKI_SLUG } from "@/lib/wikiprepa";

/**
 * GET /api/wikiprepa?chapitre=<slug> → les questions d'un chapitre Wikiprepa
 * (voir lib/wikiprepa.ts). Lit seulement wikiprepa.fr, slug vérifié : ce
 * n'est pas un relais ouvert. Réponse mise en cache un jour.
 */
export const revalidate = 86400;

export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("chapitre") ?? "";
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
  return Response.json(
    { chapitre: slug, source: `${WIKI_BASE}/concours/chapitre/${slug}`, taille: html.length, total: questions.length, incontournables: questions.filter((q) => q.incontournable).length, questions },
    { headers: { "cache-control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
  );
}
