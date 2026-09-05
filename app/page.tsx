import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/app-nav";

/**
 * PAGE D'ACCUEIL PUBLIQUE.
 *
 * Ce que le produit fait RÉELLEMENT, sans un seul chiffre écrit à la main :
 * la page annonçait autrefois « 402 exercices » alors que l'amorçage réel en
 * produisait un tout autre nombre. Un décompte codé en dur se désynchronise
 * dès la première correction de la banque, et la première phrase que lit
 * l'élève devient fausse. La banque est donc DÉCRITE, jamais comptée.
 *
 * Composition : une page de titre, pas une page d'atterrissage marketing.
 * Un énoncé au centre gauche, deux actions, puis quatre principes séparés par
 * des filets. Aucune carte, aucun dégradé, aucune capture d'écran — c'est un
 * outil de travail, il se présente comme tel.
 */
const PRINCIPES = [
  {
    titre: "Il sait quoi te faire travailler",
    texte:
      "Toute ta banque classée en continu selon tes résultats réels — et chaque recommandation dit pourquoi elle est là.",
  },
  {
    titre: "Un plan adapté au temps que tu as",
    texte:
      "20 minutes ou 90 : la séance ne fait pas que s'allonger, sa structure change. Réparer d'abord, entretenir ensuite.",
  },
  {
    titre: "Réussir seul n'est pas réussir aidé",
    texte:
      "Les indices que tu révèles sont comptés. Un exercice arraché aux indices revient ; une réussite autonome, non.",
  },
  {
    titre: "Des annales, pas des imitations",
    texte:
      "Un exercice n'est présenté comme sujet de concours que si sa source établit le concours, l'année, l'épreuve et le numéro.",
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
            TaekdHub regarde ce que tu réussis, ce que tu rates et ce que tu n&apos;obtiens qu&apos;avec des indices,
            puis te dit quoi travailler maintenant — et pourquoi.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/dashboard">
              <Button size="lg">
                Ouvrir TaekdHub <ArrowRight size={17} />
              </Button>
            </Link>
            <Link href="/exercises">
              <Button size="lg" variant="secondary">
                Parcourir la bibliothèque
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
