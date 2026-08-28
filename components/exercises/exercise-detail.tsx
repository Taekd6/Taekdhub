"use client";

import { Clock3, Eye, EyeOff, Pencil, Target, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { ChapterPicker } from "@/components/exercises/chapter-picker";
import { MasteryPicker } from "@/components/exercises/exercise-badges";
import { SessionRow } from "@/components/history/session-row";
import { RichMath } from "@/components/rich-math";
import { resultCounts, sessionsForExercise } from "@/lib/history";
import type { Chapter } from "@/lib/storage";
import type { Exercise, Mastery, Subject, WorkSession } from "@/lib/supabase/types";

export function ExerciseDetail({
  item,
  update,
  minutesSpent,
  chapters,
  sessions,
  onCreateChapter,
  onRenameChapter,
  onRemoveChapter,
}: {
  item: Exercise;
  update: (id: string, patch: Partial<Exercise>) => void;
  /** Temps réellement passé sur cet exercice, en minutes — dérivé des WorkSession liées (voir lib/study.ts). */
  minutesSpent: number;
  chapters: Chapter[];
  /** Pour la section "Séances" (Sprint 3F, lien exercice → historique) — voir lib/history.ts#sessionsForExercise. */
  sessions: WorkSession[];
  onCreateChapter: (subject: Subject, label: string) => Chapter;
  onRenameChapter: (id: string, label: string) => void;
  onRemoveChapter: (id: string) => void;
}) {
  const [correctionVisible, setCorrectionVisible] = useState(false);
  const [hintCount, setHintCount] = useState(0);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const currentChapter = chapters.find((chapter) => chapter.id === item.chapter_id) ?? null;
  const pastSessions = sessionsForExercise(sessions, item.id);
  const results = resultCounts(pastSessions);

  return (
    <div className="grid gap-5 bg-inset p-5 md:grid-cols-2">
      <div className="md:col-span-2">
        <p className="eyebrow">Énoncé</p>
        <Textarea
          value={item.statement || ""}
          onChange={(event) => update(item.id, { statement: event.target.value })}
          className="mt-2 min-h-32"
          placeholder={"Énoncé complet — maths en LaTeX : $x^2$ inline, $$\\int_0^1 f$$ en bloc"}
        />
        {item.statement.trim() && (
          <div className="mt-3 rounded-xl border border-hairline/[0.09] bg-hairline/[0.04] p-3 text-sm leading-6 text-ink">
            <p className="mb-1 text-2xs uppercase tracking-wide text-subtle">Aperçu</p>
            <RichMath text={item.statement} />
          </div>
        )}
      </div>
      <div>
        <p className="eyebrow">Notes</p>
        <Textarea
          value={item.note || ""}
          onChange={(event) => update(item.id, { note: event.target.value || null })}
          className="mt-2 min-h-24"
          placeholder="Ce que tu veux retenir, les erreurs à éviter…"
        />
      </div>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="eyebrow">Mode résolution</p>
          <div className="flex items-center gap-4 text-xs text-muted">
            <span className="flex items-center gap-1">
              <Clock3 size={13} /> {minutesSpent} min passées
            </span>
            <label className="flex items-center gap-1.5">
              <Target size={13} />
              <Input
                type="number"
                min={0}
                value={item.estimated_minutes ?? ""}
                onChange={(event) => update(item.id, { estimated_minutes: event.target.value ? Math.max(0, Number(event.target.value)) : null })}
                placeholder="estimé"
                className="h-7 w-20 px-2 py-0 text-xs"
              />
              min
            </label>
            {/* Sprint 2.5 : attempts est incrémenté automatiquement par le mode focus, plus de contrôle manuel — voir focus-view.tsx. */}
            <span className="flex items-center gap-1">
              <span className="font-semibold text-ink">{item.attempts}</span> tentative{item.attempts > 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-5">
          <label className="flex items-center gap-2 text-xs text-muted">
            Maîtrise
            <MasteryPicker value={item.mastery} onChange={(mastery: Mastery) => update(item.id, { mastery })} />
          </label>
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            Chapitre
            <ChapterPicker
              subject={item.subject}
              chapters={chapters}
              value={item.chapter_id}
              onChange={(chapterId) => update(item.id, { chapter_id: chapterId })}
              onCreateChapter={onCreateChapter}
            />
            {currentChapter && !renaming && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Renommer le chapitre"
                  onClick={() => {
                    setRenameValue(currentChapter.label);
                    setRenaming(true);
                  }}
                >
                  <Pencil size={14} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Supprimer le chapitre"
                  onClick={() => setConfirmingDelete(true)}
                >
                  <Trash2 size={14} />
                </Button>
              </>
            )}
          </div>
          {renaming && currentChapter && (
            <div className="mt-2 flex items-center gap-2">
              <Input
                autoFocus
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                className="h-9 max-w-[200px]"
              />
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onRenameChapter(currentChapter.id, renameValue);
                  setRenaming(false);
                }}
              >
                Renommer
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setRenaming(false)}>
                Annuler
              </Button>
            </div>
          )}
          {confirmingDelete && currentChapter && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
              <span>
                Supprimer « {currentChapter.label} » ? Les exercices restent, seul le lien est retiré.
              </span>
              <Button
                type="button"
                size="sm"
                variant="danger"
                onClick={() => {
                  onRemoveChapter(currentChapter.id);
                  setConfirmingDelete(false);
                }}
              >
                Confirmer
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmingDelete(false)}>
                Annuler
              </Button>
            </div>
          )}
        </div>
        {item.hints.slice(0, hintCount).map((hint, index) => (
          <div key={index} className="rounded-xl border border-accent/15 bg-accent/[0.055] p-3 text-sm leading-6 text-ink">
            <RichMath text={`Indice ${index + 1} — ${hint}`} />
          </div>
        ))}
        {hintCount < item.hints.length && (
          <Button variant="ghost" onClick={() => setHintCount((count) => count + 1)} className="text-accent">
            Afficher l&apos;indice {hintCount + 1}
          </Button>
        )}
        {item.correction && (
          <div>
            <Button variant="ghost" onClick={() => setCorrectionVisible((value) => !value)}>
              {correctionVisible ? <EyeOff size={16} /> : <Eye size={16} />}
              {correctionVisible ? "Masquer la correction" : "Afficher la correction"}
            </Button>
            {correctionVisible && (
              <div className="mt-3 rounded-xl border border-hairline/[0.09] bg-hairline/[0.04] p-3 text-sm leading-6 text-ink">
                <RichMath text={item.correction} />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="md:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="eyebrow">Séances</p>
          {results.attempted > 0 && (
            <p className="text-xs text-muted">
              {results.success} réussite{results.success > 1 ? "s" : ""} · {results.partial} partielle{results.partial > 1 ? "s" : ""} ·{" "}
              {results.failure} échec{results.failure > 1 ? "s" : ""} · {results.successRate}% de réussite
            </p>
          )}
        </div>
        {pastSessions.length ? (
          <div className="mt-3 space-y-2">
            {pastSessions.map((session) => (
              <SessionRow key={session.id} session={session} chapterLabel={currentChapter?.label} />
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">Aucune séance enregistrée sur cet exercice pour l&apos;instant.</p>
        )}
      </div>
    </div>
  );
}
