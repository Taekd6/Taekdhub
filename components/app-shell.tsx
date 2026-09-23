import { AppNav } from "@/components/app-nav";
import { StorageAlert } from "@/components/storage-alert";

/**
 * CADRE DE L'APPLICATION.
 *
 * Une seule colonne centrée, bornée à `--shell-max`. Les écrans qui ont
 * besoin de plus (le lecteur d'exercice, plein cadre) sortent eux-mêmes de ce
 * conteneur.
 *
 * PAS DE FOND ICI : le fond (canvas + la lueur du haut de page) est posé sur
 * `body` (app/globals.css). Le repeindre ici masquerait la lueur, qui est ce
 * qui donne au thème « Nuit » sa profondeur.
 *
 * `pb-28` sous `lg` réserve la hauteur de la barre d'onglets mobile, qui est
 * en position fixe : sans cela, le dernier élément de chaque page se
 * retrouverait définitivement dessous.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="mx-auto w-full max-w-[var(--shell-max)] px-4 pb-28 pt-6 sm:px-6 sm:pt-10 lg:pb-20">
        <StorageAlert />
        {children}
      </main>
    </div>
  );
}
