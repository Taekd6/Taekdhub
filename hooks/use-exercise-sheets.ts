"use client";

import { useCallback, useEffect, useState } from "react";
import { removeSheet, upsertSheet, type ExerciseSheet } from "@/lib/exercise-sheets";
import { localData } from "@/lib/storage";

const KEY = "prepahub:exercise-sheets";

/**
 * LES FICHES D'EXERCICE de CET appareil (lib/exercise-sheets.ts) — lues après
 * le montage (aucun écart d'hydratation), relues quand un autre onglet les
 * modifie. Locales : aucune synchronisation, voir le module.
 *
 * `save` et `remove` relisent le disque avant d'écrire (le disque fait foi,
 * pas la copie de ce rendu) et renvoient `false` si l'écriture est refusée
 * (stockage plein ou bloqué) : l'écran doit alors le dire.
 */
export function useExerciseSheets() {
  const [sheets, setSheets] = useState<ExerciseSheet[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSheets(localData.exerciseSheets());
    setReady(true);
    const onStorage = (event: StorageEvent) => {
      if (event.key === KEY || event.key === null) setSheets(localData.exerciseSheets());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const save = useCallback((sheet: ExerciseSheet): boolean => {
    const next = upsertSheet(localData.exerciseSheets(), sheet);
    if (!localData.saveExerciseSheets(next)) return false;
    setSheets(next);
    return true;
  }, []);

  const remove = useCallback((id: string): boolean => {
    const next = removeSheet(localData.exerciseSheets(), id);
    if (!localData.saveExerciseSheets(next)) return false;
    setSheets(next);
    return true;
  }, []);

  return { sheets, ready, save, remove };
}
