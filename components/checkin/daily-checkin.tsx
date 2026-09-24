"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented";
import { WhyItWorks } from "@/components/checkin/why-it-works";
import { Illustration } from "@/components/ui/illustrations";
import { checkinForDay, clampSleep, formatSleep, shouldPromptCheckin, upsertCheckin } from "@/lib/checkin-insights";
import { CHECKIN_SLEEP_MAX, CHECKIN_SLEEP_MIN, readFlag, writeFlag, type DailyCheckin } from "@/lib/storage";
import { dayKey } from "@/lib/study";

/**
 * CHECK-IN DU SOIR — dix secondes, une fois par jour.
 *
 * Trois gestes : les heures dormies la nuit dernière (un pas d'une
 * demi-heure), l'énergie et le stress de la journée (de 1 à 5), et une
 * ligne facultative. Pas d'émoji ni de visage souriant : des chiffres, que
 * l'on retrouvera tels quels dans les moyennes de la page Progrès.
 *
 * QUAND IL S'AFFICHE. Le soir seulement (à partir de 17 h, voir
 * lib/checkin-insights.ts#shouldPromptCheckin), et seulement tant que le
 * check-in du jour n'est pas fait. « Plus tard » le masque jusqu'au
 * lendemain : c'est une préférence d'affichage de CET appareil, pas une
 * donnée — elle ne voyage donc pas dans la sauvegarde.
 *
 * Le composant ne lit PAS le hook lui-même : le Dashboard, qui appelle
 * `usePrepahubData()` une fois pour tout l'écran, lui passe `checkins` et
 * `onSave` (voir la règle dans hooks/use-prepahub-data.ts#saveReviewItems).
 */

/** Clé d'affichage locale — hors du préfixe `prepahub:` pour ne pas réveiller le rafraîchissement inter-onglets du hook. */
const LATER_KEY = "taekdhub:checkin-later";

const SCALE = [1, 2, 3, 4, 5].map((value) => ({ value, label: String(value) }));

export function DailyCheckinCard({
  checkins,
  onSave,
  ready,
}: {
  checkins: DailyCheckin[];
  onSave: (checkins: DailyCheckin[]) => void;
  ready: boolean;
}) {
  const now = new Date();
  const today = dayKey(now);
  const existing = checkinForDay(checkins, today);
  const [editing, setEditing] = useState(false);
  const [laterDay, setLaterDay] = useState<string | null>(() => readFlag(LATER_KEY));

  if (!ready) return null;

  if (existing && !editing) {
    return (
      <div className="surface flex items-center gap-4 px-6 py-4">
        <Illustration name="checkin" size={32} className="shrink-0 text-muted" />
        <p className="t-meta min-w-0 flex-1 truncate">
          <span className="text-ink">Check-in du soir fait</span> · {formatSleep(existing.sleepHours)} · énergie {existing.energy} · stress{" "}
          {existing.stress}
        </p>
        <Button size="sm" variant="link" onClick={() => setEditing(true)}>
          Modifier
        </Button>
      </div>
    );
  }

  if (!existing && (!shouldPromptCheckin(checkins, now) || laterDay === today)) return null;

  return (
    <CheckinForm
      initial={existing ?? lastCheckin(checkins)}
      editing={Boolean(existing)}
      onSubmit={(input) => {
        onSave(upsertCheckin(checkins, input));
        setEditing(false);
      }}
      onLater={() => {
        if (existing) {
          setEditing(false);
          return;
        }
        writeFlag(LATER_KEY, today);
        setLaterDay(today);
      }}
    />
  );
}

function lastCheckin(checkins: DailyCheckin[]): DailyCheckin | null {
  return checkins.length > 0 ? checkins[checkins.length - 1] : null;
}

function CheckinForm({
  initial,
  editing,
  onSubmit,
  onLater,
}: {
  /** Le check-in du jour (correction), ou le dernier en date — pour pré-remplir le SOMMEIL seulement. */
  initial: DailyCheckin | null;
  editing: boolean;
  onSubmit: (input: { sleepHours: number; energy: number; stress: number; note: string | null }) => void;
  onLater: () => void;
}) {
  const [sleep, setSleep] = useState(initial?.sleepHours ?? 7);
  /*
   * Énergie et stress NE SONT PAS pré-remplis (sauf correction) : une valeur
   * par défaut à 3 serait validée par réflexe, et la série ne mesurerait
   * plus que la paresse du pouce. Le sommeil, lui, varie peu d'un soir à
   * l'autre — reprendre la veille fait gagner deux appuis sans rien biaiser
   * de plus qu'un chiffre qu'on voit et qu'on corrige.
   */
  const [energy, setEnergy] = useState<number>(editing ? (initial?.energy ?? 0) : 0);
  const [stress, setStress] = useState<number>(editing ? (initial?.stress ?? 0) : 0);
  const [note, setNote] = useState(editing ? (initial?.note ?? "") : "");
  const valid = energy > 0 && stress > 0;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;
    onSubmit({ sleepHours: sleep, energy, stress, note: note.trim() || null });
  }

  return (
    /* Une TUILE en deux colonnes sur grand écran, comme « Noter du temps » :
       la lune et la promesse (« 10 secondes ») à gauche, les trois gestes à
       droite. Sous `lg`, tout s'empile. */
    <form onSubmit={submit} aria-labelledby="checkin-titre" className="surface grid gap-8 p-6 sm:p-10 lg:grid-cols-2 lg:gap-16">
      <div className="min-w-0">
        <Illustration name="checkin" size={48} className="text-muted" />
        <h3 id="checkin-titre" className="t-heading mt-4">
          Check-in du soir.
        </h3>
        <p className="t-meta mt-1.5 max-w-[36ch]">Ton sommeil, ton énergie, ton stress — dix secondes, une fois par jour.</p>
        <div className="mt-4">
          <WhyItWorks>
            <p>
              Le sommeil joue un rôle dans la consolidation de ce qu&apos;on a appris dans la journée (Walker &amp; Stickgold, 2006 ;
              Diekelmann &amp; Born, 2010). Noter chaque soir son sommeil, son énergie et son stress est une forme d&apos;auto-observation :
              on repère des régularités qu&apos;on ne voit pas au jour le jour.
            </p>
            <p>
              Ce check-in ne soigne rien et ne prédit pas tes notes. Après quelques semaines, la page Progrès te montre simplement ce
              qu&apos;on observe dans TES données — sans en tirer de cause.
            </p>
          </WhyItWorks>
        </div>
      </div>

      <div className="min-w-0 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-ink">Sommeil cette nuit</span>
        <div className="flex items-center gap-1" role="group" aria-label="Heures de sommeil la nuit dernière">
          <Button
            type="button"
            size="icon"
            variant="secondary"
            aria-label="Une demi-heure de moins"
            disabled={sleep <= CHECKIN_SLEEP_MIN}
            onClick={() => setSleep((value) => clampSleep(value - 0.5))}
          >
            <Minus size={14} />
          </Button>
          <output aria-live="polite" className="t-figure-sm tabular w-16 text-center">
            {formatSleep(sleep)}
          </output>
          <Button
            type="button"
            size="icon"
            variant="secondary"
            aria-label="Une demi-heure de plus"
            disabled={sleep >= CHECKIN_SLEEP_MAX}
            onClick={() => setSleep((value) => clampSleep(value + 0.5))}
          >
            <Plus size={14} />
          </Button>
        </div>
      </div>

      <ScaleRow label="Énergie" low="à plat" high="en forme" value={energy} onChange={setEnergy} />
      <ScaleRow label="Stress" low="serein" high="sous pression" value={stress} onChange={setStress} />

      <label className="block">
        <span className="sr-only">Une ligne sur ta journée (facultatif)</span>
        <Input value={note} maxLength={140} onChange={(event) => setNote(event.target.value)} placeholder="Une ligne sur ta journée (facultatif)" />
      </label>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onLater}>
          {editing ? "Annuler" : "Plus tard"}
        </Button>
        <Button type="submit" size="sm" variant="secondary" disabled={!valid}>
          Enregistrer
        </Button>
      </div>
      </div>
    </form>
  );
}

function ScaleRow({
  label,
  low,
  high,
  value,
  onChange,
}: {
  label: string;
  low: string;
  high: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-ink">{label}</span>
        <span className="t-meta text-2xs">
          1 {low} · 5 {high}
        </span>
      </div>
      {/* `0` = pas encore choisi : aucune option n'est enfoncée. */}
      <SegmentedControl size="md" ariaLabel={`${label}, de 1 (${low}) à 5 (${high})`} value={value} onChange={onChange} options={SCALE} className="sm:flex sm:w-full [&>button]:sm:flex-1" />
    </div>
  );
}
