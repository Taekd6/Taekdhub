"use client";

import { useCallback, useEffect, useState } from "react";
import { localData, type Preferences } from "@/lib/storage";
import type { Exercise, WorkSession } from "@/lib/supabase/types";

type DataState = {
  sessions: WorkSession[];
  exercises: Exercise[];
  preferences: Preferences;
  ready: boolean;
};

function readAll(): Omit<DataState, "ready"> {
  return {
    sessions: localData.sessions(),
    exercises: localData.exercises(),
    preferences: localData.preferences(),
  };
}

export function usePrepahubData() {
  const [data, setData] = useState<DataState>({ sessions: [], exercises: [], preferences: localData.preferences(), ready: false });

  const refresh = useCallback(() => {
    setData({ ...readAll(), ready: true });
  }, []);

  useEffect(() => {
    refresh();

    function onStorage(event: StorageEvent) {
      if (event.key?.startsWith("prepahub:")) refresh();
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refresh]);

  const saveSessions = useCallback((sessions: WorkSession[]) => {
    localData.saveSessions(sessions);
    setData((prev) => ({ ...prev, sessions }));
  }, []);

  const saveExercises = useCallback((exercises: Exercise[]) => {
    localData.saveExercises(exercises);
    setData((prev) => ({ ...prev, exercises }));
  }, []);

  const savePreferences = useCallback((preferences: Preferences) => {
    localData.savePreferences(preferences);
    setData((prev) => ({ ...prev, preferences }));
  }, []);

  return { ...data, refresh, saveSessions, saveExercises, savePreferences };
}
