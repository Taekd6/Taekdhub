"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useAccount, type AccountStatus } from "@/components/account/account-provider";
import { Button } from "@/components/ui/button";
import { Group, Row } from "@/components/ui/grouped";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/state";
import { cn } from "@/lib/cn";

const STATUS_LABEL: Record<AccountStatus, string> = {
  désactivé: "Non disponible",
  chargement: "…",
  invité: "Non connecté",
  synchronisation: "Synchronisation…",
  "à-jour": "Synchronisation activée",
  "en-attente": "Modifications en attente d'envoi",
  décision: "Choix à faire",
  erreur: "Synchronisation en échec",
};

const STATUS_DOT: Record<AccountStatus, string> = {
  désactivé: "bg-zinc-500",
  chargement: "bg-zinc-500",
  invité: "bg-zinc-500",
  synchronisation: "bg-accent animate-pulse",
  "à-jour": "bg-emerald-400",
  "en-attente": "bg-amber-400",
  décision: "bg-amber-400",
  erreur: "bg-rose-400",
};

/** « à l'instant », « il y a 4 min », « il y a 2 h », « le 12 sept. ». */
export function formatSyncedAt(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "jamais";
  const minutes = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `le ${new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`;
}

function Dot({ status }: { status: AccountStatus }) {
  return <span aria-hidden className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-full", STATUS_DOT[status])} />;
}

type Mode = "connexion" | "création";

/**
 * COMPTE — dans Réglages, sous l'apparence et les objectifs : la connexion
 * est secondaire par rapport au travail.
 *
 *   ● Non connecté        → Se connecter (e-mail + mot de passe, ou lien magique)
 *   ● Connecté avec …     → Synchronisation activée · Dernière synchro : …
 *
 * Le formulaire ne s'ouvre qu'à la demande : une page de réglages n'est pas
 * un écran de connexion.
 */
export function AccountSection() {
  const account = useAccount();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("connexion");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "info" | "danger"; text: string } | null>(null);
  const [, setTick] = useState(0);
  // Effacer l'appareil est irréversible (hors compte) : deux clics, jamais un.
  const [confirmWipe, setConfirmWipe] = useState(false);

  // « il y a 4 min » doit vieillir tout seul.
  useEffect(() => {
    const id = setInterval(() => setTick((value) => value + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!account.enabled) {
    return (
      <Group id="compte" title="Compte" footer="Tes données restent dans ce navigateur. Pense à exporter une sauvegarde régulièrement.">
        <Row label={<span className="inline-flex items-center gap-2"><Dot status="désactivé" /> Non connecté</span>} hint="Le compte n'est pas activé sur cette version de TaekdHub." />
      </Group>
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    if (mode === "connexion") {
      const error = await account.signInWithPassword(email, password);
      if (error) setMessage({ tone: "danger", text: error });
      else setOpen(false);
    } else {
      const { error, needsConfirmation } = await account.signUp(email, password);
      if (error) setMessage({ tone: "danger", text: error });
      else if (needsConfirmation) setMessage({ tone: "info", text: `Compte créé. Ouvre le lien envoyé à ${email.trim()} pour le confirmer, puis reviens ici.` });
      else setOpen(false);
    }
    setPassword("");
    setBusy(false);
  }

  async function magicLink() {
    if (!email.trim()) {
      setMessage({ tone: "danger", text: "Indique d'abord ton e-mail." });
      return;
    }
    setBusy(true);
    const error = await account.sendMagicLink(email);
    setMessage(error ? { tone: "danger", text: error } : { tone: "info", text: `Lien envoyé à ${email.trim()}. Ouvre-le sur cet appareil pour te connecter.` });
    setBusy(false);
  }

  async function signOut(wipe: boolean) {
    setBusy(true);
    const error = await account.signOut({ wipe });
    setMessage(error ? { tone: "danger", text: error } : null);
    setBusy(false);
  }

  const { user, status } = account;

  if (!user) {
    return (
      <Group
        id="compte"
        title="Compte"
        footer="Un compte garde une copie de tes données et les retrouve sur tes autres appareils. Sans compte, tout reste dans ce navigateur."
      >
        <Row label={<span className="inline-flex items-center gap-2"><Dot status={status} /> Non connecté</span>} hint="Tes données restent sur cet appareil.">
          {!open && (
            <Button variant="secondary" size="sm" onClick={() => setOpen(true)} disabled={status === "chargement"}>
              Se connecter
            </Button>
          )}
        </Row>
        {open && (
          <form onSubmit={submit} className="space-y-3 py-4 pr-4 sm:pr-5" aria-label={mode === "connexion" ? "Se connecter" : "Créer un compte"}>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="t-label mb-1 block">E-mail</span>
                <Input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
              </label>
              <label className="block">
                <span className="t-label mb-1 block">Mot de passe</span>
                <Input
                  type="password"
                  autoComplete={mode === "connexion" ? "current-password" : "new-password"}
                  required
                  minLength={mode === "création" ? 8 : undefined}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
            </div>
            {message && <Notice tone={message.tone}>{message.text}</Notice>}
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" size="sm" disabled={busy}>
                {mode === "connexion" ? "Se connecter" : "Créer mon compte"}
              </Button>
              <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void magicLink()}>
                Recevoir un lien par e-mail
              </Button>
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={() => {
                  setMode(mode === "connexion" ? "création" : "connexion");
                  setMessage(null);
                }}
              >
                {mode === "connexion" ? "Pas encore de compte ?" : "J'ai déjà un compte"}
              </Button>
            </div>
          </form>
        )}
      </Group>
    );
  }

  const pending = account.hasPendingChanges();
  return (
    <Group
      id="compte"
      title="Compte"
      footer="Tes données sont enregistrées sur cet appareil ET dans ton compte. Hors ligne, TaekdHub continue de marcher et envoie tes modifications au retour du réseau."
    >
      <Row label={<span className="inline-flex items-center gap-2"><Dot status="à-jour" /> Connecté</span>} hint={user.email ?? undefined} />
      <Row label={<span className="inline-flex items-center gap-2"><Dot status={status} /> {STATUS_LABEL[status]}</span>} hint={`Dernière synchronisation : ${formatSyncedAt(account.lastSyncedAt)}`}>
        <Button variant="secondary" size="sm" disabled={busy || status === "synchronisation"} onClick={() => void account.syncNow()}>
          Synchroniser
        </Button>
      </Row>
      {account.error && status === "erreur" && (
        <div className="py-3 pr-4 sm:pr-5">
          <Notice tone="danger">{account.error}</Notice>
        </div>
      )}
      <Row label="Se déconnecter" hint={pending ? "Des modifications attendent : elles partiront à ta prochaine connexion." : "Tes données restent sur cet appareil."} stack>
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => void signOut(false)}>
          Se déconnecter
        </Button>
        {confirmWipe ? (
          <Button variant="danger" size="sm" disabled={busy || pending} onClick={() => void signOut(true)}>
            Confirmer : effacer cet appareil
          </Button>
        ) : (
          <Button variant="danger" size="sm" disabled={busy || pending} onClick={() => setConfirmWipe(true)}>
            Déconnecter et effacer cet appareil
          </Button>
        )}
      </Row>
      {message && (
        <div className="py-3 pr-4 sm:pr-5">
          <Notice tone={message.tone}>{message.text}</Notice>
        </div>
      )}
    </Group>
  );
}
