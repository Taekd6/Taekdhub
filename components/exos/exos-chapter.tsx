"use client";

import "./exos.css";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useExos } from "@/hooks/use-exos";
import { notesFor } from "@/lib/chapter-notes";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { chapterStats, entryCases, EXO_SOURCE_LABEL, questionUrl, resumeQuestion, weakCases, dueCases, type CaseState, type ExoEntry, type ExoSource, type DueCase } from "@/lib/exos";
import type { ProgrammeChapter } from "@/lib/programme-data";
import { AddSheet, GradeSheet, SessionSheet } from "@/components/exos/exos-sheets";
import { ExosClassiques } from "@/components/exos/exos-classiques";
import { ConcoursBadge } from "@/components/exos/concours-badge";
import { exoAnchor, parseExoTarget } from "@/lib/exo-target";
import { booleanoperaUrl, wikiSlugsFor } from "@/lib/wikiprepa-map";

const BASE = "https://wikiprepa.fr/concours/chapitre/";
const SOURCE_HINT: Record<ExoSource, string> = {
  annale: "Sujets d'écrit · une case par question",
  beos: "Oraux, tous concours · une case par exo",
  manuel: "Livre, exo, page · une case par question",
  autre: "TD du prof et liens collés",
};
const SOURCE_TITLE: Record<ExoSource, string> = { annale: "Annales d'écrit · Wikiprepa", beos: "Oraux · BEOS", manuel: "Manuels", autre: "TD et autres" };

type Filter = "tout" | ExoSource | "revoir" | "classiques";

function caseClass(state: CaseState | undefined, today: string): string {
  if (!state) return "";
  return state.next <= today ? `${state.status} due` : state.status;
}

function caseTitle(state: CaseState | undefined, today: string): string {
  if (!state) return "Pas fait";
  const label = { seul: "Fait seul", indices: "Avec indices", rate: "Raté" }[state.status];
  return state.next <= today ? `${label} · à revoir aujourd'hui` : `${label} · revient le ${state.next.slice(8, 10)}/${state.next.slice(5, 7)}`;
}

/**
 * UN CHAPITRE DANS EXOS : ses trois sources (annales, BEOS, manuels), une case
 * par question. Un tap sur une case ouvre le geste (seul, indices, raté).
 * `embedded` : dans l'onglet Exos de la page du chapitre, sans en-tête.
 */
export function ExosChapter({ chapter, embedded = false }: { chapter: ProgrammeChapter; embedded?: boolean }) {
  const { chapterNotes } = usePrepahubData();
  const { ready, today, catalogue, states, grade, undo, addEntries, addLinks } = useExos();
  const entries = useMemo(() => notesFor(chapterNotes, chapter.id)?.exos ?? [], [chapterNotes, chapter.id]);
  const stats = useMemo(() => chapterStats({ chapter, entries }, states, today), [chapter, entries, states, today]);
  const [filter, setFilter] = useState<Filter>("tout");
  const [picked, setPicked] = useState<{ entry: ExoEntry; question: string | null } | null>(null);
  const [adding, setAdding] = useState(false);
  const [session, setSession] = useState<{ title: string; items: DueCase[] } | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  /* Lien direct (#exo-<id>, avec ?q=<question>) : affiche tout, descend jusqu'à l'exo visé et le met en évidence. */
  const [target, setTarget] = useState<{ id: string; question: string | null } | null>(null);
  useEffect(() => {
    if (!mounted) return;
    const wanted = parseExoTarget(window.location.hash);
    if (wanted) {
      setFilter("tout");
      setTarget(wanted);
    }
  }, [mounted]);
  useEffect(() => {
    if (!target || !ready) return;
    const frame = requestAnimationFrame(() => document.getElementById(exoAnchor(target.id))?.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }));
    return () => cancelAnimationFrame(frame);
  }, [target, ready, entries.length]);

  /* Seules les sources qui ont des entrées : une colonne vide prend de la place pour rien (l'ajout reste en bas de chaque colonne et dans « + Ajouter »). */
  const filled = (["annale", "beos", "manuel", "autre"] as const).filter((source) => entries.some((entry) => entry.source === source));
  const sources = filled.length ? filled : (["annale", "beos", "manuel"] as const);
  const visible = (entry: ExoEntry) => {
    if (filter === "tout") return true;
    if (filter === "revoir") return entryCases(chapter.id, entry).some(({ key }) => (states.get(key)?.next ?? "9999") <= today);
    return entry.source === filter;
  };
  const dueHere = useMemo(() => dueCases(catalogue, states, today, chapter.id), [catalogue, states, today, chapter.id]);
  const weakHere = useMemo(() => weakCases(catalogue, states, chapter.id), [catalogue, states, chapter.id]);
  const share = (n: number) => (stats.cases ? (n / stats.cases) * 100 : 0);

  const body = (
    <>
      <div className="x-row" style={{ gap: 18, alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 260px" }}>
          <div className="x-bar" style={{ height: 9 }}>
            <i className="b-ok" style={{ width: `${share(stats.seul)}%` }} />
            <i className="b-mid" style={{ width: `${share(stats.indices)}%` }} />
            <i className="b-bad" style={{ width: `${share(stats.rate)}%` }} />
          </div>
          <p className="x-meta" style={{ marginTop: 6 }}>
            {stats.done} case{stats.done > 1 ? "s" : ""} faite{stats.done > 1 ? "s" : ""} sur {stats.cases}
            {stats.mastery !== null ? ` · maîtrise ${Math.round(stats.mastery * 100)} %` : ""}
            {stats.due ? (
              <>
                {" · "}
                <span className="x-todo">{stats.due} à revoir</span>
              </>
            ) : null}
          </p>
        </div>
        <div className="x-keys" aria-hidden>
          <span>
            <i className="x-q seul" />
            Seul
          </span>
          <span>
            <i className="x-q indices" />
            Indices
          </span>
          <span>
            <i className="x-q rate" />
            Raté
          </span>
          <span>
            <i className="x-q due" />À revoir
          </span>
          <span>
            <i className="x-q" />
            Pas fait
          </span>
        </div>
      </div>

      <div className="x-tabs" role="group" aria-label="Filtrer">
        {(
          [
            ["tout", "Tout", stats.cases],
            ["annale", "Annales", stats.bySource.annale.cases],
            ["beos", "BEOS", stats.bySource.beos.cases],
            ["manuel", "Manuels", stats.bySource.manuel.cases],
            ["revoir", "À revoir", stats.due],
          ] as const
        ).map(([key, label, count]) => (
          <button key={key} type="button" className="x-tab" aria-pressed={filter === key} onClick={() => setFilter(key)}>
            {label}
            <em className="num">{count}</em>
          </button>
        ))}
        {booleanoperaUrl(chapter.id) && (
          <a className="x-tab" href={booleanoperaUrl(chapter.id)!} target="_blank" rel="noopener noreferrer">
            Cours Booleanopera ↗
          </a>
        )}
        {wikiSlugsFor(chapter.id).length > 0 && (
          <button type="button" className="x-tab" aria-pressed={filter === "classiques"} onClick={() => setFilter("classiques")}>
            Concours
          </button>
        )}
      </div>

      {!ready ? (
        <div className="x-emptyc">Chargement…</div>
      ) : filter === "classiques" ? (
        <ExosClassiques
          chapter={chapter}
          entries={entries}
          states={states}
          today={today}
          onPick={(entry, question) => setPicked({ entry, question })}
          onAddLink={(url) => addLinks(chapter, [url])}
          onAddSubject={(exo) => addEntries(chapter, [exo])}
        />
      ) : entries.length === 0 ? (
        <div className="x-card">
          <div className="x-emptyc">
            <div>
              <p style={{ margin: 0, fontWeight: 700, color: "var(--x-ink)" }}>Catalogue vide pour ce chapitre</p>
              <p style={{ margin: "6px 0 14px" }}>Claude y range les sujets d&apos;annales, les exos BEOS et ceux de tes manuels. Tu peux aussi coller un lien.</p>
              <button type="button" className="x-btn" onClick={() => setAdding(true)}>
                Ajouter un exo ou un lien
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className={`x-srcs ${sources.length >= 3 ? "three" : sources.length === 2 ? "two" : ""}`}>
          {sources.map((source) => {
            const list = entries.filter((entry) => entry.source === source && visible(entry));
            if (filter !== "tout" && filter !== "revoir" && filter !== source) return null;
            return (
              <section key={source} className="x-card x-src" aria-label={SOURCE_TITLE[source]}>
                <h4>{SOURCE_TITLE[source]}</h4>
                <p className="x-meta">{SOURCE_HINT[source]}</p>
                {list.length === 0 && <p className="x-meta">{filter === "revoir" ? "Rien à revoir ici." : "Rien de rangé pour l'instant."}</p>}
                {list.map((entry) => (
                  <div key={entry.id} id={exoAnchor(entry.id)} className={`x-ex ${target?.id === entry.id ? "focus" : ""}`}>
                    <div className="x-ex-n">
                      <span style={{ display: "inline-flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                        <ConcoursBadge entry={entry} />
                        {entry.titre}
                      </span>
                      {entry.url ? (
                        (() => {
                          const resume = source === "annale" ? resumeQuestion(chapter.id, entry, states, today) : null;
                          return (
                            <a href={questionUrl(entry, resume) ?? entry.url} target="_blank" rel="noopener noreferrer" title={resume ? `Reprendre à la question ${resume}` : undefined}>
                              {source === "annale" ? (resume ? `Q${resume} ↗` : "Corrigé ↗") : source === "manuel" && entry.page ? `${entry.page} ↗` : "Énoncé ↗"}
                            </a>
                          );
                        })()
                      ) : entry.page ? (
                        <span className="x-meta" style={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                          {entry.page}
                        </span>
                      ) : null}
                    </div>
                    <div className="x-meta">
                      {[entry.detail, entry.niveau ? "★".repeat(entry.niveau) : null].filter(Boolean).join(" · ") || EXO_SOURCE_LABEL[entry.source]}
                    </div>
                    <div className="x-qs">
                      {entryCases(chapter.id, entry).map(({ key, question }) => {
                        const state = states.get(key);
                        return (
                          <button
                            key={key}
                            type="button"
                            className={`x-q ${question ? "" : "wide"} ${caseClass(state, today)} ${target?.id === entry.id && target.question === question && question ? "focus" : ""}`}
                            title={caseTitle(state, today)}
                            aria-label={`${question ? `Question ${question}` : entry.titre} : ${caseTitle(state, today)}`}
                            onClick={() => setPicked({ entry, question })}
                          >
                            {question ?? caseTitle(state, today)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {source !== "autre" && (
                  <button type="button" className="x-addex" onClick={() => setAdding(true)}>
                    + Ajouter un exo ou coller un lien
                  </button>
                )}
              </section>
            );
          })}
        </div>
      )}

      {picked && (
        <GradeSheet
          open
          chapter={chapter}
          entry={picked.entry}
          question={picked.question}
          state={states.get(entryCases(chapter.id, picked.entry).find((c) => c.question === picked.question)?.key ?? "") ?? null}
          onGrade={(status, note) => {
            grade(chapter, picked.entry, picked.question, status, note);
            setPicked(null);
          }}
          onUndo={() => {
            undo(chapter.id, picked.entry.id, picked.question);
            setPicked(null);
          }}
          onClose={() => setPicked(null)}
        />
      )}
      <AddSheet open={adding} fixedChapter={chapter} onLinks={addLinks} onEntry={(target, exo) => addEntries(target, [exo])} onClose={() => setAdding(false)} />
      <SessionSheet
        open={session !== null}
        title={session?.title ?? ""}
        items={session?.items ?? []}
        states={states}
        onGrade={(item, status, note) => grade(item.chapter, item.entry, item.question, status, note)}
        onClose={() => setSession(null)}
      />
    </>
  );

  const actions = (
    <div className="x-row">
      <a className="x-btn soft sm" href={wikiPieges(chapter)} target="_blank" rel="noopener noreferrer">
        Pièges classiques ↗
      </a>
      <button type="button" className="x-btn sm" disabled={!dueHere.length && !weakHere.length} onClick={() => setSession({ title: chapter.title, items: dueHere.length ? dueHere : weakHere })}>
        {dueHere.length ? `Réviser (${dueHere.length})` : weakHere.length ? `Refaire les ${weakHere.length}` : "Réviser ce chapitre"}
      </button>
    </div>
  );

  if (!mounted) return <div className="exos exos-page"><div className="x-emptyc">Chargement…</div></div>;
  if (embedded) {
    return (
      <div className="exos exos-page">
        <div className="x-top" style={{ marginBottom: 10 }}>
          <Link href="/exos" className="x-crumb">
            Tous mes exos ›
          </Link>
          {actions}
        </div>
        {body}
      </div>
    );
  }
  return (
    <div className="exos exos-page">
      <div className="x-top">
        <div>
          <Link href="/exos" className="x-crumb">
            Exos › {chapter.subject} {chapter.year === 2 ? "spé" : "sup"}
          </Link>
          <h1 className="x-h1">{chapter.title}</h1>
        </div>
        {actions}
      </div>
      {body}
    </div>
  );
}

/** Les pièges classiques du chapitre sur Wikiprepa, ou la liste des chapitres si aucun ne correspond. */
export function wikiPieges(chapter: ProgrammeChapter): string {
  const slug = wikiSlug(chapter);
  return slug ? `${BASE}${slug}#pieges` : "https://wikiprepa.fr/concours/chapitres";
}

/** Le chapitre Wikiprepa le plus proche (pour « Pièges classiques ») ; à défaut, la liste des chapitres. */
export function wikiSlug(chapter: ProgrammeChapter): string {
  const map: Record<string, string> = {
    "m2-evn": "topologie-evn",
    "m2-reduction": "reduction-des-endomorphismes",
    "m2-algebre-lineaire": "algebre-lineaire",
    "m2-series-compl": "series-numeriques-familles-sommables",
    "m2-suites-fonctions": "suites-et-series-de-fonctions",
    "m2-series-entieres": "series-entieres",
    "m2-integration": "integrales-generalisees",
    "m2-integrales-parametre": "integrales-a-parametres",
    "m2-equadiff": "equations-differentielles",
    "m2-calcul-diff": "calcul-differentiel",
    "m2-euclidiens": "espaces-euclidiens",
    "m2-probas": "probabilites-discretes",
    "m2-groupes-anneaux": "algebre-generale",
    "p2-electrostatique": "electrostatique",
    "p2-magnetostatique": "magnetostatique",
    "p2-maxwell": "equations-de-maxwell",
    "p2-ondes-em": "ondes-electromagnetiques-milieux",
    "p2-diffusion": "diffusion-et-transferts-thermiques",
    "p2-thermo-ouverts": "thermodynamique",
    "p2-thermo-stat": "thermodynamique",
    "p2-mecanique": "mecanique",
    "p2-quantique": "physique-quantique",
    "p2-optique-ondulatoire": "optique-ondulatoire",
    "p2-electronique": "electrocinetique-et-electronique",
    "p2-ondes-mecaniques": "ondes-et-signaux",
  };
  return map[chapter.id] ?? "";
}
