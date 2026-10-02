"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, MessageCircleQuestion } from "lucide-react";
import { Illustration } from "@/components/ui/illustrations";
import { PageHero } from "@/components/ui/page-hero";
import { Section } from "@/components/ui/section";
import { SegmentedControl } from "@/components/ui/segmented";
import { Stat, StatRow } from "@/components/ui/stat";
import { Skeleton } from "@/components/ui/state";
import { buttonVariants } from "@/components/ui/button";
import { useAnnales } from "@/hooks/use-annales";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { cn } from "@/lib/cn";
import { PROGRAMME_SUBJECTS } from "@/lib/programme-data";
import {
  buildRetroplanning,
  computeMastery,
  PROGRAMME_STATUS_META,
  PROGRAMME_STATUSES,
  summarizeMastery,
  type ChapterMastery,
  type ProgrammeStatus,
} from "@/lib/programme";
import { dayKey } from "@/lib/study";
import type { Subject } from "@/lib/supabase/types";

/** La couleur EST l'information ici : un statut, une teinte, partout sur l'écran. */
export const STATUS_TONE: Record<ProgrammeStatus, { dot: string; tile: string; text: string }> = {
  solide: { dot: "bg-emerald-400", tile: "border-l-emerald-400", text: "text-emerald-300" },
  "en-cours": { dot: "bg-sky-400", tile: "border-l-sky-400", text: "text-sky-300" },
  fragile: { dot: "bg-rose-400", tile: "border-l-rose-400", text: "text-rose-300" },
  jamais: { dot: "bg-amber-400", tile: "border-l-amber-400", text: "text-amber-300" },
  "pas-vu": { dot: "bg-zinc-400/40", tile: "border-l-transparent", text: "text-subtle" },
};

const SHORT_SUBJECT: Record<string, string> = { Mathématiques: "Maths", Physique: "Physique", Chimie: "Chimie" };
const weekFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
const contestFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

/**
 * /programme — LA CARTE DU PROGRAMME.
 *
 *   1. Le bilan — part de solide parmi ce qui est vu, la légende des statuts.
 *   2. La carte — par matière, sup puis spé, une tuile par chapitre colorée
 *      par son statut (lib/programme.ts), avec sa raison chiffrée.
 *   3. Le rétroplanning — ce qui n'est pas solide, réparti jusqu'au concours.
 *
 * « Vu en cours » est la seule saisie : elle range dans les préférences
 * (synchronisées) un chapitre traité en classe dont il n'y a encore aucune
 * trace. UN SEUL `usePrepahubData()` pour l'écran.
 */
export function ProgrammeOverview() {
  const { chapterMemory, preferences, savePreferences, ready } = usePrepahubData();
  const { logs: annales } = useAnnales();
  const [subject, setSubject] = useState<Subject>("Mathématiques");
  const today = dayKey(new Date());

  const mastery = useMemo(
    () => computeMastery({ chapterMemory, annales, seen: preferences.programmeSeen, today }),
    [chapterMemory, annales, preferences.programmeSeen, today]
  );
  const summary = useMemo(() => summarizeMastery(mastery), [mastery]);
  const plan = useMemo(() => buildRetroplanning(mastery, preferences.contestDate, today), [mastery, preferences.contestDate, today]);

  if (!ready) {
    return (
      <div className="mx-auto max-w-[68rem] space-y-6">
        <Skeleton className="h-24 w-full max-w-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  function toggleSeen(id: string) {
    const seen = preferences.programmeSeen.includes(id) ? preferences.programmeSeen.filter((entry) => entry !== id) : [...preferences.programmeSeen, id];
    savePreferences({ ...preferences, programmeSeen: seen });
  }

  const own = mastery.filter((entry) => entry.chapter.subject === subject);

  return (
    <div className="mx-auto max-w-[68rem] space-y-8 sm:space-y-10">
      <PageHero title="Le programme" lede="Tout le programme MP, coloré par ce que tu sais vraiment." illustration={<Illustration name="revisions" size={56} />} />

      <Section variant="feature" title="Où tu en es">
        <StatRow>
          <Stat
            label="Solide"
            value={summary.solidShare === null ? "—" : `${Math.round(summary.solidShare * 100)} %`}
            detail={`des ${summary.seen} chapitre${summary.seen > 1 ? "s" : ""} vus`}
          />
          <Stat label="À reprendre" value={summary.counts.fragile + summary.counts.jamais} detail={`${summary.counts.fragile} fragile${summary.counts.fragile > 1 ? "s" : ""} · ${summary.counts.jamais} jamais revu${summary.counts.jamais > 1 ? "s" : ""}`} />
          {plan && <Stat label="Concours" value={`J−${plan.daysLeft}`} detail={`le ${contestFormat.format(new Date(`${preferences.contestDate}T12:00:00`))}`} />}
        </StatRow>
        <ul className="mt-6 flex flex-wrap gap-x-4 gap-y-2" aria-label="Légende">
          {PROGRAMME_STATUSES.map((status) => (
            <li key={status} className="inline-flex items-center gap-1.5 text-[0.8125rem] font-bold text-muted">
              <span aria-hidden className={cn("h-2.5 w-2.5 rounded-full", STATUS_TONE[status].dot)} />
              {PROGRAMME_STATUS_META[status].label} · {summary.counts[status]}
            </li>
          ))}
        </ul>
      </Section>

      <div className="space-y-6">
        <SegmentedControl
          ariaLabel="Matière"
          value={subject}
          onChange={setSubject}
          options={PROGRAMME_SUBJECTS.map((entry) => ({ value: entry, label: SHORT_SUBJECT[entry] ?? entry }))}
        />
        {([1, 2] as const).map((year) => {
          const chapters = own.filter((entry) => entry.chapter.year === year);
          return (
            <Section key={year} variant="panel" title={year === 1 ? "Première année (sup)" : "Deuxième année (spé)"} description={yearLine(chapters)}>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {chapters.map((entry) => (
                  <ChapterTile key={entry.chapter.id} entry={entry} onToggleSeen={() => toggleSeen(entry.chapter.id)} />
                ))}
              </ul>
            </Section>
          );
        })}
      </div>

      <Section variant="panel" title="Rétroplanning" description="Ce qui n'est pas solide, du plus fragile au moins fragile, réparti jusqu'au concours.">
        {!preferences.contestDate ? (
          <p className="t-meta">
            Indique la date de ton concours dans les{" "}
            <Link href="/settings" className="text-accent hover:underline">
              Réglages
            </Link>{" "}
            pour obtenir ton plan semaine par semaine.
          </p>
        ) : !plan ? (
          <p className="t-meta">La date de concours renseignée est passée.</p>
        ) : plan.weeks.length === 0 ? (
          <p className="t-meta">Rien à reprendre pour l&apos;instant : tout ce qui est vu est solide.</p>
        ) : (
          <ol className="divide-y divide-line">
            {plan.weeks.map((week, index) => (
              <li key={week.weekStart} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-baseline sm:gap-4">
                <p className="w-36 shrink-0 text-[0.875rem] font-extrabold text-ink">
                  {index === 0 ? "Cette semaine" : `Sem. du ${weekFormat.format(new Date(`${week.weekStart}T12:00:00`))}`}
                </p>
                {week.chapters.length === 0 ? (
                  <p className="t-meta">Relecture générale : fiches, formulaires, erreurs.</p>
                ) : (
                  <ul className="flex flex-wrap gap-1.5">
                    {week.chapters.map((entry) => (
                      <li key={entry.chapter.id} className="inline-flex items-center gap-1.5 rounded-full bg-inset px-2.5 py-1 text-[0.8125rem] font-bold text-ink">
                        <span aria-hidden className={cn("h-2 w-2 rounded-full", STATUS_TONE[entry.status].dot)} />
                        <span className="text-subtle">{SHORT_SUBJECT[entry.chapter.subject]}</span> {entry.chapter.title}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        )}
        {plan && plan.notSeen > 0 && (
          <p className="t-meta mt-3 text-2xs">
            {plan.notSeen} chapitre{plan.notSeen > 1 ? "s" : ""} pas encore vu{plan.notSeen > 1 ? "s" : ""} : hors plan jusqu&apos;à ce qu&apos;ils le soient.
          </p>
        )}
      </Section>
    </div>
  );
}

function yearLine(chapters: ChapterMastery[]): string {
  const solid = chapters.filter((entry) => entry.status === "solide").length;
  const seen = chapters.filter((entry) => entry.status !== "pas-vu").length;
  return `${seen} vu${seen > 1 ? "s" : ""} sur ${chapters.length} · ${solid} solide${solid > 1 ? "s" : ""}`;
}

function ChapterTile({ entry, onToggleSeen }: { entry: ChapterMastery; onToggleSeen: () => void }) {
  const tone = STATUS_TONE[entry.status];
  // « Vu en cours » n'a de sens que tant qu'aucune trace ne le dit déjà.
  const canToggle = entry.status === "pas-vu" || (entry.status === "jamais" && entry.declaredSeen);
  return (
    <li className={cn("well flex min-h-[7.5rem] flex-col rounded-2xl border-l-4 p-4", tone.tile)}>
      <p className="text-[0.9375rem] font-extrabold leading-snug text-ink">{entry.chapter.title}</p>
      <p className={cn("mt-1 text-2xs font-bold", tone.text)}>
        {PROGRAMME_STATUS_META[entry.status].label}
        <span className="font-semibold text-subtle"> · {entry.reason}</span>
      </p>
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
        {canToggle && (
          <button
            type="button"
            onClick={onToggleSeen}
            aria-pressed={entry.declaredSeen}
            className={cn(
              "inline-flex min-h-8 items-center gap-1 rounded-full px-3 text-2xs font-bold transition-colors max-lg:min-h-10",
              entry.declaredSeen ? "bg-amber-400/[0.16] text-amber-300" : "bg-inset text-muted hover:text-ink"
            )}
          >
            {entry.declaredSeen && <Check size={12} aria-hidden />} Vu en cours
          </button>
        )}
        {entry.status !== "pas-vu" && entry.chapter.questions.length > 0 && (
          <Link href={`/kholle?chapitre=${encodeURIComponent(entry.chapter.id)}`} className={cn(buttonVariants({ variant: "link", size: "sm" }), "min-h-8 px-0 text-2xs")}>
            <MessageCircleQuestion size={12} aria-hidden /> M&apos;interroger
          </Link>
        )}
      </div>
    </li>
  );
}
