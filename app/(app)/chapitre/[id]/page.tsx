import { notFound } from "next/navigation";
import { ChapterPage } from "@/components/chapitre/chapter-page";
import { PROGRAMME, PROGRAMME_BY_ID } from "@/lib/programme-data";

export const dynamicParams = false;

export function generateStaticParams() {
  return PROGRAMME.map((chapter) => ({ id: chapter.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const chapter = PROGRAMME_BY_ID.get((await params).id);
  return { title: `${chapter?.title ?? "Chapitre"} — TaekdHub` };
}

/**
 * La page d'un chapitre du programme : cours retapé, méthodes, erreurs et
 * cartes Anki (components/chapitre/chapter-page.tsx). Les chapitres sont
 * ceux de lib/programme-data.ts : un autre identifiant est un 404.
 */
export default async function ChapitrePage({ params }: { params: Promise<{ id: string }> }) {
  const chapter = PROGRAMME_BY_ID.get((await params).id);
  if (!chapter) notFound();
  return <ChapterPage chapter={chapter} />;
}
