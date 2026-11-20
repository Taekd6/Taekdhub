"use client";

import { useEffect, useRef, useState } from "react";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { bookmarkletHref, decodeFragment } from "@/lib/booleanopera";

const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * Relevé de ton suivi Booleanopera (lib/booleanopera.ts). Le signet lit ton
 * bilan sur booleanopera.fr (session ouverte dans TON navigateur) et revient
 * ici avec les chiffres dans l'adresse (`#bo=…`, jamais envoyée à un serveur).
 */
export function BooleanoperaLink() {
  const { preferences, savePreferences, ready } = usePrepahubData();
  const link = useRef<HTMLAnchorElement>(null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [href, setHref] = useState("");

  useEffect(() => {
    setHref(bookmarkletHref(window.location.origin));
  }, []);

  // React refuse les href `javascript:` : on les pose à la main, sur le lien seulement.
  useEffect(() => {
    if (link.current && href) link.current.setAttribute("href", href);
  }, [href, open]);

  useEffect(() => {
    if (!ready || !window.location.hash.startsWith("#bo=")) return;
    const report = decodeFragment(window.location.hash);
    history.replaceState(null, "", window.location.pathname + window.location.search);
    if (!report) {
      setMessage("Relevé Booleanopera illisible : rien n'a été enregistré.");
      return;
    }
    savePreferences({ ...preferences, booleanopera: report });
    setMessage("Relevé Booleanopera enregistré.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const report = preferences.booleanopera;
  return (
    <div className="x-row" style={{ gap: 12, flexWrap: "wrap", alignItems: "center", margin: "8px 0 16px" }}>
      <span className="x-meta">
        {report
          ? `Booleanopera, relevé du ${dateFmt.format(new Date(report.takenAt))} : ${report.acquired} acquises · ${report.inProgress} en cours · ${report.toReview} à revoir · ${report.boardPassages} passage(s) au tableau`
          : "Booleanopera : aucun relevé pour l'instant"}
      </span>
      <button type="button" className="x-btn soft" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        {open ? "Fermer" : "Mettre à jour"}
      </button>
      {message ? <span className="x-meta">{message}</span> : null}
      {open ? (
        <div style={{ flexBasis: "100%" }}>
          <p className="x-meta">
            1. Glisse ce bouton dans ta barre de favoris : {" "}
            <a ref={link} className="x-btn soft" onClick={(event) => event.preventDefault()}>
              Relevé Booleanopera
            </a>
            . 2. Va sur booleanopera.fr, connecté. 3. Clique le favori : tu reviens ici avec tes chiffres. Aucun mot de passe n&apos;est lu, rien ne passe par un serveur.
          </p>
        </div>
      ) : null}
    </div>
  );
}
