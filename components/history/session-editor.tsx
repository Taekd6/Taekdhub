"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/input";
import { SESSION_EDIT_ERRORS, SESSION_MAX_MINUTES, editSession, toLocalDateTime } from "@/lib/session-edit";
import { subjects } from "@/lib/study";
import type { Subject, WorkSession } from "@/lib/supabase/types";

/**
 * CORRIGER OU SUPPRIMER UNE SÉANCE — voir lib/session-edit.ts.
 *
 * La suppression se fait en DEUX gestes dans le dialogue même (« Supprimer »
 * puis « Oui, supprimer ») plutôt qu'avec la boîte de confirmation du
 * navigateur : même logique que le reste de l'application, et rien qui
 * bloque la page.
 */
export function SessionEditor({
  session,
  onSave,
  onDelete,
  onClose,
}: {
  session: WorkSession | null;
  onSave: (session: WorkSession) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={session !== null} title="Corriger la séance" onClose={onClose}>
      {/* `key` : rouvrir le dialogue sur une autre séance repart de ses valeurs. */}
      {session && <EditorBody key={session.id} session={session} onSave={onSave} onDelete={onDelete} onClose={onClose} />}
    </Dialog>
  );
}

function EditorBody({
  session,
  onSave,
  onDelete,
  onClose,
}: {
  session: WorkSession;
  onSave: (session: WorkSession) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [subject, setSubject] = useState<Subject>(session.subject);
  const [startLocal, setStartLocal] = useState(() => toLocalDateTime(session.started_at));
  const [minutes, setMinutes] = useState(() => String(Math.max(1, Math.round(session.duration_seconds / 60))));
  const [note, setNote] = useState(session.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const result = editSession(session, { subject, minutes: Number(minutes), startLocal, note });
    if ("error" in result) {
      setError(SESSION_EDIT_ERRORS[result.error]);
      return;
    }
    onSave(result.session);
    onClose();
  }

  return (
    <form onSubmit={submit} className="space-y-4" aria-label="Corriger la séance">
      <label className="block">
        <span className="t-label mb-1 block">Matière</span>
        <Select value={subject} onChange={(event) => setSubject(event.target.value as Subject)}>
          {subjects.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </Select>
      </label>
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <label className="block min-w-0">
          <span className="t-label mb-1 block">Début</span>
          <Input type="datetime-local" value={startLocal} onChange={(event) => setStartLocal(event.target.value)} required />
        </label>
        <label className="block w-28">
          <span className="t-label mb-1 block">Durée (min)</span>
          <Input type="number" inputMode="numeric" min={1} max={SESSION_MAX_MINUTES} step={1} value={minutes} onChange={(event) => setMinutes(event.target.value)} required />
        </label>
      </div>
      <label className="block">
        <span className="t-label mb-1 block">Note</span>
        <Input value={note} maxLength={280} onChange={(event) => setNote(event.target.value)} placeholder="Facultatif" autoComplete="off" />
      </label>

      {error && (
        <p role="alert" className="text-sm font-semibold text-rose-500">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button type="submit">Enregistrer</Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          Annuler
        </Button>
        {confirmDelete ? (
          <span className="ml-auto flex items-center gap-2">
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => {
                onDelete(session.id);
                onClose();
              }}
            >
              Oui, supprimer
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
              Non
            </Button>
          </span>
        ) : (
          <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={14} aria-hidden /> Supprimer
          </Button>
        )}
      </div>
    </form>
  );
}
