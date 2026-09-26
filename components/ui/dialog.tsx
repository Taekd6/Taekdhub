"use client";

import { useEffect, useRef } from "react";

/**
 * DIALOGUE — une décision qui ne peut pas attendre (et il y en a peu).
 *
 * Même matière que la feuille mobile (components/ui/sheet.tsx) : `.floating`,
 * fond assombri, ouverture en CSS. Mais visible à TOUTES les largeurs —
 * centré sur grand écran, collé en bas sur téléphone — et sans fermeture
 * implicite quand `dismissible` est faux : une décision sur des données ne
 * se prend pas par un clic à côté.
 */
export function Dialog({
  open,
  title,
  onClose,
  dismissible = true,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose?: () => void;
  dismissible?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dismissible) onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, dismissible, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center sm:p-6">
      <div onClick={dismissible ? onClose : undefined} className="animate-fade-in absolute inset-0 bg-black/55" />
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="floating animate-rise relative flex max-h-[88vh] w-full flex-col rounded-t-3xl outline-none sm:max-w-lg sm:rounded-3xl"
      >
        <h2 className="t-heading px-5 pt-6 sm:px-7">{title}</h2>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-7">{children}</div>
        {footer && <div className="shrink-0 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2 sm:px-7 sm:pb-6">{footer}</div>}
      </div>
    </div>
  );
}
