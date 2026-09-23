import { AppNav } from "@/components/app-nav";
import { StorageAlert } from "@/components/storage-alert";

/**
 * CADRE DE L'APPLICATION.
 *
 * Une seule colonne centrée, bornée à `--shell-max`. Les écrans qui ont
 * besoin de plus (le lecteur d'exercice, plein cadre) sortent eux-mêmes de ce
 * conteneur.
 *
 * PAS DE FOND ICI : le fond (un aplat, noir ou #f5f5f7) est posé sur `body`
 * (app/globals.css) — un seul endroit le décide.
 *
 * De l'air, comme sur apple.com : 40 px sous la barre sur téléphone, 64 px
 * sur grand écran, et autant en bas de page.
 *
 * `pb-28` sous `lg` réserve la hauteur de la barre d'onglets mobile, qui est
 * en position fixe : sans cela, le dernier élément de chaque page se
 * retrouverait définitivement dessous.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="mx-auto w-full max-w-[var(--shell-max)] px-4 pb-32 pt-8 sm:px-6 sm:pt-12 lg:pb-24 lg:pt-16">
        <StorageAlert />
        {children}
      </main>
    </div>
  );
}
