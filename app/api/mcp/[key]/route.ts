import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { buildTodaySnapshot } from "@/lib/today-snapshot";
import { isMcpKeyValid } from "@/lib/mcp-auth";
import { mutateCollection, type CollectionStore } from "@/lib/mcp-collections";
import { addLockCards, courseLocks, lockFor, lockSentence, LOCK_CARDS_MAX, rateLockCards } from "@/lib/course-lock";
import { toSubject } from "@/lib/annales";
import { normalizeReviewItem, type ReviewItem } from "@/lib/storage";
import { aiDebriefPrompt } from "@/lib/ai-debrief";
import { demonstrationsReport, restitutionPrompt } from "@/lib/demonstrations";
import { buildRevisionContext, MAX_HORIZON_DAYS, revisionInputFrom } from "@/lib/revision-context";
import { normalizeAttempts } from "@/lib/attempts";
import { normalizePreferences } from "@/lib/storage";
import { evaluationHistory, pedagogyInputFrom, recurringDifficulties, resolveChapter, LAST_EVALUATIONS_DEFAULT, LAST_EVALUATIONS_MAX } from "@/lib/pedagogy";
import { addEcheances, deleteEcheance, describeEcheance, ECHEANCE_SUBJECTS, ECHEANCE_TYPES, ECHEANCES_MAX, listEcheances, updateEcheance } from "@/lib/mcp-echeances";

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

const failure = (cause: unknown) => ({ ok: false as const, error: cause instanceof Error ? cause.message : "erreur inconnue" });

/** La mémoire des chapitres, lue seule : les échéances y rattachent leurs chapitres sans jamais l'écrire. */
async function readChapterMemory(user_id: string): Promise<unknown> {
  return (await collectionStore(user_id, "chapterMemory").read())?.items ?? [];
}

const ECHEANCE_FIELDS = {
  titre: z.string().min(1).max(120).describe("ex : « DS 3 — Électrocinétique », « Colle de maths », « DM 5 »"),
  matiere: z.enum(ECHEANCE_SUBJECTS).describe("info = informatique tronc commun"),
  type: z.enum(ECHEANCE_TYPES),
  date: z.string().describe("jour de l'échéance, AAAA-MM-JJ (heure de Paris). Refusée si passée, inexistante (2026-02-30) ou à plus d'un an."),
  chapitres: z
    .array(z.string().max(80))
    .max(24)
    .optional()
    .describe("chapitres au programme, avec le titre que l'élève leur donne dans TaekdHub (get_today → point_faible_principal / chapitres_qui_s_effacent). Les titres reconnus deviennent le programme de l'épreuve ; les autres sont gardés dans la note."),
  note: z.string().max(300).optional().describe("précision libre : salle, calculatrice, consignes"),
  minutes: z.number().int().min(5).max(1200).optional().describe("temps de PRÉPARATION que l'élève veut y consacrer, en minutes (le planificateur le réserve). 60 par défaut : demande-lui plutôt que de deviner."),
};

const LOCK_RULE =
  "RÈGLE DU VERROU DE COURS : si le chapitre visé figure dans `verrous` (get_today), NE DONNE PAS d'exercice dessus. Dis à l'élève de reprendre son cours, puis interroge-le sur les fiches `interrogeable: true` (recto seul ; il répond de tête ; compare au verso) et note avec review_cards. Le chapitre se déverrouille quand toutes ses fiches sont notées « good » ou « easy ».";

/**
 * LECTURE de la mémoire pédagogique (lib/pedagogy.ts) : les collections de
 * l'élève et ses annales, jamais modifiées. Les outils `get_debriefs` et
 * `get_recommandations` n'appellent aucune écriture.
 */
async function readPedagogy(user_id: string) {
  const client = db();
  const [collections, annales] = await Promise.all([
    client.from("user_collections").select("collection, items").eq("user_id", user_id),
    client.from("exercise_logs").select("*").eq("user_id", user_id).order("created_at", { ascending: false }).limit(1000),
  ]);
  if (collections.error) throw new Error(collections.error.message);
  const byName: Record<string, unknown> = {};
  for (const row of collections.data ?? []) byName[row.collection as string] = row.items;
  // Annales illisibles : on analyse sans elles plutôt que d'échouer.
  return pedagogyInputFrom(byName, annales.error ? [] : annales.data, new Date());
}

/** LECTURE du contexte de révision (lib/revision-context.ts) : toutes les collections de l'élève et ses annales, jamais modifiées. */
async function readRevision(user_id: string) {
  const client = db();
  const [collections, annales] = await Promise.all([
    client.from("user_collections").select("collection, items").eq("user_id", user_id),
    client.from("exercise_logs").select("*").eq("user_id", user_id).order("created_at", { ascending: false }).limit(1000),
  ]);
  if (collections.error) throw new Error(collections.error.message);
  const byName: Record<string, unknown> = {};
  for (const row of collections.data ?? []) byName[row.collection as string] = row.items;
  return revisionInputFrom(byName, annales.error ? [] : annales.data, new Date());
}

const SCOPE_FIELDS = {
  matiere: z.string().optional().describe("maths / physique / chimie… — restreint à une matière"),
  chapitre: z.string().optional().describe("identifiant du programme (ex. m2-reduction) ou titre (« réduction »). Un titre ambigu est refusé plutôt que deviné."),
};

function scopeFrom(args: { matiere?: string; chapitre?: string }): { ok: true; subject: ReturnType<typeof toSubject>; chapterId: string | null } | { ok: false; error: string } {
  const subject = args.matiere ? toSubject(args.matiere) : null;
  if (args.matiere && !subject) return { ok: false, error: `Matière « ${args.matiere} » inconnue.` };
  const chapterId = args.chapitre ? resolveChapter(args.chapitre, subject) : null;
  if (args.chapitre && !chapterId) return { ok: false, error: `Chapitre « ${args.chapitre} » non reconnu avec certitude : donne son identifiant du programme (voir debrief_format) ou précise la matière.` };
  return { ok: true, subject, chapterId };
}

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
    "add_echeance",
    {
      title: "Ajouter des échéances (DS, colles, DM…)",
      description:
        `Ajoute 1 à ${ECHEANCES_MAX} échéances d'un coup (ex : tout le planning de DS du trimestre). Elles apparaissent dans TaekdHub (écran Échéances, planificateur) et dans get_today. Une date invalide ou passée fait refuser TOUT le lot, rien n'est écrit : corrige et renvoie. Une échéance déjà présente (même titre, même jour) est sautée, pas dupliquée — renvoyer le même lot est donc sans danger. Vérifie ensuite avec list_echeances.`,
      inputSchema: z.object({ echeances: z.array(z.object(ECHEANCE_FIELDS)).min(1).max(ECHEANCES_MAX) }),
    },
    async ({ echeances }) => {
      const user_id = await ownerId();
      if (!user_id) return text(NO_OWNER);
      const now = new Date();
      const chapters = await readChapterMemory(user_id).catch(() => []);
      const outcome = await mutateCollection(collectionStore(user_id, "workItems"), (current) => addEcheances(current, echeances, chapters, now)).catch(failure);
      if (!outcome.ok) return text(`Erreur : ${outcome.error}`);
      const { added, duplicates, unknownChapters } = outcome.value;
      return text(
        [
          `${added.length} échéance${added.length > 1 ? "s" : ""} ajoutée${added.length > 1 ? "s" : ""}.`,
          duplicates.length ? `Déjà présente${duplicates.length > 1 ? "s" : ""}, non dupliquée${duplicates.length > 1 ? "s" : ""} : ${duplicates.join(", ")}.` : "",
          unknownChapters.length ? `Chapitres absents de la mémoire de l'élève, gardés dans la note : ${unknownChapters.join(", ")}.` : "",
          JSON.stringify(added.map((item) => describeEcheance(item, chapters, now))),
        ]
          .filter(Boolean)
          .join(" ")
      );
    }
  );

  server.registerTool(
    "update_echeance",
    {
      title: "Modifier une échéance",
      description:
        "Corrige une échéance par son `id` (donné par list_echeances ou get_today) : seuls les champs fournis changent. `chapitres` REMPLACE la liste entière. Mêmes règles de date et de doublon que add_echeance.",
      inputSchema: z.object({
        id: z.string(),
        titre: ECHEANCE_FIELDS.titre.optional(),
        matiere: ECHEANCE_FIELDS.matiere.optional(),
        type: ECHEANCE_FIELDS.type.optional(),
        date: ECHEANCE_FIELDS.date.optional(),
        chapitres: ECHEANCE_FIELDS.chapitres,
        note: ECHEANCE_FIELDS.note,
        minutes: ECHEANCE_FIELDS.minutes,
      }),
    },
    async ({ id, ...patch }) => {
      const user_id = await ownerId();
      if (!user_id) return text(NO_OWNER);
      const now = new Date();
      const chapters = await readChapterMemory(user_id).catch(() => []);
      const outcome = await mutateCollection(collectionStore(user_id, "workItems"), (current) => updateEcheance(current, id, patch, chapters, now)).catch(failure);
      if (!outcome.ok) return text(`Erreur : ${outcome.error}`);
      return text(`Modifiée. ${JSON.stringify(describeEcheance(outcome.value, chapters, now))}`);
    }
  );

  server.registerTool(
    "delete_echeance",
    {
      title: "Supprimer une échéance",
      description: "Supprime une échéance par son `id` (list_echeances). Elle disparaît de TaekdHub sur tous les appareils et de get_today. À n'utiliser que si l'élève le demande, ou pour une échéance créée par erreur.",
      inputSchema: z.object({ id: z.string() }),
    },
    async ({ id }) => {
      const user_id = await ownerId();
      if (!user_id) return text(NO_OWNER);
      const outcome = await mutateCollection(collectionStore(user_id, "workItems"), (current) => deleteEcheance(current, id, new Date())).catch(failure);
      if (!outcome.ok) return text(`Erreur : ${outcome.error}`);
      return text(`Supprimée : « ${outcome.value.title} » (${outcome.value.dueDate ?? "sans date"}).`);
    }
  );

  server.registerTool(
    "list_echeances",
    {
      title: "Lister les échéances à venir",
      description:
        "Les échéances encore à faire, d'aujourd'hui à `jours` jours (toutes si absent), la plus proche d'abord, avec leur `id` (pour update_echeance / delete_echeance), leurs chapitres et leur note. Appelle-la après add_echeance pour vérifier, et avant d'en ajouter pour éviter les doublons de titre approchant.",
      inputSchema: z.object({ jours: z.number().int().min(0).max(366).optional() }),
    },
    async ({ jours }) => {
      const user_id = await ownerId();
      if (!user_id) return text(NO_OWNER);
      const [items, chapters] = await Promise.all([collectionStore(user_id, "workItems").read(), readChapterMemory(user_id)]).catch((cause: unknown) => [failure(cause), null] as const);
      if (items && "ok" in items) return text(`Erreur : ${items.error}`);
      const list = listEcheances(items?.items, chapters, new Date(), jours);
      return text(list.length ? JSON.stringify(list) : "Aucune échéance à venir.");
    }
  );

  server.registerTool(
    "debrief_format",
    {
      title: "Format d'un débrief de copie",
      description:
        "LECTURE SEULE. Renvoie la consigne et le format JSON dans lesquels analyser une copie (DS, colle) pour qu'elle entre dans TaekdHub, avec les identifiants des chapitres du programme. Tu n'écris RIEN dans TaekdHub : donne le JSON à l'élève ; il le colle dans TaekdHub (Débrief → Importer un débrief IA), vérifie, corrige et enregistre lui-même.",
      inputSchema: z.object({}),
    },
    async () => text(aiDebriefPrompt())
  );

  server.registerTool(
    "get_debriefs",
    {
      title: "Historique des débriefs",
      description:
        "LECTURE SEULE. Les dernières évaluations débriefées (DS, colles), question par question : chapitre, résultat, cause ET sa fiabilité (`confiance` : « incertaine » = l'élève n'a pas tranché), erreur du carnet avec sa bonne idée, et l'état de la correction (« corrigée » seulement après une réussite sans aide). Ciblé : filtre par matière et/ou chapitre, 3 évaluations par défaut (10 au plus). À appeler pour « analyse mes derniers DS ». Une note sans débrief n'y figure pas : dis-le plutôt que d'inventer.",
      inputSchema: z.object({ ...SCOPE_FIELDS, derniers: z.number().int().min(1).max(LAST_EVALUATIONS_MAX).optional().describe(`nombre d'évaluations (défaut ${LAST_EVALUATIONS_DEFAULT})`) }),
    },
    async (args) => {
      const user_id = await ownerId();
      if (!user_id) return text(NO_OWNER);
      const scope = scopeFrom(args);
      if (!scope.ok) return text(`Erreur : ${scope.error}`);
      const input = await readPedagogy(user_id).catch(failure);
      if ("ok" in input) return text(`Erreur : ${input.error}`);
      const evaluations = evaluationHistory(input, { subject: scope.subject, chapterId: scope.chapterId, last: args.derniers });
      return text(
        JSON.stringify({
          date: input.today,
          evaluations,
          donnees: evaluations.length === 0 ? "Aucun débrief enregistré pour ce périmètre : il manque des données, ne conclus rien." : `${evaluations.length} évaluation(s) débriefée(s).`,
        })
      );
    }
  );

  server.registerTool(
    "get_recommandations",
    {
      title: "Ce qu'il faut retravailler, et pourquoi",
      description:
        "LECTURE SEULE. Les difficultés par chapitre qui se répètent dans l'historique, avec leurs observations datées, la règle appliquée (`justification`), l'action, le support (cours / anki / exercice / ia), l'échéance concernée et CE QUI FERAIT CONSIDÉRER LA DIFFICULTÉ COMME CORRIGÉE (`verification`). « récurrente » = au moins deux évaluations ou exercices distincts ; « signal » = une seule observation, `donnees_suffisantes: false` — ne conclus pas. `corrigees` : ce qui est déjà réglé, à ne pas reproposer. Ne recalcule aucun score : cite ces observations pour justifier un conseil.",
      inputSchema: z.object(SCOPE_FIELDS),
    },
    async (args) => {
      const user_id = await ownerId();
      if (!user_id) return text(NO_OWNER);
      const scope = scopeFrom(args);
      if (!scope.ok) return text(`Erreur : ${scope.error}`);
      const input = await readPedagogy(user_id).catch(failure);
      if ("ok" in input) return text(`Erreur : ${input.error}`);
      const report = recurringDifficulties(input, { subject: scope.subject, chapterId: scope.chapterId });
      return text(JSON.stringify({ date: input.today, ...report, donnees: report.recommandations.length === 0 ? "Aucune difficulté observée dans l'historique : il manque peut-être des débriefs." : undefined }));
    }
  );

  server.registerTool(
    "restitution_format",
    {
      title: "Format d'une restitution de démonstration",
      description:
        "LECTURE SEULE. Renvoie la consigne et le format JSON pour comparer la restitution d'une démonstration à sa preuve de référence, avec les identifiants des démonstrations connues. Tu n'écris RIEN dans TaekdHub : donne le JSON à l'élève ; il le colle dans TaekdHub (Anki → Démonstrations), vérifie, puis enregistre lui-même. Une carte Anki ciblée n'est proposée que dans ce JSON : c'est l'élève qui la valide.",
      inputSchema: z.object({}),
    },
    async () => text(restitutionPrompt())
  );

  server.registerTool(
    "get_demonstrations",
    {
      title: "État des démonstrations",
      description:
        "LECTURE SEULE. Pour chaque démonstration : son état OBSERVÉ (non travaillée, restitution incomplète, réussite avec aide, réussite autonome, à réactiver) et pourquoi, les dernières restitutions avec leurs lacunes (hypothèse, étape, justification, raisonnement), les lacunes qui REVIENNENT, les actions possibles (revoir la carte, carte ciblée, refaire, expliquer) avec leur raison, et la référence de la carte Anki. Ouvrir une carte ou y passer du temps n'est jamais une observation. `dans_anki: inconnu` = TaekdHub ne peut pas interroger Anki à distance : demande à l'élève, ne suppose pas. Ne crée jamais de carte pour une première lacune.",
      inputSchema: z.object({ ...SCOPE_FIELDS, demonstration: z.string().optional().describe("identifiant d'une démonstration (restitution_format)") }),
    },
    async (args) => {
      const user_id = await ownerId();
      if (!user_id) return text(NO_OWNER);
      const scope = scopeFrom(args);
      if (!scope.ok) return text(`Erreur : ${scope.error}`);
      const rows = await db().from("user_collections").select("collection, items").eq("user_id", user_id).in("collection", ["attempts", "preferences"]);
      if (rows.error) return text(`Erreur : ${rows.error.message}`);
      const byName: Record<string, unknown> = {};
      for (const row of rows.data ?? []) byName[row.collection as string] = row.items;
      const report = demonstrationsReport(
        { attempts: normalizeAttempts(byName.attempts), demoCards: normalizePreferences(byName.preferences ?? {}).demoCards, today: new Date().toLocaleDateString("en-CA") },
        { subject: scope.subject, chapterId: scope.chapterId, demoId: args.demonstration ?? null }
      );
      return text(JSON.stringify({ demonstrations: report, donnees: report.length === 0 ? "Aucune démonstration pour ce périmètre." : report.every((entry) => entry.restitutions === 0) ? "Aucune restitution enregistrée : il manque des observations, ne conclus rien sur la maîtrise." : undefined }));
    }
  );

  server.registerTool(
    "get_contexte_revision",
    {
      title: "Contexte de révision : khôlles, DS et priorités",
      description:
        "LECTURE SEULE. Le contexte pour « que dois-je réviser pour ma prochaine khôlle / mon DS ? », sans que l'élève ait à te le recopier : les prochaines épreuves datées (khôlle, DS, concours blanc) avec LEUR programme (chapitres rattachés dans TaekdHub), et pour chaque chapitre les difficultés récurrentes non corrigées, les erreurs ouvertes des évaluations précédentes, les démonstrations au programme (état observé, actions, carte Anki connue ou non), le souvenir attendu le jour J et les chiffres du dernier relevé Anki. `priorites` : au plus 8 actions, chacune avec ses FAITS (`pourquoi`), son rang et ce qui la vérifierait ; avec `minutes`, celles qui tiennent dans le temps. FILTRES : `type` (colle / DS / concours), `matiere`, `chapitre`, `echeance` (id), `jours` ou `avant` (AAAA-MM-JJ), `minutes`. RÈGLES : un programme inconnu est signalé dans `donnees_manquantes`, jamais deviné à partir de la matière ; ne recommande rien que `priorites` ne contienne, cite ses faits, et dis qu'il manque des données quand c'est le cas. Les révisions Anki ne sont PAS des restitutions. `anki` dit ce que TaekdHub voit — ou ne voit pas — d'Anki. `programme_colle_de_la_semaine` n'a pas de date : ne le rattache pas à une khôlle sans confirmation de l'élève.",
      inputSchema: z.object({
        ...SCOPE_FIELDS,
        type: z.enum(["colle", "DS", "concours", "toutes"]).optional().describe("sorte d'épreuve (toutes par défaut)"),
        echeance: z.string().optional().describe("identifiant d'une échéance (list_echeances)"),
        jours: z.number().int().min(0).max(MAX_HORIZON_DAYS).optional().describe("fenêtre à partir d'aujourd'hui (21 par défaut)"),
        avant: z.string().optional().describe("jusqu'à ce jour inclus, AAAA-MM-JJ (« avant vendredi ») ; prime sur `jours`"),
        minutes: z.number().int().min(5).max(600).optional().describe("temps disponible : les priorités sont choisies pour y tenir"),
      }),
    },
    async (args) => {
      const user_id = await ownerId();
      if (!user_id) return text(NO_OWNER);
      const scope = scopeFrom(args);
      if (!scope.ok) return text(`Erreur : ${scope.error}`);
      let horizon = args.jours;
      if (args.avant !== undefined) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(args.avant)) return text("Erreur : `avant` doit être au format AAAA-MM-JJ.");
        const days = Math.round((Date.parse(`${args.avant}T00:00:00Z`) - Date.parse(`${new Date().toLocaleDateString("en-CA")}T00:00:00Z`)) / 86_400_000);
        if (!Number.isFinite(days) || days < 0) return text("Erreur : `avant` est dans le passé ou n'existe pas.");
        horizon = days;
      }
      const input = await readRevision(user_id).catch(failure);
      if ("ok" in input) return text(`Erreur : ${input.error}`);
      return text(JSON.stringify(buildRevisionContext(input, { type: args.type, subject: scope.subject, chapterId: scope.chapterId, examId: args.echeance ?? null, horizonDays: horizon, minutes: args.minutes ?? null })));
    }
  );

  server.registerTool(
    "get_today",
    {
      title: "Où j'en suis aujourd'hui",
      description:
        "L'état du jour dans TaekdHub : la recommandation Next Move (raison, problème corrigé, critère de fin), le point faible principal établi par le diagnostic (cours, méthode, application, calcul, temps… avec ses preuves), les exercices à refaire sans aide, les échéances et DS des 14 prochains jours (avec leur `id`, modifiables par update_echeance), la mémoire des chapitres, les erreurs récentes, les cartes Anki dues au dernier relevé. À appeler AVANT de proposer un exercice, pour viser le vrai point faible. " + LOCK_RULE,
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
