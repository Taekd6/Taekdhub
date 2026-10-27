/**
 * VACANCES ET JOURS FÉRIÉS DU LYCÉE (mission 26) — dates relevées dans
 * l'agenda du Cahier de Prépa de la classe (cahier-de-prepa.fr/mp-pascal),
 * année 2026-2027. Ces jours-là, l'élève n'a pas cours : la semaine et
 * l'accueil n'affichent pas les cours, TD, TP, colles et DS de son emploi du
 * temps (qui se répètent pourtant dans l'agenda), seulement ses tâches et ses
 * événements perso. Bornes incluses, au format AAAA-MM-JJ.
 */
export const OFF_PERIODS: { label: string; from: string; to: string }[] = [
  { label: "Vacances de la Toussaint", from: "2026-10-18", to: "2026-11-01" },
  { label: "Armistice 1918", from: "2026-11-11", to: "2026-11-11" },
  { label: "Vacances de Noël", from: "2026-12-20", to: "2027-01-03" },
  { label: "Vacances d'hiver", from: "2027-02-14", to: "2027-02-28" },
  { label: "Lundi de Pâques", from: "2027-03-29", to: "2027-03-29" },
  { label: "Vacances de printemps", from: "2027-04-11", to: "2027-04-25" },
  { label: "Fête du travail", from: "2027-05-01", to: "2027-05-01" },
  { label: "Pont de l'Ascension", from: "2027-05-06", to: "2027-05-09" },
  { label: "Lundi de Pentecôte", from: "2027-05-17", to: "2027-05-17" },
];

/** La période sans cours qui contient ce jour (AAAA-MM-JJ), ou null. */
export function offPeriodOf(day: string): { label: string; from: string; to: string } | null {
  return OFF_PERIODS.find((period) => day >= period.from && day <= period.to) ?? null;
}

/** Jour (AAAA-MM-JJ, heure locale) d'une date ISO. */
function dayOf(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Retire les cours du lycée tombant un jour sans cours. Restent : les
 * événements perso, et les créneaux de révision que l'élève a lui-même posés
 * dans son agenda — ceux du soir (à partir de 18 h 30, après la fin des cours)
 * et ceux du dimanche (jamais de cours ce jour-là).
 */
export function withoutSchoolOnOffDays<T extends { start: string; kind: string; allDay?: boolean }>(events: T[]): T[] {
  return events.filter((event) => {
    if (event.kind === "perso" || !offPeriodOf(dayOf(event.start))) return true;
    if (event.allDay) return false;
    const date = new Date(event.start);
    if (date.getDay() === 0) return true;
    return date.getHours() * 60 + date.getMinutes() >= 18 * 60 + 30;
  });
}
