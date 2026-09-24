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
 * Posé sur l'accueil, sous l'anneau du jour : l'anneau avance au moment où
 * l'on valide, ce qui est la seule récompense dont une saisie de dix
 * secondes a besoin. Le dernier
 * choix est retenu : les 30 min d'Anki du matin se notent d'un seul geste.
 *
 * Le TITRE de la carte (« Noter du temps ») est posé par l'appelant (la
 * tuile en deux colonnes de l'accueil) : ce composant ne rend que les
 * contrôles.
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
      {/* MATIÈRE — sept pastilles NEUTRES, pas une liste déroulante : sept
          cibles visibles d'un coup valent mieux qu'un menu à ouvrir.

          La matière retenue passe en INVERSE (fond à l'encre, lettre à la
          couleur du fond) — la sélection d'iOS. Avant, elle prenait le
          palier de gris de la matière (`subjectMeta.solid`) avec une lettre
          quasi noire codée en dur : en thème clair, les paliers partent du
          NOIR (maths = #1d1d1f), et la lettre disparaissait. L'inverse
          encre / fond tient 15:1 et plus dans les deux thèmes, pour toutes
          les matières. */}
      <div role="radiogroup" aria-label="Matière" className="grid grid-cols-7 gap-1.5">
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
                "press grid h-11 place-items-center rounded-full text-[0.8125rem] font-bold leading-none",
                active ? "bg-ink text-canvas" : "bg-inset text-ink hover:bg-zinc-700"
              )}
            >
              {subjectMeta[item].short}
            </button>
          );
        })}
      </div>
      <p className="mt-2.5 text-sm font-semibold text-ink">{subject}</p>

      {/* DURÉE — huit durées en un geste, et un champ pour le reste. */}
      <div role="radiogroup" aria-label="Durée" className="mt-3 grid grid-cols-4 gap-1.5">
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
                "press tabular min-h-10 rounded-full text-[0.8125rem] font-bold max-lg:min-h-11",
                active ? "bg-ink text-canvas" : "bg-inset text-muted hover:text-ink"
              )}
            >
              {preset < 60 ? `${preset}′` : `${Math.floor(preset / 60)}h${preset % 60 ? preset % 60 : ""}`}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <label className="flex items-center gap-2 text-[0.8125rem] font-semibold text-muted">
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
            className="tabular h-9 w-16 rounded-lg border border-transparent bg-inset px-2.5 text-[0.8125rem] text-ink placeholder:text-subtle hover:border-line max-lg:h-11"
          />
          min
        </label>
        <SegmentedControl
          className="ml-auto sm:w-auto"
          size="sm"
          ariaLabel="Jour"
          value={day}
          onChange={setDay}
          options={[
            { value: "aujourd'hui", label: "Aujourd'hui" },
            { value: "hier", label: "Hier" },
          ]}
        />
      </div>

      <Button variant="secondary" size="lg" className="mt-5 w-full" disabled={!ready || !valid} onClick={add}>
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
        <ul className="mt-3 divide-y divide-line">
          {recent.map((session) => (
            <li key={session.id} className={cn("flex items-center gap-2 py-1.5", session.id === justAdded && "animate-rise")}>
              <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full text-[0.625rem] font-extrabold", subjectMeta[session.subject].className)}>
                {subjectMeta[session.subject].short}
              </span>
              <span className="tabular min-w-0 flex-1 truncate text-[0.8125rem] font-semibold text-muted">
                {formatSpan(session.duration_seconds)}
                {session.id === justAdded && <span className="text-emerald-300"> · à l&apos;instant</span>}
              </span>
              <button
                type="button"
                onClick={() => undo(session.id)}
                className="inline-flex min-h-8 items-center gap-1 rounded-full px-2 text-2xs font-bold text-subtle hover:bg-inset hover:text-ink max-lg:min-h-11"
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
