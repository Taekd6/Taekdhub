"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Clipboard, Download, RefreshCw, Upload } from "lucide-react";
import { ChapterSelect } from "@/components/exercises/chapter-select";
import { AnkiLink } from "@/components/memory/anki-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VolumeBars } from "@/components/ui/chart";
import { Illustration } from "@/components/ui/illustrations";
import { Input } from "@/components/ui/input";
import { PageHero } from "@/components/ui/page-hero";
import { Section } from "@/components/ui/section";
import { Stat, StatRow } from "@/components/ui/stat";
import { EmptyState, Skeleton } from "@/components/ui/state";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { detectAnkiPlatform, type AnkiPlatform } from "@/lib/anki";
import { AnkiConnectError, ankiConnectConfig, fetchTransport, readAnkiSnapshot, type SnapshotProgress } from "@/lib/anki-connect";
import { ankiByChapter, mapDecks, type DeckMapping } from "@/lib/anki-mapping";
import {
  ANKI_DUE_STALE_HOURS,
  ANKI_SOURCE_LABEL,
  ANKI_TREND_STALE_DAYS,
  latestDueInfo,
  latestFullSnapshot,
  normalizeAnkiSnapshot,
  snapshotAgeHours,
  snapshotFromFile,
  snapshotToFile,
  upsertSnapshot,
} from "@/lib/anki-snapshot";
import { cn } from "@/lib/cn";
import { PROGRAMME_BY_ID } from "@/lib/programme-data";

const dateTime = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
const shortDay = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

function ago(hours: number): string {
  if (hours < 1) return "il y a moins d'une heure";
  if (hours < 48) return `il y a ${Math.round(hours)} h`;
  return `il y a ${Math.round(hours / 24)} jours`;
}

const KIND_LABEL: Record<DeckMapping["kind"], string> = {
  manuelle: "choisi",
  certaine: "nom identique",
  héritée: "hérité du paquet parent",
  proposée: "à confirmer",
  "non-classé": "non classé",
  ignoré: "aucun chapitre",
};

/**
 * /anki — LE PONT AVEC ANKI.
 *
 * Anki reste l'outil de mémorisation. Cet écran ne montre que ce que
 * TaekdHub a RELEVÉ, avec sa date et sa source (lib/anki-snapshot.ts), et
 * permet de dire à quel chapitre du programme correspond chaque paquet
 * (lib/anki-mapping.ts). Ces chiffres alimentent le diagnostic
 * (lib/diagnostic.ts) : « le cours tient dans Anki, mais l'application rate ».
 *
 * Trois façons de relever, de la plus complète à la plus légère :
 *   AnkiConnect  ordinateur, Anki ouvert — tous les paquets ;
 *   fichier      un relevé exporté ailleurs (autre navigateur, autre ordinateur) ;
 *   saisie       depuis AnkiMobile : deux chiffres, sans détail par paquet.
 */
export function AnkiOverview() {
  const { ankiSnapshots, saveAnkiSnapshots, preferences, savePreferences, ready } = usePrepahubData();
  const [platform, setPlatform] = useState<AnkiPlatform | null>(null);
  const [origin, setOrigin] = useState("https://taekdhub.vercel.app");
  const [busy, setBusy] = useState<SnapshotProgress | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPlatform(detectAnkiPlatform(navigator.userAgent, navigator.maxTouchPoints ?? 0));
    setOrigin(window.location.origin);
  }, []);

  const now = new Date();
  const full = useMemo(() => latestFullSnapshot(ankiSnapshots), [ankiSnapshots]);
  const dueInfo = useMemo(() => latestDueInfo(ankiSnapshots), [ankiSnapshots]);
  const mappings = useMemo(() => (full ? mapDecks(full.decks.map((deck) => deck.name), preferences.ankiDeckChapters) : []), [full, preferences.ankiDeckChapters]);
  const byChapter = useMemo(() => ankiByChapter(full, preferences.ankiDeckChapters), [full, preferences.ankiDeckChapters]);

  if (!ready) {
    return (
      <div className="mx-auto max-w-[60rem] space-y-6">
        <Skeleton className="h-24 w-full max-w-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  function store(next: ReturnType<typeof normalizeAnkiSnapshot>, label: string) {
    if (!next) {
      setMessage({ tone: "error", text: "Relevé illisible : rien n'a été enregistré." });
      return;
    }
    const written = saveAnkiSnapshots(upsertSnapshot(ankiSnapshots, next));
    setMessage(written ? { tone: "ok", text: label } : { tone: "error", text: "Le navigateur a refusé l'enregistrement (stockage plein ou bloqué)." });
  }

  async function readFromAnki() {
    setMessage(null);
    setBusy({ done: 0, total: 1 });
    try {
      const snapshot = await readAnkiSnapshot(fetchTransport(), new Date(), setBusy);
      store(snapshot, `Relevé fait : ${snapshot.decks.length} paquets. Il sera synchronisé avec ton compte.`);
    } catch (cause) {
      setMessage({ tone: "error", text: cause instanceof AnkiConnectError ? cause.message : "Le relevé a échoué." });
      if (cause instanceof AnkiConnectError && cause.kind !== "réponse") setShowSetup(true);
    } finally {
      setBusy(null);
    }
  }

  async function importFile(file: File) {
    setMessage(null);
    const snapshot = snapshotFromFile(await file.text());
    if (!snapshot) {
      setMessage({ tone: "error", text: "Ce fichier n'est pas un relevé TaekdHub. Les paquets Anki (.apkg, .colpkg) ne sont pas lus : voir les explications plus bas." });
      return;
    }
    store(snapshot, `Relevé du ${shortDay.format(new Date(snapshot.takenAt))} importé (${snapshot.decks.length} paquets).`);
  }

  function exportFile() {
    if (!full) return;
    const blob = new Blob([snapshotToFile(full)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `taekdhub-anki-${full.day}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function setMapping(deck: string, chapterId: string | null | undefined) {
    const next = { ...preferences.ankiDeckChapters };
    if (chapterId === undefined) delete next[deck];
    else next[deck] = chapterId;
    savePreferences({ ...preferences, ankiDeckChapters: next });
  }

  const dueAge = dueInfo ? snapshotAgeHours(dueInfo.takenAt, now) : null;
  const fullAgeDays = full ? snapshotAgeHours(full.takenAt, now) / 24 : null;
  const totals = full
    ? full.decks.reduce((sum, deck) => ({ total: sum.total + deck.total, reviewed30: sum.reviewed30 + deck.reviewed30, failed30: sum.failed30 + deck.failed30 }), { total: 0, reviewed30: 0, failed30: 0 })
    : null;
  const bars = full
    ? full.reviewsByDay.slice(-30).map((entry, index, list) => ({
        id: entry.day,
        label: index % 5 === 0 || index === list.length - 1 ? shortDay.format(new Date(`${entry.day}T12:00:00`)) : "",
        title: `${shortDay.format(new Date(`${entry.day}T12:00:00`))} : ${entry.count} cartes`,
        minutes: entry.count,
      }))
    : [];
  const hardChapters = [...byChapter.values()].filter((entry) => entry.failRate !== null).sort((a, b) => (b.failRate ?? 0) - (a.failRate ?? 0)).slice(0, 6);
  const toConfirm = mappings.filter((mapping) => mapping.kind === "proposée");
  const unclassified = mappings.filter((mapping) => mapping.kind === "non-classé");
  const mapped = mappings.filter((mapping) => mapping.kind === "certaine" || mapping.kind === "manuelle" || mapping.kind === "héritée" || mapping.kind === "ignoré");

  return (
    <div className="mx-auto max-w-[60rem] space-y-8 sm:space-y-10">
      <PageHero
        title="Anki"
        lede="Anki mémorise, TaekdHub pilote : tes paquets reliés aux chapitres du programme."
        illustration={<Illustration name="revisions" size={56} />}
        actions={<AnkiLink size="md" />}
      />

      {message && (
        <p role={message.tone === "error" ? "alert" : "status"} className={cn("rounded-xl px-4 py-3 text-[0.875rem] font-semibold", message.tone === "error" ? "bg-rose-400/[0.12] text-rose-300" : "bg-emerald-400/[0.12] text-emerald-300")}>
          {message.text}
        </p>
      )}

      <Section variant="feature" title="Dernier relevé">
        {!dueInfo && !full ? (
          <p className="t-meta">Aucun relevé pour l&apos;instant : TaekdHub ne sait rien de ta collection Anki. Choisis une façon de relever ci-dessous.</p>
        ) : (
          <>
            <StatRow>
              <Stat
                label="Cartes dues"
                value={dueInfo ? dueInfo.due : "—"}
                detail={dueInfo ? `au relevé, ${ago(dueAge!)}` : "inconnues"}
                tone={dueAge !== null && dueAge > ANKI_DUE_STALE_HOURS ? "warning" : undefined}
              />
              {totals && <Stat label="Révisées (30 j)" value={totals.reviewed30} detail={totals.reviewed30 > 0 ? `${Math.round((totals.failed30 / totals.reviewed30) * 100)} % avec au moins un « À revoir »` : "aucune"} />}
              {totals && <Stat label="Cartes" value={totals.total} detail={`${full!.decks.length} paquets`} />}
            </StatRow>
            <p className="t-meta mt-4">
              {full && (
                <>
                  Relevé complet : {dateTime.format(new Date(full.takenAt))} · {ANKI_SOURCE_LABEL[full.source]}.{" "}
                </>
              )}
              {dueInfo && dueInfo.source === "manuel" && <>Dernière saisie : {dateTime.format(new Date(dueInfo.takenAt))}. </>}
              Ce ne sont pas des chiffres en temps réel.
            </p>
            {dueAge !== null && dueAge > ANKI_DUE_STALE_HOURS && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-[0.8125rem] font-bold text-amber-300">
                <AlertTriangle size={14} aria-hidden /> Les cartes dues ont plus de {ANKI_DUE_STALE_HOURS} h : TaekdHub ne s&apos;en sert plus pour te conseiller.
              </p>
            )}
            {fullAgeDays !== null && fullAgeDays > ANKI_TREND_STALE_DAYS && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-[0.8125rem] font-bold text-amber-300">
                <AlertTriangle size={14} aria-hidden /> Relevé complet vieux de {Math.round(fullAgeDays)} jours : le diagnostic l&apos;ignore jusqu&apos;au prochain.
              </p>
            )}
          </>
        )}
      </Section>

      <Section variant="panel" title="Relever" description="Rien n'est jamais écrit dans Anki : TaekdHub lit des compteurs, c'est tout.">
        <div className="space-y-5">
          <div>
            <p className="text-[0.9375rem] font-bold text-ink">Depuis Anki sur ordinateur (AnkiConnect)</p>
            <p className="t-meta mt-1">Le relevé le plus complet : chaque paquet, ses cartes dues, ses échecs récents. À faire sur l&apos;ordinateur où Anki est ouvert ; le relevé se synchronise ensuite sur ton téléphone si tu es connecté.</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button onClick={() => void readFromAnki()} disabled={busy !== null || platform === "ios" || platform === "android"}>
                <RefreshCw size={15} aria-hidden className={cn(busy && "animate-spin")} /> {busy ? `Relevé… ${Math.round((busy.done / Math.max(1, busy.total)) * 100)} %` : "Relever depuis Anki"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowSetup((value) => !value)} aria-expanded={showSetup}>
                Installation
              </Button>
            </div>
            {(platform === "ios" || platform === "android") && (
              <p className="t-meta mt-2">Sur téléphone, AnkiConnect n&apos;existe pas : relève depuis l&apos;ordinateur, ou utilise la saisie rapide ci-dessous.</p>
            )}
            {showSetup && <SetupSteps origin={origin} />}
          </div>

          <div>
            <p className="text-[0.9375rem] font-bold text-ink">Par fichier</p>
            <p className="t-meta mt-1">Un relevé exporté depuis TaekdHub (sur un autre navigateur ou ordinateur). Réimporter le même fichier ne crée pas de doublon.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => fileInput.current?.click()}>
                <Upload size={14} aria-hidden /> Importer un relevé
              </Button>
              <Button variant="secondary" size="sm" onClick={exportFile} disabled={!full}>
                <Download size={14} aria-hidden /> Exporter le dernier relevé
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void importFile(file);
                  event.target.value = "";
                }}
              />
            </div>
          </div>

          <ManualEntry onSave={(due, reviewedToday) => store(normalizeAnkiSnapshot({ day: new Date().toLocaleDateString("en-CA"), takenAt: new Date().toISOString(), source: "manuel", manual: { due, reviewedToday } }), "Saisie enregistrée.")} />
        </div>
      </Section>

      {full ? (
        <>
          {bars.length > 0 && (
            <Section variant="panel" title="Volume de révisions" description={`Cartes révisées par jour, toutes confondues — d'après le relevé du ${shortDay.format(new Date(full.takenAt))}.`}>
              <VolumeBars bars={bars} ariaLabel="Cartes révisées par jour sur les 30 derniers jours" formatValue={(value) => `${Math.round(value)}`} />
            </Section>
          )}

          <Section variant="panel" title="Chapitres où les cartes résistent" description="Part des cartes révisées sur 30 jours où tu as pressé « À revoir » au moins une fois. Au moins 20 cartes révisées pour en parler.">
            {hardChapters.length === 0 ? (
              <p className="t-meta">Pas encore assez de cartes révisées dans des paquets associés à un chapitre.</p>
            ) : (
              <ul className="divide-y divide-line">
                {hardChapters.map((entry) => (
                  <li key={entry.chapterId} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.9375rem] font-bold text-ink">{PROGRAMME_BY_ID.get(entry.chapterId)?.title}</p>
                      <p className="t-meta text-2xs">
                        {entry.reviewed30} révisées · {entry.due} dues au relevé · {entry.lapsing} oubliées 4 fois ou plus · {entry.decks.length} paquet{entry.decks.length > 1 ? "s" : ""}
                      </p>
                    </div>
                    <span className={cn("text-[0.9375rem] font-extrabold tabular-nums", (entry.failRate ?? 0) >= 0.2 ? "text-rose-300" : "text-ink")}>{Math.round((entry.failRate ?? 0) * 100)} %</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section variant="panel" title="Paquets et chapitres" description="Seules les associations sûres servent au diagnostic. Corrige ou confirme les autres.">
            {toConfirm.length > 0 && (
              <MappingList title={`À confirmer · ${toConfirm.length}`} mappings={toConfirm} onChange={setMapping} />
            )}
            {unclassified.length > 0 && <MappingList title={`Non classés · ${unclassified.length}`} mappings={unclassified} onChange={setMapping} collapsedAfter={8} />}
            {mapped.length > 0 && <MappingList title={`Associés · ${mapped.length}`} mappings={mapped} onChange={setMapping} collapsedAfter={0} />}
          </Section>
        </>
      ) : (
        <Section variant="panel">
          <EmptyState
            className="py-8"
            illustration={<Illustration name="revisions" size={56} />}
            title="Pas encore de relevé par paquet"
            description="Les chapitres où les cartes résistent et l'association paquets → chapitres apparaissent après un relevé AnkiConnect (ou l'import de son fichier)."
          />
        </Section>
      )}

      <Section variant="panel" title="Ce que TaekdHub peut, et ne peut pas, savoir">
        <ul className="list-disc space-y-1.5 pl-5 text-[0.875rem] leading-relaxed text-muted">
          <li>AnkiConnect ne fonctionne que sur ordinateur, Anki ouvert. AnkiMobile (iPhone, iPad) n&apos;offre aucun accès à ses données : depuis le téléphone, seule la saisie rapide est possible.</li>
          <li>Pour que le relevé de l&apos;ordinateur reflète tes révisions faites sur iPhone, synchronise d&apos;abord AnkiMobile puis Anki (ordinateur) avec AnkiWeb, comme d&apos;habitude. TaekdHub ne se connecte jamais à AnkiWeb et ne demande aucun identifiant.</li>
          <li>Les fichiers .apkg et .colpkg d&apos;Anki ne sont pas lus : leur format interne change selon les versions et contient tout le contenu de tes cartes, dont TaekdHub n&apos;a pas besoin.</li>
          <li>Les cartes dues sont celles du moment du relevé. TaekdHub ne recalcule jamais la planification d&apos;Anki.</li>
        </ul>
        <p className="t-meta mt-3">
          Les chiffres par chapitre servent au{" "}
          <Link href="/programme" className="text-accent hover:underline">
            diagnostic du programme
          </Link>
          .
        </p>
      </Section>
    </div>
  );
}

function SetupSteps({ origin }: { origin: string }) {
  const [copied, setCopied] = useState(false);
  const config = ankiConnectConfig(origin);
  return (
    <ol className="well mt-3 list-decimal space-y-2 rounded-2xl p-4 pl-8 text-[0.875rem] leading-relaxed text-ink">
      <li>Dans Anki (ordinateur) : Outils → Modules → Obtenir des modules → code <code className="font-mono font-bold">2055492159</code> (AnkiConnect), puis redémarre Anki.</li>
      <li>
        Outils → Modules → AnkiConnect → Configuration, et remplace le contenu par :
        <pre className="mt-2 overflow-x-auto rounded-xl bg-inset p-3 font-mono text-2xs leading-relaxed">{config}</pre>
        <Button
          variant="ghost"
          size="sm"
          className="mt-1"
          onClick={() => {
            void navigator.clipboard?.writeText(config).then(() => setCopied(true));
          }}
        >
          {copied ? <Check size={14} aria-hidden /> : <Clipboard size={14} aria-hidden />} {copied ? "Copié" : "Copier"}
        </Button>
      </li>
      <li>Redémarre Anki, laisse-le ouvert, et reviens ici sur le même ordinateur. Utilise Chrome, Edge ou Firefox ; si le navigateur demande l&apos;accès au « réseau local », accepte.</li>
    </ol>
  );
}

function ManualEntry({ onSave }: { onSave: (due: number | null, reviewedToday: number | null) => void }) {
  const [due, setDue] = useState("");
  const [reviewed, setReviewed] = useState("");
  const parse = (value: string) => (value.trim() === "" ? null : Number.isFinite(Number(value)) && Number(value) >= 0 ? Math.round(Number(value)) : null);
  return (
    <div>
      <p className="text-[0.9375rem] font-bold text-ink">Saisie rapide depuis AnkiMobile</p>
      <p className="t-meta mt-1">Deux chiffres lus dans AnkiMobile (liste des paquets, et Statistiques → Aujourd&apos;hui). Sans détail par paquet : ils ne servent qu&apos;à Next Move et au suivi.</p>
      <div className="mt-3 grid max-w-md grid-cols-2 gap-2">
        <label className="block">
          <span className="t-label mb-1.5 block">Cartes dues</span>
          <Input inputMode="numeric" value={due} onChange={(event) => setDue(event.target.value)} />
        </label>
        <label className="block">
          <span className="t-label mb-1.5 block">Révisées aujourd&apos;hui</span>
          <Input inputMode="numeric" value={reviewed} onChange={(event) => setReviewed(event.target.value)} />
        </label>
      </div>
      <Button
        variant="secondary"
        size="sm"
        className="mt-3"
        disabled={parse(due) === null && parse(reviewed) === null}
        onClick={() => {
          onSave(parse(due), parse(reviewed));
          setDue("");
          setReviewed("");
        }}
      >
        Enregistrer la saisie
      </Button>
    </div>
  );
}

function MappingList({
  title,
  mappings,
  onChange,
  collapsedAfter,
}: {
  title: string;
  mappings: DeckMapping[];
  onChange: (deck: string, chapterId: string | null | undefined) => void;
  collapsedAfter?: number;
}) {
  const [expanded, setExpanded] = useState(collapsedAfter === undefined);
  const limit = expanded || collapsedAfter === undefined ? mappings.length : collapsedAfter;
  return (
    <div className="mb-6 last:mb-0">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="t-label">{title}</p>
        {collapsedAfter !== undefined && mappings.length > collapsedAfter && (
          <Button variant="link" size="sm" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
            {expanded ? "Replier" : "Tout afficher"}
          </Button>
        )}
      </div>
      <ul className="divide-y divide-line">
        {mappings.slice(0, limit).map((mapping) => {
          const suggestion = mapping.suggestionId ? PROGRAMME_BY_ID.get(mapping.suggestionId) : null;
          return (
            <li key={mapping.deck} className="grid gap-2 py-3 sm:grid-cols-2 sm:items-center">
              <div className="min-w-0">
                <p className="break-words text-[0.875rem] font-bold text-ink">{mapping.deck}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-2xs font-semibold text-subtle">
                  <Badge variant={mapping.kind === "proposée" ? "warning" : mapping.chapterId ? "success" : "default"}>{KIND_LABEL[mapping.kind]}</Badge>
                  {mapping.subject ?? "matière non reconnue"}
                  {suggestion && (
                    <button type="button" onClick={() => onChange(mapping.deck, suggestion.id)} className="font-bold text-accent hover:underline">
                      Confirmer « {suggestion.title} »
                    </button>
                  )}
                  {(mapping.kind === "manuelle" || mapping.kind === "ignoré") && (
                    <button type="button" onClick={() => onChange(mapping.deck, undefined)} className="font-bold text-subtle hover:text-ink">
                      Revenir à l&apos;automatique
                    </button>
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                <ChapterSelect
                  subject={mapping.subject}
                  value={mapping.chapterId ?? mapping.suggestionId}
                  ariaLabel={`Chapitre du paquet ${mapping.deck}`}
                  onChange={(chapterId) => onChange(mapping.deck, chapterId)}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
