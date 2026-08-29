import { PageHeader } from "@/components/page-header";
import { NotionRadiography } from "@/components/notions/notion-radiography";

export const metadata = { title: "Radiographie" };

export default function NotionsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Radiographie"
        title="Tes notions, pas tes chapitres"
        description="Ce que tes exercices réclament vraiment, et ce que tu as démontré dessus."
      />
      <NotionRadiography />
    </>
  );
}
