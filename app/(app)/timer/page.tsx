import { PageBar, Stack } from "@/components/ui/layout";
import { Timer } from "@/components/timer";

export default function TimerPage() {
  return (
    <Stack className="space-y-8">
      <PageBar
        title="Chronomètre"
        lede="Lance le chrono quand tu te mets au travail — une feuille d'exercices, un DM, une relecture de cours."
      />
      <Timer />
    </Stack>
  );
}
