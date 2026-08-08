"use client";

import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { DashboardOverview } from "@/components/dashboard-overview";
import { Button } from "@/components/ui/button";
import { usePrepahubData } from "@/hooks/use-prepahub-data";

const today = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

export default function DashboardPage() {
  const { preferences, ready } = usePrepahubData();
  const name = preferences.displayName?.trim();
  const greeting = ready && name ? `Bonjour, ${name}.` : "Bonjour.";

  return (
    <>
      <PageHeader
        eyebrow={today}
        title={greeting}
        description="Une séance claire, puis la suivante."
        action={
          <Link href="/session">
            <Button>Démarrer une séance</Button>
          </Link>
        }
      />
      <DashboardOverview />
    </>
  );
}
