"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Group, Row } from "@/components/ui/grouped";
import { usePrepahubData } from "@/hooks/use-prepahub-data";
import { avatarCrop, normalizeAvatar } from "@/lib/avatar";
import { localData } from "@/lib/storage";

/**
 * PHOTO DE PROFIL — remplace l'initiale de l'accueil (components/home/hero.tsx).
 *
 * L'image choisie ne quitte pas l'appareil telle quelle : elle est recadrée
 * en carré centré et réduite (lib/avatar.ts#avatarCrop) dans un canvas, puis
 * enregistrée en JPEG dans les préférences — quelques dizaines de
 * kilo-octets au lieu des mégaoctets d'une photo de téléphone. Elle suit
 * alors la sauvegarde et la synchronisation du compte comme le reste des
 * préférences.
 *
 * Enregistrée tout de suite, sans bouton « Enregistrer » : comme la palette,
 * c'est un choix visuel qui se voit aussitôt.
 */
export function AvatarPicker() {
  const { preferences, savePreferences, ready } = usePrepahubData();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const avatar = ready ? preferences.avatarDataUrl : null;
  const initial = ((ready ? preferences.displayName : "").trim()[0] ?? "T").toUpperCase();

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const dataUrl = await shrink(file);
      if (!dataUrl) {
        setError("Cette image n'a pas pu être lue. Essaie une photo JPEG ou PNG.");
        return;
      }
      // Relire le disque au moment d'écrire, et ne toucher qu'au champ de ce composant.
      savePreferences({ ...localData.preferences(), avatarDataUrl: dataUrl });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  function remove() {
    setError(null);
    savePreferences({ ...localData.preferences(), avatarDataUrl: null });
  }

  return (
    <Group title="Photo" footer={error ?? "Affichée en haut de l'accueil. Recadrée en carré et réduite : elle reste légère."}>
      <Row label="Photo de profil" stack>
        <div className="flex items-center gap-4">
          <span className="grad-brand grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full text-xl font-semibold">
            {avatar ? <Image src={avatar} alt="Ta photo de profil" width={64} height={64} unoptimized className="h-full w-full object-cover" /> : initial}
          </span>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" disabled={!ready || busy} onClick={() => input.current?.click()}>
              <Camera size={15} aria-hidden /> {avatar ? "Changer" : "Choisir une photo"}
            </Button>
            {avatar && (
              <Button type="button" variant="ghost" size="sm" onClick={remove}>
                <Trash2 size={15} aria-hidden /> Retirer
              </Button>
            )}
          </div>
          <input ref={input} type="file" accept="image/*" aria-label="Photo de profil" className="hidden" onChange={(event) => void onFile(event.target.files?.[0])} />
        </div>
      </Row>
    </Group>
  );
}

/** Recadre en carré centré, réduit et encode en JPEG — `null` si l'image est illisible ou trop lourde même réduite. */
async function shrink(file: File): Promise<string | null> {
  const url = URL.createObjectURL(file);
  try {
    const image = await load(url);
    const crop = avatarCrop(image.naturalWidth, image.naturalHeight);
    if (!crop) return null;
    const canvas = document.createElement("canvas");
    canvas.width = crop.size;
    canvas.height = crop.size;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(image, crop.sx, crop.sy, crop.side, crop.side, 0, 0, crop.size, crop.size);
    // Qualité dégressive : la première qui passe la limite de taille l'emporte.
    for (const quality of [0.85, 0.7, 0.5]) {
      const dataUrl = normalizeAvatar(canvas.toDataURL("image/jpeg", quality));
      if (dataUrl) return dataUrl;
    }
    return null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function load(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image illisible"));
    image.src = url;
  });
}
