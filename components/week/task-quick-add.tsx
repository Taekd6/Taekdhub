"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/input";
import { subjects } from "@/lib/study";
import type { WorkItem, WorkItemKind } from "@/lib/storage";
import type { Subject } from "@/lib/supabase/types";
import { createWorkItem } from "@/lib/work-items";

const KINDS: Array<{ value: WorkItemKind; label: string }> = [
  { value: "exercices", label: "Exos / TD" },
  { value: "chapitre", label: "Cours" },
  { value: "dm", label: "DM" },
  { value: "colle", label: "Khôlle" },
  { value: "ds", label: "DS" },
  { value: "autre", label: "Autre" },
];

const DURATIONS = [20, 30, 45, 60, 90, 120];

/**
 * POSER UNE TÂCHE À UNE HEURE — depuis un créneau de la semaine ou « Ce soir ».
 * La tâche est un `WorkItem` ordinaire, planifié (`plan`) à ce jour et cette
 * heure : elle apparaît partout (À faire, Échéances, Rappels).
 */
export function TaskQuickAdd({
  open,
  day,
  time,
  onClose,
  onAdd,
}: {
  open: boolean;
  day: string;
  time: string | null;
  onClose: () => void;
  onAdd: (item: WorkItem) => void;
}) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<WorkItemKind>("exercices");
  const [subject, setSubject] = useState<Subject | "">("Mathématiques");
  const [minutes, setMinutes] = useState(60);
  const [date, setDate] = useState(day);
  const [hour, setHour] = useState(time ?? "");

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDate(day);
    setHour(time ?? "");
  }, [open, day, time]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || !date) return;
    const item = createWorkItem({ title, kind, subject: subject || null, estimatedMinutes: minutes, dueDate: date, dueTime: null });
    onAdd({ ...item, plan: { day: date, time: hour || null, place: null } });
    onClose();
  }

  return (
    <Dialog open={open} title="Nouvelle tâche" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="t-label mb-1 block">Quoi</span>
          <Input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex. Séries : exos 1, 2, 3" maxLength={120} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="t-label mb-1 block">Jour</span>
            <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <label className="block">
            <span className="t-label mb-1 block">Heure</span>
            <Input type="time" value={hour} step={900} onChange={(event) => setHour(event.target.value)} />
          </label>
          <label className="block">
            <span className="t-label mb-1 block">Matière</span>
            <Select value={subject} onChange={(event) => setSubject(event.target.value as Subject | "")}>
              <option value="">Sans matière</option>
              {subjects.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="t-label mb-1 block">Type</span>
            <Select value={kind} onChange={(event) => setKind(event.target.value as WorkItemKind)}>
              {KINDS.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <fieldset>
          <legend className="t-label mb-1">Durée</legend>
          <div className="flex flex-wrap gap-1.5">
            {DURATIONS.map((value) => (
              <button key={value} type="button" onClick={() => setMinutes(value)} aria-pressed={minutes === value} className={value === minutes ? "chip-on press rounded-full px-3 py-1.5 text-[0.8125rem] font-bold" : "press rounded-full bg-inset px-3 py-1.5 text-[0.8125rem] font-semibold text-muted"}>
                {value < 60 ? `${value} min` : `${Math.floor(value / 60)} h${value % 60 ? value % 60 : ""}`}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={!title.trim() || !date}>
            Ajouter
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
