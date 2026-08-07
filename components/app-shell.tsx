import { AppSidebar } from "@/components/app-sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <AppSidebar />
      <main className="min-h-screen px-5 pb-24 pt-7 sm:px-8 lg:ml-[248px] lg:px-10 lg:pb-10">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
