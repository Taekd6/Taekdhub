import Link from "next/link";
import { ArrowRight, BookOpenCheck, Clock3, Sparkles, Target, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  { icon: Clock3, title: "Focus timer", desc: "Séances de travail mesurées et enregistrées automatiquement." },
  { icon: BookOpenCheck, title: "Banque d'exercices", desc: "Organise, filtre et résous tes exercices avec indices progressifs." },
  { icon: Target, title: "Progression", desc: "Heatmap, streak, XP et statistiques par matière." },
  { icon: Zap, title: "Gamification", desc: "Gagne de l'XP à chaque séance et exercice terminé." },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-canvas px-6 text-ink">
      <div className="mx-auto max-w-5xl">
        <header className="flex min-h-[85vh] flex-col justify-center">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-black shadow-glow">
              <Sparkles size={16} />
            </span>
            <p className="eyebrow text-accent">Prepahub</p>
          </div>
          <h1 className="mt-6 max-w-3xl text-5xl font-semibold tracking-tight md:text-7xl">
            Chaque heure <span className="text-gradient">compte.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-muted">
            Un espace calme pour piloter ton travail, consolider tes acquis et avancer avec précision en prépa scientifique.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/dashboard">
              <Button size="lg">
                Ouvrir le tableau de bord <ArrowRight size={18} />
              </Button>
            </Link>
            <Link href="/exercises">
              <Button size="lg" variant="secondary">
                Voir les exercices
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
