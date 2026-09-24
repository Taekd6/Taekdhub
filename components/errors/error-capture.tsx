"use client";

import { Check, CornerDownLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import {
  createErrorEntry,
  ERROR_MEMORY_KEY,
  ERROR_SOURCE_META,
  ERROR_TEXT_MAX,
  ERROR_TYPE_META,
  parseErrorMemory,
  parseErrorPrefill,
} from "@/lib/error-log";
import { dayKey, subjectMeta, subjects } from "@/lib/study";
import { ERROR_SOURCES, ERROR_TYPES, readFlag, writeFlag, type ErrorEntry, type ErrorSource, type ErrorType } from "@/lib/storage";
import type { Subject } from "@/lib/supabase/types";

/**
 * NOTER UNE ERREUR — dix secondes, sans quitter la copie des yeux.
 *
 * Même geste que le carnet « À revoir » (components/review/review-capture.tsx) :
 * un champ, Entrée, c'est noté, le champ se vide et GARDE le focus. La
 * matière et la source sont retenues d'une fois sur l'autre — on note les
 * six erreurs d'une même colle d'affilée — et reviennent au prochain passage.
 *
 * LE TYPE, LUI, N'EST JAMAIS RETENU. C'est la seule décision que le carnet
 * demande, et c'est elle qui fait tout son intérêt : se demander « calcul ou
 * méthode ? » est déjà une partie du travail sur l'erreur. Le garder d'une
 * ligne à l'autre transformerait ce choix en réflexe, et fausserait les
 * comptes à la première inattention. Chaque type porte son explication d'une
 * ligne, sans quoi « méthode » et « cours » se confondent.
 *
 * « La bonne idée » est visible d'emblée, pas cachée derrière « Plus » : noter
 * la correction, pas seulement l'erreur, est ce qui fait qu'on en apprend
 * quelque chose (voir « Pourquoi ça marche »). La date, elle, est repliée :
 * utile, rarement indispensable. (Le chapitre et l'exercice de l'ancienne
 * banque d'exercices, qui se choisissaient ici aussi, ont disparu avec elle :
 * « l'exo 12 du TD4 » s'écrit dans la description.)
 *
 * Les données viennent du PARENT (components/errors/error-log.tsx), jamais
 * d'un second `usePrepahubData()` — `saveErrors` REMPLACE, une seconde copie
 * périmée effacerait ce que la première vient d'ajouter.
 */
export function ErrorCapture({
  errors,
  saveErrors,
  ready,
  onSaved,
}: {
  /** Le carnet ENTIER — c'est lui qu'on réécrit. */
  errors: ErrorEntry[];
  saveErrors: (errors: ErrorEntry[]) => void;
  ready: boolean;
  /** Appelé avec l'erreur tout juste notée — le parent peut proposer une suite (« ajouter au carnet À revoir »). */
  onSaved?: (entry: ErrorEntry) => void;
}) {
  const [subject, setSubject] = useState<Subject>("Mathématiques");
  const [source, setSource] = useState<ErrorSource>("exercice");
  const [type, setType] = useState<ErrorType | null>(null);
  const [description, setDescription] = useState("");
  const [fix, setFix] = useState("");
  const [date, setDate] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [missingType, setMissingType] = useState(false);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);

  // Mémoire puis URL, dans cet ordre : un lien « Noter les erreurs de ce DS »
  // doit l'emporter sur la dernière saisie. Lu dans un effet — la page est
  // prérendue et le serveur n'a ni localStorage ni `location`.
  useEffect(() => {
    const memory = parseErrorMemory(readFlag(ERROR_MEMORY_KEY));
    const prefill = parseErrorPrefill(window.location.search);
    const nextSubject = prefill.subject ?? memory.subject;
    const nextSource = prefill.source ?? memory.source;
    if (nextSubject) setSubject(nextSubject);
    if (nextSource) setSource(nextSource);
    if (prefill.date) {
      setDate(prefill.date);
      setMoreOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!justAdded) return;
    const timeout = window.setTimeout(() => setJustAdded(null), 1800);
    return () => window.clearTimeout(timeout);
  }, [justAdded]);

  const trimmed = description.trim();
  const fixTrimmed = fix.trim();
  const canAdd = ready && trimmed.length > 0 && trimmed.length <= ERROR_TEXT_MAX && fixTrimmed.length <= ERROR_TEXT_MAX;

  function add() {
    if (!canAdd) return;
    if (!type) {
      setMissingType(true);
      return;
    }
    const entry = createErrorEntry({
      subject,
      source,
      type,
      description,
      fix,
      date: date || dayKey(new Date()),
    });
    if (!entry) return;
    saveErrors([entry, ...errors]);
    writeFlag(ERROR_MEMORY_KEY, JSON.stringify({ subject, source }));
    setDescription("");
    setFix("");
    setType(null);
    setMissingType(false);
    setJustAdded(entry.id);
    onSaved?.(entry);
    field.current?.focus();
  }

  function chooseSubject(value: Subject) {
    setSubject(value);
  }

  function chooseType(value: ErrorType) {
    setType(value);
    setMissingType(false);
    // Type choisi après la frappe : Entrée doit rester à portée.
    if (trimmed) field.current?.focus();
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        add();
      }}
      className="space-y-3"
    >
      {/* Champ nu à bouton intégré, comme la saisie du carnet « À revoir » —
          mêmes tokens que components/ui/input.tsx. */}
      <label className="flex min-h-10 min-w-0 items-center gap-2 rounded-lg border border-transparent bg-inset pl-3 pr-1 transition-colors focus-within:border-line hover:border-line max-lg:min-h-11">
        <span className="sr-only">Ce qui s&apos;est mal passé</span>
        <input
          ref={field}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={ERROR_TEXT_MAX}
          placeholder="Ce qui s'est mal passé — « signe oublié en projetant le poids »"
          enterKeyHint="done"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent py-2 text-sm text-ink outline-none placeholder:text-subtle"
        />
        <Button type="submit" variant="ghost" size="sm" disabled={!canAdd} className="shrink-0 text-ink">
          {justAdded ? (
            <>
              <Check size={14} className="text-emerald-300" /> Noté
            </>
          ) : (
            <>
              Noter <CornerDownLeft size={13} className="text-subtle max-lg:hidden" aria-hidden />
            </>
          )}
        </Button>
      </label>

      <label className="block">
        <span className="sr-only">La bonne idée (facultatif)</span>
        <Input
          value={fix}
          onChange={(event) => setFix(event.target.value)}
          maxLength={ERROR_TEXT_MAX}
          placeholder="La bonne idée (facultatif) — « faire un schéma avec les axes d'abord »"
          enterKeyHint="done"
          autoComplete="off"
        />
      </label>

      {/* TYPE — six cibles, chacune avec sa ligne d'explication. */}
      <fieldset>
        <legend className={cn("t-label mb-1.5", missingType && "text-rose-300")}>
          {missingType ? "Choisis le type d'erreur pour noter" : "Type d'erreur"}
        </legend>
        <div role="radiogroup" aria-label="Type d'erreur" className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {ERROR_TYPES.map((value) => {
            const active = value === type;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => chooseType(value)}
                className={cn(
                  "press min-h-11 rounded-xl border px-3 py-2 text-left transition-colors",
                  active ? "border-accent bg-accent/[0.08]" : "border-transparent bg-inset hover:border-line",
                  missingType && !active && "border-rose-400/40"
                )}
              >
                <span className={cn("block text-[0.8125rem] font-medium", active ? "text-accent" : "text-ink")}>{ERROR_TYPE_META[value].label}</span>
                <span className="block text-2xs leading-4 text-muted">{ERROR_TYPE_META[value].hint}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-start gap-x-5 gap-y-2.5">
        {/* MATIÈRE — les pastilles déjà connues partout dans l'app. */}
        <div role="radiogroup" aria-label="Matière" className="flex items-center gap-1 max-sm:grid max-sm:w-full max-sm:grid-cols-7">
          {subjects.map((item) => {
            const active = item === subject;
            return (
              <button
                key={item}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={item}
                title={item}
                onClick={() => chooseSubject(item)}
                className={cn(
                  // Même pastille que la saisie rapide de temps et le carnet
                  // « À revoir » : la matière retenue est INVERSÉE.
                  "press grid h-9 min-w-9 place-items-center rounded-full px-1.5 text-xs font-extrabold leading-none max-lg:h-11",
                  active ? "bg-ink text-canvas" : cn(subjectMeta[item].className, "hover:brightness-125")
                )}
              >
                {subjectMeta[item].short}
              </button>
            );
          })}
        </div>

        {/* SOURCE — six options : des pastilles qui passent à la ligne, là où
            un sélecteur segmenté déborderait d'un téléphone. */}
        <div role="radiogroup" aria-label="Source" className="flex flex-wrap items-center gap-1">
          {ERROR_SOURCES.map((value) => {
            const active = value === source;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setSource(value)}
                className={cn(
                  "press min-h-9 rounded-full px-3.5 text-[0.8125rem] font-semibold max-lg:min-h-11",
                  active ? "chip-on" : "bg-inset text-muted hover:text-ink"
                )}
              >
                {ERROR_SOURCE_META[value].label}
              </button>
            );
          })}
        </div>
      </div>
      <p className="t-meta text-2xs">
        {subject} · {ERROR_SOURCE_META[source].label}
        {date && date !== dayKey(new Date()) ? ` · ${new Date(`${date}T00:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}` : ""}
        {" · "}
        <button
          type="button"
          onClick={() => setMoreOpen((open) => !open)}
          aria-expanded={moreOpen}
          className="inline-flex min-h-6 items-center text-accent hover:underline max-lg:min-h-11"
        >
          {moreOpen ? "Moins de détails" : "Changer la date"}
        </button>
      </p>

      {moreOpen && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <label className="min-w-0">
            <span className="sr-only">Date de l&apos;erreur</span>
            <Input aria-label="Date de l'erreur" type="date" value={date || dayKey(new Date())} onChange={(event) => setDate(event.target.value)} />
          </label>
        </div>
      )}

      {(trimmed.length > ERROR_TEXT_MAX - 40 || fixTrimmed.length > ERROR_TEXT_MAX - 40) && (
        <p className="tabular t-meta text-2xs">
          {Math.max(trimmed.length, fixTrimmed.length)} / {ERROR_TEXT_MAX} — une ligne, pas un paragraphe.
        </p>
      )}
    </form>
  );
}
