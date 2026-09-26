import { AccountProvider } from "@/components/account/account-provider";
import { AppNav } from "@/components/app-nav";
import { StorageAlert } from "@/components/storage-alert";

/**
 * CADRE DE L'APPLICATION.
 *
 * Une seule colonne centrée, bornée à `--shell-max`.
 *
 * LE FOND. L'aplat (#f5f6fa en clair, presque noir en sombre) est posé sur
 * `body` (app/globals.css). Par-dessus, et SOUS tout le contenu, deux HALOS
 * pastel teintés par la palette (`.halo-a` en c1, `.halo-b` en c2) qui
 * dérivent très lentement — la lumière de la maquette « Revolut clair ».
 * Leur calque est `fixed` : ils restent en place pendant le défilement,
 * comme une lumière et non comme un décor collé à la page. Jamais
 * cliquables, jamais lus (`aria-hidden`).
 *
 * `pb-32` sous `lg` réserve la hauteur de la barre d'onglets mobile, qui est
 * en position fixe : sans cela, le dernier élément de chaque page se
 * retrouverait définitivement dessous.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    // Compte et synchronisation (components/account/account-provider.tsx) : actif
    // sur toutes les pages, inerte quand Supabase n'est pas configuré.
    <AccountProvider>
      <div className="min-h-screen">
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="halo halo-a" />
          <div className="halo halo-b" />
        </div>
        <AppNav />
        <main className="mx-auto w-full max-w-[var(--shell-max)] px-4 pb-32 pt-5 sm:px-6 sm:pt-10 lg:pb-24 lg:pt-12">
          <StorageAlert />
          {children}
        </main>
      </div>
    </AccountProvider>
  );
}
