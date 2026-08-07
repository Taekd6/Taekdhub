import Link from "next/link"; import { PageHeader } from "@/components/page-header"; import { DashboardOverview } from "@/components/dashboard-overview";
const today = new Intl.DateTimeFormat("fr-FR",{weekday:"long",day:"numeric",month:"long"}).format(new Date());
export default function Dashboard() { return <><PageHeader eyebrow={today} title="Bonjour." description="Une séance claire, puis la suivante." action={<Link href="/timer" className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-black">Démarrer une séance</Link>}/><DashboardOverview/></>; }
