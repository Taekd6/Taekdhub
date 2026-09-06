import { PageBar, Stack } from "@/components/ui/layout";
import { Timer } from "@/components/timer";

export default function TimerPage() {
  return (
    <Stack className="space-y-8">
      <PageBar
        title="Chronomètre"
        lede="Pour le travail qui ne passe pas par un exercice de la banque — un DM, une relecture de cours."
      />
      <Timer />
    </Stack>
  );
}
