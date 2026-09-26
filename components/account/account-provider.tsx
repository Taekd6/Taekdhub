"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { SyncDecisionDialog } from "@/components/account/sync-decision-dialog";
import { onLocalWrite, readFlag, writeRawSilently } from "@/lib/storage";
import { accountsEnabled, supabase } from "@/lib/supabase/client";
import { SyncEngine, type DecisionChoice, type PendingDecision, type SyncReport } from "@/lib/sync/engine";
import { announceDataChanged } from "@/lib/sync/events";
import { supabaseRemote } from "@/lib/sync/supabase-remote";

/**
 * COMPTE ET SYNCHRONISATION — un seul fournisseur, monté par l'enveloppe de
 * l'application (components/app-shell.tsx), donc actif sur toutes les pages.
 *
 * Ce qu'il fait, et rien de plus :
 *   1. écoute la session Supabase (connexion, lien magique, rechargement) ;
 *   2. au premier établissement d'une session, appelle `SyncEngine.signIn`
 *      et, s'il faut une décision (données locales + compte), l'AFFICHE —
 *      rien n'est envoyé ni remplacé avant la réponse de l'élève ;
 *   3. marque « à envoyer » chaque collection écrite localement, et envoie
 *      par lots (après une courte accalmie, au retour du réseau, au retour
 *      sur l'onglet, et régulièrement pour recevoir les autres appareils).
 *
 * Sans Supabase configuré, il ne fait RIEN : `status` vaut « désactivé » et
 * l'application reste strictement locale, comme avant.
 */

export type AccountStatus =
  /** Pas de Supabase sur ce déploiement. */
  | "désactivé"
  /** Lecture de la session en cours (premier rendu). */
  | "chargement"
  /** Personne n'est connecté : données locales seulement. */
  | "invité"
  | "synchronisation"
  | "à-jour"
  /** Des modifications attendent (réseau coupé, serveur injoignable). */
  | "en-attente"
  /** Une décision de l'élève est requise avant toute synchronisation. */
  | "décision"
  | "erreur";

export interface AccountUser {
  id: string;
  email: string | null;
}

export interface AccountContextValue {
  enabled: boolean;
  status: AccountStatus;
  user: AccountUser | null;
  lastSyncedAt: string | null;
  error: string | null;
  decision: PendingDecision | null;
  signInWithPassword(email: string, password: string): Promise<string | null>;
  signUp(email: string, password: string): Promise<{ error: string | null; needsConfirmation: boolean }>;
  sendMagicLink(email: string): Promise<string | null>;
  signOut(options: { wipe: boolean }): Promise<string | null>;
  resolveDecision(choice: DecisionChoice): Promise<void>;
  syncNow(): Promise<void>;
  hasPendingChanges(): boolean;
}

const AccountContext = createContext<AccountContextValue | null>(null);

/** Accès au compte depuis n'importe quel écran. Hors fournisseur (tests, pages isolées) : un compte désactivé. */
export function useAccount(): AccountContextValue {
  return useContext(AccountContext) ?? DISABLED;
}

const noop = async () => null;
const DISABLED: AccountContextValue = {
  enabled: false,
  status: "désactivé",
  user: null,
  lastSyncedAt: null,
  error: null,
  decision: null,
  signInWithPassword: noop,
  signUp: async () => ({ error: null, needsConfirmation: false }),
  sendMagicLink: noop,
  signOut: noop,
  resolveDecision: async () => {},
  syncNow: async () => {},
  hasPendingChanges: () => false,
};

/** Accalmie après une écriture locale avant d'envoyer (une saisie en entraîne souvent plusieurs). */
const PUSH_DEBOUNCE_MS = 2_000;
/** Relecture périodique du serveur, onglet visible — pour recevoir ce qu'un autre appareil a fait. */
const PULL_INTERVAL_MS = 120_000;
/** Pas plus d'une relecture au retour sur l'onglet dans cet intervalle. */
const FOCUS_THROTTLE_MS = 20_000;

/** Messages Supabase → phrases d'élève. Tout le reste : un message générique, jamais une trace technique. */
export function explainAuthError(message: string | undefined | null): string {
  const text = (message ?? "").toLowerCase();
  if (text.includes("invalid login credentials")) return "E-mail ou mot de passe incorrect.";
  if (text.includes("email not confirmed")) return "Confirme d'abord ton adresse avec le lien reçu par e-mail.";
  if (text.includes("already registered") || text.includes("already been registered")) return "Un compte existe déjà avec cet e-mail : connecte-toi.";
  if (text.includes("password") && (text.includes("at least") || text.includes("short") || text.includes("weak"))) return "Mot de passe trop court ou trop simple (8 caractères au moins).";
  if (text.includes("rate limit") || text.includes("too many") || text.includes("security purposes")) return "Trop de tentatives. Réessaie dans une minute.";
  if (text.includes("invalid") && text.includes("email")) return "Cette adresse e-mail n'est pas valide.";
  if (text.includes("fetch") || text.includes("network")) return "Pas de connexion au serveur. Vérifie ton réseau.";
  return "Ça n'a pas marché. Réessaie dans un instant.";
}

/** Retour d'un lien e-mail. SANS ancre : Supabase ajoute la session après un `#`, et une ancre existante la rendrait illisible. */
function redirectUrl(): string {
  return `${window.location.origin}/settings`;
}

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const engine = useMemo(
    () => (supabase ? new SyncEngine({ read: readFlag, write: writeRawSilently }, supabaseRemote(supabase)) : null),
    []
  );
  const [status, setStatus] = useState<AccountStatus>(accountsEnabled ? "chargement" : "désactivé");
  const [user, setUser] = useState<AccountUser | null>(null);
  const [decision, setDecision] = useState<PendingDecision | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Références pour les rappels hors rendu (écritures locales, minuteries).
  const userRef = useRef<AccountUser | null>(null);
  const decisionRef = useRef<PendingDecision | null>(null);
  const running = useRef<Promise<void> | null>(null);
  const again = useRef(false);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFocusPull = useRef(0);
  const handledUserId = useRef<string | null>(null);

  const applyReport = useCallback((report: SyncReport) => {
    if (report.pulled.length > 0 || report.merged.length > 0) announceDataChanged();
    if (report.failed.length > 0) {
      setStatus("en-attente");
      return;
    }
    setError(null);
    setLastSyncedAt(report.at);
    setStatus("à-jour");
  }, []);

  const failed = useCallback((cause: unknown) => {
    const offline = typeof navigator !== "undefined" && !navigator.onLine;
    setStatus(offline ? "en-attente" : "erreur");
    setError(offline ? null : cause instanceof Error ? explainAuthError(cause.message) : "La synchronisation a échoué.");
  }, []);

  /** Sérialise les cycles : un seul à la fois, et un de plus si on l'a demandé pendant. */
  const runExclusive = useCallback(async (task: () => Promise<void>) => {
    if (running.current) {
      again.current = true;
      return running.current;
    }
    const loop = async () => {
      do {
        again.current = false;
        await task();
      } while (again.current);
    };
    running.current = loop().finally(() => {
      running.current = null;
    });
    return running.current;
  }, []);

  const establish = useCallback(
    async (current: AccountUser) => {
      if (!engine) return;
      setStatus("synchronisation");
      try {
        const outcome = await engine.signIn(current.id);
        if (outcome.type === "decision") {
          decisionRef.current = outcome.decision;
          setDecision(outcome.decision);
          setStatus("décision");
          return;
        }
        handledUserId.current = current.id;
        applyReport(outcome.report);
      } catch (cause) {
        // Hors ligne au moment du login : on réessaiera, rien n'a été touché.
        handledUserId.current = null;
        failed(cause);
      }
    },
    [engine, applyReport, failed]
  );

  const syncNow = useCallback(async () => {
    const current = userRef.current;
    if (!engine || !current || decisionRef.current) return;
    await runExclusive(async () => {
      if (handledUserId.current !== current.id || engine.readMeta().ownerId !== current.id) {
        await establish(current);
        return;
      }
      setStatus("synchronisation");
      try {
        applyReport(await engine.sync(current.id));
      } catch (cause) {
        failed(cause);
      }
    });
  }, [engine, runExclusive, establish, applyReport, failed]);

  /* 1. La session. */
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      const next: AccountUser | null = session?.user ? { id: session.user.id, email: session.user.email ?? null } : null;
      // Hors du rappel : Supabase déconseille d'appeler le client depuis `onAuthStateChange`.
      setTimeout(() => {
        const previous = userRef.current;
        userRef.current = next;
        setUser(next);
        if (!next) {
          handledUserId.current = null;
          decisionRef.current = null;
          setDecision(null);
          setStatus("invité");
          return;
        }
        if (previous?.id !== next.id || handledUserId.current !== next.id) void runExclusive(() => establish(next));
      }, 0);
    });
    return () => data.subscription.unsubscribe();
  }, [establish, runExclusive]);

  /* 2. Les écritures locales. */
  useEffect(() => {
    if (!engine) return;
    return onLocalWrite((key) => {
      if (!engine.markDirty(key)) return;
      if (!userRef.current || decisionRef.current) return;
      setStatus((current) => (current === "à-jour" ? "en-attente" : current));
      if (pushTimer.current) clearTimeout(pushTimer.current);
      pushTimer.current = setTimeout(() => void syncNow(), PUSH_DEBOUNCE_MS);
    });
  }, [engine, syncNow]);

  /* 3. Réseau, onglet, minuterie. */
  useEffect(() => {
    if (!engine) return;
    const onOnline = () => void syncNow();
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastFocusPull.current < FOCUS_THROTTLE_MS) return;
      lastFocusPull.current = Date.now();
      void syncNow();
    };
    const interval = setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) void syncNow();
    }, PULL_INTERVAL_MS);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      if (pushTimer.current) clearTimeout(pushTimer.current);
    };
  }, [engine, syncNow]);

  /* ── Actions ── */

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    if (!supabase) return "Le compte n'est pas disponible sur cette version.";
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return authError ? explainAuthError(authError.message) : null;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) return { error: "Le compte n'est pas disponible sur cette version.", needsConfirmation: false };
    const { data, error: authError } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: redirectUrl() } });
    if (authError) return { error: explainAuthError(authError.message), needsConfirmation: false };
    return { error: null, needsConfirmation: !data.session };
  }, []);

  const sendMagicLink = useCallback(async (email: string) => {
    if (!supabase) return "Le compte n'est pas disponible sur cette version.";
    const { error: authError } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirectUrl(), shouldCreateUser: true } });
    return authError ? explainAuthError(authError.message) : null;
  }, []);

  const signOut = useCallback(
    async ({ wipe }: { wipe: boolean }) => {
      if (!supabase || !engine) return null;
      if (wipe && !engine.signOut({ wipe: true })) {
        return "Des modifications n'ont pas encore été envoyées. Reconnecte le réseau et attends la synchronisation avant d'effacer cet appareil.";
      }
      await supabase.auth.signOut();
      if (wipe) announceDataChanged();
      return null;
    },
    [engine]
  );

  const resolveDecision = useCallback(
    async (choice: DecisionChoice) => {
      const current = userRef.current;
      if (!engine || !current) return;
      setStatus("synchronisation");
      try {
        const report = await engine.resolveDecision(current.id, choice);
        decisionRef.current = null;
        setDecision(null);
        handledUserId.current = current.id;
        announceDataChanged();
        applyReport(report);
      } catch (cause) {
        // La décision reste affichée : rien n'a été perdu, on peut réessayer.
        setStatus("décision");
        setError(cause instanceof Error ? explainAuthError(cause.message) : "La synchronisation a échoué.");
      }
    },
    [engine, applyReport]
  );

  const hasPendingChanges = useCallback(() => engine?.hasPendingChanges() ?? false, [engine]);

  useEffect(() => {
    if (engine) setLastSyncedAt(engine.readMeta().lastSyncedAt);
  }, [engine]);

  const value = useMemo<AccountContextValue>(
    () =>
      engine
        ? { enabled: true, status, user, lastSyncedAt, error, decision, signInWithPassword, signUp, sendMagicLink, signOut, resolveDecision, syncNow, hasPendingChanges }
        : DISABLED,
    [engine, status, user, lastSyncedAt, error, decision, signInWithPassword, signUp, sendMagicLink, signOut, resolveDecision, syncNow, hasPendingChanges]
  );

  return (
    <AccountContext.Provider value={value}>
      {children}
      {decision && <SyncDecisionDialog decision={decision} error={error} onChoose={resolveDecision} onCancel={() => void signOut({ wipe: false })} />}
    </AccountContext.Provider>
  );
}
