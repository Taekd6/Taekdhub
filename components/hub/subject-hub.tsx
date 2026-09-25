"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, type CSSProperties } from "react";
import { ArrowRight, BookOpen, ChevronLeft, Copy, LayoutGrid, PenLine, Timer } from "lucide-react";
import { Section } from "@/components/ui/section";
import { Tabs } from "@/components/ui/tabs";
import { ChapterNav } from "@/components/ui/chapter-nav";
import { PageHero } from "@/components/ui/page-hero";
import { Illustration, SubjectIllustration } from "@/components/ui/illustrations";
import { Meter, Ring } from "@/components/ui/progress";
import { GradientCard } from "@/components/ui/gradient-card";
import { ActionButtons, type ActionItem } from "@/components/ui/action-buttons";
import { CountUp } from "@/components/ui/count-up";
import { DateBadge, ScoreBadge } from "@/components/ui/list-card";
import { SUBJECT_CARD_NAME, SUBJECT_GLYPH } from "@/components/home/cards";
import { dueReviewItems } from "@/lib/spaced-repetition";
import { VolumeBars } from "@/components/ui/chart";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/state";

import { SubjectTargetList } from "@/components/work/subject-targets";
import { ReviewCapture, ReviewList } from "@/components/review/review-capture";
import { DueToday } from "@/components/review/due-today";
/* ── Mémoire des chapitres (FSRS) ── */
import { SubjectChapters } from "@/components/memory/subject-chapters";
/* ── fin ── */
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { buildSubjectHub, hubSubjects, HUB_RECENT_DAYS, HUB_WINDOW_DAYS, type HubSubjectModel } from "@/lib/hub";
import { describeConfidence } from "@/lib/analytics/trend";
import { formatAverage, formatGrade, GRADE_KIND_META, isScored } from "@/lib/grades";
import { countByType, ERROR_SOURCE_META, ERROR_TYPE_META, errorLogHref, sortErrors } from "@/lib/error-log";
import { methodsFor, selectReviewItems } from "@/lib/review-items";
import { computePeriodTotals } from "@/lib/tracking";
import { subjects as allSubjects } from "@/lib/study";
import { formatMinutesSpan, formatSpan } from "@/lib/utils";
import { cn } from "@/lib/cn";
import type { ErrorEntry, Grade, ReviewItem } from "@/lib/storage";
import type { Subject, WorkSession } from "@/lib/supabase/types";

/**
 * SUIVI PAR MATIÈRE — une galerie, puis une page par matière.
 *
 * AUCUN EXERCICE : l'élève travaille sur ses propres feuilles, TaekdHub ne
 * connaît que ce qu'il y consigne. L'écran dit donc, matière par matière, le
 * temps réellement mis et le budget de la semaine, ce qui arrive (échéances),
 * ce qu'il reste à revoir (carnet et cartouches), ce qui revient dans les
 * erreurs, et ce qu'un professeur en a dit (notes).
 *
 * REFONTE « APPLE ». L'ancien écran était une seule colonne dont la moitié
 * haute était un sélecteur de lettres (« M · P · C · IT »). Désormais :
 *
 *   /preparation               la GALERIE : une tuile illustrée par matière
 *                              suivie, avec l'essentiel (temps de la
 *                              semaine, budget, ce qui attend). On voit
 *                              tout d'un coup d'œil et chaque tuile donne
 *                              envie d'entrer.
 *   /preparation?subject=…     la PAGE d'une matière : la rangée illustrée
 *                              des matières en haut (`ChapterNav`) pour
 *                              passer de l'une à l'autre, la CARTE-HÉROS en
 *                              dégradé (temps de la semaine face au budget,
 *                              révisions dues, moyenne), les quatre gestes
 *                              en boutons ronds (Chrono · Noter · Réviser ·
 *                              Chapitres), et les onglets ancrés dans l'URL —
 *                              `#apercu`, `#revoir`, `#chapitres`,
 *                              `#erreurs`, `#notes`.
 *
 * STYLE « REVOLUT CLAIR » (le même que l'accueil) : la galerie est faite de
 * cartes en DÉGRADÉ, tons cyclés (carte 1, 2, 3, 4, 1…) — la couleur dit
 * « carte suivante », jamais « c'est les maths » ; la matière ouverte garde
 * le ton de sa carte dans la galerie, pour qu'on la « reconnaisse » en entrant.
 *
 * La matière vient de l'URL (`useSearchParams`) : un lien partagé, le bouton
 * précédent et l'accueil (« ?subject= ») ouvrent tous la bonne page. La page
 * monte ce composant sous <Suspense>.
 *
 * UN SEUL `usePrepahubData()` pour tout l'écran. Toutes les valeurs affichées
 * viennent de lib/hub.ts, qui ne fait que composer des moteurs existants —
 * aucune statistique n'est née ici.
 */
export function SubjectHub() {
  const { sessions, workItems, grades, reviewItems, errors, preferences, ready, saveReviewItems, chapterMemory, saveChapterMemory } = usePrepahubData();
  const searchParams = useSearchParams();
  const wanted = searchParams.get("subject");
  const active = wanted && (allSubjects as string[]).includes(wanted) ? (wanted as Subject) : null;

  const available = useMemo(
    () => hubSubjects(sessions, workItems, grades, preferences, allSubjects),
    [sessions, workItems, grades, preferences]
  );
  const models = useMemo(
    () => new Map(available.map((subject) => [subject, buildSubjectHub(subject, sessions, workItems, grades, preferences)])),
    [available, sessions, workItems, grades, preferences]
  );
  const activeModel = useMemo(
    () => (active ? (models.get(active) ?? buildSubjectHub(active, sessions, workItems, grades, preferences)) : null),
    [active, models, sessions, workItems, grades, preferences]
  );

  if (!ready) return <HubSkeleton />;

  if (!active || !activeModel) {
    return <HubLanding available={available} models={models} reviewItems={reviewItems} />;
  }

  // La matière ouverte reste dans la rangée même si elle n'a encore rien à
  // suivre (lien direct vers une matière vide) : sinon aucune vignette ne
  // serait allumée.
  const navSubjects = available.includes(active) ? available : [...available, active];
  const tone = Math.max(0, navSubjects.indexOf(active));
  const dueCount = dueReviewItems(reviewItems, new Date(), active).length;

  return (
    <div className="mx-auto max-w-[68rem] space-y-8 sm:space-y-10">
      <ChapterNav
        ariaLabel="Matières"
        activeHref={subjectHref(active)}
        items={[
          { href: "/preparation", label: "Toutes", icon: <LayoutGrid size={30} strokeWidth={1.5} aria-hidden /> },
          ...navSubjects.map((subject) => ({ href: subjectHref(subject), label: shortName(subject), icon: <SubjectIllustration subject={subject} size={40} /> })),
        ]}
      />

      <div className="grid gap-7 lg:grid-cols-12 lg:items-center lg:gap-10">
        <SubjectHero subject={active} model={activeModel} tone={tone} due={dueCount} className="lg:col-span-7" />
        <div className="reveal lg:col-span-5" style={{ "--i": 2 } as CSSProperties}>
          <ActionButtons items={subjectActions(active)} className="lg:mx-auto lg:max-w-md" />
        </div>
      </div>

      {/* `key` : changer de matière remet l'onglet d'ouverture à zéro, comme
          une nouvelle page — l'ancre, elle, est effacée par le lien. */}
      <Tabs
        key={active}
        syncHash
        ariaLabel={`Suivi de ${active}`}
        items={[
          {
            id: "apercu",
            label: "Aperçu",
            content: <Overview subject={active} model={activeModel} sessions={sessions} />,
          },
          {
            id: "revoir",
            label: "À revoir",
            content: <ReviewTab subject={active} reviewItems={reviewItems} saveReviewItems={saveReviewItems} ready={ready} />,
          },
          /* ── Mémoire des chapitres (FSRS) — onglet ── */
          {
            id: "chapitres",
            label: "Chapitres",
            content: <SubjectChapters subject={active} chapters={chapterMemory} saveChapters={saveChapterMemory} />,
          },
          /* ── fin ── */
          {
            id: "erreurs",
            label: "Erreurs",
            content: <ErrorsTab subject={active} errors={errors} />,
          },
          {
            id: "notes",
            label: "Notes",
            content: <GradesTab subject={active} model={activeModel} grades={grades} />,
          },
        ]}
      />
    </div>
  );
}

/**
 * Les quatre gestes d'une matière, en boutons ronds sous la carte-héros —
 * la même rangée que l'accueil. Le chrono en dégradé ; « Noter » ouvre la
 * saisie d'une note (Progression, onglet Notes) ; « Réviser » lance la
 * séance du jour FILTRÉE sur la matière ; « Chapitres » ouvre l'onglet de
 * la page (`Tabs` suit l'ancre).
 */
function subjectActions(subject: Subject): ActionItem[] {
  return [
    { label: "Chrono", icon: Timer, href: "/timer", primary: true },
    { label: "Noter", icon: PenLine, href: "/progress#notes" },
    { label: "Réviser", icon: Copy, href: `/revoir/session?subject=${encodeURIComponent(subject)}` },
    { label: "Chapitres", icon: BookOpen, href: "#chapitres" },
  ];
}

/**
 * LA CARTE-HÉROS D'UNE MATIÈRE — en dégradé, du ton de sa carte dans la
 * galerie : le signe de la matière, son nom, le temps de la semaine en très
 * grand (il compte jusqu'à sa valeur), l'anneau blanc du budget, puis trois
 * pastilles de verre — révisions dues, moyenne, échéances.
 */
function SubjectHero({
  subject,
  model,
  tone,
  due,
  className,
}: {
  subject: Subject;
  model: HubSubjectModel;
  tone: number;
  due: number;
  className?: string;
}) {
  const { target, workload } = model;
  const weekMinutes = target ? target.doneMinutes : workload.recentMinutes;
  const deadlines = model.deadlines.length;
  return (
    <GradientCard tone={tone} tilt={false} className={cn("reveal p-5 sm:p-7", className)} style={{ "--i": 1 } as CSSProperties}>
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/preparation"
          className="inline-flex min-h-9 items-center gap-1 rounded-full bg-white/20 py-1 pl-2 pr-3.5 text-[0.8125rem] font-extrabold text-white transition-colors hover:bg-white/30 max-lg:min-h-11"
        >
          <ChevronLeft size={16} strokeWidth={2.6} aria-hidden /> Matières
        </Link>
        <span aria-hidden className="t-glyph whitespace-nowrap opacity-90">
          {SUBJECT_GLYPH[subject]}
        </span>
      </div>
      <div className="mt-5 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="t-title">{subject}</h1>
          <p className="t-card-figure mt-2 whitespace-nowrap">
            <span className="sr-only">{formatSpan(weekMinutes * 60)} {target ? "cette semaine" : `ces ${HUB_RECENT_DAYS} jours`}</span>
            <span aria-hidden>
              <CountUp value={weekMinutes} duration={1400} format={(value) => formatSpan(value * 60)} />
            </span>
          </p>
          <p className="mt-1.5 text-[0.8125rem] font-bold opacity-80">
            {target ? `cette semaine · sur ${formatMinutesSpan(target.targetMinutes)}` : `ces ${HUB_RECENT_DAYS} jours · pas de budget`}
          </p>
        </div>
        {target && (
          <Ring value={target.percent} size={88} strokeWidth={8} variant="white">
            <span className="text-base font-black tabular">{target.percent}%</span>
          </Ring>
        )}
      </div>
      <ul className="mt-5 flex flex-wrap gap-2 text-[0.8125rem] font-extrabold">
        <li className="rounded-full bg-white/20 px-3 py-1.5">
          <span className="tabular">{due}</span> à réviser aujourd&apos;hui
        </li>
        {model.grades.average !== null && (
          <li className="rounded-full bg-white/20 px-3 py-1.5">
            moy. <span className="tabular">{formatAverage(model.grades.average)}</span>
          </li>
        )}
        <li className="rounded-full bg-white/20 px-3 py-1.5">
          <span className="tabular">{deadlines}</span> échéance{deadlines > 1 ? "s" : ""}
        </li>
      </ul>
    </GradientCard>
  );
}

function subjectHref(subject: Subject): string {
  return `/preparation?subject=${encodeURIComponent(subject)}`;
}

/** Libellé court d'une vignette : « Informatique TC » ne tient pas sous un dessin de 40 px. */
function shortName(subject: Subject): string {
  if (subject === "Mathématiques") return "Maths";
  if (subject === "Informatique TC") return "Info TC";
  if (subject === "Informatique Spé") return "Info Spé";
  return subject;
}

function HubSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-24 w-80" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-64 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   LA GALERIE
   ══════════════════════════════════════════════════════════════════ */

/**
 * Une CARTE EN DÉGRADÉ par matière suivie (tons cyclés, comme la galerie de
 * l'accueil) — le signe, l'anneau blanc du budget, le nom, le temps de la
 * semaine qui compte jusqu'à sa valeur, et ce qui attend (échéances,
 * carnet). La carte entière est un lien ; elle flotte, s'incline au survol,
 * et entre en cascade au chargement.
 */
function HubLanding({
  available,
  models,
  reviewItems,
}: {
  available: Subject[];
  models: Map<Subject, HubSubjectModel>;
  reviewItems: ReviewItem[];
}) {
  return (
    <div className="mx-auto max-w-[68rem] space-y-8 sm:space-y-10">
      <PageHero title="Tes matières" lede="Ta semaine, matière par matière." illustration={<Illustration name="notes" size={48} />} />

      {available.length === 0 ? (
        <EmptyState
          illustration={<SubjectIllustration subject="Mathématiques" size={56} />}
          title="Aucune matière à suivre pour l'instant."
          description="Le suivi se remplit dès la première séance enregistrée, ou dès qu'un budget hebdomadaire est fixé dans Réglages."
          action={
            <Link href="/settings#budgets" className={buttonVariants({ variant: "secondary" })}>
              Fixer un budget
            </Link>
          }
        />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 lg:gap-5">
          {available.map((subject, index) => {
            const model = models.get(subject);
            if (!model) return null;
            const open = selectReviewItems(reviewItems, { subject, openOnly: true }).length;
            const deadlines = model.deadlines.length;
            const target = model.target;
            const minutes = target ? target.doneMinutes : model.workload.recentMinutes;
            const waiting = [deadlines > 0 && `${deadlines} échéance${deadlines > 1 ? "s" : ""}`, open > 0 && `${open} à revoir`].filter(Boolean).join(" · ");
            return (
              <li key={subject} className="reveal" style={{ "--i": index } as CSSProperties}>
                <GradientCard
                  tone={index}
                  index={index}
                  float
                  href={subjectHref(subject)}
                  aria-label={`${subject} — ${formatSpan(minutes * 60)} ${target ? `cette semaine sur ${formatMinutesSpan(target.targetMinutes)}` : `ces ${HUB_RECENT_DAYS} jours`}${waiting ? `, ${waiting}` : ""}`}
                  wrapperClassName="h-full"
                  className="flex h-full min-h-[12.5rem] flex-col justify-between p-4 sm:min-h-[13.5rem] sm:p-5"
                >
                  <span aria-hidden className="flex items-start justify-between gap-2">
                    <span className="t-glyph whitespace-nowrap">{SUBJECT_GLYPH[subject]}</span>
                    {target && (
                      <Ring value={target.percent} size={44} strokeWidth={5} variant="white">
                        <span className="text-[0.625rem] font-black tabular">{target.percent}%</span>
                      </Ring>
                    )}
                  </span>
                  <span aria-hidden className="mt-4 block min-w-0">
                    <span className="block truncate text-base font-extrabold">{SUBJECT_CARD_NAME[subject]}</span>
                    <span className="block whitespace-nowrap text-2xl font-black tabular tracking-[-0.02em] sm:text-3xl">
                      <CountUp value={minutes} format={(value) => formatSpan(value * 60)} />
                    </span>
                    <span className="block truncate text-xs font-bold opacity-80">
                      {target ? `sur ${formatMinutesSpan(target.targetMinutes)}` : `ces ${HUB_RECENT_DAYS} jours`}
                    </span>
                    <span className="mt-2.5 flex flex-wrap gap-1 text-[0.6875rem] font-extrabold">
                      {deadlines > 0 && <span className="rounded-full bg-white/20 px-2 py-0.5">{deadlines} éch.</span>}
                      {open > 0 && <span className="rounded-full bg-white/20 px-2 py-0.5">{open} à revoir</span>}
                      {model.grades.average !== null && <span className="rounded-full bg-white/20 px-2 py-0.5">moy. {formatAverage(model.grades.average)}</span>}
                    </span>
                  </span>
                </GradientCard>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   LA PAGE D'UNE MATIÈRE — quatre onglets
   ══════════════════════════════════════════════════════════════════ */

const DAY_MONTH = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });

/** Un chiffre dans un creux gris — en 900, arrondi, comme les tuiles de l'accueil. */
function Figure({ label, value, detail }: { label: string; value: React.ReactNode; detail?: string }) {
  return (
    <div className="well min-w-0 p-4 sm:p-5">
      <p className="text-[0.8125rem] font-bold text-muted">{label}</p>
      <p className="t-stat mt-1 whitespace-nowrap text-ink">{value}</p>
      {detail && <p className="t-meta mt-1 text-2xs">{detail}</p>}
    </div>
  );
}

/** VUE D'ENSEMBLE — le temps (7 j, 30 j, la figure du mois), le budget, les échéances. */
function Overview({ subject, model, sessions }: { subject: Subject; model: HubSubjectModel; sessions: WorkSession[] }) {
  const { workload, target, deadlines } = model;
  const rhythm = describeConfidence(workload.trend);
  // La figure du mois : le même moteur que l'écran Progression, sur les
  // seules séances de la matière.
  const month = useMemo(() => computePeriodTotals(sessions.filter((session) => session.subject === subject), "30j", new Date()), [sessions, subject]);
  const bars = month.points.map((point, index) => ({
    id: point.key,
    label: (month.points.length - 1 - index) % 5 === 0 ? String(point.start.getDate()) : "",
    title: point.start.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }),
    minutes: point.minutes,
  }));

  return (
    <div className="space-y-5">
      <Section variant="panel" title="Temps de travail">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Figure label={`Ces ${HUB_RECENT_DAYS} jours`} value={formatSpan(workload.recentMinutes * 60)} />
          <Figure
            label={`Sur ${HUB_WINDOW_DAYS} jours`}
            value={formatSpan(workload.windowMinutes * 60)}
            detail={workload.sharePercent !== null ? `${workload.sharePercent} % de ton temps` : undefined}
          />
          <div className="col-span-2 sm:col-span-1">
            <Figure label="Jours actifs" value={workload.activeDaysThisWeek} detail="cette semaine, toutes matières" />
          </div>
        </div>

        {month.minutes > 0 && (
          <VolumeBars
            className="mt-8"
            bars={bars}
            formatValue={(minutes) => formatSpan(minutes * 60)}
            ariaLabel={`${subject}, temps travaillé sur 30 jours : ${bars.map((bar) => `${bar.title} ${formatSpan(bar.minutes * 60)}`).join(", ")}.`}
          />
        )}

        <p className="t-meta mt-5">
          {workload.trend.direction !== "insuffisant"
            ? `Sur les semaines mesurées, ton volume en ${subject} est ${workload.trend.direction === "stable" ? "stable" : `en ${workload.trend.direction}`}.${rhythm ? ` ${rhythm}` : ""}`
            : "Pas encore assez de semaines mesurées pour qualifier un rythme dans cette matière."}
        </p>
      </Section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Le budget de la semaine — la même ligne que sur l'accueil et
            Progression (components/work/subject-targets.tsx). */}
        <Section
          variant="panel"
          title="Budget de la semaine"
          action={
            <Link href="/settings#budgets" className={buttonVariants({ variant: "link", size: "sm" })}>
              {target ? "Modifier" : "En fixer un"}
            </Link>
          }
        >
          {target ? (
            <div className="sm:[&>ul]:grid-cols-1">
              <SubjectTargetList rows={[target]} size="comfortable" />
            </div>
          ) : (
            <p className="t-meta">Aucun budget hebdomadaire fixé pour {subject}.</p>
          )}
        </Section>

        <Section
          variant="panel"
          title="Échéances"
          action={
            <Link href="/echeances" className={buttonVariants({ variant: "link", size: "sm" })}>
              Toutes
            </Link>
          }
        >
          {deadlines.length === 0 ? (
            <p className="t-meta">Aucune échéance ouverte en {subject}. Elles se saisissent depuis l&apos;écran Échéances.</p>
          ) : (
            <ul className="-mx-3 -mb-2">
              {deadlines.slice(0, 5).map((priority, index) => (
                <li key={priority.item.id} className="row-slide flex min-h-[4.25rem] items-center gap-3 rounded-[1.125rem] px-3 py-2.5">
                  <DateBadge date={priority.item.dueDate ? new Date(`${priority.item.dueDate}T00:00:00`) : null} tone={index} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.9375rem] font-extrabold text-ink">{priority.item.title}</p>
                    <p
                      className={cn(
                        "mt-0.5 truncate text-[0.8125rem] font-bold",
                        priority.overdue ? "text-rose-300" : priority.daysUntilDue !== null && priority.daysUntilDue <= 2 ? "text-accent" : "text-subtle"
                      )}
                    >
                      {priority.daysUntilDue === null
                        ? "Sans date"
                        : priority.overdue
                          ? `En retard de ${Math.abs(priority.daysUntilDue)} j`
                          : priority.daysUntilDue === 0
                            ? "Aujourd'hui"
                            : `Dans ${priority.daysUntilDue} j`}
                      <span className="text-subtle/80"> · {priority.feasibility.reason}</span>
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}

/**
 * À REVOIR — les révisions du jour de la matière, la saisie (matière déjà
 * choisie : on ouvre le suivi de maths, on note, on referme), puis le
 * recueil des cartouches.
 *
 * Deux listes qui ne se ressemblent pas : les TÂCHES ouvertes (à revoir, à
 * apprendre), qui disparaissent une fois cochées, et le RECUEIL des
 * cartouches, qui ne rétrécit jamais tout seul — voir lib/review-items.ts.
 * Mêler les deux ferait disparaître une méthode maîtrisée de la seule page
 * où on vient la relire.
 */
function ReviewTab({
  subject,
  reviewItems,
  saveReviewItems,
  ready,
}: {
  subject: Subject;
  reviewItems: ReviewItem[];
  saveReviewItems: (items: ReviewItem[]) => void;
  ready: boolean;
}) {
  const tasks = useMemo(() => selectReviewItems(reviewItems, { subject, openOnly: true }).filter((item) => item.kind !== "méthode"), [reviewItems, subject]);
  const methods = useMemo(() => methodsFor(reviewItems, subject), [reviewItems, subject]);
  const mastered = methods.filter((item) => item.doneAt !== null).length;

  return (
    <div className="space-y-5">
      {/* Révisions espacées de CETTE matière — la séance s'ouvre filtrée. */}
      <DueToday items={reviewItems} subject={subject} />
      <Section
        variant="panel"
        title="À revoir"
        description="Noté en relisant tes corrigés."
        action={
          <Link href={`/revoir?subject=${encodeURIComponent(subject)}`} className={buttonVariants({ variant: "link", size: "sm" })}>
            Tout le carnet <ArrowRight size={14} aria-hidden />
          </Link>
        }
      >
        <ReviewCapture
          items={reviewItems}
          saveItems={saveReviewItems}
          ready={ready}
          subject={subject}
          visible={tasks}
          emptyText={`Rien à revoir en ${subject} pour l'instant.`}
        />
      </Section>
      <Section
        variant="panel"
        title="Cartouches"
        description={
          methods.length > 0
            ? `${mastered} maîtrisée${mastered > 1 ? "s" : ""} sur ${methods.length}.`
            : "Les manières de penser tirées de tes corrigés."
        }
      >
        {/* Les méthodes maîtrisées RESTENT : c'est un recueil qu'on relit
            avant un DS, pas une liste qu'on vide. */}
        <ReviewList
          items={reviewItems}
          saveItems={saveReviewItems}
          rows={methods}
          showSubject={false}
          showKind={false}
          emptyText="Aucune méthode notée. Choisis « Méthode » dans la saisie ci-dessus pour garder une manière de penser tirée d'un corrigé."
        />
      </Section>
    </div>
  );
}

/**
 * ERREURS — le résumé du carnet d'erreurs pour la matière : combien, de
 * quel type surtout, les dernières notées. La saisie et la liste complète
 * restent sur /erreurs, ouvert filtré sur la matière : on y note en sortant
 * d'une colle, pas en consultant le suivi.
 */
function ErrorsTab({ subject, errors }: { subject: Subject; errors: ErrorEntry[] }) {
  const own = useMemo(() => errors.filter((entry) => entry.subject === subject), [errors, subject]);
  const byType = useMemo(() => countByType(own).filter((row) => row.count > 0), [own]);
  const latest = useMemo(() => sortErrors(own).slice(0, 4), [own]);
  const href = errorLogHref({ subject });

  if (own.length === 0) {
    return (
      <Section variant="panel">
        <EmptyState
          className="py-8"
          illustration={<Illustration name="erreurs" size={56} />}
          title={`Aucune erreur notée en ${subject}.`}
          description="Après ta prochaine colle ou ton prochain DS, note chaque erreur : ce qui s'est passé, son type, et la bonne idée."
          action={
            <Link href={href} className={buttonVariants({ variant: "secondary" })}>
              Noter une erreur
            </Link>
          }
        />
      </Section>
    );
  }

  const max = Math.max(1, ...byType.map((row) => row.count));

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <Section variant="panel" title="Ce qui revient" description={`${own.length} erreur${own.length > 1 ? "s" : ""} notée${own.length > 1 ? "s" : ""} en ${subject}.`}>
        <ul className="space-y-4">
          {byType.map((row, index) => (
            <li key={row.type}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[0.9375rem] font-semibold text-ink">{ERROR_TYPE_META[row.type].label}</span>
                <span className="tabular t-meta">{row.count}</span>
              </div>
              <Meter value={(row.count / max) * 100} tone={index === 0 ? "accent" : "neutral"} index={index} className="mt-1.5 h-2" />
            </li>
          ))}
        </ul>
      </Section>
      <Section
        variant="panel"
        title="Les dernières"
        action={
          <Link href={href} className={buttonVariants({ variant: "link", size: "sm" })}>
            Ouvrir le carnet <ArrowRight size={14} aria-hidden />
          </Link>
        }
      >
        <ul className="divide-y divide-line">
          {latest.map((entry) => (
            <li key={entry.id} className="py-3 first:pt-0 last:pb-0">
              <p className="break-words text-[0.9375rem] font-semibold leading-snug text-ink">{entry.description}</p>
              {entry.fix && <p className="mt-0.5 break-words text-[0.875rem] text-muted">→ {entry.fix}</p>}
              <p className="t-meta mt-1 text-2xs">
                {ERROR_TYPE_META[entry.type].label} · {ERROR_SOURCE_META[entry.source].label} · {DAY_MONTH.format(new Date(`${entry.date}T00:00:00`))}
              </p>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

/**
 * NOTES — une moyenne PAR NATURE d'épreuve. Agréger un DM fait à la maison
 * et un DS en trois heures produit un nombre que rien ne porte. Puis les
 * dernières notes de la matière ; la saisie et la courbe vivent dans
 * Progression (#notes).
 */
function GradesTab({ subject, model, grades }: { subject: Subject; model: HubSubjectModel; grades: Grade[] }) {
  const { gradesByKind, gradeTrend } = model;
  const recent = useMemo(
    () => grades.filter((grade) => grade.subject === subject && isScored(grade)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6),
    [grades, subject]
  );

  if (model.grades.count === 0) {
    return (
      <Section variant="panel">
        <EmptyState
          className="py-8"
          illustration={<Illustration name="notes" size={56} />}
          title={`Aucune note en ${subject}.`}
          description="Ajoute tes DS, colles et DM dans Progression : c'est le seul regard extérieur sur ton travail."
          action={
            <Link href="/progress#notes" className={buttonVariants({ variant: "secondary" })}>
              Ajouter une note
            </Link>
          }
        />
      </Section>
    );
  }

  return (
    <div className="space-y-5">
      <Section
        variant="panel"
        title="Tes moyennes"
        description="Une par nature d'épreuve."
        action={
          <Link href="/progress#notes" className={buttonVariants({ variant: "link", size: "sm" })}>
            Ajouter une note <ArrowRight size={14} aria-hidden />
          </Link>
        }
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {gradesByKind.map(({ kind, stats }) => (
            <Figure
              key={kind}
              label={GRADE_KIND_META[kind].label}
              value={
                stats.average !== null ? (
                  <>
                    {formatAverage(stats.average)}
                    <span className="text-base font-semibold text-subtle"> /20</span>
                  </>
                ) : (
                  "—"
                )
              }
              detail={`${stats.count} note${stats.count > 1 ? "s" : ""}`}
            />
          ))}
        </div>
        {gradeTrend.trend.direction !== "insuffisant" && (
          <p className="t-meta mt-5">
            Tes notes en {subject} sont {gradeTrend.trend.direction === "stable" ? "stables" : `en ${gradeTrend.trend.direction}`}.
            {describeConfidence(gradeTrend.trend) ? ` ${describeConfidence(gradeTrend.trend)}` : ""}
          </p>
        )}
      </Section>

      {recent.length > 0 && (
        <Section variant="panel" title="Dernières notes">
          <ul className="-mx-3 -mb-2">
            {recent.map((grade) => (
              <li key={grade.id} className="row-slide flex min-h-[4.25rem] items-center gap-3 rounded-[1.125rem] px-3 py-2.5">
                <ScoreBadge ratio={grade.score !== null ? grade.score / grade.maxScore : null}>
                  {grade.score !== null ? formatAverage((grade.score / grade.maxScore) * 20) : "—"}
                </ScoreBadge>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.9375rem] font-extrabold text-ink">{grade.title || GRADE_KIND_META[grade.kind].label}</span>
                  <span className="block truncate text-[0.8125rem] font-bold text-subtle">
                    {GRADE_KIND_META[grade.kind].short} · {DAY_MONTH.format(new Date(`${grade.date}T00:00:00`))}
                  </span>
                </span>
                <span className="tabular shrink-0 whitespace-nowrap text-[0.9375rem] font-black text-ink">{formatGrade(grade)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
