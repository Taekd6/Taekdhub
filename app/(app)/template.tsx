/**
 * TRANSITION ENTRE LES PAGES (mission 24) — Next remonte ce gabarit à chaque
 * navigation : la nouvelle page entre en fondu, en montant légèrement et en
 * se défloutant (`.page-in`, app/globals.css). Coupé sous reduced-motion.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
