"use client";

import { useEffect, useState } from "react";
import { Maximize2, Minimize2, Pause, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/state";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { useWorkTimer } from "@/hooks/use-work-timer";
import { subjects } from "@/lib/study";
import { formatDuration } from "@/lib/utils";
import type { Subject, WorkSession } from "@/lib/supabase/types";

const TIMER_STORAGE_KEY = "prepahub:timer:free";

interface TimerContext {
  subject: Subject;
}

export function Timer() {
  // `ready` est indispensable ici comme partout ailleurs : le chrono restaure
  // une séance persistée dès son premier effet, donc "Terminer" est cliquable
  // avant même que la banque locale ait fini d'être lue.
  const { sessions, saveSessions, ready } = usePrepahubData();
  const { seconds, running, context, setContext, start, toggle, stop } = useWorkTimer<TimerContext>(TIMER_STORAGE_KEY, {
    subject: "Mathématiques",
  });
  const [fullscreen, setFullscreen] = useState(false);

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
      };
      saveSessions([session, ...sessions]);
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
      <Select
        value={context.subject}
        onChange={(e) => setContext({ subject: e.target.value as Subject })}
        disabled={running}
        className="mx-auto mt-5 w-auto min-w-[180px] text-center"
      >
        {subjects.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </Select>

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

      <p className="t-meta mt-7 text-2xs">Barre d&apos;espace pour démarrer / pause</p>
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
