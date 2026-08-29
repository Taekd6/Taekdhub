"use client";

import Link from "next/link";
import { ArrowRight, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SubjectAvatar } from "@/components/exercises/exercise-badges";
import { cn } from "@/lib/cn";
import { NOTION_STATE_META, resolveNotionChapters, type NotionEvidence } from "@/lib/notions";
import type { Chapter } from "@/lib/storage";

/**
 * PANNEAU DE PREUVE — ce que TaekdHub sait de cette notion, et d'où il le sait.
 *
 * Chaque affirmation est accompagnée de son décompte. C'est la même exigence
 * que `ChapterConsolidation.evidence` (lib/next-action.ts), qui montre déjà
 * « sur combien de tentatives, depuis quand » plutôt qu'un verdict nu : un
 * élève — ou un professeur devant l'écran — doit pouvoir CONTESTER ce que
 * l'application affirme. Un panneau qui dirait « notion fragile » sans montrer
 * les trois tentatives derrière ne serait pas un diagnostic, ce serait une
 * opinion.
 */

/** Une ligne de compteur — n'apparaît que si elle a quelque chose à dire, jamais un « 0 » décoratif. */
function EvidenceRow({ label, value, tone }: { label: string; value: number; tone?: "success" | "danger" }) {
  if (value === 0) return null;
  return (
    <li className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-[0.8125rem] text-muted">{label}</span>
      <span
        className={cn(
          "text-sm font-semibold tabular-nums",
          tone === "success" && "text-emerald-300",
          tone === "danger" && "text-rose-300",
          !tone && "text-ink"
        )}
      >
        {value}
      </span>
    </li>
  );
}

export function NotionDetail({
  evidence,
  chapters,
  onStartSession,
}: {
  evidence: NotionEvidence;
  chapters: Chapter[];
  onStartSession: () => void;
}) {
  const reachedChapters = resolveNotionChapters(evidence, chapters);
  const meta = NOTION_STATE_META[evidence.state];

  return (
    <div>
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={meta.badge}>{meta.label}</Badge>
          {evidence.crossesSubjects && <Badge variant="accent">Plusieurs matières</Badge>}
        </div>
        <h2 className="mt-2.5 text-xl font-semibold leading-snug tracking-tight">{evidence.notion}</h2>
        <p className="t-meta mt-1.5">
          {evidence.exercises.length} exercice{evidence.exercises.length > 1 ? "s" : ""} de la banque {evidence.exercises.length > 1 ? "réclament" : "réclame"} cette notion.
        </p>
      </header>

      {/* CE QUE TU AS DÉMONTRÉ — ou l'aveu franc qu'il n'y a rien à montrer. */}
      <div className="mt-5">
        <p className="eyebrow mb-1">Ce que tu as démontré</p>
        {evidence.attempts === 0 ? (
          <p className="text-[0.8125rem] leading-6 text-muted">
            Aucune tentative enregistrée sur ces exercices. TaekdHub ne suppose rien : tant que tu n&apos;as rien tenté, cette notion
            reste simplement inconnue — ni acquise, ni fragile.
          </p>
        ) : (
          <ul className="divide-y divide-hairline/[0.07]">
            <EvidenceRow label="Tentatives" value={evidence.attempts} />
            <EvidenceRow label="Réussies seul (moins de 2 indices)" value={evidence.autonomousSuccesses} tone="success" />
            <EvidenceRow label="Réussies avec les indices" value={evidence.assistedSuccesses} />
            <EvidenceRow label="Échouées" value={evidence.failures} tone="danger" />
          </ul>
        )}
      </div>

      {/* LA PORTÉE — l'information qui n'existe nulle part ailleurs dans le produit. */}
      {reachedChapters.length > 0 && (
        <div className="mt-5">
          <p className="eyebrow mb-2">
            {evidence.crossesChapters ? `Présente dans ${reachedChapters.length} chapitres` : "Présente dans"}
          </p>
          <ul className="space-y-1">
            {reachedChapters.map((chapter) => (
              <li key={chapter.id} className="flex items-center gap-2">
                <SubjectAvatar subject={chapter.subject} size="sm" />
                <span className="min-w-0 truncate text-[0.8125rem] text-ink">{chapter.label}</span>
              </li>
            ))}
          </ul>
          {evidence.crossesChapters && (
            <p className="mt-2.5 flex items-start gap-1.5 text-2xs leading-5 text-subtle">
              <Layers size={13} className="mt-px shrink-0" />
              <span>
                Travailler cette notion sert dans {reachedChapters.length} chapitres à la fois — un lien que le suivi par chapitre ne
                peut pas montrer.
              </span>
            </p>
          )}
        </div>
      )}

      {/* LES EXERCICES — nommés, cliquables : la preuve est vérifiable. */}
      <div className="mt-5">
        <p className="eyebrow mb-2">Les exercices concernés</p>
        <ul className="space-y-0.5">
          {evidence.exercises.slice(0, 6).map((exercise) => (
            <li key={exercise.id}>
              <Link
                href={`/exercises?focus=${exercise.id}`}
                className="focus-ring group flex items-center gap-2.5 rounded-lg px-2 py-1.5 -mx-2 transition-colors hover:bg-inset"
              >
                <SubjectAvatar subject={exercise.subject} size="sm" />
                <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-ink">{exercise.title}</span>
                {/* La difficulté en chiffre, pas en pastilles : sur un panneau
                    de 360 px, les cinq points mangeaient la moitié du titre —
                    or ici c'est le titre qui identifie l'exercice. */}
                <span className="shrink-0 text-2xs tabular-nums text-subtle">{exercise.difficulty}/5</span>
                <ArrowRight size={13} className="shrink-0 text-subtle opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            </li>
          ))}
        </ul>
        {evidence.exercises.length > 6 && (
          <p className="mt-1.5 px-2 text-2xs text-subtle">+ {evidence.exercises.length - 6} autre{evidence.exercises.length - 6 > 1 ? "s" : ""}</p>
        )}
      </div>

      <Button className="mt-5 w-full" size="lg" onClick={onStartSession}>
        Travailler cette notion
        <ArrowRight size={16} />
      </Button>
      <p className="mt-2 text-center text-2xs text-subtle">
        Une séance des exercices qui la réclament, du plus abordable au plus exigeant.
      </p>
    </div>
  );
}
