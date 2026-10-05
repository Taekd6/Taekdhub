"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BellRing, ChevronDown, Info, X } from "lucide-react";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { computeAlerts, pruneSnoozes, snoozeAlert, visibleAlerts, type AlertLevel, type AppAlert, type SnoozeMap } from "@/lib/alerts";
import { cn } from "@/lib/cn";

/**
 * LA BANNIÈRE D'ALERTE — une notification d'iOS, dans l'application.
 *
 * Elle DESCEND du haut de l'écran en verre (`.alert-in`, ressort), porte la
 * plus importante des alertes du moment (lib/alerts.ts) et, s'il y en a
 * d'autres, « + 2 autres » qui déplie la pile. Chaque alerte a UN bouton
 * (le geste qui la règle) et « Plus tard » : écartée, une info se tait
 * jusqu'au lendemain, une urgence revient au bout de deux heures.
 *
 * Les écarts vivent sur l'appareil (`prepahub:alerts:snoozed`), pas dans le
 * compte : c'est un réglage d'écran, pas une donnée de travail.
 *
 * Recalculée chaque minute : « minimum du soir » et « rien noté » dépendent
 * de l'heure. Jamais sur l'accueil guidé, ni pendant une séance de
 * révision ou une épreuve : on n'interrompt pas ce qu'on demande de faire.
 */

const SNOOZE_KEY = "prepahub:alerts:snoozed";
const QUIET_PATHS = ["/bienvenue", "/revoir/session", "/epreuve", "/kholle"];

function readSnoozes(): SnoozeMap {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SNOOZE_KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as SnoozeMap) : {};
  } catch {
    return {};
  }
}

function writeSnoozes(map: SnoozeMap): void {
  try {
    localStorage.setItem(SNOOZE_KEY, JSON.stringify(map));
  } catch {
    // Stockage bloqué : l'alerte reviendra simplement au prochain chargement.
  }
}

const LEVEL_META: Record<AlertLevel, { label: string; icon: typeof BellRing; dot: string }> = {
  urgent: { label: "Urgent", icon: AlertTriangle, dot: "bg-rose-400 [box-shadow:0_0_0_4px_rgb(var(--rose-400-rgb)/0.18)]" },
  attention: { label: "À faire", icon: BellRing, dot: "bg-amber-400 [box-shadow:0_0_0_4px_rgb(var(--amber-400-rgb)/0.18)]" },
  info: { label: "Rappel", icon: Info, dot: "grad-brand" },
};

export function AlertCenter() {
  const pathname = usePathname();
  const { sessions, workItems, reviewItems, preferences, ready } = usePrepahubData();
  const [now, setNow] = useState(() => new Date());
  const [snoozes, setSnoozes] = useState<SnoozeMap>({});
  const [expanded, setExpanded] = useState(false);
  const [leaving, setLeaving] = useState<string | null>(null);

  useEffect(() => {
    setSnoozes(pruneSnoozes(readSnoozes(), new Date()));
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const alerts = useMemo(
    () => (ready ? visibleAlerts(computeAlerts({ sessions, workItems, reviewItems, preferences, now }), snoozes, now) : []),
    [ready, sessions, workItems, reviewItems, preferences, now, snoozes]
  );

  if (alerts.length === 0 || QUIET_PATHS.some((path) => pathname.startsWith(path))) return null;

  function later(alert: AppAlert) {
    setLeaving(alert.id);
    // Le temps de l'animation de sortie, puis l'alerte quitte la pile.
    setTimeout(() => {
      const next = snoozeAlert(snoozes, alert, new Date());
      writeSnoozes(next);
      setSnoozes(next);
      setLeaving(null);
    }, 280);
  }

  const shown = expanded ? alerts : alerts.slice(0, 1);
  const others = alerts.length - 1;

  return (
    <section
      aria-label="Alertes"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-50 mx-auto flex max-w-md flex-col gap-2 lg:top-20 print:hidden"
    >
      {shown.map((alert, index) => {
        const meta = LEVEL_META[alert.level];
        return (
          <article
            key={alert.id}
            className={cn("glass-thick alert-in pointer-events-auto rounded-[1.5rem] p-4", leaving === alert.id && "alert-out")}
            style={{ "--i": index } as React.CSSProperties}
            role={alert.level === "urgent" ? "alert" : undefined}
          >
            <div className="flex items-start gap-3">
              <span aria-hidden className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", meta.dot)} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-[0.75rem] font-semibold text-muted">
                  <meta.icon size={12} aria-hidden /> {meta.label}
                </p>
                <h2 className="mt-0.5 text-[0.9375rem] font-semibold leading-snug text-ink">{alert.title}</h2>
                <p className="mt-0.5 text-[0.875rem] leading-snug text-muted">{alert.body}</p>
                <div className="mt-3 flex items-center gap-2">
                  <Link
                    href={alert.href}
                    onClick={() => later(alert)}
                    className="press grad-btn inline-flex min-h-9 items-center rounded-full px-4 text-[0.8125rem] font-semibold max-lg:min-h-10"
                  >
                    {alert.action}
                  </Link>
                  <button type="button" onClick={() => later(alert)} className="press min-h-9 rounded-full px-3 text-[0.8125rem] font-semibold text-muted hover:text-ink max-lg:min-h-10">
                    Plus tard
                  </button>
                </div>
              </div>
              <button type="button" onClick={() => later(alert)} aria-label="Fermer" className="press -mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-subtle hover:bg-inset hover:text-ink">
                <X size={16} aria-hidden />
              </button>
            </div>
          </article>
        );
      })}
      {others > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="glass-thick alert-in press pointer-events-auto mx-auto inline-flex min-h-9 items-center gap-1 rounded-full px-4 text-[0.8125rem] font-semibold text-ink"
          style={{ "--i": 1 } as React.CSSProperties}
        >
          {expanded ? "Réduire" : `+ ${others} autre${others > 1 ? "s" : ""}`}
          <ChevronDown size={14} aria-hidden className={cn("transition-transform duration-300", expanded && "rotate-180")} />
        </button>
      )}
    </section>
  );
}
