"use client";

import { AlertTriangle, CheckCircle2, Download, FileJson } from "lucide-react";
import { ChangeEvent, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { NewExerciseInput } from "@/components/exercises/exercise-form";
import { downloadExerciseImportTemplate, parseExerciseImportPayload, type ExerciseImportRowError, type ParsedImportRow } from "@/lib/exercise-import";
import type { Chapter } from "@/lib/storage";
import type { Exercise, Subject } from "@/lib/supabase/types";

/**
 * Import en masse (Sprint infrastructure banque) — même esprit que
 * `DataBackup` (components/data-backup.tsx) : rien n'est écrit tant que
 * l'utilisateur n'a pas vu et confirmé l'aperçu. Toute la validation vit
 * dans lib/exercise-import.ts ; ce composant se contente d'afficher le
 * résultat et de résoudre les nouveaux chapitres à la confirmation.
 */
export function ExerciseImport({
  open,
  chapters,
  existing,
  onCommit,
  onCreateChapter,
  onCancel,
}: {
  open: boolean;
  chapters: Chapter[];
  /** Banque actuelle — sert uniquement à repérer ce qui est déjà importé. */
  existing: Exercise[];
  onCommit: (inputs: NewExerciseInput[]) => void;
  onCreateChapter: (subject: Subject, label: string) => Chapter;
  onCancel: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [rows, setRows] = useState<ParsedImportRow[]>([]);
  const [errors, setErrors] = useState<ExerciseImportRowError[]>([]);
  const [parsed, setParsed] = useState(false);
  const [duplicates, setDuplicates] = useState<ExerciseImportRowError[]>([]);

  function reset() {
    setText("");
    setRows([]);
    setErrors([]);
    setDuplicates([]);
    setParsed(false);
  }

  function parse(raw: string) {
    setText(raw);
    if (!raw.trim()) {
      setRows([]);
      setErrors([]);
      setParsed(false);
      return;
    }
    try {
      const json = JSON.parse(raw);
      const result = parseExerciseImportPayload(json, chapters, existing);
      setRows(result.rows);
      setErrors(result.errors);
      setDuplicates(result.duplicates);
      setParsed(true);
    } catch {
      setRows([]);
      setErrors([{ index: 0, message: "JSON invalide — vérifie la syntaxe du fichier (virgules, guillemets, crochets)." }]);
      setParsed(true);
    }
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => parse(String(reader.result));
    reader.readAsText(file);
  }

  // Un même chapitre (matière + libellé, insensible à la casse) peut être
  // référencé par plusieurs lignes : dédoublonné ici pour n'être créé qu'une
  // seule fois à la confirmation, jamais une fois par ligne.
  const newChapters = new Map<string, { subject: Subject; label: string }>();
  for (const row of rows) {
    if (row.isNewChapter && row.chapterLabel) {
      newChapters.set(`${row.input.subject}::${row.chapterLabel.toLowerCase()}`, { subject: row.input.subject, label: row.chapterLabel });
    }
  }

  function commit() {
    const createdIds = new Map<string, string>();
    for (const [key, { subject, label }] of newChapters) {
      createdIds.set(key, onCreateChapter(subject, label).id);
    }
    const inputs = rows.map((row) => {
      if (!row.isNewChapter || !row.chapterLabel) return row.input;
      const key = `${row.input.subject}::${row.chapterLabel.toLowerCase()}`;
      return { ...row.input, chapterId: createdIds.get(key) ?? null };
    });
    onCommit(inputs);
    reset();
  }

  function cancel() {
    reset();
    onCancel();
  }

  // Panneau simplement affiché/masqué (pas d'AnimatePresence ici) : avec un
  // enfant unique dont l'état interne se réinitialise dans le même geste que
  // sa fermeture (voir `commit`/`cancel` ci-dessus), l'animation de sortie de
  // framer-motion ne se terminait jamais dans cette combinaison précise —
  // reproduit et confirmé en isolant le composant. Un panneau utilitaire
  // (pas la séance/le focus) n'a de toute façon pas besoin de cette
  // transition pour rester agréable à utiliser.
  if (!open) return null;

  return (
    <div className="surface space-y-4 rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Import en masse</p>
          <h2 className="mt-1 text-lg font-semibold">Ajoute plusieurs exercices à la fois.</h2>
          <p className="mt-1 text-sm leading-6 text-zinc-500">
            Colle ou importe un fichier JSON (un tableau, un objet par exercice). Rien n&apos;est ajouté avant ta confirmation ci-dessous.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={downloadExerciseImportTemplate} className="shrink-0">
          <Download size={15} /> Modèle
        </Button>
      </div>

      <textarea
        value={text}
        onChange={(event) => parse(event.target.value)}
        placeholder={'[\n  { "title": "…", "source": "…", "subject": "Mathématiques" }\n]'}
        rows={7}
        spellCheck={false}
        className="focus-ring w-full rounded-xl border border-hairline/[0.09] bg-inset p-3 font-mono text-xs leading-6 text-zinc-200 placeholder:text-zinc-600"
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="sm" onClick={() => fileInput.current?.click()}>
          <FileJson size={15} /> Choisir un fichier .json
        </Button>
        <input ref={fileInput} type="file" accept="application/json" onChange={handleFile} className="hidden" />
        {parsed && (
          <span className="text-xs text-zinc-500">
            {rows.length} exercice{rows.length > 1 ? "s" : ""} valide{rows.length > 1 ? "s" : ""}
            {errors.length > 0 && ` · ${errors.length} ligne${errors.length > 1 ? "s" : ""} en erreur`}
            {duplicates.length > 0 && ` · ${duplicates.length} déjà présent${duplicates.length > 1 ? "s" : ""}`}
          </span>
        )}
      </div>

      {errors.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-200">
            <AlertTriangle size={14} /> {errors.length} ligne{errors.length > 1 ? "s" : ""} ignorée{errors.length > 1 ? "s" : ""}
          </div>
          <ul className="mt-2 space-y-1 text-xs leading-5 text-zinc-400">
            {errors.slice(0, 8).map((error, index) => (
              <li key={index}>{error.message}</li>
            ))}
            {errors.length > 8 && <li>… et {errors.length - 8} de plus.</li>}
          </ul>
        </div>
      )}

      {/* Les doublons ne sont pas des erreurs : le fichier est valide, ces
          exercices sont simplement déjà là. On le dit dans un ton neutre,
          séparément, pour que l'élève sache que rien n'a été perdu. */}
      {duplicates.length > 0 && (
        <div className="rounded-xl border border-hairline/[0.09] bg-hairline/[0.025] p-3.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
            <FileJson size={14} /> {duplicates.length} exercice{duplicates.length > 1 ? "s" : ""} déjà dans ta banque
            {duplicates.length > 1 ? " — non réimportés" : " — non réimporté"}
          </div>
          <ul className="mt-2 space-y-1 text-xs leading-5 text-zinc-500">
            {duplicates.slice(0, 5).map((entry, index) => (
              <li key={index}>{entry.message}</li>
            ))}
            {duplicates.length > 5 && <li>… et {duplicates.length - 5} de plus.</li>}
          </ul>
        </div>
      )}

      {rows.length > 0 && (
        <div className="space-y-2.5">
          {newChapters.size > 0 && (
            <p className="text-xs text-zinc-500">
              {newChapters.size} nouveau{newChapters.size > 1 ? "x" : ""} chapitre{newChapters.size > 1 ? "s" : ""} sera{newChapters.size > 1 ? "ont" : ""}{" "}
              créé{newChapters.size > 1 ? "s" : ""} : {[...newChapters.values()].map((c) => c.label).join(", ")}.
            </p>
          )}
          <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
            {rows.slice(0, 50).map((row) => (
              <div key={row.index} className="flex items-center gap-2.5 rounded-lg border border-hairline/[0.07] px-3 py-2 text-sm">
                <CheckCircle2 size={14} className="shrink-0 text-accent" />
                <span className="min-w-0 flex-1 truncate font-medium text-zinc-100">{row.input.title}</span>
                <Badge className="shrink-0">{row.input.subject}</Badge>
                {row.input.competition && (
                  <Badge variant="accent" className="shrink-0">
                    {row.input.competition}
                    {row.input.year ? ` ${row.input.year}` : ""}
                  </Badge>
                )}
                {row.input.licenseStatus === "à vérifier" && (
                  <Badge variant="warning" className="shrink-0">
                    licence à vérifier
                  </Badge>
                )}
                {row.input.programmeLevel === "spe" && (
                  <Badge variant="warning" className="shrink-0">
                    Spé — archivé
                  </Badge>
                )}
                {row.isNewChapter && row.chapterLabel && (
                  <Badge variant="warning" className="shrink-0">
                    + {row.chapterLabel}
                  </Badge>
                )}
              </div>
            ))}
            {rows.length > 50 && <p className="px-3 py-1 text-xs text-zinc-500">… et {rows.length - 50} de plus.</p>}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={cancel}>
          Annuler
        </Button>
        <Button onClick={commit} disabled={rows.length === 0}>
          {rows.length > 0 ? `Importer ${rows.length} exercice${rows.length > 1 ? "s" : ""}` : "Importer"}
        </Button>
      </div>
    </div>
  );
}
