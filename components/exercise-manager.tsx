"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Archive, BookOpenCheck, ChevronDown, Clock3, Eye, EyeOff, Filter, Heart, Maximize2, Minimize2, Plus, Search, Star, X } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { exerciseStatuses, subjects, subjectMeta } from "@/lib/study";
import { cn } from "@/lib/cn";
import type { Difficulty, Exercise, ExerciseStatus, Subject } from "@/lib/supabase/types";

const emptyForm = { subject: "Mathématiques" as Subject, chapter: "", source: "", difficulty: 3, note: "", tags: "", hints: "", correction: "" };

function DifficultyDots({ value }: { value: Difficulty }) {
  return (
    <span aria-label={`Difficulté ${value} sur 5`} className="inline-flex gap-1">
      {Array.from({ length: 5 }, (_, index) => (
        <span key={index} className={cn("h-1.5 w-4 rounded-full", index < value ? "bg-accent" : "bg-zinc-800")} />
      ))}
    </span>
  );
}

export function ExerciseManager() {
  const { exercises, saveExercises } = usePrepahubData();
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState<Subject | "Toutes">("Toutes");
  const [status, setStatus] = useState<ExerciseStatus | "Tous">("Tous");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const persist = useCallback(
    (next: Exercise[]) => saveExercises(next),
    [saveExercises]
  );

  const update = useCallback(
    (id: string, patch: Partial<Exercise>) => {
      persist(exercises.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    },
    [exercises, persist]
  );

  function create(event: FormEvent) {
    event.preventDefault();
    if (!form.chapter.trim() || !form.source.trim()) return;
    const exercise: Exercise = {
      id: crypto.randomUUID(),
      subject: form.subject,
      chapter: form.chapter.trim(),
      source: form.source.trim(),
      difficulty: form.difficulty as Difficulty,
      status: "à faire",
      duration_minutes: 0,
      note: form.note.trim() || null,
      created_at: new Date().toISOString(),
      tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      hints: form.hints.split("\n").map((hint) => hint.trim()).filter(Boolean),
      correction: form.correction.trim() || null,
      favorite: false,
      archived: false,
      last_opened_at: null,
    };
    persist([exercise, ...exercises]);
    setForm(emptyForm);
    setOpen(false);
    setSelectedId(exercise.id);
  }

  const visible = useMemo(
    () =>
      exercises
        .filter((item) => !item.archived)
        .filter((item) => subject === "Toutes" || item.subject === subject)
        .filter((item) => status === "Tous" || item.status === status)
        .filter((item) => !favoritesOnly || item.favorite)
        .filter((item) => `${item.chapter} ${item.source} ${item.tags?.join(" ")}`.toLowerCase().includes(query.toLowerCase())),
    [exercises, subject, status, favoritesOnly, query]
  );

  const selected = exercises.find((item) => item.id === selectedId);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (focusMode) setFocusMode(false);
        else if (open) setOpen(false);
        else if (selectedId) setSelectedId(null);
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        document.getElementById("exercise-search")?.focus();
      }
      if (event.key === "n" && !event.metaKey && !event.ctrlKey && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusMode, open, selectedId]);

  if (focusMode && selected) {
    return (
      <FocusView
        item={selected}
        update={update}
        onClose={() => setFocusMode(false)}
      />
    );
  }

  return (
    <div className="space-y-5">
      <Card className="p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <Input
              id="exercise-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-10"
              placeholder="Rechercher un chapitre, une source ou un tag…"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-none">
            <Select value={subject} onChange={(event) => setSubject(event.target.value as Subject | "Toutes")} className="w-auto min-w-[140px]">
              {["Toutes", ...subjects].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </Select>
            <Select value={status} onChange={(event) => setStatus(event.target.value as ExerciseStatus | "Tous")} className="w-auto min-w-[120px]">
              {["Tous", ...exerciseStatuses].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </Select>
            <Button
              variant={favoritesOnly ? "primary" : "secondary"}
              size="icon"
              onClick={() => setFavoritesOnly((value) => !value)}
              aria-pressed={favoritesOnly}
              className={favoritesOnly ? "border-accent/40 bg-accent/15 text-accent" : ""}
            >
              <Star size={17} />
            </Button>
            <Button onClick={() => setOpen((value) => !value)}>
              <Plus size={17} /> Ajouter
            </Button>
          </div>
        </div>
      </Card>

      <AnimatePresence>
        {open && (
          <motion.form
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            onSubmit={create}
            className="surface grid gap-3 rounded-2xl p-5 sm:grid-cols-2"
          >
            <Input required value={form.chapter} onChange={(event) => setForm({ ...form, chapter: event.target.value })} placeholder="Chapitre / intitulé de l'exercice" />
            <Input required value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} placeholder="Source (feuille, DM, livre…)" />
            <Select value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value as Subject })}>
              {subjects.map((value) => (
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
            <Input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="Tags, séparés par des virgules" />
            <Textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Note personnelle" />
            <Textarea value={form.hints} onChange={(event) => setForm({ ...form, hints: event.target.value })} className="sm:col-span-2" placeholder="Indices progressifs — un indice par ligne" />
            <Textarea value={form.correction} onChange={(event) => setForm({ ...form, correction: event.target.value })} className="sm:col-span-2" placeholder="Correction personnelle (restera masquée par défaut)" />
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit">Créer l'exercice</Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-zinc-500">
          <span className="font-semibold text-zinc-200">{visible.length}</span> exercice{visible.length > 1 ? "s" : ""} affiché{visible.length > 1 ? "s" : ""}
        </p>
        <span className="hidden items-center gap-2 text-xs text-zinc-500 sm:flex">
          <Filter size={14} /> ⌘K recherche · N nouvel exercice · Esc fermer
        </span>
      </div>

      <div className="grid gap-3">
        {visible.map((item, index) => (
          <motion.article
            key={item.id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.025 }}
            className={cn("surface overflow-hidden rounded-2xl", selectedId === item.id && "border-accent/35")}
          >
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
              <button
                onClick={() => {
                  setSelectedId(selectedId === item.id ? null : item.id);
                  update(item.id, { last_opened_at: new Date().toISOString() });
                }}
                className="focus-ring min-w-0 flex-1 text-left"
              >
                <div className="flex items-center gap-2">
                  <span className={cn("grid h-6 w-6 place-items-center rounded-md text-[10px] font-bold", subjectMeta[item.subject].className)}>
                    {subjectMeta[item.subject].short}
                  </span>
                  <span className="text-xs text-zinc-500">{item.source}</span>
                  {item.favorite && <Heart size={12} className="text-rose-300" fill="currentColor" />}
                </div>
                <h2 className="mt-2 truncate font-semibold tracking-tight text-zinc-100">{item.chapter}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <DifficultyDots value={item.difficulty} />
                  {item.tags?.slice(0, 3).map((tag) => (
                    <Badge key={tag}>{tag}</Badge>
                  ))}
                </div>
              </button>
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <Select
                  value={item.status}
                  onChange={(event) => update(item.id, { status: event.target.value as ExerciseStatus })}
                  className="w-auto rounded-lg px-2.5 py-2 text-xs"
                >
                  {exerciseStatuses.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </Select>
                <Button variant="ghost" size="icon" onClick={() => update(item.id, { favorite: !item.favorite })} aria-label={item.favorite ? "Retirer des favoris" : "Ajouter aux favoris"} className={cn("h-9 w-9", item.favorite && "text-rose-300")}>
                  <Heart size={18} fill={item.favorite ? "currentColor" : "none"} />
                </Button>
                {selectedId === item.id && (
                  <Button variant="ghost" size="icon" onClick={() => setFocusMode(true)} aria-label="Mode focus" className="h-9 w-9">
                    <Maximize2 size={17} />
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => update(item.id, { archived: true })} aria-label="Archiver" className="h-9 w-9">
                  <Archive size={17} />
                </Button>
                <ChevronDown size={16} className={cn("text-zinc-500 transition", selectedId === item.id && "rotate-180")} />
              </div>
            </div>
            <AnimatePresence>
              {selectedId === item.id && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-white/[0.07]">
                  <ExerciseDetail item={item} update={update} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.article>
        ))}
        {visible.length === 0 && (
          <Card className="px-6 py-16 text-center">
            <BookOpenCheck className="mx-auto text-accent" />
            <p className="mt-4 font-semibold">Aucun exercice ne correspond.</p>
            <p className="mt-1 text-sm text-zinc-500">Ajuste les filtres ou ajoute une nouvelle fiche.</p>
          </Card>
        )}
      </div>
    </div>
  );
}

function ExerciseDetail({ item, update }: { item: Exercise; update: (id: string, patch: Partial<Exercise>) => void }) {
  const [correctionVisible, setCorrectionVisible] = useState(false);
  const [hintCount, setHintCount] = useState(0);

  return (
    <div className="grid gap-5 bg-black/10 p-5 md:grid-cols-2">
      <div>
        <p className="eyebrow">Notes</p>
        <Textarea
          value={item.note || ""}
          onChange={(event) => update(item.id, { note: event.target.value || null })}
          className="mt-2 min-h-24"
          placeholder="Ce que tu veux retenir, les erreurs à éviter…"
        />
      </div>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="eyebrow">Mode résolution</p>
          <span className="flex items-center gap-1 text-xs text-zinc-500">
            <Clock3 size={13} /> {item.duration_minutes} min enregistré
          </span>
        </div>
        {item.hints?.slice(0, hintCount).map((hint, index) => (
          <p key={index} className="rounded-xl border border-accent/15 bg-accent/[0.055] p-3 text-sm leading-6 text-zinc-300">
            Indice {index + 1} — {hint}
          </p>
        ))}
        {item.hints && hintCount < item.hints.length && (
          <Button variant="ghost" onClick={() => setHintCount((count) => count + 1)} className="text-accent">
            Afficher l&apos;indice {hintCount + 1}
          </Button>
        )}
        {item.correction && (
          <div>
            <Button variant="ghost" onClick={() => setCorrectionVisible((value) => !value)}>
              {correctionVisible ? <EyeOff size={16} /> : <Eye size={16} />}
              {correctionVisible ? "Masquer la correction" : "Afficher la correction"}
            </Button>
            {correctionVisible && (
              <p className="mt-3 whitespace-pre-line rounded-xl border border-white/[0.08] bg-white/[0.035] p-3 text-sm leading-6 text-zinc-300">
                {item.correction}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FocusView({
  item,
  update,
  onClose,
}: {
  item: Exercise;
  update: (id: string, patch: Partial<Exercise>) => void;
  onClose: () => void;
}) {
  const [correctionVisible, setCorrectionVisible] = useState(false);
  const [hintCount, setHintCount] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === " ") {
        event.preventDefault();
        setRunning((r) => !r);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const minutes = Math.floor(seconds / 60);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex flex-col bg-canvas"
    >
      <header className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4">
        <div className="flex items-center gap-3">
          <span className={cn("grid h-7 w-7 place-items-center rounded-md text-xs font-bold", subjectMeta[item.subject].className)}>
            {subjectMeta[item.subject].short}
          </span>
          <div>
            <p className="text-sm font-semibold">{item.chapter}</p>
            <p className="text-xs text-zinc-500">{item.source}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="tabular-nums text-sm text-zinc-400">
            {String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}
          </span>
          <Button variant={running ? "secondary" : "primary"} size="sm" onClick={() => setRunning((r) => !r)}>
            {running ? "Pause" : "Timer"}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => {
            if (minutes > 0) update(item.id, { duration_minutes: (item.duration_minutes || 0) + minutes });
            onClose();
          }}>
            <Minimize2 size={18} />
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <DifficultyDots value={item.difficulty} />
        <h1 className="mt-6 max-w-2xl text-center text-3xl font-semibold tracking-tight sm:text-4xl">{item.chapter}</h1>
        <p className="mt-3 text-sm text-zinc-500">{item.subject} · {item.source}</p>

        <div className="mt-12 w-full max-w-xl space-y-4">
          {item.hints?.slice(0, hintCount).map((hint, index) => (
            <motion.p
              key={index}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-accent/15 bg-accent/[0.055] p-4 text-sm leading-7 text-zinc-300"
            >
              Indice {index + 1} — {hint}
            </motion.p>
          ))}
          {item.hints && hintCount < item.hints.length && (
            <Button variant="secondary" onClick={() => setHintCount((c) => c + 1)} className="w-full">
              Afficher l&apos;indice {hintCount + 1}
            </Button>
          )}
          {item.correction && (
            <div className="text-center">
              <Button variant="ghost" onClick={() => setCorrectionVisible((v) => !v)}>
                {correctionVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                {correctionVisible ? "Masquer la correction" : "Afficher la correction"}
              </Button>
              {correctionVisible && (
                <p className="mt-4 whitespace-pre-line rounded-xl border border-white/[0.08] bg-white/[0.035] p-4 text-left text-sm leading-7 text-zinc-300">
                  {item.correction}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="mt-8 flex gap-2">
          {(["à faire", "en cours", "terminé"] as ExerciseStatus[]).map((s) => (
            <Button
              key={s}
              variant={item.status === s ? "primary" : "secondary"}
              size="sm"
              onClick={() => update(item.id, { status: s })}
            >
              {s}
            </Button>
          ))}
        </div>
      </div>

      <footer className="border-t border-white/[0.07] px-6 py-4 text-center text-xs text-zinc-600">
        Espace pour quitter · Barre d&apos;espace pour le timer
      </footer>
    </motion.div>
  );
}
