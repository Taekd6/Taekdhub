import Link from "next/link";
import { ArrowRight, CalendarClock, ListChecks, Sparkles, Target } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Ce que le produit fait RÉELLEMENT aujourd'hui.
 *
 * Plus AUCUN décompte d'exercices en dur ici. Cette page annonçait « 402
 * exercices » à deux endroits alors que l'amorçage réel (lib/seed.ts, trois
 * jeux de données fusionnés puis dédoublonnés) en produisait un tout autre
 * nombre — vérifié en lançant l'app. Un chiffre écrit à la main dans une page
 * d'accueil se désynchronise dès la première correction de la banque, et la
 * toute première phrase que lit l'élève devient fausse. La banque est donc
 * décrite, jamais comptée : c'est la seule formulation qui reste vraie quels
 * que soient les exercices ajoutés ou retirés ensuite.
 *
 * L'ancienne liste décrivait des mécaniques ("heatmap, streak, XP") plutôt que
 * des bénéfices, et l'une d'elles était devenue fausse : « Gagne de l'XP à
 * chaque séance et exercice terminé » promettait exactement l'automatisme qui
 * a été supprimé — l'XP exige désormais une réussite prouvée. Une page
 * d'accueil qui promet ce que le produit ne fait plus est le plus court chemin
 * vers la déception au premier usage.
 */
const features = [
  {
    icon: Target,
    title: "Il sait quoi te faire travailler",
    desc: "Toute ta banque d'exercices classée en continu selon tes résultats réels — et chaque recommandation dit pourquoi elle est là.",
  },
  {
    icon: CalendarClock,
    title: "Un plan adapté au temps que tu as",
    desc: "20 minutes ou 90 : la séance ne fait pas que s'allonger, sa structure change. Réparer d'abord, entretenir ensuite.",
  },
  {
    icon: ListChecks,
    title: "Réussir seul ≠ réussir aidé",
    desc: "Les indices que tu révèles sont comptés. Un exercice arraché aux indices revient ; une réussite autonome, non.",
  },
  {
    icon: Sparkles,
    title: "Tes points faibles, avec les preuves",
    desc: "Trois chapitres prioritaires, chacun justifié par tes tentatives datées. Rien d'inventé, rien de décoratif.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-canvas px-6 text-ink">
      <div className="mx-auto max-w-5xl">
        <header className="flex min-h-[85vh] flex-col justify-center">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent-brand text-black shadow-glow">
              <Sparkles size={16} />
            </span>
            <p className="eyebrow text-accent">TaekdHub</p>
          </div>
          <h1 className="mt-6 max-w-3xl text-5xl font-semibold tracking-tight md:text-7xl">
            Chaque heure <span className="text-gradient">compte.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-muted">
            TaekdHub regarde ce que tu réussis, ce que tu rates et ce que tu n&apos;obtiens qu&apos;avec des indices, puis te dit quoi
            travailler maintenant — et pourquoi. Pour la prépa scientifique.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/dashboard">
              <Button size="lg">
                Ouvrir le tableau de bord <ArrowRight size={18} />
              </Button>
            </Link>
            <Link href="/exercises">
              <Button size="lg" variant="secondary">
                Parcourir la banque d&apos;exercices
              </Button>
            </Link>
          </div>
        </header>

        <section className="grid gap-4 pb-20 sm:grid-cols-2">
          {features.map(({ icon: Icon, title, desc }) => (
            <article key={title} className="surface surface-hover rounded-2xl p-6">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10">
                <Icon size={18} className="text-accent" />
              </div>
              <h2 className="mt-4 font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{desc}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
