"use client";

import { memo } from "react";
import { Archive, ChevronDown, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DifficultyDots } from "@/components/exercises/difficulty-dots";
import { SubjectAvatar } from "@/components/exercises/exercise-badges";
import { ExerciseDetail } from "@/components/exercises/exercise-detail";
import { ProvenanceBadge } from "@/components/exercises/provenance-badge";
import { MathInline } from "@/components/rich-math";
import { cn } from "@/lib/cn";
import type { Chapter } from "@/lib/storage";
import type { Exercise, Subject, WorkSession } from "@/lib/supabase/types";

/**
 * RANGÉE D'EXERCICE — une seule, pour tous les contextes.
 *
 * Il en existait DEUX : `ExerciseCard` (une carte encadrée) et
 * `ExerciseListRow` (une ligne dense), quasi identiques, choisies par un
 * sélecteur « cartes / liste » en haut de page. Deux composants à maintenir
 * en parallèle, un contrôle de plus à comprendre, et un mode « cartes » qui
 * n'affichait que six exercices par écran sur une banque de 537. Il n'en
 * reste qu'un : la ligne.
 *
 * LE CLIC PRINCIPAL OUVRE LA LECTURE. C'est le changement de comportement le
 * plus important de cet écran : auparavant, cliquer un exercice le DÉPLIAIT
 * pour montrer ses réglages, et il fallait ensuite trouver une petite icône
 * pour l'ouvrir vraiment. On vient ici pour travailler, pas pour administrer
 * une fiche — les réglages restent à une frappe, derrière le chevron.
 */
interface ExerciseRowProps {
  item: Exercise;
  expanded: boolean;
  minutesSpent: number;
  chapters: Chapter[];
  sessions: WorkSession[];
  /** Callbacks à identité stable fournis par le manager — condition du `memo`. */
  /**
   * Ce que la ligne n'a PAS à redire, parce que le contexte l'affiche déjà.
   *
   * Dans un chapitre ouvert, chacune des 37 lignes répétait « Réduction des
   * endomorphismes » sous son titre, et portait la même pastille « M » —
   * 37 fois la réponse à une question que personne ne pose, occupant la place
   * de ce qui distingue vraiment les exercices entre eux.
   */
  hideSubject?: boolean;
  hideChapter?: boolean;
  onOpen: (id: string) => void;
  onToggleDetail: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Exercise>) => void;
  onArchive: (id: string) => void;
  onCreateChapter: (subject: Subject, label: string) => Chapter;
  onRenameChapter: (id: string, label: string) => void;
  onRemoveChapter: (id: string) => void;
}

function ExerciseRowImpl({
  item,
  expanded,
  minutesSpent,
  chapters,
  sessions,
  hideSubject,
  hideChapter,
  onOpen,
  onToggleDetail,
  onUpdate,
  onArchive,
  onCreateChapter,
  onRenameChapter,
  onRemoveChapter,
}: ExerciseRowProps) {
  const chapterLabel = hideChapter ? null : chapters.find((chapter) => chapter.id === item.chapter_id)?.label;

  return (
    <li id={`exercise-${item.id}`} className={cn(expanded && "bg-inset")}>
      <div className="flex items-center gap-2 pr-1">
        <button
          type="button"
          onClick={() => onOpen(item.id)}
          className="row-hover flex min-w-0 flex-1 items-center gap-3 rounded-md py-3 pl-1 pr-2 text-left max-lg:min-h-[3.5rem] sm:pl-2"
        >
          {!hideSubject && <SubjectAvatar subject={item.subject} size="sm" />}
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="min-w-0 truncate text-sm text-ink">
                <MathInline text={item.title} />
              </span>
              {item.favorite && <Heart size={11} className="shrink-0 text-rose-300" fill="currentColor" />}
            </span>
            {/* UNE ligne de métadonnées, dans un ordre fixe : où ça vit
                (chapitre), d'où ça vient (provenance/source). Le type et
                l'année ne servent jamais à choisir — ils sont dans le détail.
                La source reste visible même sur mobile quand le chapitre est
                masqué (on est déjà dedans) : sans elle, la ligne se réduirait
                à un titre tronqué, sans rien pour distinguer deux exercices
                voisins. */}
            <span className="t-meta mt-0.5 flex min-w-0 items-center gap-1.5 truncate">
              {chapterLabel && <span className="truncate">{chapterLabel}</span>}
              {chapterLabel && <span aria-hidden>·</span>}
              <ProvenanceBadge exercise={item} className="shrink-0" />
              <span className="hidden min-w-0 truncate sm:inline">{item.source}</span>
              {/* Sur mobile, la difficulté remplace la source dans la ligne de
                  méta. La source d'un exercice écrit pour l'app est la même
                  pour tous — répétée 37 fois, elle n'aide pas à choisir ;
                  la difficulté, si. Sur grand écran elle a sa colonne. */}
              <span className="sm:hidden">
                <DifficultyDots value={item.difficulty} />
              </span>
            </span>
          </span>
          <span className="hidden shrink-0 sm:inline-flex">
            <DifficultyDots value={item.difficulty} />
          </span>
          {/* La maîtrise en chiffre plutôt qu'en barre : dans une colonne de
              quarante lignes, quarante barres de longueurs voisines ne se
              comparent pas — quarante nombres alignés, si.
              Et rien du tout à 0 % : « 0% » répété quarante fois n'apprend
              rien et ajoute une colonne de bruit à côté des titres. */}
          <span
            className={cn(
              "tabular hidden w-9 shrink-0 text-right text-xs lg:inline-block",
              item.mastery >= 75 ? "text-emerald-300" : item.mastery >= 50 ? "text-amber-300" : "text-subtle"
            )}
          >
            {item.mastery > 0 ? `${item.mastery}%` : ""}
          </span>
        </button>

        {/* Favori et archivage disparaissent sous `sm`. Sur 390 px, ces deux
            icônes prenaient un tiers de la ligne au détriment du TITRE, pour
            deux gestes rares que la fiche dépliée propose déjà. Le pouce a
            besoin du titre, pas de l'archivage. */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onUpdate(item.id, { favorite: !item.favorite })}
          aria-label={item.favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
          className={cn("hidden h-8 w-8 sm:inline-flex", item.favorite && "text-rose-300")}
        >
          <Heart size={15} fill={item.favorite ? "currentColor" : "none"} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onArchive(item.id)}
          aria-label="Archiver"
          className="hidden h-8 w-8 sm:inline-flex"
        >
          <Archive size={15} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onToggleDetail(item.id)}
          aria-label={expanded ? "Masquer la fiche" : "Ouvrir la fiche"}
          aria-expanded={expanded}
          className="h-8 w-8 max-lg:h-10 max-lg:w-10"
        >
          <ChevronDown size={15} className={cn("transition-transform duration-150", expanded && "rotate-180")} />
        </Button>
      </div>

      {/* Dépli SANS animation de hauteur : `height: auto` animé force le
          navigateur à recalculer la mise en page à chaque image, et sur une
          fiche qui contient un énoncé complet, cela saccade. Une apparition
          nette est ici préférable à un glissement approximatif. */}
      {expanded && (
        <div className="animate-fade-in border-t border-line pb-2">
          <ExerciseDetail
            item={item}
            update={onUpdate}
            minutesSpent={minutesSpent}
            chapters={chapters}
            sessions={sessions}
            onCreateChapter={onCreateChapter}
            onRenameChapter={onRenameChapter}
            onRemoveChapter={onRemoveChapter}
            onArchive={onArchive}
          />
        </div>
      )}
    </li>
  );
}

/**
 * Mémoïsé : modifier UN exercice ne doit pas re-rendre les 537 autres.
 * Ne fonctionne que parce que le manager fournit des callbacks à identité
 * stable — voir exercise-manager.tsx.
 */
export const ExerciseRow = memo(ExerciseRowImpl);
