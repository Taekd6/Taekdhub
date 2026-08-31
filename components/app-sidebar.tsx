"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  BarChart3,
  BookOpenCheck,
  Clock3,
  GraduationCap,
  History,
  LayoutDashboard,
  PlayCircle,
  ScanLine,
  Settings,
  Target,
} from "lucide-react";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { levelFromXp, totalXp, xpProgressInLevel } from "@/lib/gamification";
import { cn } from "@/lib/cn";
import { AnimatedNumber } from "@/components/ui/animated-number";

/**
 * Deux groupes plutôt qu'une liste plate de sept entrées (refonte design) :
 * "Travailler" (ce qu'on vient faire) et "Suivre" (ce qu'on vient consulter).
 * Le regroupement est purement visuel — mêmes routes, aucun changement
 * d'information architecture — mais donne au premier coup d'œil une réponse
 * à « où suis-je, dans quel type d'écran ? » qu'une liste plate ne donne pas.
 * Réglages reste seul, séparé par un filet, comme sur la plupart des outils
 * de travail (Linear, Vercel) où les préférences ne sont jamais mélangées au
 * contenu quotidien.
 */
const groups = [
  {
    items: [
      { href: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
      { href: "/session", label: "Séance", icon: PlayCircle },
      { href: "/timer", label: "Focus", icon: Clock3 },
    ],
  },
  {
    items: [
      { href: "/exercises", label: "Exercices", icon: BookOpenCheck },
      { href: "/notions", label: "Radiographie", icon: ScanLine },
      { href: "/contests", label: "Concours", icon: GraduationCap },
      { href: "/history", label: "Historique", icon: History },
      { href: "/progress", label: "Progression", icon: BarChart3 },
      { href: "/goals", label: "Objectifs", icon: Target },
    ],
  },
];
const settingsItem = { href: "/settings", label: "Réglages", icon: Settings };
/**
 * La barre du bas (mobile) reste volontairement à SEPT entrées, pas huit :
 * à 44 px de cible tactile chacune (voir `NavLink`), une huitième icône
 * dépasserait la largeur confortable d'un écran de téléphone. "Objectifs",
 * "Concours" et "Radiographie" restent donc desktop-only dans la navigation —
 * "Objectifs" atteignable sur mobile via le Dashboard et la page Progression,
 * "Concours" via un lien depuis la page Exercices (voir
 * app/(app)/exercises/page.tsx), "Radiographie" via le bloc qui lui est
 * consacré sur le Dashboard (components/notions/notion-insight.tsx, rendu à
 * chaque visite dès que la banque déclare des notions) — aucun des trois
 * absent, juste pas dans CETTE barre précise.
 *
 * Cette règle prime sur l'envie d'y pousser la nouveauté : ajouter une
 * huitième cible tactile dégraderait les sept autres, tous les jours, pour un
 * écran qui a déjà son point d'entrée le plus visible ailleurs.
 */
const MOBILE_NAV_EXCLUDED = ["/goals", "/contests", "/notions"];
const compactItems = [...groups.flatMap((group) => group.items.filter((item) => !MOBILE_NAV_EXCLUDED.includes(item.href))), settingsItem];

function NavLink({ href, label, icon: Icon, compact }: { href: string; label: string; icon: typeof LayoutDashboard; compact: boolean }) {
  const path = usePathname();
  const active = path === href;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "focus-ring group relative flex items-center gap-3 rounded-lg px-2.5 py-[0.4375rem] text-sm transition-colors duration-150",
        active ? "font-medium text-ink" : "text-muted hover:text-ink",
        // 44 px de HAUT en mode compact : c'est la barre du BAS sur mobile,
        // donc le contrôle le plus touché de toute l'application. La largeur,
        // elle, n'est plus un minimum fixe mais la colonne entière (voir la
        // grille de la barre ci-dessous) : à 320 px, sept minimums de 44 px
        // plus les gouttières demandaient 348 px — la septième entrée
        // (Réglages) sortait de l'écran, à moitié coupée et intouchable.
        compact ? "min-h-11 w-full justify-center px-0" : ""
      )}
      title={compact ? label : undefined}
    >
      {active && (
        <motion.span
          layoutId={compact ? "mobile-nav-active" : "sidebar-active"}
          className="absolute inset-0 rounded-lg bg-inset"
          transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
        />
      )}
      <Icon size={17} strokeWidth={active ? 2.1 : 1.6} className="relative z-10 shrink-0" />
      {!compact && <span className="relative z-10">{label}</span>}
    </Link>
  );
}

/** Monogramme plat plutôt qu'une icône décorative (une étincelle générique ne dit rien de TaekdHub) — un carré de la couleur de marque et une lettre suffisent à faire une identité reconnaissable. */
function Mark() {
  return (
    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-accent-solid text-[0.75rem] font-bold text-accent-solid-foreground">
      T
    </span>
  );
}

export function AppSidebar() {
  const { sessions, exercises, ready } = usePrepahubData();
  const xp = ready ? totalXp(exercises, sessions) : 0;
  const level = levelFromXp(xp);
  const xpProgress = xpProgressInLevel(xp);

  return (
    <>
      <aside
        // `bg-panel` et non `bg-zinc-950/80` : l'échelle zinc s'inverse avec
        // le thème, donc `zinc-950/80` valait du blanc à 80 % en clair — une
        // barre invisible sur un fond presque blanc. Le panneau, lui, est
        // défini pour se détacher du fond dans les deux thèmes.
        className="fixed inset-y-0 left-0 z-30 hidden w-[240px] flex-col border-r border-hairline/[0.07] bg-panel px-3 pb-4 pt-4 lg:flex"
      >
        <Link href="/dashboard" className="focus-ring mb-8 flex items-center gap-2.5 rounded-lg px-2 text-[0.9375rem] font-semibold tracking-tight">
          <Mark />
          TaekdHub
        </Link>

        <nav className="flex flex-1 flex-col gap-5">
          {groups.map((group, index) => (
            <div key={index} className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink key={item.href} {...item} compact={false} />
              ))}
            </div>
          ))}
        </nav>

        {/* Réglages + niveau, en bas, séparés du reste par un filet — un
            second ensemble (préférences, statut) plutôt qu'une septième
            entrée de nav indistincte des six premières. */}
        <div className="space-y-3 border-t border-hairline/[0.07] pt-3">
          <NavLink {...settingsItem} compact={false} />
          {ready && xp > 0 && (
            <div className="rounded-lg px-2.5 py-1.5">
              <div className="flex items-baseline justify-between">
                <p className="text-xs font-medium text-ink">Niveau {level}</p>
                <p className="text-2xs text-subtle">
                  <AnimatedNumber value={xp} format={(n) => `${Math.round(n).toLocaleString("fr-FR")} XP`} />
                </p>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-hairline/[0.08]">
                <div className="h-full rounded-full bg-accent/70 transition-all duration-500" style={{ width: `${xpProgress.percent}%` }} />
              </div>
            </div>
          )}
        </div>
      </aside>

      <nav
        aria-label="Navigation principale"
        // Grille d'autant de colonnes égales qu'il y a d'entrées, plutôt
        // qu'une rangée flex de largeurs minimales : la barre s'ajuste à
        // l'écran au lieu de le déborder, et chaque entrée occupe SA colonne
        // entière — plus aucune gouttière morte entre deux cibles. Le nombre
        // vient de la liste elle-même : ajouter une entrée resserre la barre
        // au lieu de la faire déborder (ce qui ne dispense pas de la règle
        // des sept, documentée plus haut).
        style={{ gridTemplateColumns: `repeat(${compactItems.length}, minmax(0, 1fr))` }}
        className="fixed inset-x-0 bottom-0 z-40 grid items-center border-t border-hairline/[0.09] bg-panel px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 lg:hidden"
      >
        {compactItems.map((item) => (
          <NavLink key={item.href} {...item} compact />
        ))}
      </nav>
    </>
  );
}
