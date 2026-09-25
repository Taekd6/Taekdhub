"use client";

import { BookmarkPlus } from "lucide-react";
import { SubjectAvatar } from "@/components/subject-avatar";
import { SegmentedControl } from "@/components/ui/segmented";
import type { CSSProperties } from "react";
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
        {/* LE CONSTAT, quand il existe, dans une carte en dégradé : c'est la
            seule phrase de l'écran qui dit quoi faire de toutes ces lignes. */}
        {insight ? (
          <div className="grad-card tone-brand sheen p-4">
            <p className="text-[0.8125rem] font-bold opacity-85">Le constat</p>
            <p className="t-card-title mt-1">{insight.text}</p>
          </div>
        ) : (
          <p className="t-meta mt-1.5">
            <span className="block font-bold text-ink">Le constat</span>
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
          <p className="t-meta mt-2 text-2xs">
            <span className="tabular font-bold text-ink">{trend.recent}</span> ces {ERROR_PERIOD_DAYS} jours contre{" "}
            <span className="tabular font-bold text-ink">{trend.previous}</span> les {ERROR_PERIOD_DAYS} précédents
            {trend.direction === "stable" ? " — à peu près autant." : trend.direction === "hausse" ? " — plus." : " — moins."} Ce compte suit aussi ta
            régularité à noter.
          </p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[0.9375rem] font-black text-ink">Par type</p>
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
          /* UNE BARRE EN DÉGRADÉ PAR TYPE (refonte « Revolut clair ») : le
             type le plus fréquent en dégradé plein, les autres voilés. Le
             découpage par matière — des paliers de gris illisibles une fois
             la barre en couleur — n'est plus dessiné : il reste dit dans
             l'`aria-label` de chaque barre, et en toutes lettres dans « Par
             matière » juste dessous. */
          <ul className="mt-3 space-y-3">
            {byType.map((row, index) => (
              <li key={row.type}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className={cn("text-[0.875rem] font-bold", row.count > 0 ? "text-ink" : "text-muted")}>{ERROR_TYPE_META[row.type].label}</span>
                  <span className="tabular text-[0.8125rem] font-black text-ink">{row.count}</span>
                </div>
                <div
                  role="img"
                  aria-label={`${ERROR_TYPE_META[row.type].label} : ${row.count}${row.bySubject.length ? ` — ${row.bySubject.map((part) => `${part.subject} ${part.count}`).join(", ")}` : ""}`}
                  className="mt-1.5 h-2 overflow-hidden rounded-full bg-hairline/[0.07]"
                >
                  {row.count > 0 && (
                    <div
                      className={cn("grow-x h-full rounded-full", row.count === max ? "grad-brand" : "bg-[linear-gradient(90deg,rgb(var(--g1-rgb)/0.45),rgb(var(--g2-rgb)/0.45))]")}
                      style={{ width: `${(row.count / max) * 100}%`, "--i": index } as CSSProperties}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {bySubject.length > 0 && !subject && (
        <div>
          <p className="text-[0.9375rem] font-black text-ink">Par matière</p>
          <ul className="mt-2 divide-y divide-line">
            {bySubject.map((row) => (
              <li key={row.subject} className="flex items-center gap-3 py-2.5">
                <SubjectAvatar subject={row.subject} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.875rem] font-extrabold text-ink">{row.subject}</span>
                  <span className="block truncate text-2xs font-bold text-subtle">
                    {row.top ? `Surtout : ${ERROR_TYPE_META[row.top].label.toLowerCase()} (${row.byType[row.top]})` : row.total < ERROR_INSIGHT_MIN ? "Trop peu pour dégager un type" : "Pas de type nettement en tête"}
                  </span>
                </span>
                <span className="tabular shrink-0 text-[0.9375rem] font-black text-ink">{row.total}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {dominant && (
        <div className="well p-4">
          <p className="text-[0.8125rem] font-extrabold text-accent">Que faire · {ERROR_TYPE_META[dominant].label}</p>
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
    <details className="group px-1">
      <summary className="inline-flex min-h-9 cursor-pointer list-none items-center rounded-full bg-inset px-3.5 text-sm font-bold text-ink transition-colors hover:bg-hairline/[0.10] max-lg:min-h-11 [&::-webkit-details-marker]:hidden">
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
