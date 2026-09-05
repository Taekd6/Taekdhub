"use client";

import { Archive, Clock3, Eye, EyeOff, Heart, Pencil, Target, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
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
  onArchive,
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
  /**
   * Favori et archivage. Ces deux gestes vivaient UNIQUEMENT sur la ligne de
   * liste, où ils occupaient un tiers de la largeur sur mobile au détriment
   * du titre. La ligne ne les propose donc plus qu'à partir de `sm` — ils
   * doivent exister ici, sinon ils deviennent inatteignables au doigt.
   */
  onArchive: (id: string) => void;
}) {
  const [correctionVisible, setCorrectionVisible] = useState(false);
  const [hintCount, setHintCount] = useState(0);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  /**
   * Énoncé et notes : édités LOCALEMENT, enregistrés à la sortie du champ.
   *
   * Ces deux zones de texte appelaient `update` à chaque frappe, et `update`
   * réécrit la banque entière — 440 exercices, plus de deux mégaoctets — dans
   * `localStorage`. Recopier l'énoncé d'une feuille de TD, ce sont plusieurs
   * centaines de frappes, donc autant de sérialisations complètes de la
   * banque : la saisie devient poussive, et chaque frappe est une occasion
   * de plus de heurter le quota du navigateur. Une écriture par champ quitté
   * suffit largement, et l'aperçu LaTeX juste en dessous reste vivant puisque
   * il lit désormais l'état local.
   *
   * Resynchronisé quand la fiche affichée change (`item.id`), jamais sur le
   * contenu : se recaler sur `item.statement` pendant la frappe ferait
   * reculer le curseur.
   */
  const [statementDraft, setStatementDraft] = useState(item.statement || "");
  const [noteDraft, setNoteDraft] = useState(item.note || "");
  useEffect(() => {
    setStatementDraft(item.statement || "");
    setNoteDraft(item.note || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  const currentChapter = chapters.find((chapter) => chapter.id === item.chapter_id) ?? null;
  const pastSessions = sessionsForExercise(sessions, item.id);
  const results = resultCounts(pastSessions);

  return (
    <div className="grid gap-5 bg-inset p-5 md:grid-cols-2">
      <div className="md:col-span-2">
        <p className="eyebrow">Énoncé</p>
        <Textarea
          value={statementDraft}
          onChange={(event) => setStatementDraft(event.target.value)}
          onBlur={() => {
            if (statementDraft !== (item.statement || "")) update(item.id, { statement: statementDraft });
          }}
          className="mt-2 min-h-32"
          placeholder={"Énoncé complet — maths en LaTeX : $x^2$ inline, $$\\int_0^1 f$$ en bloc"}
        />
        {statementDraft.trim() && (
          <div className="mt-3 rounded-xl border border-line bg-inset p-3 text-sm leading-6 text-zinc-300">
            <p className="mb-1 text-2xs uppercase tracking-wide text-zinc-600">Aperçu</p>
            <RichMath text={statementDraft} />
          </div>
        )}
      </div>
      <div>
        <p className="eyebrow">Notes</p>
        <Textarea
          value={noteDraft}
          onChange={(event) => setNoteDraft(event.target.value)}
          onBlur={() => {
            if (noteDraft !== (item.note || "")) update(item.id, { note: noteDraft || null });
          }}
          className="mt-2 min-h-24"
          placeholder="Ce que tu veux retenir, les erreurs à éviter…"
        />
      </div>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="eyebrow">Mode résolution</p>
          <div className="flex items-center gap-4 text-xs text-zinc-500">
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
              <span className="font-semibold text-zinc-300">{item.attempts}</span> tentative{item.attempts > 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-5">
          <label className="flex items-center gap-2 text-xs text-zinc-500">
            Maîtrise
            <MasteryPicker value={item.mastery} onChange={(mastery: Mastery) => update(item.id, { mastery })} />
          </label>
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
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
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
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
          <div key={index} className="rounded-xl border border-accent/15 bg-accent/[0.055] p-3 text-sm leading-6 text-zinc-300">
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
              <div className="mt-3 rounded-xl border border-line bg-inset p-3 text-sm leading-6 text-zinc-300">
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
            <p className="text-xs text-zinc-500">
              {results.success} réussite{results.success > 1 ? "s" : ""} · {results.partial} partielle{results.partial > 1 ? "s" : ""} ·{" "}
              {results.failure} échec{results.failure > 1 ? "s" : ""} · {results.successRate}% de réussite
            </p>
          )}
        </div>
        {pastSessions.length ? (
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {pastSessions.map((session) => (
              <SessionRow key={session.id} session={session} chapterLabel={currentChapter?.label} />
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">Aucune séance enregistrée sur cet exercice pour l&apos;instant.</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4 md:col-span-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => update(item.id, { favorite: !item.favorite })}
          aria-pressed={item.favorite}
        >
          <Heart size={14} fill={item.favorite ? "currentColor" : "none"} className={item.favorite ? "text-rose-300" : undefined} />
          {item.favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => onArchive(item.id)}>
          <Archive size={14} /> Archiver
        </Button>
      </div>
    </div>
  );
}
