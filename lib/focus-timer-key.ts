/**
 * Clé sessionStorage du chrono Focus — extraite de focus-view.tsx (qui la
 * réexporte pour ne rien changer aux imports existants) dans son propre
 * module minimal : importer ce SEUL préfixe depuis focus-view.tsx entraînait
 * son bundle complet (rendu LaTeX, framer-motion…) dans tout composant qui
 * n'a par ailleurs aucun besoin de <FocusView> lui-même — précisément le cas
 * de hooks/use-resumable-focus.ts, consommé par le Dashboard.
 */
export const FOCUS_TIMER_PREFIX = "prepahub:timer:focus:";
