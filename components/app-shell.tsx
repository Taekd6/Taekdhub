import { AppSidebar } from "@/components/app-sidebar";
export function AppShell({children}:{children:React.ReactNode}) { return <div className="min-h-screen bg-canvas"><AppSidebar/><main className="min-h-screen px-5 py-7 md:ml-64 md:px-10">{children}</main></div>; }
