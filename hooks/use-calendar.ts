"use client";

import { withoutSchoolOnOffDays } from "@/lib/vacances";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CalendarEvent, CalendarFeed } from "@/lib/calendar";

/**
 * Les événements des agendas de l'élève sur [from, to[ — voir lib/calendar.ts
 * et app/api/calendar/route.ts.
 *
 * Affiche d'abord la dernière copie connue (hors-ligne, ouverture
 * instantanée), puis la remplace par la version relue. La copie est LOCALE à
 * l'appareil (`prepahub:calendar-cache`) : jamais synchronisée, et purgée au
 * bout de 21 jours.
 */

const CACHE_KEY = "prepahub:calendar-cache";
const CACHE_MAX_AGE_MS = 21 * 86400000;

type CacheEntry = { savedAt: number; events: Omit<CalendarEvent, "feedId">[] };
type Cache = Record<string, CacheEntry>;

function readCache(): Cache {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Cache) : {};
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function writeCache(key: string, entry: CacheEntry) {
  try {
    const cache = readCache();
    const now = Date.now();
    for (const [k, v] of Object.entries(cache)) if (!v || now - v.savedAt > CACHE_MAX_AGE_MS) delete cache[k];
    cache[key] = entry;
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* stockage plein ou bloqué : la grille s'affiche quand même */
  }
}

/** Clé de cache : identifiant du flux + fenêtre. L'adresse secrète n'y figure pas. */
const cacheKey = (feed: CalendarFeed, from: Date) => `${feed.id}|${from.toISOString().slice(0, 10)}`;

export interface CalendarState {
  events: CalendarEvent[];
  loading: boolean;
  /** Un message par agenda qui n'a pas pu être relu (les autres s'affichent). */
  errors: Array<{ feedId: string; label: string; message: string }>;
  /** La copie affichée date d'avant cette ouverture (hors-ligne ou relecture en cours). */
  stale: boolean;
  refresh: () => void;
}

export function useCalendarEvents(feeds: CalendarFeed[], from: Date, to: Date): CalendarState {
  const [byFeed, setByFeed] = useState<Record<string, CalendarEvent[]>>({});
  const [errors, setErrors] = useState<CalendarState["errors"]>([]);
  const [loading, setLoading] = useState(false);
  const [stale, setStale] = useState(false);
  const [tick, setTick] = useState(0);

  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const feedsKey = feeds.map((feed) => `${feed.id}:${feed.url}`).join("|");

  useEffect(() => {
    if (feeds.length === 0) {
      setByFeed({});
      setErrors([]);
      return;
    }
    let cancelled = false;
    const start = new Date(fromIso);

    // 1. La copie locale, tout de suite.
    const cache = readCache();
    const cached: Record<string, CalendarEvent[]> = {};
    for (const feed of feeds) {
      const entry = cache[cacheKey(feed, start)];
      if (entry) cached[feed.id] = entry.events.map((event) => ({ ...event, feedId: feed.id }));
    }
    setByFeed(cached);
    setStale(Object.keys(cached).length > 0);
    setLoading(true);

    // 2. La relecture.
    Promise.all(
      feeds.map(async (feed) => {
        try {
          const response = await fetch("/api/calendar", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ url: feed.url, from: fromIso, to: toIso }),
          });
          const data = (await response.json().catch(() => ({}))) as { events?: Omit<CalendarEvent, "feedId">[]; error?: string };
          if (!response.ok || !Array.isArray(data.events)) return { feed, error: data.error ?? "Agenda indisponible." };
          writeCache(cacheKey(feed, start), { savedAt: Date.now(), events: data.events });
          return { feed, events: data.events.map((event) => ({ ...event, feedId: feed.id })) };
        } catch {
          return { feed, error: "Hors ligne : dernière copie affichée." };
        }
      }),
    ).then((results) => {
      if (cancelled) return;
      const next: Record<string, CalendarEvent[]> = { ...cached };
      const nextErrors: CalendarState["errors"] = [];
      let allFresh = true;
      for (const result of results) {
        if ("events" in result && result.events) next[result.feed.id] = result.events;
        else {
          allFresh = false;
          nextErrors.push({ feedId: result.feed.id, label: result.feed.label, message: result.error ?? "Agenda indisponible." });
        }
      }
      setByFeed(next);
      setErrors(nextErrors);
      setStale(!allFresh && Object.keys(cached).length > 0);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // `feeds` est résumé par `feedsKey`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedsKey, fromIso, toIso, tick]);

  const events = useMemo(() => withoutSchoolOnOffDays(Object.values(byFeed).flat()).sort((a, b) => a.start.localeCompare(b.start)), [byFeed]);
  const refresh = useCallback(() => setTick((value) => value + 1), []);
  return { events, loading, errors, stale, refresh };
}
