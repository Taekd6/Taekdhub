"use client";

import { motion } from "framer-motion";
import { SubjectAvatar } from "@/components/exercises/exercise-badges";
import { cn } from "@/lib/cn";
import { deferredSubjects, longestSilence, SHORT_SESSION_DEBT_DAYS, SUBJECT_DEBT_DAYS, type SubjectCoverage } from "@/lib/coverage";
import type { Subject } from "@/lib/supabase/types";

/**
 * COUVERTURE — l'écran où TaekdHub dit ce qu'il ne fait PAS.
 *
 * Le produit sait déjà dire quoi travailler et pourquoi. Il ne savait pas
 * répondre à la question que se pose réellement un élève de prépa le soir :
 * « en suivant ce plan tous les jours, est-ce que je suis en train
 * d'abandonner quelque chose ? »
 *
 * ## Pourquoi une frise de SILENCE, et pas des jauges
 * Une jauge de complétion par matière dirait « Chimie 34 % » — un chiffre qui
 * pousse mécaniquement vers l'égalisation, alors qu'un déséquilibre de temps
 * est parfaitement légitime (60 % de maths un jour donné n'a rien d'anormal).
 * L'axe affiché ici n'est donc PAS un axe d'avancement mais un axe de
 * RÉCENCE : depuis combien de jours cette matière n'a-t-elle rien reçu. Le
 * seuil est tracé, visible, contestable — l'élève voit la règle, pas un score.
 *
 * ## Le chiffre de tête est un MAXIMUM
 * Jamais une moyenne : trois matières fraîches masqueraient une matière
 * abandonnée depuis un mois, ce qui est exactement la chose à voir.
 *
 * ## Ce qu'il ne prétend pas
 * « Sans contact » signifie « sans contact dans TaekdHub » — le travail fait
 * ailleurs est invisible, et les libellés le disent. Une matière jamais
 * ouverte n'est pas présentée comme délaissée : elle n'a peut-être simplement
 * pas encore été traitée en cours, information que l'app ne possède pas.
 */

/** Échelle de la frise : au-delà, on ne gradue plus — un mois sans contact et deux mois sont le même verdict. */
const AXIS_MAX_DAYS = 30;

function SilenceRow({ entry, willBeTouched }: { entry: SubjectCoverage; willBeTouched: boolean }) {
  const days = entry.daysSinceContact;
  const ratio = days === null ? 0 : Math.min(1, days / AXIS_MAX_DAYS);
  const late = entry.state === "délaissée";

  const status =
    entry.pendingCount === 0
      ? "rien en attente"
      : days === null
        ? "jamais ouverte"
        : days === 0
          ? "aujourd'hui"
          : `${days} j`;

  /* La piste : position = récence, jamais avancement. */
  const track = (
    <span className="relative block h-1.5 w-full rounded-full bg-inset" aria-hidden="true">
      {/* Repère du seuil — la règle est visible, donc contestable. */}
      <span
        className="absolute top-1/2 h-2.5 w-px -translate-y-1/2 bg-subtle/70"
        style={{ left: `${(SUBJECT_DEBT_DAYS / AXIS_MAX_DAYS) * 100}%` }}
      />
      {entry.engaged && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.25 }}
          className={cn("absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full", late ? "bg-rose-400" : "bg-emerald-400")}
          style={{ left: `calc(${ratio * 100}% - 5px)` }}
        />
      )}
    </span>
  );

  // En dessous de `sm`, la frise passe SOUS le libellé plutôt que de partager
  // la ligne : comprimée entre le nom et les deux colonnes de droite, elle ne
  // faisait plus qu'une trentaine de pixels — un axe de 30 jours sur 30 px ne
  // distingue plus 10 jours de 24, c'est-à-dire exactement ce qu'il doit
  // montrer. Deux lignes sur mobile, une seule dès que la place existe.
  return (
    <li className="py-2.5">
      <div className="flex items-center gap-3">
        <SubjectAvatar subject={entry.subject} size="sm" />
        <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-ink sm:w-32 sm:flex-none">{entry.subject}</span>

        <span className="hidden min-w-0 flex-1 sm:block">{track}</span>

        <span className={cn("shrink-0 text-right text-2xs tabular-nums sm:w-24", late ? "text-rose-300" : "text-subtle")}>{status}</span>

        {/* Ce que le plan du jour va réellement faire de cette matière. */}
        <span className="w-16 shrink-0 text-right text-2xs">
          {willBeTouched ? <span className="text-accent">au plan</span> : <span className="text-subtle">—</span>}
        </span>
      </div>

      <div className="mt-2 pl-8 sm:hidden">{track}</div>
    </li>
  );
}

export function CoveragePanel({
  coverage,
  touchedSubjects,
  scopedByGoals = false,
  className,
}: {
  coverage: SubjectCoverage[];
  /** Matières réellement présentes dans le plan qui va être lancé — permet de dire, sans le déduire, ce qui sera laissé de côté. */
  touchedSubjects: Subject[];
  /** `true` quand ce sont les objectifs qui pilotent la séance : la règle de réservation ne s'applique alors plus telle quelle (voir la note du bas). */
  scopedByGoals?: boolean;
  className?: string;
}) {
  // Tant qu'aucune séance n'a eu lieu, il n'y a rien à dire : quatre rails
  // vides sous un titre qui annonce un délaissement seraient un reproche
  // avant même la première séance — exactement ce que ce module refuse pour
  // les matières « jamais ouvertes ».
  if (coverage.length === 0 || !coverage.some((entry) => entry.engaged)) return null;

  const touched = new Set(touchedSubjects);
  const worst = longestSilence(coverage);
  const deferred = deferredSubjects(coverage, touchedSubjects);

  return (
    <div className={className}>
      {/* ── LE VERDICT ─────────────────────────────────────────────────── */}
      {worst && worst.state === "délaissée" ? (
        <p className="max-w-2xl text-[0.9375rem] leading-7">
          <span className="text-ink">
            Ton plus long silence : <span className="font-semibold">{worst.subject}</span>, {worst.daysSinceContact} jours.
          </span>{" "}
          <span className="text-muted">
            {deferred.some((entry) => entry.subject === worst.subject)
              ? "Le plan d'aujourd'hui n'y touche pas."
              : "Le plan d'aujourd'hui y consacre une place."}
          </span>
        </p>
      ) : worst ? (
        <p className="max-w-2xl text-[0.9375rem] leading-7 text-muted">
          Aucune matière ne décroche : le plus long silence est de {worst.daysSinceContact} jour
          {(worst.daysSinceContact ?? 0) > 1 ? "s" : ""} ({worst.subject}), sous le seuil de {SUBJECT_DEBT_DAYS} jours.
        </p>
      ) : (
        <p className="max-w-2xl text-[0.9375rem] leading-7 text-muted">
          Aucune séance enregistrée pour l&apos;instant — la couverture se construit à partir du travail réellement fait, pas de ce qui
          est proposé.
        </p>
      )}

      {/* ── LA FRISE ───────────────────────────────────────────────────── */}
      <ul className="mt-4 divide-y divide-hairline/[0.07]">
        {coverage.map((entry) => (
          <SilenceRow key={entry.subject} entry={entry} willBeTouched={touched.has(entry.subject)} />
        ))}
      </ul>

      <p className="mt-3 text-2xs leading-5 text-subtle">
        Position = jours depuis la dernière séance <em className="not-italic">dans TaekdHub</em> sur cette matière ; le repère marque{" "}
        {SUBJECT_DEBT_DAYS} jours. Ce n&apos;est pas un taux d&apos;avancement : un déséquilibre de temps entre matières est normal,
        un silence prolongé ne l&apos;est pas.
      </p>

      {/* ── CE QUE LE PLAN LAISSE DE CÔTÉ ──────────────────────────────── */}
      {deferred.length > 0 && (
        <div className="mt-4 rounded-lg border border-hairline/[0.09] px-3.5 py-3">
          <p className="text-[0.8125rem] text-ink">
            Aujourd&apos;hui, ce plan laisse de côté{" "}
            <span className="font-medium">{deferred.map((entry) => entry.subject).join(", ")}</span>.
          </p>
          <p className="mt-1 text-2xs leading-5 text-subtle">
            {scopedByGoals
              ? "Tes objectifs pilotent ce plan : chacun reçoit une part du temps et travaille dans son propre périmètre. Une matière hors de tes objectifs peut donc rester silencieuse tant qu'ils sont actifs."
              : `TaekdHub réserve une place à ta matière la plus en retard — sauf si cette place devait supprimer une partie annoncée de ta séance. Sur une séance courte, où il n'y a qu'un exercice, il faut ${SHORT_SESSION_DEBT_DAYS} jours de silence pour qu'une matière passe devant ton point faible du jour, contre ${SUBJECT_DEBT_DAYS} sur une séance plus longue.`}
          </p>
        </div>
      )}
    </div>
  );
}
