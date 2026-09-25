"use client";

import Link from "next/link";
import { ChevronDown, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { PageHero } from "@/components/ui/page-hero";
import { Illustration } from "@/components/ui/illustrations";
import { Meter } from "@/components/ui/progress";
import { CountUp } from "@/components/ui/count-up";
import { GradientCard } from "@/components/ui/gradient-card";
import { Section } from "@/components/ui/section";
import { EmptyState, Skeleton } from "@/components/ui/state";
import { SubjectAvatar } from "@/components/subject-avatar";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { cn } from "@/lib/cn";
import { REVIEW_KIND_META } from "@/lib/review-items";
import {
  dueReviewItems,
  effectiveSchedule,
  formatDueDay,
  formatInterval,
  nextReviewDay,
  previewRatings,
  rateReviewItem,
  REVIEW_RATING_META,
  REVIEW_RATINGS,
  type ReviewRating,
} from "@/lib/spaced-repetition";
import type { ReviewItem } from "@/lib/storage";
import { subjects } from "@/lib/study";
import type { Subject } from "@/lib/supabase/types";

/**
 * LA SÉANCE DE RÉVISION — une carte à la fois, de tête d'abord.
 *
 * Trois temps : l'ACCUEIL (combien, pourquoi, « Commencer »), les CARTES,
 * le BILAN. Le déroulé d'une carte est celui que la recherche sur l'effet de
 * test justifie (voir lib/spaced-repetition.ts) :
 *
 *   1. la question seule — et une consigne explicite : essayer de répondre
 *      AVANT de retourner. Retourner tout de suite, c'est relire, et relire
 *      est précisément ce qui marche le moins ;
 *   2. « Afficher la réponse » (Espace) ;
 *   3. l'élève se note lui-même, de 1 à 4. Chaque bouton annonce ce qu'il
 *      fera (« demain », « 7 j ») : une note dont on ne voit pas l'effet se
 *      choisit au hasard.
 *
 * Une entrée SANS verso (« Revoir l'IPP ») n'a rien à retourner : on demande
 * « Tu t'en souviens ? » et les quatre notes sont proposées tout de suite.
 *
 * La file est FIGÉE au démarrage (liste d'identifiants) : noter une carte la
 * sort des « dues », et recalculer la file à chaque note ferait sauter
 * l'index. Chaque note est enregistrée immédiatement — une séance
 * interrompue (fermeture d'onglet, téléphone qui sonne) ne perd rien, et la
 * reprendre ne remontre que ce qui n'a pas été noté.
 *
 * Seul appelant de `usePrepahubData()` de l'écran ; tout le reste reçoit les
 * données en props.
 */

type Phase = "start" | "run" | "end";

/** La pilule colorée de chaque note — voir `.rate-*` (app/globals.css). */
const RATE_CLASS: Record<ReviewRating, string> = {
  again: "rate-again",
  hard: "rate-hard",
  good: "rate-good",
  easy: "rate-easy",
};

interface RatedEntry {
  id: string;
  rating: ReviewRating;
  /** L'entrée AVANT la note — de quoi annuler la dernière sans rien recalculer. */
  before: ReviewItem;
}

export function ReviewSession() {
  const { reviewItems, saveReviewItems, ready } = usePrepahubData();
  const [subject, setSubject] = useState<Subject | null>(null);
  const [phase, setPhase] = useState<Phase>("start");
  const [queue, setQueue] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [rated, setRated] = useState<RatedEntry[]>([]);
  const cardHeading = useRef<HTMLHeadingElement>(null);

  // `?subject=` — venir du hub d'une matière. Lu au montage, comme /revoir.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("subject");
    if (wanted && (subjects as string[]).includes(wanted)) setSubject(wanted as Subject);
  }, []);

  const due = useMemo(() => dueReviewItems(reviewItems, new Date(), subject), [reviewItems, subject]);
  const byId = useMemo(() => new Map(reviewItems.map((item) => [item.id, item])), [reviewItems]);
  const current = phase === "run" ? byId.get(queue[index]) : undefined;
  const hasAnswer = Boolean(current?.answer);
  const canRate = Boolean(current) && (revealed || !hasAnswer);

  // Une entrée supprimée ou cochée ailleurs (autre onglet) pendant la séance
  // est simplement sautée.
  useEffect(() => {
    if (phase !== "run") return;
    if (index >= queue.length) setPhase("end");
    else if (!current || current.doneAt !== null) setIndex((value) => value + 1);
  }, [phase, index, queue.length, current]);

  // Le focus suit la carte : un bouton de note resté focalisé recevrait
  // l'Espace suivant, et un lecteur d'écran doit entendre la nouvelle question.
  useEffect(() => {
    if (phase === "run") cardHeading.current?.focus({ preventScroll: true });
  }, [phase, index]);

  function start() {
    setQueue(due.map((item) => item.id));
    setIndex(0);
    setRevealed(false);
    setRated([]);
    setPhase("run");
  }

  const rate = useCallback(
    (rating: ReviewRating) => {
      if (!current || !canRate) return;
      saveReviewItems(rateReviewItem(reviewItems, current.id, rating));
      setRated((entries) => [...entries, { id: current.id, rating, before: current }]);
      setRevealed(false);
      setIndex((value) => value + 1);
    },
    [current, canRate, reviewItems, saveReviewItems]
  );

  function undo() {
    const last = rated[rated.length - 1];
    if (!last) return;
    saveReviewItems(reviewItems.map((item) => (item.id === last.id ? last.before : item)));
    setRated((entries) => entries.slice(0, -1));
    const position = queue.indexOf(last.id);
    setIndex(position === -1 ? Math.max(0, index - 1) : position);
    setRevealed(Boolean(last.before.answer));
    setPhase("run");
  }

  // Clavier : Espace (ou Entrée) retourne la carte, 1 à 4 notent. Ignoré
  // dans un champ de saisie et avec un modificateur — Ctrl+1 change d'onglet.
  useEffect(() => {
    if (phase !== "run") return;
    function onKey(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      if ((event.key === " " || event.key === "Enter") && hasAnswer && !revealed) {
        event.preventDefault();
        setRevealed(true);
        return;
      }
      const rating = REVIEW_RATINGS.find((value) => REVIEW_RATING_META[value].key === event.key);
      if (rating && canRate) {
        event.preventDefault();
        rate(rating);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, hasAnswer, revealed, canRate, rate]);

  if (!ready) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (phase === "run" && current) {
    const preview = previewRatings(current);
    const done = Math.min(index, queue.length);
    return (
      <div className="space-y-5">
        {/* LA BARRE DE PROGRESSION en dégradé, le compte à droite, la sortie
            en pastille ronde. */}
        <div className="flex items-center gap-3">
          <Meter value={(done / queue.length) * 100} className="h-2.5 flex-1" />
          <span className="tabular shrink-0 text-[0.8125rem] font-black text-ink" aria-label={`Carte ${done + 1} sur ${queue.length}`}>
            {done + 1} / {queue.length}
          </span>
          <button
            type="button"
            onClick={() => setPhase("end")}
            className="inline-flex min-h-8 shrink-0 items-center rounded-full bg-inset px-3 text-[0.8125rem] font-bold text-muted transition-colors hover:text-ink max-lg:min-h-11"
          >
            Terminer
          </button>
        </div>

        {/* LA CARTE — une grande tuile blanche qui flotte ; la question en
            900, la réponse sous un filet une fois retournée. La `key` rejoue
            l'entrée à chaque carte. */}
        <section key={current.id} className="surface tab-in-next min-h-[19rem] rounded-[2rem] p-6 sm:p-9">
          <div className="flex items-center gap-2.5">
            <SubjectAvatar subject={current.subject} size="md" />
            <span className="text-[0.8125rem] font-bold text-subtle">
              {current.subject} · {REVIEW_KIND_META[current.kind].label}
            </span>
          </div>
          <h2 ref={cardHeading} tabIndex={-1} className="t-title mt-5 break-words text-ink outline-none">
            {current.text}
          </h2>

          {hasAnswer ? (
            revealed ? (
              <div className="mt-6 border-t border-line pt-5">
                <p className="text-[0.8125rem] font-extrabold text-accent">Réponse</p>
                <p className="t-body mt-1.5 whitespace-pre-line break-words font-semibold text-ink">{current.answer}</p>
              </div>
            ) : (
              <div className="mt-7">
                <p className="text-[0.9375rem] font-semibold text-muted">Réponds de tête d&apos;abord, même à peu près.</p>
                <button
                  type="button"
                  className="grad-brand bounce-press mt-4 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full px-7 text-base font-extrabold [box-shadow:0_12px_26px_-10px_var(--g1)] sm:w-auto"
                  onClick={() => setRevealed(true)}
                >
                  Afficher la réponse
                  <kbd className="rounded-md border border-white/50 px-1.5 text-2xs font-bold opacity-80 max-lg:hidden">Espace</kbd>
                </button>
              </div>
            )
          ) : (
            <p className="mt-6 text-[0.9375rem] font-semibold text-muted">Redis-le de tête, puis note-toi honnêtement.</p>
          )}
        </section>

        {canRate && (
          <div>
            <p className="mb-2.5 text-[0.8125rem] font-semibold text-muted">
              {hasAnswer ? "Compare avec ce que tu avais en tête." : "Sois honnête : c'est ce qui règle la prochaine révision."}
            </p>
            {/* LES QUATRE NOTES en pilules colorées : on les touche sans les lire. */}
            <div role="group" aria-label="Ta note" className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {REVIEW_RATINGS.map((rating, position) => {
                const meta = REVIEW_RATING_META[rating];
                return (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => rate(rating)}
                    title={meta.hint}
                    className={cn(
                      "bounce-press pop flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-full px-3 py-2.5",
                      RATE_CLASS[rating]
                    )}
                    style={{ "--pop-delay": `${position * 60}ms` } as React.CSSProperties}
                  >
                    <span className="flex items-center gap-1.5 text-[0.9375rem] font-black">
                      <kbd className="tabular rounded-md border border-white/50 px-1 text-2xs font-bold opacity-80 max-lg:hidden">{meta.key}</kbd>
                      {meta.label}
                    </span>
                    <span className="tabular text-2xs font-bold opacity-85">{preview[rating] === 1 ? "demain" : formatInterval(preview[rating])}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="t-meta text-2xs max-lg:hidden">Espace : retourner · 1 à 4 : noter</p>
          {rated.length > 0 && (
            <Button variant="ghost" size="sm" onClick={undo}>
              <RotateCcw size={13} aria-hidden /> Annuler la dernière note
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (phase === "run") return <Skeleton className="h-64 w-full rounded-xl" />;

  if (phase === "end") {
    return <SessionEnd items={reviewItems} rated={rated} subject={subject} onUndo={undo} />;
  }

  return <SessionStart due={due} items={reviewItems} subject={subject} onClearSubject={() => setSubject(null)} onStart={start} />;
}

/* ── L'ACCUEIL ─────────────────────────────────────────────────────── */

function SessionStart({
  due,
  items,
  subject,
  onClearSubject,
  onStart,
}: {
  due: ReviewItem[];
  items: ReviewItem[];
  subject: Subject | null;
  onClearSubject: () => void;
  onStart: () => void;
}) {
  const next = nextReviewDay(items, new Date(), subject);
  const withAnswer = due.filter((item) => item.answer).length;
  const perSubject = subjects
    .map((entry) => ({ subject: entry, count: due.filter((item) => item.subject === entry).length }))
    .filter((entry) => entry.count > 0);

  return (
    <div className="space-y-8">
      <PageHero
        title="Révisions du jour"
        lede="Cherche de tête, retourne la carte, note-toi."
        illustration={<Illustration name="revisions" size={56} />}
      />

      {subject && (
        <p className="t-meta text-2xs">
          {subject} seulement ·{" "}
          <button type="button" onClick={onClearSubject} className="inline-flex min-h-6 items-center text-accent hover:underline max-lg:min-h-11">
            Toutes les matières
          </button>
        </p>
      )}

      {due.length === 0 ? (
        <EmptyState
          className="surface"
          illustration={<Illustration name="checkin" size={56} />}
          title="Rien à réviser aujourd'hui"
          description={
            next
              ? `Prochaine révision ${formatDueDay(next.day)} — ${next.count} entrée${next.count > 1 ? "s" : ""}. Revenir avant ne sert à rien : c'est l'écart qui fait le travail.`
              : "Note dans le carnet ce qui t'échappe en relisant tes corrigés : chaque entrée revient ici le lendemain, puis à intervalles croissants."
          }
          action={
            <Link href="/revoir" className={buttonVariants({ variant: "secondary" })}>
              Ouvrir le carnet
            </Link>
          }
        />
      ) : (
        // LA CARTE DU JOUR en dégradé orange → rose (celui de la bannière des
        // révisions de l'accueil) : le compte en énorme, qui monte, et
        // « Commencer » en pilule blanche.
        <GradientCard tone="review" tilt={false} className="reveal p-6 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
            <div>
              <p className="t-hero">
                <CountUp value={due.length} />
              </p>
              <p className="mt-1.5 text-[0.9375rem] font-bold opacity-90">
                entrée{due.length > 1 ? "s" : ""} à réviser · ≈ {due.length * 2} min
                {withAnswer > 0 && withAnswer < due.length && ` · ${withAnswer} avec réponse`}
              </p>
            </div>
            {perSubject.length > 1 && (
              <ul className="flex flex-wrap items-center gap-1.5" aria-label="Par matière">
                {perSubject.map((entry) => (
                  <li key={entry.subject} className="rounded-full bg-white/20 px-2.5 py-1 text-[0.8125rem] font-extrabold" title={entry.subject}>
                    {entry.subject} <span className="tabular">{entry.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            type="button"
            className="bounce-press mt-6 inline-flex min-h-14 w-full items-center justify-center rounded-full bg-white px-9 text-base font-black text-[#0b0b14] sm:w-auto"
            onClick={onStart}
          >
            Commencer
          </button>
          <p className="mt-3 text-2xs font-bold opacity-80 max-lg:hidden">Espace pour retourner la carte, 1 à 4 pour te noter.</p>
        </GradientCard>
      )}

      <WhyItWorks />
    </div>
  );
}

/**
 * « POURQUOI ÇA MARCHE » — replié par défaut : l'élève vient réviser, pas
 * lire. Mais une consigne qui va contre l'intuition (« ne relis pas,
 * interroge-toi ») s'applique mieux quand on sait d'où elle vient.
 *
 * Formulations volontairement prudentes : ce sont des effets moyens, mesurés
 * sur des textes et du vocabulaire, pas une promesse de note.
 */
function WhyItWorks() {
  return (
    <details className="group px-1">
      <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1.5 rounded-full bg-inset px-3.5 text-sm font-bold text-ink transition-colors hover:bg-hairline/[0.10] max-lg:min-h-11 [&::-webkit-details-marker]:hidden">
        <ChevronDown size={15} aria-hidden className="text-subtle transition-transform group-open:rotate-180" />
        Pourquoi ça marche
      </summary>
      <div className="t-meta mt-2 max-w-[62ch] space-y-2 text-[0.8125rem]">
        <p>
          <span className="text-ink">Se tester plutôt que relire.</span> Dans l&apos;expérience de Roediger et Karpicke (2006, <i>Psychological Science</i>),
          des étudiants qui se sont interrogés sur un texte en retenaient nettement plus une semaine plus tard que ceux qui l&apos;avaient relu — alors que la
          relecture l&apos;emportait au test passé cinq minutes après. L&apos;impression de facilité de la relecture est trompeuse.
        </p>
        <p>
          <span className="text-ink">Espacer plutôt que masser.</span> La méta-analyse de Cepeda et al. (2006, <i>Psychological Bulletin</i>) montre qu&apos;à
          temps égal, des révisions réparties dans le temps donnent une meilleure rétention à long terme que des révisions groupées.
        </p>
        <p>
          Dunlosky et al. (2013) classent ces deux techniques « d&apos;utilité élevée », la relecture « d&apos;utilité faible ».
        </p>
        <p>
          <span className="text-ink">Quand revoir : FSRS.</span> Les intervalles sont calculés par FSRS, l&apos;algorithme de Jarrett Ye et du projet
          open-spaced-repetition, qu&apos;Anki propose depuis sa version 23.10. Chaque entrée a une <i>stabilité</i> (le nombre de jours avant que la
          probabilité de t&apos;en souvenir retombe à 90 %) et une <i>difficulté</i>, mises à jour à chaque note ; l&apos;entrée revient quand cette
          probabilité estimée atteint 90 %. Les coefficients sont ceux par défaut, ajustés sur des centaines de millions de révisions Anki : une
          moyenne, pas un réglage fait pour toi.
        </p>
      </div>
    </details>
  );
}

/* ── LE BILAN ──────────────────────────────────────────────────────── */

function SessionEnd({
  items,
  rated,
  subject,
  onUndo,
}: {
  items: ReviewItem[];
  rated: RatedEntry[];
  subject: Subject | null;
  onUndo: () => void;
}) {
  const byId = new Map(items.map((item) => [item.id, item]));
  const counts = REVIEW_RATINGS.map((rating) => ({ rating, count: rated.filter((entry) => entry.rating === rating).length }));
  const remaining = dueReviewItems(items, new Date(), subject).length;
  const next = nextReviewDay(items, new Date(), subject);

  return (
    <div className="space-y-8">
      <PageHero
        illustration={<Illustration name="revisions" size={56} />}
        title={rated.length > 0 ? "Séance terminée" : "Séance interrompue"}
        eyebrow={
          rated.length > 0 ? (
            <span className="tabular">
              {rated.length} carte{rated.length > 1 ? "s" : ""} révisée{rated.length > 1 ? "s" : ""}
            </span>
          ) : undefined
        }
        lede={
          remaining > 0
            ? `Encore ${remaining} entrée${remaining > 1 ? "s" : ""} due${remaining > 1 ? "s" : ""} aujourd'hui — tu peux reprendre quand tu veux, rien n'est perdu.`
            : next
              ? `Prochaine révision ${formatDueDay(next.day)} : ${next.count} entrée${next.count > 1 ? "s" : ""}.`
              : undefined
        }
      />

      {rated.length > 0 && (
        <>
          {/* Le compte de chaque note, dans sa pilule de couleur. */}
          <ul className="grid grid-cols-4 gap-2" aria-label="Tes notes">
            {counts.map(({ rating, count }, position) => (
              <li key={rating} className={cn("pop flex flex-col items-center rounded-[1.25rem] px-2 py-3", RATE_CLASS[rating])} style={{ "--pop-delay": `${position * 80}ms` } as React.CSSProperties}>
                <span className="text-2xl font-black leading-none tabular">{count}</span>
                <span className="mt-1 text-2xs font-bold opacity-90">{REVIEW_RATING_META[rating].label}</span>
              </li>
            ))}
          </ul>

          <Section variant="panel" label="Prochaines échéances" title="Quand elles reviendront">
            <ul className="divide-y divide-line border-y border-line">
              {rated.map((entry) => {
                const item = byId.get(entry.id);
                if (!item) return null;
                return (
                  <li key={entry.id} className="flex items-center gap-3 py-2.5">
                    <SubjectAvatar subject={item.subject} size="md" />
                    <p className="min-w-0 flex-1 break-words text-[0.875rem] font-bold leading-5 text-ink">{item.text}</p>
                    <span className={cn("tabular shrink-0 text-[0.8125rem] font-bold", entry.rating === "again" ? "text-ink" : "text-muted")}>
                      {formatDueDay(effectiveSchedule(item).dueAt)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Section>
        </>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Link href="/dashboard" className={buttonVariants({ variant: "primary" })}>
          Retour à l&apos;accueil
        </Link>
        <Link href="/revoir" className={buttonVariants({ variant: "ghost" })}>
          Le carnet
        </Link>
        {rated.length > 0 && (
          <Button variant="ghost" onClick={onUndo}>
            <RotateCcw size={13} aria-hidden /> Annuler la dernière note
          </Button>
        )}
      </div>
    </div>
  );
}
