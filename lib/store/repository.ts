import { buildBackup, emptyState, normalizeState, readBackup, STATE_VERSION } from "@/lib/store/schema";
import type { AppState } from "@/lib/domain/types";

/**
 * ============================================================================
 * PERSISTANCE — une interface, une implémentation locale.
 * ============================================================================
 *
 * TaekdHub fonctionne aujourd'hui entièrement dans le navigateur
 * (`localStorage`). Le jour où les données doivent être partagées entre un
 * téléphone et un ordinateur, seule l'implémentation de `Repository` change :
 * l'application ne connaît que cette interface, jamais `localStorage`
 * directement. C'est la seule concession d'architecture faite à un futur
 * Supabase — et elle ne coûte rien aujourd'hui.
 *
 * `save` renvoie un BOOLÉEN, et l'appelant doit s'en servir. Un navigateur
 * peut refuser d'écrire (quota, navigation privée, stockage bloqué) : dans la
 * version précédente, cet échec était muet, l'élève voyait son travail
 * enregistré et le retrouvait disparu au rechargement. Le pire mode de
 * défaillance possible pour un outil de travail.
 */
export interface Repository {
  load(): AppState;
  save(state: AppState): boolean;
  /** Horodatage ISO du dernier refus d'écriture, `null` tant que tout passe. */
  lastFailure(): string | null;
  clear(): void;
}

export const STORAGE_KEY = "taekdhub:state";

let lastWriteFailure: string | null = null;

/** Consultable par n'importe quel composant (l'alerte de stockage), sans passer par une instance. */
export function lastStorageFailure(): string | null {
  return lastWriteFailure;
}

export function clearStorageFailure(): void {
  lastWriteFailure = null;
}

export class LocalStorageRepository implements Repository {
  load(): AppState {
    if (typeof window === "undefined") return emptyState();
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyState();
      return migrate(JSON.parse(raw) as unknown);
    } catch {
      // JSON illisible : on repart d'un état vide plutôt que de laisser
      // l'application planter au montage. La donnée brute reste sous la clé,
      // donc récupérable à la main si besoin.
      return emptyState();
    }
  }

  save(state: AppState): boolean {
    if (typeof window === "undefined") return false;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      lastWriteFailure = null;
      return true;
    } catch {
      lastWriteFailure = new Date().toISOString();
      return false;
    }
  }

  lastFailure(): string | null {
    return lastWriteFailure;
  }

  clear(): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Rien à faire de plus : l'état en mémoire est déjà réinitialisé.
    }
  }
}

/**
 * MIGRATIONS — un seul endroit, exécuté à la lecture.
 *
 * `version` est celle de l'état lu. Chaque palier futur s'ajoute ici, en
 * cascade ; `normalizeState` termine toujours le travail en garantissant les
 * invariants. Le format 1 est le premier du modèle « tâches » : les
 * sauvegardes de l'ancienne banque d'exercices ne sont volontairement PAS
 * converties — elles décrivaient des exercices, pas des tâches, et fabriquer
 * des tâches à partir de fiches d'exercices produirait un planning faux.
 */
function migrate(raw: unknown): AppState {
  const state = normalizeState(raw);
  if (state.version > STATE_VERSION) {
    // Sauvegarde venue d'une version plus récente : on la normalise avec ce
    // qu'on sait lire, sans la refuser. Perdre un champ inconnu est préférable
    // à perdre toutes les tâches.
    return { ...state, version: STATE_VERSION };
  }
  return state;
}

/* ─────────────────────────── SAUVEGARDE / RESTAURATION ─────────────────────────── */

export function backupFilename(now: Date = new Date()): string {
  return `taekdhub-sauvegarde-${now.toLocaleDateString("en-CA")}.json`;
}

export function serializeBackup(state: AppState, now: Date = new Date()): string {
  return JSON.stringify(buildBackup(state, now), null, 2);
}

export function parseBackup(text: string, now: Date = new Date()): AppState | null {
  try {
    return readBackup(JSON.parse(text) as unknown, now);
  } catch {
    return null;
  }
}

/** Déclenche le téléchargement de la sauvegarde — la seule action qui fonctionne encore quand le stockage est plein. */
export function downloadBackup(state: AppState, now: Date = new Date()): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([serializeBackup(state, now)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = backupFilename(now);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
