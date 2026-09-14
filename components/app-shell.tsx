import { AppNav } from "@/components/app-nav";
import { ComposerProvider, QuickAddButton } from "@/components/tasks/composer";
import { StorageAlert } from "@/components/storage-alert";
import { TimerBar } from "@/components/timer-bar";
import { TaekdhubProvider } from "@/lib/store/store";

/**
 * CADRE DE L'APPLICATION.
 *
 * Trois couches montées une seule fois, dans cet ordre précis :
 *
 *   TaekdhubProvider   la donnée. Une instance unique — c'est ici que se
 *                      règle le défaut de la version précédente, où chaque
 *                      composant créait son propre état et écrasait celui des
 *                      autres en enregistrant.
 *   ComposerProvider   l'ajout et l'ouverture d'une tâche, accessibles depuis
 *                      n'importe quel écran (et depuis la touche `n`).
 *   AppNav / TimerBar  le chrome.
 *
 * Une seule colonne centrée, bornée à `--shell-max` (1140 px) : au-delà, une
 * ligne de texte dépasse la mesure confortable ; en deçà, on gaspille l'écran
 * d'un portable. `pb-24` sous `lg` réserve la hauteur de la barre d'onglets
 * mobile, qui est en position fixe.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <TaekdhubProvider>
      <ComposerProvider>
        <div className="min-h-screen bg-canvas">
          <AppNav />
          <main className="mx-auto w-full max-w-[var(--shell-max)] px-4 pb-28 pt-6 sm:px-6 sm:pt-8 lg:pb-16">
            <StorageAlert />
            {children}
          </main>
          <TimerBar />
          <QuickAddButton />
        </div>
      </ComposerProvider>
    </TaekdhubProvider>
  );
}
