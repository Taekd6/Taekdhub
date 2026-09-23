"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CalendarClock } from "lucide-react";
import { Section } from "@/components/ui/section";
import { Stat, StatRow } from "@/components/ui/stat";
import { SegmentedControl } from "@/components/ui/segmented";
import { Insufficient } from "@/components/progress/insufficient";
import { SubjectAvatar } from "@/components/subject-avatar";
import { SubjectTargetList } from "@/components/work/subject-targets";
import { ReviewCapture, ReviewList } from "@/components/review/review-capture";
import { DueToday } from "@/components/review/due-today";
// Carnet d'erreurs — lien « Mes erreurs · N ».
import { SubjectErrorsLink } from "@/components/errors/error-links";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { buildSubjectHub, hubSubjects, HUB_RECENT_DAYS, HUB_WINDOW_DAYS } from "@/lib/hub";
import { describeConfidence } from "@/lib/analytics/trend";
import { formatAverage, GRADE_KIND_META } from "@/lib/grades";
import { methodsFor, selectReviewItems } from "@/lib/review-items";
import { subjects as allSubjects, subjectMeta } from "@/lib/study";
import { formatSpan } from "@/lib/utils";
import { cn } from "@/lib/cn";
import type { Subject } from "@/lib/supabase/types";

/**
 * HUB D'UNE MATIÈRE — le tableau de bord de suivi.
 *
 * AUCUN EXERCICE : l'élève travaille sur ses propres feuilles, TaekdHub ne
 * connaît que ce qu'il y consigne. L'écran dit donc, matière par matière, le
 * temps réellement mis et le budget de la semaine, ce qui arrive (échéances),
 * ce qu'un professeur en a dit (notes), et ce qu'il reste à revoir (carnet et
 * cartouches de méthode). La « maîtrise par chapitre » et « à travailler
 * ensuite » qui s'y trouvaient venaient de l'ancienne banque d'exercices,
 * retirée.
 *
 * Toutes les valeurs affichées viennent de lib/hub.ts, qui ne fait que
 * composer des moteurs existants — aucune statistique n'est née ici.
 */
export function SubjectHub() {
  const { sessions, workItems, grades, reviewItems, errors, preferences, ready, saveReviewItems } = usePrepahubData();

  const available = useMemo(
    () => hubSubjects(sessions, workItems, grades, preferences, allSubjects),
    [sessions, workItems, grades, preferences]
  );
  const [subject, setSubject] = useState<Subject | null>(null);
  const active = subject && available.includes(subject) ? subject : (available[0] ?? null);
  // `?subject=` permet d'arriver ici depuis l'accueil déjà sur la bonne
  // matière, plutôt que de retomber systématiquement sur la première.
  const selectSubject = useCallback((value: Subject) => setSubject(value), []);

  const model = useMemo(
    () => (active ? buildSubjectHub(active, sessions, workItems, grades, preferences) : null),
    [active, sessions, workItems, grades, preferences]
  );

  /*
   * Le carnet de la matière, en deux listes qui ne se ressemblent pas :
   * les TÂCHES ouvertes (à revoir, à apprendre), qui disparaissent une fois
   * cochées, et le RECUEIL des cartouches, qui ne rétrécit jamais tout seul
   * — voir lib/review-items.ts. Mêler les deux ferait disparaître une
   * méthode maîtrisée de la seule page où on vient la relire.
   */
  const review = useMemo(() => {
    if (!active) return { tasks: [], methods: [] };
    return {
      tasks: selectReviewItems(reviewItems, { subject: active, openOnly: true }).filter((item) => item.kind !== "méthode"),
      methods: methodsFor(reviewItems, active),
    };
  }, [reviewItems, active]);

  if (!ready) return <div className="h-64 animate-pulse rounded-xl bg-inset" />;

  if (!model || !active) {
    return (
      <Insufficient
        what="Aucune matière à suivre pour l'instant."
        how="Le suivi se remplit dès la première séance enregistrée, ou dès qu'un budget hebdomadaire est fixé dans Réglages."
      />
    );
  }

  const { workload, target, deadlines, grades: gradeStats, gradesByKind, gradeTrend } = model;
  const rhythm = describeConfidence(workload.trend);

  return (
    <div className="space-y-9">
      {/* `useSearchParams` exige une limite Suspense — isolée ici pour ne pas
          faire basculer toute la page en rendu dynamique. */}
      <Suspense fallback={null}>
        <SubjectQueryHandler ready={ready} available={available} onSubject={selectSubject} />
      </Suspense>

      {/* Le sélecteur de matière EST la navigation de cet écran : une seule
          matière à la fois, parce qu'un suivi qui montre tout ne se lit pas. */}
      {available.length > 1 && (
        <SegmentedControl
          ariaLabel="Matière suivie"
          value={active}
          onChange={(value) => setSubject(value as Subject)}
          options={available.map((entry) => ({ value: entry, label: subjectMeta[entry].short }))}
        />
      )}

      <div className="flex items-center gap-3">
        <SubjectAvatar subject={active} size="md" />
        <div className="min-w-0">
          <h2 className="t-heading truncate">{active}</h2>
          <p className="t-meta mt-0.5">
            {workload.recentMinutes > 0
              ? `${formatSpan(workload.recentMinutes * 60)} ces ${HUB_RECENT_DAYS} derniers jours`
              : `Aucune séance ces ${HUB_RECENT_DAYS} derniers jours.`}
          </p>
        </div>
        {/* Carnet d'erreurs de la matière — un lien, pas une section : on y
            note en sortant d'une colle, pas en consultant le suivi. */}
        <SubjectErrorsLink errors={errors} subject={active} className="ml-auto shrink-0" />
      </div>

      {/* ── TEMPS DE TRAVAIL ─────────────────────────────────────── */}
      <Section
        label="Où j'en suis"
        title="Temps de travail"
        description="Le temps que tu as réellement mis dans cette matière, et où tu en es de ton budget de la semaine."
      >
        <StatRow>
          <Stat label={`Ces ${HUB_RECENT_DAYS} jours`} value={formatSpan(workload.recentMinutes * 60)} size="sm" />
          <Stat
            label={`Sur ${HUB_WINDOW_DAYS} jours`}
            value={formatSpan(workload.windowMinutes * 60)}
            detail={workload.sharePercent !== null ? `${workload.sharePercent} % de ton temps` : undefined}
            size="sm"
          />
          <Stat label="Jours actifs" value={workload.activeDaysThisWeek} detail="cette semaine, toutes matières" size="sm" />
        </StatRow>
        {/* Le budget de la semaine — la même ligne que sur l'accueil et
            Progression (components/work/subject-targets.tsx). */}
        {target ? (
          <div className="mt-5">
            <SubjectTargetList rows={[target]} size="comfortable" />
          </div>
        ) : (
          <p className="t-meta mt-4">
            Aucun budget hebdomadaire fixé pour {active}.{" "}
            <Link href="/settings" className="text-accent hover:underline">
              En fixer un dans Réglages
            </Link>
          </p>
        )}
        {workload.trend.direction !== "insuffisant" ? (
          <p className="t-meta mt-3">
            Sur les semaines mesurées, ton volume en {active} est{" "}
            {workload.trend.direction === "stable" ? "stable" : `en ${workload.trend.direction}`}.
            {rhythm ? ` ${rhythm}` : ""}
          </p>
        ) : (
          <p className="t-meta mt-3">Pas encore assez de semaines mesurées pour qualifier un rythme dans cette matière.</p>
        )}
      </Section>

      {/* ── ÉCHÉANCES ───────────────────────────────────────────── */}
      <Section label="Ce qui arrive" title="Échéances" description="Les travaux ouverts dans cette matière, les plus urgents d'abord.">
        {deadlines.length === 0 ? (
          <Insufficient what={`Aucune échéance ouverte en ${active}.`} how="Elles se saisissent depuis l'écran Échéances." />
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {deadlines.slice(0, 5).map((priority) => (
              <li key={priority.item.id} className="flex items-baseline gap-3 py-3">
                <CalendarClock size={14} className="shrink-0 translate-y-0.5 text-subtle" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="t-subhead truncate">{priority.item.title}</p>
                  <p className="t-meta mt-0.5">{priority.feasibility.reason}</p>
                </div>
                <span
                  className={cn(
                    "t-meta tabular shrink-0 whitespace-nowrap",
                    priority.overdue ? "text-rose-300" : "text-muted"
                  )}
                >
                  {priority.daysUntilDue === null
                    ? "sans date"
                    : priority.overdue
                      ? `retard ${Math.abs(priority.daysUntilDue)} j`
                      : priority.daysUntilDue === 0
                        ? "aujourd'hui"
                        : `dans ${priority.daysUntilDue} j`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* ── RÉSULTATS — seulement s'il y en a ────────────────────── */}
      {gradeStats.count > 0 && (
        <Section
          label="Les résultats"
          title="Notes"
          description="Ce qu'un professeur a évalué — la seule mesure qui ne vienne pas de TaekdHub. Une moyenne par nature d'épreuve : un DM et un DS ne se passent pas dans les mêmes conditions."
        >
          {/* UNE MOYENNE PAR NATURE. Agréger un DM fait à la maison et un DS
              en trois heures produit un nombre que rien ne porte. */}
          <StatRow>
            {gradesByKind.map(({ kind, stats }) => (
              <Stat
                key={kind}
                label={GRADE_KIND_META[kind].label}
                value={stats.average !== null ? `${formatAverage(stats.average)}/20` : "—"}
                detail={`${stats.count} note${stats.count > 1 ? "s" : ""}`}
                size="sm"
              />
            ))}
          </StatRow>
          {gradeTrend.trend.direction !== "insuffisant" && (
            <p className="t-meta mt-3">
              Tes notes en {active} sont{" "}
              {gradeTrend.trend.direction === "stable" ? "stables" : `en ${gradeTrend.trend.direction}`}.
              {describeConfidence(gradeTrend.trend) ? ` ${describeConfidence(gradeTrend.trend)}` : ""}
            </p>
          )}
        </Section>
      )}

      {/* ── À REVOIR ET CARTOUCHES ─────────────────────────────────
          Ce qu'on a noté en disséquant les corrigés de cette matière. La
          saisie est ici aussi, matière déjà choisie : on ouvre le suivi de
          maths, on note, on referme. */}
      <Section
        label="Le carnet"
        title="À revoir"
        description="Ce que tu as noté en relisant tes corrigés, et les méthodes que tu en as tirées."
        action={
          <Link
            href={`/revoir?subject=${encodeURIComponent(active)}`}
            className="t-meta inline-flex min-h-6 items-center gap-1 rounded hover:text-ink max-lg:min-h-11"
          >
            Tout le carnet <ArrowRight size={14} aria-hidden />
          </Link>
        }
      >
        {/* Révisions espacées de CETTE matière — la séance s'ouvre filtrée. */}
        <DueToday items={reviewItems} subject={active} className="mb-4" />
        <ReviewCapture
          key={active}
          items={reviewItems}
          saveItems={saveReviewItems}
          ready={ready}
          subject={active}
          visible={review.tasks}
          emptyText={`Rien à revoir en ${active} pour l'instant.`}
        />
        <div className="mt-6">
          <div className="flex items-baseline justify-between gap-3">
            <p className="t-label">Cartouches</p>
            {review.methods.length > 0 && (
              <p className="tabular t-meta shrink-0 text-2xs">
                {review.methods.filter((item) => item.doneAt !== null).length} maîtrisée
                {review.methods.filter((item) => item.doneAt !== null).length > 1 ? "s" : ""} sur {review.methods.length}
              </p>
            )}
          </div>
          {/* Les méthodes maîtrisées RESTENT : c'est un recueil qu'on relit
              avant un DS, pas une liste qu'on vide. */}
          <ReviewList
            items={reviewItems}
            saveItems={saveReviewItems}
            rows={review.methods}
            showSubject={false}
            showKind={false}
            emptyText="Aucune méthode notée. Choisis « Méthode » ci-dessus pour garder une manière de penser tirée d'un corrigé."
            className="mt-2"
          />
        </div>
      </Section>

    </div>
  );
}

/**
 * `?subject=<matière>` — arriver sur le suivi d'une matière précise, depuis
 * l'accueil notamment. Isolé dans son propre composant car `useSearchParams`
 * impose une limite Suspense.
 */
function SubjectQueryHandler({
  ready,
  available,
  onSubject,
}: {
  ready: boolean;
  available: Subject[];
  onSubject: (subject: Subject) => void;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const handled = useRef(false);

  useEffect(() => {
    if (!ready || handled.current) return;
    const subject = searchParams.get("subject");
    if (!subject) return;
    handled.current = true;
    if ((available as string[]).includes(subject)) onSubject(subject as Subject);
    router.replace("/preparation", { scroll: false });
  }, [ready, available, searchParams, onSubject, router]);

  return null;
}
