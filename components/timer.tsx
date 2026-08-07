"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Maximize2, Minimize2, Pause, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { subjects } from "@/lib/study";
import { formatDuration } from "@/lib/utils";
import type { Subject, WorkSession } from "@/lib/supabase/types";
import { cn } from "@/lib/cn";

export function Timer() {
  const { sessions, saveSessions } = usePrepahubData();
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [subject, setSubject] = useState<Subject>("Mathématiques");
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === " " && document.activeElement?.tagName !== "SELECT") {
        event.preventDefault();
        if (seconds === 0 && !startedAt) setStartedAt(new Date().toISOString());
        setRunning((r) => !r);
      }
      if (event.key === "Escape" && fullscreen) setFullscreen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullscreen, seconds, startedAt]);

  function start() {
    if (!startedAt) setStartedAt(new Date().toISOString());
    setRunning(true);
  }

  function stop() {
    if (seconds > 0 && startedAt) {
      const session: WorkSession = {
        id: crypto.randomUUID(),
        subject,
        started_at: startedAt,
        ended_at: new Date().toISOString(),
        duration_seconds: seconds,
        note: null,
      };
      saveSessions([session, ...sessions]);
    }
    setRunning(false);
    setSeconds(0);
    setStartedAt(null);
  }

  const content = (
    <>
      <p className="eyebrow">Séance en cours</p>
      <Select
        value={subject}
        onChange={(e) => setSubject(e.target.value as Subject)}
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
          <Button size="lg" variant="secondary" onClick={() => setRunning(false)}>
            <Pause size={18} /> Pause
          </Button>
        ) : (
          <Button size="lg" onClick={start}>
            <Play size={18} /> {seconds ? "Reprendre" : "Démarrer"}
          </Button>
        )}
        {seconds > 0 && (
          <Button size="lg" variant="secondary" onClick={stop}>
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
