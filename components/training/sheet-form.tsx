"use client";

import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { CopyRequest } from "@/components/exercises/copy-request";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Notice } from "@/components/ui/state";
import { SegmentedControl } from "@/components/ui/segmented";
import { EXERCISE_LEVEL_LABEL, EXERCISE_LEVELS, type ExerciseLevel } from "@/lib/attempts";
import { exerciseRequest } from "@/lib/exercise-quality";
import {
  COMPETENCE_MAX,
  CORRECTION_MAX,
  createSheet,
  EMPTY_DRAFT,
  HINT_MAX,
  HINTS_MAX,
  NOTION_MAX,
  SHEET_ORIGIN_LABEL,
  SOURCE_NAME_MAX,
  STATEMENT_MAX,
  sheetIssues,
  type ExerciseSheet,
  type SheetDraft,
  type SheetOrigin,
} from "@/lib/exercise-sheets";
import { PROGRAMME, PROGRAMME_BY_ID } from "@/lib/programme-data";
import { subjects } from "@/lib/study";
import type { Subject } from "@/lib/supabase/types";

const ORIGIN_OPTIONS: { value: SheetOrigin; label: string }[] = [
  { value: "ia", label: "Original (IA)" },
  { value: "externe", label: "Ressource externe" },
];

const LEVEL_OPTIONS = EXERCISE_LEVELS.map((level) => ({ value: level, label: level === "direct" ? "Direct" : level === "classique" ? "Classique" : "Difficile" }));

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="t-label block">
        {label}
      </label>
      {hint && <p className="t-meta mt-0.5 text-2xs">{hint}</p>}
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

/**
 * AJOUTER UN EXERCICE — la fiche (lib/exercise-sheets.ts).
 *
 * Un exercice est relié à une matière, un chapitre du programme, une
 * compétence et une difficulté. Il dit d'où il vient :
 *
 *   IA       exercice original — pas de source ;
 *   externe  ressource trouvée ailleurs — sa SOURCE (et son lien, s'il y en
 *            a un) est obligatoire et conservée.
 *
 * L'énoncé est obligatoire ; indices et correction sont facultatifs, et ne
 * seront montrés qu'APRÈS l'énoncé, à la demande, dans le lecteur.
 */
export function SheetForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: { subject?: Subject; chapterId?: string; level?: ExerciseLevel };
  onSave: (sheet: ExerciseSheet) => boolean;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<SheetDraft>(() => {
    const chapter = initial?.chapterId ? PROGRAMME_BY_ID.get(initial.chapterId) : undefined;
    return { ...EMPTY_DRAFT, subject: chapter?.subject ?? initial?.subject ?? "", chapterId: chapter?.id ?? "", level: initial?.level ?? "" };
  });
  const [issues, setIssues] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);

  const chapters = useMemo(() => PROGRAMME.filter((chapter) => chapter.subject === draft.subject), [draft.subject]);
  const chapter = PROGRAMME_BY_ID.get(draft.chapterId);
  const request = draft.subject && chapter && draft.level ? exerciseRequest({ subject: draft.subject, chapter: chapter.title, level: draft.level }) : null;

  function update(patch: Partial<SheetDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setIssues([]);
    setFailed(false);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const problems = sheetIssues(draft);
    setIssues(problems);
    if (problems.length > 0) return;
    const sheet = createSheet(draft, new Date());
    if (!sheet) return;
    if (!onSave(sheet)) setFailed(true);
  }

  return (
    <form onSubmit={submit} className="surface space-y-5 p-5 sm:p-6" aria-label="Ajouter un exercice">
      <div>
        <h2 className="t-subhead">Ajouter un exercice</h2>
        <p className="t-meta mt-0.5">L&apos;énoncé sera montré en premier ; les indices et la correction, seulement à ta demande.</p>
      </div>

      <div>
        <p className="t-label">D&apos;où vient-il ?</p>
        <SegmentedControl ariaLabel="Origine de l'exercice" className="mt-1.5" options={ORIGIN_OPTIONS} value={draft.origin as SheetOrigin} onChange={(origin) => update({ origin })} />
        <p className="t-meta mt-1.5 text-2xs">
          {draft.origin === "externe"
            ? `${SHEET_ORIGIN_LABEL.externe} : un concours, un TD, un site. Sa source est conservée avec l'exercice.`
            : draft.origin === "ia"
              ? `${SHEET_ORIGIN_LABEL.ia} : un énoncé neuf, sans source.`
              : "Choisis l'origine : on ne présente jamais un énoncé trouvé ailleurs comme un exercice original."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="sheet-subject" label="Matière">
          <Select id="sheet-subject" value={draft.subject} onChange={(event) => update({ subject: event.target.value as Subject | "", chapterId: "" })}>
            <option value="">Choisir…</option>
            {subjects.map((subject) => (
              <option key={subject} value={subject}>
                {subject}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="sheet-chapter" label="Chapitre du programme">
          <Select id="sheet-chapter" value={draft.chapterId} disabled={!draft.subject} onChange={(event) => update({ chapterId: event.target.value })}>
            <option value="">{draft.subject ? "Choisir…" : "Choisis d'abord la matière"}</option>
            {chapters.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="sheet-notion" label="Notion précise (facultatif)" hint="Dans le chapitre : « polynôme annulateur », « intégrale à paramètre »…">
          <Input id="sheet-notion" value={draft.notion} maxLength={NOTION_MAX} onChange={(event) => update({ notion: event.target.value })} />
        </Field>
        <Field id="sheet-minutes" label="Durée prévue, en minutes (facultatif)">
          <Input id="sheet-minutes" inputMode="numeric" value={draft.estimatedMinutes} onChange={(event) => update({ estimatedMinutes: event.target.value })} placeholder="30" />
        </Field>
      </div>

      <Field id="sheet-competence" label="Compétence visée" hint="Ce que cet exercice t'entraîne à faire, en une phrase.">
        <Input id="sheet-competence" value={draft.competence} maxLength={COMPETENCE_MAX} onChange={(event) => update({ competence: event.target.value })} placeholder="Justifier l'interversion série-intégrale" />
      </Field>

      <div>
        <p className="t-label">Difficulté</p>
        <SegmentedControl ariaLabel="Difficulté" className="mt-1.5" options={LEVEL_OPTIONS} value={draft.level as ExerciseLevel} onChange={(level) => update({ level })} />
        <p className="t-meta mt-1.5 text-2xs">{draft.level ? EXERCISE_LEVEL_LABEL[draft.level] : "Choisis la difficulté."}</p>
      </div>

      {draft.origin === "externe" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="sheet-source" label="Source" hint="Concours et année, TD, livre, site…">
            <Input id="sheet-source" value={draft.sourceName} maxLength={SOURCE_NAME_MAX} onChange={(event) => update({ sourceName: event.target.value })} placeholder="Centrale-Supélec 2022, Maths 1" />
          </Field>
          <Field id="sheet-url" label="Lien (facultatif)" hint="Commence par https://. Laisse vide pour un sujet papier.">
            <Input id="sheet-url" inputMode="url" value={draft.sourceUrl} onChange={(event) => update({ sourceUrl: event.target.value })} placeholder="https://…" />
          </Field>
        </div>
      )}

      <Field id="sheet-statement" label="Énoncé" hint="Colle l'énoncé complet. Il sera la première chose affichée.">
        <Textarea id="sheet-statement" rows={8} value={draft.statement} maxLength={STATEMENT_MAX + 200} onChange={(event) => update({ statement: event.target.value })} />
      </Field>

      <div>
        <p className="t-label">Indices (facultatif)</p>
        <p className="t-meta mt-0.5 text-2xs">Du plus discret au plus révélateur. Chacun ouvert est compté : l&apos;essai sera noté « avec indices ».</p>
        <div className="mt-1.5 space-y-2">
          {draft.hints.map((hint, index) => (
            <div key={index} className="flex items-start gap-2">
              <Textarea
                aria-label={`Indice ${index + 1}`}
                rows={2}
                value={hint}
                maxLength={HINT_MAX + 100}
                onChange={(event) => update({ hints: draft.hints.map((entry, position) => (position === index ? event.target.value : entry)) })}
                className="flex-1"
              />
              <Button type="button" variant="ghost" size="icon" aria-label={`Retirer l'indice ${index + 1}`} onClick={() => update({ hints: draft.hints.filter((_, position) => position !== index) })}>
                <X size={16} aria-hidden />
              </Button>
            </div>
          ))}
          {draft.hints.length < HINTS_MAX && (
            <Button type="button" variant="secondary" size="sm" onClick={() => update({ hints: [...draft.hints, ""] })}>
              <Plus size={14} aria-hidden /> Ajouter un indice
            </Button>
          )}
        </div>
      </div>

      <Field id="sheet-correction" label="Correction (facultatif)" hint="Elle reste cachée tant que tu ne la demandes pas — et l'ouvrir pendant l'essai l'empêche d'être noté « sans aide ».">
        <Textarea id="sheet-correction" rows={5} value={draft.correction} maxLength={CORRECTION_MAX + 200} onChange={(event) => update({ correction: event.target.value })} />
      </Field>

      {request && draft.origin === "ia" && (
        <div className="rounded-2xl bg-inset p-4">
          <p className="t-label">Pas encore d&apos;énoncé ?</p>
          <p className="t-meta mt-0.5 text-2xs">Demande-le à Claude (correction gardée pour après ton essai), puis colle-le ici.</p>
          <CopyRequest text={request} className="mt-1.5" />
        </div>
      )}

      {issues.length > 0 && (
        <Notice tone="danger" title="Pas enregistré">
          <ul className="list-disc pl-4">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </Notice>
      )}
      {failed && (
        <Notice tone="danger" title="Écriture refusée">
          Le stockage de cet appareil est plein ou bloqué : l&apos;exercice n&apos;a pas été enregistré.
        </Notice>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit">Enregistrer et commencer</Button>
      </div>
    </form>
  );
}
