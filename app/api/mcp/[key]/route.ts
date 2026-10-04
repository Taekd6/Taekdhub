import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { buildTodaySnapshot } from "@/lib/today-snapshot";
import { isMcpKeyValid } from "@/lib/mcp-auth";
import { mutateCollection, type CollectionStore } from "@/lib/mcp-collections";
import { addLockCards, courseLocks, lockFor, lockSentence, LOCK_CARDS_MAX, rateLockCards } from "@/lib/course-lock";
import { toSubject } from "@/lib/annales";
import { normalizeReviewItem, type ReviewItem } from "@/lib/storage";

/**
 * CONNECTEUR MCP — la porte d'entrée de Claude dans TaekdHub.
 * URL : /api/mcp/<MCP_SECRET>. Côté serveur uniquement (clé secrète Supabase).
 *
 * À QUI APPARTIENNENT LES DONNÉES. La clé secrète contourne la RLS : c'est
 * donc ici, et nulle part ailleurs, qu'on décide pour quel élève on lit et
 * on écrit. `MCP_USER_ID` le dit explicitement ; à défaut, s'il n'existe
 * qu'UN compte dans le projet, c'est lui. Avec plusieurs comptes et sans
 * `MCP_USER_ID`, le connecteur refuse plutôt que de deviner.
 *
 * Les dates (« aujourd'hui », « hier ») sont celles de l'élève, pas celles
 * du serveur (UTC sur Vercel) : `MCP_TIMEZONE`, Europe/Paris par défaut.
 *
 * DÉPENDANCES. `@modelcontextprotocol/server` (package.json) n'est importé
 * nulle part directement, mais `mcp-handler` l'exige comme dépendance
 * « peer » : ne pas le retirer.
 */
process.env.TZ = process.env.MCP_TIMEZONE || "Europe/Paris";

function db() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  });
}

let cachedOwner: string | null = null;

async function ownerId(): Promise<string | null> {
  if (process.env.MCP_USER_ID) return process.env.MCP_USER_ID;
  if (cachedOwner) return cachedOwner;
  const { data, error } = await db().auth.admin.listUsers({ page: 1, perPage: 2 });
  if (error || data.users.length !== 1) return null;
  cachedOwner = data.users[0].id;
  return cachedOwner;
}

const NO_OWNER =
  "Erreur : impossible de savoir à quel compte TaekdHub rattacher les données. Renseigne MCP_USER_ID (l'identifiant du compte, Supabase → Authentication → Users) dans les variables d'environnement Vercel.";

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });

/**
 * Une collection synchronisée de l'élève, lue et écrite avec la même règle
 * de révision que ses appareils (lib/mcp-collections.ts). La clé secrète
 * contourne la RLS : chaque requête filtre donc `user_id` à la main.
 */
function collectionStore(user_id: string, collection: string): CollectionStore {
  const client = db();
  return {
    async read() {
      const { data, error } = await client.from("user_collections").select("items, revision").eq("user_id", user_id).eq("collection", collection).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? { items: data.items, revision: data.revision as number } : null;
    },
    async write(items, baseRevision) {
      if (baseRevision === 0) {
        const { error } = await client.from("user_collections").insert({ user_id, collection, items, revision: 1 });
        if (!error) return "ok";
        return error.code === "23505" ? "conflict" : { error: error.message };
      }
      const { data, error } = await client.from("user_collections").update({ items, revision: baseRevision + 1 }).eq("user_id", user_id).eq("collection", collection).eq("revision", baseRevision).select("revision");
      if (error) return { error: error.message };
      return data && data.length > 0 ? "ok" : "conflict";
    },
  };
}

async function readReviewItems(user_id: string): Promise<ReviewItem[]> {
  const row = await collectionStore(user_id, "reviewItems").read();
  return asReviewItems(row?.items);
}

function asReviewItems(raw: unknown): ReviewItem[] {
  return Array.isArray(raw) ? raw.map(normalizeReviewItem).filter((item): item is ReviewItem => item !== null) : [];
}

const LOCK_RULE =
  "RÈGLE DU VERROU DE COURS : si le chapitre visé figure dans `verrous` (get_today), NE DONNE PAS d'exercice dessus. Dis à l'élève de reprendre son cours, puis interroge-le sur les fiches `interrogeable: true` (recto seul ; il répond de tête ; compare au verso) et note avec review_cards. Le chapitre se déverrouille quand toutes ses fiches sont notées « good » ou « easy ».";

const mcp = createMcpHandler((server) => {
  server.registerTool(
    "log_exercise",
    {
      title: "Enregistrer un exercice",
      description:
        "Enregistre le résultat d'un exercice d'annale corrigé (appelé après chaque correction). Il apparaît dans TaekdHub (page Annales) et nourrit ses recommandations. Pour une NOUVELLE tentative d'un exercice déjà fait, réutilise exactement la même `source` et le même `chapitre` : les tentatives sont regroupées sur cette clé.",
      inputSchema: z.object({
        matiere: z.string().describe("maths / physique / chimie"),
        chapitre: z.string().describe("ex : réduction, séries entières"),
        source: z.string().optional().describe("ex : Mines-Ponts 2023 MP1, partie II"),
        niveau: z.string().optional().describe("CCINP / Mines / Centrale / X-ENS"),
        resultat: z.enum(["réussi", "partiel", "échec"]),
        indices: z.number().int().min(0).max(3).optional(),
        aide: z
          .enum(["sans", "indices", "correction"])
          .optional()
          .describe("aide réellement utilisée pendant l'essai : sans, indices, ou correction (la correction a été montrée avant la fin). Seule une réussite « sans » prouve la maîtrise."),
        temps_min: z.number().int().optional().describe("temps réellement passé, en minutes"),
        temps_prevu: z.number().int().optional().describe("temps que l'élève pensait mettre, annoncé AVANT de commencer"),
        erreurs: z.array(z.string()).optional().describe("types d'erreurs relevés à la correction"),
        commentaire: z.string().optional(),
      }),
    },
    async (args) => {
      const user_id = await ownerId();
      if (!user_id) return text(NO_OWNER);
      const { error } = await db().from("exercise_logs").insert({ ...args, user_id });
      // 42703 : la colonne `aide` n'existe pas encore (migration 0008 non appliquée) — on enregistre sans elle plutôt que de perdre l'exercice.
      if (error?.code === "42703" && args.aide !== undefined) {
        const { aide: _aide, ...rest } = args;
        void _aide;
        const retry = await db().from("exercise_logs").insert({ ...rest, user_id });
        return text(retry.error ? `Erreur : ${retry.error.message}` : "Enregistré (sans le niveau d'aide : migration 0008 à appliquer).");
      }
      if (error) return text(`Erreur : ${error.message}`);
      // Un exercice fait sur un chapitre verrouillé est enregistré (rien ne se perd), mais Claude doit le savoir.
      const subject = toSubject(args.matiere);
      const lock = lockFor(courseLocks(await readReviewItems(user_id).catch(() => [])), subject, args.chapitre);
      return text(lock ? `Enregistré. ATTENTION — chapitre verrouillé : ${lockSentence(lock)}. ${LOCK_RULE}` : "Enregistré.");
    }
  );

  server.registerTool(
    "add_cards",
    {
      title: "Créer des fiches de cours (verrou)",
      description:
        "Après la correction d'un exercice raté (ou partiel) À CAUSE DU COURS — définition, théorème et ses hypothèses, propriété, méthode type —, crée 1 à 5 fiches recto/verso sur exactement ce qui a manqué. Elles arrivent dans TaekdHub (carnet « À revoir », envoyables dans Anki, paquet TaekdHub::<matière>::<chapitre>) et VERROUILLENT le chapitre : plus d'exercice dessus tant que l'élève ne les a pas retrouvées de tête, au plus tôt demain. Pas de fiche pour une erreur de calcul ou d'inattention : ce n'est pas le cours. Une fiche = une seule idée ; recto = une question précise (pas « Réduction ? ») ; verso = la réponse courte, avec les hypothèses. Écris les maths en texte lisible (Unicode : ⟺, ∈, ≤, ∑), pas en LaTeX.",
      inputSchema: z.object({
        fiches: z
          .array(
            z.object({
              matiere: z.string().describe("maths / physique / chimie / info"),
              chapitre: z.string().describe("le chapitre du programme, ex : Réduction, Séries entières, Électrostatique"),
              recto: z.string().max(200).describe("la question, ex : « Quand un endomorphisme est-il diagonalisable (polynôme minimal) ? »"),
              verso: z.string().max(400).describe("la réponse, ex : « ⟺ π_u scindé à racines simples sur 𝕂. »"),
              raison: z.string().max(200).optional().describe("ce que l'élève a raté, ex : « a diagonalisé sans vérifier que χ_u était scindé »"),
            })
          )
          .min(1)
          .max(LOCK_CARDS_MAX),
      }),
    },
    async ({ fiches }) => {
      const user_id = await ownerId();
      if (!user_id) return text(NO_OWNER);
      const outcome = await mutateCollection(collectionStore(user_id, "reviewItems"), (current) => {
        const result = addLockCards(asReviewItems(current), fiches);
        return result.ok ? { ok: true, items: result.items, value: result } : result;
      }).catch((cause: unknown) => ({ ok: false as const, error: cause instanceof Error ? cause.message : "erreur inconnue" }));
      if (!outcome.ok) return text(`Erreur : ${outcome.error}`);
      const { added, skipped, items } = outcome.value;
      const locks = courseLocks(items).map(lockSentence);
      return text(
        `${added.length} fiche${added.length > 1 ? "s" : ""} créée${added.length > 1 ? "s" : ""}${skipped ? `, ${skipped} déjà présente${skipped > 1 ? "s" : ""}` : ""}. Verrous actifs : ${locks.join(" ; ") || "aucun"}. Dis à l'élève de reprendre son cours sur ce chapitre aujourd'hui ; tu l'interrogeras sur ces fiches à partir de demain.`
      );
    }
  );

  server.registerTool(
    "review_cards",
    {
      title: "Noter les fiches après interrogation",
      description:
        "Après avoir interrogé l'élève sur des fiches du verrou (recto seul, réponse de tête SANS notes, comparée au verso), enregistre la note de chacune. Sois exigeant : « good » = réponse juste et complète (hypothèses comprises) ; « hard » = juste mais hésitante ou incomplète ; « again » = fausse ou pas trouvée ; « easy » = immédiate et parfaite. Ne note que des fiches `interrogeable: true` de get_today.",
      inputSchema: z.object({
        notes: z.array(z.object({ id: z.string(), note: z.enum(["again", "hard", "good", "easy"]) })).min(1).max(40),
      }),
    },
    async ({ notes }) => {
      const user_id = await ownerId();
      if (!user_id) return text(NO_OWNER);
      const outcome = await mutateCollection(collectionStore(user_id, "reviewItems"), (current) => {
        const result = rateLockCards(asReviewItems(current), notes);
        return result.ok ? { ok: true, items: result.items, value: result } : result;
      }).catch((cause: unknown) => ({ ok: false as const, error: cause instanceof Error ? cause.message : "erreur inconnue" }));
      if (!outcome.ok) return text(`Erreur : ${outcome.error}`);
      const { unlocked, stillLocked } = outcome.value;
      return text(
        [
          "Notes enregistrées.",
          unlocked.length ? `Déverrouillé : ${unlocked.join(", ")} — l'élève peut refaire des exercices dessus.` : "",
          stillLocked.length ? `Toujours verrouillé : ${stillLocked.join(" ; ")}.` : "Plus aucun chapitre verrouillé.",
        ]
          .filter(Boolean)
          .join(" ")
      );
    }
  );

  server.registerTool(
    "get_progress",
    {
      title: "Historique de progression",
      description: "Renvoie l'historique des exercices, du plus récent au plus ancien (filtrable par matière/chapitre).",
      inputSchema: z.object({
        matiere: z.string().optional(),
        chapitre: z.string().optional(),
        limit: z.number().int().min(1).max(500).optional(),
      }),
    },
    async ({ matiere, chapitre, limit }) => {
      const user_id = await ownerId();
      if (!user_id) return text(NO_OWNER);
      let q = db().from("exercise_logs").select("*").eq("user_id", user_id).order("created_at", { ascending: false }).limit(limit ?? 100);
      if (matiere) q = q.ilike("matiere", `%${matiere}%`);
      if (chapitre) q = q.ilike("chapitre", `%${chapitre}%`);
      const { data, error } = await q;
      return text(error ? `Erreur : ${error.message}` : JSON.stringify(data));
    }
  );

  server.registerTool(
    "get_today",
    {
      title: "Où j'en suis aujourd'hui",
      description:
        "L'état du jour dans TaekdHub : la recommandation Next Move (raison, problème corrigé, critère de fin), le point faible principal établi par le diagnostic (cours, méthode, application, calcul, temps… avec ses preuves), les exercices à refaire sans aide, les échéances et DS, la mémoire des chapitres, les erreurs récentes, les cartes Anki dues au dernier relevé. À appeler AVANT de proposer un exercice, pour viser le vrai point faible. " + LOCK_RULE,
      inputSchema: z.object({}),
    },
    async () => {
      const user_id = await ownerId();
      if (!user_id) return text(NO_OWNER);
      const client = db();
      const [collections, annales] = await Promise.all([
        client.from("user_collections").select("collection, items").eq("user_id", user_id),
        client.from("exercise_logs").select("*").eq("user_id", user_id).order("created_at", { ascending: false }).limit(1000),
      ]);
      if (collections.error) return text(`Erreur : ${collections.error.message}`);
      if (annales.error) return text(`Erreur : ${annales.error.message}`);
      const byName: Record<string, unknown> = {};
      for (const row of collections.data ?? []) byName[row.collection as string] = row.items;
      if (Object.keys(byName).length === 0) {
        return text("Aucune donnée synchronisée : l'élève doit se connecter à son compte dans TaekdHub (Réglages → Compte) pour que ses séances, échéances et chapitres soient lisibles ici.");
      }
      return text(JSON.stringify(buildTodaySnapshot(byName, annales.data, new Date())));
    }
  );
});

async function guarded(req: Request) {
  const secret = process.env.MCP_SECRET;
  // Clé dans le chemin : /api/mcp/<clé>
  const key = new URL(req.url).pathname.split("/").filter(Boolean).pop();
  if (!isMcpKeyValid(key, secret)) {
    return new Response("Unauthorized", { status: 401 });
  }
  return mcp(req);
}

export const maxDuration = 60;
export { guarded as GET, guarded as POST, guarded as DELETE };
