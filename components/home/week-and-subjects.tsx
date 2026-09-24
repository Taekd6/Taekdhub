import Link from "next/link";
import type { CSSProperties } from "react";
import { ChevronRight } from "lucide-react";
import { Carousel } from "@/components/ui/carousel";
import { StackedColumns } from "@/components/ui/chart";
import { SubjectIllustration } from "@/components/ui/illustrations";
import { Meter } from "@/components/ui/progress";
import { SubjectTargetList } from "@/components/work/subject-targets";
import { cn } from "@/lib/cn";
import type { DayStack } from "@/lib/day-stack";
import type { SubjectTargetProgress } from "@/lib/subject-targets";
import { subjectMeta, subjects as allSubjects } from "@/lib/study";
import { formatMinutesSpan, formatSpan } from "@/lib/utils";
import type { Subject } from "@/lib/supabase/types";

/**
 * « TA SEMAINE » — deux tuiles de largeur INÉGALE (les colonnes, larges ; les
 * budgets, étroits), pour casser la rangée de cartes identiques du haut.
 *
 * Les colonnes restent en PALIERS DE GRIS, une marche par matière — sauf
 * AUJOURD'HUI, peint entier à l'accent : c'est la colonne qu'on cherche, et
 * la seule qui bouge encore. Les liserés entre segments restent, la
 * répartition par matière se lit donc toujours.
 *
 * Le check-in du soir (`checkin`) se range dessous, sur toute la largeur :
 * il ne s'affiche que le soir, tant qu'il n'est pas fait, et ne laisse rien
 * sinon.
 */
export function WeekTiles({
  week,
  targets,
  checkin,
}: {
  week: DayStack[];
  targets: SubjectTargetProgress[];
  checkin: React.ReactNode;
}) {
  const worked = allSubjects.filter((subject) => week.some((day) => day.segments.some((segment) => segment.subject === subject)));
  const columns = week.map((day) => ({
    id: day.key,
    label: day.label,
    title: day.longLabel,
    highlight: day.isToday,
    muted: day.isFuture,
    segments: day.segments.map((segment) => ({
      id: segment.subject,
      value: segment.seconds,
      color: day.isToday ? "rgb(var(--accent-ink-rgb))" : subjectMeta[segment.subject].fill,
    })),
  }));
  const aria = `Temps de travail de la semaine, jour par jour : ${week
    .filter((day) => !day.isFuture)
    .map((day) => `${day.longLabel}, ${formatSpan(day.totalSeconds)}`)
    .join(" ; ")}.`;

  return (
    <div className="grid gap-4 sm:gap-5 lg:grid-cols-12">
      <section aria-label="Jour par jour" className={cn("surface reveal flex min-w-0 flex-col p-6 sm:p-8", targets.length > 0 ? "lg:col-span-7" : "lg:col-span-12")}>
        <StackedColumns columns={columns} ariaLabel={aria} formatValue={(value) => formatSpan(value)} heightClassName="h-44 lg:h-56" />
        {worked.length > 0 && (
          <ul className="mt-6 flex flex-wrap gap-x-4 gap-y-2" aria-hidden>
            {worked.map((subject) => (
              <li key={subject} className="flex items-center gap-1.5 text-2xs font-semibold text-muted">
                <span className={cn("h-2 w-2 rounded-full", subjectMeta[subject].solid)} />
                {subject}
              </li>
            ))}
            <li className="flex items-center gap-1.5 text-2xs font-semibold text-muted">
              <span className="h-2 w-2 rounded-full bg-accent" />
              Aujourd&apos;hui
            </li>
          </ul>
        )}
      </section>

      {targets.length > 0 && (
        <section
          aria-labelledby="budgets-titre"
          className="surface reveal min-w-0 p-6 sm:p-8 lg:col-span-5"
          style={{ "--i": 1 } as CSSProperties}
        >
          <header className="mb-5 flex items-baseline justify-between gap-3">
            <h3 id="budgets-titre" className="t-subhead">
              Budgets par matière
            </h3>
            <Link href="/settings" className="inline-flex min-h-11 items-center gap-0.5 text-sm font-semibold text-accent hover:underline lg:min-h-8">
              Régler <ChevronRight size={14} strokeWidth={2.4} aria-hidden />
            </Link>
          </header>
          <SubjectTargetList rows={targets} />
        </section>
      )}

      {/* Le check-in prend TOUTE la largeur, sous les deux tuiles : glissé
          dans la tuile des colonnes, il l'allongeait de 500 px et laissait
          la tuile des budgets à moitié vide à côté. Le composant a sa propre
          carte (bordure, fond) ; l'enveloppe disparaît quand il ne rend rien. */}
      <div className="reveal empty:hidden lg:col-span-12">{checkin}</div>
    </div>
  );
}

export interface SubjectCard {
  subject: Subject;
  seconds: number;
  targetMinutes: number;
  dueReviews: number;
}

/**
 * GALERIE DES MATIÈRES — une carte par matière, dessin en tête, comme les
 * rangées « Découvrez la gamme » d'apple.com. Chaque carte EST un lien (elle
 * ne contient rien d'autre de cliquable) vers le suivi de la matière.
 *
 * Trois lignes et pas une de plus : le temps de la semaine face au budget,
 * la barre, et les révisions dues — ce qui fait qu'on a envie d'y aller.
 */
export function SubjectCarousel({ cards }: { cards: SubjectCard[] }) {
  return (
    <Carousel ariaLabel="Tes matières" itemClassName="w-[72%] sm:w-[17rem]">
      {cards.map((card) => {
        const percent = card.targetMinutes > 0 ? (card.seconds / 60 / card.targetMinutes) * 100 : 0;
        return (
          <Link
            key={card.subject}
            href={`/preparation?subject=${encodeURIComponent(card.subject)}`}
            className="surface lift group flex h-full min-h-[17rem] flex-col p-6"
          >
            <SubjectIllustration
              subject={card.subject}
              size={64}
              className="text-muted transition-[color,transform] duration-500 ease-[cubic-bezier(.16,1,.3,1)] group-hover:-translate-y-1 group-hover:text-ink motion-reduce:group-hover:translate-y-0"
            />
            <h3 className="t-heading mt-6">{card.subject}</h3>
            <p className="t-meta mt-1">
              <span className="tabular font-semibold text-ink">{formatSpan(card.seconds)}</span>
              {card.targetMinutes > 0 ? ` sur ${formatMinutesSpan(card.targetMinutes)} cette semaine` : " cette semaine"}
            </p>
            {card.targetMinutes > 0 && <Meter value={percent} className="mt-3" />}
            <p className="mt-auto flex items-center justify-between gap-2 pt-5 text-sm font-semibold">
              <span className={card.dueReviews > 0 ? "text-ink" : "text-subtle"}>
                {card.dueReviews > 0 ? `${card.dueReviews} révision${card.dueReviews > 1 ? "s" : ""} à faire` : "Aucune révision due"}
              </span>
              <ChevronRight size={18} strokeWidth={2.4} aria-hidden className="shrink-0 text-accent" />
            </p>
          </Link>
        );
      })}
    </Carousel>
  );
}
