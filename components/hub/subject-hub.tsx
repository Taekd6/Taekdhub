"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, CalendarClock } from "lucide-react";
import { Section } from "@/components/ui/section";
import { Stat, StatRow } from "@/components/ui/stat";
import { Meter } from "@/components/ui/progress";
import { SegmentedControl } from "@/components/ui/segmented";
import { Insufficient } from "@/components/progress/insufficient";
import { SubjectAvatar } from "@/components/exercises/exercise-badges";
import { ReviewCapture, ReviewList } from "@/components/review/review-capture";
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
 * HUB D'UNE MATIÈRE — le tableau de bord de suivi, pas la banque.
 *
 * Cet écran remplace « Équilibrer mes matières », qui était structuré par les
 * exercices : il comptait des fiches restantes, allouait des minutes par
 * matière, et se terminait par un bouton qui CONSTRUISAIT une séance
 * d'exercices. On y ouvrait une banque, pas un suivi.
 *
 * ICI, AUCUN EXERCICE N'EST NOMMÉ NI LISTÉ. Ce qui reste des fiches, ce sont
 * les grandeurs qu'elles alimentent — avancement, maîtrise par chapitre — et
 * rien d'autre. Ce qu'il y a à travailler ensuite est désigné à l'échelle du
 * CHAPITRE : c'est l'échelle à laquelle on pilote une prépa. Le choix de la
 * fiche appartient au moteur de recommandation, qui s'exprime chaque jour sur
 * l'accueil, et à la banque, atteinte par un seul lien de sortie.
 *
 * Toutes les valeurs affichées viennent de lib/hub.ts, qui ne fait que
 * composer des moteurs existants — aucune statistique n'est née ici.
 */
export function SubjectHub() {
  const { exercises, sessions, chapters, workItems, grades, reviewItems, preferences, ready, saveReviewItems } = usePrepahubData();

  const available = useMemo(() => hubSubjects(exercises, sessions, allSubjects), [exercises, sessions]);
  const [subject, setSubject] = useState<Subject | null>(null);
  const active = subject && available.includes(subject) ? subject : (available[0] ?? null);
  // `?subject=` permet d'arriver ici depuis l'accueil déjà sur la bonne
  // matière, plutôt que de retomber systématiquement sur la première.
  const selectSubject = useCallback((value: Subject) => setSubject(value), []);

  const model = useMemo(
    () => (active ? buildSubjectHub(active, exercises, sessions, chapters, workItems, grades, preferences) : null),
    [active, exercises, sessions, chapters, workItems, grades, preferences]
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
        how="Le suivi se remplit dès la première séance enregistrée, ou dès qu'une matière contient une fiche."
      />
    );
  }

  const { progress, workload, chapters: board, deadlines, grades: gradeStats, gradesByKind, gradeTrend, nextChapter, measured } = model;
  const rhythm = describeConfidence(workload.trend);
  const chapterCount = board.fragile.length + board.solid.length + board.untouched.length;


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
            {chapterCount > 0
              ? `${board.solid.length} chapitre${board.solid.length > 1 ? "s" : ""} acquis sur ${chapterCount}`
              : "Aucun chapitre rattaché à cette matière pour l'instant."}
          </p>
        </div>
      </div>

      {/* ── AVANCEMENT ET TRAVAIL ───────────────────────────────── */}
      <Section
        label="Où j'en suis"
        title="Avancement"
        description="Ce qui est acquis dans cette matière, et le temps que tu y as réellement mis."
      >
        <StatRow>
          {/* « NON MESURÉ », pas « 0 % ». Sans aucune fiche rattachée, un zéro
              se lit comme « tu n'as rien acquis » alors que la vérité est
              « rien n'est mesuré ici ». Le zéro est réservé aux mesures
              réelles — même règle que `sharePercent`, `average` et `Trend`
              partout ailleurs. */}
          <Stat label="Maîtrise moyenne" value={measured ? `${progress.averageMastery} %` : "non mesuré"} size="sm" />
          <Stat label="Progression" value={measured ? `${progress.completionRate} %` : "non mesuré"} size="sm" />
          <Stat label={`Ces ${HUB_RECENT_DAYS} jours`} value={formatSpan(workload.recentMinutes * 60)} size="sm" />
          <Stat
            label={`Sur ${HUB_WINDOW_DAYS} jours`}
            value={formatSpan(workload.windowMinutes * 60)}
            detail={workload.sharePercent !== null ? `${workload.sharePercent} % de ton temps` : undefined}
            size="sm"
          />
        </StatRow>
        {measured && <Meter value={progress.completionRate} className="mt-5" tone="neutral" />}
        {!measured && (
          <p className="t-meta mt-4">
            {progress.total === 0
              ? `Aucune fiche n'est rattachée à ${active} : l'avancement ne peut pas être mesuré, seul le temps l'est.`
              : `Rien n'a encore été travaillé en ${active} : l'avancement se mesurera dès la première fiche ouverte.`}
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

      {/* ── CHAPITRES ───────────────────────────────────────────── */}
      <Section
        label="Le contenu"
        title="Chapitres"
        description="Trois états, et le troisième compte autant que les deux autres : un chapitre jamais travaillé n'est pas un chapitre faible."
      >
        {chapterCount === 0 ? (
          <Insufficient
            what="Aucun chapitre rattaché à cette matière."
            how="Les chapitres se créent depuis la banque ; le suivi les reprend ensuite automatiquement."
          />
        ) : (
          <div className="space-y-6">
            <ChapterGroup title="À consolider" rows={board.fragile} empty="Rien de fragile pour l'instant." />
            <ChapterGroup title="Acquis" rows={board.solid} empty="Aucun chapitre encore acquis." />
            <ChapterGroup title="Non mesurés" rows={board.untouched} empty="Tous les chapitres ont été abordés." muted />
          </div>
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

      {/* ── LA SORTIE ───────────────────────────────────────────── */}
      <Section label="Et maintenant" title="À travailler ensuite">
        {nextChapter ? (
          /* MATIÈRE → CHAPITRE → RAISON, et jamais une fiche précise. Les
             raisons sont celles du verdict partagé avec l'accueil
             (`assessChapter`) : les deux écrans disent donc la même chose du
             même chapitre, avec les mêmes mots. */
          <div>
            <p className="t-body">
              <span className="text-muted">{active}</span> —{" "}
              <span className="font-medium text-ink">{nextChapter.chapter.label}</span>
            </p>
            <ul className="mt-2 space-y-1">
              {nextChapter.assessment.reasons.map((reason) => (
                <li key={reason} className="t-meta">
                  {reason}
                </li>
              ))}
            </ul>
            <p className="t-meta mt-2 text-2xs">
              {nextChapter.assessment.attempts > 0
                ? `Verdict établi sur ${nextChapter.assessment.attempts} tentative${nextChapter.assessment.attempts > 1 ? "s" : ""} notée${nextChapter.assessment.attempts > 1 ? "s" : ""}${nextChapter.assessment.sinceDays !== null ? `, depuis ${nextChapter.assessment.sinceDays} j` : ""}.`
                : "Aucune tentative notée sur ce chapitre — le verdict repose sur la maîtrise déclarée."}
            </p>
          </div>
        ) : board.untouched.length > 0 ? (
          <p className="t-body">
            Rien de fragile parmi ce que tu as commencé. Il reste{" "}
            <span className="font-medium text-ink">{board.untouched.length}</span> chapitre
            {board.untouched.length > 1 ? "s" : ""} jamais abordé{board.untouched.length > 1 ? "s" : ""}.
          </p>
        ) : (
          <p className="t-body">Rien à signaler dans cette matière pour l&apos;instant.</p>
        )}
        {/* LE SEUL LIEN VERS LA BANQUE. On suit ici, on travaille là-bas. */}
        <Link
          href={`/exercises?subject=${encodeURIComponent(active)}`}
          className="t-meta mt-4 inline-flex min-h-6 items-center gap-1.5 text-accent hover:underline max-lg:min-h-11"
        >
          Ouvrir la banque en {active} <ArrowRight size={14} aria-hidden />
        </Link>
      </Section>
    </div>
  );
}

/** Un groupe de chapitres — le taux et le compte, jamais la liste des fiches. */
/** Au-delà, une liste de chapitres cesse d'être un repère et devient un mur — on replie le reste derrière un compte. */
const CHAPTERS_SHOWN = 6;

function ChapterGroup({
  title,
  rows,
  empty,
  muted,
}: {
  title: string;
  rows: { chapter: { id: string; label: string }; rate: number; total: number; mastered: number; untouched: number }[];
  empty: string;
  muted?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? rows : rows.slice(0, CHAPTERS_SHOWN);
  const hidden = rows.length - shown.length;

  return (
    <div>
      <p className="t-label">{title}</p>
      {rows.length === 0 ? (
        <p className="t-meta mt-1.5 text-2xs">{empty}</p>
      ) : (
        <ul className="mt-2 divide-y divide-line border-y border-line">
          {shown.map((row) => (
            <li key={row.chapter.id} className="flex items-center gap-3 py-2.5">
              <span className={cn("min-w-0 flex-1 truncate text-sm", muted ? "text-muted" : "text-ink")}>
                {row.chapter.label}
                {/* « 0 / 5 acquis » nommait encore un stock de fiches. Le taux
                    à droite dit la même chose, et c'est l'échelle du CHAPITRE
                    qui pilote cet écran. */}
              </span>
              {!muted && <Meter value={row.rate} className="w-16 shrink-0 max-sm:hidden" tone="neutral" />}
              {/* « — » et non « 0 % » en face d'un chapitre rangé sous « non
                  mesurés » : le taux y serait une mesure de rien, et la ligne
                  se contredirait elle-même. */}
              <span className="tabular w-12 shrink-0 whitespace-nowrap text-right text-sm text-ink">
                {muted ? "—" : `${row.rate} %`}
              </span>
            </li>
          ))}
        </ul>
      )}
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="t-meta mt-2 inline-flex min-h-6 items-center text-2xs text-accent hover:underline max-lg:min-h-11"
        >
          Voir les {hidden} autres
        </button>
      )}
    </div>
  );
}

/**
 * `?subject=<matière>` — arriver sur le suivi d'une matière précise, depuis
 * l'accueil notamment. Isolé dans son propre composant car `useSearchParams`
 * impose une limite Suspense (même motif que ExerciseManager).
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
