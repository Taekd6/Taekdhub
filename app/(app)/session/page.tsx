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
      <PageBar
        title="Séance"
        meta="Une sélection prête à l'emploi, dimensionnée sur le temps que tu as et sur ce qui compte le plus maintenant."
      />
      <SessionRunner />
    </Stack>
  );
}
