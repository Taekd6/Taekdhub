"use client";

import { useEffect, useMemo, useState } from "react";
import { caseKey, type CaseState, type ExoEntry, type NewExo } from "@/lib/exos";
import type { ProgrammeChapter } from "@/lib/programme-data";
import { filiereRank, type WikiQuestion, type WikiSubject } from "@/lib/wikiprepa";
import { booleanoperaUrl, wikiSlugsFor } from "@/lib/wikiprepa-map";

/**
 * ONGLET « CLASSIQUES » D'UN CHAPITRE : les questions de concours que
 * Wikiprepa marque « Incontournable » (physique-chimie), lues en direct
 * par /api/wikiprepa. MP/MPI d'abord. Un tap sur une question pas encore
 * suivie ouvre son corrigé et la range dans le catalogue ; une question
 * déjà suivie ouvre la fiche de notation. En maths, Wikiprepa ne découpe
 * pas en questions : on liste les sujets du chapitre.
 */
type Loaded = { questions: WikiQuestion[]; sujets: WikiSubject[] };

const cache = new Map<string, Loaded>();

const bare = (url: string) => url.replace(/#.*$/, "").replace(/\/+$/, "").toLowerCase();

export function ExosClassiques({
  chapter,
  entries,
  states,
  today,
  onPick,
  onAddLink,
  onAddSubject,
}: {
  chapter: ProgrammeChapter;
  entries: ExoEntry[];
  states: Map<string, CaseState>;
  today: string;
  onPick: (entry: ExoEntry, question: string | null) => void;
  onAddLink: (url: string) => void;
  onAddSubject: (exo: NewExo) => void;
}) {
  const slugs = useMemo(() => wikiSlugsFor(chapter.id), [chapter.id]);
  const [data, setData] = useState<Loaded | null>(() => cache.get(chapter.id) ?? null);
  const [error, setError] = useState<string | null>(null);
  const [all, setAll] = useState(true);
  const [mpOnly, setMpOnly] = useState(false);

  useEffect(() => {
    if (!slugs.length || cache.has(chapter.id)) return;
    let alive = true;
    setError(null);
    Promise.all(
      slugs.map((slug) =>
        fetch(`/api/wikiprepa?chapitre=${encodeURIComponent(slug)}`).then(async (res) => {
          const body = (await res.json()) as { questions?: WikiQuestion[]; sujets?: WikiSubject[]; error?: string };
          if (!res.ok) throw new Error(body.error ?? `Erreur ${res.status}`);
          return body;
        })
      )
    )
      .then((pages) => {
        const seen = new Set<string>();
        const questions: WikiQuestion[] = [];
        const sujets: WikiSubject[] = [];
        for (const page of pages) {
          for (const q of page.questions ?? []) {
            const key = `${q.slug}#${q.question}`;
            if (!seen.has(key)) {
              seen.add(key);
              questions.push(q);
            }
          }
          for (const s of page.sujets ?? []) if (!seen.has(s.slug)) {
            seen.add(s.slug);
            sujets.push(s);
          }
        }
        const loaded = { questions, sujets };
        cache.set(chapter.id, loaded);
        if (alive) setData(loaded);
      })
      .catch((err: unknown) => alive && setError(err instanceof Error ? err.message : "Wikiprepa ne répond pas."));
    return () => {
      alive = false;
    };
  }, [chapter.id, slugs]);

  /** Où en est l'élève sur une question Wikiprepa : l'entrée du catalogue qui la contient, et l'état de sa case. */
  const tracked = (paper: string, question: string | null) => {
    const entry = entries.find((item) => item.url && bare(item.url) === bare(paper) && (question === null || item.questions.includes(question)));
    if (!entry) return null;
    return { entry, state: states.get(caseKey(chapter.id, entry.id, question)) ?? null };
  };

  const papers = useMemo(() => {
    if (!data) return [];
    /* Un sujet MPI qui a son jumeau MP (CCINP, Centrale…) répète les mêmes questions avec une autre numérotation : on garde le MP. */
    const slugs = new Set(data.questions.map((q) => q.slug));
    const list = data.questions.filter((q) => !(q.filiere === "MPI" && slugs.has(q.slug.replace(/_mpi_/, "_mp_"))) && (all || q.incontournable) && (!mpOnly || filiereRank(q.filiere) === 0));
    const groups = new Map<string, WikiQuestion[]>();
    for (const q of list) groups.set(q.slug, [...(groups.get(q.slug) ?? []), q]);
    return [...groups.values()]
      .map((qs) => qs.sort((a, b) => Number(a.question) - Number(b.question)))
      .sort((a, b) => filiereRank(a[0].filiere) - filiereRank(b[0].filiere) || (b[0].annee ?? 0) - (a[0].annee ?? 0) || a[0].titre.localeCompare(b[0].titre));
  }, [data, all, mpOnly]);

  const subjects = useMemo(
    () => (data?.sujets ?? []).filter((s) => !mpOnly || filiereRank(s.filiere) === 0).sort((a, b) => filiereRank(a.filiere) - filiereRank(b.filiere) || (b.annee ?? 0) - (a.annee ?? 0)),
    [data, mpOnly]
  );

  if (!slugs.length) return <div className="x-card"><p className="x-meta">Pas de page Wikiprepa pour ce chapitre.</p></div>;
  if (error) return <div className="x-card"><p className="x-meta">Wikiprepa n&apos;a pas répondu ({error}). Réessaie dans un moment.</p></div>;
  if (!data) return <div className="x-card"><div className="x-emptyc">Lecture de Wikiprepa…</div></div>;

  const totalClassiques = data.questions.filter((q) => q.incontournable).length;
  const doneClassiques = data.questions.filter((q) => q.incontournable && tracked(q.paper, q.question)?.state).length;
  const caseClass = (state: CaseState | null) => (!state ? "" : state.next <= today ? `${state.status} due` : state.status);

  return (
    <div className="x-card">
      <div className="x-row" style={{ justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <div>
          <h4 style={{ margin: 0 }}>Toutes les questions de concours</h4>
          <p className="x-meta" style={{ marginTop: 4 }}>
            {data.questions.length
              ? `${data.questions.length} questions · tous concours et filières (Mines-Ponts, Centrale, X-ENS, CCINP, E3A, PT…) · ${doneClassiques}/${totalClassiques} incontournables faits (en gras)`
              : `${subjects.length} sujets de concours sur ce chapitre`}
            {" · "}
            <a href={`https://wikiprepa.fr/concours/chapitre/${slugs[0]}`} target="_blank" rel="noopener noreferrer">
              Wikiprepa ↗
            </a>
            {booleanoperaUrl(chapter.id) && (
              <>
                {" · "}
                <a href={booleanoperaUrl(chapter.id)!} target="_blank" rel="noopener noreferrer">
                  Cours Booleanopera ↗
                </a>
              </>
            )}
          </p>
        </div>
        <div className="x-tabs" role="group" aria-label="Afficher" style={{ margin: 0 }}>
          {data.questions.length > 0 && (
            <button type="button" className="x-tab" aria-pressed={!all} onClick={() => setAll((v) => !v)}>
              {all ? "Tout afficher" : "Incontournables seuls"}
            </button>
          )}
          <button type="button" className="x-tab" aria-pressed={mpOnly} onClick={() => setMpOnly((v) => !v)}>
            MP seulement
          </button>
        </div>
      </div>

      {papers.map((qs) => {
        const head = qs[0];
        return (
          <div key={head.slug} className="x-ex">
            <div className="x-ex-n">
              <span>{head.titre}</span>
              <a href={head.paper} target="_blank" rel="noopener noreferrer">
                Sujet ↗
              </a>
            </div>
            <div className="x-qs">
              {qs.map((q) => {
                const t = tracked(q.paper, q.question);
                return (
                  <button
                    key={q.question}
                    type="button"
                    className={`x-q ${caseClass(t?.state ?? null)}`}
                    title={[q.incontournable ? "Incontournable" : null, q.minutes ? `≈ ${q.minutes} min` : null, q.difficulte].filter(Boolean).join(" · ")}
                    aria-label={`Question ${q.question}${t?.state ? " (suivie)" : ""}`}
                    style={q.incontournable && all ? { fontWeight: 800 } : undefined}
                    onClick={() => {
                      if (t) return onPick(t.entry, q.question);
                      window.open(q.url, "_blank", "noopener");
                      onAddLink(q.url);
                    }}
                  >
                    {q.question}
                  </button>
                );
              })}
            </div>
            <div className="x-meta">{[qs.reduce((n, q) => n + (q.minutes ?? 0), 0) ? `≈ ${qs.reduce((n, q) => n + (q.minutes ?? 0), 0)} min` : null, [...new Set(qs.map((q) => q.difficulte).filter(Boolean))].join(", ")].filter(Boolean).join(" · ")}</div>
          </div>
        );
      })}

      {subjects.map((s) => {
        const t = tracked(s.url, null);
        return (
          <div key={s.slug} className="x-ex">
            <div className="x-ex-n">
              <span>{s.titre}</span>
              <a href={s.url} target="_blank" rel="noopener noreferrer">
                Sujet ↗
              </a>
            </div>
            <div className="x-qs">
              {t ? (
                <button type="button" className={`x-q wide ${caseClass(t.state)}`} onClick={() => onPick(t.entry, null)}>
                  {t.state ? "Suivi" : "Dans ton suivi"}
                </button>
              ) : (
                <button type="button" className="x-q wide" onClick={() => onAddSubject({ source: "annale", titre: s.titre, url: s.url, ...(s.annee ? { annee: s.annee } : {}), questions: [] })}>
                  + Suivre
                </button>
              )}
            </div>
          </div>
        );
      })}

      {data.questions.length > 0 && papers.length === 0 && <p className="x-meta">Rien avec ces filtres.</p>}
      <p className="x-meta" style={{ marginTop: 12 }}>
        {data.questions.length
          ? "Touche une question : son corrigé s'ouvre et elle entre dans ton suivi. Une question déjà suivie ouvre la notation."
          : "En maths, Wikiprepa range des sujets entiers, sans repérer les questions classiques : suis un sujet pour le cocher, puis ajoute ses questions."}
      </p>
    </div>
  );
}
