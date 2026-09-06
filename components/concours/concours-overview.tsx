"use client";

import Link from "next/link";
import { ChevronDown, Trophy } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Meter } from "@/components/ui/progress";
import { EmptyState, Skeleton } from "@/components/ui/state";
import { PageBar, Split } from "@/components/ui/layout";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { computeConcoursCatalogue, summarizeConcours, type ConcoursBank } from "@/lib/concours";
import { cn } from "@/lib/cn";

/**
 * ÉCRAN CONCOURS.
 *
 * Il n'existait pas : les 96 exercices de concours n'étaient atteignables
 * qu'en devinant qu'un sélecteur « Tous concours », perdu au milieu de dix
 * autres, existait quelque part dans la barre de filtres. Toute la
 * métadonnée patiemment vérifiée — banque, année, épreuve, filière, numéro —
 * n'était visible nulle part.
 *
 * La représentation n'est PAS un tableau. Un tableau demande de lire des
 * colonnes pour comprendre une ligne ; ici, chaque banque est une NOTICE :
 * son nom en grand, ce qu'elle contient en une phrase, sa couverture en une
 * mesure. On la déplie pour voir ses sessions (année × épreuve), on clique
 * pour aller travailler dessus.
 */
export function ConcoursOverview() {
  const { exercises, ready } = usePrepahubData();
  const banks = useMemo(() => computeConcoursCatalogue(exercises), [exercises]);
  const summary = useMemo(() => summarizeConcours(banks), [banks]);

  if (!ready) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (banks.length === 0) {
    return (
      <EmptyState
        icon={Trophy}
        title="Aucun exercice de concours pour l'instant."
        description="Les exercices importés d'une banque de concours apparaîtront ici, regroupés par concours puis par session."
      />
    );
  }

  return (
    <Split
      railLabel="Vue d'ensemble des annales"
      rail={
        <div className="space-y-8">
          <dl className="divide-y divide-line border-y border-line">
            <RailStat label="Banques" value={String(summary.banks)} />
            <RailStat label="Exercices" value={String(summary.total)} />
            <RailStat label="Vérifiés" value={String(summary.verified)} detail="concours + année + épreuve + numéro" />
            <RailStat
              label="Maîtrisés"
              value={`${summary.completionRate} %`}
              detail={`${summary.mastered} sur ${summary.total}`}
            />
          </dl>

          {/* La règle de provenance n'est pas une note de bas de page : c'est
              la promesse qui rend cet écran utilisable pour réviser. Elle
              reste donc à l'écran à côté des banques, pas 800 px plus bas. */}
          <div>
            <p className="t-label mb-2">Ce que « vérifié » veut dire</p>
            <p className="t-meta">
              Un exercice n&apos;est présenté comme <strong className="font-medium text-ink">sujet de concours vérifié</strong>{" "}
              que si sa source établit à la fois le concours, l&apos;année, l&apos;épreuve et son numéro. Quand l&apos;un
              de ces éléments manque, il porte la mention <em>session inconnue</em> et rien n&apos;est complété à sa
              place. Aucun exercice reformulé ou généré ne porte ce badge.
            </p>
          </div>
        </div>
      }
    >
      <div className="space-y-8">
        <PageBar
          title="Concours"
          lede="Les banques réellement présentes dans ta bibliothèque, avec ce que leur source établit — et rien de plus."
        />
        <div className="space-y-4">
          {banks.map((bank) => (
            <BankCard key={bank.competition} bank={bank} />
          ))}
        </div>
      </div>
    </Split>
  );
}

/** Mesure du rail — étiquette à gauche, valeur en serif à droite. */
function RailStat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-3">
      <div className="min-w-0">
        <dt className="t-label">{label}</dt>
        {detail && <dd className="t-meta mt-0.5 text-2xs">{detail}</dd>}
      </div>
      <dd className="t-figure-sm shrink-0">{value}</dd>
    </div>
  );
}

function BankCard({ bank }: { bank: ConcoursBank }) {
  const [open, setOpen] = useState(false);

  /** Une phrase, pas une grille d'étiquettes : ce que contient la banque se lit. */
  const description = [
    bank.years.length > 0 &&
      (bank.years.length === 1
        ? `session ${bank.years[0]}`
        : `sessions ${bank.years[bank.years.length - 1]}–${bank.years[0]}`),
    bank.epreuves.length > 0 && bank.epreuves.join(", "),
    bank.filieres.length > 0 && `filière${bank.filieres.length > 1 ? "s" : ""} ${bank.filieres.join(" · ")}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="surface overflow-hidden">
      <div className="flex flex-wrap items-start gap-x-6 gap-y-4 p-5">
        <div className="min-w-[14rem] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="t-heading">{bank.competition}</h2>
            {bank.verified > 0 && (
              <Badge variant="success">{bank.verified === bank.total ? "Vérifié" : `${bank.verified} vérifiés`}</Badge>
            )}
            {bank.partial > 0 && <Badge variant="warning">{bank.partial} partiels</Badge>}
          </div>
          <p className="t-meta mt-1.5">{description || "Session non établie par la source"}</p>
          <p className="t-meta mt-0.5">{bank.subjects.join(" · ")}</p>
        </div>

        <div className="flex items-start gap-8">
          <div>
            <p className="t-label">Exercices</p>
            <p className="t-figure-sm mt-1.5">{bank.total}</p>
          </div>
          <div>
            <p className="t-label">Travaillés</p>
            <p className="t-figure-sm mt-1.5">{bank.attempted}</p>
            <p className="t-meta mt-1 text-2xs">
              {bank.mastered} maîtrisé{bank.mastered > 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div className="w-full sm:w-40">
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="t-label">Couverture</span>
            <span className="tabular text-sm text-ink">{bank.completionRate} %</span>
          </div>
          <Meter
            value={bank.completionRate}
            tone={bank.completionRate >= 60 ? "success" : bank.completionRate > 0 ? "warning" : "neutral"}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3">
        <Link
          href={`/exercises?competition=${encodeURIComponent(bank.competition)}`}
          className="row-hover inline-flex items-center rounded-lg border border-line px-3 py-1.5 text-[0.8125rem] font-medium text-ink max-lg:min-h-11"
        >
          Travailler cette banque
        </Link>
        {bank.sessions.length > 1 && (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="row-hover inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[0.8125rem] text-muted hover:text-ink max-lg:min-h-11"
          >
            {bank.sessions.length} session{bank.sessions.length > 1 ? "s" : ""}
            <ChevronDown size={14} className={cn("transition-transform duration-150", open && "rotate-180")} />
          </button>
        )}
      </div>

      {open && (
        <ul className="animate-fade-in divide-y divide-line border-t border-line">
          {bank.sessions.map((session) => (
            <li key={session.key} className="flex items-center gap-4 px-5 py-2.5">
              <span className="tabular w-14 shrink-0 text-sm text-ink">{session.year ?? "—"}</span>
              <span className="t-meta min-w-0 flex-1 truncate">{session.epreuve ?? "Épreuve inconnue"}</span>
              <span className="t-meta tabular shrink-0">
                {session.mastered} / {session.total}
              </span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
