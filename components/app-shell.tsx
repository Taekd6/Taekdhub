import { AppSidebar } from "@/components/app-sidebar";
import { PageTransition } from "@/components/page-transition";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      {/* ONZE LIENS AVANT LE CONTENU, À CHAQUE PAGE.
          Mesuré au clavier : atteindre le premier contrôle de /session
          demandait douze Tab, dont onze pour retraverser une barre latérale
          identique d'une page à l'autre. Un lien d'évitement est le seul
          moyen, pour qui n'a pas de souris, de sauter ce bloc — les repères
          de structure (`<main>`, `<nav>`) ne servent qu'aux lecteurs
          d'écran. Invisible tant qu'il n'a pas le focus, premier dans
          l'ordre de tabulation, et rendu avec les jetons existants. */}
      <a
        href="#contenu-principal"
        className="focus-ring sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-lg focus:border focus:border-hairline/[0.09] focus:bg-panel focus:px-4 focus:text-sm focus:font-medium focus:text-ink"
      >
        Aller au contenu
      </a>
      <AppSidebar />
      {/* `max-w-[76rem]` (refonte V2) : élargi depuis 60rem pour donner aux
          compositions asymétriques (Dashboard : colonne principale + rail
          latéral, Exercices : navigateur + liste) la place de respirer sur
          desktop. Les écrans à lecture linéaire (Réglages, Focus) gardent
          leur propre largeur interne plus étroite — l'élargissement ne les
          affecte pas. La barre de navigation mobile est ancrée en bas, d'où
          le padding bas généreux uniquement sous `lg`. */}
      <main id="contenu-principal" className="min-h-screen px-4 pb-28 pt-6 sm:px-6 lg:ml-[240px] lg:px-12 lg:pb-16 lg:pt-10">
        <div className="mx-auto max-w-[76rem]">
          <PageTransition>{children}</PageTransition>
        </div>
      </main>
    </div>
  );
}
