"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  FileText,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Meter } from "@/components/ui/progress";
import { Section } from "@/components/ui/section";
import { Notice } from "@/components/ui/state";
import { MathInline, RichMath } from "@/components/rich-math";
import { getChaptersForSubject } from "@/lib/chapters";
import { extractExercises, extractFromText } from "@/lib/import/detect";
import { findDuplicate, type DuplicateMatch } from "@/lib/import/duplicates";
import {
  buildSource,
  externalIdFor,
  fingerprint,
  suggestChapter,
  suggestDifficulty,
  toImportRows,
  type DraftOverrides,
  type SheetMetadata,
} from "@/lib/import/sheet";
import type { SheetExercise } from "@/lib/import/types";
import { parseExerciseImportPayload } from "@/lib/exercise-import";
import type { NewExerciseInput } from "@/components/exercises/exercise-form";
import type { Chapter } from "@/lib/storage";
import { exerciseTypes, subjects } from "@/lib/study";
import type { Difficulty, Exercise, ExerciseType, Subject } from "@/lib/supabase/types";

/**
 * IMPORT D'UNE FEUILLE D'EXERCICES.
 *
 * Trois temps, dans cet ordre et jamais un autre : **déposer**, **vérifier**,
 * **ajouter**. Aucun exercice n'entre dans la banque avant que l'élève ait vu
 * ce qui a été détecté et validé chaque ligne — c'est la même règle que
 * l'import JSON et que la sauvegarde.
 *
 * Ce composant ne fabrique aucun exercice lui-même : il produit les lignes
 * d'import que `parseExerciseImportPayload` valide déjà, lesquelles passent par
 * `createExerciseFromInput`. Un exercice venu d'un PDF est donc identique, à
 * tous les champs, à un exercice saisi à la main — le lecteur, le
 * chronomètre, les indices et l'historique ne font aucune différence entre
 * eux, parce qu'il n'y en a aucune.
 */

const MAX_BYTES = 25 * 1024 * 1024;

type Phase = "dépôt" | "analyse" | "aperçu";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function SheetImport({
  open,
  chapters,
  existing,
  onCommit,
  onCreateChapter,
  onCancel,
}: {
  open: boolean;
  chapters: Chapter[];
  existing: Exercise[];
  onCommit: (inputs: NewExerciseInput[]) => void;
  onCreateChapter: (subject: Subject, label: string) => Chapter;
  onCancel: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("dépôt");
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasted, setPasted] = useState("");

  const [detected, setDetected] = useState<SheetExercise[]>([]);
  const [overrides, setOverrides] = useState<DraftOverrides[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [sheetPrint, setSheetPrint] = useState("");
  const [metadata, setMetadata] = useState<SheetMetadata>({
    subject: "Mathématiques",
    chapterLabel: "",
    sheetName: "",
    origin: "",
    year: String(new Date().getFullYear()),
    type: "TD" as ExerciseType,
    tags: [],
  });

  const reset = useCallback(() => {
    setPhase("dépôt");
    setFile(null);
    setDetected([]);
    setOverrides([]);
    setError(null);
    setExpanded(null);
    setPasted("");
    setPasteMode(false);
    setProgress({ done: 0, total: 0 });
  }, []);

  /** Prépare l'aperçu : un réglage par exercice, pré-rempli mais entièrement modifiable. */
  const prepare = useCallback(
    (exercises: SheetExercise[], print: string, sheetName: string, subject: Subject) => {
      setDetected(exercises);
      setSheetPrint(print);
      setOverrides(
        exercises.map((exercise) => ({
          include: true,
          title: exercise.title,
          statement: exercise.statement,
          chapterLabel: suggestChapter(exercise, chapters, subject),
          difficulty: suggestDifficulty(exercise),
          force: false,
        }))
      );
      setMetadata((current) => ({ ...current, sheetName: current.sheetName || sheetName }));
      setPhase("aperçu");
    },
    [chapters]
  );

  const analyseFile = useCallback(
    async (chosen: File) => {
      setError(null);
      if (!/\.pdf$/i.test(chosen.name) && chosen.type !== "application/pdf") {
        setError("Ce fichier n'est pas un PDF. Choisis un PDF, ou colle le texte de la feuille ci-dessous.");
        return;
      }
      if (chosen.size > MAX_BYTES) {
        setError(`Ce fichier fait ${formatSize(chosen.size)} : c'est trop lourd pour être analysé dans le navigateur (limite 25 Mo).`);
        return;
      }
      setFile({ name: chosen.name, size: chosen.size });
      setPhase("analyse");
      setProgress({ done: 0, total: 0 });
      try {
        // pdf.js n'est chargé qu'ici : il ne pèse sur aucune autre page.
        const { readPdf } = await import("@/lib/import/pdf-source");
        const buffer = await chosen.arrayBuffer();
        const pages = await readPdf(buffer, {
          onProgress: (done, total) => setProgress({ done, total }),
        });
        const result = extractExercises(pages);
        if (result.scanned || !result.exercises.length) {
          setPhase("dépôt");
          setError(
            "Cette feuille ne contient pas de texte : c'est une image (feuille scannée ou photographiée). TaekdHub ne sait pas la lire. Copie le texte de la feuille et colle-le ci-dessous."
          );
          setPasteMode(true);
          return;
        }
        const name = chosen.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim();
        prepare(result.exercises, fingerprint(`${chosen.name}:${chosen.size}:${result.header}`), name, metadata.subject);
      } catch {
        setPhase("dépôt");
        setError("Ce PDF n'a pas pu être ouvert : il est peut-être protégé par un mot de passe ou endommagé. Tu peux coller le texte de la feuille ci-dessous.");
        setPasteMode(true);
      }
    },
    [metadata.subject, prepare]
  );

  const analysePasted = useCallback(() => {
    setError(null);
    const result = extractFromText(pasted);
    if (!result.exercises.length) {
      setError("Aucun exercice n'a été trouvé dans ce texte.");
      return;
    }
    setFile(null);
    prepare(result.exercises, fingerprint(pasted.slice(0, 400)), "", metadata.subject);
  }, [pasted, metadata.subject, prepare]);

  /** Doublons : comparés au contenu de la banque, exercice par exercice, avant toute écriture. */
  const duplicates = useMemo(() => {
    if (phase !== "aperçu") return new Map<number, DuplicateMatch>();
    const found = new Map<number, DuplicateMatch>();
    overrides.forEach((override, index) => {
      const match = findDuplicate(override.statement, existing);
      if (match) found.set(index, match);
    });
    return found;
  }, [phase, overrides, existing]);

  const patch = useCallback((index: number, change: Partial<DraftOverrides>) => {
    setOverrides((current) => current.map((entry, position) => (position === index ? { ...entry, ...change } : entry)));
  }, []);

  const chapterChoices = useMemo(() => getChaptersForSubject(chapters, metadata.subject), [chapters, metadata.subject]);

  /** Ce qui sera réellement écrit — recalculé à chaque changement, jamais deviné au moment du clic. */
  const plan = useMemo(() => {
    if (phase !== "aperçu") return null;
    const rows = toImportRows(detected, overrides, metadata, sheetPrint);
    const parsed = parseExerciseImportPayload(rows, chapters, existing);
    const newChapters = new Map<string, { subject: Subject; label: string }>();
    for (const row of parsed.rows) {
      if (row.isNewChapter && row.chapterLabel) {
        newChapters.set(`${row.input.subject}::${row.chapterLabel.toLowerCase()}`, {
          subject: row.input.subject,
          label: row.chapterLabel,
        });
      }
    }
    return { ...parsed, newChapters };
  }, [phase, detected, overrides, metadata, sheetPrint, chapters, existing]);

  const selected = overrides.filter((override) => override.include).length;

  function commit() {
    if (!plan || !plan.rows.length) return;
    // Les chapitres manquants sont créés d'abord, puis les exercices sont
    // écrits EN UNE SEULE FOIS (voir `importExercises`) : soit toute la
    // sélection entre, soit rien. Aucun état intermédiaire n'est enregistré.
    const created = new Map<string, string>();
    for (const [key, { subject, label }] of plan.newChapters) created.set(key, onCreateChapter(subject, label).id);
    const inputs = plan.rows.map((row) => {
      if (!row.isNewChapter || !row.chapterLabel) return row.input;
      return { ...row.input, chapterId: created.get(`${row.input.subject}::${row.chapterLabel.toLowerCase()}`) ?? null };
    });
    onCommit(inputs);
    reset();
  }

  if (!open) return null;

  return (
    <Section
      variant="panel"
      label="Importer une feuille"
      title="D'un PDF à des exercices travaillables"
      description="Dépose la feuille, vérifie ce qui a été détecté, ajoute ce qui te convient. Rien n'entre dans ta banque avant ta validation."
      action={
        <Button variant="ghost" size="sm" onClick={() => { reset(); onCancel(); }}>
          Fermer
        </Button>
      }
      className="space-y-5"
    >
      <div className="space-y-5">
        {error && (
          <Notice tone="warning" title="Cette feuille n'a pas pu être analysée">
            {error}
          </Notice>
        )}

        {/* ── 1. DÉPÔT ─────────────────────────────────────────────── */}
        {phase === "dépôt" && (
          <div className="space-y-4">
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                const dropped = event.dataTransfer.files?.[0];
                if (dropped) void analyseFile(dropped);
              }}
              className={`rounded-2xl border border-dashed px-6 py-10 text-center transition-colors ${
                dragging ? "border-accent bg-accent/[0.06]" : "border-line"
              }`}
            >
              <Upload size={22} aria-hidden className="mx-auto text-subtle" />
              <p className="t-subhead mt-3">Dépose ta feuille ici</p>
              <p className="t-meta mx-auto mt-1 max-w-[42ch]">Un PDF contenant du texte — une feuille de TD, un DM, un sujet de colle.</p>
              <Button className="mt-4" onClick={() => fileInput.current?.click()}>
                Choisir un fichier PDF
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                aria-label="Choisir une feuille d'exercices au format PDF"
                onChange={(event) => {
                  const chosen = event.target.files?.[0];
                  event.target.value = "";
                  if (chosen) void analyseFile(chosen);
                }}
              />
            </div>

            <div>
              <button
                type="button"
                onClick={() => setPasteMode((value) => !value)}
                aria-expanded={pasteMode}
                className="row-hover t-meta inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-ink"
              >
                <ChevronDown size={14} aria-hidden className={pasteMode ? "rotate-180 transition-transform" : "transition-transform"} />
                Pas de PDF, ou feuille scannée ? Colle le texte à la main.
              </button>
              {pasteMode && (
                <div className="mt-2 space-y-2">
                  <Textarea
                    value={pasted}
                    onChange={(event) => setPasted(event.target.value)}
                    rows={8}
                    aria-label="Texte de la feuille d'exercices"
                    placeholder={"Exercice 1. Suites récurrentes\nMontrer que la suite est croissante.\n\nExercice 2\nCalculer l'intégrale."}
                    className="font-mono text-xs"
                  />
                  <p className="t-meta">
                    Une ligne commençant par « Exercice » ou « Problème » ouvre un nouvel exercice. Les formules s&apos;écrivent entre
                    dollars : <span className="font-mono">$x^2$</span>.
                  </p>
                  <Button variant="secondary" onClick={analysePasted} disabled={!pasted.trim()}>
                    Analyser ce texte
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 2. ANALYSE ───────────────────────────────────────────── */}
        {phase === "analyse" && (
          <div className="space-y-3 py-6" aria-live="polite">
            <p className="t-subhead flex items-center gap-2">
              <Loader2 size={16} aria-hidden className="animate-spin text-accent" />
              Lecture de {file?.name}
            </p>
            <Meter value={progress.total ? (progress.done / progress.total) * 100 : 8} />
            <p className="t-meta">
              {progress.total ? `Page ${progress.done} sur ${progress.total}` : "Ouverture du document…"}
            </p>
          </div>
        )}

        {/* ── 3. APERÇU ────────────────────────────────────────────── */}
        {phase === "aperçu" && plan && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <p className="t-subhead">
                {detected.length} exercice{detected.length > 1 ? "s" : ""} détecté{detected.length > 1 ? "s" : ""}
              </p>
              {file && (
                <p className="t-meta flex items-center gap-1.5">
                  <FileText size={13} aria-hidden />
                  {file.name} · {formatSize(file.size)}
                </p>
              )}
              <Button variant="ghost" size="sm" onClick={reset} className="ml-auto">
                <Trash2 size={14} /> Changer de feuille
              </Button>
            </div>

            {/* Réglages COMMUNS : saisis une fois, valables pour toute la feuille. */}
            <fieldset className="space-y-3">
              <legend className="t-label">Cette feuille</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="t-meta">Nom de la feuille</span>
                  <Input
                    value={metadata.sheetName}
                    onChange={(event) => setMetadata({ ...metadata, sheetName: event.target.value })}
                    placeholder="Feuille 4 — Intégrales"
                  />
                </label>
                <label className="space-y-1">
                  <span className="t-meta">D&apos;où elle vient</span>
                  <Input
                    value={metadata.origin}
                    onChange={(event) => setMetadata({ ...metadata, origin: event.target.value })}
                    placeholder="Lycée Jean Perrin — M. Dupont"
                  />
                </label>
                <label className="space-y-1">
                  <span className="t-meta">Année</span>
                  <Input
                    value={metadata.year}
                    inputMode="numeric"
                    onChange={(event) => setMetadata({ ...metadata, year: event.target.value })}
                    placeholder="2026"
                  />
                </label>
                <label className="space-y-1">
                  <span className="t-meta">Matière</span>
                  <Select
                    value={metadata.subject}
                    onChange={(event) => setMetadata({ ...metadata, subject: event.target.value as Subject })}
                  >
                    {subjects.map((subject) => (
                      <option key={subject} value={subject}>
                        {subject}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="space-y-1">
                  <span className="t-meta">Type</span>
                  <Select
                    value={metadata.type}
                    onChange={(event) => setMetadata({ ...metadata, type: event.target.value as ExerciseType })}
                  >
                    {exerciseTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="space-y-1">
                  <span className="t-meta">Étiquettes (séparées par des virgules)</span>
                  <Input
                    value={metadata.tags.join(", ")}
                    onChange={(event) =>
                      setMetadata({ ...metadata, tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean) })
                    }
                    placeholder="intégrales, suites"
                  />
                </label>
              </div>
              <p className="t-meta">
                Source enregistrée : <span className="text-ink">{buildSource(metadata) || "— renseigne au moins le nom de la feuille"}</span>
              </p>
            </fieldset>

            {/* Les exercices, un par un. */}
            <ul className="divide-y divide-line border-y border-line">
              {detected.map((exercise, index) => {
                const override = overrides[index];
                const duplicate = duplicates.get(index);
                const isOpen = expanded === index;
                return (
                  <li key={index} className="py-3">
                    <div className="flex items-start gap-1">
                      {/* La case fait 16 px — c'est sa taille dessinée. Sa zone
                          CLIQUABLE, elle, doit atteindre 44 px au doigt : d'où
                          le label qui l'entoure plutôt qu'une case agrandie,
                          qui jurerait avec le reste des contrôles. */}
                      <label className="-ml-1.5 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center">
                        <input
                          type="checkbox"
                          checked={override.include}
                          onChange={(event) => patch(index, { include: event.target.checked })}
                          aria-label={`Importer « ${override.title} »`}
                          className="h-4 w-4 accent-[rgb(var(--accent-rgb))]"
                        />
                      </label>
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => setExpanded(isOpen ? null : index)}
                          aria-expanded={isOpen}
                          /* Pas de marge négative ici : mesurée à 390 px, elle
                             rendait la rangée 8 px plus large que la colonne et
                             faisait déborder toute la liste. */
                          className="row-hover flex min-h-11 w-full items-center gap-2 rounded-lg px-1 text-left"
                        >
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                            <MathInline text={override.title} />
                          </span>
                          {exercise.number && <Badge className="shrink-0">n° {exercise.number}</Badge>}
                          {exercise.pages.length > 1 && (
                            <Badge className="shrink-0">p. {exercise.pages.join("–")}</Badge>
                          )}
                          {duplicate && (
                            <Badge variant="warning" className="shrink-0">
                              {duplicate.kind === "identique" ? "déjà dans la banque" : "très proche d'un existant"}
                            </Badge>
                          )}
                          {!duplicate && exercise.warnings.length > 0 && (
                            <Badge variant="warning" className="shrink-0">
                              à vérifier
                            </Badge>
                          )}
                          <ChevronDown
                            size={14}
                            aria-hidden
                            className={`shrink-0 text-subtle transition-transform ${isOpen ? "rotate-180" : ""}`}
                          />
                        </button>

                        {!isOpen && (
                          <p className="t-meta mt-0.5 line-clamp-2">{override.statement.replace(/\s+/g, " ").slice(0, 180)}</p>
                        )}

                        {exercise.warnings.map((warning) => (
                          <p key={warning} className="t-meta mt-1 flex items-start gap-1.5 text-amber-500">
                            <AlertTriangle size={12} aria-hidden className="mt-1 shrink-0" />
                            {warning}
                          </p>
                        ))}

                        {duplicate && (
                          <div className="mt-2 rounded-lg bg-inset px-3 py-2">
                            <p className="t-meta">
                              Ressemble à <span className="text-ink">{duplicate.title}</span>, déjà dans ta banque
                              {duplicate.kind === "proche" && ` (${Math.round(duplicate.similarity * 100)} % de ressemblance)`}.
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant={!override.include ? "primary" : "secondary"}
                                onClick={() => patch(index, { include: false, force: false })}
                              >
                                Ignorer
                              </Button>
                              <Button
                                size="sm"
                                variant={override.include && override.force ? "primary" : "secondary"}
                                onClick={() => patch(index, { include: true, force: true })}
                              >
                                C&apos;est un autre exercice, importe-le
                              </Button>
                            </div>
                          </div>
                        )}

                        {isOpen && (
                          <div className="mt-3 space-y-3">
                            <label className="block space-y-1">
                              <span className="t-meta">Titre</span>
                              <Input value={override.title} onChange={(event) => patch(index, { title: event.target.value })} />
                            </label>
                            <label className="block space-y-1">
                              <span className="t-meta">Énoncé</span>
                              <Textarea
                                value={override.statement}
                                rows={8}
                                onChange={(event) => patch(index, { statement: event.target.value })}
                                className="font-mono text-xs"
                              />
                            </label>
                            <div className="well rounded-lg p-3">
                              <p className="t-label mb-1.5">Aperçu</p>
                              <RichMath text={override.statement} className="t-read-quiet text-muted" />
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <label className="space-y-1">
                                <span className="t-meta">Chapitre</span>
                                <Input
                                  value={override.chapterLabel}
                                  list="sheet-import-chapters"
                                  onChange={(event) => patch(index, { chapterLabel: event.target.value })}
                                  placeholder="Sans chapitre"
                                />
                              </label>
                              <label className="space-y-1">
                                <span className="t-meta">Difficulté</span>
                                <Select
                                  value={String(override.difficulty)}
                                  onChange={(event) => patch(index, { difficulty: Number(event.target.value) as Difficulty })}
                                >
                                  {[1, 2, 3, 4, 5].map((level) => (
                                    <option key={level} value={level}>
                                      {level} / 5
                                    </option>
                                  ))}
                                </Select>
                              </label>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <datalist id="sheet-import-chapters">
              {chapterChoices.map((chapter) => (
                <option key={chapter.id} value={chapter.label} />
              ))}
            </datalist>

            {plan.errors.length > 0 && (
              <Notice tone="warning" title={`${plan.errors.length} exercice${plan.errors.length > 1 ? "s ne seront pas ajoutés" : " ne sera pas ajouté"}`}>
                <ul className="space-y-1">
                  {plan.errors.slice(0, 5).map((entry) => (
                    <li key={entry.index}>{entry.message}</li>
                  ))}
                </ul>
              </Notice>
            )}

            {plan.duplicates.length > 0 && (
              <Notice tone="info" title={`${plan.duplicates.length} exercice${plan.duplicates.length > 1 ? "s déjà présents" : " déjà présent"}`}>
                Ils ne seront pas ajoutés une seconde fois. Rien de ce qui existe n&apos;est modifié.
              </Notice>
            )}

            {plan.newChapters.size > 0 && (
              <p className="t-meta">
                {plan.newChapters.size} chapitre{plan.newChapters.size > 1 ? "s seront créés" : " sera créé"} :{" "}
                {[...plan.newChapters.values()].map((chapter) => chapter.label).join(", ")}.
              </p>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
              <p className="t-meta mr-auto">
                {selected} sur {detected.length} sélectionné{selected > 1 ? "s" : ""}
                {plan.rows.length !== selected && ` · ${plan.rows.length} prêt${plan.rows.length > 1 ? "s" : ""} à être ajouté${plan.rows.length > 1 ? "s" : ""}`}
              </p>
              <Button variant="ghost" onClick={() => { reset(); onCancel(); }}>
                Annuler
              </Button>
              <Button onClick={commit} disabled={plan.rows.length === 0}>
                <CheckCircle2 size={15} />
                Ajouter {plan.rows.length} exercice{plan.rows.length > 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}

export { externalIdFor };
