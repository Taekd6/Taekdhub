"use client";

import { useEffect, useState } from "react";
import { Maximize2, Minimize2, Pause, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/state";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { useWorkTimer } from "@/hooks/use-work-timer";
import { subjects } from "@/lib/study";
import { activeWorkItems, remainingMinutes, WORK_ITEM_KIND_META } from "@/lib/work-items";
import { formatDuration, formatSpan } from "@/lib/utils";
import type { Subject, WorkSession } from "@/lib/supabase/types";

const TIMER_STORAGE_KEY = "prepahub:timer:free";

interface TimerContext {
  subject: Subject;
  /**
   * Travail planifié que cette séance sert, ou `null` pour une séance libre.
   *
   * Persisté AVEC le chrono (voir `useWorkTimer`, dont le contexte est
   * générique) : un rechargement en pleine séance ne doit pas détacher le
   * temps du travail auquel il était destiné. C'est ce champ qui devient
   * `WorkSession.work_item_id` à l'arrêt, et donc ce qui fait avancer un DM
   * — un travail dont aucun exercice de la banque ne porte le contenu.
   */
  workItemId?: string | null;
}

export function Timer() {
  // `ready` est indispensable ici comme partout ailleurs : le chrono restaure
  // une séance persistée dès son premier effet, donc "Terminer" est cliquable
  // avant même que la banque locale ait fini d'être lue.
  const { sessions, workItems, saveSessions, saveWorkItems, ready } = usePrepahubData();
  const { seconds, running, context, setContext, start, toggle, stop } = useWorkTimer<TimerContext>(TIMER_STORAGE_KEY, {
    subject: "Mathématiques",
    workItemId: null,
  });
  const [fullscreen, setFullscreen] = useState(false);
  /*
   * Le paramètre est lu depuis `window.location.search` dans un effet, comme
   * le fait déjà components/session/session-runner.tsx — et NON via
   * `useSearchParams`, qui forcerait cette page à sortir du rendu statique
   * (« useSearchParams() should be wrapped in a suspense boundary ») pour un
   * paramètre optionnel dont rien, dans le premier rendu, ne dépend.
   */
  const [requestedItemId, setRequestedItemId] = useState<string | null>(null);
  useEffect(() => {
    setRequestedItemId(new URLSearchParams(window.location.search).get("travail"));
  }, []);
  const openItems = activeWorkItems(workItems);
  const selectedItem = openItems.find((item) => item.id === context.workItemId) ?? null;

  /*
   * Arriver depuis un créneau du planning (« /timer?travail=… ») présélectionne
   * le travail ET sa matière. Ne s'applique JAMAIS pendant qu'un chrono tourne :
   * réattribuer en cours de route le temps déjà écoulé à un autre travail
   * serait une réécriture silencieuse de l'historique.
   */
  useEffect(() => {
    if (!ready || running || !requestedItemId) return;
    if (context.workItemId === requestedItemId) return;
    const target = openItems.find((item) => item.id === requestedItemId);
    if (!target) return;
    setContext({ subject: target.subject ?? context.subject, workItemId: target.id });
    // `openItems` est recalculé à chaque rendu ; le dépendre ici relancerait
    // l'effet en boucle. L'identifiant demandé et l'état prêt suffisent à
    // décider, et c'est bien ce qu'on surveille.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, running, requestedItemId, context.workItemId]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === " " && document.activeElement?.tagName !== "SELECT") {
        event.preventDefault();
        toggle();
      }
      if (event.key === "Escape" && fullscreen) setFullscreen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullscreen, toggle]);

  function handleStop() {
    stop(({ startedAt, seconds: finalSeconds }) => {
      const session: WorkSession = {
        id: crypto.randomUUID(),
        subject: context.subject,
        // Séance libre depuis le Timer principal : aucun exercice sélectionné.
        exercise_id: null,
        started_at: startedAt,
        ended_at: new Date().toISOString(),
        duration_seconds: finalSeconds,
        note: null,
        created_at: new Date().toISOString(),
        // Séance libre, sans exercice précis : la question "réussi/échoué"
        // n'a pas de sens ici (voir focus-view.tsx pour le seul endroit où
        // un résultat est demandé) — pas davantage celle des indices.
        result: null,
        hints_used: null,
        work_item_id: context.workItemId ?? null,
      };
      saveSessions([session, ...sessions]);
      /*
       * Un travail « à faire » sur lequel on vient de passer du temps est
       * « en cours ». Le statut suit le fait, il ne se déclare pas à la
       * main : sans cela, un DM entamé restait indéfiniment « à faire », et
       * le bilan hebdomadaire comme le planning en donnaient une image
       * fausse. Rien d'autre n'est touché — surtout pas l'échéance, ni
       * l'estimation.
       */
      const target = workItems.find((item) => item.id === context.workItemId);
      if (target && target.status === "à faire") {
        saveWorkItems(workItems.map((item) => (item.id === target.id ? { ...item, status: "en cours" as const } : item)));
      }
    });
  }

  // Tant que la banque locale n'est pas lue, on n'affiche pas de chrono
  // manipulable : « Terminer » enregistrerait alors une séance à partir d'un
  // historique encore vide en mémoire.
  if (!ready) return <Skeleton className="h-72 w-full rounded-xl" />;

  const content = (
    <>
      <p className="t-label flex items-center justify-center gap-2">
        {running && <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-accent" />}
        {running ? "Séance en cours" : "Nouvelle séance"}
      </p>
      {/* DEUX sélecteurs, jamais deux systèmes : le travail planifié d'abord
          (c'est lui qui donne son sens à la séance), la matière ensuite.
          Choisir un travail impose sa matière — on ne chronomètre pas un DM
          de maths « en physique ». « Aucun » reste le premier choix : le
          chronomètre garde son usage libre, exactement comme avant. */}
      {openItems.length > 0 && (
        <label className="mx-auto mt-5 block w-full max-w-[22rem]">
          <span className="sr-only">Travail planifié</span>
          <Select
            value={context.workItemId ?? ""}
            onChange={(event) => {
              const id = event.target.value;
              const target = openItems.find((item) => item.id === id);
              setContext({ subject: target?.subject ?? context.subject, workItemId: id || null });
            }}
            disabled={running}
            className="text-center"
          >
            <option value="">Séance libre — aucun travail planifié</option>
            {openItems.map((item) => (
              <option key={item.id} value={item.id}>
                {WORK_ITEM_KIND_META[item.kind].short} · {item.title}
              </option>
            ))}
          </Select>
        </label>
      )}

      <Select
        value={context.subject}
        onChange={(e) => setContext({ subject: e.target.value as Subject, workItemId: context.workItemId ?? null })}
        disabled={running || selectedItem?.subject != null}
        className="mx-auto mt-3 w-auto min-w-[180px] text-center"
      >
        {subjects.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </Select>

      {selectedItem && (
        <p className="t-meta mt-3">
          Il reste {formatSpan(remainingMinutes(selectedItem, sessions) * 60)} sur ce travail.
        </p>
      )}

      {/* Le chrono est le seul très grand nombre de l'application : composé en
          serif à taille optique, il se lit d'un mètre — exactement l'usage
          (poser le téléphone à côté de la copie). Il ne « pulse » plus à
          chaque seconde : un chiffre qui tressaute une fois par seconde,
          pendant une heure, dans le champ de vision de quelqu'un qui essaie
          de se concentrer, est le contraire d'un outil de concentration. */}
      <div className="t-figure mt-10 text-[clamp(3.5rem,2rem+8vw,7rem)]">{formatDuration(seconds)}</div>

      <p className="mt-4 text-sm text-muted">
        {running ? "Concentre-toi. Le reste peut attendre." : "Choisis une matière et commence."}
      </p>

      <div className="mt-10 flex justify-center gap-3">
        {running ? (
          <Button size="lg" variant="secondary" onClick={toggle}>
            <Pause size={18} /> Pause
          </Button>
        ) : (
          <Button size="lg" onClick={start}>
            <Play size={18} /> {seconds ? "Reprendre" : "Démarrer"}
          </Button>
        )}
        {seconds > 0 && (
          <Button size="lg" variant="secondary" onClick={handleStop}>
            <Square size={18} /> Terminer
          </Button>
        )}
        <Button size="icon" variant="ghost" onClick={() => setFullscreen((f) => !f)} aria-label={fullscreen ? "Quitter plein écran" : "Plein écran"}>
          {fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </Button>
      </div>

      {/* Un raccourci clavier n'a de sens que là où il existe un clavier.
          Sur un téléphone, cette ligne occupait une place réelle sous les
          boutons pour annoncer une touche que l'appareil n'a pas. */}
      <p className="t-meta mt-7 hidden text-2xs lg:block">Barre d&apos;espace pour démarrer / pause</p>
    </>
  );

  if (fullscreen) {
    return (
      <div className="animate-fade-in fixed inset-0 z-50 flex flex-col items-center justify-center bg-canvas text-center">
        {content}
      </div>
    );
  }

  return <div className="surface mx-auto max-w-2xl p-7 text-center md:p-12">{content}</div>;
}
