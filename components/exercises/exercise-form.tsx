"use client";

import { AnimatePresence, motion } from "framer-motion";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { ChapterPicker } from "@/components/exercises/chapter-picker";
import { exerciseTypes, subjects } from "@/lib/study";
import type { Chapter } from "@/lib/storage";
import type { Difficulty, ExerciseLevel, ExerciseType, LicenseStatus, ProgrammeLevel, Subject } from "@/lib/supabase/types";

/**
 * Champs saisis à la création — le manager complète le reste (id, created_at,
 * updated_at, statut initial, priority/mastery/year par défaut, compteurs à
 * zéro…). `chapterId` (Sprint 3D) reste optionnel : aucun chapitre n'est
 * imposé, l'utilisateur choisit "Sans chapitre" ou en crée un à la volée.
 *
 * `competition`/`programmeLevel`/`licenseStatus`/`externalId`/`sourceUrl`
 * (infrastructure banque concours) restent optionnels et absents du
 * formulaire manuel ci-dessous — seul le pipeline d'import (Sprint infra
 * concours, lib/exercise-import.ts) les renseigne aujourd'hui.
 */
export interface NewExerciseInput {
  subject: Subject;
  title: string;
  /** Énoncé complet — voir la doc du champ `statement` sur `Exercise` (lib/supabase/types.ts). "" si non renseigné. */
  statement: string;
  source: string;
  type: ExerciseType;
  difficulty: Difficulty;
  chapterId: string | null;
  tags: string[];
  estimatedMinutes: number | null;
  note: string;
  hints: string[];
  correction: string;
  year?: number | null;
  competition?: string | null;
  programmeLevel?: ProgrammeLevel | null;
  licenseStatus?: LicenseStatus | null;
  externalId?: string | null;
  sourceUrl?: string | null;
  prerequisites?: string[];
  pedagogicalGoal?: string | null;
  level?: ExerciseLevel | null;
  /**
   * `true` pour un exercice importé hors périmètre "faisable maintenant"
   * (ex. pilier de Spé) — réutilise le champ `archived` déjà existant (masqué
   * des recommandations et de la liste par défaut, visible dans "Archivés")
   * plutôt que de modifier le moteur de recommandation. `undefined`/`false`
   * par défaut (comportement inchangé pour le formulaire manuel).
   */
  archived?: boolean;
}

const emptyForm = {
  subject: "Mathématiques" as Subject,
  title: "",
  statement: "",
  source: "",
  type: "TD" as ExerciseType,
  difficulty: 3,
  chapterId: null as string | null,
  tags: "",
  estimatedMinutes: "",
  note: "",
  hints: "",
  correction: "",
};

export function ExerciseForm({
  open,
  chapters,
  onSubmit,
  onCancel,
  onCreateChapter,
  initialSubject,
  initialChapterId,
}: {
  open: boolean;
  chapters: Chapter[];
  onSubmit: (input: NewExerciseInput) => void;
  onCancel: () => void;
  onCreateChapter: (subject: Subject, label: string) => Chapter;
  /** Matière/chapitre actuellement parcourus (Matière → Chapitre) — pré-remplissent le formulaire à l'ouverture plutôt que de toujours retomber sur "Mathématiques" sans chapitre. `undefined`/`null` : pas de contexte particulier (ex. "Toutes" matières), comportement par défaut inchangé. */
  initialSubject?: Subject;
  initialChapterId?: string | null;
}) {
  const [form, setForm] = useState(emptyForm);
  // Toujours à jour sans redéclencher l'effet ci-dessous à chaque changement
  // de filtre — seule la TRANSITION fermé → ouvert doit réinitialiser le
  // formulaire (même pattern que exercisesRef/chaptersRef, exercise-manager.tsx).
  const initialsRef = useRef({ initialSubject, initialChapterId });
  useEffect(() => {
    initialsRef.current = { initialSubject, initialChapterId };
  });

  // Pré-remplit avec le contexte de navigation actuel (Matière → Chapitre) à
  // chaque OUVERTURE du formulaire — sans ça, créer un exercice depuis un
  // chapitre précis retombait toujours sur "Mathématiques" sans chapitre,
  // sans lien avec l'endroit où l'utilisateur venait de cliquer "+ Ajouter"
  // (voir le scénario "Matière A → Chapitre A1 → créer → l'exercice doit
  // apparaître là où on l'attend"). Réinitialise aussi tout brouillon
  // abandonné par un "Annuler" précédent (voir onCancel) : rouvrir le
  // formulaire ne doit jamais montrer une saisie oubliée.
  useEffect(() => {
    if (!open) return;
    const { initialSubject: subject, initialChapterId: chapterId } = initialsRef.current;
    setForm({ ...emptyForm, subject: subject ?? emptyForm.subject, chapterId: chapterId ?? null });
  }, [open]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.title.trim() || !form.source.trim()) return;
    onSubmit({
      subject: form.subject,
      title: form.title.trim(),
      statement: form.statement.trim(),
      source: form.source.trim(),
      type: form.type,
      difficulty: form.difficulty as Difficulty,
      chapterId: form.chapterId,
      tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      estimatedMinutes: form.estimatedMinutes.trim() ? Math.max(0, Number(form.estimatedMinutes)) : null,
      note: form.note.trim(),
      hints: form.hints.split("\n").map((hint) => hint.trim()).filter(Boolean),
      correction: form.correction.trim(),
    });
    setForm(emptyForm);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.form
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          onSubmit={handleSubmit}
          className="surface grid gap-3 rounded-2xl p-5 sm:grid-cols-2"
        >
          <Input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Intitulé de l'exercice" />
          <Input required value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} placeholder="Source (feuille, DM, livre…)" />
          <Textarea
            value={form.statement}
            onChange={(event) => setForm({ ...form, statement: event.target.value })}
            className="min-h-28 sm:col-span-2"
            placeholder={"Énoncé complet — maths en LaTeX : $x^2$ inline, $$\\int_0^1 f$$ en bloc"}
          />
          <Select
            value={form.subject}
            onChange={(event) => setForm({ ...form, subject: event.target.value as Subject, chapterId: null })}
          >
            {subjects.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </Select>
          <Select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as ExerciseType })}>
            {exerciseTypes.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </Select>
          <Select value={form.difficulty} onChange={(event) => setForm({ ...form, difficulty: Number(event.target.value) })}>
            {[1, 2, 3, 4, 5].map((value) => (
              <option value={value} key={value}>
                Difficulté {value}/5
              </option>
            ))}
          </Select>
          <label className="flex items-center gap-2 text-xs text-zinc-500 sm:col-span-2">
            Chapitre
            <ChapterPicker
              subject={form.subject}
              chapters={chapters}
              value={form.chapterId}
              onChange={(chapterId) => setForm({ ...form, chapterId })}
              onCreateChapter={onCreateChapter}
            />
          </label>
          <Input
            type="number"
            min={0}
            value={form.estimatedMinutes}
            onChange={(event) => setForm({ ...form, estimatedMinutes: event.target.value })}
            placeholder="Temps estimé (minutes)"
          />
          <Input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} className="sm:col-span-2" placeholder="Tags, séparés par des virgules" />
          <Textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} className="sm:col-span-2" placeholder="Note personnelle" />
          <Textarea value={form.hints} onChange={(event) => setForm({ ...form, hints: event.target.value })} className="sm:col-span-2" placeholder="Indices progressifs — un indice par ligne" />
          <Textarea value={form.correction} onChange={(event) => setForm({ ...form, correction: event.target.value })} className="sm:col-span-2" placeholder="Correction personnelle (restera masquée par défaut)" />
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" onClick={onCancel}>
              Annuler
            </Button>
            <Button type="submit">Créer l&apos;exercice</Button>
          </div>
        </motion.form>
      )}
    </AnimatePresence>
  );
}
