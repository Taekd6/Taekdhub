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
          <p className="t-meta flex items-center gap-1.5 text-[0.8125rem] font-semibold text-ink">
            <CalendarCheck size={14} className="text-accent" aria-hidden />
            {formatIntention(item.plan, item.title)}
          </p>
        )}
        <button type="button" onClick={() => setOpen(true)} className="t-meta min-h-8 rounded-full text-[0.8125rem] font-semibold text-accent hover:underline max-lg:min-h-11">
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
    <div className="mt-3 rounded-2xl bg-inset p-3">
      <p className="t-meta mb-2 text-[0.8125rem]">Si c&apos;est… alors : {item.title}</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-2xs font-semibold text-muted">
          Jour
          <Input type="date" value={day} onChange={(event) => setDay(event.target.value)} className="w-40" />
        </label>
        <label className="grid gap-1 text-2xs font-semibold text-muted">
          Heure
          <Input type="time" value={time} onChange={(event) => setTime(event.target.value)} className="w-28" />
        </label>
        <label className="grid min-w-[10rem] flex-1 gap-1 text-2xs font-semibold text-muted">
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
