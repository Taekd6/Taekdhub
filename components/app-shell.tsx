import { AppNav } from "@/components/app-nav";
import { StorageAlert } from "@/components/storage-alert";

/**
 * CADRE DE L'APPLICATION.
 *
 * Une seule colonne centrée, bornée à `--shell-max` (1140 px). Au-delà, une
 * ligne de texte dépasse la mesure confortable et l'œil perd le début de la
 * ligne suivante ; en deçà, on gaspille l'écran d'un portable. Les écrans qui
 * ont besoin de plus (le lecteur d'exercice, plein cadre) sortent eux-mêmes
 * de ce conteneur.
 *
 * `pb-24` sous `lg` réserve la hauteur de la barre d'onglets mobile, qui est
 * en position fixe : sans cela, le dernier élément de chaque page se retrouve
 * définitivement dessous.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <AppNav />
      <main className="mx-auto w-full max-w-[var(--shell-max)] px-4 pb-24 pt-6 sm:px-6 sm:pt-8 lg:pb-16">
        <StorageAlert />
        {children}
      </main>
    </div>
  );
}
