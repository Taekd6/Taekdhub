"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/ui/section";
import { normalizeRanges, weeklyCapacityMinutes } from "@/lib/domain/availability";
import { formatMinutes, minutesFromTime } from "@/lib/domain/date";
import { useStore } from "@/lib/store/store";
import { WEEKDAYS, WEEKDAY_LABELS, type TimeRange, type Weekday } from "@/lib/domain/types";

/**
 * DISPONIBILITÉS — le réglage le plus important de l'application.
 *
 * Sans lui, aucune des questions que TaekdHub prétend résoudre n'a de
 * réponse : « est-ce que ça tient ? » suppose de savoir ce dont on dispose.
 * D'où sa place en tête des réglages, et le total hebdomadaire affiché en
 * permanence — c'est le chiffre qui rend le réglage concret.
 *
 * Les plages se saisissent en clair (18:00 → 22:00), jour par jour. Une
 * journée sans plage est une journée sans travail prévu : c'est une réponse
 * valide, pas un oubli, et le planificateur la respecte.
 */
export function AvailabilityEditor() {
  const { state, saveAvailability } = useStore();
  const availability = state.availability;
  const [copiedFrom, setCopiedFrom] = useState<Weekday | null>(null);

  function setDay(weekday: Weekday, ranges: TimeRange[]) {
    saveAvailability({ ...availability, weekly: { ...availability.weekly, [weekday]: normalizeRanges(ranges) } });
  }

  function addRange(weekday: Weekday) {
    const existing = availability.weekly[weekday] ?? [];
    const last = existing[existing.length - 1];
    // La nouvelle plage commence après la dernière : on ne propose jamais un
    // chevauchement que la normalisation viendrait fusionner dans le dos.
    const start = last ? last.end : "18:00";
    const end = minutesFromTime(start) + 120 >= 24 * 60 ? "23:59" : addTwoHours(start);
    setDay(weekday, [...existing, { start, end }]);
  }

  function updateRange(weekday: Weekday, index: number, patch: Partial<TimeRange>) {
    const ranges = [...(availability.weekly[weekday] ?? [])];
    ranges[index] = { ...ranges[index], ...patch };
    // Pas de normalisation pendant la frappe : elle réordonnerait ou fusionnerait
    // les plages sous les doigts. On enregistre tel quel et la normalisation
    // s'applique à la lecture (domain/availability.ts).
    saveAvailability({ ...availability, weekly: { ...availability.weekly, [weekday]: ranges } });
  }

  function removeRange(weekday: Weekday, index: number) {
    setDay(
      weekday,
      (availability.weekly[weekday] ?? []).filter((_, position) => position !== index)
    );
  }

  return (
    <Section
      id="disponibilites"
      label="Capacité"
      title="Mes disponibilités"
      description="Les heures où tu peux réellement travailler. Toute l'analyse de charge et la planification en dépendent."
      action={<span className="t-meta">{formatMinutes(weeklyCapacityMinutes(availability))} par semaine</span>}
    >
      <ul className="divide-y divide-line border-y border-line">
        {WEEKDAYS.map((weekday) => {
          const ranges = availability.weekly[weekday] ?? [];
          const minutes = normalizeRanges(ranges).reduce(
            (total, range) => total + (minutesFromTime(range.end) - minutesFromTime(range.start)),
            0
          );

          return (
            <li key={weekday} className="flex flex-wrap items-start gap-3 py-3">
              <div className="w-24 shrink-0 pt-2">
                <span className="text-sm font-medium">{WEEKDAY_LABELS[weekday]}</span>
                <span className="t-meta block">{minutes > 0 ? formatMinutes(minutes) : "libre"}</span>
              </div>

              <div className="min-w-0 flex-1 space-y-2">
                {ranges.length === 0 && <p className="t-meta pt-2">Aucune plage — rien ne sera planifié ce jour-là.</p>}

                {ranges.map((range, index) => (
                  <div key={index} className="flex flex-wrap items-center gap-2">
                    <Input
                      type="time"
                      value={range.start}
                      onChange={(event) => updateRange(weekday, index, { start: event.target.value })}
                      aria-label={`Début de la plage ${index + 1}, ${WEEKDAY_LABELS[weekday]}`}
                      className="w-[7.5rem]"
                    />
                    <span aria-hidden className="text-subtle">
                      →
                    </span>
                    <Input
                      type="time"
                      value={range.end}
                      onChange={(event) => updateRange(weekday, index, { end: event.target.value })}
                      aria-label={`Fin de la plage ${index + 1}, ${WEEKDAY_LABELS[weekday]}`}
                      className="w-[7.5rem]"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Supprimer cette plage"
                      onClick={() => removeRange(weekday, index)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" variant="ghost" onClick={() => addRange(weekday)}>
                    <Plus size={13} /> Plage
                  </Button>
                  {copiedFrom === null ? (
                    ranges.length > 0 && (
                      <Button size="sm" variant="ghost" onClick={() => setCopiedFrom(weekday)}>
                        Copier
                      </Button>
                    )
                  ) : copiedFrom === weekday ? (
                    <Button size="sm" variant="ghost" onClick={() => setCopiedFrom(null)}>
                      Annuler la copie
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setDay(weekday, [...(availability.weekly[copiedFrom] ?? [])]);
                        setCopiedFrom(null);
                      }}
                    >
                      Coller {WEEKDAY_LABELS[copiedFrom].toLowerCase()}
                    </Button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function addTwoHours(time: string): string {
  const total = Math.min(24 * 60 - 1, minutesFromTime(time) + 120);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
