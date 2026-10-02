"use client";

import { Select } from "@/components/ui/input";
import { PROGRAMME } from "@/lib/programme-data";
import type { Subject } from "@/lib/supabase/types";

/** Choix d'un chapitre de la carte du programme, restreint à une matière quand elle est connue. « Aucun » reste possible. */
export function ChapterSelect({
  subject,
  value,
  onChange,
  id,
  ariaLabel,
}: {
  subject: Subject | null;
  value: string | null;
  onChange: (chapterId: string | null) => void;
  id?: string;
  ariaLabel?: string;
}) {
  const chapters = PROGRAMME.filter((chapter) => !subject || chapter.subject === subject);
  return (
    <Select id={id} aria-label={ariaLabel} value={value ?? ""} onChange={(event) => onChange(event.target.value || null)}>
      <option value="">Chapitre : non précisé</option>
      {[1, 2].map((year) => (
        <optgroup key={year} label={year === 1 ? "Sup" : "Spé"}>
          {chapters
            .filter((chapter) => chapter.year === year)
            .map((chapter) => (
              <option key={chapter.id} value={chapter.id}>
                {subject ? "" : `${chapter.subject} · `}
                {chapter.title}
              </option>
            ))}
        </optgroup>
      ))}
    </Select>
  );
}
