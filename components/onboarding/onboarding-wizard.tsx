"use client";

import { ArrowRight, ChevronLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ProgressDots } from "@/components/onboarding/controls";
import { CapacityStep, ContestStep, GoalStep, NameStep, RecapStep, SubjectsStep, type StepProps } from "@/components/onboarding/steps";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/state";
import { cn } from "@/lib/cn";
import { draftFromPreferences, type OnboardingDraft } from "@/lib/onboarding";
import type { Preferences } from "@/lib/storage";

/**
 * ACCUEIL GUIDÉ — le cadre : une question par écran, des points de
 * progression, « Retour » et « Continuer » en pilules, « Plus tard » toujours
 * à portée.
 *
 * Tient le BROUILLON en mémoire et ne l'enregistre qu'au dernier écran
 * (`onFinish`) : aucune écriture intermédiaire, donc rien de bancal si
 * l'élève abandonne en route. Ne touche pas au stockage lui-même — la page
 * (app/(app)/bienvenue/page.tsx) lui passe les préférences et les deux
 * sorties, selon la règle « un seul `usePrepahubData` par écran ».
 *
 * MOUVEMENT. Chaque écran entre en glissant depuis le côté vers lequel on
 * avance (`.tab-in-next` / `.tab-in-prev`, app/globals.css) : l'œil comprend
 * « suivant » ou « précédent » sans lire. Sous `prefers-reduced-motion`, la
 * règle globale ramène l'animation à zéro — l'écran apparaît simplement.
 *
 * CLAVIER. Tout l'assistant est un `<form>` : Entrée dans n'importe quel
 * champ vaut « Continuer ». Les compteurs sont des `type="button"`, donc
 * les activer au clavier ne fait pas avancer par erreur.
 *
 * FOCUS. À chaque changement d'écran, le focus va au champ marqué
 * `data-autofocus`, sinon au titre : un lecteur d'écran annonce la nouvelle
 * question, et un utilisateur au clavier n'a pas à revenir en haut.
 */

const STEPS: { key: string; render: (props: StepProps & { onEdit: (step: number) => void }) => React.ReactNode }[] = [
  { key: "bienvenue", render: (props) => <NameStep {...props} /> },
  { key: "objectif", render: (props) => <GoalStep {...props} /> },
  { key: "matieres", render: (props) => <SubjectsStep {...props} /> },
  { key: "temps", render: (props) => <CapacityStep {...props} /> },
  { key: "concours", render: (props) => <ContestStep {...props} /> },
  { key: "recap", render: (props) => <RecapStep {...props} /> },
];

export function OnboardingWizard({
  preferences,
  ready,
  onFinish,
  onSkip,
}: {
  preferences: Preferences;
  ready: boolean;
  onFinish: (draft: OnboardingDraft) => void;
  onSkip: () => void;
}) {
  const [draft, setDraft] = useState<OnboardingDraft | null>(null);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const [finishing, setFinishing] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  // Vrai dès le premier déplacement : l'écran d'ouverture n'a ni glissement
  // d'entrée ni vol de focus.
  const [moved, setMoved] = useState(false);

  // Pré-remplissage UNE fois, dès que les vraies préférences sont lues :
  // avant `ready`, `preferences` vaut les défauts du rendu serveur.
  useEffect(() => {
    if (ready && draft === null) setDraft(draftFromPreferences(preferences));
  }, [ready, preferences, draft]);

  // Focus à l'arrivée sur un écran — sauf au tout premier affichage, où
  // voler le focus avant toute interaction surprendrait (et ouvrirait le
  // clavier d'un téléphone sans qu'on l'ait demandé).
  useEffect(() => {
    if (!moved || !panel.current) return;
    const target = panel.current.querySelector<HTMLElement>("[data-autofocus]") ?? panel.current.querySelector<HTMLElement>("h1");
    target?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step, moved]);

  if (!draft) {
    return (
      <div className="mx-auto max-w-[36rem] space-y-6" aria-busy>
        <Skeleton className="h-2 w-40" />
        <Skeleton className="h-14 w-14 rounded-full" />
        <Skeleton className="h-16 w-4/5" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const last = step === STEPS.length - 1;

  function go(next: number) {
    setMoved(true);
    setDirection(next > step ? "next" : "prev");
    setStep(Math.max(0, Math.min(STEPS.length - 1, next)));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;
    if (!last) return go(step + 1);
    setFinishing(true);
    onFinish(draft);
  }

  const props = {
    draft,
    onChange: (patch: Partial<OnboardingDraft>) => setDraft((current) => (current ? { ...current, ...patch } : current)),
    marginPercent: preferences.planningMarginPercent,
    onEdit: go,
  };

  return (
    <form onSubmit={submit} className="mx-auto flex min-h-[calc(100dvh-14rem)] max-w-[36rem] flex-col" aria-labelledby="step-title" noValidate>
      <div className="flex min-h-11 items-center justify-between gap-4">
        <ProgressDots count={STEPS.length} current={step} />
        {!last && (
          <Button type="button" variant="ghost" size="sm" onClick={onSkip}>
            Plus tard
          </Button>
        )}
      </div>

      <div
        key={STEPS[step].key}
        ref={panel}
        className={cn("mt-8 flex-1", moved && (direction === "next" ? "tab-in-next" : "tab-in-prev"))}
      >
        {STEPS[step].render(props)}
      </div>

      {/* Barre d'actions : collée en bas de l'écran sur téléphone (au-dessus
          de la barre d'onglets), pour que « Continuer » reste sous le pouce
          même sur l'écran des matières, le plus long. */}
      <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-10 -mx-4 mt-10 flex items-center gap-3 bg-canvas/95 px-4 py-3 backdrop-blur-xl lg:bottom-0 lg:py-5">
        {step > 0 && (
          <Button type="button" variant="secondary" size="icon" className="h-12 w-12 max-lg:h-12 max-lg:w-12" onClick={() => go(step - 1)} aria-label="Écran précédent">
            <ChevronLeft size={20} strokeWidth={2.5} aria-hidden />
          </Button>
        )}
        <Button type="submit" size="lg" className="flex-1" disabled={finishing}>
          {last ? "C'est parti" : step === 0 ? "Commencer" : "Continuer"}
          <ArrowRight size={18} strokeWidth={2.5} aria-hidden />
        </Button>
      </div>
    </form>
  );
}
