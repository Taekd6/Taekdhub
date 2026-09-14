"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { TaskEditor } from "@/components/tasks/task-editor";
import { TaskDetail } from "@/components/tasks/task-detail";
import type { Task } from "@/lib/domain/types";

/**
 * COMPOSITEUR — un point d'entrée unique pour « ajouter » et « ouvrir ».
 *
 * Monté une seule fois dans la coque, il évite que chaque écran porte sa
 * propre feuille (et sa propre variante du formulaire). N'importe quel
 * composant appelle `useComposer().add()` ou `.open(task)` — c'est la même
 * feuille partout, donc le même geste partout.
 *
 * Il porte aussi le RACCOURCI CLAVIER `n` : sur un ordinateur, ajouter une
 * tâche ne doit pas coûter un déplacement de souris jusqu'à un bouton.
 */

/** Valeurs pré-remplies à la création — toujours issues du CONTEXTE d'où l'on clique. */
export interface ComposerDefaults {
  /** Jour local `YYYY-MM-DD` — quand on ajoute depuis une case du calendrier. */
  dueDate?: string;
  /** Objectif à rattacher — quand on ajoute depuis la fiche d'un objectif. */
  goalId?: string;
}

interface ComposerApi {
  /** Ouvre le formulaire de création, pré-rempli par le contexte d'appel. */
  add(defaults?: ComposerDefaults): void;
  /** Ouvre la fiche d'une tâche existante. */
  open(task: Task): void;
  /** Ouvre directement le formulaire de modification. */
  edit(task: Task): void;
}

const ComposerContext = createContext<ComposerApi | null>(null);

export function useComposer(): ComposerApi {
  const api = useContext(ComposerContext);
  if (!api) throw new Error("useComposer doit être utilisé dans <ComposerProvider>");
  return api;
}

type Mode =
  | { kind: "closed" }
  | { kind: "create"; defaults?: ComposerDefaults }
  | { kind: "detail"; task: Task }
  | { kind: "edit"; task: Task };

export function ComposerProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>({ kind: "closed" });

  const api = useMemo<ComposerApi>(
    () => ({
      add: (defaults) => setMode({ kind: "create", defaults }),
      open: (task) => setMode({ kind: "detail", task }),
      edit: (task) => setMode({ kind: "edit", task }),
    }),
    []
  );

  const close = useCallback(() => setMode({ kind: "closed" }), []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "n" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      // Ne jamais voler la frappe à un champ de saisie : `n` doit rester la
      // lettre `n` quand on écrit le titre d'une tâche.
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      event.preventDefault();
      setMode({ kind: "create" });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <ComposerContext.Provider value={api}>
      {children}
      <TaskEditor
        open={mode.kind === "create" || mode.kind === "edit"}
        task={mode.kind === "edit" ? mode.task : null}
        defaults={mode.kind === "create" ? mode.defaults : undefined}
        onClose={close}
      />
      <TaskDetail
        open={mode.kind === "detail"}
        task={mode.kind === "detail" ? mode.task : null}
        onClose={close}
        onEdit={(task) => setMode({ kind: "edit", task })}
      />
    </ComposerContext.Provider>
  );
}

/**
 * BOUTON D'AJOUT RAPIDE — flottant sur mobile, au-dessus de la barre
 * d'onglets ; discret dans le chrome sur grand écran, où chaque écran a déjà
 * son propre « Ajouter ».
 *
 * Il est délibérément TOUJOURS là sur mobile : l'usage réel est « je sors du
 * cours, je note le DM en dix secondes », et ce geste ne doit jamais demander
 * de naviguer d'abord vers le bon écran.
 */
export function QuickAddButton() {
  const { add } = useComposer();
  return (
    <button
      type="button"
      onClick={() => add()}
      aria-label="Ajouter une tâche"
      className="fixed bottom-[calc(3.75rem+env(safe-area-inset-bottom))] right-4 z-30 grid h-14 w-14 place-items-center rounded-full bg-accent-solid text-accent-solid-foreground shadow-surface transition-transform active:scale-95 lg:hidden"
    >
      <Plus size={24} strokeWidth={2.25} />
    </button>
  );
}
