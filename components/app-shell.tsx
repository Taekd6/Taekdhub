import { AppSidebar } from "@/components/app-sidebar";
import { OnboardingFlow } from "@/components/onboarding-flow";
import { StorageErrorBanner } from "@/components/storage-error-banner";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <OnboardingFlow />
      <AppSidebar />
      {/* `pb-24` (6rem) de base pour ne jamais passer sous la nav mobile fixe
          (voir app-sidebar.tsx), augmenté de la zone sûre iOS quand elle
          existe — sinon le dernier contenu resterait caché derrière la nav
          sur un appareil à indicateur d'accueil (Sprint Mobile UX + PWA
          Foundation). `lg:pb-10` (desktop, pas de nav fixe en bas) inchangé. */}
      <main className="min-h-screen px-5 pt-7 [padding-bottom:calc(6rem+env(safe-area-inset-bottom))] sm:px-8 lg:ml-[248px] lg:px-10 lg:pb-10">
        <div className="mx-auto max-w-7xl space-y-5">
          <StorageErrorBanner />
          {children}
        </div>
      </main>
    </div>
  );
}
