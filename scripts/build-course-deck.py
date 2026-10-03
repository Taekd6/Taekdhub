#!/usr/bin/env python3
"""
Génère public/anki/taekdhub-maths-mp.apkg à partir de data/course-cards.json.

Outil de développement (pip install genanki), pas une dépendance de
l'application. Identifiants FIXES (modèle, paquets, notes) : réimporter une
version corrigée met à jour les cartes déjà présentes dans Anki au lieu de
les dupliquer, et l'historique de révision est conservé.

    python3 scripts/build-course-deck.py
"""
import hashlib
import html
import json
import pathlib
import re

import genanki

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = json.loads((ROOT / "data" / "course-cards.json").read_text(encoding="utf-8"))
TITLES = dict(re.findall(r'\["(m\d-[a-z0-9-]+)", "([^"]+)"', (ROOT / "lib" / "programme-data.ts").read_text(encoding="utf-8")))


def stable_id(text: str) -> int:
    return int(hashlib.sha1(text.encode("utf-8")).hexdigest()[:12], 16) % (1 << 31) + (1 << 30)


def cell(text: str) -> str:
    return html.escape(text, quote=False).replace("\n", "<br>")


MODEL = genanki.Model(
    stable_id("taekdhub-cours-modele-v1"),
    "TaekdHub — cours",
    fields=[{"name": "Recto"}, {"name": "Verso"}],
    templates=[{"name": "Carte", "qfmt": "{{Recto}}", "afmt": "{{FrontSide}}<hr id=answer>{{Verso}}"}],
    css=".card { font-family: -apple-system, 'Segoe UI', sans-serif; font-size: 20px; text-align: left; line-height: 1.45; }",
)


decks = []
total = 0
for chapter in DATA["chapters"]:
    title = TITLES[chapter["chapterId"]]
    name = f"TaekdHub::{DATA['subject']}::{title}"
    deck = genanki.Deck(stable_id(name), name)
    for card in chapter["cards"]:
        # Identifiant tiré du chapitre et du recto : corriger un verso met la carte à jour au lieu d'en créer une autre.
        note = genanki.Note(model=MODEL, fields=[cell(card["front"]), cell(card["back"])], tags=["taekdhub", "cours", card["kind"]], guid=genanki.guid_for("taekdhub", chapter["chapterId"], card["front"]))
        deck.add_note(note)
        total += 1
    decks.append(deck)

out = ROOT / "public" / "anki" / "taekdhub-maths-mp.apkg"
genanki.Package(decks).write_to_file(str(out))
print(f"{out.relative_to(ROOT)} : {total} cartes, {len(decks)} paquets")
