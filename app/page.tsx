import Link from "next/link";
import { ArrowRight, Bell, BookOpenCheck, Brain, ChevronRight, Cloud, Layers, Lock, PlusSquare, Share, Smartphone, Sparkles, Timer } from "lucide-react";
import { Wordmark } from "@/components/app-nav";
import { PhoneMockup } from "@/components/landing/phone-mockup";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * LA VITRINE — la page d'une app d'Apple, pour TaekdHub.
 *
 * Composition d'apple.com : une barre de verre qui flotte, un grand titre
 * centré et un appareil, puis des TUILES de tailles inégales (la grille
 * « bento » des pages produit), une phrase qui tient toute la largeur, le
 * parcours en trois temps, et comment installer l'app sur l'iPhone.
 *
 * Ce que la page promet existe : chaque tuile décrit une fonction réelle
 * (README). Aucune capture d'écran : l'iPhone est dessiné avec les classes
 * de l'application (components/landing/phone-mockup.tsx).
 *
 * Les blocs entrent au défilement (`.reveal`, components/ui/reveal.tsx) ;
 * sans JavaScript ou avec « réduire les animations », tout est simplement là.
 */

const TILES = [
  {
    span: "md:col-span-4",
    tone: "grad-card tone-brand",
    icon: Sparkles,
    eyebrow: "Next Move",
    title: "Une décision, pas une liste.",
    text: "La matière, la durée, et pourquoi. « J'ai 30 min » compose une courte séance. Le calcul est affiché point par point : rien de magique, tout se vérifie.",
  },
  {
    span: "md:col-span-2",
    tone: "surface",
    icon: Bell,
    eyebrow: "Alertes",
    title: "Ce qui presse vient à toi.",
    text: "Échéance demain, minimum du soir pas fait : une alerte descend dans l'app, et une notification arrive sur l'iPhone. Jamais la nuit.",
  },
  {
    span: "md:col-span-2",
    tone: "surface",
    icon: Brain,
    eyebrow: "Mémoire",
    title: "Ton cours ne s'efface plus en silence.",
    text: "FSRS calcule, chapitre par chapitre, ta chance de t'en souvenir. Le rappel arrive avant l'oubli.",
  },
  {
    span: "md:col-span-4",
    tone: "landing-dark",
    icon: Lock,
    eyebrow: "Verrou de cours, avec Claude",
    title: "Le cours d'abord. L'exercice ensuite.",
    text: "Un exercice raté parce que le théorème n'était pas su ? Claude écrit les fiches de ce qui a manqué, et le chapitre se verrouille jusqu'à ce que tu les retrouves de tête, le lendemain.",
  },
  {
    span: "md:col-span-3",
    tone: "surface",
    icon: Layers,
    eyebrow: "Anki",
    title: "Anki, sans double saisie.",
    text: "Tes paquets sont lus, rattachés à leurs chapitres, et les fiches nées dans TaekdHub y partent d'un clic.",
  },
  {
    span: "md:col-span-3",
    tone: "surface",
    icon: Cloud,
    eyebrow: "Tes données",
    title: "Les tiennes, sur tous tes appareils.",
    text: "Sans compte, tout reste dans ton navigateur. Avec un compte, tout se synchronise, et toi seul peux le lire.",
  },
];

const STEPS = [
  { icon: Timer, title: "Travaille", text: "Lance le chrono sur tes feuilles, ou note en dix secondes ce qui est déjà fait." },
  { icon: BookOpenCheck, title: "Corrige avec Claude", text: "Les annales corrigées remontent toutes seules : réussites, échecs, ce qui bloque." },
  { icon: Sparkles, title: "Laisse décider la suite", text: "Next Move choisit l'action qui compte le plus maintenant, et te dit pourquoi." },
];

export default function Home() {
  return (
    <main className="relative min-h-dvh overflow-x-clip text-ink">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="halo halo-a" />
        <div className="halo halo-b" />
        <div className="halo halo-c" />
      </div>

      {/* ── Barre de verre flottante ── */}
      <header className="sticky top-0 z-40 px-3 pt-3">
        <nav aria-label="Vitrine" className="glass mx-auto flex h-14 max-w-[72rem] items-center gap-2 rounded-full pl-4 pr-2">
          <Wordmark />
          <div className="ml-auto hidden items-center gap-1 sm:flex">
            {[
              ["#fonctions", "Fonctions"],
              ["#methode", "Méthode"],
              ["#iphone", "iPhone"],
            ].map(([href, label]) => (
              <a key={href} href={href} className="press rounded-full px-3 py-1.5 text-sm font-semibold text-muted hover:text-ink">
                {label}
              </a>
            ))}
          </div>
          <Link href="/dashboard" className={cn(buttonVariants({ size: "sm" }), "ml-auto sm:ml-2")}>
            Ouvrir
          </Link>
        </nav>
      </header>

      {/* ── Héros ── */}
      <section className="mx-auto max-w-[72rem] px-6 pb-20 pt-16 text-center sm:pt-24">
        <p className="reveal t-label" style={{ "--i": 0 } as React.CSSProperties}>
          Pour la prépa scientifique
        </p>
        <h1 className="reveal mx-auto mt-4 max-w-[14ch] lg:max-w-[20ch] text-[clamp(2.75rem,1.4rem+6vw,5.75rem)] font-bold leading-[1.02] tracking-[-0.035em] [text-wrap:balance]" style={{ "--i": 1 } as React.CSSProperties}>
          Chaque heure compte. <span className="text-grad">Maintenant, elle se voit.</span>
        </h1>
        <p className="reveal t-lede mx-auto mt-6 max-w-[40ch]" style={{ "--i": 2 } as React.CSSProperties}>
          Ton temps, tes échéances, ton cours et tes exercices au même endroit, et une seule question à la fois : qu&apos;est-ce que je fais maintenant ?
        </p>
        <div className="reveal mt-9 flex flex-wrap items-center justify-center gap-x-6 gap-y-3" style={{ "--i": 3 } as React.CSSProperties}>
          <Link href="/dashboard" className={buttonVariants({ size: "lg" })}>
            Ouvrir TaekdHub <ArrowRight size={18} aria-hidden />
          </Link>
          <a href="#iphone" className="press inline-flex items-center gap-0.5 t-body font-semibold text-accent hover:underline">
            Installer sur iPhone <ChevronRight size={18} aria-hidden />
          </a>
        </div>
        <div className="reveal mt-16" style={{ "--i": 4 } as React.CSSProperties}>
          <PhoneMockup />
        </div>
      </section>

      {/* ── Les fonctions, en tuiles ── */}
      <section id="fonctions" className="mx-auto max-w-[72rem] scroll-mt-24 px-4 py-20 sm:px-6">
        <h2 className="reveal t-display mx-auto max-w-[18ch] text-center">Tout ce qui fait avancer. Rien de plus.</h2>
        <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-6">
          {TILES.map((tile, index) => (
            <article
              key={tile.title}
              className={cn("reveal lift flex min-h-[17rem] flex-col justify-between overflow-hidden rounded-[var(--radius-tile)] p-7 sm:p-9", tile.span, tile.tone)}
              style={{ "--i": index % 3 } as React.CSSProperties}
            >
              <tile.icon size={28} aria-hidden className={tile.tone === "surface" ? "text-accent" : "opacity-90"} />
              <div className="mt-10">
                <p className={cn("text-[0.875rem] font-semibold", tile.tone === "surface" ? "text-muted" : "opacity-80")}>{tile.eyebrow}</p>
                <h3 className="mt-1 text-[clamp(1.5rem,1.2rem+1vw,2rem)] font-bold leading-[1.1] tracking-[-0.025em] [text-wrap:balance]">{tile.title}</h3>
                <p className={cn("mt-3 max-w-[48ch] t-body", tile.tone === "surface" ? "text-muted" : "opacity-85")}>{tile.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ── La phrase ── */}
      <section className="mx-auto max-w-[60rem] px-6 py-24 text-center">
        <p className="reveal text-[clamp(1.75rem,1.1rem+3vw,3.5rem)] font-bold leading-[1.1] tracking-[-0.03em] [text-wrap:balance]">
          Pas une banque d&apos;exercices. <span className="text-muted">Le carnet de bord de ton travail, qui sait quoi faire ensuite.</span>
        </p>
      </section>

      {/* ── La méthode ── */}
      <section id="methode" className="mx-auto max-w-[72rem] scroll-mt-24 px-4 py-20 sm:px-6">
        <h2 className="reveal t-display text-center">Trois gestes par jour.</h2>
        <ol className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="reveal surface p-8" style={{ "--i": index } as React.CSSProperties}>
              <span className="grad-brand grid h-12 w-12 place-items-center rounded-2xl">
                <step.icon size={22} aria-hidden />
              </span>
              <p className="mt-6 text-[0.875rem] font-semibold text-muted">Étape {index + 1}</p>
              <h3 className="t-heading mt-1">{step.title}</h3>
              <p className="mt-2 t-body text-muted">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Sur l'iPhone ── */}
      <section id="iphone" className="mx-auto max-w-[72rem] scroll-mt-24 px-4 py-20 sm:px-6">
        <div className="reveal landing-dark overflow-hidden rounded-[2.5rem] px-7 py-14 text-center sm:px-14 sm:py-20">
          <Smartphone size={36} aria-hidden className="mx-auto opacity-90" />
          <h2 className="mt-5 text-[clamp(2rem,1.3rem+3vw,3.5rem)] font-bold leading-[1.05] tracking-[-0.03em]">Une vraie app sur ton iPhone.</h2>
          <p className="mx-auto mt-4 max-w-[44ch] t-body opacity-80">Plein écran, hors ligne, avec ses notifications. Sans App Store : trente secondes dans Safari.</p>
          <ol className="mx-auto mt-12 grid max-w-[52rem] grid-cols-1 gap-3 text-left sm:grid-cols-3">
            {[
              { icon: Share, text: "Dans Safari, touche Partager." },
              { icon: PlusSquare, text: "Choisis « Sur l'écran d'accueil »." },
              { icon: Bell, text: "Ouvre TaekdHub, puis Réglages → Notifications → Activer." },
            ].map((step, index) => (
              <li key={step.text} className="flex items-start gap-3 rounded-[1.25rem] bg-white/[0.08] p-5 [box-shadow:inset_0_1px_0_rgb(255_255_255/0.12)]">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/15 text-[0.9375rem] font-bold">{index + 1}</span>
                <p className="text-[0.9375rem] font-semibold leading-snug">
                  <step.icon size={15} aria-hidden className="mb-1 opacity-80" />
                  {step.text}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Dernier appel ── */}
      <section className="mx-auto max-w-[72rem] px-6 pb-24 pt-8 text-center">
        <h2 className="reveal t-display">Ta prochaine heure commence ici.</h2>
        <div className="reveal mt-8" style={{ "--i": 1 } as React.CSSProperties}>
          <Link href="/dashboard" className={buttonVariants({ size: "lg" })}>
            Ouvrir TaekdHub <ArrowRight size={18} aria-hidden />
          </Link>
        </div>
      </section>

      <footer className="mx-auto flex max-w-[72rem] flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-8 text-[0.8125rem] text-muted">
        <Wordmark />
        <p>Sans compte, tes données restent dans ton navigateur. Avec un compte, toi seul peux les lire.</p>
      </footer>
    </main>
  );
}
