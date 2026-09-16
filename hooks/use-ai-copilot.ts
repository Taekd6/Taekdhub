"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { probeAIAvailability, requestHint } from "@/lib/ai/client";
import { nextHintLevel } from "@/lib/ai/ladder";
import type { AIContext, AIFailure, AIHintResponse, HintLevel } from "@/lib/ai/types";

/**
 * LIAISON REACT de la couche IA.
 *
 * Ce hook ne sait rien du fournisseur, du prompt ni du schéma : il gère
 * l'état d'une interaction (disponibilité, chargement, échec, échelle
 * parcourue) et rien d'autre. Toute la logique testable est en dessous, dans
 * des fonctions pures.
 *
 * AUCUN APPEL AUTOMATIQUE. Le seul appel réseau non déclenché par un clic est
 * la sonde de disponibilité, qui ne consomme aucun jeton et ne part qu'UNE
 * fois au montage. Un `useEffect` qui appellerait le modèle à chaque rendu est
 * exactement l'erreur que ce produit ne peut pas se permettre : l'élève paie
 * en attente, celui qui déploie paie en argent.
 */

export interface AICopilotState {
  /** `null` tant que la sonde n'a pas répondu — l'interface n'affiche rien pendant ce temps. */
  available: boolean | null;
  hints: AIHintResponse[];
  loading: boolean;
  failure: AIFailure | null;
  /** Prochain palier demandable, ou `null` quand l'échelle est épuisée. */
  nextLevel: HintLevel | null;
}

export function useAICopilot() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [hints, setHints] = useState<AIHintResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<AIFailure | null>(null);
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    probeAIAvailability(controller.signal).then((ok) => {
      if (!cancelled) setAvailable(ok);
    });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  // Un appel en vol quand le composant disparaît est un appel payé pour rien :
  // on l'abandonne.
  useEffect(() => () => inFlight.current?.abort(), []);

  const reset = useCallback(() => {
    inFlight.current?.abort();
    inFlight.current = null;
    setHints([]);
    setFailure(null);
    setLoading(false);
  }, []);

  const askNext = useCallback(
    async (context: AIContext, studentSaid?: string) => {
      const level = nextHintLevel(hints.length);
      if (level === null || loading) return;

      inFlight.current?.abort();
      const controller = new AbortController();
      inFlight.current = controller;
      setLoading(true);
      setFailure(null);

      const outcome = await requestHint({ task: "hint", level, context, studentSaid }, controller.signal);
      if (controller.signal.aborted) return;

      if (outcome.ok) setHints((previous) => [...previous, outcome.response]);
      else setFailure(outcome.failure);
      setLoading(false);
      inFlight.current = null;
    },
    [hints.length, loading]
  );

  const state: AICopilotState = { available, hints, loading, failure, nextLevel: nextHintLevel(hints.length) };
  return { ...state, askNext, reset };
}
