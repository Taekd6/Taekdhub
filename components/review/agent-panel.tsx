"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Download, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/ui/section";
import { Notice } from "@/components/ui/state";
import { AGENT_QUESTIONS, buildSnapshot } from "@/lib/agent/snapshot";
import { useStore } from "@/lib/store/store";

/**
 * ANALYSE PAR UN AGENT — poser une question sur SES données.
 *
 * Le principe, qui vaut plus que la fonctionnalité : l'agent reçoit un
 * INSTANTANÉ STRUCTURÉ (lib/agent/snapshot.ts) — les mêmes chiffres que ceux
 * affichés à l'écran, produits par les mêmes moteurs. Il ne redescend pas une
 * impression sur du texte : il raisonne sur la charge, les échéances et le
 * temps réellement travaillé, et ses réponses sont donc recoupables ligne à
 * ligne avec le bilan juste au-dessus.
 *
 * Deux chemins, selon le déploiement :
 *   — une clé `ANTHROPIC_API_KEY` est configurée : la question part vers
 *     `/api/agent`, qui n'entrepose rien ;
 *   — sinon, « Copier le contexte » met l'instantané dans le presse-papiers,
 *     à coller dans l'assistant de son choix. C'est précisément pour cela que
 *     l'instantané est auto-descriptif (il embarque son propre schéma).
 *
 * Les données restent dans le navigateur dans les deux cas : rien n'est
 * envoyé sans que l'élève ait cliqué.
 */
export function AgentPanel() {
  const { state } = useStore();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const snapshot = useMemo(() => buildSnapshot(state), [state]);

  async function ask(value: string) {
    const text = value.trim();
    if (!text || loading) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: text, snapshot }),
      });
      const data = (await response.json()) as { answer?: string; message?: string };
      if (!response.ok) setError(data.message ?? "L'analyse a échoué.");
      else setAnswer(data.answer ?? "");
    } catch {
      setError("Impossible de joindre le service d'analyse. Utilise « Copier le contexte ».");
    } finally {
      setLoading(false);
    }
  }

  async function copyContext() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Le presse-papiers est indisponible. Utilise « Télécharger » à la place.");
    }
  }

  function downloadContext() {
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `taekdhub-contexte-${snapshot.meta.today}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <Section
      variant="panel"
      label="Analyse"
      title="Demande un avis sur ton organisation"
      description="La question part avec un résumé structuré de tes données : tâches, échéances, disponibilités, charge, temps réel. Rien n'est envoyé sans ton clic."
    >
      <div className="space-y-4">
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void ask(question);
          }}
        >
          <Input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Est-ce que mon organisation de cette semaine est bonne ?"
            aria-label="Ta question"
            className="min-w-[14rem] flex-1"
          />
          <Button type="submit" disabled={loading || !question.trim()}>
            <Sparkles size={15} /> {loading ? "Analyse…" : "Analyser"}
          </Button>
        </form>

        <div className="flex flex-wrap gap-1.5">
          {AGENT_QUESTIONS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => {
                setQuestion(preset);
                void ask(preset);
              }}
              className="row-hover min-h-8 rounded-lg border border-line px-2.5 text-[0.8125rem] text-muted"
            >
              {preset}
            </button>
          ))}
        </div>

        {answer && (
          <div className="well p-4">
            <p className="t-body whitespace-pre-line">{answer}</p>
          </div>
        )}

        {error && <Notice tone="warning">{error}</Notice>}

        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <Button size="sm" variant="secondary" onClick={copyContext}>
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copié" : "Copier le contexte"}
          </Button>
          <Button size="sm" variant="ghost" onClick={downloadContext}>
            <Download size={14} /> Télécharger
          </Button>
          <span className="t-meta">
            {snapshot.tasks.length} tâches · {snapshot.workload.days.length} jours de charge · schéma inclus
          </span>
        </div>
      </div>
    </Section>
  );
}
