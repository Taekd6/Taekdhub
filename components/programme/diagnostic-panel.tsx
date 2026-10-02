"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Section } from "@/components/ui/section";
import { cn } from "@/lib/cn";
import { FINDING_LABEL, mainFinding, type ChapterDiagnosis } from "@/lib/diagnostic";
import type { DiagnosticContext } from "@/lib/diagnostic-context";

const STATE_TONE = { tient: "text-emerald-300", fragile: "text-rose-300", inconnu: "text-subtle" } as const;
const STATE_WORD = { tient: "tient", fragile: "fragile", inconnu: "inconnu" } as const;

/**
 * LE POINT FAIBLE PRINCIPAL — en tête de la carte du programme.
 *
 * Le chapitre que le diagnostic (lib/diagnostic.ts) classe en premier, son
 * constat principal, les faits qui le fondent, l'action et son critère de
 * fin. Puis, repliés, les suivants. Sans constat : un message honnête, qui
 * dit ce qui manque pour en établir un.
 */
export function DiagnosticPanel({ context }: { context: DiagnosticContext }) {
  const [more, setMore] = useState(false);
  const [first, ...others] = context.ranked;
  const insufficient = context.diagnoses.filter((diagnosis) => diagnosis.insufficient).length;

  if (!first) {
    return (
      <Section variant="feature" title="Ton point faible principal">
        <p className="text-[0.9375rem] font-semibold text-ink">Pas encore assez de données pour l&apos;établir.</p>
        <p className="t-meta mt-2 max-w-[60ch]">
          Un constat demande au moins 3 exercices notés sur un chapitre, ou 2 erreurs du même type reliées à un chapitre (débrief de DS), ou un chapitre qui s&apos;efface dans Mémoire, ou 20 cartes Anki révisées dans un paquet associé.
          {insufficient > 0 ? ` ${insufficient} chapitre${insufficient > 1 ? "s ont" : " a"} déjà quelques traces.` : ""}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/debrief" className="inline-flex min-h-10 items-center rounded-full bg-inset px-4 text-sm font-bold text-ink max-lg:min-h-11">
            Débriefer un DS
          </Link>
          <Link href="/anki" className="inline-flex min-h-10 items-center rounded-full bg-inset px-4 text-sm font-bold text-ink max-lg:min-h-11">
            Relier Anki
          </Link>
        </div>
      </Section>
    );
  }

  return (
    <Section variant="feature" title="Ton point faible principal" description="D'après tes exercices, tes erreurs, ta mémoire et Anki — seulement ce que les données établissent.">
      <DiagnosisDetail diagnosis={first} primary />
      {context.ankiStale && <p className="t-meta mt-4 text-2xs">Le dernier relevé Anki a plus de 7 jours : il n&apos;est pas utilisé.</p>}
      {others.length > 0 && (
        <>
          <button type="button" onClick={() => setMore((value) => !value)} aria-expanded={more} className="mt-5 inline-flex min-h-10 items-center gap-1 text-sm font-bold text-accent hover:underline max-lg:min-h-11">
            {others.length} autre{others.length > 1 ? "s" : ""} chapitre{others.length > 1 ? "s" : ""} à surveiller <ChevronDown size={15} aria-hidden className={cn("transition-transform", more && "rotate-180")} />
          </button>
          {more && (
            <ul className="mt-3 space-y-5 border-t border-line pt-4">
              {others.slice(0, 8).map((diagnosis) => (
                <li key={diagnosis.chapter.id}>
                  <DiagnosisDetail diagnosis={diagnosis} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Section>
  );
}

function DiagnosisDetail({ diagnosis, primary = false }: { diagnosis: ChapterDiagnosis; primary?: boolean }) {
  const finding = mainFinding(diagnosis)!;
  return (
    <div>
      <p className={cn(primary ? "t-heading leading-snug" : "text-[0.9375rem] font-extrabold text-ink")}>
        {diagnosis.chapter.title}
        <span className="ml-2 align-middle text-[0.8125rem] font-bold text-subtle">{diagnosis.chapter.subject}</span>
      </p>
      <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {diagnosis.findings.map((entry) => (
          <Badge key={entry.kind} variant={entry.kind === finding.kind ? "danger" : "default"}>
            {FINDING_LABEL[entry.kind]} · {entry.level}
          </Badge>
        ))}
        {diagnosis.examInDays !== null && <Badge variant="warning">épreuve dans {diagnosis.examInDays} j</Badge>}
      </p>
      <dl className="mt-3 grid gap-1 text-[0.8125rem] sm:grid-cols-2">
        <div>
          <dt className="inline font-bold text-subtle">Cours : </dt>
          <dd className={cn("inline font-semibold", STATE_TONE[diagnosis.course.state])}>
            {STATE_WORD[diagnosis.course.state]}
            <span className="text-muted"> — {diagnosis.course.detail}</span>
          </dd>
        </div>
        <div>
          <dt className="inline font-bold text-subtle">Application : </dt>
          <dd className={cn("inline font-semibold", STATE_TONE[diagnosis.application.state])}>
            {STATE_WORD[diagnosis.application.state]}
            <span className="text-muted"> — {diagnosis.application.detail}</span>
          </dd>
        </div>
      </dl>
      <ul className="mt-3 list-disc space-y-0.5 pl-5 text-[0.8125rem] text-muted">
        {finding.evidence.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="mt-3 text-[0.9375rem] font-bold text-ink">→ {finding.action}</p>
      <p className="t-meta mt-1 text-[0.8125rem]">Terminé quand : {finding.doneWhen}</p>
      {diagnosis.retryKeys.length > 0 && (
        <Link href="/annales" className="mt-2 inline-flex min-h-10 items-center gap-1 text-sm font-bold text-accent hover:underline max-lg:min-h-11">
          {diagnosis.retryKeys.length} exercice{diagnosis.retryKeys.length > 1 ? "s" : ""} à refaire sans aide <ArrowRight size={14} aria-hidden />
        </Link>
      )}
    </div>
  );
}
