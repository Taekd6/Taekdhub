"use client";

import Link from "next/link";
import { ArrowRight, Check, CornerDownLeft, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented";
import { SubjectAvatar } from "@/components/exercises/exercise-badges";
import { cn } from "@/lib/cn";
import {
  createReviewItem,
  parseReviewMemory,
  removeReviewItem,
  REVIEW_KIND_META,
  REVIEW_MEMORY_KEY,
  REVIEW_TEXT_MAX,
  selectReviewItems,
  toggleReviewItem,
} from "@/lib/review-items";
import { readFlag, REVIEW_KINDS, writeFlag, type ReviewItem, type ReviewKind } from "@/lib/storage";
import { subjectMeta, subjects } from "@/lib/study";
import type { Subject } from "@/lib/supabase/types";

/**
 * NOTER CE QU'IL FAUT REVOIR — un champ, Entrée, c'est noté.
 *
 * Le geste visé est celui de l'élève qui relit un corrigé et se dit « ça, je
 * ne l'aurais pas trouvé ». Il ne doit pas quitter le corrigé des yeux plus
 * de cinq secondes : on tape, on valide au clavier, le champ se vide et
 * GARDE le focus pour la ligne suivante. La matière est retenue d'une fois
 * sur l'autre (un corrigé = une matière), la nature reste celle de la saisie
 * précédente tant que la page est ouverte (on extrait souvent trois
 * cartouches d'affilée), et revient à « à revoir » au prochain passage.
 *
 * Aucun formulaire, aucune fenêtre — même règle que la saisie rapide de
 * temps (components/work/quick-log.tsx), et pour la même raison : chaque
 * geste ajouté à une saisie quotidienne est une raison de l'abandonner.
 *
 * Les données viennent du PARENT, jamais d'un second `usePrepahubData()` :
 * chaque appel du hook tient sa propre copie, et `saveReviewItems` REMPLACE
 * (une entrée se supprime, voir lib/storage.ts). Une seconde copie périmée
 * effacerait à sa première écriture ce que la première vient d'ajouter.
 */
export function ReviewCapture({
  items,
  saveItems,
  ready,
  subject: lockedSubject,
  visible,
  limit,
  allHref,
  emptyText = "Rien à revoir pour l'instant. Note ce qui t'a échappé en relisant un corrigé.",
  showList = true,
}: {
  /** Le carnet ENTIER — c'est lui qu'on réécrit, jamais la tranche affichée. */
  items: ReviewItem[];
  saveItems: (items: ReviewItem[]) => void;
  ready: boolean;
  /** Matière imposée (hub d'une matière) : le sélecteur disparaît. */
  subject?: Subject;
  /** Ce que la liste affiche. Par défaut : les entrées ouvertes, de la matière imposée s'il y en a une. */
  visible?: ReviewItem[];
  limit?: number;
  /** Lien « Tout voir » quand la liste est tronquée. */
  allHref?: string;
  emptyText?: string;
  showList?: boolean;
}) {
  const [chosenSubject, setChosenSubject] = useState<Subject>("Mathématiques");
  const [kind, setKind] = useState<ReviewKind>("à revoir");
  const [text, setText] = useState("");
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);
  const subject = lockedSubject ?? chosenSubject;

  // Relu dans un effet, jamais au premier rendu : la page est prérendue
  // statiquement, et le serveur n'a pas de localStorage.
  useEffect(() => {
    const memory = parseReviewMemory(readFlag(REVIEW_MEMORY_KEY));
    if (memory) setChosenSubject(memory);
  }, []);

  useEffect(() => {
    if (!justAdded) return;
    const timeout = window.setTimeout(() => setJustAdded(null), 1800);
    return () => window.clearTimeout(timeout);
  }, [justAdded]);

  const list = useMemo(
    () => visible ?? selectReviewItems(items, { subject: lockedSubject ?? null, openOnly: true }),
    [visible, items, lockedSubject]
  );

  const trimmed = text.trim();
  const canAdd = ready && trimmed.length > 0 && trimmed.length <= REVIEW_TEXT_MAX;

  function add() {
    const item = createReviewItem({ subject, text, kind });
    if (!item || !ready) return;
    saveItems([item, ...items]);
    if (!lockedSubject) writeFlag(REVIEW_MEMORY_KEY, subject);
    setText("");
    setJustAdded(item.id);
    field.current?.focus();
  }

  function chooseSubject(value: Subject) {
    setChosenSubject(value);
    // Le choix de matière précède presque toujours la frappe : rendre le
    // focus au champ évite un toucher de plus sur téléphone.
    field.current?.focus();
  }

  return (
    <div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (canAdd) add();
        }}
        className="flex items-center gap-2"
      >
        {/* Champ nu, pas <Input> : il porte le bouton « Noter » DANS son
            creux, pour que la ligne entière se lise comme un seul contrôle —
            celui qu'on vise du pouce sans réfléchir. Mêmes tokens que
            components/ui/input.tsx. */}
        <label className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-transparent bg-inset pl-3 pr-1 transition-colors focus-within:border-line hover:border-line max-lg:min-h-11">
          <span className="sr-only">Ce qu&apos;il faut revoir</span>
          <input
            ref={field}
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={REVIEW_TEXT_MAX}
            placeholder={REVIEW_KIND_META[kind].placeholder}
            enterKeyHint="done"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent py-2 text-sm text-ink outline-none placeholder:text-subtle"
          />
          <Button type="submit" variant="ghost" size="sm" disabled={!canAdd} className="shrink-0 text-ink">
            {justAdded ? (
              <>
                <Check size={14} className="text-emerald-300" /> Noté
              </>
            ) : (
              <>
                Noter <CornerDownLeft size={13} className="text-subtle max-lg:hidden" aria-hidden />
              </>
            )}
          </Button>
        </label>
      </form>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* MATIÈRE — les avatars déjà connus partout dans l'app, comme la
            saisie rapide de temps : sept cibles visibles d'un coup valent
            mieux qu'un menu à ouvrir. */}
        {!lockedSubject && (
          <div role="radiogroup" aria-label="Matière" className="flex items-center gap-1 max-sm:grid max-sm:w-full max-sm:grid-cols-7">
            {subjects.map((item) => {
              const active = item === subject;
              return (
                <button
                  key={item}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={item}
                  title={item}
                  onClick={() => chooseSubject(item)}
                  className={cn(
                    "grid h-8 min-w-8 place-items-center rounded-md px-1 text-[0.6875rem] font-semibold leading-none transition-[box-shadow,opacity] max-lg:h-11",
                    subjectMeta[item].className,
                    active ? "bg-panel ring-2 ring-accent ring-offset-2 ring-offset-canvas" : "bg-inset opacity-70 hover:opacity-100"
                  )}
                >
                  {subjectMeta[item].short}
                </button>
              );
            })}
          </div>
        )}
        <SegmentedControl
          size="sm"
          ariaLabel="Nature"
          value={kind}
          onChange={(value) => {
            setKind(value);
            field.current?.focus();
          }}
          options={REVIEW_KINDS.map((value) => ({ value, label: REVIEW_KIND_META[value].label }))}
        />
      </div>
      {!lockedSubject && <p className="t-meta mt-1.5 text-2xs">{subject}</p>}
      {trimmed.length > REVIEW_TEXT_MAX - 40 && (
        <p className="tabular t-meta mt-1 text-2xs">
          {trimmed.length} / {REVIEW_TEXT_MAX} — une ligne, pas un paragraphe.
        </p>
      )}

      {showList && (
        <ReviewList
          items={items}
          saveItems={saveItems}
          rows={list}
          limit={limit}
          allHref={allHref}
          showSubject={!lockedSubject}
          highlight={justAdded}
          emptyText={emptyText}
          className="mt-4"
        />
      )}
    </div>
  );
}

/**
 * LA LISTE — cocher, décocher, supprimer. Exportée seule pour le carnet
 * complet (/revoir) et les cartouches du hub, qui listent sans saisir.
 *
 * Cocher fait disparaître la ligne des listes ouvertes. Un pouce qui glisse
 * ne doit pas coûter une entrée : la dernière ligne cochée reste annulable
 * quelques secondes, d'un geste, comme la saisie rapide de temps.
 */
export function ReviewList({
  items,
  saveItems,
  rows,
  limit,
  allHref,
  showSubject = true,
  showKind = true,
  highlight = null,
  emptyText,
  className,
}: {
  items: ReviewItem[];
  saveItems: (items: ReviewItem[]) => void;
  rows: ReviewItem[];
  limit?: number;
  allHref?: string;
  showSubject?: boolean;
  /** `false` quand la liste est déjà d'une seule nature (le recueil des cartouches) : l'étiquette répéterait le titre à chaque ligne. */
  showKind?: boolean;
  highlight?: string | null;
  emptyText?: string;
  className?: string;
}) {
  const [lastToggled, setLastToggled] = useState<ReviewItem | null>(null);

  useEffect(() => {
    if (!lastToggled) return;
    const timeout = window.setTimeout(() => setLastToggled(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [lastToggled]);

  const shown = limit ? rows.slice(0, limit) : rows;
  const hidden = rows.length - shown.length;

  function toggle(item: ReviewItem) {
    saveItems(toggleReviewItem(items, item.id));
    // Seul un COCHAGE mérite l'annulation : c'est lui qui fait disparaître
    // la ligne. Décocher la ramène sous les yeux, rien à rattraper.
    setLastToggled(item.doneAt === null ? item : null);
  }

  function undo() {
    if (!lastToggled) return;
    saveItems(items.map((entry) => (entry.id === lastToggled.id ? { ...entry, doneAt: null } : entry)));
    setLastToggled(null);
  }

  return (
    <div className={className}>
      {shown.length === 0 ? (
        emptyText && <p className="t-meta text-2xs">{emptyText}</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {shown.map((item) => (
            <ReviewRow
              key={item.id}
              item={item}
              showSubject={showSubject}
              showKind={showKind}
              fresh={item.id === highlight}
              onToggle={() => toggle(item)}
              onRemove={() => saveItems(removeReviewItem(items, item.id))}
            />
          ))}
        </ul>
      )}

      {(lastToggled || (hidden > 0 && allHref)) && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          {lastToggled ? (
            <p role="status" className="t-meta min-w-0 flex-1 truncate text-2xs">
              {REVIEW_KIND_META[lastToggled.kind].done} : {lastToggled.text}
              {" · "}
              <button type="button" onClick={undo} className="inline-flex min-h-6 items-center text-accent hover:underline max-lg:min-h-11">
                Annuler
              </button>
            </p>
          ) : (
            <span />
          )}
          {hidden > 0 && allHref && (
            <Link href={allHref} className="t-meta inline-flex min-h-6 shrink-0 items-center gap-1 text-2xs text-accent hover:underline max-lg:min-h-11">
              Tout voir ({rows.length}) <ArrowRight size={12} aria-hidden />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * UNE LIGNE — la case à gauche, le texte, la nature, la croix.
 *
 * La croix est discrète (`text-subtle`) mais TOUJOURS visible : la révéler
 * au survol la rendrait introuvable au doigt, et c'est au téléphone que le
 * carnet se remplit.
 */
function ReviewRow({
  item,
  showSubject,
  showKind,
  fresh,
  onToggle,
  onRemove,
}: {
  item: ReviewItem;
  showSubject: boolean;
  showKind: boolean;
  fresh: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const done = item.doneAt !== null;
  const meta = REVIEW_KIND_META[item.kind];
  // La nature s'affiche quand elle apprend quelque chose : « à revoir » est
  // le cas par défaut et se tait, et une méthode MAÎTRISÉE le dit toujours —
  // c'est la seule trace de ce cochage, puisqu'elle ne quitte pas le recueil.
  const tag = done && item.kind === "méthode" ? meta.done : showKind && item.kind !== "à revoir" ? (done ? meta.done : meta.label) : null;
  return (
    <li className={cn("flex items-start gap-2.5 py-2", fresh && "animate-fade-in")}>
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={`${done ? "Décocher" : `Marquer « ${meta.done.toLowerCase()} »`} : ${item.text}`}
        onClick={onToggle}
        className="grid shrink-0 place-items-center rounded-md max-lg:-m-2.5 max-lg:h-11 max-lg:w-11 lg:h-5 lg:w-5 lg:translate-y-px"
      >
        <span
          className={cn(
            "grid h-[1.125rem] w-[1.125rem] place-items-center rounded-[0.3125rem] border transition-colors",
            done ? "border-accent-solid bg-accent-solid text-accent-solid-foreground" : "border-subtle bg-panel hover:border-muted"
          )}
        >
          {done && <Check size={12} strokeWidth={3} aria-hidden />}
        </span>
      </button>
      {showSubject && (
        <span className="translate-y-px">
          <SubjectAvatar subject={item.subject} size="sm" />
        </span>
      )}
      <p className="min-w-0 flex-1 break-words text-[0.8125rem] leading-5">
        <span className={done ? "text-muted line-through decoration-subtle" : "text-ink"}>{item.text}</span>
        {tag && (
          <span className="t-meta whitespace-nowrap text-2xs">
            {" · "}
            {tag}
          </span>
        )}
      </p>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Supprimer : ${item.text}`}
        title="Supprimer"
        className="grid shrink-0 place-items-center rounded text-subtle transition-colors hover:text-rose-300 max-lg:-m-2.5 max-lg:h-11 max-lg:w-11 lg:h-5 lg:w-5"
      >
        <X size={14} aria-hidden />
      </button>
    </li>
  );
}
