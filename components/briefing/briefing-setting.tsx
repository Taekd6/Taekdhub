"use client";

import { Group, Row } from "@/components/ui/grouped";
import { SegmentedControl } from "@/components/ui/segmented";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { localData } from "@/lib/storage";

/**
 * Réglages → « À l'ouverture » : afficher ou non « Le point » (app/(app)/point)
 * à la première ouverture de la journée. Enregistré tout de suite, relu sur
 * le disque avant l'écriture — même règle que le sélecteur de thème.
 */
export function BriefingSetting() {
  const { preferences, savePreferences, ready } = usePrepahubData();
  return (
    <Group id="ouverture" title="À l'ouverture" footer="Une fois par jour (et après quelques heures d'absence) : ce qu'il faut faire, ce qui presse, ce que tu repousses. On y revient en touchant la date de l'accueil.">
      <Row label="Le point du jour" hint="Avant l'accueil">
        <SegmentedControl
          ariaLabel="Afficher le point à l'ouverture"
          size="sm"
          options={[
            { value: "oui", label: "Afficher" },
            { value: "non", label: "Masquer" },
          ]}
          value={ready && !preferences.briefingOnOpen ? "non" : "oui"}
          onChange={(value) => savePreferences({ ...localData.preferences(), briefingOnOpen: value === "oui" })}
        />
      </Row>
    </Group>
  );
}
