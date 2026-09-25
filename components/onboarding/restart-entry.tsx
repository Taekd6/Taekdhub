import Link from "next/link";
import { Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Group, Row } from "@/components/ui/grouped";

/**
 * « REFAIRE LA CONFIGURATION » — l'entrée de Réglages qui rouvre l'accueil
 * guidé (/bienvenue). Chaque écran s'y ouvre sur les valeurs en vigueur :
 * c'est une façon de tout revoir d'un coup, pas une remise à zéro.
 */
export function OnboardingRestartEntry() {
  return (
    <Group title="Premiers pas" footer="Reprend tes objectifs, tes heures par matière, ton temps libre et la date des concours, un écran à la fois.">
      <Row
        label="Refaire la configuration"
        hint="L'accueil guidé du premier lancement"
        icon={
          <span className="grid h-8 w-8 place-items-center rounded-full bg-accent/15 text-accent" aria-hidden>
            <Sparkles size={16} strokeWidth={2.4} />
          </span>
        }
      >
        <Link href="/bienvenue" className={buttonVariants({ variant: "secondary", size: "sm" })}>
          Ouvrir
        </Link>
      </Row>
    </Group>
  );
}
