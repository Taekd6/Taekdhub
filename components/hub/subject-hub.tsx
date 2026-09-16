"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, CalendarClock } from "lucide-react";
import { Section } from "@/components/ui/section";
import { Stat, StatRow } from "@/components/ui/stat";
import { Meter } from "@/components/ui/progress";
import { SegmentedControl } from "@/components/ui/segmented";
import { Insufficient } from "@/components/progress/insufficient";
import { SubjectAvatar } from "@/components/exercises/exercise-badges";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { buildSubjectHub, hubSubjects, HUB_RECENT_DAYS, HUB_WINDOW_DAYS } from "@/lib/hub";
import { describeConfidence } from "@/lib/analytics/trend";
import { formatAverage } from "@/lib/grades";
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
  const { exercises, sessions, chapters, workItems, grades, preferences, ready } = usePrepahubData();

  const available = useMemo(() => hubSubjects(exercises, sessions, allSubjects), [exercises, sessions]);
  const [subject, setSubject] = useState<Subject | null>(null);
  const active = subject && available.includes(subject) ? subject : (available[0] ?? null);

  const model = useMemo(
    () => (active ? buildSubjectHub(active, exercises, sessions, chapters, workItems, grades, preferences) : null),
    [active, exercises, sessions, chapters, workItems, grades, preferences]
  );

  if (!ready) return <div className="h-64 animate-pulse rounded-xl bg-inset" />;

  if (!model || !active) {
    return (
      <Insufficient
        what="Aucune matière à suivre pour l'instant."
        how="Le suivi se remplit dès la première séance enregistrée, ou dès qu'une matière contient une fiche."
      />
    );
  }

  const { progress, workload, chapters: board, deadlines, grades: gradeStats, gradeTrend, nextChapter } = model;
  const rhythm = describeConfidence(workload.trend);
  const chapterCount = board.fragile.length + board.solid.length + board.untouched.length;

  return (
    <div className="space-y-9">
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
          <Stat label="Maîtrise moyenne" value={`${progress.averageMastery} %`} size="sm" />
          <Stat label="Progression" value={`${progress.completionRate} %`} size="sm" />
          <Stat label={`Ces ${HUB_RECENT_DAYS} jours`} value={formatSpan(workload.recentMinutes * 60)} size="sm" />
          <Stat
            label={`Sur ${HUB_WINDOW_DAYS} jours`}
            value={formatSpan(workload.windowMinutes * 60)}
            detail={workload.sharePercent !== null ? `${workload.sharePercent} % de ton temps` : undefined}
            size="sm"
          />
        </StatRow>
        <Meter value={progress.completionRate} className="mt-5" tone="neutral" />
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
        <Section label="Les résultats" title="Notes" description="Ce qu'un professeur a évalué — la seule mesure qui ne vienne pas de TaekdHub.">
          <StatRow>
            <Stat label="Moyenne" value={gradeStats.average !== null ? `${formatAverage(gradeStats.average)}/20` : "—"} size="sm" />
            <Stat label="Notes enregistrées" value={gradeStats.count} size="sm" />
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
              Tes notes en {active} sont{" "}
              {gradeTrend.trend.direction === "stable" ? "stables" : `en ${gradeTrend.trend.direction}`}.
              {describeConfidence(gradeTrend.trend) ? ` ${describeConfidence(gradeTrend.trend)}` : ""}
            </p>
          )}
        </Section>
      )}

      {/* ── LA SORTIE ───────────────────────────────────────────── */}
      <Section label="Et maintenant" title="À travailler ensuite">
        {nextChapter ? (
          <p className="t-body">
            <span className="font-medium text-ink">{nextChapter.chapter.label}</span> est le chapitre commencé le plus
            faible de cette matière — {nextChapter.rate} % de maîtrise
            {nextChapter.untouched > 0 ? `, et ${nextChapter.untouched} de ses fiches n'ont jamais été ouvertes` : ""}.
          </p>
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
          className="t-meta mt-4 inline-flex items-center gap-1.5 text-accent hover:underline"
        >
          Ouvrir la banque en {active} <ArrowRight size={14} aria-hidden />
        </Link>
      </Section>
    </div>
  );
}

/** Un groupe de chapitres — le taux et le compte, jamais la liste des fiches. */
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
  return (
    <div>
      <p className="t-label">{title}</p>
      {rows.length === 0 ? (
        <p className="t-meta mt-1.5 text-2xs">{empty}</p>
      ) : (
        <ul className="mt-2 divide-y divide-line border-y border-line">
          {rows.map((row) => (
            <li key={row.chapter.id} className="flex items-center gap-3 py-2.5">
              <span className={cn("min-w-0 flex-1 truncate text-sm", muted ? "text-muted" : "text-ink")}>
                {row.chapter.label}
                {/* Le COMPTE situe le chapitre ; il ne nomme aucune fiche. */}
                <span className="t-meta ml-2 text-2xs">
                  {row.mastered} / {row.total} acquis
                </span>
              </span>
              {!muted && <Meter value={row.rate} className="w-16 shrink-0 max-sm:hidden" tone="neutral" />}
              <span className="tabular w-12 shrink-0 whitespace-nowrap text-right text-sm text-ink">{row.rate} %</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
