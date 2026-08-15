/**
 * Seuil de confirmation de sortie du Focus (Sprint résilience Focus +
 * Chronomètre) — point d'entrée unique pour éviter une valeur magique
 * dispersée entre le composant et ses tests.
 */
export const CONFIRM_EXIT_THRESHOLD_SECONDS = 120;

/**
 * Faut-il confirmer avant de quitter le Focus ? Une séance très courte
 * (< CONFIRM_EXIT_THRESHOLD_SECONDS) se ferme directement — rien de notable
 * n'est en jeu. Une séance déjà en pause ne demande jamais confirmation non
 * plus : rien ne "tourne" activement à interrompre en la quittant.
 */
export function shouldConfirmExit(seconds: number, running: boolean): boolean {
  return running && seconds >= CONFIRM_EXIT_THRESHOLD_SECONDS;
}
