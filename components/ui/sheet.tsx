"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * FEUILLE MODALE — panneau qui monte du bas, pour le mobile.
 *
 * La barre de filtres desktop (huit sélecteurs qui passent à la ligne) était
 * simplement compressée sur mobile : deux rangées de menus étroits occupant
 * un tiers de l'écran avant le premier exercice. Sur un téléphone, filtrer est
 * une action ponctuelle — elle mérite un panneau qu'on ouvre, qu'on règle et
 * qu'on referme, pas un bandeau permanent.
 *
 * Volontairement minimal : pas de gestion de glisser-déposer, pas de points
 * d'ancrage intermédiaires. Un fond assombri, un panneau, une fermeture par
 * Échap ou par clic à côté — ce que fait un dialogue, avec la géométrie du
 * pouce.
 */
export function Sheet({
  open,
  onClose,
  title,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  // Échap ferme, et le corps ne défile plus derrière : sans cela, faire
  // défiler la feuille entraînait la liste au-dessous.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end lg:hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/45"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "tween", duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            className="surface-float relative flex max-h-[85vh] flex-col rounded-t-[1.25rem] rounded-b-none border-b-0"
          >
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-hairline/[0.07] px-4 py-3">
              <h2 className="t-title">{title}</h2>
              <Button variant="ghost" size="icon" aria-label="Fermer" onClick={onClose}>
                <X size={18} />
              </Button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>

            {footer && (
              <div className="shrink-0 border-t border-hairline/[0.07] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">{footer}</div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
