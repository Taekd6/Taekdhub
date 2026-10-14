"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ExternalLink, Plus, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { PageHero } from "@/components/ui/page-hero";
import { EmptyState, Skeleton } from "@/components/ui/state";
import { SheetForm } from "@/components/training/sheet-form";
import { sheetLabel, SheetRunner } from "@/components/training/sheet-runner";
import { useAnnales } from "@/hooks/use-annales";
import { useExerciseSheets } from "@/hooks/use-exercise-sheets";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { EXERCISE_LEVEL_LABEL, EXERCISE_LEVELS, isCleanSuccess, type ExerciseLevel } from "@/lib/attempts";
import { SHEET_ORIGIN_LABEL, sheetHref, sheetIdOfKey, sheetsForChapter, type ExerciseSheet, type SheetStatus } from "@/lib/exercise-sheets";
import { PROGRAMME_BY_ID } from "@/lib/programme-data";

/**
 * L'ENTRAÎNEMENT — le point d'entrée vers l'exercice.
 *
 *   ?fiche=<id>                 le lecteur : énoncé, puis indices, puis correction ;
 *   ?chapitre=<id>&niveau=<n>   les exercices d'un chapitre (depuis le programme
 *                               de révision), ou l'ajout d'un exercice pour lui ;
 *   (rien)                      tous les exercices de l'appareil.
 *
 * Un exercice est une FICHE (lib/exercise-sheets.ts) : matière, chapitre,
 * compétence, difficulté, origine (IA ou ressource externe, avec sa source et
 * son lien). Les essais sont des tentatives du suivi existant.
 */
export function TrainingScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const { attempts, saveAttempts, saveSessions, preferences, ready } = usePrepahubData();
  const { logs: annales } = useAnnales();
  const { sheets, ready: sheetsReady, save, remove } = useExerciseSheets();
  const [adding, setAdding] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const ficheId = params.get("fiche");
  const chapterParam = params.get("chapitre");
  const chapter = chapterParam ? PROGRAMME_BY_ID.get(chapterParam) ?? null : null;
  const levelParam = params.get("niveau");
  const level: ExerciseLevel | null = (EXERCISE_LEVELS as readonly string[]).includes(levelParam ?? "") ? (levelParam as ExerciseLevel) : null;

  const statuses = useMemo(() => {
    const byId = new Map<string, { count: number; proven: boolean; last: string }>();
    for (const attempt of attempts) {
      const id = sheetIdOfKey(attempt.exerciseKey);
      if (!id) continue;
      const current = byId.get(id);
      if (!current || attempt.createdAt > current.last) byId.set(id, { count: (current?.count ?? 0) + 1, proven: isCleanSuccess(attempt), last: attempt.createdAt });
      else byId.set(id, { ...current, count: current.count + 1 });
    }
    return new Map<string, SheetStatus>([...byId].map(([id, value]) => [id, { attempts: value.count, proven: value.proven }]));
  }, [attempts]);

  const shown = useMemo(() => (chapter ? sheetsForChapter(sheets, statuses, chapter.id, level) : sheets), [sheets, statuses, chapter, level]);

  if (!ready || !sheetsReady) {
    return (
      <div className="mx-auto max-w-[44rem] space-y-4">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  /* ── Le lecteur ── */
  if (ficheId) {
    const sheet = sheets.find((entry) => entry.id === ficheId);
    return (
      <div className="mx-auto max-w-[44rem] space-y-6">
        <PageHero title="Entraînement" lede="L'énoncé d'abord. Les indices et la correction, seulement si tu en as besoin." />
        {sheet ? (
          <SheetRunner
            key={sheet.id}
            sheet={sheet}
            attempts={attempts}
            annales={annales}
            retryDelaysDays={preferences.retryDelaysDays}
            saveAttempts={saveAttempts}
            saveSessions={saveSessions}
            onDelete={() => {
              remove(sheet.id);
              router.push("/entrainement");
            }}
          />
        ) : (
          <EmptyState
            title="Cette fiche n'est pas sur cet appareil."
            description="Les fiches d'exercice restent sur l'appareil où elles ont été ajoutées (leurs essais, eux, sont dans ton suivi). Ajoute l'exercice ici pour le refaire."
            action={
              <Link href="/entrainement" className={buttonVariants({ variant: "primary", size: "md" })}>
                Voir mes exercices
              </Link>
            }
          />
        )}
      </div>
    );
  }

  /* ── La liste, et l'ajout ── */
  const showForm = adding || (Boolean(chapter) && shown.length === 0 && !dismissed);
  return (
    <div className="mx-auto max-w-[44rem] space-y-6">
      <PageHero title="Entraînement" lede={chapter ? `Un exercice sur « ${chapter.title} »${level ? `, niveau ${EXERCISE_LEVEL_LABEL[level].toLowerCase()}` : ""}.` : "Tes exercices, avec leur chapitre, leur compétence et leur source."} />

      {showForm ? (
        <SheetForm
          initial={chapter ? { chapterId: chapter.id, level: level ?? undefined } : undefined}
          onCancel={() => {
            setAdding(false);
            setDismissed(true);
          }}
          onSave={(sheet) => {
            if (!save(sheet)) return false;
            router.push(sheetHref(sheet.id));
            return true;
          }}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={() => setAdding(true)}>
            <Plus size={16} aria-hidden /> Ajouter un exercice
          </Button>
          {chapter && (
            <Link href="/entrainement" className={buttonVariants({ variant: "ghost", size: "md" })}>
              Tous les exercices
            </Link>
          )}
        </div>
      )}

      {shown.length === 0 && !showForm ? (
        <EmptyState
          title={chapter ? "Aucun exercice pour ce chapitre." : "Aucun exercice pour l'instant."}
          description="Ajoute un exercice : un énoncé généré avec Claude, ou une ressource externe dont tu gardes la source."
        />
      ) : shown.length > 0 ? (
        <section aria-labelledby="exercices-titre" className="surface p-2 sm:p-3">
          <h2 id="exercices-titre" className="t-label px-3 pt-3">
            {chapter ? "Exercices de ce chapitre" : "Tes exercices"} · {shown.length}
          </h2>
          <ul className="mt-1 divide-y divide-line">
            {shown.map((sheet) => (
              <li key={sheet.id}>
                <SheetRow sheet={sheet} status={statuses.get(sheet.id)} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="px-1 text-[0.8125rem] font-semibold leading-snug text-muted">
        Les exercices restent sur cet appareil et sont inclus dans la sauvegarde exportée. Tes essais, eux, sont synchronisés avec ton compte et alimentent « À refaire », le diagnostic et le programme de révision.
      </p>
    </div>
  );
}

function SheetRow({ sheet, status }: { sheet: ExerciseSheet; status: SheetStatus | undefined }) {
  return (
    <Link href={sheetHref(sheet.id)} className="row-hover flex min-w-0 items-center gap-3 rounded-xl px-3 py-3.5 max-lg:min-h-[3.25rem]">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.9375rem] font-semibold text-ink">{sheetLabel(sheet)}</span>
        <span className="block truncate t-meta text-2xs">{sheet.competence}</span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5">
          <Badge variant={sheet.origin === "ia" ? "accent" : "default"}>
            {sheet.origin === "ia" ? <Sparkles size={11} aria-hidden /> : <ExternalLink size={11} aria-hidden />} {SHEET_ORIGIN_LABEL[sheet.origin]}
          </Badge>
          <Badge>{EXERCISE_LEVEL_LABEL[sheet.level].split(" (")[0]}</Badge>
          {sheet.source && <Badge variant="bare">{sheet.source.name}</Badge>}
        </span>
      </span>
      <span className="shrink-0 text-right text-[0.8125rem] font-semibold text-muted">
        {status?.proven ? <span className="text-emerald-300">Réussi sans aide</span> : status ? `${status.attempts} essai${status.attempts > 1 ? "s" : ""}` : "À faire"}
      </span>
    </Link>
  );
}
