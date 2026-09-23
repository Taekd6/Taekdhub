"use client";

import { BookmarkPlus } from "lucide-react";
import { SubjectAvatar } from "@/components/subject-avatar";
import { SegmentedControl } from "@/components/ui/segmented";
import { cn } from "@/lib/cn";
import {
  buildErrorInsight,
  computeErrorTrend,
  countBySubject,
  countByType,
  dominantType,
  ERROR_INSIGHT_MIN,
  ERROR_PERIOD_DAYS,
  ERROR_TYPE_META,
  recentErrors,
} from "@/lib/error-log";
import type { ErrorEntry } from "@/lib/storage";
import type { Subject } from "@/lib/supabase/types";

/**
 * Remplissage PLEIN de chaque matière, pour les segments de barre. Les
 * pastilles (`subjectMeta`) utilisent la teinte 400 à 22 % d'opacité — trop
 * pâle pour un segment de 6 px de haut. Mêmes jetons (`violet-400`,
 * `sky-400`…, définis en variables CSS dans tailwind.config.ts), opacité
 * pleine : la matière se reconnaît à sa couleur comme partout ailleurs.
 */
const SUBJECT_FILL: Record<Subject, string> = {
  Mathématiques: "bg-violet-400",
  Physique: "bg-sky-400",
  Chimie: "bg-amber-400",
  "Informatique TC": "bg-emerald-400",
  "Informatique Spé": "bg-teal-400",
  Français: "bg-orange-400",
  Anglais: "bg-rose-400",
};

export type StatsPeriod = "recent" | "all";

/**
 * CE QUI REVIENT — le rail du carnet d'erreurs.
 *
 * Tout est calculé dans lib/error-log.ts ; ce composant ne fait qu'afficher.
 * Ordre de lecture : le CONSTAT (une phrase, ou l'aveu qu'il n'y en a pas
 * encore), puis les barres par type qui le justifient, puis la ventilation
 * par matière, puis le CONSEIL — parce qu'un compte sans suite à donner
 * n'est qu'une statistique de plus.
 *
 * Les barres ne sont jamais la seule lecture : chaque ligne porte son compte
 * en chiffres, et la barre a un `aria-label` en toutes lettres.
 */
export function ErrorStats({
  errors,
  subject,
  period,
  onPeriod,
  now = new Date(),
}: {
  /** Le carnet entier. */
  errors: ErrorEntry[];
  /** Matière du filtre de la liste — les stats la suivent. */
  subject: Subject | null;
  period: StatsPeriod;
  onPeriod: (period: StatsPeriod) => void;
  now?: Date;
}) {
  const scoped = subject ? errors.filter((entry) => entry.subject === subject) : errors;
  const inPeriod = period === "recent" ? recentErrors(scoped, now) : scoped;
  const byType = countByType(inPeriod);
  const max = Math.max(1, ...byType.map((row) => row.count));
  const bySubject = countBySubject(inPeriod);
  const insight = buildErrorInsight(errors, now, subject);
  const trend = computeErrorTrend(scoped, now);
  const dominant = dominantType(inPeriod);
  const recentForSubject = subject ? recentErrors(scoped, now).length : (countBySubject(recentErrors(errors, now))[0]?.total ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <p className="t-label">Le constat</p>
        {insight ? (
          <p className="t-subhead mt-1.5 text-ink">{insight.text}</p>
        ) : (
          <p className="t-meta mt-1.5">
            Pas encore de constat : il faut au moins {ERROR_INSIGHT_MIN} erreurs notées sur {ERROR_PERIOD_DAYS} jours dans une matière
            {subject
              ? ` (${recentForSubject} en ${subject} pour l'instant)`
              : recentForSubject > 0
                ? ` (ta matière la plus fournie en compte ${recentForSubject})`
                : ""}
            , et un type nettement en tête.
          </p>
        )}
        {trend.direction !== "insuffisant" && (
          <p className="t-meta mt-1.5 text-2xs">
            <span className="tabular">{trend.recent}</span> erreur{trend.recent > 1 ? "s" : ""} notée{trend.recent > 1 ? "s" : ""} ces {ERROR_PERIOD_DAYS} jours
            contre <span className="tabular">{trend.previous}</span> les {ERROR_PERIOD_DAYS} précédents
            {trend.direction === "stable" ? " — à peu près autant." : trend.direction === "hausse" ? " — tu en as noté plus." : " — tu en as noté moins."} Ce
            compte suit aussi le nombre d&apos;épreuves et ta régularité à noter.
          </p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="t-label">Par type</p>
          <SegmentedControl
            size="sm"
            ariaLabel="Période des statistiques"
            value={period}
            onChange={onPeriod}
            className="max-w-[8.5rem]"
            options={[
              { value: "recent" as const, label: `${ERROR_PERIOD_DAYS} j` },
              { value: "all" as const, label: "Tout" },
            ]}
          />
        </div>
        {inPeriod.length === 0 ? (
          <p className="t-meta mt-2 text-2xs">Aucune erreur notée {period === "recent" ? `ces ${ERROR_PERIOD_DAYS} derniers jours` : "pour l'instant"}.</p>
        ) : (
          <ul className="mt-2.5 space-y-2.5">
            {byType.map((row) => (
              <li key={row.type}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className={cn("text-[0.8125rem]", row.count > 0 ? "text-ink" : "text-muted")}>{ERROR_TYPE_META[row.type].label}</span>
                  <span className="tabular text-2xs text-muted">{row.count}</span>
                </div>
                <div
                  role="img"
                  aria-label={`${ERROR_TYPE_META[row.type].label} : ${row.count}${row.bySubject.length ? ` — ${row.bySubject.map((part) => `${part.subject} ${part.count}`).join(", ")}` : ""}`}
                  className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-hairline/[0.10]"
                >
                  <div className="flex h-full" style={{ width: `${(row.count / max) * 100}%` }}>
                    {row.bySubject.map((part) => (
                      <span key={part.subject} className={cn("h-full", SUBJECT_FILL[part.subject])} style={{ width: `${(part.count / row.count) * 100}%` }} />
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {bySubject.length > 1 && (
          <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1" aria-label="Légende des couleurs">
            {bySubject.map((row) => (
              <li key={row.subject} className="t-meta inline-flex items-center gap-1.5 text-2xs">
                <span className={cn("h-2 w-2 rounded-full", SUBJECT_FILL[row.subject])} aria-hidden />
                {row.subject}
              </li>
            ))}
          </ul>
        )}
      </div>

      {bySubject.length > 0 && !subject && (
        <div>
          <p className="t-label">Par matière</p>
          <ul className="mt-2 divide-y divide-line border-y border-line">
            {bySubject.map((row) => (
              <li key={row.subject} className="flex items-center gap-2.5 py-2">
                <SubjectAvatar subject={row.subject} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.8125rem] text-ink">{row.subject}</span>
                  <span className="t-meta block truncate text-2xs">
                    {row.top ? `Surtout : ${ERROR_TYPE_META[row.top].label.toLowerCase()} (${row.byType[row.top]})` : row.total < ERROR_INSIGHT_MIN ? "Trop peu pour dégager un type" : "Pas de type nettement en tête"}
                  </span>
                </span>
                <span className="tabular shrink-0 text-2xs text-muted">{row.total}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {dominant && (
        <div className="rounded-lg bg-inset p-3">
          <p className="t-label">Que faire · {ERROR_TYPE_META[dominant].label}</p>
          <p className="mt-1 text-[0.8125rem] leading-5 text-ink">{ERROR_TYPE_META[dominant].advice}</p>
          {dominant === "cours" && (
            <p className="t-meta mt-1.5 inline-flex items-center gap-1 text-2xs">
              <BookmarkPlus size={12} aria-hidden /> Le bouton « À apprendre » de chaque erreur de cours le fait en un clic.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * « POURQUOI ÇA MARCHE » — replié par défaut, et prudent.
 *
 * Ce qui est établi : une erreur suivie d'une correction explicite est en
 * général bien corrigée ensuite, y compris — et même surtout — une erreur
 * commise avec assurance (Metcalfe, 2017, revue de synthèse). Ce qui ne
 * l'est pas : qu'un carnet d'erreurs, en soi, fasse monter les notes. Le
 * texte s'en tient au premier point et dit à quoi sert le classement.
 */
export function WhyItWorks() {
  return (
    <details className="group rounded-lg border border-line px-3 py-2">
      <summary className="t-meta min-h-6 cursor-pointer list-none text-2xs text-accent max-lg:flex max-lg:min-h-11 max-lg:items-center">
        Pourquoi ça marche
      </summary>
      <div className="t-meta mt-2 space-y-2 text-2xs leading-5">
        <p>
          Se tromper puis voir la bonne réponse n&apos;est pas du temps perdu : les travaux sur l&apos;apprentissage montrent qu&apos;une erreur suivie
          d&apos;une correction explicite est en général bien corrigée ensuite — y compris, et même surtout, celles commises avec assurance (Metcalfe,
          2017, <i>Annual Review of Psychology</i>). La condition, c&apos;est la correction : d&apos;où le champ « la bonne idée ».
        </p>
        <p>
          Classer ses erreurs ne corrige rien en soi. Ça sert à voir où porter l&apos;entraînement : du calcul ne se travaille pas comme un trou de cours.
        </p>
        <p>Les chiffres comptent ce que tu notes, pas tout ce que tu rates : ils valent ce que vaut ta régularité à noter.</p>
      </div>
    </details>
  );
}
