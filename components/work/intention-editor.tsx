"use client";

import { CalendarCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatIntention } from "@/lib/intentions";
import { dayKey } from "@/lib/study";
import type { WorkItem, WorkItemPlan } from "@/lib/storage";

/**
 * PLAN « SI… ALORS… » D'UN TRAVAIL — trois champs, dix secondes.
 *
 * Replié par défaut : la phrase du plan quand il existe, sinon un lien
 * « Planifier quand et où ». Déplié : le jour, l'heure (facultative), le lieu
 * (facultatif). Voir lib/intentions.ts pour la raison d'être.
 */
export function IntentionEditor({ item, onPlan }: { item: WorkItem; onPlan: (id: string, plan: WorkItemPlan | null) => void }) {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(item.plan?.day ?? dayKey(new Date()));
  const [time, setTime] = useState(item.plan?.time ?? "");
  const [place, setPlace] = useState(item.plan?.place ?? "");

  if (!open) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {item.plan && (
          <p className="flex min-w-0 items-center gap-1.5 text-[0.8125rem] font-bold text-ink">
            <CalendarCheck size={14} className="shrink-0 text-accent" aria-hidden />
            {formatIntention(item.plan, item.title)}
          </p>
        )}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-accent/10 px-3 text-[0.8125rem] font-extrabold text-accent transition-colors hover:bg-accent/15 max-lg:min-h-11"
        >
          {!item.plan && <CalendarCheck size={14} aria-hidden />}
          {item.plan ? "Modifier le plan" : "Planifier quand et où"}
        </button>
      </div>
    );
  }

  function save() {
    if (!day) return;
    onPlan(item.id, { day, time: time || null, place: place.trim() || null });
    setOpen(false);
  }

  return (
    <div className="mt-3 rounded-[1.25rem] bg-inset p-4">
      <p className="mb-3 flex items-center gap-1.5 text-[0.8125rem] font-extrabold text-ink">
        <CalendarCheck size={14} className="text-accent" aria-hidden />
        Si c&apos;est… alors : <span className="min-w-0 truncate">{item.title}</span>
      </p>
      {/* Jour et heure côte à côte, le lieu sur toute la ligne : trois
          champs alignés sur une grille, plus un ruban qui passe à la ligne
          au hasard de la largeur. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <label className="grid min-w-0 gap-1 text-2xs font-bold text-muted">
          Jour
          <Input type="date" value={day} onChange={(event) => setDay(event.target.value)} />
        </label>
        <label className="grid min-w-0 gap-1 text-2xs font-bold text-muted">
          Heure
          <Input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
        </label>
        <label className="col-span-2 grid min-w-0 gap-1 text-2xs font-bold text-muted sm:col-span-1">
          Où
          <Input value={place} onChange={(event) => setPlace(event.target.value)} placeholder="au CDI, à la maison…" maxLength={60} />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Button size="sm" onClick={save} disabled={!day}>
          Enregistrer le plan
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Annuler
        </Button>
        {item.plan && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              onPlan(item.id, null);
              setOpen(false);
            }}
          >
            Retirer le plan
          </Button>
        )}
      </div>
    </div>
  );
}
