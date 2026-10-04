import { AlertTriangle, ArrowRight, Shuffle, Target, Timer } from "lucide-react";

/**
 * L'IPHONE DE LA VITRINE — l'écran d'accueil de TaekdHub, dessiné en HTML
 * et CSS avec les vraies classes de l'application (verre, dégradés,
 * chiffres) : pas une capture d'écran qui vieillirait au premier changement
 * de design. L'alerte descend du haut comme dans l'app (`.alert-in`), puis
 * le téléphone flotte doucement (`.floaty`).
 *
 * Purement décoratif : lu par les lecteurs d'écran comme une seule image.
 */
export function PhoneMockup() {
  return (
    <div role="img" aria-label="TaekdHub sur iPhone : l'accueil, avec une alerte « DM 5 à rendre demain » et la recommandation du moment." className="floaty mx-auto w-[18.5rem] sm:w-[20rem]">
      <div className="rounded-[3.25rem] bg-[#1d1d1f] p-[0.6rem] [box-shadow:0_40px_80px_-30px_rgb(30_30_60/0.55),inset_0_0_0_1.5px_rgb(255_255_255/0.14)]">
        <div className="relative overflow-hidden rounded-[2.7rem] bg-[#f5f5f7] px-4 pb-6 pt-3">
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="halo halo-a" />
            <div className="halo halo-b" />
          </div>
          {/* Barre d'état et île dynamique. */}
          <div className="relative flex items-center justify-between px-3 pt-1 text-[0.6875rem] font-semibold text-ink">
            <span>9:41</span>
            <span className="h-[1.6rem] w-[5.5rem] rounded-full bg-[#1d1d1f]" />
            <span>100 %</span>
          </div>

          {/* L'alerte qui descend. */}
          <div className="glass-thick alert-in relative mt-3 rounded-[1.25rem] p-3" style={{ "--i": 3 } as React.CSSProperties}>
            <p className="flex items-center gap-1 text-[0.625rem] font-semibold text-muted">
              <span className="h-2 w-2 rounded-full bg-rose-400" /> <AlertTriangle size={9} /> Urgent
            </p>
            <p className="mt-0.5 text-[0.75rem] font-semibold leading-tight text-ink">DM 5 — Séries entières, à rendre demain</p>
            <p className="text-[0.6875rem] leading-snug text-muted">Il reste environ 3 h de travail.</p>
          </div>

          <p className="relative mt-4 text-center text-[0.6875rem] font-semibold text-muted">Aujourd&apos;hui</p>
          <p className="t-figure-md relative text-center text-ink">
            2<span className="t-figure-sm text-subtle">h</span>07
          </p>

          <div className="grad-card relative mt-4 p-4 tone-brand">
            <p className="flex items-center gap-1 text-[0.625rem] font-semibold opacity-90">
              <Target size={10} /> Ton prochain mouvement
            </p>
            <p className="mt-2 text-[0.6875rem] font-semibold opacity-90">Mathématiques</p>
            <p className="text-[0.9375rem] font-bold leading-tight">Cours d&apos;abord : Réduction</p>
            <p className="t-figure-sm mt-2">
              15 min <span className="text-[0.6875rem] font-semibold opacity-90">· retrouver les fiches</span>
            </p>
            <div className="mt-3 flex gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[0.6875rem] font-semibold text-ink">
                Commencer <ArrowRight size={10} />
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1.5 text-[0.6875rem] font-semibold">
                <Shuffle size={10} /> Autre idée
              </span>
            </div>
          </div>

          <div className="surface relative mt-3 flex items-center gap-3 p-3">
            <span className="score-badge score-lo h-9 w-9 text-[0.8125rem]">3</span>
            <div className="min-w-0">
              <p className="text-[0.75rem] font-semibold text-ink">Révisions du jour</p>
              <p className="text-[0.625rem] text-muted">≈ 6 min</p>
            </div>
          </div>

          {/* La barre d'onglets flottante. */}
          <div className="glass relative mx-1 mt-4 flex items-center justify-around rounded-full py-2">
            <span className="h-1.5 w-6 rounded-full bg-accent/30" />
            <span className="h-1.5 w-6 rounded-full bg-hairline/15" />
            <span className="grad-brand -my-3 grid h-9 w-9 place-items-center rounded-full">
              <Timer size={14} />
            </span>
            <span className="h-1.5 w-6 rounded-full bg-hairline/15" />
            <span className="h-1.5 w-6 rounded-full bg-hairline/15" />
          </div>
        </div>
      </div>
    </div>
  );
}
