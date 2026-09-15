import { PageBar, Stack } from "@/components/ui/layout";
import { SessionRunner } from "@/components/session/session-runner";

/**
 * Composition `Stack` : la séance est un ENCHAÎNEMENT (régler, confirmer,
 * travailler, conclure). Un enchaînement se lit dans une colonne — un rail
 * n'aurait rien à y montrer que l'étape en cours ne dise déjà.
 */
export default function SessionPage() {
  return (
    <Stack className="space-y-8">
      {/* `quiet` : la question de l'écran est posée par le bloc en dessous
          (« Combien de temps as-tu devant toi ? »), composé en `t-display`.
          Deux titres de même corps l'un sur l'autre, dont le premier ne fait
          que nommer l'onglet d'où l'on vient, ne hiérarchisent rien. */}
      <PageBar
        rank="quiet"
        title="Séance"
        lede="Une sélection prête à l'emploi, dimensionnée sur le temps que tu as et sur ce qui compte le plus maintenant."
      />
      <SessionRunner />
    </Stack>
  );
}
