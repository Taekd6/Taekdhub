"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * FEUILLE / DIALOGUE — une seule couche flottante pour toute l'application.
 *
 * Deux géométries, un seul composant : elle MONTE DU BAS sur mobile (la
 * géométrie du pouce) et se CENTRE sur grand écran (la géométrie de la
 * souris). La version précédente était `sm:hidden` — purement mobile — si
 * bien que tout formulaire ouvert sur un ordinateur n'apparaissait nulle
 * part. Une modale invisible sur la moitié des écrans est pire que pas de
 * modale.
 *
 * Volontairement minimale : pas de glisser-déposer, pas de points d'ancrage
 * intermédiaires. Un fond assombri, un panneau, une fermeture par Échap ou
 * par clic à côté. Le focus entre dans le panneau à l'ouverture et revient
 * d'où il venait à la fermeture — sans quoi la navigation au clavier
 * continuerait derrière le voile.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  footer,
  children,
  width = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
  width?: "md" | "lg";
}) {
  const panel = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreFocus.current = document.activeElement as HTMLElement | null;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);

    // Le premier champ reçoit le focus : sur « Ajouter », on doit pouvoir
    // taper le titre immédiatement, sans toucher la souris.
    const focusable = panel.current?.querySelector<HTMLElement>(
      "input:not([type=hidden]), textarea, select, button:not([aria-label=Fermer])"
    );
    focusable?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      restoreFocus.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center sm:p-6">
      <div onClick={onClose} aria-hidden className="animate-fade-in absolute inset-0 bg-black/45" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          // `floating` est la SEULE couche à porter une ombre dans le système
          // (app/globals.css) : fond, filet et `--shadow-surface` en une classe.
          "floating animate-rise relative flex max-h-[88vh] w-full flex-col rounded-t-2xl",
          "sm:max-h-[85vh] sm:rounded-2xl",
          width === "lg" ? "sm:max-w-2xl" : "sm:max-w-lg"
        )}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 className="t-subhead">{title}</h2>
            {description && <p className="t-meta mt-0.5">{description}</p>}
          </div>
          <Button variant="ghost" size="icon" aria-label="Fermer" onClick={onClose}>
            <X size={18} />
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>

        {footer && (
          <div className="shrink-0 border-t border-line px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-5 sm:pb-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/** Étiquette + champ, la brique de tous les formulaires. */
export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="t-label">{label}</span>
      <span className="mt-1.5 block">{children}</span>
      {hint && <span className="t-meta mt-1 block">{hint}</span>}
    </label>
  );
}
