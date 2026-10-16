"use client";

import { useMemo, useState } from "react";
import { ClipboardCopy, Download, FileInput, Search, Send } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import type { AnkiPlatform } from "@/lib/anki";
import { fetchTransport } from "@/lib/anki-connect";
import { cardsTextExport, sendCards } from "@/lib/anki-export";
import type { ExerciseAttempt } from "@/lib/attempts";
import { cn } from "@/lib/cn";
import { DEMO_CSS, previewFace } from "@/lib/demo-cards";
import {
  DEMONSTRATIONS,
  DEMO_STATE_LABEL,
  demoActions,
  demoChapter,
  demoNoteOf,
  demoStatus,
  findDemoNotes,
  parseRestitution,
  recordRestitution,
  restitutionPrompt,
  sendDemoNotes,
  syncDemoCards,
  targetedCard,
  type DemoAction,
  type DemoActionKind,
  type ParsedRestitution,
} from "@/lib/demonstrations";
import { localData, type Preferences } from "@/lib/storage";
import { dayKey } from "@/lib/study";

const DECK_URL = "/anki/taekdhub-demonstrations.apkg";
const TRIAL_DECK_URL = "/anki/taekdhub-demonstration-ipad.apkg";

const ACTION_LABEL: Record<DemoActionKind, string> = {
  "revoir-carte": "Revoir la carte Anki",
  "ajouter-carte": "Ajouter la carte à Anki",
  "creer-carte-ciblee": "Créer une carte ciblée",
  refaire: "Refaire la démonstration entière",
  expliquer: "Demander une explication à l'IA",
  rien: "Rien à faire",
};

const STATE_STYLE = {
  "non-travaillée": "bg-zinc-400/20 text-muted",
  "restitution-incomplète": "bg-rose-400/[0.14] text-rose-300",
  "réussite-avec-aide": "bg-amber-400/[0.16] text-amber-300",
  "réussite-autonome": "bg-emerald-400/[0.16] text-emerald-300",
  "à-réactiver": "bg-sky-400/[0.16] text-sky-300",
} as const;

/** La carte telle qu'Anki l'affiche, isolée dans un cadre sans script : aucun style de l'application ne la touche. */
function CardFrame({ html }: { html: string }) {
  const doc = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:12px}${DEMO_CSS}</style><div class="card">${html}</div>`;
  return <iframe title="Aperçu de la carte" sandbox="" srcDoc={doc} className="h-[26rem] w-full rounded-xl border border-line bg-white" />;
}

function ActionList({ actions }: { actions: DemoAction[] }) {
  return (
    <ul className="mt-2 space-y-1.5">
      {actions.map((action) => (
        <li key={action.kind} className="text-[0.875rem] leading-relaxed text-muted">
          <span className="font-semibold text-ink">{ACTION_LABEL[action.kind]}</span> — {action.why}
        </li>
      ))}
    </ul>
  );
}

/**
 * DÉMONSTRATIONS (lib/demonstrations.ts) — la carte Anki à restitution sans
 * support, et ce que la restitution apprend à TaekdHub.
 *
 * Rien n'est écrit sans un clic : l'envoi vers Anki (ordinateur, AnkiConnect)
 * ne crée que ce qui manque, la restitution n'est enregistrée qu'après
 * vérification, et une carte ciblée proposée par l'IA n'est ajoutée qu'avec
 * son aperçu sous les yeux. Anki garde la répétition espacée.
 */
export function DemonstrationsPanel({
  platform,
  attempts,
  saveAttempts,
  preferences,
  savePreferences,
}: {
  platform: AnkiPlatform | null;
  attempts: ExerciseAttempt[];
  saveAttempts: (items: ExerciseAttempt[]) => void;
  preferences: Preferences;
  savePreferences: (value: Preferences) => void;
}) {
  const today = dayKey(new Date());
  const mobile = platform === "ios" || platform === "android";
  const [open, setOpen] = useState<{ id: string; face: "front" | "back" } | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  // Restitution à enregistrer
  const [text, setText] = useState("");
  const [checked, setChecked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);
  const [cardMessage, setCardMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const parsed = useMemo(() => (checked ? parseRestitution(text, today) : null), [checked, text, today]);
  const value: ParsedRestitution | null = parsed?.ok ? parsed.value : null;

  /** Relu sur le disque : les réglages et les tentatives s'écrivent en remplacement. */
  function rememberCards(ids: string[], verified = false) {
    if (ids.length === 0 && !verified) return;
    const current = localData.preferences();
    const at = new Date().toISOString();
    // Après une vérification, la liste est EXACTEMENT ce qu'Anki contient ; après un envoi, on ajoute.
    const demoCards = verified ? syncDemoCards(current.demoCards, ids, DEMONSTRATIONS.map((demo) => demo.id), at) : { ...current.demoCards, ...Object.fromEntries(ids.map((id) => [id, current.demoCards[id] ?? at])) };
    savePreferences({ ...current, demoCards });
  }

  async function send() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await sendDemoNotes(fetchTransport(), DEMONSTRATIONS.filter((demo) => selected.includes(demo.id)));
      rememberCards([...result.added, ...result.alreadyThere]);
      const parts = [`${result.added.length} ajoutée${result.added.length > 1 ? "s" : ""}`];
      if (result.alreadyThere.length > 0) parts.push(`${result.alreadyThere.length} déjà dans Anki (laissée${result.alreadyThere.length > 1 ? "s" : ""} telle${result.alreadyThere.length > 1 ? "s" : ""} : tes révisions sont intactes)`);
      if (result.failed.length > 0) parts.push(`${result.failed.length} refusée${result.failed.length > 1 ? "s" : ""} par Anki`);
      if (result.moved > 0) parts.push(`${result.moved} carte${result.moved > 1 ? "s" : ""} qu'Anki avait rangée${result.moved > 1 ? "s" : ""} hors du paquet du chapitre, déplacée${result.moved > 1 ? "s" : ""} par TaekdHub`);
      if (result.unplaced > 0) parts.push(`${result.unplaced} carte${result.unplaced > 1 ? "s" : ""} hors du paquet du chapitre, à ranger à la main dans Anki`);
      setMessage({ tone: result.failed.length > 0 || result.unplaced > 0 ? "error" : "ok", text: `${parts.join(", ")}. Synchronise Anki pour les retrouver sur ton téléphone.` });
    } catch (cause) {
      setMessage({ tone: "error", text: cause instanceof Error ? cause.message : "L'envoi a échoué." });
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setMessage(null);
    try {
      const found = await findDemoNotes(fetchTransport(), DEMONSTRATIONS);
      rememberCards(found, true);
      setMessage({ tone: "ok", text: found.length > 0 ? `${found.length} démonstration${found.length > 1 ? "s" : ""} déjà dans Anki (retrouvée${found.length > 1 ? "s" : ""} par leur référence).` : "Aucune carte de démonstration dans Anki pour l'instant." });
    } catch (cause) {
      setMessage({ tone: "error", text: cause instanceof Error ? cause.message : "La vérification a échoué." });
    } finally {
      setBusy(false);
    }
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(restitutionPrompt());
      setCopied("ok");
    } catch {
      setCopied("fail");
    }
  }

  const cardKnown = (id: string) => Boolean(preferences.demoCards[id]);
  const simulated = value ? recordRestitution(attempts, value, new Date()) : attempts;
  const previewStatus = value ? demoStatus(value.demo.id, simulated, today) : null;
  const previewActions = value ? demoActions({ demo: value.demo, attempts: simulated, cardInAnki: cardKnown(value.demo.id), today }) : [];
  const targeted = previewActions.find((action) => action.kind === "creer-carte-ciblee");
  const card = value && value.proposedCard && targeted?.target ? targetedCard(value.demo, value.proposedCard, targeted.target) : null;

  function saveRestitution() {
    if (!value) return;
    saveAttempts(recordRestitution(localData.attempts(), value, new Date()));
    setSaved(true);
  }

  async function addCard() {
    if (!card) return;
    setBusy(true);
    setCardMessage(null);
    try {
      const result = await sendCards(fetchTransport(), [card]);
      const moved = (result.moved ?? 0) > 0 ? " Anki l'avait rangée hors du paquet du chapitre : TaekdHub l'y a déplacée." : "";
      const unplaced = (result.unplaced ?? 0) > 0 ? " Elle n'est pas dans le paquet du chapitre : range-la à la main dans Anki." : "";
      setCardMessage({
        tone: result.failed > 0 || (result.unplaced ?? 0) > 0 ? "error" : "ok",
        text: `${result.added > 0 ? "Carte ajoutée à Anki." : result.duplicates > 0 ? "Cette carte est déjà dans Anki : rien n'a été créé." : "Anki a refusé la carte."}${moved}${unplaced}`,
      });
    } catch (cause) {
      setCardMessage({ tone: "error", text: cause instanceof Error ? cause.message : "L'ajout a échoué." });
    } finally {
      setBusy(false);
    }
  }

  function downloadCard() {
    if (!card) return;
    const blob = new Blob([cardsTextExport([card])], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `taekdhub-carte-ciblee-${new Date().toLocaleDateString("en-CA")}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Section
      variant="panel"
      title="Démonstrations"
      description="Une carte Anki pour apprendre, une restitution sans support pour vérifier, et ce qui a manqué remonte ici. Ouvrir une carte ou y passer du temps ne compte pas : seule une restitution observée change l'état."
    >
      <div className="space-y-5">
        <div>
          <div className="flex flex-wrap gap-2">
            <a href={TRIAL_DECK_URL} download className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
              <Download size={14} aria-hidden /> Paquet d&apos;essai (1 démonstration)
            </a>
            <a href={DECK_URL} download className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}>
              <Download size={14} aria-hidden /> Toutes les démonstrations ({DEMONSTRATIONS.length})
            </a>
          </div>
          <p className="t-meta mt-2 text-2xs">Premier essai sur iPad ou iPhone : importe d&apos;abord le paquet d&apos;essai, vérifie le Scratchpad, puis le paquet complet (mêmes notes : rien n&apos;est dupliqué). Pas à pas : docs/DEMONSTRATIONS.md. Sur ordinateur, l&apos;envoi direct (AnkiConnect) suppose qu&apos;un paquet ait été importé une première fois : l&apos;import installe l&apos;unique type de note.</p>
          <p className="t-meta mt-2 text-2xs">
            {mobile ? "Ouvre-le depuis l'app Fichiers : AnkiMobile l'importe." : "Double-clique dessus, ou Fichier › Importer dans Anki."} Réimporter une version corrigée met la carte à jour sans la dupliquer ni perdre tes révisions.
          </p>
          <p className="t-meta mt-1 text-2xs">
            Tableau blanc : celui d&apos;Anki, sans rien à installer. iPhone / iPad : « Scratchpad » dans les outils d&apos;étude d&apos;AnkiMobile (Apple Pencil). Android : tableau blanc d&apos;AnkiDroid, à activer par paquet. Ordinateur : pas de tableau intégré à Anki, utilise le papier — la carte laisse la place. D&apos;après la documentation de ces applications ; à essayer sur ton appareil.
          </p>
        </div>

        <ul className="divide-y divide-line">
          {DEMONSTRATIONS.map((demo) => {
            const status = demoStatus(demo.id, attempts, today);
            const actions = demoActions({ demo, attempts, cardInAnki: cardKnown(demo.id), today });
            const shown = open?.id === demo.id ? open.face : null;
            return (
              <li key={demo.id} className="py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex min-w-0 flex-1 items-center gap-2 text-[0.9375rem] font-semibold text-ink">
                    {!mobile && <input type="checkbox" checked={selected.includes(demo.id)} onChange={() => setSelected((list) => (list.includes(demo.id) ? list.filter((id) => id !== demo.id) : [...list, demo.id]))} className="h-4 w-4 shrink-0 accent-[var(--btn-g1)]" aria-label={`Choisir ${demo.title}`} />}
                    <span className="truncate">{demo.title}</span>
                    <span className="t-meta shrink-0 text-2xs">{demoChapter(demo).title}</span>
                  </label>
                  <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-2xs font-semibold", STATE_STYLE[status.state])}>{DEMO_STATE_LABEL[status.state]}</span>
                </div>
                <p className="t-meta mt-1 text-2xs">
                  {status.because} · Carte dans Anki : {cardKnown(demo.id) ? "oui" : "pas confirmée"}
                </p>
                <ActionList actions={actions} />
                <div className="mt-2 flex gap-3">
                  {(["front", "back"] as const).map((face) => (
                    <button key={face} type="button" aria-expanded={shown === face} onClick={() => setOpen(shown === face ? null : { id: demo.id, face })} className="text-2xs font-semibold text-accent hover:underline">
                      {shown === face ? "Masquer" : face === "front" ? "Voir le recto" : "Voir le verso"}
                    </button>
                  ))}
                </div>
                {shown && <div className="mt-2"><CardFrame html={previewFace(shown, demoNoteOf(demo).fields)} /></div>}
              </li>
            );
          })}
        </ul>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => void send()} disabled={busy || mobile || selected.length === 0}>
            <Send size={14} aria-hidden /> {busy ? "…" : `Envoyer ${selected.length > 0 ? selected.length : ""} vers Anki`}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => void verify()} disabled={busy || mobile}>
            <Search size={14} aria-hidden /> Vérifier dans Anki
          </Button>
          {mobile && <span className="t-meta text-2xs">L&apos;envoi direct n&apos;existe que sur ordinateur (AnkiConnect) ; sur téléphone, prends le paquet.</span>}
        </div>
        {message && (
          <p role="status" className={message.tone === "ok" ? "rounded-xl bg-accent/[0.08] px-3 py-2 text-[0.875rem] font-semibold text-ink" : "rounded-xl bg-rose-400/[0.1] px-3 py-2 text-[0.875rem] font-semibold text-rose-300"}>
            {message.text}
          </p>
        )}

        <div className="border-t border-line pt-5">
          <p className="text-[0.9375rem] font-semibold text-ink">Enregistrer une restitution</p>
          <p className="t-meta mt-1 text-2xs">Restitue au tableau ou sur papier, fais comparer ta preuve à la référence par ChatGPT ou Claude avec la consigne ci-dessous, puis colle sa réponse : tu vérifies avant que ça ne soit enregistré.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={copyPrompt}>
              <ClipboardCopy size={14} aria-hidden /> Copier la consigne pour l&apos;IA
            </Button>
            {copied === "ok" && <span className="t-meta text-2xs">Copiée.</span>}
            {copied === "fail" && <span role="alert" className="text-2xs font-semibold text-rose-300">Copie impossible : autorise le presse-papiers.</span>}
          </div>
          <label className="mt-3 block">
            <span className="t-label mb-1.5 block">Réponse de l&apos;IA (JSON)</span>
            <textarea
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                setChecked(false);
                setSaved(false);
                setCardMessage(null);
              }}
              rows={5}
              spellCheck={false}
              className="w-full rounded-xl border border-line bg-inset p-3 font-mono text-[0.8125rem] text-ink"
              placeholder='{ "demonstration": "m1-theoreme-du-rang", "date": "2026-10-14", "resultat": "incomplète", "aide": "sans", "lacunes": [ … ] }'
            />
          </label>
          <Button className="mt-3" size="sm" onClick={() => setChecked(true)} disabled={!text.trim()}>
            <FileInput size={14} aria-hidden /> Vérifier
          </Button>

          {parsed && !parsed.ok && (
            <ul role="alert" className="mt-4 list-disc space-y-1 pl-5 text-[0.875rem] font-semibold text-rose-300">
              {parsed.errors.map((entry) => (
                <li key={entry}>{entry}</li>
              ))}
            </ul>
          )}

          {value && previewStatus && (
            <div className="mt-5 space-y-3 text-[0.875rem] leading-relaxed text-muted">
              <p className="text-[0.9375rem] font-semibold text-ink">
                {value.demo.title} · {value.day} · {value.result === "réussi" ? "réussie" : value.result === "partiel" ? "incomplète" : "échec"}, {value.help === "sans" ? "sans aide" : value.help === "indices" ? "avec indices" : "avec la preuve sous les yeux"}
              </p>
              {value.gaps.length > 0 && (
                <ul className="list-disc pl-5">
                  {value.gaps.map((gap) => (
                    <li key={`${gap.kind}${gap.step ?? ""}${gap.detail}`}>
                      <span className="font-semibold text-ink">{gap.kind}</span>
                      {gap.step ? ` (étape ${gap.step})` : ""} : {gap.detail}
                    </li>
                  ))}
                </ul>
              )}
              {value.unconfirmed.length > 0 && <p>À confirmer, non enregistré : {value.unconfirmed.join(" ; ")}.</p>}
              {value.mastered.length > 0 && <p>Maîtrisé : {value.mastered.join(" ; ")}.</p>}
              {value.uncertainties.map((entry) => (
                <p key={entry}>Doute de l&apos;IA : {entry}</p>
              ))}
              {value.warnings.map((entry) => (
                <p key={entry}>{entry}</p>
              ))}
              <p>
                État après enregistrement : <span className="font-semibold text-ink">{DEMO_STATE_LABEL[previewStatus.state]}</span> — {previewStatus.because}
              </p>
              <ActionList actions={previewActions} />
              {value.proposedCard && !card && <p>Carte proposée par l&apos;IA non retenue : la même lacune n&apos;est pas encore revenue dans plusieurs restitutions (ou la carte de la démonstration n&apos;est pas dans Anki).</p>}
              {card && (
                <div className="well rounded-xl p-3">
                  <p className="font-semibold text-ink">Carte ciblée proposée — aperçu</p>
                  <p className="mt-1 text-ink">{card.front}</p>
                  <p className="mt-1">{card.back}</p>
                  <p className="t-meta mt-1 text-2xs">Paquet « {card.deck} ». Rien n&apos;est ajouté sans ton clic ; une carte au même recto déjà présente n&apos;est pas recréée.</p>
                </div>
              )}
              <Button onClick={saveRestitution} disabled={saved}>
                {saved ? "Restitution enregistrée" : "Enregistrer la restitution"}
              </Button>
              {saved && card && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" onClick={() => void addCard()} disabled={busy || mobile}>
                    <Send size={14} aria-hidden /> Ajouter la carte ciblée à Anki
                  </Button>
                  <Button size="sm" variant="secondary" onClick={downloadCard}>
                    <Download size={14} aria-hidden /> Fichier à importer
                  </Button>
                </div>
              )}
              {cardMessage && (
                <p role="status" className={cardMessage.tone === "ok" ? "rounded-xl bg-accent/[0.08] px-3 py-2 font-semibold text-ink" : "rounded-xl bg-rose-400/[0.1] px-3 py-2 font-semibold text-rose-300"}>
                  {cardMessage.text}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}
