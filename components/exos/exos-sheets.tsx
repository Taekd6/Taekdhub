"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ConcoursBadge } from "@/components/exos/concours-badge";
import { exoHref } from "@/lib/exo-target";
import { PROGRAMME, type ProgrammeChapter } from "@/lib/programme-data";
import { EXO_SOURCE_LABEL, EXO_STATUS_LABEL, intervalFor, questionUrl, type CaseState, type DueCase, type ExoEntry, type ExoSource, type ExoStatus, type NewExo } from "@/lib/exos";

const fr = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;

/** Une feuille modale dans le style de l'écran Exos (portail sous `.exos`, Échap ferme, focus gardé dedans). */
export function XSheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const timer = window.setTimeout(() => ref.current?.querySelector<HTMLElement>("[data-autofocus], button, input, textarea, select")?.focus(), 30);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(timer);
      previous?.focus?.();
    };
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="exos x-scrim" onClick={onClose}>
      <div ref={ref} className="x-sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <button type="button" className="x-close" onClick={onClose} aria-label="Fermer">
          ✕
        </button>
        {children}
      </div>
    </div>,
    document.body
  );
}

function OpenLinks({ entry, question = null }: { entry: ExoEntry; question?: string | null }) {
  if (!entry.url && !entry.urlCorrige && !entry.page) return null;
  const href = questionUrl(entry, question);
  const direct = href !== null && href !== entry.url;
  return (
    <div className="x-row" style={{ marginTop: 12 }}>
      {href && (
        <a className="x-lnk" href={href} target="_blank" rel="noopener noreferrer">
          {direct ? `Ouvrir Q${question} ↗` : entry.source === "annale" ? "Ouvrir le sujet et le corrigé ↗" : entry.source === "manuel" ? "Ouvrir le livre ↗" : "Ouvrir l'énoncé ↗"}
        </a>
      )}
      {entry.urlCorrige && (
        <a className="x-lnk plain" href={entry.urlCorrige} target="_blank" rel="noopener noreferrer">
          Corrigé ↗
        </a>
      )}
      {entry.page && <span className="x-lnk plain">{entry.page}</span>}
    </div>
  );
}

function GradeButtons({ state, onGrade }: { state: CaseState | null; onGrade: (status: ExoStatus) => void }) {
  const nextSeul = intervalFor("seul", (state?.status === "seul" ? state.streak : 0) + 1);
  return (
    <div className="x-grades">
      <button type="button" className="g-seul" onClick={() => onGrade("seul")}>
        Seul<small>revient dans {nextSeul} j</small>
      </button>
      <button type="button" className="g-indices" onClick={() => onGrade("indices")}>
        Indices<small>revient dans 7 j</small>
      </button>
      <button type="button" className="g-rate" onClick={() => onGrade("rate")}>
        Raté<small>revient dans 3 j</small>
      </button>
    </div>
  );
}

/** Le geste sur UNE case : seul, indices, raté — ou annuler le dernier. */
export function GradeSheet({
  open,
  chapter,
  entry,
  question,
  state,
  onGrade,
  onUndo,
  onClose,
}: {
  open: boolean;
  chapter: ProgrammeChapter;
  entry: ExoEntry;
  question: string | null;
  state: CaseState | null;
  onGrade: (status: ExoStatus, note: string) => void;
  onUndo: () => void;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  useEffect(() => {
    if (open) setNote("");
  }, [open, entry.id, question]);
  return (
    <XSheet open={open} title="Comment ça s'est passé ?" onClose={onClose}>
      <p className="x-kicker">
        {chapter.title} · {EXO_SOURCE_LABEL[entry.source]}
      </p>
      <h2 style={{ marginTop: 4 }}>
        {entry.titre}
        {question ? ` · Q${question}` : ""}
      </h2>
      {state && (
        <p className="x-meta" style={{ marginTop: 6 }}>
          Dernier essai le {fr(state.lastDay)} : {EXO_STATUS_LABEL[state.status]} · {state.attempts} essai{state.attempts > 1 ? "s" : ""} · {state.next <= new Date().toLocaleDateString("en-CA") ? "à revoir" : `revient le ${fr(state.next)}`}
        </p>
      )}
      {state?.note && (
        <div className="x-note">
          <b>Ton piège noté</b>
          {state.note}
        </div>
      )}
      <OpenLinks entry={entry} question={question} />
      <GradeButtons state={state} onGrade={(status) => onGrade(status, note)} />
      <label className="x-label" htmlFor="x-grade-note">
        L&apos;erreur ou l&apos;idée à retenir (facultatif)
      </label>
      <input id="x-grade-note" className="x-field" value={note} onChange={(event) => setNote(event.target.value)} maxLength={200} placeholder="ex. supposé la dimension finie sans le dire" />
      <p className="x-meta" style={{ marginTop: 10 }}>
        Raté : la case revient dans ta séance, le piège va dans le carnet d&apos;erreurs du chapitre et une tâche « Refaire » part dans Rappels.
      </p>
      {state && (
        <button type="button" className="x-btn tint sm" style={{ marginTop: 12 }} onClick={onUndo}>
          Annuler le dernier essai
        </button>
      )}
    </XSheet>
  );
}

/** Ajouter au catalogue : coller des liens, ou saisir un exo (manuel, BEOS…). */
export function AddSheet({
  open,
  fixedChapter,
  defaultChapterId,
  onLinks,
  onEntry,
  onClose,
}: {
  open: boolean;
  fixedChapter?: ProgrammeChapter;
  defaultChapterId?: string;
  onLinks: (chapter: ProgrammeChapter, urls: string[]) => number;
  onEntry: (chapter: ProgrammeChapter, exo: NewExo) => { ok: true; added: number } | { ok: false; error: string };
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"liens" | "saisie">("liens");
  const [chapterId, setChapterId] = useState(fixedChapter?.id ?? defaultChapterId ?? "m2-evn");
  const [links, setLinks] = useState("");
  const [source, setSource] = useState<ExoSource>("manuel");
  const [titre, setTitre] = useState("");
  const [detail, setDetail] = useState("");
  const [page, setPage] = useState("");
  const [questions, setQuestions] = useState("");
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setMessage(null);
      if (fixedChapter) setChapterId(fixedChapter.id);
      else if (defaultChapterId) setChapterId(defaultChapterId);
    }
  }, [open, fixedChapter, defaultChapterId]);
  const chapter = useMemo(() => PROGRAMME.find((item) => item.id === chapterId) ?? null, [chapterId]);
  const urls = useMemo(() => (links.match(/https?:\/\/[^\s<>"']+/g) ?? []).map((u) => u.replace(/[),.;]+$/, "")), [links]);
  const groups = useMemo(() => {
    const spe = PROGRAMME.filter((item) => item.year === 2);
    const sup = PROGRAMME.filter((item) => item.year === 1);
    return [
      ...["Mathématiques", "Physique", "Chimie", "Informatique TC", "Informatique Spé"].map((subject) => ({ label: `${subject} · spé`, items: spe.filter((item) => item.subject === subject) })),
      ...["Mathématiques", "Physique", "Chimie"].map((subject) => ({ label: `${subject} · sup`, items: sup.filter((item) => item.subject === subject) })),
    ].filter((group) => group.items.length);
  }, []);

  const parseQuestions = (raw: string): string[] | number | undefined => {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    if (/^\d+$/.test(trimmed)) return Number(trimmed);
    return trimmed
      .split(/[,;\s]+/)
      .map((q) => q.trim())
      .filter(Boolean);
  };

  const submit = () => {
    if (!chapter) return;
    if (mode === "liens") {
      const count = onLinks(chapter, urls);
      if (count) {
        setLinks("");
        setMessage(`${count} lien${count > 1 ? "s" : ""} rangé${count > 1 ? "s" : ""} dans « ${chapter.title} ».`);
      } else setMessage("Aucun lien reconnu : colle l'adresse complète (https://…).");
      return;
    }
    const result = onEntry(chapter, { source, titre, detail: detail || undefined, page: page || undefined, url: url || undefined, questions: parseQuestions(questions) });
    if (result.ok) {
      setTitre("");
      setDetail("");
      setPage("");
      setQuestions("");
      setUrl("");
      setMessage(`Rangé dans « ${chapter.title} ».`);
    } else setMessage(result.error);
  };

  return (
    <XSheet open={open} title="Ajouter des exos" onClose={onClose}>
      <h2>Ajouter des exos</h2>
      <div className="x-seg" style={{ marginTop: 14 }}>
        <button type="button" aria-pressed={mode === "liens"} onClick={() => setMode("liens")}>
          Coller des liens
        </button>
        <button type="button" aria-pressed={mode === "saisie"} onClick={() => setMode("saisie")}>
          Saisir un exo
        </button>
      </div>
      {!fixedChapter && (
        <>
          <label className="x-label" htmlFor="x-add-chapter">
            Chapitre
          </label>
          <select id="x-add-chapter" className="x-field" value={chapterId} onChange={(event) => setChapterId(event.target.value)}>
            {groups.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </>
      )}
      {mode === "liens" ? (
        <>
          <label className="x-label" htmlFor="x-add-links">
            Liens, un par ligne (Wikiprepa, BEOS…)
          </label>
          <textarea id="x-add-links" data-autofocus className="x-field" value={links} onChange={(event) => setLinks(event.target.value)} placeholder="https://wikiprepa.fr/concours/ecrit/…/corrige#q15" spellCheck={false} />
          <p className="x-meta" style={{ marginTop: 6 }}>
            {urls.length ? `${urls.length} lien${urls.length > 1 ? "s" : ""} détecté${urls.length > 1 ? "s" : ""}. Une question Wikiprepa s'ajoute à son sujet s'il est déjà rangé.` : "Le concours, l'épreuve, l'année et la question sont lus dans l'adresse."}
          </p>
        </>
      ) : (
        <>
          <label className="x-label" htmlFor="x-add-source">
            Source
          </label>
          <select id="x-add-source" className="x-field" value={source} onChange={(event) => setSource(event.target.value as ExoSource)}>
            <option value="manuel">Manuel</option>
            <option value="beos">BEOS (oral)</option>
            <option value="annale">Annale d&apos;écrit</option>
            <option value="autre">Autre</option>
          </select>
          <label className="x-label" htmlFor="x-add-titre">
            Titre
          </label>
          <input id="x-add-titre" data-autofocus className="x-field" value={titre} onChange={(event) => setTitre(event.target.value)} maxLength={160} placeholder={source === "manuel" ? "Nom du manuel · ch. 3 · exo 3.7" : source === "beos" ? "BEOS n° 6123 · Mines-Ponts 2024" : "CCINP Maths 1 · MP 2025 · Ex. 3"} />
          <div className="x-row" style={{ alignItems: "flex-start" }}>
            <div style={{ flex: "1 1 140px" }}>
              <label className="x-label" htmlFor="x-add-q">
                Questions
              </label>
              <input id="x-add-q" className="x-field" value={questions} onChange={(event) => setQuestions(event.target.value)} placeholder="5, ou a b c" />
            </div>
            <div style={{ flex: "1 1 120px" }}>
              <label className="x-label" htmlFor="x-add-page">
                Page
              </label>
              <input id="x-add-page" className="x-field" value={page} onChange={(event) => setPage(event.target.value)} maxLength={30} placeholder="p. 142" />
            </div>
          </div>
          <label className="x-label" htmlFor="x-add-detail">
            Ce qu&apos;il travaille ou où est le corrigé
          </label>
          <input id="x-add-detail" className="x-field" value={detail} onChange={(event) => setDetail(event.target.value)} maxLength={200} placeholder="Corrigé détaillé p. 158" />
          <label className="x-label" htmlFor="x-add-url">
            Lien (facultatif)
          </label>
          <input id="x-add-url" className="x-field" value={url} onChange={(event) => setUrl(event.target.value)} inputMode="url" placeholder="https://…" />
        </>
      )}
      {message && (
        <p className="x-meta" role="status" style={{ marginTop: 10, color: "var(--x-ink)" }}>
          {message}
        </p>
      )}
      <button type="button" className="x-btn" style={{ width: "100%", justifyContent: "center", marginTop: 16 }} onClick={submit} disabled={mode === "liens" ? urls.length === 0 : !titre.trim()}>
        Ranger dans le catalogue
      </button>
    </XSheet>
  );
}

/** La séance : une case à la fois, jusqu'au bilan. La liste est figée au lancement. */
export function SessionSheet({
  open,
  title,
  items,
  states,
  onGrade,
  onClose,
}: {
  open: boolean;
  title: string;
  items: DueCase[];
  states: Map<string, CaseState>;
  onGrade: (item: DueCase, status: ExoStatus, note: string) => void;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [tally, setTally] = useState({ seul: 0, indices: 0, rate: 0 });
  const [note, setNote] = useState("");
  useEffect(() => {
    if (open) {
      setIndex(0);
      setTally({ seul: 0, indices: 0, rate: 0 });
      setNote("");
    }
  }, [open]);
  const item = items[index];
  const state = item ? states.get(item.state.key) ?? item.state : null;
  return (
    <XSheet open={open} title={title} onClose={onClose}>
      {!item ? (
        <div style={{ textAlign: "center" }}>
          <p className="x-kicker">{title}</p>
          <div className="x-big num" style={{ color: "var(--x-accent)", marginTop: 10 }}>
            {tally.seul}/{items.length}
          </div>
          <h2 style={{ marginTop: 6 }}>réussies seul</h2>
          <p className="x-sub">
            {tally.indices} avec indices · {tally.rate} ratée{tally.rate > 1 ? "s" : ""}.{" "}
            {tally.rate ? "Les ratées reviennent dans 3 jours : relis le cours du chapitre d'ici là." : "Belle séance."}
          </p>
          <button type="button" className="x-btn" style={{ width: "100%", justifyContent: "center", marginTop: 18 }} onClick={onClose}>
            Terminer
          </button>
        </div>
      ) : (
        <div style={{ textAlign: "center" }}>
          <div className="x-prog" aria-label={`Case ${index + 1} sur ${items.length}`}>
            {items.map((step, k) => (
              <i key={step.state.key + k} className={k < index ? "done" : k === index ? "cur" : ""} />
            ))}
          </div>
          <p className="x-kicker" style={{ color: "var(--x-accent)", display: "inline-flex", alignItems: "center", gap: 8 }}>
            <ConcoursBadge entry={item.entry} />
            {item.chapter.title}
          </p>
          <h2 style={{ marginTop: 6 }}>
            {item.entry.titre}
            {item.question ? ` · Q${item.question}` : ""}
          </h2>
          {state && (
            <p className="x-meta" style={{ marginTop: 6 }}>
              Dernier essai le {fr(state.lastDay)} : {EXO_STATUS_LABEL[state.status]}
              {state.history.length > 1 ? ` · historique : ${state.history.map((step) => EXO_STATUS_LABEL[step.status]).join(", ")}` : ""}
            </p>
          )}
          {state?.note && (
            <div className="x-note" style={{ textAlign: "left" }}>
              <b>Ton piège noté</b>
              {state.note}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <OpenLinks entry={item.entry} question={item.question} />
          </div>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
            <Link className="x-lnk plain" href={exoHref(item.chapter.id, item.entry.id, item.question)} onClick={onClose}>
              Voir dans le chapitre →
            </Link>
          </div>
          <p className="x-sub">Cherche-la sans regarder le corrigé, puis dis comment ça s&apos;est passé.</p>
          <GradeButtons
            state={state}
            onGrade={(status) => {
              onGrade(item, status, note);
              setTally((current) => ({ ...current, [status]: current[status] + 1 }));
              setNote("");
              setIndex((current) => current + 1);
            }}
          />
          <input className="x-field" style={{ marginTop: 10 }} value={note} onChange={(event) => setNote(event.target.value)} maxLength={200} placeholder="Le piège à retenir (facultatif)" aria-label="Le piège à retenir" />
        </div>
      )}
    </XSheet>
  );
}
