"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented";
import { getChaptersForSubject } from "@/lib/chapters";
import type { Chapter, GoalPriority } from "@/lib/storage";
import { subjectMeta, subjects } from "@/lib/study";
import type { Subject } from "@/lib/supabase/types";
import { cn } from "@/lib/cn";

const PRIORITY_OPTIONS: { value: GoalPriority; label: string }[] = [
  { value: 1, label: "Basse" },
  { value: 2, label: "Normale" },
  { value: 3, label: "Haute" },
];

/**
 * Création d'un objectif — un seul écran, pas un assistant en plusieurs
 * étapes : titre, matière(s), chapitres (optionnel, dépend des matières déjà
 * choisies), échéance (optionnelle) et priorité. Volontairement SANS champ
 * "quantité de travail souhaitée" séparé : `lib/goals.ts` dérive tout ce
 * dont il a besoin (couverture, volume restant) des données déjà présentes,
 * un chiffre de plus à saisir n'aurait rien de fiable à représenter.
 */
export function GoalForm({
  chapters,
  onCreate,
  onCancel,
}: {
  chapters: Chapter[];
  onCreate: (input: { title: string; subjects: Subject[]; chapterIds: string[]; targetDate: string | null; priority: GoalPriority }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [selectedSubjects, setSelectedSubjects] = useState<Subject[]>([]);
  const [selectedChapterIds, setSelectedChapterIds] = useState<string[]>([]);
  const [targetDate, setTargetDate] = useState("");
  const [priority, setPriority] = useState<GoalPriority>(2);

  const availableChapters = useMemo(
    () => selectedSubjects.flatMap((subject) => getChaptersForSubject(chapters, subject)),
    [chapters, selectedSubjects]
  );

  function toggleSubject(subject: Subject) {
    const isSelected = selectedSubjects.includes(subject);
    setSelectedSubjects((prev) => (isSelected ? prev.filter((item) => item !== subject) : [...prev, subject]));
    if (isSelected) {
      // La matière vient d'être décochée : ses chapitres ne doivent jamais
      // rester ciblés silencieusement — ils redeviendraient invisibles dans
      // le formulaire tout en continuant à restreindre l'objectif.
      const removedChapterIds = new Set(getChaptersForSubject(chapters, subject).map((chapter) => chapter.id));
      setSelectedChapterIds((chapterIds) => chapterIds.filter((id) => !removedChapterIds.has(id)));
    }
  }

  function toggleChapter(chapterId: string) {
    setSelectedChapterIds((prev) => (prev.includes(chapterId) ? prev.filter((id) => id !== chapterId) : [...prev, chapterId]));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    onCreate({
      title: title.trim(),
      subjects: selectedSubjects,
      chapterIds: selectedChapterIds,
      targetDate: targetDate || null,
      priority,
    });
  }

  return (
    <Card className="p-4 sm:p-5">
      <form onSubmit={submit} className="space-y-5">
        <label className="block text-sm font-medium">
          Titre
          <Input
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ex. Préparer le DS de maths"
            className="mt-2"
          />
        </label>

        <div>
          <p className="text-sm font-medium">Matière{selectedSubjects.length > 1 ? "s" : ""}</p>
          <p className="mt-1 text-xs text-muted">Aucune sélection = toutes les matières.</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {subjects.map((subject) => (
              <Button
                key={subject}
                type="button"
                size="sm"
                variant={selectedSubjects.includes(subject) ? "primary" : "secondary"}
                onClick={() => toggleSubject(subject)}
              >
                <span className={cn("grid h-4 w-4 place-items-center rounded text-[8px] font-bold", subjectMeta[subject].className)}>
                  {subjectMeta[subject].short}
                </span>
                {subject}
              </Button>
            ))}
          </div>
        </div>

        {availableChapters.length > 0 && (
          <div>
            <p className="text-sm font-medium">Chapitres ciblés (optionnel)</p>
            <p className="mt-1 text-xs text-muted">Aucune sélection = toute la matière.</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {availableChapters.map((chapter) => (
                <Button
                  key={chapter.id}
                  type="button"
                  size="sm"
                  variant={selectedChapterIds.includes(chapter.id) ? "primary" : "secondary"}
                  onClick={() => toggleChapter(chapter.id)}
                >
                  {chapter.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-5">
          <label className="block text-sm font-medium">
            Échéance (optionnelle)
            <Input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} className="mt-2 w-auto" />
          </label>
          <div>
            <p className="text-sm font-medium">Priorité</p>
            <SegmentedControl ariaLabel="Priorité de l'objectif" value={priority} onChange={setPriority} options={PRIORITY_OPTIONS} className="mt-2" />
          </div>
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={!title.trim()}>
            Créer l&apos;objectif
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Annuler
          </Button>
        </div>
      </form>
    </Card>
  );
}
