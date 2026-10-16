#!/usr/bin/env python3
"""
Génère public/anki/taekdhub-demonstrations.apkg à partir de
data/demonstrations.notes.json (lui-même produit par
scripts/export-demo-notes.mjs : le rendu des champs n'existe qu'une fois,
dans lib/demo-cards.ts).

Outil de développement (pip install genanki), pas une dépendance de
l'application. Identifiants FIXES : le modèle, les paquets et les notes
(GUID tiré de la référence « th-demo-<id> »). Réimporter une version corrigée
met les notes à jour au lieu de les dupliquer, et l'historique de révision
est conservé par Anki.

    node --experimental-strip-types scripts/export-demo-notes.mjs
    python3 scripts/build-demo-deck.py
"""
import hashlib
import json
import pathlib

import genanki

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = json.loads((ROOT / "data" / "demonstrations.notes.json").read_text(encoding="utf-8"))


def stable_id(text: str) -> int:
    return int(hashlib.sha1(text.encode("utf-8")).hexdigest()[:12], 16) % (1 << 31) + (1 << 30)


spec = DATA["model"]
MODEL = genanki.Model(
    stable_id("taekdhub-demonstration-modele-v1"),
    spec["modelName"],
    fields=[{"name": name} for name in spec["inOrderFields"]],
    templates=[{"name": t["Name"], "qfmt": t["Front"], "afmt": t["Back"]} for t in spec["cardTemplates"]],
    css=spec["css"],
)

decks = {}
for note in DATA["notes"]:
    deck = decks.setdefault(note["deck"], genanki.Deck(stable_id(note["deck"]), note["deck"]))
    deck.add_note(
        genanki.Note(
            model=MODEL,
            fields=[note["fields"][name] for name in spec["inOrderFields"]],
            tags=[tag.replace(" ", "_") for tag in note["tags"]],
            guid=genanki.guid_for("taekdhub", note["ref"]),
        )
    )

out = ROOT / "public" / "anki" / "taekdhub-demonstrations.apkg"
genanki.Package(list(decks.values())).write_to_file(str(out))
print(f"{out.relative_to(ROOT)} : {len(DATA['notes'])} notes, {len(decks)} paquets")
