import { SubjectAvatar } from "@/components/exercises/exercise-badges";
import { Meter } from "@/components/ui/progress";
import { cn } from "@/lib/cn";
import { subjectMeta } from "@/lib/study";
import { SUBJECT_PACE_META, type SubjectTargetProgress } from "@/lib/subject-targets";
import { formatMinutesSpan, formatSpan } from "@/lib/utils";

/**
 * BUDGET PAR MATIÈRE — une ligne par matière suivie : fait / budget, un
 * trait, et le rythme en un mot.
 *
 * Deux tailles, une seule forme : `compact` pour le rail de l'accueil
 * (18 rem de large, regardé en passant), `comfortable` pour Progression
 * (lu posément). Même composant partout pour que « 2 h 10 / 4 h — en
 * retard » se lise de la même façon aux deux endroits.
 *
 * Les lignes viennent du PARENT (lib/subject-targets.ts#computeSubjectTargets,
 * appelé là où `usePrepahubData()` l'est déjà) : ce composant n'appelle pas
 * le hook, dont chaque instance tient sa propre copie de l'état — une
 * seconde instance serait restée figée après une saisie rapide.
 *
 * La barre reste à la couleur d'accent quel que soit le rythme, et passe au
 * vert une fois le budget atteint : c'est le MOT qui porte le jugement. Une
 * barre ambre sur la moitié des matières un mercredi, c'est un écran qui a
 * l'air en alerte alors qu'il ne fait que constater.
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
    <ul className="divide-y divide-line border-y border-line">
      {rows.map((row) => {
        const pace = SUBJECT_PACE_META[row.pace];
        return (
          <li key={row.subject} className={cn("flex", compact ? "gap-2 py-1.5" : "items-start gap-3 py-3")}>
            {/* Une barre ne se lit pas au lecteur d'écran : la ligne entière
                est redite en une phrase, et la partie visuelle est masquée. */}
            <span className="sr-only">{`${row.subject} : ${formatSpan(row.doneSeconds)} sur ${formatMinutesSpan(row.targetMinutes)}, ${pace.label}.`}</span>
            {compact ? (
              /* Dans le rail, la pastille pleine taille (22 px) doublait la
                 hauteur de chaque ligne pour une lettre : une marque de
                 16 px, alignée sur le nom, suffit à repérer la matière. */
              <span
                aria-hidden
                className={cn(
                  "mt-px grid h-4 min-w-4 shrink-0 place-items-center rounded px-0.5 text-[0.5625rem] font-semibold leading-none",
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
                <span className={cn("min-w-0 flex-1 truncate text-ink", compact ? "text-[0.8125rem] leading-[1.125rem]" : "text-sm")}>{row.subject}</span>
                <span className={cn("tabular shrink-0 whitespace-nowrap", compact ? "text-2xs" : "text-[0.8125rem]")}>
                  <span className="text-ink">{formatSpan(row.doneSeconds)}</span>
                  <span className="text-muted"> / {formatMinutesSpan(row.targetMinutes)}</span>
                </span>
              </div>
              <div className={cn("flex items-center gap-2", compact ? "mt-0.5" : "mt-1.5")}>
                <Meter value={row.percent} tone={row.pace === "atteint" ? "success" : "accent"} className="flex-1" />
                <span className={cn("shrink-0 whitespace-nowrap text-2xs", pace.className)}>{pace.label}</span>
              </div>
              {!compact && row.remainingMinutes > 0 && (
                <p className="t-meta mt-1 text-2xs">
                  Reste {formatMinutesSpan(row.remainingMinutes)}
                  {row.expectedMinutes > 0 && ` · à ce stade de la semaine, ${formatMinutesSpan(row.expectedMinutes)} étaient prévus`}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
