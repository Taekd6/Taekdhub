import { Group, Row } from "@/components/ui/grouped";

const BODY = `{ "termines": [Texte des URL cochées] }`;

const RESPONSE = `{
  "coches":   ["…"],            // tâches cochées dans TaekdHub
  "a_faire":  [{ "titre", "date", "url", "notes", … }],
  "termines": ["https://…/echeances?t=…"]
}`;

/**
 * SYNCHRO RAPPELS — le mode d'emploi du raccourci iOS qui fait le pont entre
 * la liste « TaekdHub » de Rappels et les tâches du site (lib/rappels.ts).
 * Même jeton que la capture rapide : rien de nouveau à créer dans Vercel.
 */
export function RappelsGuide() {
  return (
    <Group
      id="rappels"
      title="Synchro avec Rappels"
      footer="Coche un rappel sur l'iPhone ou la montre : la tâche passe à « terminé » dans TaekdHub au prochain passage du raccourci (fermeture de Rappels, ou à heure fixe). Coche dans TaekdHub : le rappel se coche au passage suivant. Le jeton ne doit être ni partagé ni collé dans une conversation."
    >
      <Row label="1. La liste" hint="Dans Rappels, crée une liste nommée exactement « TaekdHub ». Le raccourci n'y touche qu'à elle." stack />
      <Row
        label="2. Ce que tu as coché"
        hint="Raccourcis → nouveau raccourci « TaekdHub ⇄ Rappels ». Action « Rechercher des rappels » : Liste est TaekdHub, Est terminé, Date d'achèvement dans les 3 derniers jours. Puis « Obtenir les détails des rappels » : URL. Puis « Combiner le texte » avec un retour à la ligne."
        stack
      />
      <Row label="3. Une seule requête" hint="« Obtenir le contenu de l'URL » : adresse du site + /api/rappels, méthode POST, en-tête Authorization = « Bearer » + le jeton de la capture rapide, corps JSON :" stack>
        <pre className="w-full overflow-x-auto rounded-xl bg-inset p-3 text-[0.75rem] leading-relaxed text-ink">{BODY}</pre>
      </Row>
      <Row label="Réponse" hint="Le site coche d'abord ce que tu as envoyé, puis répond :" stack>
        <pre className="w-full overflow-x-auto rounded-xl bg-inset p-3 text-[0.75rem] leading-relaxed text-ink">{RESPONSE}</pre>
      </Row>
      <Row
        label="4. Créer ce qui manque"
        hint="« Obtenir la valeur du dictionnaire » a_faire → « Répéter avec chaque élément » : « Rechercher des rappels » dont l'URL est l'url de l'élément (ou dont les Notes contiennent sa « marque »). Si le nombre est 0 : « Ajouter un nouveau rappel » dans TaekdHub, titre = titre, alerte = date, URL = url, notes = notes."
        stack
      />
      <Row
        label="5. Cocher ce qui est fait sur le site"
        hint="« Obtenir la valeur du dictionnaire » termines → « Répéter avec chaque élément » : « Rechercher des rappels » non terminés dont l'URL est l'élément → « Modifier les détails du rappel » : Est terminé."
        stack
      />
      <Row
        label="6. Automatique"
        hint="Raccourcis → Automatisation → « App » : Rappels, « Est fermée », Exécuter immédiatement. Ajoute aussi « Heure de la journée » à 7 h et 18 h. Tu coches, tu fermes Rappels : c'est à jour partout."
        stack
      />
    </Group>
  );
}
