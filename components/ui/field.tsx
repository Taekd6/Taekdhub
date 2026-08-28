import { cn } from "@/lib/cn";

/**
 * Étiquette + contrôle empilés — la forme lisible d'un champ de formulaire.
 * `<label>` englobant plutôt que `htmlFor`/`id` : l'association reste
 * automatique quel que soit le contrôle à l'intérieur (input, select,
 * composant maison comme ChapterPicker), sans avoir à inventer un id
 * unique par champ. Une étiquette visible, jamais un simple `placeholder`
 * : un placeholder disparaît dès la saisie commencée, et ne remplace pas
 * un label pour un lecteur d'écran.
 */
export function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="eyebrow">{label}</span>
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}
