"use client";

import Link from "next/link";
import { ChevronDown, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { PageBar } from "@/components/ui/layout";
import { Meter } from "@/components/ui/progress";
import { Section } from "@/components/ui/section";
import { Stat, StatRow } from "@/components/ui/stat";
import { EmptyState, Skeleton } from "@/components/ui/state";
import { SubjectAvatar } from "@/components/exercises/exercise-badges";
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
        <div className="flex items-center justify-between gap-4">
          <p className="t-label">Révisions du jour</p>
          <button
            type="button"
            onClick={() => setPhase("end")}
            className="t-meta inline-flex min-h-6 items-center text-2xs hover:text-ink max-lg:min-h-11"
          >
            Terminer
          </button>
        </div>
        <div className="flex items-center gap-3">
          <Meter value={(done / queue.length) * 100} className="flex-1" />
          <span className="tabular t-meta shrink-0 text-2xs" aria-label={`Carte ${done + 1} sur ${queue.length}`}>
            {done + 1} / {queue.length}
          </span>
        </div>

        <Section variant="panel" className="min-h-[16rem] sm:p-7">
          <div className="flex items-center gap-2">
            <SubjectAvatar subject={current.subject} size="sm" />
            <span className="t-meta text-2xs">
              {current.subject} · {REVIEW_KIND_META[current.kind].label}
            </span>
          </div>
          <h2 ref={cardHeading} tabIndex={-1} className="t-heading mt-4 break-words outline-none">
            {current.text}
          </h2>

          {hasAnswer ? (
            revealed ? (
              <div className="mt-5 border-t border-line pt-5">
                <p className="t-label">Réponse</p>
                <p className="t-body mt-1.5 whitespace-pre-line break-words text-ink">{current.answer}</p>
              </div>
            ) : (
              <div className="mt-6">
                <p className="t-lede">Essaie de répondre de tête avant de retourner la carte — même approximativement.</p>
                <Button className="mt-4 w-full sm:w-auto" onClick={() => setRevealed(true)}>
                  Afficher la réponse
                  <kbd className="rounded border border-current px-1.5 text-2xs font-normal opacity-60 max-lg:hidden">Espace</kbd>
                </Button>
              </div>
            )
          ) : (
            <p className="t-lede mt-6">Tu t&apos;en souviens ? Redis-le de tête, puis note-toi honnêtement.</p>
          )}
        </Section>

        {canRate && (
          <div>
            <p className="t-meta mb-2 text-2xs">
              {hasAnswer ? "Compare avec ce que tu avais en tête." : "Sois honnête : c'est ce qui règle la prochaine révision."}
            </p>
            <div role="group" aria-label="Ta note" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {REVIEW_RATINGS.map((rating) => {
                const meta = REVIEW_RATING_META[rating];
                return (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => rate(rating)}
                    title={meta.hint}
                    className="flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-lg border border-line bg-panel px-2 py-2 text-ink transition-colors hover:bg-inset active:bg-inset"
                  >
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      <kbd className="tabular rounded border border-line px-1 text-2xs font-normal text-subtle max-lg:hidden">{meta.key}</kbd>
                      {meta.label}
                    </span>
                    <span className="tabular text-2xs text-muted">{rating === "again" ? "demain" : formatInterval(preview[rating])}</span>
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
      <PageBar
        title="Révisions du jour"
        lede="Les entrées de ton carnet qui arrivent à échéance aujourd'hui. Pour chacune : cherche la réponse de tête, retourne la carte, note-toi."
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
        <Section variant="panel">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
            <div>
              <p className="t-figure-lg tabular">{due.length}</p>
              <p className="t-meta mt-1">
                entrée{due.length > 1 ? "s" : ""} à réviser
                {withAnswer > 0 && withAnswer < due.length && ` · ${withAnswer} avec une réponse à retrouver`}
              </p>
            </div>
            {perSubject.length > 1 && (
              <ul className="flex flex-wrap items-center gap-3" aria-label="Par matière">
                {perSubject.map((entry) => (
                  <li key={entry.subject} className="flex items-center gap-1.5" title={entry.subject}>
                    <SubjectAvatar subject={entry.subject} size="sm" />
                    <span className="tabular text-2xs text-muted">{entry.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Button size="lg" className="mt-6 w-full sm:w-auto" onClick={onStart}>
            Commencer
          </Button>
          <p className="t-meta mt-3 text-2xs max-lg:hidden">Au clavier : Espace pour retourner la carte, 1 à 4 pour te noter.</p>
        </Section>
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
    <details className="group border-t border-line pt-4">
      <summary className="flex min-h-8 cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-ink max-lg:min-h-11 [&::-webkit-details-marker]:hidden">
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
          Dunlosky et al. (2013) classent ces deux techniques « d&apos;utilité élevée », la relecture « d&apos;utilité faible ». Les intervalles utilisés ici
          (1, 3, 7, 16, 35, 90 jours) sont une règle simple inspirée de ces travaux, pas un réglage optimal démontré.
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
      <PageBar
        title={rated.length > 0 ? "Séance terminée" : "Séance interrompue"}
        meta={
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
          <StatRow>
            {counts.map(({ rating, count }) => (
              <Stat key={rating} label={REVIEW_RATING_META[rating].label} value={<span className="tabular">{count}</span>} size="sm" />
            ))}
          </StatRow>

          <Section label="Prochaines échéances" title="Quand elles reviendront">
            <ul className="divide-y divide-line border-y border-line">
              {rated.map((entry) => {
                const item = byId.get(entry.id);
                if (!item) return null;
                return (
                  <li key={entry.id} className="flex items-start gap-2.5 py-2">
                    <span className="translate-y-px">
                      <SubjectAvatar subject={item.subject} size="sm" />
                    </span>
                    <p className="min-w-0 flex-1 break-words text-[0.8125rem] leading-5 text-ink">{item.text}</p>
                    <span className={cn("tabular shrink-0 text-2xs", entry.rating === "again" ? "text-ink" : "text-muted")}>
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
