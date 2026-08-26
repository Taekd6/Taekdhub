"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  BarChart3,
  BookOpenCheck,
  Clock3,
  History,
  LayoutDashboard,
  PlayCircle,
  Settings,
  Sparkles,
  Zap,
} from "lucide-react";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { levelFromXp, totalXp } from "@/lib/gamification";
import { cn } from "@/lib/cn";

/** Sprint 3G : "Profil" fusionné dans "Réglages" (deux pages à un seul champ chacune, jamais consultées séparément) — 7 entrées au lieu de 8, pour redonner de la marge tactile à la nav mobile compacte ci-dessous. */
const items = [
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/session", label: "Séance", icon: PlayCircle },
  { href: "/timer", label: "Focus", icon: Clock3 },
  { href: "/exercises", label: "Exercices", icon: BookOpenCheck },
  { href: "/history", label: "Historique", icon: History },
  { href: "/progress", label: "Progression", icon: BarChart3 },
  { href: "/settings", label: "Réglages", icon: Settings },
];

function NavItems({ compact = false }: { compact?: boolean }) {
  const path = usePathname();
  return (
    <>
      {items.map(({ href, label, icon: Icon }) => {
        const active = path === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "focus-ring group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors duration-150",
              active ? "font-medium text-ink" : "text-muted hover:text-ink",
              // 44 px de côté en mode compact : c'est la barre du BAS sur
              // mobile, donc le contrôle le plus touché de toute
              // l'application — et il mesurait 34 × 38 px. Les audits
              // précédents ne regardaient que les boutons de contenu et
              // l'avaient manqué.
              compact ? "min-h-11 min-w-11 justify-center px-2" : ""
            )}
            title={compact ? label : undefined}
          >
            {active && (
              <motion.span
                layoutId="sidebar-active"
                className="absolute inset-0 rounded-lg bg-inset"
                transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
              />
            )}
            <Icon size={17} strokeWidth={active ? 2.1 : 1.7} className="relative z-10 shrink-0" />
            {!compact && <span className="relative z-10">{label}</span>}
          </Link>
        );
      })}
    </>
  );
}

export function AppSidebar() {
  const { sessions, exercises, ready } = usePrepahubData();
  const xp = ready ? totalXp(exercises, sessions) : 0;
  const level = levelFromXp(xp);

  return (
    <>
      <aside // `bg-panel` et non `bg-zinc-950/80` : l'échelle zinc s'inverse avec le
      // thème, donc `zinc-950/80` valait du blanc à 80 % en clair — une barre
      // invisible sur un fond presque blanc. Le panneau, lui, est défini pour
      // se détacher du fond dans les deux thèmes.
      className="fixed inset-y-0 left-0 z-30 hidden w-[240px] flex-col border-r border-hairline/[0.07] bg-panel px-3 pb-4 pt-3 lg:flex">
        <Link
          href="/dashboard"
          className="focus-ring mb-7 mt-1 flex items-center gap-2.5 rounded-lg px-2 text-[0.9375rem] font-semibold tracking-tight"
        >
          <span className="grid h-7 w-7 place-items-center rounded-md bg-accent-brand text-black">
            <Sparkles size={15} />
          </span>
          TaekdHub
        </Link>

        <nav className="space-y-1">
          <NavItems />
        </nav>

        {/* Le bloc « Niveau » était collé tout en bas (`mt-auto`) : la colonne
            se lisait comme deux îlots séparés par 600 px de vide. Rattaché à
            la navigation, elle forme un seul ensemble, et le vide restant est
            franchement du vide plutôt qu'un décalage inexpliqué. */}
        <div className="mt-6 space-y-3">
          {ready && (
            <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-2">
              <Zap size={14} className="shrink-0 text-accent" />
              <p className="t-meta">
                <span className="font-medium text-ink">Niveau {level}</span> · {xp.toLocaleString("fr-FR")} XP
              </p>
            </div>
          )}
        </div>
      </aside>

      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around gap-1 border-t border-hairline/[0.09] bg-panel px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 lg:hidden"
      >
        <NavItems compact />
      </nav>
    </>
  );
}
