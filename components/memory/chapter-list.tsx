"use client";

import { Archive, ArchiveRestore, Pencil, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { AnkiLink } from "@/components/memory/anki-link";
import { chanceSentence, formatDay, RatingPanel, RetentionBar } from "@/components/memory/memory-bits";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { SubjectAvatar } from "@/components/subject-avatar";
import {
  ANKI_DECK_MAX,
  CHAPTER_TITLE_MAX,
  createChapter,
  editChapter,
  formatChance,
  rateChapter,
  reminderDay,
  retrievabilityToday,
  setArchived,
} from "@/lib/chapter-memory";
import type { FsrsRating } from "@/lib/fsrs";
import type { ChapterMemory } from "@/lib/storage";
import { dayKey, subjects } from "@/lib/study";
import type { Subject } from "@/lib/supabase/types";
import { cn } from "@/lib/cn";

/**
 * LES CHAPITRES — saisie et liste, partagées par le hub d'une matière
 * (`subject` fixé) et la page /memoire (toutes les matières, sélecteur).
 *
 * Chaque ligne : le titre, une barre de rétention (R aujourd'hui, FSRS), la
 * date du prochain rappel, et les gestes — « C'est révisé » (note), Anki,
 * modifier, ranger. Un chapitre RANGÉ ne rappelle plus rien mais garde son
 * historique ; il se ressort d'un clic.
 *
 * Données en props : l'écran appelant tient le seul `usePrepahubData()`.
 * `saveChapters` REMPLACE la liste entière (voir lib/storage.ts).
 */
export function ChapterList({
  chapters,
  saveChapters,
  subject = null,
  selectedId,
  onSelect,
}: {
  chapters: ChapterMemory[];
  saveChapters: (items: ChapterMemory[]) => void;
  /** Fixe la matière (hub) ; `null` = toutes, avec un sélecteur dans la saisie. */
  subject?: Subject | null;
  /** /memoire : le chapitre dont la courbe est affichée. */
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const today = dayKey(new Date());
  const [showArchived, setShowArchived] = useState(false);
  const [rating, setRating] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const own = useMemo(() => chapters.filter((chapter) => !subject || chapter.subject === subject), [chapters, subject]);
  const active = useMemo(
    () =>
      own
        .filter((chapter) => !chapter.archived)
        .map((chapter) => ({ chapter, retrievability: retrievabilityToday(chapter, today) }))
        .sort((a, b) => a.retrievability - b.retrievability),
    [own, today]
  );
  const archived = own.filter((chapter) => chapter.archived);

  function replace(next: ChapterMemory) {
    saveChapters(chapters.map((chapter) => (chapter.id === next.id ? next : chapter)));
  }

  function rate(chapter: ChapterMemory, value: FsrsRating) {
    replace(rateChapter(chapter, value, today));
    setRating(null);
  }

  return (
    <div className="space-y-5">
      <AddChapterForm subject={subject} today={today} onAdd={(created) => saveChapters([...chapters, created])} />

      {active.length === 0 ? (
        <p className="t-meta">
          {subject ? `Aucun chapitre suivi en ${subject}.` : "Aucun chapitre suivi."} Ajoute ceux que tu as appris : la date d&apos;apprentissage suffit
          pour estimer quand tu risques de les oublier.
        </p>
      ) : (
        <ul className="divide-y divide-line border-y border-line" aria-label="Chapitres suivis">
          {active.map(({ chapter, retrievability }) => {
            const reminder = reminderDay(chapter);
            const selected = selectedId === chapter.id;
            return (
              <li key={chapter.id} className={cn("py-4", selected && "-mx-3 rounded-xl bg-inset px-3")} data-chapter={chapter.title}>
                {editing === chapter.id ? (
                  <EditChapterForm
                    chapter={chapter}
                    today={today}
                    onSave={(patch) => {
                      replace(editChapter(chapter, patch));
                      setEditing(null);
                    }}
                    onCancel={() => setEditing(null)}
                  />
                ) : (
                  <>
                    <div className="flex items-start gap-3">
                      {!subject && (
                        <span className="translate-y-0.5">
                          <SubjectAvatar subject={chapter.subject} size="sm" />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        {onSelect ? (
                          <button
                            type="button"
                            onClick={() => onSelect(chapter.id)}
                            aria-pressed={selected}
                            className="break-words text-left font-semibold text-ink hover:underline"
                          >
                            {chapter.title}
                          </button>
                        ) : (
                          <p className="break-words font-semibold text-ink">{chapter.title}</p>
                        )}
                        <div className="mt-2 flex items-center gap-3">
                          <RetentionBar retrievability={retrievability} className="min-w-0 flex-1 sm:max-w-xs" />
                          <span className="tabular shrink-0 text-2xs font-semibold text-ink">{formatChance(retrievability)}</span>
                        </div>
                        <p className="t-meta mt-1 text-2xs">
                          <span className="sr-only">{chanceSentence(retrievability)}. </span>
                          {reminder <= today ? "À revoir maintenant" : `Prochain rappel ${formatDay(reminder, today)}`} · appris {formatDay(chapter.learnedAt, today)}
                          {chapter.reviews.length > 0 && ` · ${chapter.reviews.length} révision${chapter.reviews.length > 1 ? "s" : ""}`}
                        </p>
                      </div>
                    </div>
                    <div className={cn("mt-3 flex flex-wrap items-center gap-2", !subject && "pl-10")}>
                      <Button variant="secondary" size="sm" onClick={() => setRating(rating === chapter.id ? null : chapter.id)} aria-expanded={rating === chapter.id}>
                        C&apos;est révisé
                      </Button>
                      <AnkiLink deck={chapter.ankiDeck} />
                      <Button variant="ghost" size="sm" onClick={() => setEditing(chapter.id)} aria-label={`Modifier « ${chapter.title} »`}>
                        <Pencil size={13} aria-hidden /> Modifier
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => replace(setArchived(chapter, true))} aria-label={`Ranger « ${chapter.title} »`}>
                        <Archive size={13} aria-hidden /> Ranger
                      </Button>
                    </div>
                    {rating === chapter.id && (
                      <div className={cn(!subject && "pl-10")}>
                        <RatingPanel chapter={chapter} today={today} onRate={(value) => rate(chapter, value)} onCancel={() => setRating(null)} />
                      </div>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {archived.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowArchived((value) => !value)}
            aria-expanded={showArchived}
            className="t-meta inline-flex min-h-8 items-center text-2xs hover:text-ink max-lg:min-h-11"
          >
            {showArchived ? "Masquer" : "Voir"} les chapitres rangés ({archived.length})
          </button>
          {showArchived && (
            <ul className="mt-2 space-y-1">
              {archived.map((chapter) => (
                <li key={chapter.id} className="flex items-center justify-between gap-3 text-[0.8125rem]">
                  <span className="min-w-0 break-words text-muted">
                    {!subject && `${chapter.subject} · `}
                    {chapter.title}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => replace(setArchived(chapter, false))}>
                    <ArchiveRestore size={13} aria-hidden /> Ressortir
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/** La saisie : un titre, une date (aujourd'hui par défaut), un paquet Anki facultatif. */
function AddChapterForm({ subject, today, onAdd }: { subject: Subject | null; today: string; onAdd: (chapter: ChapterMemory) => void }) {
  const [title, setTitle] = useState("");
  const [learnedAt, setLearnedAt] = useState(today);
  const [deck, setDeck] = useState("");
  const [chosen, setChosen] = useState<Subject>(subject ?? subjects[0]);
  const target = subject ?? chosen;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || !learnedAt) return;
    onAdd(createChapter({ subject: target, title, learnedAt: learnedAt > today ? today : learnedAt, ankiDeck: deck }));
    setTitle("");
    setDeck("");
    setLearnedAt(today);
  }

  return (
    <form onSubmit={submit} className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_auto] sm:items-end" aria-label="Ajouter un chapitre">
      <div className="grid gap-2 sm:grid-cols-2">
        {!subject && (
          <label className="block sm:col-span-2">
            <span className="t-meta text-2xs">Matière</span>
            <Select value={chosen} onChange={(event) => setChosen(event.target.value as Subject)} name="subject">
              {subjects.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </Select>
          </label>
        )}
        <label className="block sm:col-span-2">
          <span className="t-meta text-2xs">Chapitre</span>
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={CHAPTER_TITLE_MAX}
            placeholder="Ex. Intégrales généralisées"
            name="title"
            required
          />
        </label>
        <label className="block">
          <span className="t-meta text-2xs">Appris le</span>
          <Input type="date" value={learnedAt} max={today} onChange={(event) => setLearnedAt(event.target.value)} name="learnedAt" required />
        </label>
        <label className="block">
          <span className="t-meta text-2xs">Paquet Anki (facultatif)</span>
          <Input value={deck} onChange={(event) => setDeck(event.target.value)} maxLength={ANKI_DECK_MAX} placeholder="Ex. Maths::Intégrales" name="ankiDeck" />
        </label>
      </div>
      <Button type="submit" disabled={!title.trim()} className="max-sm:w-full">
        <Plus size={15} aria-hidden /> Ajouter
      </Button>
    </form>
  );
}

function EditChapterForm({
  chapter,
  today,
  onSave,
  onCancel,
}: {
  chapter: ChapterMemory;
  today: string;
  onSave: (patch: { title: string; learnedAt: string; ankiDeck: string }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(chapter.title);
  const [learnedAt, setLearnedAt] = useState(chapter.learnedAt);
  const [deck, setDeck] = useState(chapter.ankiDeck ?? "");

  return (
    <form
      className="grid gap-2 sm:grid-cols-2"
      aria-label={`Modifier « ${chapter.title} »`}
      onSubmit={(event) => {
        event.preventDefault();
        if (!title.trim() || !learnedAt) return;
        onSave({ title, learnedAt: learnedAt > today ? today : learnedAt, ankiDeck: deck });
      }}
    >
      <label className="block sm:col-span-2">
        <span className="t-meta text-2xs">Chapitre</span>
        <Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={CHAPTER_TITLE_MAX} required />
      </label>
      <label className="block">
        <span className="t-meta text-2xs">Appris le</span>
        <Input type="date" value={learnedAt} max={today} onChange={(event) => setLearnedAt(event.target.value)} required />
      </label>
      <label className="block">
        <span className="t-meta text-2xs">Paquet Anki</span>
        <Input value={deck} onChange={(event) => setDeck(event.target.value)} maxLength={ANKI_DECK_MAX} />
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" size="sm">
          Enregistrer
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
