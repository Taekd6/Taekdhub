"use client";

import { Check, Undo2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented";
import { cn } from "@/lib/cn";
import {
  createQuickLogSession,
  parseQuickLogMemory,
  QUICK_LOG_MAX_MINUTES,
  QUICK_LOG_MEMORY_KEY,
  QUICK_LOG_PRESETS,
  todayQuickLogs,
  type QuickLogDay,
} from "@/lib/quick-log";
import { readFlag, writeFlag } from "@/lib/storage";
import { subjectMeta, subjects } from "@/lib/study";
import { formatSpan } from "@/lib/utils";
import type { Subject, WorkSession } from "@/lib/supabase/types";

/**
 * NOTER DU TEMPS — trois gestes : une matière, une durée, « Ajouter ».
 *
 * Posé dans le rail de l'accueil, juste sous l'objectif du jour : l'anneau
 * bouge au moment où l'on valide, ce qui est la seule récompense dont une
 * saisie de dix secondes a besoin. Le dernier choix est retenu : les 30 min
 * d'Anki du matin se notent d'un seul geste.
 *
 * Aucun formulaire, aucune fenêtre : une feuille modale coûterait deux
 * gestes de plus à chaque saisie, et c'est exactement ce qui fait abandonner
 * un suivi au bout d'une semaine. Voir lib/quick-log.ts pour le modèle.
 *
 * Les données viennent du PARENT, jamais d'un second `usePrepahubData()` :
 * chaque appel du hook tient sa propre copie de l'état, et l'anneau de
 * l'accueil serait resté à 0 % après une saisie, jusqu'au rechargement.
 */
export function QuickLog({
  sessions,
  saveSessions,
  removeSession,
  ready,
}: {
  sessions: WorkSession[];
  saveSessions: (sessions: WorkSession[]) => void;
  removeSession: (id: string) => void;
  ready: boolean;
}) {
  const [subject, setSubject] = useState<Subject>("Anglais");
  const [minutes, setMinutes] = useState<number>(30);
  const [custom, setCustom] = useState("");
  const [day, setDay] = useState<QuickLogDay>("aujourd'hui");
  const [justAdded, setJustAdded] = useState<string | null>(null);

  // Relu dans un effet, jamais au premier rendu : la page est prérendue
  // statiquement, et le serveur n'a pas de localStorage.
  useEffect(() => {
    const memory = parseQuickLogMemory(readFlag(QUICK_LOG_MEMORY_KEY));
    if (memory) {
      setSubject(memory.subject);
      setMinutes(memory.minutes);
    }
  }, []);

  useEffect(() => {
    if (!justAdded) return;
    const timeout = window.setTimeout(() => setJustAdded(null), 2200);
    return () => window.clearTimeout(timeout);
  }, [justAdded]);

  const recent = useMemo(() => todayQuickLogs(sessions).slice(0, 3), [sessions]);

  const customMinutes = custom.trim() === "" ? null : Number(custom);
  const effectiveMinutes = customMinutes ?? minutes;
  const valid = Number.isFinite(effectiveMinutes) && effectiveMinutes >= 1 && effectiveMinutes <= QUICK_LOG_MAX_MINUTES;

  function add() {
    const session = createQuickLogSession({ subject, minutes: effectiveMinutes, day });
    if (!session) return;
    saveSessions([session, ...sessions]);
    writeFlag(QUICK_LOG_MEMORY_KEY, JSON.stringify({ subject, minutes: Math.round(effectiveMinutes) }));
    if (customMinutes !== null) {
      setMinutes(Math.round(effectiveMinutes));
      setCustom("");
    }
    setJustAdded(session.id);
  }

  function undo(id: string) {
    removeSession(id);
    if (justAdded === id) setJustAdded(null);
  }

  return (
    <div>
      <p className="t-label">Noter du temps</p>
      <p className="t-meta mt-1 text-2xs">Anki, relecture de cours… ce que le chrono n&apos;a pas vu.</p>

      {/* MATIÈRE — les avatars déjà connus partout dans l'app, pas une liste
          déroulante : sept cibles visibles d'un coup valent mieux qu'un menu
          à ouvrir. */}
      <div role="radiogroup" aria-label="Matière" className="mt-3 grid grid-cols-7 gap-1">
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
              onClick={() => setSubject(item)}
              className={cn(
                "grid h-9 place-items-center rounded-md text-[0.6875rem] font-semibold leading-none transition-[box-shadow,opacity] max-lg:h-11",
                subjectMeta[item].className,
                active ? "ring-2 ring-accent ring-offset-2 ring-offset-canvas" : "opacity-60 hover:opacity-100"
              )}
            >
              {subjectMeta[item].short}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-[0.8125rem] font-medium text-ink">{subject}</p>

      {/* DURÉE — huit durées en un geste, et un champ pour le reste. */}
      <div role="radiogroup" aria-label="Durée" className="mt-3 grid grid-cols-4 gap-1">
        {QUICK_LOG_PRESETS.map((preset) => {
          const active = customMinutes === null && preset === minutes;
          return (
            <button
              key={preset}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                setMinutes(preset);
                setCustom("");
              }}
              className={cn(
                "tabular min-h-8 rounded-md border text-[0.8125rem] transition-colors max-lg:min-h-11",
                active ? "border-line bg-panel font-medium text-ink" : "border-transparent bg-inset text-muted hover:text-ink"
              )}
            >
              {preset < 60 ? `${preset}′` : `${Math.floor(preset / 60)}h${preset % 60 ? preset % 60 : ""}`}
            </button>
          );
        })}
      </div>
      <label className="mt-2 flex items-center gap-2 text-2xs text-muted">
        Autre
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={QUICK_LOG_MAX_MINUTES}
          value={custom}
          onChange={(event) => setCustom(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && valid) add();
          }}
          placeholder="min"
          className="tabular h-8 w-16 rounded-md border border-line bg-panel px-2 text-[0.8125rem] text-ink placeholder:text-subtle max-lg:h-11"
        />
        min
      </label>

      <SegmentedControl
        className="mt-3"
        size="sm"
        ariaLabel="Jour"
        value={day}
        onChange={setDay}
        options={[
          { value: "aujourd'hui", label: "Aujourd'hui" },
          { value: "hier", label: "Hier" },
        ]}
      />

      <Button variant="secondary" className="mt-3 w-full" disabled={!ready || !valid} onClick={add}>
        {justAdded ? (
          <>
            <Check size={15} className="text-emerald-300" /> Ajouté
          </>
        ) : (
          <>
            Ajouter <span className="tabular">{valid ? formatSpan(Math.round(effectiveMinutes) * 60) : "—"}</span>
          </>
        )}
      </Button>

      {recent.length > 0 && (
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {recent.map((session) => (
            <li key={session.id} className="flex items-center gap-2 py-1.5">
              <span className={cn("grid h-5 w-5 shrink-0 place-items-center rounded text-[0.625rem] font-semibold", subjectMeta[session.subject].className)}>
                {subjectMeta[session.subject].short}
              </span>
              <span className="tabular min-w-0 flex-1 truncate text-2xs text-muted">
                {formatSpan(session.duration_seconds)}
                {session.id === justAdded && <span className="text-emerald-300"> · à l&apos;instant</span>}
              </span>
              <button
                type="button"
                onClick={() => undo(session.id)}
                className="inline-flex min-h-6 items-center gap-1 rounded px-1 text-2xs text-subtle hover:text-ink max-lg:min-h-11"
                aria-label={`Annuler ${formatSpan(session.duration_seconds)} de ${session.subject}`}
              >
                <Undo2 size={12} /> Annuler
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
