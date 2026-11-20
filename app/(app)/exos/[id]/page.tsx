import { notFound } from "next/navigation";
import { ExosChapter } from "@/components/exos/exos-chapter";
import { PROGRAMME, PROGRAMME_BY_ID } from "@/lib/programme-data";

export const dynamicParams = false;

export function generateStaticParams() {
  return PROGRAMME.map((chapter) => ({ id: chapter.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const chapter = PROGRAMME_BY_ID.get((await params).id);
  return { title: `Exos · ${chapter?.title ?? "Chapitre"} — TaekdHub` };
}

/** Les exos d'un chapitre : annales, BEOS et manuels, une case par question (components/exos/exos-chapter.tsx). */
export default async function ExosChapterPage({ params }: { params: Promise<{ id: string }> }) {
  const chapter = PROGRAMME_BY_ID.get((await params).id);
  if (!chapter) notFound();
  return <ExosChapter chapter={chapter} />;
}
