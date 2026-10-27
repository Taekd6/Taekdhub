"use client";

import { useState } from "react";
import { Group, Row } from "@/components/ui/grouped";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { CALENDAR_FEEDS_MAX, checkFeedUrl, maskFeedUrl, type CalendarFeed } from "@/lib/calendar";

/**
 * MES AGENDAS — les adresses iCal que la vue semaine lit (lib/calendar.ts).
 * L'adresse est un secret : une fois enregistrée, on n'en montre que l'hôte.
 * Avant d'enregistrer, on essaie de la lire, pour dire tout de suite si elle
 * marche plutôt qu'à la prochaine ouverture de la semaine.
 */
export function CalendarSettings() {
  const { preferences, savePreferences, ready } = usePrepahubData();
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<{ tone: "ok" | "error" | "busy"; text: string } | null>(null);

  const feeds = preferences.calendarFeeds;

  async function add() {
    const checked = checkFeedUrl(url);
    if (!checked.ok) {
      setStatus({ tone: "error", text: checked.error });
      return;
    }
    if (feeds.some((feed) => feed.url === checked.url)) {
      setStatus({ tone: "error", text: "Cet agenda est déjà ajouté." });
      return;
    }
    setStatus({ tone: "busy", text: "Je lis l'agenda…" });
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from.getTime() + 14 * 86400000);
    try {
      const response = await fetch("/api/calendar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: checked.url, from: from.toISOString(), to: to.toISOString() }) });
      const data = (await response.json().catch(() => ({}))) as { events?: unknown[]; error?: string };
      if (!response.ok || !Array.isArray(data.events)) {
        setStatus({ tone: "error", text: data.error ?? "Impossible de lire cet agenda." });
        return;
      }
      const feed: CalendarFeed = { id: `cal-${Date.now().toString(36)}`, label: label.trim().slice(0, 30) || (feeds.length === 0 ? "Emploi du temps" : "Agenda"), url: checked.url };
      savePreferences({ ...preferences, calendarFeeds: [...feeds, feed] });
      setLabel("");
      setUrl("");
      setStatus({ tone: "ok", text: `Ajouté : ${data.events.length} événement${data.events.length > 1 ? "s" : ""} dans les deux semaines à venir.` });
    } catch {
      setStatus({ tone: "error", text: "Hors ligne : réessaie une fois connecté." });
    }
  }

  function remove(id: string) {
    savePreferences({ ...preferences, calendarFeeds: feeds.filter((feed) => feed.id !== id) });
  }

  return (
    <Group
      id="agendas"
      title="Mes agendas"
      footer="Google : agenda → Paramètres → Intégrer l'agenda → « Adresse secrète au format iCal ». iCloud : Calendrier sur iPhone → (i) à côté de l'agenda → Calendrier public → Partager le lien. Cette adresse donne accès à tout l'agenda : ne la colle nulle part ailleurs."
    >
      {feeds.map((feed) => (
        <Row key={feed.id} label={feed.label} hint={maskFeedUrl(feed.url)}>
          <Button variant="ghost" size="sm" onClick={() => remove(feed.id)} aria-label={`Retirer l'agenda ${feed.label}`}>
            Retirer
          </Button>
        </Row>
      ))}
      {ready && feeds.length < CALENDAR_FEEDS_MAX && (
        <Row label="Ajouter un agenda" hint="Ton emploi du temps apparaît dans la semaine, relu à chaque ouverture." stack>
          <form
            className="flex w-full flex-col gap-2 sm:max-w-[24rem]"
            onSubmit={(event) => {
              event.preventDefault();
              void add();
            }}
          >
            <Input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Nom (ex. Emploi du temps)" aria-label="Nom de l'agenda" maxLength={30} />
            <Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://calendar.google.com/…/basic.ics" aria-label="Adresse iCal de l'agenda" inputMode="url" autoComplete="off" spellCheck={false} />
            <Button type="submit" size="sm" disabled={!url.trim() || status?.tone === "busy"} className="self-start">
              Ajouter
            </Button>
            {status && (
              <p role="status" className={status.tone === "error" ? "text-[0.8125rem] font-semibold text-rose-500" : "text-[0.8125rem] font-semibold text-muted"}>
                {status.text}
              </p>
            )}
          </form>
        </Row>
      )}
    </Group>
  );
}
