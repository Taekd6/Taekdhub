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
              "focus-ring group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
              active ? "text-ink" : "text-zinc-400 hover:text-zinc-100",
              compact ? "justify-center px-2" : ""
            )}
            title={compact ? label : undefined}
          >
            {active && (
              <motion.span
                layoutId="sidebar-active"
                className="absolute inset-0 rounded-xl border border-hairline/[0.09] bg-hairline/[0.08] shadow-sm"
                transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
              />
            )}
            <Icon size={18} strokeWidth={active ? 2.25 : 1.75} className="relative z-10" />
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
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-hairline/[0.07] bg-zinc-950/80 p-3 backdrop-blur-xl lg:flex">
        <Link
          href="/dashboard"
          className="focus-ring mb-6 mt-1 flex items-center gap-3 rounded-xl px-3 text-lg font-semibold tracking-tight"
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-accent-foreground shadow-glow">
            <Sparkles size={16} />
          </span>
          TaekdHub
        </Link>

        <nav className="space-y-1">
          <NavItems />
        </nav>

        <div className="mt-auto space-y-3">
          {ready && (
            <div className="rounded-2xl border border-hairline/[0.07] bg-hairline/[0.04] p-4">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent/15">
                  <Zap size={14} className="text-accent" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-zinc-200">Niveau {level}</p>
                  <p className="text-2xs text-zinc-500">{xp.toLocaleString("fr-FR")} XP</p>
                </div>
              </div>
            </div>
          )}
          <div className="rounded-2xl border border-hairline/[0.07] bg-hairline/[0.04] p-4">
            <p className="text-xs font-semibold text-zinc-200">Règle du jour</p>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              Une séance sans distraction vaut plus qu&apos;une longue liste.
            </p>
          </div>
        </div>
      </aside>

      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-3 bottom-3 z-40 flex items-center justify-around gap-1 rounded-2xl border border-hairline/[0.09] bg-zinc-950/85 p-1.5 shadow-2xl shadow-black/30 backdrop-blur-xl lg:hidden"
      >
        <NavItems compact />
      </nav>
    </>
  );
}
