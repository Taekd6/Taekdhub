import { ProgramCalendar } from "@/components/calendar/program-calendar";

export const metadata = { title: "Calendrier — TaekdHub" };

/** Le programme de fin de vacances, jour par jour (lib/holiday-program.ts). */
export default function CalendrierPage() {
  return <ProgramCalendar />;
}
