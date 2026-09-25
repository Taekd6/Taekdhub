"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { ArrowRight, ChevronRight, LayoutGrid } from "lucide-react";
import { Section } from "@/components/ui/section";
import { Tabs } from "@/components/ui/tabs";
import { ChapterNav } from "@/components/ui/chapter-nav";
import { PageHero } from "@/components/ui/page-hero";
import { Illustration, SubjectIllustration } from "@/components/ui/illustrations";
import { Meter } from "@/components/ui/progress";
import { VolumeBars } from "@/components/ui/chart";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/state";
import { SubjectAvatar } from "@/components/subject-avatar";
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
import { formatSpan } from "@/lib/utils";
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
 *                              passer de l'une à l'autre, un grand titre, et
 *                              quatre onglets ancrés dans l'URL —
 *                              `#apercu`, `#revoir`, `#erreurs`, `#notes`.
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

  return (
    <div className="space-y-10 sm:space-y-12">
      <ChapterNav
        ariaLabel="Matières"
        activeHref={subjectHref(active)}
        items={[
          { href: "/preparation", label: "Toutes", icon: <LayoutGrid size={30} strokeWidth={1.5} aria-hidden /> },
          ...navSubjects.map((subject) => ({ href: subjectHref(subject), label: shortName(subject), icon: <SubjectIllustration subject={subject} size={40} /> })),
        ]}
      />

      <PageHero
        eyebrow={
          <Link href="/preparation" className="inline-flex min-h-6 items-center gap-1 rounded hover:text-ink max-lg:min-h-11">
            Suivi par matière
          </Link>
        }
        title={active}
        lede={
          activeModel.workload.recentMinutes > 0
            ? `${formatSpan(activeModel.workload.recentMinutes * 60)} ces ${HUB_RECENT_DAYS} derniers jours.`
            : `Aucune séance ces ${HUB_RECENT_DAYS} derniers jours.`
        }
        illustration={<SubjectIllustration subject={active} size={60} />}
      />

      {/* `key` : changer de matière remet l'onglet d'ouverture à zéro, comme
          une nouvelle page — l'ancre, elle, est effacée par le lien. */}
      <Tabs
        key={active}
        syncHash
        ariaLabel={`Suivi de ${active}`}
        items={[
          {
            id: "apercu",
            label: "Vue d'ensemble",
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
 * Une tuile par matière suivie — le dessin, le nom, le temps de la semaine,
 * la barre du budget, et ce qui attend (échéances, carnet). La tuile entière
 * est un lien ; elle grossit d'un pour cent au survol (`.lift`), et entre en
 * cascade au chargement.
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
    <div className="space-y-10 sm:space-y-12">
      <PageHero
        title="Tes matières"
        lede="Ce que tu y as mis, ce qui arrive, ce qu'il reste à revoir et tes notes — matière par matière."
      />

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
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {available.map((subject, index) => {
            const model = models.get(subject);
            if (!model) return null;
            const open = selectReviewItems(reviewItems, { subject, openOnly: true }).length;
            const deadlines = model.deadlines.length;
            return (
              <li key={subject} className="reveal" style={{ "--i": index } as React.CSSProperties}>
                <Link
                  href={subjectHref(subject)}
                  className="surface lift group flex h-full min-h-[15rem] flex-col p-6 sm:p-7"
                  aria-label={`${subject} — ${formatSpan(model.workload.recentMinutes * 60)} ces ${HUB_RECENT_DAYS} jours`}
                >
                  <div className="flex items-start justify-between">
                    <span className="text-ink transition-transform duration-500 ease-[cubic-bezier(.16,1,.3,1)] group-hover:-translate-y-1 motion-reduce:group-hover:translate-y-0">
                      <SubjectIllustration subject={subject} size={56} />
                    </span>
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-inset text-muted transition-colors group-hover:text-ink">
                      <ChevronRight size={16} strokeWidth={2.4} aria-hidden />
                    </span>
                  </div>
                  <h2 className="t-heading mt-5">{subject}</h2>
                  <p className="t-meta mt-1">
                    <span className="tabular font-semibold text-ink">{formatSpan(model.workload.recentMinutes * 60)}</span> ces {HUB_RECENT_DAYS} jours
                    {model.workload.sharePercent !== null && model.workload.sharePercent > 0 && <> · {model.workload.sharePercent} % du mois</>}
                  </p>
                  <div className="mt-auto pt-6">
                    {model.target ? (
                      <>
                        <Meter value={model.target.percent} tone={model.target.percent >= 100 ? "accent" : "neutral"} index={index} />
                        <p className="t-meta mt-2 flex justify-between gap-2 text-2xs">
                          <span>budget de la semaine</span>
                          <span className="tabular">
                            {formatSpan(model.target.doneSeconds)} / {formatSpan(model.target.targetMinutes * 60)}
                          </span>
                        </p>
                      </>
                    ) : (
                      <p className="t-meta text-2xs">Pas de budget hebdomadaire</p>
                    )}
                    <p className="mt-3 flex flex-wrap gap-1.5 text-2xs font-semibold">
                      <Tag active={deadlines > 0}>
                        {deadlines} échéance{deadlines > 1 ? "s" : ""}
                      </Tag>
                      <Tag active={open > 0}>{open} à revoir</Tag>
                      {model.grades.average !== null && <Tag>moy. {formatAverage(model.grades.average)}</Tag>}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Tag({ active = false, children }: { active?: boolean; children: React.ReactNode }) {
  return <span className={cn("rounded-full px-2.5 py-1", active ? "bg-accent/[0.14] text-accent" : "bg-inset text-muted")}>{children}</span>;
}

/* ══════════════════════════════════════════════════════════════════
   LA PAGE D'UNE MATIÈRE — quatre onglets
   ══════════════════════════════════════════════════════════════════ */

const DAY_MONTH = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });

/** Un chiffre dans un creux gris. */
function Figure({ label, value, detail }: { label: string; value: React.ReactNode; detail?: string }) {
  return (
    <div className="well min-w-0 p-4 sm:p-5">
      <p className="t-label text-[0.8125rem]">{label}</p>
      <p className="t-figure-sm mt-2 whitespace-nowrap">{value}</p>
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
      <Section variant="panel" title="Temps de travail" description="Le temps que tu as réellement mis dans cette matière.">
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
            <ul className="-mx-2 space-y-0.5">
              {deadlines.slice(0, 5).map((priority) => (
                <li key={priority.item.id} className="row-hover flex items-center gap-3 rounded-xl px-2 py-2.5">
                  <span
                    className={cn(
                      "grid h-11 w-11 shrink-0 place-items-center rounded-xl text-center text-2xs font-bold leading-tight tabular",
                      priority.overdue ? "bg-rose-400/[0.14] text-rose-300" : priority.daysUntilDue !== null && priority.daysUntilDue <= 2 ? "bg-accent/[0.14] text-accent" : "bg-inset text-muted"
                    )}
                  >
                    {priority.daysUntilDue === null
                      ? "—"
                      : priority.overdue
                        ? `−${Math.abs(priority.daysUntilDue)} j`
                        : priority.daysUntilDue === 0
                          ? "auj."
                          : `${priority.daysUntilDue} j`}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.9375rem] font-semibold text-ink">{priority.item.title}</p>
                    <p className="t-meta mt-0.5 truncate text-[0.8125rem]">{priority.feasibility.reason}</p>
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
        description="Ce que tu as noté en relisant tes corrigés."
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
            ? `${mastered} maîtrisée${mastered > 1 ? "s" : ""} sur ${methods.length} — un recueil qu'on relit avant un DS.`
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
        description="Une moyenne par nature d'épreuve : un DM et un DS ne se passent pas dans les mêmes conditions."
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
          <ul className="-mx-2 space-y-0.5">
            {recent.map((grade) => (
              <li key={grade.id} className="row-hover flex items-center gap-3 rounded-xl px-2 py-2.5">
                <SubjectAvatar subject={grade.subject} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.9375rem] font-semibold text-ink">{grade.title || GRADE_KIND_META[grade.kind].label}</span>
                  <span className="t-meta block truncate text-2xs">
                    {GRADE_KIND_META[grade.kind].short} · {DAY_MONTH.format(new Date(`${grade.date}T00:00:00`))}
                  </span>
                </span>
                <span className="t-figure-sm tabular shrink-0 whitespace-nowrap text-xl">{formatGrade(grade)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
