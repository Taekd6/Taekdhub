import { Group, Row } from "@/components/ui/grouped";

const SEANCE = `{
  "type": "seance",
  "matiere": "Mathématiques",
  "minutes": 45,
  "id": "20261021143000"
}`;

const EXERCICE = `{
  "type": "exercice",
  "matiere": "Physique",
  "resultat": "réussi",
  "aide": "sans",
  "id": "20261021143000"
}`;

/**
 * CAPTURE RAPIDE (montre) — le mode d'emploi du raccourci Apple qui note une
 * séance ou un exercice en deux gestes. Texte seulement : le jeton
 * (`CAPTURE_TOKEN`) n'est ni affiché ni lu ici, il vit dans Vercel et dans le
 * raccourci. Voir lib/capture.ts et app/api/capture/route.ts.
 */
export function CaptureGuide() {
  return (
    <Group
      id="capture"
      title="Capture rapide (montre)"
      footer="Une saisie ajoute une ligne, jamais plus : elle ne peut rien lire ni modifier, et une erreur se supprime ici. Le jeton ne doit être ni partagé ni collé dans une conversation."
    >
      <Row label="1. Créer le jeton" hint="Dans Vercel (Settings → Environment Variables) : CAPTURE_TOKEN = une valeur aléatoire d'au moins 32 caractères (openssl rand -hex 32), et MCP_USER_ID = l'identifiant de ton compte (Supabase → Authentication → Users). Puis redéploie." stack />
      <Row label="2. Créer le raccourci" hint="App Raccourcis, nouveau raccourci : « Choisir dans le menu » (la matière), « Demander une saisie » de type nombre (les minutes), « Date actuelle » au format personnalisé yyyyMMddHHmmss (c'est l'id : il évite un doublon si le raccourci est relancé), puis « Obtenir le contenu de l'URL »." stack />
      <Row label="3. Régler la requête" hint="URL : l'adresse de ton site + /api/capture. Méthode POST. En-têtes : Authorization = « Bearer » + ton jeton, et Content-Type = application/json. Corps JSON, comme ci-dessous." stack>
        <pre className="w-full overflow-x-auto rounded-xl bg-inset p-3 text-[0.75rem] leading-relaxed text-ink">{SEANCE}</pre>
      </Row>
      <Row label="Pour noter un exercice" hint="Même raccourci, autre menu. Résultat : réussi, partiel ou échec. Aide : sans, indices ou correction. Les valeurs sont celles-là exactement." stack>
        <pre className="w-full overflow-x-auto rounded-xl bg-inset p-3 text-[0.75rem] leading-relaxed text-ink">{EXERCICE}</pre>
      </Row>
      <Row label="4. L'afficher sur la montre" hint="Dans les détails du raccourci, active « Afficher sur Apple Watch ». Réponse attendue : { enregistre, doublon }. 401 = jeton faux ; 503 = variables manquantes ; 400 = une valeur hors liste." stack />
    </Group>
  );
}
