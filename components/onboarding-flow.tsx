"use client";

import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useScrollLock } from "@/hooks/use-scroll-lock";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { ONBOARDING_TIME_CHOICES, ONBOARDING_TRACK_CHOICES, onboardingReadyMessage, type OnboardingTrack } from "@/lib/onboarding";
import { SEED_FLAG_KEY } from "@/lib/seed";

/**
 * Mini-onboarding premier lancement (Micro-sprint « Ah ouais ») — maximum 30
 * secondes, trois écrans, jamais bloquant. Monté une seule fois dans
 * `AppShell` (même emplacement que `StorageErrorBanner`), au-dessus de
 * n'importe quelle page.
 *
 * Détection du premier lancement : réutilise `SEED_FLAG_KEY`
 * (lib/seed.ts) — le marqueur "premier lancement" DÉJÀ existant, jamais un
 * second mécanisme. Le posant en `useLayoutEffect` (jamais un `useEffect`) :
 * React garantit que TOUS les `useLayoutEffect` de l'arbre s'exécutent avant
 * le moindre `useEffect` d'un même montage — donc avant l'amorçage de la
 * banque (hooks/use-prepahub-data.ts#maybeSeedBank, qui pose ce même
 * marqueur dans un `useEffect`), quel que soit l'ordre des composants dans
 * l'arbre. Sans cette garantie, le marqueur pourrait déjà être posé au
 * moment de la lecture, y compris pour un tout premier lancement.
 *
 * `visible` vaut `null` tant que la détection n'a pas eu lieu (rendu :
 * rien) — jamais un flash, jamais de divergence serveur/client au premier
 * paint (le rendu serveur ne voit jamais `localStorage`).
 */
export function OnboardingFlow() {
  const [visible, setVisible] = useState<boolean | null>(null);

  useLayoutEffect(() => {
    try {
      setVisible(localStorage.getItem(SEED_FLAG_KEY) === null);
    } catch {
      // Stockage indisponible (navigation privée, quota…) : ne jamais bloquer
      // l'accès à l'app pour un simple problème d'affichage d'accueil.
      setVisible(false);
    }
  }, []);

  if (!visible) return null;
  return <OnboardingOverlay onDone={() => setVisible(false)} />;
}

type OnboardingStep = "welcome" | "goal" | "ready";

function OnboardingOverlay({ onDone }: { onDone: () => void }) {
  const { preferences, savePreferences } = usePrepahubData();
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [track, setTrack] = useState<OnboardingTrack | null>(null);
  useScrollLock(true);

  // Fermeture/skip (Étape 3 obligatoire du brief) : quel que soit l'écran,
  // toujours sûr — ne persiste RIEN de plus que ce qui a déjà été choisi
  // explicitement (voir `chooseGoal` ci-dessous, qui sauvegarde au moment du
  // clic, pas ici). Navigue vers /dashboard pour honorer le parcours décrit
  // ("[Commencer] → Dashboard") même si l'onboarding a été ouvert ailleurs.
  const finish = useCallback(() => {
    onDone();
    router.push("/dashboard");
  }, [onDone, router]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") finish();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [finish]);

  // Alimente `dailyGoalMinutes`, déjà existant (lib/storage.ts) — aucun
  // nouveau mécanisme. Sauvegardé immédiatement (pas différé à la fin du
  // parcours) : un abandon juste après ce choix le conserve quand même. Si
  // l'écriture échoue (stockage plein/indisponible), `savePreferences`
  // l'expose déjà globalement via `StorageErrorBanner` — l'onboarding n'a
  // rien de plus à faire que de continuer sans bloquer l'utilisateur.
  const chooseGoal = useCallback(
    (minutes: number) => {
      savePreferences({ ...preferences, dailyGoalMinutes: minutes });
      setStep("ready");
    },
    [preferences, savePreferences]
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[70] flex flex-col bg-canvas pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex justify-end px-4 py-4 sm:px-6">
        <Button variant="ghost" size="icon" aria-label="Fermer l'introduction" onClick={finish}>
          <X size={18} />
        </Button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-7 overflow-y-auto px-6 pb-10 text-center">
        <AnimatePresence mode="wait">
          {step === "welcome" && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="flex w-full max-w-xs flex-col items-center"
            >
              <p className="text-2xl font-semibold tracking-tight">Bienvenue sur TaekdHub 👋</p>
              <p className="mt-2 text-sm text-zinc-400">Ton espace de travail pour ta prépa.</p>
              <p className="mt-9 text-base font-semibold text-zinc-100">Tu prépares quelle année ?</p>
              <div className="mt-4 flex w-full flex-col gap-2.5">
                {ONBOARDING_TRACK_CHOICES.map((choice) => (
                  <Button
                    key={choice.value}
                    size="lg"
                    variant="secondary"
                    onClick={() => {
                      setTrack(choice.value);
                      setStep("goal");
                    }}
                  >
                    {choice.label}
                  </Button>
                ))}
              </div>
            </motion.div>
          )}

          {step === "goal" && (
            <motion.div
              key="goal"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="flex w-full max-w-xs flex-col items-center"
            >
              <p className="text-lg font-semibold text-zinc-100">Combien de temps veux-tu viser aujourd&apos;hui ?</p>
              <div className="mt-5 grid w-full grid-cols-2 gap-2.5">
                {ONBOARDING_TIME_CHOICES.map((choice) => (
                  <Button key={choice.minutes} size="lg" variant="secondary" onClick={() => chooseGoal(choice.minutes)}>
                    {choice.label}
                  </Button>
                ))}
              </div>
            </motion.div>
          )}

          {step === "ready" && (
            <motion.div
              key="ready"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="flex w-full max-w-xs flex-col items-center"
            >
              <p className="text-xl font-semibold tracking-tight text-zinc-100">{onboardingReadyMessage(track)}</p>
              <p className="mt-2 text-sm text-zinc-400">On commence ?</p>
              <Button size="lg" className="mt-7 w-full" onClick={finish}>
                Commencer <ArrowRight size={16} />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <button
        type="button"
        onClick={finish}
        className="focus-ring mx-auto mb-6 rounded-lg px-2 py-1 text-xs text-zinc-600 underline underline-offset-2 transition hover:text-zinc-400"
      >
        Passer <span className="no-underline">(Échap)</span>
      </button>
    </motion.div>
  );
}
