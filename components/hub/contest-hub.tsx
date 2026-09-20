"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, CalendarClock } from "lucide-react";
import { Section } from "@/components/ui/section";
import { Stat, StatRow } from "@/components/ui/stat";
import { Meter } from "@/components/ui/progress";
import { Insufficient } from "@/components/progress/insufficient";
import { Skeleton } from "@/components/ui/state";
import { SubjectAvatar } from "@/components/exercises/exercise-badges";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { buildContestHub, HUB_WINDOW_DAYS } from "@/lib/hub";
import { describeConfidence } from "@/lib/analytics/trend";
import { formatAverage } from "@/lib/grades";
import { WORK_ITEM_KIND_META } from "@/lib/work-items";
import { formatSpan } from "@/lib/utils";
import { cn } from "@/lib/cn";

/**
 * HUB CONCOURS — « suis-je prêt ? », et non « que contient ma bibliothèque ? ».
 *
 * L'écran précédent était un CATALOGUE D'ANNALES : il listait les banques
 * présentes, comptait leurs fiches (« 534 exercices, 312 travaillés,
 * couverture 58 % »), et son action principale s'appelait « Travailler cette
 * banque ». C'est une vue de la banque d'exercices, utile, mais qui répond à
 * une question d'inventaire — pas à une question de préparation.
 *
 * Ce hub répond à la seconde : combien de jours reste-t-il, où en est chaque
 * matière, quelles épreuves arrivent, ce que donnent les DS déjà passés, et
 * ce qu'il reste à consolider. AUCUN EXERCICE n'y est compté ni nommé ; les
 * annales restent atteignables par un lien de sortie vers la banque.
 */
export function ContestHub() {
  const { exercises, sessions, chapters, workItems, grades, preferences, ready } = usePrepahubData();

  const model = useMemo(
    () => buildContestHub(exercises, sessions, chapters, workItems, grades, preferences),
    [exercises, sessions, chapters, workItems, grades, preferences]
  );

  if (!ready) return <Skeleton className="h-64 w-full" />;

  const { daysUntil, contestDate, subjects, deadlines, grades: gradeStats, gradeTrend, windowMinutes, toConsolidate } = model;

  return (
    <div className="space-y-9">
      {/* ── L'ÉCHÉANCE ──────────────────────────────────────────── */}
      <Section label="L'échéance" title="Compte à rebours" description="La date que tu as déclarée dans tes réglages — jamais devinée.">
        {daysUntil === null ? (
          <Insufficient
            what="Aucune date d'épreuve renseignée."
            how="Ajoute-la dans Réglages : tout ce qui suit se datera par rapport à elle."
          />
        ) : (
          <StatRow>
            <Stat label="Jours restants" value={daysUntil} size="lg" />
            <Stat label="Date déclarée" value={new Date(`${contestDate}T00:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} size="sm" />
            <Stat label={`Travaillé sur ${HUB_WINDOW_DAYS} jours`} value={formatSpan(windowMinutes * 60)} size="sm" />
          </StatRow>
        )}
      </Section>

      {/* ── OÙ EN EST CHAQUE MATIÈRE ────────────────────────────── */}
      <Section
        label="La couverture"
        title="Matière par matière"
        description="L'avancement et le temps réellement investi — pas un inventaire de fiches."
      >
        {subjects.length === 0 ? (
          <Insufficient what="Aucune matière à suivre pour l'instant." how="Le suivi démarre à la première séance enregistrée." />
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {subjects.map((line) => (
              <li key={line.subject} className="flex items-center gap-3 py-3">
                <SubjectAvatar subject={line.subject} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="t-subhead truncate">{line.subject}</p>
                  {/* « NON MESURÉ » plutôt que « 0 % acquis » : sans fiche
                      rattachée, l'avancement n'existe pas, il n'est pas nul. */}
                  <p className="t-meta mt-0.5">
                    {line.measured
                      ? `${line.completionRate} % acquis · maîtrise moyenne ${line.averageMastery} %`
                      : "Avancement non mesuré — aucune fiche rattachée"}
                    {line.fragileChapters > 0
                      ? ` · ${line.fragileChapters} chapitre${line.fragileChapters > 1 ? "s" : ""} à consolider`
                      : ""}
                  </p>
                </div>
                {line.measured && <Meter value={line.completionRate} className="w-16 shrink-0 max-sm:hidden" tone="neutral" />}
                <span
                  className={cn(
                    "t-figure-sm tabular shrink-0 whitespace-nowrap",
                    line.windowMinutes > 0 ? "text-ink" : "text-subtle"
                  )}
                >
                  {formatSpan(line.windowMinutes * 60)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* ── LES ÉPREUVES QUI ARRIVENT ───────────────────────────── */}
      <Section label="Ce qui arrive" title="Épreuves" description="Devoirs surveillés et préparations concours encore ouverts.">
        {deadlines.length === 0 ? (
          <Insufficient what="Aucune épreuve ouverte." how="Les DS et préparations se saisissent depuis l'écran Échéances." />
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {deadlines.slice(0, 6).map((priority) => (
              <li key={priority.item.id} className="flex items-baseline gap-3 py-3">
                <CalendarClock size={14} className="shrink-0 translate-y-0.5 text-subtle" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="t-subhead truncate">
                    {priority.item.title}
                    <span className="text-subtle"> · {WORK_ITEM_KIND_META[priority.item.kind].short}</span>
                  </p>
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

      {/* ── LES RÉSULTATS D'ÉPREUVE ─────────────────────────────── */}
      <Section
        label="Les résultats"
        title="Devoirs surveillés et concours"
        description="Seules les épreuves comptent ici — mélanger interros et DM dirait quelque chose que la donnée ne porte pas."
      >
        {gradeStats.count === 0 ? (
          <Insufficient what="Aucune note de DS ou de concours enregistrée." how="Les notes se saisissent depuis l'écran Progression." />
        ) : (
          <>
            <StatRow>
              <Stat label="Moyenne" value={gradeStats.average !== null ? `${formatAverage(gradeStats.average)}/20` : "—"} size="sm" />
              <Stat label="Épreuves notées" value={gradeStats.count} size="sm" />
              {gradeStats.latest && (
                <Stat
                  label="Dernière"
                  value={`${formatAverage((gradeStats.latest.score / gradeStats.latest.maxScore) * 20)}/20`}
                  detail={gradeStats.latest.title || undefined}
                  size="sm"
                />
              )}
            </StatRow>
            {gradeTrend.trend.direction !== "insuffisant" && (
              <p className="t-meta mt-3">
                Tes résultats d&apos;épreuve sont{" "}
                {gradeTrend.trend.direction === "stable" ? "stables" : `en ${gradeTrend.trend.direction}`}.
                {describeConfidence(gradeTrend.trend) ? ` ${describeConfidence(gradeTrend.trend)}` : ""}
              </p>
            )}
          </>
        )}
      </Section>

      {/* ── CE QU'IL RESTE À CONSOLIDER ─────────────────────────── */}
      <Section label="Et maintenant" title="À consolider" description="Les chapitres commencés les plus faibles, toutes matières confondues.">
        {toConsolidate.length === 0 ? (
          <p className="t-body">Rien de fragile parmi les chapitres que tu as commencés.</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {toConsolidate.map(({ subject, row }) => (
              <li key={`${subject}-${row.chapter.id}`} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1 truncate text-sm text-ink">
                  {row.chapter.label}
                  <span className="t-meta ml-2 text-2xs">{subject}</span>
                </span>
                <span className="tabular w-12 shrink-0 whitespace-nowrap text-right text-sm text-ink">{row.rate} %</span>
              </li>
            ))}
          </ul>
        )}
        {/* LE SEUL LIEN VERS LA BANQUE — les annales restent accessibles,
            elles ne structurent simplement plus cet écran. Sans paramètre :
            `?provenance=` n'existe pas côté banque, et inventer un filtre qui
            n'est pas implémenté produirait un lien qui ne filtre rien tout en
            prétendant le contraire. */}
        <Link href="/exercises" className="t-meta mt-4 inline-flex min-h-6 items-center gap-1.5 text-accent hover:underline max-lg:min-h-11">
          Ouvrir la banque d&apos;exercices <ArrowRight size={14} aria-hidden />
        </Link>
      </Section>
    </div>
  );
}
