"use client";

import { useRouter } from "next/navigation";
import { sessionWrite } from "@/lib/storage";
import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Crosshair } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Section } from "@/components/ui/section";
import { SegmentedControl } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { SubjectAvatar } from "@/components/exercises/exercise-badges";
import { NotionDetail } from "@/components/notions/notion-detail";
import { NotionLegend, NotionSubjectBand } from "@/components/notions/notion-map";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { cn } from "@/lib/cn";
import {
  buildNotionSessionPlan,
  computeNotionEvidence,
  computeNotionOverview,
  findRootCauseNotions,
  resolveNotionChapters,
  type NotionEvidence,
} from "@/lib/notions";
import { PLAN_STORAGE_KEY } from "@/lib/plan";
import { subjects } from "@/lib/study";
import type { Subject } from "@/lib/supabase/types";

/**
 * RADIOGRAPHIE — le produit change de grain.
 *
 * Partout ailleurs, TaekdHub raisonne en CHAPITRES : « Nombres complexes » est
 * faible, « Thermochimie » mérite ton attention. C'est utile pour organiser une
 * séance, et insuffisant pour répondre à la seule question qui compte quand
 * quelque chose résiste : POURQUOI je bloque.
 *
 * Un élève qui échoue trois fois dans trois chapitres différents voit
 * aujourd'hui trois verdicts séparés. S'il se trouve que ces trois exercices
 * réclament tous « tableau d'avancement », la vraie réponse n'est aucun des
 * trois chapitres — c'est cette notion-là. La banque le sait depuis toujours
 * (`Exercise.prerequisites`), aucun écran ne le lisait.
 *
 * Cet écran lit cette donnée et rien d'autre. Il ne recalcule aucune
 * recommandation : `lib/notions.ts` compte des faits (résultats, indices), et
 * la séance ciblée passe par `StoredPlan`, le mécanisme déjà utilisé par le
 * Plan du jour et la Séance libre.
 *
 * ## Trois choses qu'il ne fait jamais
 * - inventer un niveau sur une notion jamais tentée (« jamais testée » est un
 *   état à part entière, visuellement en retrait, pas un score de départ) ;
 * - conclure sur un seul échec (une cause racine relie au moins deux exercices
 *   distincts) ;
 * - afficher un verdict sans son décompte (voir `NotionDetail`).
 */

type MapFilter = "piliers" | "testées" | "toutes";

/** Une notion « pilier » porte au moins deux exercices : c'est le seuil à partir duquel elle structure réellement le programme plutôt que de décrire un exercice isolé. */
const PILLAR_MIN_EXERCISES = 2;

export function NotionRadiography() {
  const { exercises, sessions, chapters, ready } = usePrepahubData();
  const router = useRouter();
  const [filter, setFilter] = useState<MapFilter>("piliers");
  const [subjectFilter, setSubjectFilter] = useState<Subject | "Toutes">("Toutes");
  const [selected, setSelected] = useState<string | null>(null);

  const model = useMemo(() => {
    const evidence = computeNotionEvidence(exercises, sessions);
    return {
      evidence,
      overview: computeNotionOverview(evidence),
      rootCauses: findRootCauseNotions(exercises, sessions),
    };
  }, [exercises, sessions]);

  const visible = useMemo(() => {
    return model.evidence.filter((item) => {
      if (subjectFilter !== "Toutes" && !item.subjects.includes(subjectFilter)) return false;
      if (filter === "piliers") return item.exercises.length >= PILLAR_MIN_EXERCISES;
      if (filter === "testées") return item.state !== "jamais testée";
      return true;
    });
  }, [model.evidence, filter, subjectFilter]);

  /** Regroupement par matière — une notion de plusieurs matières apparaît dans chacune : c'est un fait, pas un doublon à masquer. */
  const bands = useMemo(() => {
    return subjects
      .map((subject) => ({ subject, notions: visible.filter((item) => item.subjects.includes(subject)) }))
      .filter((band) => band.notions.length > 0);
  }, [visible]);

  const selectedEvidence = useMemo(
    () => (selected ? model.evidence.find((item) => item.notion === selected) ?? null : null),
    [selected, model.evidence]
  );

  /**
   * Dépose la séance ciblée puis navigue vers /session — exactement le même
   * geste que « Commencer le plan » du Dashboard, avec le même mécanisme de
   * transfert. Aucune sélection n'est recalculée côté /session.
   */
  const startNotionSession = useCallback(
    (evidence: NotionEvidence) => {
      sessionWrite(PLAN_STORAGE_KEY, JSON.stringify(buildNotionSessionPlan(evidence, sessions)));
      router.push("/session");
    },
    [sessions, router]
  );

  if (!ready) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Chargement de la radiographie">
        <div className="h-24 animate-pulse rounded-xl bg-inset" />
        <div className="h-64 animate-pulse rounded-xl bg-inset" />
      </div>
    );
  }

  if (model.overview.total === 0) {
    return (
      <EmptyState
        title="Aucune notion à cartographier"
        description="La carte se construit à partir des prérequis déclarés sur tes exercices. Importe la banque ou renseigne des prérequis pour la voir apparaître."
        action={
          <Button onClick={() => router.push("/exercises")}>
            Ouvrir la banque
            <ArrowRight size={16} />
          </Button>
        }
      />
    );
  }

  const { overview, rootCauses } = model;

  return (
    <div>
      {/* ── LE VERDICT ────────────────────────────────────────────────────
          Une phrase, honnête, qui change selon ce qui est réellement établi.
          Jamais de félicitations vagues ni d'alarme sans preuve. */}
      {/* Espace franc sous le titre de page : deux titres qui se touchent se
          concurrencent. Le verdict doit se lire comme une PHRASE qu'on adresse
          à l'élève, pas comme un sous-titre du gabarit. */}
      <motion.div className="mt-2" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        {rootCauses.length > 0 ? (
          <Verdict
            headline={
              <>
                {rootCauses[0].recentlyFailedExercises.length} exercices ratés.{" "}
                {rootCauses[0].chapterIds.length > 1 ? `${rootCauses[0].chapterIds.length} chapitres différents.` : "Un même chapitre."}{" "}
                <span className="text-accent">Une seule notion en commun.</span>
              </>
            }
            support={`TaekdHub a croisé les prérequis de tes échecs récents. Ce n'est pas un chapitre qui bloque — c'est « ${rootCauses[0].notion} ».`}
          />
        ) : overview.tested === 0 ? (
          <Verdict
            headline={
              <>
                <AnimatedNumber value={overview.total} format={(n) => Math.round(n).toLocaleString("fr-FR")} /> notions composent ta
                banque. <span className="text-accent">Aucune n&apos;est encore testée.</span>
              </>
            }
            support="La carte reste sombre tant que tu n'as rien démontré — aucune couleur n'est distribuée d'avance. Chaque séance en allumera une partie."
          />
        ) : (
          <Verdict
            headline={
              <>
                Tu as démontré <AnimatedNumber value={overview.solid} format={(n) => Math.round(n).toLocaleString("fr-FR")} /> notion
                {overview.solid > 1 ? "s" : ""} en autonomie, sur{" "}
                <AnimatedNumber value={overview.tested} format={(n) => Math.round(n).toLocaleString("fr-FR")} /> testée
                {overview.tested > 1 ? "s" : ""}.
              </>
            }
            support="Aucune notion ne relie plusieurs de tes échecs récents pour l'instant — rien ne bloque de façon transversale."
          />
        )}
      </motion.div>

      {/* ── CE QUI BLOQUE VRAIMENT ───────────────────────────────────────── */}
      {rootCauses.length > 0 && (
        <Section
          rank="primary"
          eyebrow="Ce qui bloque vraiment"
          title="La notion derrière tes échecs"
          description="Croisement des prérequis déclarés sur les exercices que tu as réellement ratés récemment. Une notion n'apparaît ici que si elle relie au moins deux exercices différents."
          className="mt-8"
        >
          <ul className="space-y-2.5">
            {rootCauses.slice(0, 3).map((cause) => (
              <RootCauseRow
                key={cause.notion}
                cause={cause}
                chapterLabels={resolveNotionChapters(cause, chapters).map((chapter) => chapter.label)}
                onInspect={() => setSelected(cause.notion)}
                onStart={() => startNotionSession(cause)}
              />
            ))}
          </ul>
        </Section>
      )}

      {/* ── LA CARTE + LE PANNEAU DE PREUVE ──────────────────────────────── */}
      <div className="mt-10 lg:grid lg:grid-cols-[1fr_360px] lg:items-start lg:gap-10">
        <div className="min-w-0">
          <Section
            eyebrow="Carte"
            title="Tout ce que ta banque demande"
            action={
              <SegmentedControl
                ariaLabel="Étendue de la carte"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "piliers", label: "Piliers" },
                  { value: "testées", label: "Testées" },
                  { value: "toutes", label: "Toutes" },
                ]}
              />
            }
          >
            <NotionLegend className="mb-4" />

            {/* Filtre matière — chips plutôt qu'un select : quatre matières
                portent du contenu, un menu déroulant serait un clic de trop. */}
            <div className="mb-4 flex flex-wrap gap-1.5">
              {(["Toutes", ...subjects.filter((subject) => model.evidence.some((item) => item.subjects.includes(subject)))] as const).map(
                (option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setSubjectFilter(option as Subject | "Toutes")}
                    aria-pressed={subjectFilter === option}
                    className={cn(
                      "focus-ring inline-flex min-h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors max-lg:min-h-10",
                      subjectFilter === option
                        ? "border-accent/40 bg-accent/10 text-accent"
                        : "border-hairline/[0.09] text-muted hover:bg-inset hover:text-ink"
                    )}
                  >
                    {option !== "Toutes" && <SubjectAvatar subject={option as Subject} size="sm" />}
                    {option}
                  </button>
                )
              )}
            </div>

            {bands.length === 0 ? (
              <EmptyState
                title="Rien à afficher avec ce filtre"
                description={
                  filter === "testées"
                    ? "Tu n'as encore testé aucune notion dans ce périmètre. Lance une séance : la carte s'allumera au fur et à mesure."
                    : "Aucune notion ne correspond à ce filtre."
                }
              />
            ) : (
              <div>
                {bands.map((band) => (
                  <NotionSubjectBand
                    key={band.subject}
                    subject={band.subject}
                    notions={band.notions}
                    selectedNotion={selected}
                    onSelect={(notion) => setSelected(notion.notion)}
                  />
                ))}
              </div>
            )}

            <p className="mt-5 border-t border-hairline/[0.07] pt-4 text-2xs leading-5 text-subtle">
              {overview.total} notions au total, dont {overview.crossChapter} présentes dans plusieurs chapitres et {overview.crossSubject}{" "}
              dans plusieurs matières.
              {filter === "piliers" && ` Le filtre « Piliers » n'affiche que celles réclamées par au moins ${PILLAR_MIN_EXERCISES} exercices.`}
            </p>
          </Section>
        </div>

        {/* Desktop : panneau collant, toujours à côté de la carte. Mobile : la
            même information dans une feuille (voir plus bas) — jamais deux
            rendus divergents, le même composant dans les deux cas. */}
        <aside className="mt-8 hidden lg:sticky lg:top-6 lg:mt-0 lg:block">
          {selectedEvidence ? (
            <div className="surface p-5">
              <NotionDetail evidence={selectedEvidence} chapters={chapters} onStartSession={() => startNotionSession(selectedEvidence)} />
            </div>
          ) : (
            <div className="surface p-5">
              <p className="eyebrow">Comment lire la carte</p>
              <p className="mt-2 text-[0.8125rem] leading-6 text-muted">
                Chaque tuile est une notion réclamée par tes exercices. Sa taille suit le nombre d&apos;exercices qui en dépendent, sa
                couleur ce que tu as <em className="not-italic text-ink">réellement démontré</em> — pas ce que tu as déclaré.
              </p>
              <p className="mt-3 text-[0.8125rem] leading-6 text-muted">
                Sélectionne une notion pour voir les preuves : tentatives, réussites sans indice, échecs, et les chapitres qu&apos;elle
                traverse.
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-hairline/[0.07] pt-4">
                <SummaryStat label="Solides" value={overview.solid} tone="success" />
                <SummaryStat label="En difficulté" value={overview.struggling} tone="danger" />
                <SummaryStat label="Fragiles" value={overview.fragile} tone="warning" />
                <SummaryStat label="Jamais testées" value={overview.untested} />
              </dl>
            </div>
          )}
        </aside>
      </div>

      <Sheet open={selectedEvidence !== null} onClose={() => setSelected(null)} title="Notion">
        {selectedEvidence && (
          <NotionDetail evidence={selectedEvidence} chapters={chapters} onStartSession={() => startNotionSession(selectedEvidence)} />
        )}
      </Sheet>
    </div>
  );
}

/** Le verdict de tête — grande typographie, aucune carte : c'est une phrase, pas un widget. */
function Verdict({ headline, support }: { headline: React.ReactNode; support: string }) {
  return (
    <div>
      <h2 className="max-w-3xl text-[1.5rem] font-semibold leading-[1.25] tracking-[-0.02em] sm:text-[2rem]">{headline}</h2>
      <p className="mt-3 max-w-2xl text-[0.9375rem] leading-7 text-muted">{support}</p>
    </div>
  );
}

function SummaryStat({ label, value, tone }: { label: string; value: number; tone?: "success" | "warning" | "danger" }) {
  return (
    <div>
      <dt className="text-2xs text-subtle">{label}</dt>
      <dd
        className={cn(
          "text-lg font-semibold tabular-nums",
          tone === "success" && "text-emerald-300",
          tone === "warning" && "text-amber-300",
          tone === "danger" && "text-rose-300",
          !tone && "text-ink"
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * Une cause racine — la notion, puis IMMÉDIATEMENT sa preuve : les exercices
 * ratés, nommés. Sans eux, ce ne serait qu'une accusation.
 */
function RootCauseRow({
  cause,
  chapterLabels,
  onInspect,
  onStart,
}: {
  cause: NotionEvidence;
  chapterLabels: string[];
  onInspect: () => void;
  onStart: () => void;
}) {
  return (
    <li className="well p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Crosshair size={15} className="shrink-0 text-rose-300" />
            <h3 className="truncate text-[0.9375rem] font-semibold tracking-tight">{cause.notion}</h3>
          </div>
          <p className="mt-1 text-2xs text-subtle">
            {cause.recentlyFailedExercises.length} exercices échoués
            {chapterLabels.length > 1 ? ` · ${chapterLabels.length} chapitres : ${chapterLabels.join(" · ")}` : chapterLabels.length === 1 ? ` · ${chapterLabels[0]}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="ghost" size="sm" onClick={onInspect}>
            Détail
          </Button>
          <Button size="sm" onClick={onStart}>
            Reconstruire
          </Button>
        </div>
      </div>

      <ul className="mt-3 space-y-1 border-t border-hairline/[0.07] pt-3">
        {cause.recentlyFailedExercises.map((exercise) => (
          <li key={exercise.id} className="flex items-center gap-2">
            <SubjectAvatar subject={exercise.subject} size="sm" />
            <span className="min-w-0 truncate text-[0.8125rem] text-muted">{exercise.title}</span>
          </li>
        ))}
      </ul>
    </li>
  );
}
