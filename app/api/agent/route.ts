import { NextResponse } from "next/server";

/**
 * ============================================================================
 * POINT D'ENTRÉE AGENT — `POST /api/agent`
 * ============================================================================
 *
 * Reçoit `{ question, snapshot }` où `snapshot` est produit par
 * lib/agent/snapshot.ts, et renvoie une analyse. Les données vivant dans le
 * navigateur de l'élève, c'est le CLIENT qui envoie l'instantané : le serveur
 * n'a et ne garde aucune donnée.
 *
 * Sans clé API configurée, la route répond 501 avec une explication claire
 * plutôt que de faire semblant. L'interface bascule alors sur « copier le
 * contexte », qui permet de coller l'instantané dans n'importe quel assistant
 * — Claude compris. C'est la raison pour laquelle l'instantané est
 * auto-descriptif : il doit être exploitable hors de cette route.
 */

export const runtime = "edge";

const MODEL = "claude-sonnet-5";
const MAX_SNAPSHOT_BYTES = 400_000;

const SYSTEM_PROMPT = `Tu es le copilote d'organisation d'un élève de prépa scientifique, dans l'application TaekdHub.

Tu reçois un instantané JSON de sa situation réelle : tâches, échéances, disponibilités déclarées, charge par jour, temps réellement travaillé, historique. Le champ "schema" du JSON définit chaque unité et chaque convention — lis-le avant de raisonner.

RÈGLES ABSOLUES
- Raisonne à partir des CHIFFRES du JSON. Ne recalcule pas la charge ou le retard à ta façon : les champs "workload", "tasks[].remainingMinutes" et "tasks[].overdue" font foi.
- « J'ai X heures ce soir » se répond avec "capacity.remainingTodayMinutes" et les tâches les mieux classées ("tasks[].rank"), pas avec la capacité de la journée entière.
- Tout ce qui figure dans "impossible" ne se planifie PAS : propose un arbitrage (réduire l'ambition, libérer du temps, prévenir), jamais un emploi du temps qui le ferait rentrer.
- "upcomingEvents" (DS, khôlles) sont des rendez-vous : on ne les « fait » pas, on s'y prépare avec des tâches distinctes.
- Ne propose JAMAIS de contenu pédagogique, d'exercices ni de corrigés : TaekdHub organise le travail, il ne l'héberge pas. Les ressources sont ailleurs (TD, livres, annales).
- Ne cherche pas à faire travailler plus. L'objectif est l'équilibre entre échéances, retard, progression et temps réellement disponible. Dire « allège mardi » est une bonne réponse.
- Cite les tâches par leur titre exact, et écris les durées comme on les dit (« 1 h 30 », pas « 90 min »).
- Si les données sont trop maigres pour conclure (peu de semaines observées, aucun temps enregistré), dis-le au lieu d'inventer une tendance.

FORME
- Français, tutoiement, ton direct et sobre.
- 150 mots au maximum, sauf si la question demande explicitement un plan détaillé.
- Commence par la réponse, pas par un préambule. Termine par une action concrète.`;

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "not-configured",
        message:
          "Aucune clé ANTHROPIC_API_KEY configurée sur ce déploiement. Utilise « Copier le contexte » pour coller l'instantané dans l'assistant de ton choix.",
      },
      { status: 501 }
    );
  }

  let payload: { question?: unknown; snapshot?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "bad-request", message: "Corps de requête illisible." }, { status: 400 });
  }

  const question = typeof payload.question === "string" ? payload.question.trim() : "";
  if (!question || !payload.snapshot) {
    return NextResponse.json({ error: "bad-request", message: "`question` et `snapshot` sont requis." }, { status: 400 });
  }

  const snapshot = JSON.stringify(payload.snapshot);
  if (snapshot.length > MAX_SNAPSHOT_BYTES) {
    return NextResponse.json({ error: "too-large", message: "Instantané trop volumineux." }, { status: 413 });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Voici l'instantané de ma situation :\n\n<snapshot>\n${snapshot}\n</snapshot>\n\nMa question : ${question}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "upstream", message: `L'analyse a échoué (${response.status}).` },
        { status: 502 }
      );
    }

    const data = (await response.json()) as { content?: { type: string; text?: string }[] };
    const answer = (data.content ?? [])
      .filter((block) => block.type === "text")
      .map((block) => block.text ?? "")
      .join("\n")
      .trim();

    return NextResponse.json({ answer: answer || "Aucune réponse." });
  } catch {
    return NextResponse.json({ error: "network", message: "Impossible de joindre le service d'analyse." }, { status: 502 });
  }
}
