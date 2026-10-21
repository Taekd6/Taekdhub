import { SessionDetail } from "@/components/calendar/session-detail";
import { HOLIDAY_PROGRAM } from "@/lib/holiday-program";

export const metadata = { title: "Séance — TaekdHub" };

/** La page d'une séance : ce que le lien de l'événement du Calendrier Apple ouvre. */
export function generateStaticParams() {
  return HOLIDAY_PROGRAM.map((session) => ({ id: session.id }));
}

export default async function SeancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SessionDetail id={id} />;
}
