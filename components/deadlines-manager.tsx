"use client";

import { useState } from "react";
import { CalendarClock, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { SubjectAvatar } from "@/components/exercises/exercise-badges";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { addDeadline, daysUntilDeadline, deadlineChapterLabels, removeDeadline, updateDeadline } from "@/lib/deadlines";
import { getChaptersForSubject } from "@/lib/chapters";
import { subjects } from "@/lib/study";
import type { Deadline, DeadlineType } from "@/lib/storage";
import type { Subject } from "@/lib/supabase/types";

const DEADLINE_TYPES: { value: DeadlineType; label: string }[] = [
  { value: "DS", label: "DS" },
  { value: "khôlle", label: "Khôlle" },
  { value: "autre", label: "Autre" },
];

type Draft = { type: DeadlineType; subject: Subject; date: string; title: string; chapterIds: string[] };

const EMPTY_DRAFT: Draft = { type: "DS", subject: "Mathématiques", date: "", title: "", chapterIds: [] };

/**
 * Échéances DS/khôlle liées à des chapitres précis (Sprint Study OS Phase 4)
 * — étend le champ "échéance par matière" déjà présent dans PreferencesForm
 * (une simple date, conservée telle quelle) avec un concept plus riche :
 * plusieurs échéances possibles, chacune associée à une liste de chapitres
 * existants (jamais un nouveau catalogue de chapitres dupliqué ici).
 */
export function DeadlinesManager() {
  const { deadlines, saveDeadlines, chapters } = usePrepahubData();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);

  const chapterOptions = getChaptersForSubject(chapters, draft.subject);
  const sorted = [...deadlines].sort((a, b) => a.date.localeCompare(b.date));

  function startCreate() {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setFormOpen(true);
  }

  function startEdit(deadline: Deadline) {
    setEditingId(deadline.id);
    setDraft({ type: deadline.type, subject: deadline.subject, date: deadline.date, title: deadline.title, chapterIds: deadline.chapterIds });
    setFormOpen(true);
  }

  function cancel() {
    setFormOpen(false);
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
  }

  function toggleChapter(chapterId: string) {
    setDraft((prev) => ({
      ...prev,
      chapterIds: prev.chapterIds.includes(chapterId) ? prev.chapterIds.filter((id) => id !== chapterId) : [...prev.chapterIds, chapterId],
    }));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.date || !draft.title.trim()) return;
    if (editingId) saveDeadlines(updateDeadline(deadlines, editingId, draft));
    else saveDeadlines(addDeadline(deadlines, draft));
    cancel();
  }

  function remove(id: string) {
    saveDeadlines(removeDeadline(deadlines, id));
    if (editingId === id) cancel();
  }

  return (
    <Card className="max-w-2xl p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Échéances</p>
          <h2 className="mt-2 text-lg font-semibold">DS, khôlles et leurs chapitres</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Associe une échéance à des chapitres précis pour que TaekdHub fasse remonter les bons exercices avant le jour J.
          </p>
        </div>
        {!formOpen && (
          <Button type="button" size="sm" onClick={startCreate}>
            <Plus size={15} /> Ajouter
          </Button>
        )}
      </div>

      {formOpen && (
        <form onSubmit={submit} className="mt-5 space-y-4 rounded-2xl border border-hairline/[0.08] bg-hairline/[0.02] p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              Type
              <Select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as DeadlineType })} className="mt-1.5">
                {DEADLINE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block text-sm font-medium">
              Matière
              <Select
                value={draft.subject}
                onChange={(e) => setDraft({ ...draft, subject: e.target.value as Subject, chapterIds: [] })}
                className="mt-1.5"
              >
                {subjects.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </Select>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              Titre
              <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Ex. DS de rentrée" className="mt-1.5" />
            </label>
            <label className="block text-sm font-medium">
              Date
              <Input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} className="mt-1.5" required />
            </label>
          </div>

          <div>
            <p className="text-sm font-medium">Chapitres concernés</p>
            {chapterOptions.length === 0 ? (
              <p className="mt-1.5 text-xs text-zinc-500">Aucun chapitre pour {draft.subject} — crée-en depuis un exercice avant d&apos;en associer un ici.</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {chapterOptions.map((chapter) => {
                  const selected = draft.chapterIds.includes(chapter.id);
                  return (
                    <button
                      key={chapter.id}
                      type="button"
                      onClick={() => toggleChapter(chapter.id)}
                      aria-pressed={selected}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        selected ? "border-accent/40 bg-accent/15 text-accent-text" : "border-hairline/[0.09] text-zinc-400 hover:border-hairline/[0.18]"
                      }`}
                    >
                      {chapter.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button type="submit">{editingId ? "Enregistrer" : "Ajouter"}</Button>
            <Button type="button" variant="ghost" onClick={cancel}>
              Annuler
            </Button>
          </div>
        </form>
      )}

      <div className="mt-5 space-y-2.5">
        {sorted.length === 0 && !formOpen && <p className="text-sm text-zinc-500">Aucune échéance enregistrée pour l&apos;instant.</p>}
        {sorted.map((deadline) => {
          const days = daysUntilDeadline(deadline.date);
          const chapterLabels = deadlineChapterLabels(deadline, chapters);
          return (
            <div key={deadline.id} className="flex items-start justify-between gap-3 rounded-xl border border-hairline/[0.06] px-3.5 py-3 text-sm">
              <div className="flex min-w-0 items-start gap-3">
                <SubjectAvatar subject={deadline.subject} size="sm" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-zinc-100">{deadline.title}</span>
                    <span className="rounded-full bg-hairline/[0.06] px-2 py-0.5 text-2xs text-zinc-400">{deadline.type}</span>
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
                    <CalendarClock size={12} />
                    {new Date(deadline.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                    {days !== null && (days >= 0 ? ` · dans ${days} j` : " · passée")}
                  </p>
                  {chapterLabels.length > 0 && <p className="mt-1 text-xs text-zinc-500">{chapterLabels.join(", ")}</p>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button type="button" variant="ghost" size="icon" onClick={() => startEdit(deadline)} aria-label="Modifier" className="h-9 w-9">
                  <Pencil size={15} />
                </Button>
                <Button type="button" variant="ghost" size="icon" onClick={() => remove(deadline.id)} aria-label="Supprimer" className="h-9 w-9">
                  <Trash2 size={15} />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
