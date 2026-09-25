import { SubjectAvatar } from "@/components/subject-avatar";
import { Meter } from "@/components/ui/progress";
import { cn } from "@/lib/cn";
import { subjectMeta } from "@/lib/study";
import { SUBJECT_PACE_META, type SubjectTargetProgress } from "@/lib/subject-targets";
import { formatMinutesSpan, formatSpan } from "@/lib/utils";

/**
 * BUDGET PAR MATIÈRE — une ligne par matière suivie : fait / budget, une
 * barre, et le rythme en un mot.
 *
 * Deux tailles, une seule forme : `compact` pour un espace étroit,
 * `comfortable` pour l'accueil et Progression. Même composant partout pour
 * que « 2 h 10 / 4 h — en retard » se lise de la même façon aux deux
 * endroits.
 *
 * Les lignes viennent du PARENT (lib/subject-targets.ts#computeSubjectTargets,
 * appelé là où `usePrepahubData()` l'est déjà) : ce composant n'appelle pas
 * le hook, dont chaque instance tient sa propre copie de l'état — une
 * seconde instance serait restée figée après une saisie rapide.
 *
 * La barre est à la COULEUR DE LA MATIÈRE (refonte « Nuit ») : c'est elle
 * qui relie cette ligne à son segment dans l'anneau du jour et dans les
 * colonnes de la semaine. Le jugement, lui, est porté par le MOT (« en
 * retard » en ambre, « atteint » en vert) — une barre ambre sur la moitié
 * des matières un mercredi, c'est un écran qui a l'air en alerte alors qu'il
 * ne fait que constater.
 */
export function SubjectTargetList({
  rows,
  size = "compact",
}: {
  rows: SubjectTargetProgress[];
  size?: "compact" | "comfortable";
}) {
  const compact = size === "compact";
  return (
    <ul className={cn(compact ? "space-y-2.5" : "grid gap-x-8 gap-y-4 sm:grid-cols-2")}>
      {rows.map((row, index) => {
        const pace = SUBJECT_PACE_META[row.pace];
        return (
          <li key={row.subject} className={cn("flex min-w-0", compact ? "gap-2" : "items-start gap-3")}>
            {/* Une barre ne se lit pas au lecteur d'écran : la ligne entière
                est redite en une phrase, et la partie visuelle est masquée. */}
            <span className="sr-only">{`${row.subject} : ${formatSpan(row.doneSeconds)} sur ${formatMinutesSpan(row.targetMinutes)}, ${pace.label}.`}</span>
            {compact ? (
              <span
                aria-hidden
                className={cn(
                  "mt-px grid h-5 min-w-5 shrink-0 place-items-center rounded-full px-1 text-[0.625rem] font-extrabold leading-none",
                  subjectMeta[row.subject].className
                )}
              >
                {subjectMeta[row.subject].short}
              </span>
            ) : (
              <span aria-hidden className="contents">
                <SubjectAvatar subject={row.subject} size="md" />
              </span>
            )}
            <div className="min-w-0 flex-1" aria-hidden>
              <div className="flex items-baseline gap-2">
                <span className={cn("min-w-0 flex-1 truncate font-bold text-ink", compact ? "text-[0.8125rem] leading-[1.125rem]" : "text-sm")}>{row.subject}</span>
                <span className={cn("tabular shrink-0 whitespace-nowrap", compact ? "text-2xs" : "text-[0.8125rem]")}>
                  <span className="font-bold text-ink">{formatSpan(row.doneSeconds)}</span>
                  <span className="text-muted"> / {formatMinutesSpan(row.targetMinutes)}</span>
                </span>
              </div>
              <Meter value={row.percent} index={index} className={compact ? "mt-1" : "mt-2"} />
              {!compact && (
                <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-2xs">
                  <span className={cn("font-bold", pace.className)}>{pace.label}</span>
                  {row.remainingMinutes > 0 && (
                    <span className="text-subtle">
                      reste {formatMinutesSpan(row.remainingMinutes)}
                      {row.expectedMinutes > 0 && ` · ${formatMinutesSpan(row.expectedMinutes)} prévues à ce stade`}
                    </span>
                  )}
                </p>
              )}
            </div>
            {compact && <span className={cn("shrink-0 whitespace-nowrap text-2xs font-bold", pace.className)}>{pace.label}</span>}
          </li>
        );
      })}
    </ul>
  );
}
