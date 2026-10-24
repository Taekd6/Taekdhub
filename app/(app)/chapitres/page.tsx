import { ChaptersList } from "@/components/chapitre/chapters-list";

export const metadata = { title: "Mes chapitres — TaekdHub" };

/** La liste de tous les chapitres du programme et de ce qu'on en a rangé (lib/chapters-overview.ts) ; chacun ouvre sa page `/chapitre/<id>`. */
export default function ChapitresPage() {
  return <ChaptersList />;
}
