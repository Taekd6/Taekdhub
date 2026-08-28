import { AppSidebar } from "@/components/app-sidebar";
import { PageTransition } from "@/components/page-transition";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <AppSidebar />
      {/* `max-w-[76rem]` (refonte V2) : élargi depuis 60rem pour donner aux
          compositions asymétriques (Dashboard : colonne principale + rail
          latéral, Exercices : navigateur + liste) la place de respirer sur
          desktop. Les écrans à lecture linéaire (Réglages, Focus) gardent
          leur propre largeur interne plus étroite — l'élargissement ne les
          affecte pas. La barre de navigation mobile est ancrée en bas, d'où
          le padding bas généreux uniquement sous `lg`. */}
      <main className="min-h-screen px-4 pb-28 pt-6 sm:px-6 lg:ml-[240px] lg:px-12 lg:pb-16 lg:pt-10">
        <div className="mx-auto max-w-[76rem]">
          <PageTransition>{children}</PageTransition>
        </div>
      </main>
    </div>
  );
}
