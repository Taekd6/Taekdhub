"use client";

import { Clock3 } from "lucide-react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { formatDuration } from "@/lib/utils";
import { subjectMeta } from "@/lib/study";
import { cn } from "@/lib/cn";

export function SessionHistory() {
  const { sessions, ready } = usePrepahubData();

  if (!ready) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="surface h-16 animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  if (!sessions.length) {
    return (
      <Card className="p-12 text-center">
        <Clock3 className="mx-auto text-accent" />
        <p className="mt-4 font-medium">Ton historique est prêt.</p>
        <p className="mt-2 text-sm text-muted">Les séances terminées apparaîtront ici.</p>
      </Card>
    );
  }

  const sorted = [...sessions].sort(
    (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
  );

  return (
    <div className="space-y-3">
      {sorted.map((session, index) => (
        <motion.article
          key={session.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.03 }}
          className="surface flex items-center justify-between rounded-xl p-4 transition hover:border-white/[0.12]"
        >
          <div className="flex items-center gap-3">
            <span className={cn("grid h-8 w-8 place-items-center rounded-lg text-xs font-bold", subjectMeta[session.subject].className)}>
              {subjectMeta[session.subject].short}
            </span>
            <div>
              <p className="font-medium">{session.subject}</p>
              <p className="mt-0.5 text-xs text-muted">
                {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(session.started_at))}
              </p>
            </div>
          </div>
          <p className="font-semibold tabular-nums text-accent">{formatDuration(session.duration_seconds)}</p>
        </motion.article>
      ))}
    </div>
  );
}
