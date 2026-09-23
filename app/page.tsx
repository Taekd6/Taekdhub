import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/app-nav";

/**
 * PAGE D'ACCUEIL PUBLIQUE.
 *
 * Ce que le produit fait RÉELLEMENT : suivre le travail que l'élève fait sur
 * ses propres feuilles. La page vantait autrefois une banque d'exercices et
 * ses recommandations ; la banque a été retirée, la page ne promet plus que
 * ce qui existe.
 *
 * Composition : une page de titre, pas une page d'atterrissage marketing.
 * Un énoncé au centre gauche, deux actions, puis quatre principes séparés par
 * des filets. Aucune carte, aucun dégradé, aucune capture d'écran — c'est un
 * outil de travail, il se présente comme tel.
 */
const PRINCIPES = [
  {
    titre: "Ton temps, mesuré honnêtement",
    texte:
      "Un chrono quand tu te mets au travail, une saisie en dix secondes pour ce qu'il n'a pas vu. Par matière, jour après jour, face à tes objectifs.",
  },
  {
    titre: "Tes échéances, casées dans tes journées",
    texte:
      "DM, DS, colles : TaekdHub répartit le temps qu'ils demandent selon ce que chaque jour peut absorber, et dit ce qui ne tient plus.",
  },
  {
    titre: "Ce qu'il faut revoir, au bon moment",
    texte:
      "Le carnet « À revoir » et tes cartouches de méthode reviennent en révision espacée ; le carnet d'erreurs montre ce qui revient.",
  },
  {
    titre: "Tes données restent chez toi",
    texte:
      "Pas de compte, pas de serveur : tout vit dans ton navigateur, et une sauvegarde en un clic te suit d'un appareil à l'autre.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-canvas px-6 text-ink">
      <div className="mx-auto max-w-[62rem]">
        <header className="flex items-center py-6">
          <Wordmark />
        </header>

        <section className="flex min-h-[calc(100vh-14rem)] flex-col justify-center py-16">
          <p className="t-label">Prépa scientifique</p>
          <h1 className="mt-5 max-w-[16ch] font-serif text-[clamp(2.75rem,1.8rem+4.2vw,5rem)] font-normal leading-[1.02] tracking-[-0.03em]">
            Chaque heure compte.
          </h1>
          <p className="t-read mt-7 max-w-[48ch] text-muted">
            Tu travailles sur tes feuilles ; TaekdHub garde la trace de ton temps, de tes échéances, de tes notes et de
            ce qu&apos;il te reste à revoir.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/dashboard">
              <Button size="lg">
                Ouvrir TaekdHub <ArrowRight size={17} />
              </Button>
            </Link>
            <Link href="/timer">
              <Button size="lg" variant="secondary">
                Lancer le chrono
              </Button>
            </Link>
          </div>
        </section>

        <section className="border-t border-line pb-24">
          <dl className="divide-y divide-line">
            {/* Deux colonnes en flex plutôt qu'une grille de gabarit : les
                gabarits de page appartiennent au système de composition
                (components/ui/layout.tsx), pas aux écrans. Ici il ne s'agit
                que d'un terme et de sa définition côte à côte. */}
            {PRINCIPES.map(({ titre, texte }) => (
              <div key={titre} className="flex flex-col gap-2 py-7 sm:flex-row sm:gap-10">
                <dt className="t-heading sm:w-72 sm:shrink-0">{titre}</dt>
                <dd className="t-body min-w-0 max-w-[58ch] text-muted">{texte}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </main>
  );
}
