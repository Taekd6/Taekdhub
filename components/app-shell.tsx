import { AppSidebar } from "@/components/app-sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <AppSidebar />
      {/* `max-w-[60rem]` (refonte design) : resserré depuis 72rem — une
          colonne de contenu plus étroite lit comme un document qu'on
          travaille (Linear, Notion) plutôt qu'un tableau de bord qui étale
          l'information pour remplir l'écran. La barre de navigation mobile
          est ancrée en bas, d'où le padding bas généreux uniquement sous `lg`. */}
      <main className="min-h-screen px-4 pb-28 pt-6 sm:px-6 lg:ml-[240px] lg:px-12 lg:pb-16 lg:pt-10">
        <div className="mx-auto max-w-[60rem]">{children}</div>
      </main>
    </div>
  );
}
