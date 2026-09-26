import { STORAGE_KEYS } from "@/lib/storage";
import { COLLECTIONS, MEANINGFUL_COLLECTIONS, countItems, mergeCollection, parseStored, type CollectionName } from "@/lib/sync/collections";

/**
 * SYNCHRONISATION — le cloud fait foi, le localStorage sert de mémoire de travail.
 *
 * SOURCE DE VÉRITÉ, dite une fois pour toutes :
 *
 *   NON CONNECTÉ   le localStorage, exactement comme avant. Rien ne change.
 *   CONNECTÉ       la ligne `user_collections` du compte. Le localStorage en
 *                  est le CACHE : l'application continue de lire et d'écrire
 *                  localement (instantané, hors ligne), et chaque collection
 *                  modifiée est marquée « à envoyer » jusqu'à ce que le
 *                  serveur l'ait acceptée.
 *
 * CONCURRENCE OPTIMISTE. Chaque ligne serveur porte une `revision`. Un
 * envoi dit « je remplace la révision 7 » : si le serveur est déjà à 8 (un
 * autre appareil est passé entre-temps), l'envoi est REFUSÉ, jamais écrasé.
 * On relit alors la version serveur, on FUSIONNE (lib/sync/collections.ts)
 * et on renvoie. Aucune écriture aveugle, donc aucun « dernier qui parle
 * gagne » silencieux.
 *
 * APPARTENANCE. Le cache local sait à quel compte il appartient
 * (`ownerId`). Des données locales sans propriétaire (l'élève utilisait
 * TaekdHub avant d'avoir un compte), ou appartenant à un AUTRE compte, ne
 * sont JAMAIS envoyées sans une décision explicite — voir `signIn`.
 *
 * HORS LIGNE. Tout échec réseau laisse les collections « à envoyer » : elles
 * partiront au prochain essai (retour du réseau, retour sur l'onglet,
 * minuterie). L'application, elle, ne s'en aperçoit pas.
 *
 * Aucune dépendance à React, au DOM ou à Supabase : le stockage local et le
 * serveur sont INJECTÉS, ce qui rend chaque scénario testable.
 */

export interface LocalStore {
  read(key: string): string | null;
  /** Écriture SILENCIEUSE (ne doit pas marquer la collection « à envoyer »). */
  write(key: string, raw: string): boolean;
}

export interface RemoteRow {
  collection: CollectionName;
  items: unknown;
  revision: number;
  updatedAt: string;
}

export type PushResult =
  | { ok: true; revision: number; updatedAt: string }
  | { ok: false; conflict: true }
  | { ok: false; conflict: false; error: string };

export interface RemoteStore {
  fetchAll(): Promise<RemoteRow[]>;
  fetchOne(collection: CollectionName): Promise<RemoteRow | null>;
  /** Remplace la ligne si et seulement si le serveur est encore à `baseRevision` (0 = la ligne n'existe pas encore). */
  push(collection: CollectionName, items: unknown, baseRevision: number): Promise<PushResult>;
}

export interface CollectionMeta {
  /** Révision serveur sur laquelle le cache local est fondé (0 = jamais vue). */
  revision: number;
  /** Modifiée localement depuis le dernier accord avec le serveur. */
  dirty: boolean;
  /** ISO de la dernière modification locale. */
  localUpdatedAt: string | null;
}

export interface SyncMeta {
  /** Compte auquel appartient le cache local, ou `null` (données d'avant le compte). */
  ownerId: string | null;
  collections: Partial<Record<CollectionName, CollectionMeta>>;
  lastSyncedAt: string | null;
}

export const SYNC_META_KEY = "prepahub:sync:meta";

/** Envois successifs tentés pour une collection en conflit avant d'abandonner jusqu'au prochain cycle. */
const MAX_PUSH_ATTEMPTS = 3;

export type DataCounts = Partial<Record<CollectionName, number>>;

export interface PendingDecision {
  /** « import » : l'appareil a des données, le compte est vide. « conflit » : les deux en ont. */
  kind: "import" | "conflit";
  /** L'appareil portait les données d'un AUTRE compte. */
  foreignOwner: boolean;
  local: DataCounts;
  remote: DataCounts;
}

export type DecisionChoice =
  /** Envoyer les données de l'appareil vers le compte (compte vide). */
  | "importer"
  /** Réunir les deux (compte non vide). */
  | "fusionner"
  /** Ne garder que le compte : les données de l'appareil sont remplacées (l'interface en télécharge une copie AVANT). */
  | "compte";

export type SignInOutcome = { type: "synced"; report: SyncReport } | { type: "decision"; decision: PendingDecision };

export interface SyncReport {
  pulled: CollectionName[];
  pushed: CollectionName[];
  merged: CollectionName[];
  /** Collections restées « à envoyer » (réseau, conflit persistant). */
  failed: CollectionName[];
  at: string;
}

function emptyMeta(): SyncMeta {
  return { ownerId: null, collections: {}, lastSyncedAt: null };
}

export class SyncEngine {
  constructor(
    private readonly local: LocalStore,
    private readonly remote: RemoteStore,
    private readonly clock: () => Date = () => new Date()
  ) {}

  /* ── État local de synchronisation ── */

  readMeta(): SyncMeta {
    const raw = this.local.read(SYNC_META_KEY);
    if (!raw) return emptyMeta();
    try {
      const parsed = JSON.parse(raw) as Partial<SyncMeta>;
      return {
        ownerId: typeof parsed.ownerId === "string" ? parsed.ownerId : null,
        collections: typeof parsed.collections === "object" && parsed.collections !== null ? parsed.collections : {},
        lastSyncedAt: typeof parsed.lastSyncedAt === "string" ? parsed.lastSyncedAt : null,
      };
    } catch {
      return emptyMeta();
    }
  }

  private writeMeta(meta: SyncMeta): void {
    this.local.write(SYNC_META_KEY, JSON.stringify(meta));
  }

  private collectionMeta(meta: SyncMeta, collection: CollectionName): CollectionMeta {
    return meta.collections[collection] ?? { revision: 0, dirty: false, localUpdatedAt: null };
  }

  /** Une écriture locale vient d'avoir lieu sur `key` — appelé par l'abonnement de lib/storage.ts#onLocalWrite. */
  markDirty(key: string): CollectionName | null {
    const collection = COLLECTIONS.find((name) => STORAGE_KEYS[name] === key);
    if (!collection) return null;
    const meta = this.readMeta();
    meta.collections[collection] = { ...this.collectionMeta(meta, collection), dirty: true, localUpdatedAt: this.clock().toISOString() };
    this.writeMeta(meta);
    return collection;
  }

  hasPendingChanges(): boolean {
    const meta = this.readMeta();
    return COLLECTIONS.some((collection) => this.collectionMeta(meta, collection).dirty);
  }

  /* ── Lecture / écriture du cache ── */

  private readLocal(collection: CollectionName): unknown {
    return parseStored(collection, this.local.read(STORAGE_KEYS[collection]));
  }

  private writeLocal(collection: CollectionName, value: unknown): boolean {
    return this.local.write(STORAGE_KEYS[collection], JSON.stringify(value));
  }

  localCounts(): DataCounts {
    const counts: DataCounts = {};
    for (const collection of COLLECTIONS) counts[collection] = countItems(collection, this.readLocal(collection));
    return counts;
  }

  private static hasMeaningful(counts: DataCounts): boolean {
    return MEANINGFUL_COLLECTIONS.some((collection) => (counts[collection] ?? 0) > 0);
  }

  private static remoteCounts(rows: RemoteRow[]): DataCounts {
    const counts: DataCounts = {};
    for (const row of rows) counts[row.collection] = countItems(row.collection, row.items);
    return counts;
  }

  /* ── Connexion ── */

  /**
   * À appeler dès qu'une session est établie (connexion, rechargement).
   *
   *   cache du même compte     synchronisation ordinaire ;
   *   appareil sans données    le compte est téléchargé, sans rien demander ;
   *   données sans compte      DÉCISION : les importer, ou partir du compte ;
   *   ou d'un autre compte     (jamais d'envoi ni de remplacement implicite).
   */
  async signIn(userId: string): Promise<SignInOutcome> {
    const meta = this.readMeta();
    const rows = await this.remote.fetchAll();
    if (meta.ownerId === userId) return { type: "synced", report: await this.syncWith(rows) };

    const local = this.localCounts();
    const remote = SyncEngine.remoteCounts(rows);
    if (!SyncEngine.hasMeaningful(local)) {
      // Rien à protéger sur l'appareil : le compte fait foi, les réglages locaux ne comblent qu'un compte qui n'en a pas.
      return { type: "synced", report: this.adoptRemote(userId, rows, { keepLocalPreferences: true }) };
    }
    return {
      type: "decision",
      decision: { kind: SyncEngine.hasMeaningful(remote) ? "conflit" : "import", foreignOwner: meta.ownerId !== null, local, remote },
    };
  }

  /** Applique le choix de l'élève face à une `PendingDecision`. */
  async resolveDecision(userId: string, choice: DecisionChoice): Promise<SyncReport> {
    const rows = await this.remote.fetchAll();
    if (choice === "compte") return this.adoptRemote(userId, rows, { keepLocalPreferences: false });

    // « importer » et « fusionner » : le cache devient celui du compte, chaque
    // collection fusionnée avec sa version serveur puis marquée à envoyer.
    const meta = this.readMeta();
    const now = this.clock().toISOString();
    const byName = new Map(rows.map((row) => [row.collection, row]));
    meta.ownerId = userId;
    const merged: CollectionName[] = [];
    for (const collection of COLLECTIONS) {
      const row = byName.get(collection);
      const localValue = this.readLocal(collection);
      const value = row ? mergeCollection(collection, localValue, row.items, true) : localValue;
      if (row) {
        this.writeLocal(collection, value);
        merged.push(collection);
      }
      meta.collections[collection] = { revision: row?.revision ?? 0, dirty: countItems(collection, value) > 0 || Boolean(row), localUpdatedAt: now };
    }
    this.writeMeta(meta);
    const report = await this.pushDirty();
    return { ...report, merged };
  }

  /** Remplace le cache par le contenu du compte. */
  private adoptRemote(userId: string, rows: RemoteRow[], options: { keepLocalPreferences: boolean }): SyncReport {
    const byName = new Map(rows.map((row) => [row.collection, row]));
    const meta: SyncMeta = { ownerId: userId, collections: {}, lastSyncedAt: this.clock().toISOString() };
    const pulled: CollectionName[] = [];
    for (const collection of COLLECTIONS) {
      const row = byName.get(collection);
      if (row) {
        this.writeLocal(collection, row.items);
        pulled.push(collection);
        meta.collections[collection] = { revision: row.revision, dirty: false, localUpdatedAt: null };
        continue;
      }
      if (collection === "preferences" && options.keepLocalPreferences) {
        // Le compte n'a pas encore de réglages : ceux de l'appareil les amorcent.
        meta.collections[collection] = { revision: 0, dirty: countItems(collection, this.readLocal(collection)) > 0, localUpdatedAt: null };
        continue;
      }
      if (collection !== "preferences") this.writeLocal(collection, []);
      meta.collections[collection] = { revision: 0, dirty: false, localUpdatedAt: null };
    }
    this.writeMeta(meta);
    return { pulled, pushed: [], merged: [], failed: [], at: meta.lastSyncedAt! };
  }

  /* ── Synchronisation ordinaire ── */

  /** Un cycle complet : relire le serveur, appliquer, envoyer ce qui attend. Pour le compte déjà propriétaire du cache. */
  async sync(userId: string): Promise<SyncReport> {
    const meta = this.readMeta();
    if (meta.ownerId !== userId) throw new Error("Le cache local n'appartient pas à ce compte : passer par signIn.");
    return this.syncWith(await this.remote.fetchAll());
  }

  private async syncWith(rows: RemoteRow[]): Promise<SyncReport> {
    const meta = this.readMeta();
    const byName = new Map(rows.map((row) => [row.collection, row]));
    const pulled: CollectionName[] = [];
    const merged: CollectionName[] = [];

    for (const collection of COLLECTIONS) {
      const row = byName.get(collection);
      const state = this.collectionMeta(meta, collection);
      if (!row) {
        // Une collection que le serveur n'a jamais reçue (apparue avec une version récente de l'app) : à envoyer si elle a du contenu.
        if (state.revision === 0 && !state.dirty && countItems(collection, this.readLocal(collection)) > 0) {
          meta.collections[collection] = { ...state, dirty: true };
        }
        continue;
      }
      if (row.revision === state.revision) continue;
      if (!state.dirty) {
        // Le serveur a avancé, rien ne change ici : on prend sa version.
        this.writeLocal(collection, row.items);
        meta.collections[collection] = { revision: row.revision, dirty: false, localUpdatedAt: state.localUpdatedAt };
        pulled.push(collection);
        continue;
      }
      // Les deux ont changé : fusion, puis envoi fondé sur la révision serveur.
      const localNewer = (state.localUpdatedAt ?? "") >= row.updatedAt;
      this.writeLocal(collection, mergeCollection(collection, this.readLocal(collection), row.items, localNewer));
      meta.collections[collection] = { ...state, revision: row.revision, dirty: true };
      merged.push(collection);
    }
    this.writeMeta(meta);

    const report = await this.pushDirty();
    return { ...report, pulled: [...pulled, ...report.pulled], merged: [...merged, ...report.merged] };
  }

  /** Envoie toutes les collections « à envoyer ». Un échec n'en interrompt pas d'autres. */
  async pushDirty(): Promise<SyncReport> {
    const pushed: CollectionName[] = [];
    const merged: CollectionName[] = [];
    const failed: CollectionName[] = [];
    for (const collection of COLLECTIONS) {
      if (!this.collectionMeta(this.readMeta(), collection).dirty) continue;
      const outcome = await this.pushOne(collection);
      if (outcome === "pushed") pushed.push(collection);
      else if (outcome === "merged") {
        pushed.push(collection);
        merged.push(collection);
      } else failed.push(collection);
    }
    const meta = this.readMeta();
    if (failed.length === 0) {
      meta.lastSyncedAt = this.clock().toISOString();
      this.writeMeta(meta);
    }
    return { pulled: [], pushed, merged, failed, at: this.clock().toISOString() };
  }

  private async pushOne(collection: CollectionName): Promise<"pushed" | "merged" | "failed"> {
    let mergedOnce = false;
    for (let attempt = 0; attempt < MAX_PUSH_ATTEMPTS; attempt += 1) {
      const meta = this.readMeta();
      const state = this.collectionMeta(meta, collection);
      // Ce qui part est ce qui est sur le disque À CET INSTANT.
      const snapshot = this.local.read(STORAGE_KEYS[collection]);
      const result = await this.remote.push(collection, parseStored(collection, snapshot), state.revision);

      if (result.ok) {
        const after = this.readMeta();
        const current = this.collectionMeta(after, collection);
        // Une écriture locale survenue PENDANT l'envoi garde la collection « à envoyer ».
        const changedMeanwhile = this.local.read(STORAGE_KEYS[collection]) !== snapshot;
        after.collections[collection] = { revision: result.revision, dirty: changedMeanwhile, localUpdatedAt: current.localUpdatedAt };
        this.writeMeta(after);
        return mergedOnce ? "merged" : "pushed";
      }
      if (!result.conflict) return "failed";

      // Refusé : quelqu'un est passé avant. Relire, fusionner, renvoyer.
      const row = await this.remote.fetchOne(collection);
      const fresh = this.readMeta();
      const freshState = this.collectionMeta(fresh, collection);
      if (row) {
        const localNewer = (freshState.localUpdatedAt ?? "") >= row.updatedAt;
        this.writeLocal(collection, mergeCollection(collection, this.readLocal(collection), row.items, localNewer));
      }
      fresh.collections[collection] = { ...freshState, revision: row?.revision ?? 0, dirty: true };
      this.writeMeta(fresh);
      mergedOnce = true;
    }
    return "failed";
  }

  /* ── Déconnexion ── */

  /**
   * Oublie ce qui est propre à ce compte SUR CET APPAREIL. Par défaut, les
   * données restent (l'élève continue en local, et retrouve tout en se
   * reconnectant) ; `wipe` efface les collections — seulement quand rien
   * n'attend d'être envoyé, sinon on refuse (`false`).
   */
  signOut(options: { wipe: boolean }): boolean {
    if (!options.wipe) return true;
    if (this.hasPendingChanges()) return false;
    for (const collection of COLLECTIONS) {
      if (collection === "preferences") continue;
      this.writeLocal(collection, []);
    }
    this.writeMeta(emptyMeta());
    return true;
  }
}
