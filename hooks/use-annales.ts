"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useAccount } from "@/components/account/account-provider";
import { normalizeAnnaleLogs, type AnnaleLog } from "@/lib/annales";
import { readFlag, writeFlag } from "@/lib/storage";
import { supabase } from "@/lib/supabase/client";

/**
 * LES ANNALES DE L'ÉLÈVE — lues dans Supabase (`exercise_logs`), jamais
 * écrites ici : c'est le connecteur MCP qui les ajoute (voir lib/annales.ts).
 *
 * UN SEUL magasin pour toute l'application (module), partagé par l'accueil,
 * Le point et /annales : trois écrans ne déclenchent pas trois requêtes. On
 * relit au plus toutes les `STALE_MS`, et au retour sur l'onglet.
 *
 * COPIE LOCALE pour le hors-ligne : la dernière liste reçue est gardée,
 * marquée de l'identifiant du compte. Elle n'est relue que pour CE compte,
 * et elle est effacée dès que personne n'est connecté.
 */

const CACHE_KEY = "prepahub:annales-cache";
const STALE_MS = 5 * 60_000;
const COLUMNS = "id, created_at, matiere, chapitre, source, niveau, resultat, indices, temps_min, temps_prevu, erreurs, commentaire";
/** Avec la colonne `aide` (migration 0008) — essayée d'abord, puis sans elle tant que la migration n'est pas appliquée. */
const COLUMNS_WITH_HELP = `${COLUMNS}, aide`;

export type AnnalesStatus =
  /** Pas de Supabase sur ce déploiement. */
  | "désactivé"
  /** Personne n'est connecté : les annales vivent sur le compte. */
  | "invité"
  | "chargement"
  | "prêt"
  | "erreur";

interface Store {
  userId: string | null;
  logs: AnnaleLog[];
  fetchedAt: number;
  loading: boolean;
  error: string | null;
}

let store: Store = { userId: null, logs: [], fetchedAt: 0, loading: false, error: null };
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function setStore(patch: Partial<Store>) {
  store = { ...store, ...patch };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function readCache(userId: string): AnnaleLog[] | null {
  const raw = readFlag(CACHE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { userId?: unknown; rows?: unknown };
    return parsed.userId === userId ? normalizeAnnaleLogs(parsed.rows) : null;
  } catch {
    return null;
  }
}

function clearCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // Stockage bloqué : il n'y a rien à effacer.
  }
}

async function load(userId: string, force: boolean): Promise<void> {
  if (!supabase) return;
  if (!force && store.userId === userId && Date.now() - store.fetchedAt < STALE_MS) return;
  if (inFlight) return inFlight;

  if (store.userId !== userId) {
    // Un autre compte (ou le premier chargement) : on repart de la copie locale de CE compte.
    setStore({ userId, logs: readCache(userId) ?? [], fetchedAt: 0, error: null });
  }
  setStore({ loading: true });
  inFlight = (async () => {
    const query = (columns: string) => supabase!.from("exercise_logs").select(columns).order("created_at", { ascending: false }).limit(1000);
    let { data, error }: { data: unknown[] | null; error: { code?: string; message: string } | null } = await query(COLUMNS_WITH_HELP);
    // 42703 : colonne inconnue — la base n'a pas encore la migration 0008.
    if (error?.code === "42703") ({ data, error } = await query(COLUMNS));
    if (store.userId !== userId) return; // déconnecté entre-temps
    if (error) {
      setStore({ loading: false, error: error.message });
      return;
    }
    writeFlag(CACHE_KEY, JSON.stringify({ userId, rows: data }));
    setStore({ logs: normalizeAnnaleLogs(data), fetchedAt: Date.now(), loading: false, error: null });
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

export function useAnnales() {
  const account = useAccount();
  const snapshot = useSyncExternalStore(subscribe, () => store, () => store);
  const userId = account.user?.id ?? null;

  useEffect(() => {
    if (!account.enabled || account.status === "chargement") return;
    if (!userId) {
      clearCache();
      if (store.userId !== null) setStore({ userId: null, logs: [], fetchedAt: 0, error: null });
      return;
    }
    void load(userId, false);
    function onFocus() {
      if (document.visibilityState === "visible") void load(userId!, false);
    }
    document.addEventListener("visibilitychange", onFocus);
    return () => document.removeEventListener("visibilitychange", onFocus);
  }, [account.enabled, account.status, userId]);

  const refresh = useCallback(async () => {
    if (userId) await load(userId, true);
  }, [userId]);

  /** Supprime une annale saisie par erreur (la RLS n'autorise que les siennes). */
  const remove = useCallback(
    async (id: string): Promise<string | null> => {
      if (!supabase || !userId) return "Connecte-toi pour modifier tes annales.";
      const { error } = await supabase.from("exercise_logs").delete().eq("id", id);
      if (error) return error.message;
      setStore({ logs: store.logs.filter((log) => log.id !== id) });
      writeFlag(CACHE_KEY, JSON.stringify({ userId, rows: store.logs.map(toRow) }));
      return null;
    },
    [userId]
  );

  const mine = snapshot.userId !== null && snapshot.userId === userId;
  const status: AnnalesStatus = !account.enabled
    ? "désactivé"
    : account.status === "chargement"
      ? "chargement"
      : !userId
        ? "invité"
        : snapshot.error && (!mine || snapshot.logs.length === 0)
          ? "erreur"
          : mine && (snapshot.fetchedAt > 0 || snapshot.logs.length > 0)
            ? "prêt"
            : "chargement";

  return {
    status,
    logs: mine ? snapshot.logs : [],
    loading: snapshot.loading,
    error: snapshot.error,
    refresh,
    remove,
  };
}

/** `AnnaleLog` → la forme de la table, pour réécrire la copie locale après une suppression. */
function toRow(log: AnnaleLog) {
  return {
    id: log.id,
    created_at: log.createdAt,
    matiere: log.subjectLabel,
    chapitre: log.chapter,
    source: log.source,
    niveau: log.level,
    resultat: log.result,
    indices: log.hints,
    temps_min: log.minutes,
    temps_prevu: log.plannedMinutes,
    erreurs: log.errors,
    commentaire: log.comment,
    aide: log.helpDeclared ? log.help : null,
  };
}
