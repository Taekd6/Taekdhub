/**
 * Micro-sprint « Ah ouais » — micro-amélioration optionnelle « contexte
 * temporel léger ». Volontairement minimal : une seule phrase courte, jamais
 * une notification, un calendrier ni une nouvelle logique de comportement
 * (voir le brief : "si cela devient artificiel... ne pas l'implémenter").
 *
 * Ne remplace pas la salutation existante ("Bonjour, {prénom}." —
 * app/(app)/dashboard/page.tsx) : varie uniquement le MOT selon l'heure
 * locale, pour garder la personnalisation par prénom déjà en place.
 */
export function timeOfDayGreetingWord(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "Bonjour";
  if (hour < 18) return "Bon après-midi";
  return "Bonsoir";
}
