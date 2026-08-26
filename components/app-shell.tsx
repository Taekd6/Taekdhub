import { AppSidebar } from "@/components/app-sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <AppSidebar />
      {/* `max-w-6xl` : au-delà, les lignes de texte des cartes pleine largeur
          dépassaient 120 caractères sur un écran large — illisible. La barre
          de navigation mobile est ancrée en bas, d'où le padding bas généreux
          uniquement sous `lg`. */}
      <main className="min-h-screen px-4 pb-28 pt-6 sm:px-6 lg:ml-[240px] lg:px-10 lg:pb-12 lg:pt-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
