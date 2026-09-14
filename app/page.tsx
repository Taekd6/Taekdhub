import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/app-nav";

/**
 * PAGE D'ACCUEIL PUBLIQUE.
 *
 * Une page de titre, pas une page d'atterrissage marketing : un énoncé, une
 * action, puis quatre principes séparés par des filets. Aucune carte, aucun
 * dégradé, aucune capture d'écran — c'est un outil de travail, il se présente
 * comme tel.
 *
 * Chaque principe dit une chose que le produit fait RÉELLEMENT, vérifiable en
 * ouvrant l'application. Aucun chiffre écrit en dur : la version précédente
 * annonçait « 402 exercices » et la première phrase lue par l'élève est
 * devenue fausse dès la correction suivante.
 */
const PRINCIPES = [
  {
    titre: "Il sait ce que tu dois faire maintenant",
    texte:
      "Échéances, retard, charge restante et temps réellement disponible : une seule tâche remonte, et elle dit pourquoi elle remonte.",
  },
  {
    titre: "Il sait quand ton planning ne tient pas",
    texte:
      "Six heures de travail dans une soirée de quatre, ça ne rentre pas. TaekdHub le dit avant le jeudi soir, pas après.",
  },
  {
    titre: "Il compare le prévu au réel",
    texte:
      "Ce que tu avais prévu et ce que tu as fait sont deux choses différentes. La semaine suivante est replanifiée à partir de la seconde.",
  },
  {
    titre: "Il n'héberge aucun cours",
    texte:
      "Tes TD, tes livres et tes annales restent où ils sont. Une tâche dit « exercices 12 à 18 du TD 4 » et, au mieux, y renvoie.",
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
            Qu&apos;est-ce que je fais maintenant&nbsp;?
          </h1>
          <p className="t-read mt-7 max-w-[48ch] text-muted">
            Tes tâches, tes échéances et le temps que tu as vraiment. TaekdHub en fait un plan de travail réaliste — et
            te dit franchement quand il ne l&apos;est plus.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/today">
              <Button size="lg">
                Ouvrir TaekdHub <ArrowRight size={17} />
              </Button>
            </Link>
          </div>
        </section>

        <section className="border-t border-line pb-24">
          <dl className="divide-y divide-line">
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
