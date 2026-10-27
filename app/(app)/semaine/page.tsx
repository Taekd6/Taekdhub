import type { Metadata } from "next";
import { WeekScreen } from "@/components/week/week-screen";

export const metadata: Metadata = { title: "Ma semaine" };

/** Ma semaine — voir components/week/week-screen.tsx. */
export default function SemainePage() {
  return <WeekScreen />;
}
