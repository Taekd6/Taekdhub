"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronRight, Flame, Scale, Trophy } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { BackupReminder } from "@/components/backup-reminder";
import { Button } from "@/components/ui/button";
import { List, rowInteractive, Section } from "@/components/ui/section";
import { SegmentedControl } from "@/components/ui/segmented";
import { Ring } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/state";
import { PageBar, Split } from "@/components/ui/layout";
import { SubjectAvatar } from "@/components/exercises/exercise-badges";
import { MathInline } from "@/components/rich-math";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { computeStreak } from "@/lib/gamification";
import {
  computeChaptersToConsolidate,
  computeDailyObjective,
  computeNextAction,
  computeStatusLine,
  computeUpcoming,
} from "@/lib/next-action";
import { explainReasons } from "@/lib/recommendation";
import {
  computeDailyPlan,
  DEFAULT_PLAN_MINUTES,
  PLAN_DURATION_PRESETS,
  PLAN_INTENT_META,
  PLAN_STORAGE_KEY,
  serializePlan,
} from "@/lib/plan";
import { formatMinutesSpan, formatSpan } from "@/lib/utils";
import { computeWeeklySummary } from "@/lib/week";
import { computeProgressBySubject } from "@/lib/progress";
import { cn } from "@/lib/cn";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const contestDateFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

/**
 * ÉCRAN D'ACCUEIL — « qu'est-ce que je fais maintenant ? »
 *
 * DEUX changements de fond par rapport à la version précédente.
 *
 * 1. LA COMPOSITION. L'écran était une colonne : la séance, puis les
 *    compteurs, puis les chapitres, puis le reste — donc « où j'en suis »
 *    coûtait un défilement à « qu'est-ce que je fais », alors que les deux
 *    questions se posent en même temps, en s'asseyant. Le rail de droite les
 *    met côte à côte : la décision à gauche, l'état à droite, d'un seul coup
 *    d'œil.
 *
 * 2. UNE SEULE RÉPONSE. Le tableau de bord répondait DEUX FOIS à la même
 *    question, avec deux moteurs : « Plan du jour » (lib/plan.ts) et
 *    « Préparation globale » (lib/preparation-os.ts), chacun avec son
 *    sélecteur de durée et son bouton « commencer », l'un sous l'autre. La
 *    préparation par matière garde toute sa valeur — mais comme un ARBITRAGE
 *    que l'on va consulter (/preparation), pas comme un second départ.
 */
export function DashboardOverview() {
  const { sessions, exercises, chapters, preferences, ready } = usePrepahubData();
  const router = useRouter();
  const [planMinutes, setPlanMinutes] = useState<number>(DEFAULT_PLAN_MINUTES);

  const model = useMemo(() => {
    const now = new Date();
    const objective = computeDailyObjective(sessions, preferences.dailyGoalMinutes, now);
    const nextAction = computeNextAction(exercises, sessions, preferences.dailyGoalMinutes, now);
    return {
      nextAction,
      objective,
      statusLine: computeStatusLine(objective, nextAction),
      upcoming: computeUpcoming(exercises, sessions, chapters, now),
      toConsolidate: computeChaptersToConsolidate(exercises, sessions, chapters, now),
      weeklySummary: computeWeeklySummary(exercises, sessions, preferences.weeklyGoalMinutes, now),
      streak: computeStreak(sessions),
      /*
       * REPRENDRE — les derniers exercices réellement ouverts, dans l'ordre.
       *
       * La colonne principale s'arrêtait après la séance quand rien n'était
       * signalé : un écran d'accueil qui se termine par du vide au premier
       * tiers de la page. Or il existe toujours une réponse utile à
       * « et sinon ? » : soit ce sur quoi on travaillait hier, soit, au tout
       * début, les matières elles-mêmes.
       *
       * Dérivé des `WorkSession` (aucun nouveau champ) : on remonte le
       * journal, on garde le premier passage sur chaque exercice.
       */
      resume: (() => {
        const seen = new Set<string>();
        const out: { exercise: (typeof exercises)[number]; at: string }[] = [];
        for (const session of [...sessions].sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())) {
          if (!session.exercise_id || seen.has(session.exercise_id)) continue;
          const exercise = exercises.find((item) => item.id === session.exercise_id && !item.archived);
          if (!exercise) continue;
          seen.add(session.exercise_id);
          out.push({ exercise, at: session.started_at });
          if (out.length === 3) break;
        }
        return out;
      })(),
      subjects: computeProgressBySubject(exercises).filter((entry) => entry.total > 0),
      contestDays: preferences.contestDate
        ? Math.max(0, Math.ceil((new Date(preferences.contestDate).getTime() - now.getTime()) / 86400000))
        : null,
      contestDate: preferences.contestDate ? contestDateFormatter.format(new Date(preferences.contestDate)) : null,
    };
  }, [exercises, sessions, chapters, preferences]);

  const dailyPlan = useMemo(
    () => computeDailyPlan(exercises, sessions, chapters, planMinutes, new Date()),
    [exercises, sessions, chapters, planMinutes]
  );

  const startPlan = useCallback(() => {
    sessionStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(serializePlan(dailyPlan)));
    router.push("/session");
  }, [dailyPlan, router]);

  const name = preferences.displayName?.trim();

  if (!ready) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  const { nextAction, objective, statusLine, upcoming, toConsolidate, weeklySummary, streak, contestDays, contestDate, resume, subjects } = model;
  const planReason = explainReasons(dailyPlan.blocks[0]?.picks[0]?.reasons ?? []);
  const hasPlan = dailyPlan.blocks.length > 0;
  const [firstBlock, ...nextBlocks] = dailyPlan.blocks;
  const sessionHref = nextAction.kind === "start-session" ? `/session?minutes=${nextAction.minutes}` : nextAction.href;
  const secondaryPicks = nextAction.picks.slice(1);
  const otherSignals = upcoming.filter((item) => item.key !== "chapter");

  return (
    <Split
      railLabel="Où j'en suis"
      rail={
        <div className="space-y-8">
          {/* L'OBJECTIF DU JOUR en tête du rail : c'est la seule mesure qu'on
              regarde plusieurs fois par jour, donc la seule qui mérite un
              anneau plutôt qu'une ligne. */}
          <div className="flex items-center gap-4">
            <Ring value={objective.percent} size={62} strokeWidth={4}>
              <span className="t-figure text-[0.9375rem]">{objective.percent}%</span>
            </Ring>
            <div className="min-w-0">
              <p className="t-label">Objectif du jour</p>
              <p className="tabular mt-1 text-sm">
                <span className="font-medium text-ink">{objective.workedMinutes}</span>
                <span className="text-muted"> / {objective.goalMinutes} min</span>
              </p>
              {objective.met && <p className="t-meta mt-0.5 text-emerald-300">Atteint</p>}
            </div>
          </div>

          <dl className="divide-y divide-line border-y border-line">
            <RailFigure label="Cette semaine" value={formatSpan(weeklySummary.totalSeconds)} detail={`${weeklySummary.progressPercent} % de l'objectif`} />
            {streak > 0 && (
              <RailFigure label="Série" value={`${streak} j`} detail="jours d'affilée" icon={<Flame size={13} className="text-accent" />} />
            )}
            {contestDays !== null && (
              /* « J−223 · avant l'échéance » ne disait pas QUELLE échéance.
                 Un compte à rebours sans sa date oblige à aller la vérifier
                 dans les réglages pour la resituer dans un calendrier. */
              <RailFigure
                label="Concours"
                value={`J−${contestDays}`}
                detail={contestDate ?? "avant l'échéance"}
                icon={<Trophy size={13} className="text-accent" />}
              />
            )}
          </dl>

          {/* AUSSI SIGNALÉ vit dans le rail, pas sous la séance : ce sont des
              signaux à surveiller, pas des choses à faire maintenant. Les
              mettre dans le flux principal les mettait au même rang que le
              plan du jour. */}
          {(secondaryPicks.length > 0 || otherSignals.length > 0) && (
            <div>
              <p className="t-label mb-2">Aussi signalé</p>
              <ul className="divide-y divide-line border-y border-line">
                {secondaryPicks.map(({ exercise, reasons }) => (
                  <li key={exercise.id}>
                    <Link href={`/exercises?focus=${exercise.id}`} className="row-hover flex items-center gap-2.5 rounded-md py-2.5 max-lg:min-h-11">
                      <SubjectAvatar subject={exercise.subject} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.8125rem] text-ink">
                          <MathInline text={exercise.title} />
                        </span>
                        <span className="t-meta mt-0.5 block truncate text-2xs">{reasons.slice(0, 1).join(" · ")}</span>
                      </span>
                    </Link>
                  </li>
                ))}
                {otherSignals.map((item) => (
                  <li key={item.key}>
                    <Link href={item.href} className="row-hover block rounded-md py-2.5 max-lg:min-h-11">
                      <span className="block truncate text-[0.8125rem] text-ink">{item.label}</span>
                      <span className="t-meta mt-0.5 block truncate text-2xs">{item.detail}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col items-start gap-2">
            <Link href="/preparation" className="t-meta inline-flex items-center gap-1.5 rounded hover:text-ink max-lg:min-h-11">
              <Scale size={14} /> Équilibrer mes matières
            </Link>
            <Link href="/progress" className="t-meta inline-flex items-center gap-1 rounded hover:text-ink max-lg:min-h-11">
              Ma progression <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      }
    >
      <div className="space-y-10">
        {/* EN-TÊTE RÉDUIT À UNE LIGNE.
            La salutation était composée en `t-display`, au même corps que le
            titre du bloc « La séance » juste en dessous : deux titres de
            même poids, donc aucun des deux ne désignait plus l'élément
            important. Elle passe en `quiet` (voir `PageBar`) et sa date se
            range sur la même ligne — la décision du jour redevient le seul
            grand titre de l'écran, et gagne la hauteur correspondante. */}
        <PageBar
          rank="quiet"
          title={name ? `Bonjour, ${name}.` : "Bonjour."}
          meta={
            <>
              <span className="capitalize">{dateFormatter.format(new Date())}</span> · {statusLine}
            </>
          }
        />

        {/* ── LA SÉANCE ─────────────────────────────────────────────
            Seul bloc encadré et seul bouton plein de l'écran. */}
        <Section
          variant="feature"
          label="La séance"
          title={hasPlan ? "Ce que tu devrais travailler maintenant" : <MathInline text={nextAction.title} />}
          /* Le chapeau justifie CE QUI EST AFFICHÉ, jamais autre chose.
             Quand un plan existe mais que sa première recommandation ne porte
             aucune raison explicite, on retombait sur `nextAction.description`
             — la justification d'un exercice qui, lui, n'apparaît nulle part
             sur l'écran (« Tu n'as pas encore travaillé cet exercice. » :
             lequel ?). Mieux vaut pas de phrase du tout : le bloc
             « Maintenant » dit déjà l'intention et la matière. */
          description={hasPlan ? planReason ?? undefined : nextAction.description}
          action={
            <SegmentedControl
              ariaLabel="Durée de la séance"
              value={planMinutes}
              onChange={setPlanMinutes}
              options={PLAN_DURATION_PRESETS.map((preset) => ({ value: preset, label: `${preset} min` }))}
            />
          }
        >
          {hasPlan && (
            /*
             * MAINTENANT, PUIS — pas un sommaire de trois lignes égales.
             *
             * Le plan se lisait comme une table des matières : trois rangées
             * de même poids, numérotées, qu'il fallait parcourir pour
             * comprendre par quoi commencer. Or la question posée en ouvrant
             * l'application le matin n'est pas « que contient ma séance »,
             * c'est « je fais quoi, là, tout de suite » — et la réponse
             * tenait dans la même graisse que le reste.
             *
             * Le premier bloc est donc COMPOSÉ comme la réponse : son
             * intitulé en `t-heading`, sa durée en chiffre serif à droite,
             * son détail dessous. Ce qui suit reste une liste, en retrait.
             * Aucune donnée nouvelle, aucun calcul déplacé : exactement les
             * mêmes `dailyPlan.blocks`, dans le même ordre.
             */
            /*
             * Le `key` sur la durée demandée est la SEULE animation ajoutée à
             * cet écran, et elle est fonctionnelle : quand on passe de 45 à
             * 90 minutes, le plan change entièrement — intitulés, durées,
             * nombre de blocs — mais le texte se substituait d'une image à
             * l'autre, sans rien signaler. Un fondu de 180 ms dit « ceci
             * vient d'être recalculé ». Il est annulé par
             * `prefers-reduced-motion` comme tout le reste (voir
             * app/globals.css).
             */
            <div key={planMinutes} className="animate-fade-in border-y border-line">
              <div className="flex items-baseline gap-4 py-4">
                <div className="min-w-0 flex-1">
                  <p className="t-label mb-1.5">Maintenant</p>
                  <p className="t-heading">
                    {firstBlock.label}
                    <span className="text-muted"> — {PLAN_INTENT_META[firstBlock.intent].description}</span>
                  </p>
                  <p className="t-meta mt-1">
                    {firstBlock.focus} · {firstBlock.picks.length} exercice{firstBlock.picks.length > 1 ? "s" : ""}
                  </p>
                </div>
                <span className="t-figure-sm tabular shrink-0 whitespace-nowrap">
                  {firstBlock.estimatedMinutes}
                  <span className="t-meta"> min</span>
                </span>
              </div>

              {nextBlocks.length > 0 && (
                <ol className="border-t border-line pb-1 pt-3">
                  <li className="t-label mb-1">Puis</li>
                  {nextBlocks.map((block) => (
                    <li key={block.intent} className="flex items-baseline gap-3 py-1.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-ink">
                          {block.label}
                          <span className="text-muted"> — {PLAN_INTENT_META[block.intent].description}</span>
                        </p>
                        <p className="t-meta mt-0.5 truncate text-2xs">
                          {block.focus} · {block.picks.length} exercice{block.picks.length > 1 ? "s" : ""}
                        </p>
                      </div>
                      <span className="t-meta tabular shrink-0">{block.estimatedMinutes} min</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <p className="t-meta">
              {hasPlan ? (
                <>
                  <span className="font-medium text-ink">{formatMinutesSpan(dailyPlan.totalMinutes)}</span> ·{" "}
                  {dailyPlan.totalExercises} exercice{dailyPlan.totalExercises > 1 ? "s" : ""}
                  {objective.workedMinutes > 0 && <> · {objective.workedMinutes} min déjà faites aujourd&apos;hui</>}
                </>
              ) : nextAction.kind === "empty-bank" ? (
                "Ajoute des exercices pour que TaekdHub puisse te construire une séance."
              ) : (
                "Rien à planifier pour l'instant — ta banque est à jour."
              )}
            </p>
            {hasPlan ? (
              <Button size="lg" onClick={startPlan}>
                Commencer <ArrowRight size={16} />
              </Button>
            ) : (
              <Link href={sessionHref}>
                <Button size="lg">
                  {nextAction.ctaLabel} <ArrowRight size={16} />
                </Button>
              </Link>
            )}
          </div>
        </Section>

        {/* Le rappel de sauvegarde est une CORVÉE, pas une décision : posé en
            tête d'écran, il repoussait la séance d'une centaine de pixels et
            accueillait chaque semaine par un bandeau orange. Il reste
            exactement aussi visible, mais APRÈS ce qu'on est venu chercher. */}
        <BackupReminder />

        {/* ── REPRENDRE ─────────────────────────────────────────────
            Ce sur quoi on travaillait hier. Au tout début, il n'y a rien à
            reprendre : on propose alors d'entrer par une matière, plutôt que
            de laisser la colonne se terminer sur du vide. */}
        {resume.length > 0 ? (
          <Section label="Reprendre" title="Ce que tu travaillais">
            <List>
              {resume.map(({ exercise, at }) => (
                <li key={exercise.id}>
                  <Link href={`/exercises?focus=${exercise.id}`} className={rowInteractive}>
                    <SubjectAvatar subject={exercise.subject} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink">
                        <MathInline text={exercise.title} />
                      </p>
                      <p className="t-meta mt-0.5 truncate">
                        {exercise.subject} · {relativeDay(at)}
                      </p>
                    </div>
                    <ChevronRight size={15} className="shrink-0 text-subtle" />
                  </Link>
                </li>
              ))}
            </List>
          </Section>
        ) : (
          subjects.length > 0 && (
            <Section label="Explorer" title="Ou entre par une matière" description="La banque entière, rangée par chapitre.">
              <List>
                {subjects.map((entry) => (
                  <li key={entry.subject}>
                    <Link href={`/exercises?subject=${encodeURIComponent(entry.subject)}`} className={rowInteractive}>
                      <SubjectAvatar subject={entry.subject} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="t-subhead truncate">{entry.subject}</p>
                        <p className="t-meta mt-0.5">
                          {entry.total} exercice{entry.total > 1 ? "s" : ""} · {entry.completionRate} % maîtrisés
                        </p>
                      </div>
                      <ChevronRight size={15} className="shrink-0 text-subtle" />
                    </Link>
                  </li>
                ))}
              </List>
            </Section>
          )
        )}

        {/* ── À CONSOLIDER ──────────────────────────────────────────── */}
        {toConsolidate.length > 0 && (
          <Section
            label="À consolider"
            title="Ces chapitres appellent du travail"
            description="Classés par urgence réelle, chacun justifié par tes tentatives datées."
          >
            <List>
              {toConsolidate.map(({ chapter, averageMastery, reasons, href, evidence }, index) => (
                <li key={chapter.id}>
                  <Link href={href} className={rowInteractive}>
                    {/* Le RANG, écrit.
                        La section annonce « classés par urgence réelle », mais
                        les maîtrises voisines (0 %, 3 %, 3 %, 4 %) ne
                        laissaient rien voir de ce classement : cinq lignes
                        d'apparence interchangeable. Le numéro dit ce que
                        l'ordre veut dire, exactement comme la liste des
                        priorités de l'écran Progression. */}
                    <span className="t-figure w-4 shrink-0 text-right text-sm text-subtle">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="t-subhead truncate">{chapter.label}</p>
                      <p className="t-meta mt-0.5 truncate">
                        {chapter.subject} · {reasons.join(" · ")}
                        {evidence.sinceDays !== null && (
                          <>
                            {" "}
                            · {evidence.attempts} tentative{evidence.attempts > 1 ? "s" : ""} sur {evidence.sinceDays} j
                          </>
                        )}
                      </p>
                    </div>
                    {/* La maîtrise est un CHIFFRE, pas une barre : sur cinq
                        lignes, cinq barres de longueurs voisines se comparent
                        moins bien que cinq nombres alignés. */}
                    <span
                      className={cn(
                        "t-figure tabular shrink-0 text-base",
                        averageMastery >= 75 ? "text-emerald-300" : averageMastery >= 40 ? "text-amber-300" : "text-rose-300"
                      )}
                    >
                      {averageMastery}
                      <span className="text-xs font-normal text-subtle"> %</span>
                    </span>
                    <ChevronRight size={15} className="shrink-0 text-subtle" />
                  </Link>
                </li>
              ))}
            </List>
          </Section>
        )}
      </div>
    </Split>
  );
}

/** « aujourd'hui » / « hier » / « il y a 4 jours » — jamais une date brute pour du travail récent. */
function relativeDay(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  return `il y a ${days} jours`;
}

/** Chiffre du rail — étiquette, valeur, précision. Une ligne, séparée par un filet. */
function RailFigure({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-3">
      <div className="min-w-0">
        <dt className="t-label">{label}</dt>
        {detail && <dd className="t-meta mt-0.5 text-2xs">{detail}</dd>}
      </div>
      <dd className="t-figure-sm flex shrink-0 items-center gap-1.5">
        {icon}
        {value}
      </dd>
    </div>
  );
}
