"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Section } from "@/components/ui/section";
import { Notice } from "@/components/ui/state";
import { SUBJECT_TONES, SUBJECT_TONE_CLASS, shortFromLabel, subjectIdFromLabel } from "@/lib/domain/subjects";
import { useStore } from "@/lib/store/store";
import { cn } from "@/lib/cn";
import type { SubjectTone } from "@/lib/domain/types";

/**
 * MATIÈRES — des données que l'élève possède, pas une liste imposée.
 *
 * Renommer une matière ne casse rien : les tâches la référencent par son
 * identifiant, jamais par son libellé. La SUPPRIMER, en revanche, détache les
 * tâches concernées — donc on le dit avant, et on propose l'archivage, qui la
 * retire des sélecteurs sans toucher à l'historique.
 */
export function SubjectsEditor() {
  const { state, saveSubjects } = useStore();
  const [newLabel, setNewLabel] = useState("");

  const usage = new Map<string, number>();
  for (const task of state.tasks) {
    if (task.subjectId) usage.set(task.subjectId, (usage.get(task.subjectId) ?? 0) + 1);
  }

  function update(id: string, patch: Partial<(typeof state.subjects)[number]>) {
    saveSubjects(state.subjects.map((subject) => (subject.id === id ? { ...subject, ...patch } : subject)));
  }

  function addSubject() {
    const label = newLabel.trim();
    if (!label) return;
    const used = new Set(state.subjects.map((subject) => subject.tone));
    const tone = SUBJECT_TONES.find((value) => !used.has(value)) ?? SUBJECT_TONES[0];
    saveSubjects([
      ...state.subjects,
      {
        id: subjectIdFromLabel(label, state.subjects),
        label,
        short: shortFromLabel(label),
        tone,
        order: state.subjects.length,
      },
    ]);
    setNewLabel("");
  }

  return (
    <Section label="Matières" title="Mes matières" description="Ajoute, renomme ou archive. Les tâches suivent.">
      <ul className="divide-y divide-line border-y border-line">
        {[...state.subjects]
          .sort((a, b) => a.order - b.order)
          .map((subject) => {
            const count = usage.get(subject.id) ?? 0;
            return (
              <li key={subject.id} className={cn("flex flex-wrap items-center gap-2 py-2.5", subject.archived && "opacity-55")}>
                <span
                  aria-hidden
                  className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-md text-2xs font-semibold", SUBJECT_TONE_CLASS[subject.tone])}
                >
                  {subject.short}
                </span>
                <Input
                  value={subject.label}
                  onChange={(event) => update(subject.id, { label: event.target.value })}
                  aria-label={`Nom de la matière ${subject.label}`}
                  className="min-w-[9rem] flex-1"
                />
                <Input
                  value={subject.short}
                  onChange={(event) => update(subject.id, { short: event.target.value.slice(0, 3) })}
                  aria-label={`Abréviation de ${subject.label}`}
                  className="w-16"
                />
                <Select
                  value={subject.tone}
                  onChange={(event) => update(subject.id, { tone: event.target.value as SubjectTone })}
                  aria-label={`Couleur de ${subject.label}`}
                  wrapperClassName="w-auto"
                  className="w-32"
                >
                  {SUBJECT_TONES.map((tone) => (
                    <option key={tone} value={tone}>
                      {tone}
                    </option>
                  ))}
                </Select>
                <span className="t-meta w-20 shrink-0 text-right">{count > 0 ? `${count} tâche${count > 1 ? "s" : ""}` : "—"}</span>
                <Button size="sm" variant="ghost" onClick={() => update(subject.id, { archived: !subject.archived })}>
                  {subject.archived ? "Réactiver" : "Archiver"}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Supprimer ${subject.label}`}
                  disabled={count > 0}
                  title={count > 0 ? "Des tâches l'utilisent — archive-la plutôt" : undefined}
                  onClick={() => saveSubjects(state.subjects.filter((item) => item.id !== subject.id))}
                >
                  <Trash2 size={14} />
                </Button>
              </li>
            );
          })}
      </ul>

      <form
        className="mt-4 flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          addSubject();
        }}
      >
        <Input
          value={newLabel}
          onChange={(event) => setNewLabel(event.target.value)}
          placeholder="Sciences de l'ingénieur"
          aria-label="Nouvelle matière"
          className="min-w-[12rem] flex-1"
        />
        <Button type="submit" variant="secondary" disabled={!newLabel.trim()}>
          <Plus size={14} /> Ajouter
        </Button>
      </form>

      {state.subjects.length === 0 && <Notice tone="warning">Sans matière, les tâches ne peuvent plus être classées.</Notice>}
    </Section>
  );
}
