"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { suggestEstimate } from "@/lib/estimation";
import { subjects } from "@/lib/study";
import { createWorkItem, WORK_ITEM_KIND_META } from "@/lib/work-items";
import { WORK_ITEM_KINDS, type WorkItem, type WorkItemKind } from "@/lib/storage";
import type { Subject, WorkSession } from "@/lib/supabase/types";

/**
 * CRÉATION RAPIDE — « DM maths — jeudi », en trois gestes.
 *
 * La contrainte dominante n'est pas la complétude, c'est la VITESSE : un
 * élève note un DM entre deux cours. Tout ce qui n'est pas indispensable est
 * donc pré-rempli ou facultatif, et rien ne bloque la validation sauf un
 * titre. Le formulaire tient sur deux rangées, et se soumet à l'Entrée depuis
 * le champ titre.
 *
 * L'ESTIMATION reste une suggestion. Quand l'historique contient assez de
 * travaux comparables terminés, une ligne propose une durée avec le nombre
 * d'observations qui la fonde, et un bouton « Utiliser » — jamais un champ
 * rempli d'autorité. Sans historique suffisant, rien ne s'affiche : mieux
 * vaut pas d'estimation qu'une estimation inventée (voir lib/estimation.ts).
 */
export function WorkItemForm({
  workItems,
  sessions,
  onCreate,
}: {
  workItems: WorkItem[];
  sessions: WorkSession[];
  onCreate: (item: WorkItem) => void;
}) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<WorkItemKind>("dm");
  const [subject, setSubject] = useState<Subject | "">("Mathématiques");
  const [dueDate, setDueDate] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [important, setImportant] = useState(false);

  const suggestion = useMemo(
    () => suggestEstimate(kind, subject || null, workItems, sessions),
    [kind, subject, workItems, sessions]
  );

  const today = new Date();
  const todayKey = toDayKey(today);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    onCreate(
      createWorkItem({
        title,
        kind,
        subject: subject || null,
        estimatedMinutes: minutes,
        dueDate: dueDate || null,
        important,
      })
    );
    // Le titre et l'échéance se vident, le reste NON : on note souvent
    // plusieurs travaux de la même matière à la suite, et refaire trois
    // choix identiques à chaque fois est exactement ce qui fait renoncer.
    setTitle("");
    setDueDate("");
    setImportant(false);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Le titre et « Ajouter » restent sur la MÊME rangée, y compris à
            390 px : le bouton mis en pleine largeur en dessous formait un
            grand bloc gris juste sous le champ, et repoussait d'une rangée
            entière tout ce qui suit — sur un téléphone, cela suffisait à
            faire passer la première échéance sous la ligne de flottaison. */}
        <label className="min-w-0 flex-1 basis-[11rem] sm:basis-[16rem]">
          <span className="sr-only">Intitulé du travail</span>
          <Input
            aria-label="Intitulé du travail"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="DM de maths, révision des intégrales…"
            autoComplete="off"
          />
        </label>
        <Button type="submit" disabled={!title.trim()} className="shrink-0">
          <Plus size={15} /> Ajouter
        </Button>
      </div>

      {/* Deux colonnes sur téléphone plutôt qu'une seule : ces quatre
          contrôles sont courts, les empiler ferait descendre le bouton
          « Ajouter » hors de l'écran au premier clavier ouvert. */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <label className="min-w-0">
          <span className="sr-only">Nature du travail</span>
          <Select aria-label="Nature du travail" value={kind} onChange={(event) => setKind(event.target.value as WorkItemKind)}>
            {WORK_ITEM_KINDS.map((value) => (
              <option key={value} value={value}>
                {WORK_ITEM_KIND_META[value].label}
              </option>
            ))}
          </Select>
        </label>

        <label className="min-w-0">
          <span className="sr-only">Matière</span>
          <Select aria-label="Matière du travail" value={subject} onChange={(event) => setSubject(event.target.value as Subject | "")}>
            <option value="">Sans matière</option>
            {subjects.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </Select>
        </label>

        <label className="min-w-0">
          <span className="sr-only">Date d&apos;échéance</span>
          <Input aria-label="Date d'échéance" type="date" value={dueDate} min={todayKey} onChange={(event) => setDueDate(event.target.value)} />
        </label>

        <label className="flex min-w-0 items-center gap-1.5">
          <span className="sr-only">Durée estimée, en minutes</span>
          <Input
            aria-label="Durée estimée, en minutes"
            type="number"
            min={5}
            step={5}
            value={minutes}
            onChange={(event) => setMinutes(Math.max(5, Math.round(Number(event.target.value) || 0)))}
            className="w-20 text-center"
          />
          <span className="t-meta shrink-0">min</span>
        </label>

        <label className="col-span-2 flex min-h-11 items-center gap-2 text-sm text-muted sm:min-h-0">
          <input
            type="checkbox"
            checked={important}
            onChange={(event) => setImportant(event.target.checked)}
            className="h-4 w-4 accent-[rgb(var(--accent-ink-rgb))]"
          />
          Important
        </label>
      </div>

      {/* Raccourcis de date : « jeudi » se note plus vite en un clic qu'en
          ouvrant un calendrier. Le champ date reste la référence — ces boutons
          ne font que l'écrire. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="t-label shrink-0">Échéance</span>
        {[
          { label: "Demain", offset: 1 },
          { label: "Dans 3 j", offset: 3 },
          { label: "Dans 1 semaine", offset: 7 },
        ].map(({ label, offset }) => {
          const value = toDayKey(addDays(today, offset));
          return (
            <button
              key={label}
              type="button"
              onClick={() => setDueDate(dueDate === value ? "" : value)}
              aria-pressed={dueDate === value}
              className={`row-hover rounded-full border px-3 py-1 text-2xs max-lg:min-h-11 ${
                dueDate === value ? "border-accent/30 bg-accent/[0.08] text-accent" : "border-line text-muted"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {suggestion && (
        <p className="t-meta flex flex-wrap items-center gap-x-2 gap-y-1">
          {suggestion.sentence}
          <Button type="button" variant="link" size="sm" onClick={() => setMinutes(suggestion.minutes)}>
            Utiliser
          </Button>
        </p>
      )}
    </form>
  );
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** "AAAA-MM-JJ" en heure LOCALE — `toISOString()` bascule d'un jour dès qu'on est à l'est de Greenwich. */
function toDayKey(date: Date): string {
  return date.toLocaleDateString("en-CA");
}
