"use client";

import "./exos.css";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useExos } from "@/hooks/use-exos";
import { activityDays, chapterStats, dueCases, forecast, progression, streakDays, weakCases, weakChapters, weekStart, addDays, type DueCase } from "@/lib/exos";
import { ChapterRadar, ForecastChart, MasteryRing, ProgressChart, StatusDonut, STATUS_COLOR } from "@/components/exos/exos-charts";
import { AddSheet, SessionSheet } from "@/components/exos/exos-sheets";
import { BooleanoperaLink } from "@/components/exos/booleanopera-link";
import { wikiPieges } from "@/components/exos/exos-chapter";
import { PROGRAMME, PROGRAMME_SUBJECTS } from "@/lib/programme-data";

const pct = (value: number | null) => (value === null ? "—" : `${Math.round(value * 100)} %`);
const SHORT: Record<string, string> = {
  "m2-evn": "Topologie",
  "m2-reduction": "Réduction",
  "m2-algebre-lineaire": "Alg. linéaire",
  "m2-series-compl": "Séries num.",
  "m2-suites-fonctions": "Suites de fonctions",
  "m2-series-entieres": "Séries entières",
  "m2-integration": "Intégration",
  "m2-integrales-parametre": "Int. à param.",
  "m2-equadiff": "Équa diff",
  "m2-calcul-diff": "Calcul diff.",
  "m2-euclidiens": "Euclidiens",
  "m2-probas": "Probas",
  "m2-groupes-anneaux": "Groupes, anneaux",
};
const MATIERES = ["Tout", "Mathématiques", "Physique", "Chimie", "Info"] as const;
const MATIERE_LABEL: Record<(typeof MATIERES)[number], string> = { Tout: "Tout", Mathématiques: "Maths", Physique: "Physique", Chimie: "Chimie", Info: "Info" };
const SOURCES = [
  ["annale", "Annales"],
  ["beos", "BEOS"],
  ["manuel", "Manuels"],
  ["autre", "TD"],
] as const;
const short = (id: string, title: string) => SHORT[id] ?? (title.length > 18 ? `${title.slice(0, 17)}…` : title);

/**
 * /exos — LE SUIVI DES EXOS : la séance du jour, la maîtrise, les statuts, la
 * progression, le radar des chapitres, les points faibles et la prévision des
 * révisions, puis les chapitres qui ont un catalogue. Calculs : lib/exos.ts.
 */
export function ExosOverview() {
  const { ready, today, catalogue, states, grade, addEntries, addLinks } = useExos();
  const [mode, setMode] = useState<"mastery" | "volume">("mastery");
  const [matiere, setMatiere] = useState<"Tout" | "Mathématiques" | "Physique" | "Chimie" | "Info">("Tout");
  const [adding, setAdding] = useState(false);
  const [session, setSession] = useState<{ title: string; items: DueCase[] } | null>(null);
  /* Rien de daté au rendu serveur : la page est générée au build (UTC, autre jour possible) et l'iPad est à l'heure de Paris. */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const all = useMemo(() => [...states.values()], [states]);
  const stats = useMemo(() => catalogue.map((item) => chapterStats(item, states, today)), [catalogue, states, today]);
  const due = useMemo(() => dueCases(catalogue, states, today), [catalogue, states, today]);
  const points = useMemo(() => progression(all, today), [all, today]);
  const days = useMemo(() => forecast(all, today), [all, today]);
  const activity = useMemo(() => activityDays(all), [all]);
  const weak = useMemo(() => weakChapters(catalogue, states, today), [catalogue, states, today]);

  const done = all.length;
  const counts = useMemo(() => {
    const out = { seul: 0, indices: 0, rate: 0 };
    for (const item of stats) if (matiere === "Tout" || item.chapter.subject === matiere || (matiere === "Info" && item.chapter.subject.startsWith("Informatique"))) for (const key of ["seul", "indices", "rate"] as const) out[key] += item[key];
    return out;
  }, [stats, matiere]);
  const mastery = done ? all.reduce((sum, state) => sum + (state.status === "seul" ? 1 : state.status === "indices" ? 0.5 : 0), 0) / done : 0;
  const week = useMemo(() => {
    const start = weekStart(today);
    let n = 0;
    for (let i = 0; i < 7; i += 1) n += activity.get(addDays(start, i)) ?? 0;
    return n;
  }, [activity, today]);
  const radar = useMemo(
    () =>
      stats
        .filter((item) => item.mastery !== null)
        .sort((a, b) => b.done - a.done)
        .slice(0, 8)
        .map((item) => ({ label: short(item.chapter.id, item.chapter.title), value: item.mastery ?? 0 })),
    [stats]
  );
  const weekDue = days.slice(0, 7).reduce((sum, d) => sum + d.count, 0);
  const peak = days.slice(1).reduce((best, d) => (d.count > best.count ? d : best), { day: today, count: 0 });
  const firstMastery = points.find((p) => p.mastery !== null);
  const lastMastery = [...points].reverse().find((p) => p.mastery !== null);
  const bySourceDue = useMemo(() => {
    const out = { annale: 0, beos: 0, manuel: 0, autre: 0 };
    for (const item of due) out[item.entry.source] += 1;
    return out;
  }, [due]);
  const folders = useMemo(() => {
    const byId = new Map(stats.map((item) => [item.chapter.id, item]));
    const order = (a: { year: number }, b: { year: number }) => b.year - a.year;
    return PROGRAMME_SUBJECTS.filter((subject) => matiere === "Tout" || subject === matiere || (matiere === "Info" && subject.startsWith("Informatique"))).map((subject) => {
      const chapters = PROGRAMME.filter((chapter) => chapter.subject === subject)
        .map((chapter, index) => ({ chapter, index, year: chapter.year }))
        .sort((a, b) => order(a, b) || a.index - b.index)
        .map((x) => x.chapter);
      const withExos = chapters.flatMap((chapter) => (byId.has(chapter.id) ? [byId.get(chapter.id)!] : []));
      const others = chapters.filter((chapter) => !byId.has(chapter.id));
      const sum = (key: "cases" | "done" | "due") => withExos.reduce((n, item) => n + item[key], 0);
      const coverage = SOURCES.map(([source, label]) => ({ source, label, cases: withExos.reduce((n, item) => n + item.bySource[source].cases, 0) }));
      return { subject, withExos, others, coverage, cases: sum("cases"), done: sum("done"), due: sum("due") };
    });
  }, [stats, matiere]);
  const dateLabel = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  if (!mounted) return <div className="exos exos-page"><h1 className="x-h1">Exos</h1><div className="x-emptyc">Chargement…</div></div>;

  return (
    <div className="exos exos-page">
      <div className="x-top">
        <div>
          <div className="x-date" suppressHydrationWarning>
            {dateLabel}
          </div>
          <h1 className="x-h1">Exos</h1>
        </div>
        <div className="x-row x-topbar">
          <div className="x-seg" role="group" aria-label="Matière">
            {MATIERES.map((value) => (
              <button key={value} type="button" aria-pressed={matiere === value} onClick={() => setMatiere(value)}>
                {MATIERE_LABEL[value]}
              </button>
            ))}
          </div>
          <button type="button" className="x-btn soft" onClick={() => setAdding(true)}>
            + Ajouter
          </button>
          <a className="x-btn soft" href="#catalogue">
            Catalogue
          </a>
        </div>
      </div>
      <BooleanoperaLink />

      <div className="x-grid">
        <section className="x-card c4 x-hero" aria-label="Séance du jour">
          <div>
            <p className="x-kicker">Séance du jour</p>
            <div className="x-big num">{due.length}</div>
            <p>
              {due.length
                ? `case${due.length > 1 ? "s" : ""} à revoir, une à la fois · ${Object.entries(bySourceDue)
                    .filter(([, n]) => n)
                    .map(([source, n]) => `${n} ${source === "annale" ? "annale" : source === "beos" ? "BEOS" : source === "manuel" ? "manuel" : "autre"}`)
                    .join(" · ")}`
                : done
                  ? "Rien à revoir. Attaque un point faible ou un sujet neuf."
                  : "Coche ta première case pour lancer le suivi."}
            </p>
          </div>
          <div className="x-row">
            <button type="button" className="x-btn" disabled={!due.length} onClick={() => setSession({ title: "Séance du jour", items: due })}>
              Lancer la séance
            </button>
            <a className="x-btn ghost sm" href="#points-faibles">
              Points faibles
            </a>
          </div>
        </section>

        <section className="x-card c4" aria-label="Maîtrise">
          <div className="x-head">
            <div>
              <p className="x-kicker">Niveau global</p>
              <h2 className="x-title">Maîtrise</h2>
            </div>
          </div>
          <div className="x-mast">
            <MasteryRing value={mastery} size={128} />
            <div className="x-stats">
              <div className="x-stat">
                <span>Cases faites</span>
                <b className="num">{done}</b>
              </div>
              <div className="x-stat">
                <span>Série</span>
                <b className="num">{streakDays(activity, today)} j</b>
              </div>
              <div className="x-stat">
                <span>Cette semaine</span>
                <b className="num">{week}</b>
              </div>
            </div>
          </div>
        </section>

        <section className="x-card c4 wide" aria-label="Statuts">
          <div className="x-head">
            <div>
              <p className="x-kicker">Répartition{matiere === "Tout" ? "" : ` · ${MATIERE_LABEL[matiere]}`}</p>
              <h2 className="x-title">Statuts</h2>
            </div>
          </div>
          <div className="x-mast">
            <StatusDonut {...counts} size={120} />
            <div className="x-legend">
              {(["seul", "indices", "rate"] as const).map((key) => {
                const total = counts.seul + counts.indices + counts.rate;
                return (
                  <div key={key} className="x-lg">
                    <i style={{ background: STATUS_COLOR[key] }} />
                    <span>{{ seul: "Seul", indices: "Avec indices", rate: "Raté" }[key]}</span>
                    <span>
                      <b className="num">{counts[key]}</b>
                      <em>{total ? `${Math.round((counts[key] / total) * 100)}%` : ""}</em>
                    </span>
                  </div>
                );
              })}
              <div className="x-lg">
                <i style={{ background: "#ff9500" }} />
                <span>À revoir</span>
                <b className="num">{due.length}</b>
              </div>
            </div>
          </div>
        </section>

        <section className="x-card" id="catalogue" aria-label="Exos par matière">
          <div className="x-head">
            <div>
              <p className="x-kicker">Annales, BEOS et manuels · spé puis sup</p>
              <h2 className="x-title">Par matière</h2>
            </div>
          </div>
          {!ready ? (
            <div className="x-emptyc">Chargement…</div>
          ) : (
            <div className="x-folders">
              {folders.map((folder) => (
                <div key={folder.subject} className="x-folder">
                  <div className="x-fhead">
                    <div>
                      <h3>{folder.subject}</h3>
                      <div className="x-meta">
                        {folder.withExos.length} chapitre{folder.withExos.length > 1 ? "s" : ""} avec exos · {folder.others.length} sans
                      </div>
                    </div>
                    <div className="x-fstats">
                      <div>
                        <b className="num">{folder.done}</b>
                        <span>/{folder.cases} cases</span>
                      </div>
                      {folder.due ? <span className="x-pill due">{folder.due} à revoir</span> : null}
                    </div>
                  </div>
                  <div className="x-cover" aria-label={`Sources rangées en ${folder.subject}`}>
                    {folder.coverage.map((c) => (
                      <span key={c.source} className={c.cases ? "x-cv on" : "x-cv off"}>
                        {c.label} <b className="num">{c.cases || "0"}</b>
                      </span>
                    ))}
                  </div>
                  {folder.withExos.length === 0 ? (
                    <p className="x-meta">Pas encore d&apos;exos rangés dans cette matière.</p>
                  ) : (
                    <div className="x-chaps">
                      {folder.withExos.map((item) => {
                        const share = (n: number) => (item.cases ? (n / item.cases) * 100 : 0);
                        return (
                          <Link key={item.chapter.id} href={`/exos/${item.chapter.id}`} className="x-chap">
                            <div className="x-chap-top">
                              <span className="x-yr">{item.chapter.year === 2 ? "Spé" : "Sup"}</span>
                              {item.due ? <span className="x-pill due">{item.due} à revoir</span> : null}
                            </div>
                            <h4>{item.chapter.title}</h4>
                            <div className="x-chap-num">
                              <b className="num">{item.done}</b>
                              <span>/{item.cases} cases</span>
                              {item.mastery !== null ? <em className="num">{pct(item.mastery)}</em> : null}
                            </div>
                            <div className="x-bar">
                              <i className="b-ok" style={{ width: `${share(item.seul)}%` }} />
                              <i className="b-mid" style={{ width: `${share(item.indices)}%` }} />
                              <i className="b-bad" style={{ width: `${share(item.rate)}%` }} />
                            </div>
                            <div className="x-schips">
                              {SOURCES.map(([source, label]) => {
                                const c = item.bySource[source];
                                return c.cases ? (
                                  <span key={source} className="x-sc on">
                                    {label} <b className="num">{c.done}/{c.cases}</b>
                                  </span>
                                ) : (
                                  <span key={source} className="x-sc off" title={`Aucun exo « ${label} » rangé dans ce chapitre`}>
                                    {label} —
                                  </span>
                                );
                              })}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                  {folder.others.length > 0 && (
                    <details className="x-others" open>
                      <summary>Autres chapitres : questions de concours dans l&apos;onglet « Concours » ({folder.others.length})</summary>
                      <div className="x-olist">
                        {folder.others.map((chapter) => (
                          <Link key={chapter.id} href={`/exos/${chapter.id}`}>
                            <em>{chapter.year === 2 ? "Spé" : "Sup"}</em> {chapter.title}
                          </Link>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>


        <section className="x-card c7" aria-label="Progression">
          <div className="x-head">
            <div>
              <p className="x-kicker">12 dernières semaines</p>
              <h2 className="x-title">Progression</h2>
            </div>
            <div className="x-seg">
              <button type="button" aria-pressed={mode === "mastery"} onClick={() => setMode("mastery")}>
                Maîtrise
              </button>
              <button type="button" aria-pressed={mode === "volume"} onClick={() => setMode("volume")}>
                Volume
              </button>
            </div>
          </div>
          <ProgressChart key={mode} points={points} mode={mode} />
          <p className="x-sub">
            {mode === "mastery" && firstMastery && lastMastery && firstMastery !== lastMastery ? (
              <>
                Maîtrise <b>{pct(lastMastery.mastery)}</b>, {Math.round(((lastMastery.mastery ?? 0) - (firstMastery.mastery ?? 0)) * 100) >= 0 ? "+" : ""}
                {Math.round(((lastMastery.mastery ?? 0) - (firstMastery.mastery ?? 0)) * 100)} points depuis le {firstMastery.start.slice(8, 10)}/{firstMastery.start.slice(5, 7)}. Barres claires : cases travaillées par semaine.
              </>
            ) : mode === "volume" ? (
              <>
                <b>{done}</b> cases faites au total, <b>{week}</b> travaillées cette semaine.
              </>
            ) : (
              "La courbe apparaît après deux semaines avec au moins trois cases faites."
            )}
          </p>
        </section>

        <section className="x-card c5" aria-label="Radar des chapitres">
          <div className="x-head">
            <div>
              <p className="x-kicker">Maîtrise par chapitre</p>
              <h2 className="x-title">Radar</h2>
            </div>
          </div>
          <ChapterRadar items={radar} />
        </section>

        <section className="x-card c7" id="points-faibles" aria-label="Points faibles">
          <div className="x-head">
            <div>
              <p className="x-kicker">Ce qu&apos;on travaille en priorité</p>
              <h2 className="x-title">Points faibles</h2>
            </div>
          </div>
          {weak.length === 0 ? (
            <div className="x-emptyc">{done < 3 ? "Les points faibles apparaissent après quelques cases cochées dans un chapitre." : "Aucun chapitre sous 85 % de maîtrise. Continue comme ça."}</div>
          ) : (
            weak.map((item) => {
              const m = item.stats.mastery ?? 0;
              const tone = m >= 0.7 ? ["var(--x-ok-s)", "var(--x-ok-t)"] : m >= 0.45 ? ["var(--x-mid-s)", "var(--x-mid-t)"] : ["var(--x-bad-s)", "var(--x-bad-t)"];
              const redo = weakCases(catalogue, states, item.stats.chapter.id);
              return (
                <div key={item.stats.chapter.id} className="x-weak">
                  <div className="x-score num" style={{ background: tone[0], color: tone[1] }}>
                    {pct(m).replace(" ", "")}
                  </div>
                  <h3>{item.stats.chapter.title}</h3>
                  <p>
                    {item.stats.done} cases · {item.stats.seul} seul · {item.stats.indices} avec indices · {item.stats.rate} ratées
                  </p>
                  <div style={{ gridColumn: 2 }}>
                    <p className="x-tip">
                      {item.tip}
                      {item.lastNote ? ` Dernier piège : « ${item.lastNote} ».` : ""}
                    </p>
                    <div className="x-row" style={{ marginTop: 8, gap: 6 }}>
                      {redo.length > 0 && (
                        <button type="button" className="x-lnk solid" onClick={() => setSession({ title: item.stats.chapter.title, items: redo })}>
                          Refaire les {redo.length}
                        </button>
                      )}
                      <Link className="x-lnk" href={`/exos/${item.stats.chapter.id}`}>
                        Voir le chapitre
                      </Link>
                      <a className="x-lnk plain" href={wikiPieges(item.stats.chapter)} target="_blank" rel="noopener noreferrer">
                        Pièges classiques ↗
                      </a>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </section>

        <section className="x-card c5" aria-label="Révisions prévues">
          <div className="x-head">
            <div>
              <p className="x-kicker">14 prochains jours</p>
              <h2 className="x-title">Révisions prévues</h2>
            </div>
          </div>
          <ForecastChart days={days} />
          <p className="x-sub">
            {weekDue ? (
              <>
                <b>{weekDue}</b> retours sur 7 jours{peak.count > 2 ? `, pic le ${peak.day.slice(8, 10)}/${peak.day.slice(5, 7)} (${peak.count})` : ""}. Les retards comptent aujourd&apos;hui.
              </>
            ) : (
              "Aucun retour prévu cette semaine."
            )}
          </p>
        </section>

      </div>

      <AddSheet open={adding} defaultChapterId={catalogue[0]?.chapter.id} onLinks={addLinks} onEntry={(chapter, exo) => addEntries(chapter, [exo])} onClose={() => setAdding(false)} />
      <SessionSheet
        open={session !== null}
        title={session?.title ?? ""}
        items={session?.items ?? []}
        states={states}
        onGrade={(item, status, note) => grade(item.chapter, item.entry, item.question, status, note)}
        onClose={() => setSession(null)}
      />
    </div>
  );
}
