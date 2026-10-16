"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Group, Row } from "@/components/ui/grouped";
import { SegmentedControl } from "@/components/ui/segmented";
import { Notice, Skeleton } from "@/components/ui/state";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { PERFORMANCE_LEVELS, performanceWindowIssues, STARTER_WINDOWS, WINDOW_IDS, WINDOW_LABEL, type PerformanceLevel, type PerformanceWindow, type WindowId } from "@/lib/performance-windows";
import { localData } from "@/lib/storage";

const LEVEL_LABEL: Record<PerformanceLevel, string> = { haute: "Haute", moyenne: "Moyenne", basse: "Basse" };

/** Une rangée du formulaire : la plage, et si l'élève l'utilise. */
interface Draft extends PerformanceWindow {
  on: boolean;
}

/** Les trois plages, dans l'ordre de la journée : celles déjà enregistrées, sinon les valeurs de départ (décochées). */
function draftFrom(saved: PerformanceWindow[]): Draft[] {
  return WINDOW_IDS.map((id) => {
    const found = saved.find((window) => window.id === id);
    return found ? { ...found, on: true } : { ...STARTER_WINDOWS.find((window) => window.id === id)!, on: false };
  });
}

/**
 * PLAGES DE PERFORMANCE — « à quelles heures je travaille le mieux ? »
 *
 * Trois plages (matin, après-midi, soir) avec un niveau SUPPOSÉ. C'est une
 * hypothèse que l'élève règle et corrige, pas une mesure : TaekdHub s'en sert
 * seulement pour SUGGÉRER un ordre aux tâches du plan du jour (lib/day-placement.ts),
 * jamais pour en retirer une ni en changer la durée.
 *
 * DÉSACTIVÉ par défaut : tant que rien n'est enregistré, le plan du jour est
 * affiché exactement comme avant. Le profil de départ n'est appliqué que
 * quand l'élève le demande.
 */
export function PerformanceWindowsForm() {
  const { preferences, savePreferences, ready } = usePrepahubData();
  const saved = preferences.performanceWindows;
  const [draft, setDraft] = useState<Draft[]>(() => draftFrom(saved ?? []));
  const [issues, setIssues] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setDraft(draftFrom(saved ?? []));
  }, [saved]);

  if (!ready) return <Skeleton className="h-64 w-full rounded-2xl" />;

  function update(id: WindowId, patch: Partial<Draft>) {
    setDraft((current) => current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
    setIssues([]);
    setMessage(null);
  }

  function persist(windows: PerformanceWindow[] | null) {
    // Par-dessus ce qui est RÉELLEMENT enregistré, pas l'instantané du montage (même précaution que CapacityForm).
    savePreferences({ ...localData.preferences(), performanceWindows: windows });
  }

  function activateStarter() {
    setDraft(draftFrom([...STARTER_WINDOWS]));
    persist(STARTER_WINDOWS.map((window) => ({ ...window })));
    setMessage("Profil de départ activé. Corrige-le d'après ton ressenti, puis enregistre.");
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    const chosen: PerformanceWindow[] = draft.filter((entry) => entry.on).map(({ id, start, end, level }) => ({ id, start, end, level }));
    const problems = performanceWindowIssues(chosen);
    setIssues(problems);
    if (problems.length > 0) return;
    persist(chosen.length > 0 ? chosen : null);
    setMessage(chosen.length > 0 ? "Plages enregistrées." : "Plages désactivées : le plan du jour reste celui d'avant.");
  }

  function disable() {
    persist(null);
    setIssues([]);
    setMessage("Plages désactivées : le plan du jour reste celui d'avant.");
  }

  if (saved === null && !draft.some((entry) => entry.on)) {
    return (
      <Group
        title="Plages de performance"
        footer="Désactivé : ton plan du jour s'affiche comme d'habitude. Activées, ces plages ne servent qu'à suggérer un ordre (le plus exigeant quand tu penses être au mieux) : aucune tâche n'est retirée, tu gardes la main."
      >
        <Row label="Profil de départ" hint="une hypothèse courante, à corriger" stack>
          <Button type="button" variant="secondary" onClick={activateStarter}>
            Activer le profil de départ
          </Button>
        </Row>
        {message && (
          <p role="status" className="px-4 pb-3 text-[0.8125rem] font-semibold text-ink">
            {message}
          </p>
        )}
      </Group>
    );
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <Group
        title="Plages de performance"
        footer="Ce sont tes hypothèses, pas une mesure de ta performance : TaekdHub ne sait pas à quelle heure tu es réellement le plus efficace. Elles servent seulement à suggérer un ordre ; aucune tâche n'est retirée ni raccourcie."
      >
        {draft.map((entry) => {
          const id = `window-${entry.id}`;
          return (
            <Row key={entry.id} label={WINDOW_LABEL[entry.id]} stack hint={entry.on ? `${entry.start}-${entry.end}` : "non utilisée"}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <label className="inline-flex items-center gap-1.5 text-[0.8125rem] text-muted">
                  <input type="checkbox" checked={entry.on} onChange={(event) => update(entry.id, { on: event.target.checked })} aria-label={`Utiliser la plage ${WINDOW_LABEL[entry.id].toLowerCase()}`} />
                  Utiliser
                </label>
                <Input id={`${id}-start`} type="time" aria-label={`${WINDOW_LABEL[entry.id]} : début`} value={entry.start} disabled={!entry.on} onChange={(event) => update(entry.id, { start: event.target.value })} className="w-36" />
                <span aria-hidden className="t-meta">
                  à
                </span>
                <Input id={`${id}-end`} type="time" aria-label={`${WINDOW_LABEL[entry.id]} : fin`} value={entry.end} disabled={!entry.on} onChange={(event) => update(entry.id, { end: event.target.value })} className="w-36" />
                <SegmentedControl
                  ariaLabel={`Performance supposée, ${WINDOW_LABEL[entry.id].toLowerCase()}`}
                  value={entry.level}
                  onChange={(level) => update(entry.id, { level })}
                  options={PERFORMANCE_LEVELS.map((level) => ({ value: level, label: LEVEL_LABEL[level] }))}
                />
              </div>
            </Row>
          );
        })}
      </Group>

      {issues.length > 0 && (
        <Notice tone="danger" title="Non enregistré">
          {issues.join(" ")}
        </Notice>
      )}
      {message && issues.length === 0 && (
        <p role="status" className="px-1 text-[0.8125rem] font-semibold text-ink">
          {message}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2 px-1">
        <Button type="button" variant="link" onClick={disable}>
          Désactiver les plages
        </Button>
        <Button type="submit" size="lg" className="max-sm:w-full">
          {message?.startsWith("Plages enregistrées") ? (
            <>
              <Check size={16} aria-hidden /> Enregistré
            </>
          ) : (
            "Enregistrer mes plages"
          )}
        </Button>
      </div>
    </form>
  );
}
