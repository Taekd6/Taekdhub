"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarCheck, Check, ListChecks, Plus, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RatingPanel, RetentionBar, formatDay } from "@/components/memory/memory-bits";
import { cn } from "@/lib/cn";
import { CHAPTER_TITLE_MAX, createChapter, formatChance, rateChapter } from "@/lib/chapter-memory";
import { EXAM_SCOPE_MAX, buildExamPrep, scopeIds, withScope, type ChapterReadiness, type ExamPrep } from "@/lib/exam-prep";
import { dayKey } from "@/lib/study";
import { dayDiff } from "@/lib/fsrs";
import { formatMinutesSpan } from "@/lib/utils";
import type { FsrsRating } from "@/lib/fsrs";
import type { ChapterMemory, ErrorEntry, ReviewItem, WorkItem } from "@/lib/storage";
import type { WorkSession } from "@/lib/supabase/types";

/**
 * « PRÊT POUR LE DS ? » — voir lib/exam-prep.ts pour le calcul.
 *
 * Trois temps, dans l'ordre où l'élève se pose les questions :
 *
 *   1. LE PROGRAMME — quels chapitres ? Choisis parmi ceux de la Mémoire de
 *      la matière ; un chapitre absent s'ajoute ici même (titre + date où il
 *      a été vu), pour ne pas renvoyer l'élève ailleurs au milieu du geste.
 *   2. OÙ J'EN SUIS — pour chaque chapitre, la chance de le retrouver sans
 *      ses notes aujourd'hui et LE JOUR J, et ce qu'un rappel aujourd'hui y
 *      changerait. Le plus menacé d'abord. « Rappel » ouvre le chrono sur le
 *      chapitre ; « C'est révisé » note la révision (FSRS) sur place.
 *   3. LE PLAN — les rappels répartis jusqu'à la veille, et la veille, la
 *      relecture des erreurs.
 *
 * Le chiffre n'est JAMAIS présenté comme une note prédite : c'est une
 * probabilité de rappel, et la phrase sous le grand nombre le dit.
 */
export function ExamPrepPanel({
  item,
  chapterMemory,
  errors,
  reviewItems,
  sessions,
  onSaveItem,
  onSaveChapters,
  showTitle = true,
}: {
  item: WorkItem;
  chapterMemory: ChapterMemory[];
  errors: ErrorEntry[];
  reviewItems: ReviewItem[];
  sessions: WorkSession[];
  onSaveItem: (item: WorkItem) => void;
  onSaveChapters: (chapters: ChapterMemory[]) => void;
  /** Faux dans un dialogue qui porte déjà le titre de l'épreuve. */
  showTitle?: boolean;
}) {
  const now = new Date();
  const today = dayKey(now);
  const prep = useMemo(
    () => buildExamPrep(item, { chapterMemory, errors, reviewItems, sessions }, now),
    // `now` change à chaque rendu : la journée suffit comme dépendance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [item, chapterMemory, errors, reviewItems, sessions, today]
  );
  const [editing, setEditing] = useState(false);

  if (!prep) {
    return <p className="t-meta">Donne une date à cette épreuve pour préparer son programme.</p>;
  }

  const hasScope = scopeIds(item).length > 0;

  function rate(chapterId: string, rating: FsrsRating) {
    onSaveChapters(chapterMemory.map((chapter) => (chapter.id === chapterId ? rateChapter(chapter, rating, today) : chapter)));
  }

  return (
    <div className="space-y-6">
      {showTitle && (
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3 className="t-heading">{item.title}</h3>
          <p className="t-meta">{whenLabel(prep.daysLeft, prep.examDay)}</p>
        </div>
      )}

      {!editing && !hasScope ? (
        <div className="space-y-3">
          <p className="text-sm text-ink">Indique les chapitres au programme : TaekdHub te dira ce que ta mémoire en gardera le jour J, et quoi réviser d&apos;ici là.</p>
          <Button size="sm" onClick={() => setEditing(true)}>
            <ListChecks size={15} aria-hidden /> Choisir le programme
          </Button>
        </div>
      ) : editing ? (
        <ScopeEditor
          item={item}
          chapterMemory={chapterMemory}
          today={today}
          onCancel={hasScope ? () => setEditing(false) : undefined}
          onSave={(ids, created) => {
            if (created.length > 0) onSaveChapters([...chapterMemory, ...created]);
            onSaveItem(withScope(item, ids));
            setEditing(false);
          }}
        />
      ) : (
        <>
          <Summary prep={prep} />
          <ChapterRows prep={prep} today={today} onRate={rate} />
          <Plan prep={prep} today={today} />
          <Extras prep={prep} />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Button variant="link" size="sm" onClick={() => setEditing(true)}>
              <ListChecks size={15} aria-hidden /> Modifier le programme
            </Button>
            {prep.missing > 0 && (
              <span className="t-meta text-2xs">
                {prep.missing} chapitre{prep.missing > 1 ? "s" : ""} du programme rangé{prep.missing > 1 ? "s" : ""} ou supprimé{prep.missing > 1 ? "s" : ""} — ignoré{prep.missing > 1 ? "s" : ""}.
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function whenLabel(daysLeft: number, examDay: string): string {
  if (daysLeft === 0) return "Aujourd'hui";
  if (daysLeft === 1) return "Demain";
  const [year, month, date] = examDay.split("-").map(Number);
  const label = new Date(year, month - 1, date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  return `Dans ${daysLeft} jours · ${label}`;
}

function Summary({ prep }: { prep: ExamPrep }) {
  if (prep.expectedOnExam === null) {
    return <p className="t-meta">Aucun des chapitres choisis n&apos;est encore suivi. Modifie le programme pour en choisir d&apos;autres.</p>;
  }
  const onExam = Math.round(prep.expectedOnExam * 100);
  const todayValue = Math.round((prep.expectedToday ?? 0) * 100);
  return (
    <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-8">
      <div>
        <p className="t-label">Le jour J, sans révision</p>
        <p className="t-figure-lg tabular" data-testid="exam-expected">
          ≈ {onExam} %
        </p>
      </div>
      <div className="space-y-1.5">
        <p className="text-sm text-ink">
          {prep.toConsolidate === 0
            ? "Tous les chapitres du programme tiennent jusqu'au jour J."
            : `${prep.toConsolidate} chapitre${prep.toConsolidate > 1 ? "s" : ""} sur ${prep.chapters.length} passerai${prep.toConsolidate > 1 ? "ent" : "t"} sous 90 % d'ici là.`}
        </p>
        <p className="t-meta text-2xs">
          Chance moyenne de retrouver chaque chapitre sans tes notes ({todayValue} % aujourd&apos;hui), d&apos;après tes rappels notés dans Mémoire. Ce n&apos;est pas une note prédite.
        </p>
      </div>
    </div>
  );
}

function ChapterRows({ prep, today, onRate }: { prep: ExamPrep; today: string; onRate: (chapterId: string, rating: FsrsRating) => void }) {
  const [rating, setRating] = useState<string | null>(null);
  return (
    <ul className="divide-y divide-hairline/[0.07]" aria-label="Chapitres au programme">
      {prep.chapters.map((entry) => (
        <li key={entry.chapter.id} className="py-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{entry.chapter.title}</p>
              <p className="t-meta text-2xs">{rowDetail(entry, today)}</p>
            </div>
            <span className={cn("tabular shrink-0 text-sm font-bold", LEVEL_INK[entry.level])}>{formatChance(entry.onExam)}</span>
          </div>
          <RetentionBar retrievability={entry.onExam} className="mt-2" />
          {rating === entry.chapter.id ? (
            <RatingPanel
              chapter={entry.chapter}
              today={today}
              onRate={(value) => {
                onRate(entry.chapter.id, value);
                setRating(null);
              }}
              onCancel={() => setRating(null)}
            />
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              {entry.reviewedToday ? (
                <span className="t-meta inline-flex items-center gap-1 text-2xs">
                  <Check size={13} aria-hidden /> Révisé aujourd&apos;hui
                </span>
              ) : (
                <>
                  <Link
                    href={`/timer?matiere=${encodeURIComponent(entry.chapter.subject)}&chapitre=${encodeURIComponent(entry.chapter.id)}`}
                    className="inline-flex min-h-8 items-center gap-1 text-2xs font-semibold text-accent hover:underline max-lg:min-h-11"
                  >
                    <Timer size={13} aria-hidden /> Rappel au chrono
                  </Link>
                  <button
                    type="button"
                    onClick={() => setRating(entry.chapter.id)}
                    className="inline-flex min-h-8 items-center text-2xs font-semibold text-muted hover:text-ink max-lg:min-h-11"
                  >
                    C&apos;est révisé
                  </button>
                </>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

const LEVEL_INK: Record<ChapterReadiness["level"], string> = {
  solide: "text-emerald-500",
  "à consolider": "text-amber-500",
  fragile: "text-rose-500",
};

function rowDetail(entry: ChapterReadiness, today: string): string {
  const parts = [`${formatChance(entry.today)} aujourd'hui`];
  if (!entry.reviewedToday && entry.ifReviewedToday - entry.onExam >= 0.02) parts.push(`${formatChance(entry.ifReviewedToday)} le jour J avec un rappel aujourd'hui`);
  parts.push(entry.chapter.reviews.length > 0 ? `dernier rappel ${formatDay(entry.lastRecallDay, today)}` : `vu ${formatDay(entry.lastRecallDay, today)}, jamais rappelé`);
  if (entry.minutesTotal > 0) parts.push(`${formatMinutesSpan(entry.minutesTotal)} au chrono`);
  return parts.join(" · ");
}

function Plan({ prep, today }: { prep: ExamPrep; today: string }) {
  if (prep.plan.length === 0) {
    if (prep.daysLeft === 0) return <p className="t-meta">C&apos;est aujourd&apos;hui : relis tes erreurs et fais confiance au travail déjà fait.</p>;
    return null;
  }
  return (
    <div>
      <p className="t-label mb-2 inline-flex items-center gap-1.5">
        <CalendarCheck size={14} aria-hidden /> Plan jusqu&apos;au jour J
      </p>
      <ol className="space-y-2" aria-label="Plan de révision">
        {prep.plan.map((step) => (
          <li key={`${step.day}-${step.kind}`} className="flex gap-3 text-sm">
            <span className="t-meta w-28 shrink-0 first-letter:uppercase">{planDay(step.day, today)}</span>
            <span className="min-w-0 text-ink">
              {step.kind === "rappel"
                ? `Rappel actif : ${step.chapters.map((chapter) => chapter.title).join(", ")}`
                : `Relire tes ${prep.recentErrors} erreur${prep.recentErrors > 1 ? "s" : ""} récente${prep.recentErrors > 1 ? "s" : ""} de la matière`}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** « aujourd'hui », « demain », puis le jour de la semaine (« jeudi 1 oct. ») — le plan tient en une semaine ou trois. */
function planDay(day: string, today: string): string {
  const offset = dayDiff(today, day);
  if (offset === 0) return "aujourd'hui";
  if (offset === 1) return "demain";
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "short" });
}

function Extras({ prep }: { prep: ExamPrep }) {
  if (!prep.subject || (prep.unfixedErrors.length === 0 && prep.dueCards === 0)) return null;
  const subject = encodeURIComponent(prep.subject);
  return (
    <div className="flex flex-wrap gap-2">
      {prep.unfixedErrors.length > 0 && (
        <Link href={`/preparation?subject=${subject}#erreurs`} className="row-hover rounded-full border border-line px-3 py-1.5 text-2xs text-muted hover:text-ink max-lg:min-h-11 max-lg:py-3">
          {prep.unfixedErrors.length} erreur{prep.unfixedErrors.length > 1 ? "s" : ""} sans « bonne idée » à compléter
        </Link>
      )}
      {prep.dueCards > 0 && (
        <Link href={`/revoir/session?subject=${subject}`} className="row-hover rounded-full border border-line px-3 py-1.5 text-2xs text-muted hover:text-ink max-lg:min-h-11 max-lg:py-3">
          {prep.dueCards} carte{prep.dueCards > 1 ? "s" : ""} à revoir aujourd&apos;hui
        </Link>
      )}
    </div>
  );
}

/**
 * Choix du programme : les chapitres suivis de la matière (les autres
 * matières sous un repli — un concours blanc peut en mêler plusieurs), et
 * l'ajout d'un chapitre manquant.
 */
function ScopeEditor({
  item,
  chapterMemory,
  today,
  onSave,
  onCancel,
}: {
  item: WorkItem;
  chapterMemory: ChapterMemory[];
  today: string;
  onSave: (chapterIds: string[], created: ChapterMemory[]) => void;
  onCancel?: () => void;
}) {
  const [selected, setSelected] = useState<string[]>(() => scopeIds(item));
  const [created, setCreated] = useState<ChapterMemory[]>([]);
  const [title, setTitle] = useState("");
  const [learnedAt, setLearnedAt] = useState(today);
  const [showOthers, setShowOthers] = useState(false);

  const available = [...chapterMemory, ...created].filter((chapter) => !chapter.archived);
  const own = available.filter((chapter) => !item.subject || chapter.subject === item.subject);
  const others = available.filter((chapter) => item.subject && chapter.subject !== item.subject);
  const full = selected.length >= EXAM_SCOPE_MAX;

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((value) => value !== id) : full ? current : [...current, id]));
  }

  function addChapter(event: React.FormEvent) {
    event.preventDefault();
    const clean = title.trim();
    if (!clean || full) return;
    const chapter = createChapter({ subject: item.subject ?? "Mathématiques", title: clean, learnedAt: learnedAt && learnedAt <= today ? learnedAt : today });
    setCreated((current) => [...current, chapter]);
    setSelected((current) => [...current, chapter.id]);
    setTitle("");
  }

  const checklist = (chapters: ChapterMemory[]) => (
    <ul className="space-y-1">
      {chapters.map((chapter) => (
        <li key={chapter.id}>
          <label className="row-hover flex min-h-10 cursor-pointer items-center gap-3 rounded-xl px-2 text-sm max-lg:min-h-11">
            <input
              type="checkbox"
              checked={selected.includes(chapter.id)}
              disabled={full && !selected.includes(chapter.id)}
              onChange={() => toggle(chapter.id)}
              className="h-4 w-4 accent-[rgb(var(--accent-ink-rgb))]"
            />
            <span className="min-w-0 flex-1 truncate text-ink">{chapter.title}</span>
            {item.subject && chapter.subject !== item.subject && <span className="t-meta text-2xs">{chapter.subject}</span>}
          </label>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-ink">Sur quels chapitres porte cette épreuve ?</p>
        <p className="t-meta text-2xs">
          TaekdHub lira, pour chacun, ce que ta mémoire en gardera le jour J, et te proposera un plan de rappels.
        </p>
      </div>

      {own.length > 0 ? checklist(own) : <p className="t-meta">Aucun chapitre suivi {item.subject ? `en ${item.subject}` : ""} pour l&apos;instant : ajoute ceux du programme ci-dessous.</p>}

      {others.length > 0 && (
        <div>
          <button type="button" onClick={() => setShowOthers((value) => !value)} className="t-meta text-2xs hover:text-ink max-lg:min-h-11" aria-expanded={showOthers}>
            {showOthers ? "Masquer" : "Afficher"} les chapitres des autres matières ({others.length})
          </button>
          {showOthers && <div className="mt-1">{checklist(others)}</div>}
        </div>
      )}

      <form onSubmit={addChapter} className="flex flex-wrap items-end gap-2" aria-label="Ajouter un chapitre au programme">
        <label className="min-w-0 flex-1 basis-[12rem]">
          <span className="t-label mb-1 block text-2xs">Chapitre manquant</span>
          <Input value={title} maxLength={CHAPTER_TITLE_MAX} onChange={(event) => setTitle(event.target.value)} placeholder="Séries entières…" autoComplete="off" />
        </label>
        <label className="w-40">
          <span className="t-label mb-1 block text-2xs">Vu en cours le</span>
          <Input type="date" value={learnedAt} max={today} onChange={(event) => setLearnedAt(event.target.value)} />
        </label>
        <Button type="submit" variant="secondary" size="sm" disabled={!title.trim() || full}>
          <Plus size={14} aria-hidden /> Ajouter
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={() => onSave(selected, created.filter((chapter) => selected.includes(chapter.id)))}>
          {selected.length === 0 ? "Enregistrer sans programme" : `Enregistrer le programme (${selected.length})`}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Annuler
          </Button>
        )}
      </div>
    </div>
  );
}
