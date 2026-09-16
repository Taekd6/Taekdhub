"use client";

import { Sparkles, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RichMath } from "@/components/rich-math";
import { useAICopilot } from "@/hooks/use-ai-copilot";
import { HINT_LEVEL_LABELS, type AIContext } from "@/lib/ai/types";
import { MAX_HINT_LEVEL } from "@/lib/ai/ladder";

/**
 * L'ÉCHELLE D'INDICES, dans le focus.
 *
 * PAS DE CHATBOT. C'est la contrainte principale, et elle est structurelle :
 * une conversation ouverte invite à demander la réponse, et la réponse est
 * exactement ce qu'il ne faut pas donner à un élève qui bloque. L'interaction
 * est donc un ESCALIER — un bouton, un palier, une question avant chaque
 * aide — posé là où l'élève bloque réellement, pas dans un panneau latéral
 * permanent.
 *
 * Le composant ne s'affiche PAS tant que la disponibilité n'est pas connue, et
 * disparaît entièrement si le Copilot n'est pas configuré : l'absence d'IA
 * n'est pas un message d'erreur, c'est simplement l'application telle qu'elle
 * était avant.
 *
 * Reprend la géométrie des indices du professeur juste au-dessus (filet
 * vertical, contenu en serif) : l'élève lit une seule progression, pas deux
 * dispositifs concurrents.
 */
export function HintLadder({
  context,
  onHintUsed,
}: {
  context: AIContext;
  /** Remonte le nombre d'aides IA reçues — compté dans `hints_used` de la séance (voir lib/ai/ladder.ts#totalHintsUsed). */
  onHintUsed?: (count: number) => void;
}) {
  const { available, hints, loading, failure, nextLevel, askNext } = useAICopilot();
  const [studentSaid, setStudentSaid] = useState("");
  const [showInput, setShowInput] = useState(false);

  // Disponibilité inconnue ou absente : rien du tout. Pas de bouton grisé, pas
  // d'explication — l'élève qui n'a pas de Copilot ne doit pas apprendre son
  // existence par une case barrée.
  if (available !== true) return null;

  async function ask() {
    await askNext(context, studentSaid.trim() || undefined);
    onHintUsed?.(hints.length + 1);
  }

  return (
    <section className="mt-10 border-t border-line pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="t-label flex items-center gap-1.5">
          <Sparkles size={13} aria-hidden /> Coach de raisonnement
        </p>
        {hints.length > 0 && (
          <p className="t-meta tabular text-2xs">
            palier {hints.length} / {MAX_HINT_LEVEL}
          </p>
        )}
      </div>

      {hints.length === 0 && (
        <p className="t-meta mt-2">
          Il ne donne pas la solution : il te fait avancer d&apos;un cran à la fois, en partant de l&apos;énoncé et du corrigé
          de cette fiche.
        </p>
      )}

      {hints.map((hint) => (
        <div key={hint.level} className="animate-fade-in mt-6 border-l-2 border-accent/40 pl-4">
          <p className="t-label mb-1.5">
            Palier {hint.level} · {HINT_LEVEL_LABELS[hint.level]}
          </p>
          {/* LA QUESTION D'ABORD, l'aide ensuite : c'est tout l'objet du
              dispositif. L'élève doit avoir une chance d'y répondre seul. */}
          <p className="t-read text-ink">{hint.question}</p>
          <RichMath text={hint.hint} className="t-read-quiet mt-2 text-muted" />

          {/* Le doute est AFFICHÉ, jamais avalé — même discipline que
              `describeConfidence` côté analytique. */}
          {hint.insufficientData && (
            <p className="t-meta mt-2 flex items-start gap-1.5 text-2xs text-amber-200">
              <TriangleAlert size={12} className="mt-0.5 shrink-0" aria-hidden />
              Cette fiche ne contient pas assez d&apos;éléments pour aider sûrement — vérifie par toi-même.
            </p>
          )}
          {!hint.insufficientData && hint.confidence === "faible" && (
            <p className="t-meta mt-2 text-2xs">Indice peu sûr : recoupe-le avec ton cours.</p>
          )}
          {hint.usedSource === "connaissance générale" && (
            <p className="t-meta mt-1 text-2xs">
              Appuyé sur une connaissance générale, pas sur le corrigé de cette fiche.
            </p>
          )}
        </div>
      ))}

      {failure && (
        <p role="alert" className="t-meta mt-4 text-rose-300">
          {failure.message}
          {failure.code === "network" && " Tu peux continuer l'exercice sans lui."}
        </p>
      )}

      {showInput && (
        <label className="mt-5 block">
          <span className="t-label">Où est-ce que tu bloques ?</span>
          <textarea
            value={studentSaid}
            onChange={(event) => setStudentSaid(event.target.value)}
            rows={3}
            maxLength={1500}
            placeholder="« J'ai pensé à utiliser le théorème des accroissements finis mais je ne vois pas sur quel intervalle… »"
            className="mt-1.5 w-full resize-y rounded-lg border border-transparent bg-inset px-3 py-2.5 text-sm leading-7 text-ink placeholder:text-subtle hover:border-line"
          />
          <span className="t-meta mt-1 block text-2xs">
            Facultatif. Ce que tu écris ici part au Copilot pour qu&apos;il parte de TON raisonnement.
          </span>
        </label>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {nextLevel !== null && (
          <Button variant="secondary" size="sm" onClick={ask} disabled={loading}>
            <Sparkles size={15} />
            {loading ? "…" : hints.length === 0 ? "Aide-moi à démarrer" : `Palier ${nextLevel} · ${HINT_LEVEL_LABELS[nextLevel]}`}
          </Button>
        )}
        {nextLevel === null && <p className="t-meta">Tu as parcouru toute l&apos;échelle.</p>}
        {!showInput && (
          <Button variant="ghost" size="sm" onClick={() => setShowInput(true)}>
            Dire où je bloque
          </Button>
        )}
      </div>
    </section>
  );
}
