import { adminDb } from "@/lib/push-server";

/**
 * SUPPRIMER SON COMPTE — le droit à l'effacement.
 *
 * L'élève est identifié par son jeton de session Supabase
 * (`Authorization: Bearer …`), vérifié ici : on ne supprime JAMAIS que le
 * compte de la personne qui le demande, jamais un identifiant passé dans la
 * requête. Une confirmation écrite (`{ "confirmation": "SUPPRIMER" }`) évite
 * qu'un appel accidentel détruise un compte.
 *
 * Supprimer l'utilisateur d'authentification suffit : toutes les tables
 * (profiles, work_sessions, exercises, user_collections, exercise_logs,
 * push_subscriptions) y sont reliées en `on delete cascade`
 * (supabase/migrations). Aucune migration n'est nécessaire.
 *
 * Les données gardées sur l'appareil ne sont pas touchées : le serveur n'y a
 * pas accès. L'écran de Réglages propose de les effacer à part.
 */
export const dynamic = "force-dynamic";

const CONFIRMATION = "SUPPRIMER";

export async function POST(req: Request) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    return Response.json({ error: "Suppression indisponible : le serveur n'est pas configuré." }, { status: 503 });
  }
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return new Response("Unauthorized", { status: 401 });

  const body = (await req.json().catch(() => null)) as { confirmation?: unknown } | null;
  if (body?.confirmation !== CONFIRMATION) {
    return Response.json({ error: `Confirmation manquante : écris « ${CONFIRMATION} ».` }, { status: 400 });
  }

  const db = adminDb();
  const { data, error: authError } = await db.auth.getUser(token);
  if (authError || !data.user) return new Response("Unauthorized", { status: 401 });

  const { error } = await db.auth.admin.deleteUser(data.user.id);
  if (error) return Response.json({ error: "La suppression a échoué. Réessaie dans un instant." }, { status: 500 });
  return Response.json({ supprime: true });
}
