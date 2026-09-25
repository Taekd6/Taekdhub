"use client";

import { useRouter } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { applyOnboarding, snoozeOnboarding, type OnboardingDraft } from "@/lib/onboarding";
import { localData } from "@/lib/storage";

/**
 * BIENVENUE — l'accueil guidé du premier lancement (voir lib/onboarding.ts
 * pour QUI y est envoyé, et components/onboarding/* pour les écrans).
 *
 * Seul appelant de `usePrepahubData` sur cet écran : l'assistant et ses
 * écrans reçoivent tout en props, et c'est ici, et ici seulement, que les
 * préférences s'écrivent — une fois, au dernier écran.
 *
 * L'écriture part de ce qui est RÉELLEMENT enregistré à cet instant
 * (`localData.preferences()`), pas de la copie lue au montage : même
 * précaution que components/preferences-form.tsx, pour qu'une couleur
 * choisie dans un autre onglet pendant l'accueil ne soit pas écrasée.
 *
 * On y revient quand on veut depuis Réglages (« Refaire la configuration ») :
 * chaque écran s'ouvre alors sur les valeurs en vigueur.
 */
export default function BienvenuePage() {
  const router = useRouter();
  const { preferences, ready, savePreferences } = usePrepahubData();

  function finish(draft: OnboardingDraft) {
    savePreferences(applyOnboarding(localData.preferences(), draft));
    router.replace("/dashboard");
  }

  function skip() {
    snoozeOnboarding();
    router.replace("/dashboard");
  }

  return <OnboardingWizard preferences={preferences} ready={ready} onFinish={finish} onSkip={skip} />;
}
