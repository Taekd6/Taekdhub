"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";

/**
 * Changer d'écran (Dashboard → Exercices, etc.) était une coupure sèche —
 * zéro transition, le nouveau contenu remplaçait l'ancien d'un coup. Un
 * fondu très court (120 ms) suffit à dire « on a changé d'endroit » sans
 * ralentir la navigation : uniquement `opacity`, jamais de `transform` —
 * un ancêtre transformé casserait le `position: fixed` de FocusView, monté
 * plus bas dans certaines pages (Exercices, Séance).
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.12, ease: "easeInOut" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
