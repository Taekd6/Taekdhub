"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Maximize2, Minimize2, Pause, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
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
  if (!ready) return <Card className="h-64 animate-pulse p-8" />;

  const content = (
    <>
      <p className="eyebrow flex items-center justify-center gap-2">
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

      <motion.div
        key={seconds}
        initial={running ? { scale: 1.02 } : false}
        animate={{ scale: 1 }}
        className="mt-10 text-6xl font-semibold tabular-nums tracking-tight md:text-8xl"
      >
        {formatDuration(seconds)}
      </motion.div>

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

      <p className="mt-6 text-xs text-zinc-600">Barre d&apos;espace pour démarrer / pause</p>
    </>
  );

  if (fullscreen) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-canvas text-center"
      >
        {content}
      </motion.div>
    );
  }

  return (
    <Card className="mx-auto max-w-2xl rounded-3xl p-7 text-center md:p-12">
      {content}
    </Card>
  );
}
