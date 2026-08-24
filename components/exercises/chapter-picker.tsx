"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { getChaptersForSubject } from "@/lib/chapters";
import type { Chapter } from "@/lib/storage";
import type { Subject } from "@/lib/supabase/types";

const NEW_CHAPTER_VALUE = "__new__";

/**
 * Sélecteur de chapitre filtré par matière, avec création inline (Sprint
 * 3D) — seul point de création d'un chapitre dans l'app, réutilisé par
 * ExerciseForm (création) et ExerciseDetail (édition) pour ne jamais
 * dupliquer ce flux. Si aucun chapitre n'existe pour la matière, la liste
 * ne montre que "Sans chapitre" et "+ Nouveau chapitre…" — pas de state vide
 * ambigu.
 */
export function ChapterPicker({
  subject,
  chapters,
  value,
  onChange,
  onCreateChapter,
}: {
  subject: Subject;
  chapters: Chapter[];
  value: string | null;
  onChange: (chapterId: string | null) => void;
  onCreateChapter: (subject: Subject, label: string) => Chapter;
}) {
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState("");
  const options = getChaptersForSubject(chapters, subject);

  function handleSelect(raw: string) {
    if (raw === NEW_CHAPTER_VALUE) {
      setCreating(true);
      return;
    }
    onChange(raw || null);
  }

  function confirmCreate() {
    const trimmed = label.trim();
    if (!trimmed) return;
    // Réutilise un chapitre existant de même libellé (insensible à la casse)
    // pour cette matière plutôt que d'en créer un doublon — même règle que
    // l'import en masse (lib/exercise-import.ts#parseExerciseImportPayload),
    // jamais appliquée jusqu'ici à cette création inline. Sans ça, taper deux
    // fois "Suites numériques" créait deux chapitres distincts, indiscernables
    // dans la liste.
    const existing = options.find((chapter) => chapter.label.toLowerCase() === trimmed.toLowerCase());
    onChange(existing ? existing.id : onCreateChapter(subject, trimmed).id);
    setLabel("");
    setCreating(false);
  }

  if (creating) {
    return (
      <div className="flex items-center gap-2">
        <Input
          autoFocus
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Nom du chapitre"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              confirmCreate();
            }
            // `stopPropagation` : sans elle, l'Échap remonte jusqu'au raccourci
            // clavier global d'ExerciseManager, qui referme AUSSI toute la carte
            // exercice (voir sa gestion d'Échap) — un seul appui fermerait alors
            // et ce sous-panneau ET la fiche entière, bien plus que ce que
            // l'utilisateur voulait annuler.
            if (event.key === "Escape") {
              event.stopPropagation();
              setCreating(false);
            }
          }}
          className="h-9 max-w-[180px]"
        />
        <Button type="button" size="sm" onClick={confirmCreate} disabled={!label.trim()}>
          Créer
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setCreating(false);
            setLabel("");
          }}
        >
          Annuler
        </Button>
      </div>
    );
  }

  return (
    <Select value={value ?? ""} onChange={(event) => handleSelect(event.target.value)} className="w-auto min-w-[170px]">
      <option value="">Sans chapitre</option>
      {options.map((chapter) => (
        <option key={chapter.id} value={chapter.id}>
          {chapter.label}
        </option>
      ))}
      <option value={NEW_CHAPTER_VALUE}>+ Nouveau chapitre…</option>
    </Select>
  );
}
