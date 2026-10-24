"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Illustration } from "@/components/ui/illustrations";
import { PageHero } from "@/components/ui/page-hero";
import { Section } from "@/components/ui/section";
import { EmptyState, Skeleton } from "@/components/ui/state";
import { Tabs } from "@/components/ui/tabs";
import { PdfButton } from "@/components/chapitre/pdf-button";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { chapterErrors, formatStamp, notesFor, parseCourse, type CourseBlock } from "@/lib/chapter-notes";
import { errorsDocument, methodsDocument, pdfFileName } from "@/lib/chapter-pdf";
import { COURSE_CHAPTERS, COURSE_DECK_URL, courseDeckName } from "@/lib/course-cards";
import { ERROR_SOURCE_META, ERROR_TYPE_META } from "@/lib/error-log";
import { formatDate } from "@/lib/erreurs-anglais";
import type { ProgrammeChapter } from "@/lib/programme-data";

/**
 * /chapitre/<id> — LA PAGE D'UN CHAPITRE : tout ce que TaekdHub sait de lui,
 * au même endroit.
 *
 *   Cours      le cours du professeur, retapé par Claude (`save_course`) ;
 *   Méthodes   « Quand je vois… » → étapes → piège (`add_methods`), en PDF ;
 *   Erreurs    celles du carnet rattachées à ce chapitre (`add_errors`), en PDF ;
 *   Cartes     les cartes Anki du chapitre, et le lien vers la page Anki.
 *
 * Rien ne se saisit ici : le contenu arrive par le connecteur de Claude, dans
 * la conversation où l'élève travaille (lib/chapter-notes.ts).
 */
export function ChapterPage({ chapter }: { chapter: ProgrammeChapter }) {
  const { chapterNotes, errors, ready } = usePrepahubData();
  const notes = useMemo(() => notesFor(chapterNotes, chapter.id), [chapterNotes, chapter.id]);
  const chapterErrorList = useMemo(() => chapterErrors(errors, chapter.id), [errors, chapter.id]);
  const methodes = notes?.methodes ?? [];

  const cards = COURSE_CHAPTERS.find((entry) => entry.chapterId === chapter.id) ?? null;

  if (!ready) {
    return (
      <div className="mx-auto max-w-[56rem] space-y-6">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[56rem] space-y-8">
      <PageHero
        eyebrow={`${chapter.subject} · ${chapter.year === 2 ? "Spé" : "Sup"}`}
        title={chapter.title}
        lede="Le cours, les méthodes, tes erreurs et tes cartes."
        illustration={<Illustration name="notes" size={56} />}
        actions={
          <Link href="/programme" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            <ArrowLeft size={14} aria-hidden /> Programme
          </Link>
        }
      />

      <Tabs
        ariaLabel="Contenu du chapitre"
        syncHash
        align="start"
        items={[
          {
            id: "cours",
            label: "Cours",
            content: <CourseTab text={notes?.cours ?? null} updatedAt={notes?.coursUpdatedAt ?? null} />,
          },
          {
            id: "methodes",
            label: `Méthodes${methodes.length ? ` ${methodes.length}` : ""}`,
            content: (
              <Section
                variant="panel"
                title="Méthodes"
                action={methodes.length > 0 ? <PdfButton label="Télécharger le PDF" fileName={pdfFileName(chapter, "methodes")} build={() => methodsDocument(chapter, methodes, new Date())} /> : undefined}
              >
                {methodes.length === 0 ? (
                  <EmptyState className="py-8" title="Aucune méthode rangée" description="Quand Claude te donne une méthode sur ce chapitre, demande-lui de la ranger ici : elle y sera, avec son PDF." />
                ) : (
                  <ul className="space-y-4">
                    {methodes.map((methode) => (
                      <li key={methode.id} className="rounded-2xl bg-inset p-5">
                        <p className="t-subhead font-bold">{methode.titre}</p>
                        <p className="t-body mt-2">
                          <span className="font-bold">Quand : </span>
                          {methode.quand}
                        </p>
                        <ol className="t-body mt-3 list-decimal space-y-1.5 pl-6">
                          {methode.etapes.map((etape, index) => (
                            <li key={index}>{etape}</li>
                          ))}
                        </ol>
                        {methode.piege && (
                          <p className="t-body mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3">
                            <span className="font-bold text-amber-300">Piège : </span>
                            {methode.piege}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            ),
          },
          {
            id: "erreurs",
            label: `Erreurs${chapterErrorList.length ? ` ${chapterErrorList.length}` : ""}`,
            content: (
              <Section
                variant="panel"
                title="Erreurs"
                action={chapterErrorList.length > 0 ? <PdfButton label="Télécharger le PDF" fileName={pdfFileName(chapter, "erreurs")} build={() => errorsDocument(chapter, chapterErrorList, new Date())} /> : undefined}
              >
                {chapterErrorList.length === 0 ? (
                  <EmptyState className="py-8" title="Aucune erreur sur ce chapitre" description="Dis à Claude les erreurs que tu fais en travaillant ce chapitre : il les range ici, avec ce qu'il faut retenir." />
                ) : (
                  <ul className="space-y-4">
                    {chapterErrorList.map((entry) => (
                      <li key={entry.id} className="rounded-2xl bg-inset p-5">
                        <p className="t-meta">
                          {formatDate(entry.date)} · {ERROR_SOURCE_META[entry.source].label} · {ERROR_TYPE_META[entry.type].label}
                        </p>
                        <p className="t-body mt-1.5">
                          <span className="font-bold text-rose-300">Erreur : </span>
                          {entry.description}
                        </p>
                        {entry.fix && (
                          <p className="t-body mt-1.5">
                            <span className="font-bold text-emerald-300">À retenir : </span>
                            {entry.fix}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            ),
          },
          {
            id: "cartes",
            label: `Cartes${cards ? ` ${cards.cards.length}` : ""}`,
            content: (
              <Section
                variant="panel"
                title="Cartes Anki"
                description={cards ? `Paquet ${courseDeckName(cards)}` : undefined}
                action={
                  <Link href="/anki" className={buttonVariants({ variant: "secondary", size: "md" })}>
                    Ouvrir Anki
                  </Link>
                }
              >
                {!cards ? (
                  <EmptyState className="py-8" title="Pas encore de cartes pour ce chapitre" description="Les cartes de cours existent pour la spé de maths. Claude peut aussi en créer sur ce qui t'a manqué (fiches « verrou »)." />
                ) : (
                  <>
                    <ul className="space-y-3">
                      {cards.cards.map((card, index) => (
                        <li key={index} className="rounded-2xl bg-inset p-4">
                          <p className="t-meta capitalize">{card.kind}</p>
                          <p className="t-body mt-1 font-semibold">{card.front}</p>
                          <p className="t-body mt-1.5 whitespace-pre-line text-muted">{card.back}</p>
                        </li>
                      ))}
                    </ul>
                    <p className="t-meta mt-5">
                      Le paquet complet des 13 chapitres de maths se télécharge{" "}
                      <a href={COURSE_DECK_URL} className="text-accent underline-offset-[3px] hover:underline">
                        ici (.apkg)
                      </a>
                      , à ouvrir dans Anki.
                    </p>
                  </>
                )}
              </Section>
            ),
          },
        ]}
      />
    </div>
  );
}

function CourseTab({ text, updatedAt }: { text: string | null; updatedAt: string | null }) {
  const blocks = useMemo(() => (text ? parseCourse(text) : []), [text]);
  return (
    <Section variant="panel" title="Cours" description={updatedAt ? `Retapé depuis ton PDF · mis à jour le ${formatStamp(updatedAt)}` : undefined}>
      {!text ? (
        <EmptyState
          className="py-8"
          title="Pas encore de cours ici"
          description="Envoie le PDF (ou les photos) de ton cours à Claude dans la conversation : il le retape proprement et le range ici. Il pourra ensuite s'y référer avant de te proposer des exercices."
        />
      ) : (
        <div className="space-y-4">{blocks.map((block, index) => renderBlock(block, index))}</div>
      )}
    </Section>
  );
}

function renderBlock(block: CourseBlock, key: number) {
  if (block.kind === "titre") {
    const className = block.niveau === 1 ? "t-heading pt-4" : block.niveau === 2 ? "t-subhead pt-3 font-bold" : "t-body pt-2 font-bold";
    return (
      <p key={key} role="heading" aria-level={block.niveau + 2} className={className}>
        {block.texte}
      </p>
    );
  }
  if (block.kind === "liste") {
    return (
      <ul key={key} className="t-read list-disc space-y-1 pl-6">
        {block.items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    );
  }
  return (
    <p key={key} className="t-read whitespace-pre-line">
      {block.texte}
    </p>
  );
}
