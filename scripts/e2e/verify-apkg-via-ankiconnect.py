#!/usr/bin/env python3
"""
Importe les paquets de démonstrations par le module AnkiConnect (action
`importPackage`) dans l'Anki qui écoute sur 127.0.0.1:8765, et vérifie : une
note par démonstration (retrouvée par `Ref`), bon paquet, réimport sans doublon,
révision répondue conservée.

À lancer contre le VRAI Anki (scripts/e2e/run-real-anki.py). Le simulateur ne gère pas `importPackage`.
Les chemins doivent être lisibles par le processus Anki (même machine).
"""
import json, pathlib, sys, time, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
FULL, IPAD = ROOT / "public/anki/taekdhub-demonstrations.apkg", ROOT / "public/anki/taekdhub-demonstration-ipad.apkg"
NOTES = json.loads((ROOT / "data/demonstrations.notes.json").read_text(encoding="utf-8"))["notes"]
RANG = "th-demo-m1-theoreme-du-rang"
failures = []


def call(action, **params):
    req = urllib.request.Request("http://127.0.0.1:8765", data=json.dumps({"action": action, "version": 6, "params": params}).encode())
    body = json.load(urllib.request.urlopen(req))
    if body["error"]:
        raise RuntimeError(f"{action}: {body['error']}")
    return body["result"]


def check(ok, message):
    print(("OK    " if ok else "ECHEC ") + message)
    if not ok:
        failures.append(message)


def demo_notes(expected=None, timeout=20):
    """L'import d'Anki se termine après la réponse d'AnkiConnect : on attend l'état attendu (ou le délai)."""
    deadline = time.time() + timeout
    while True:
        notes = call("notesInfo", notes=call("findNotes", query='"note:TaekdHub — Démonstration"'))
        if expected is None or len(notes) == expected or time.time() > deadline:
            return notes
        time.sleep(0.5)


# État de départ propre : aucune note de démonstration.
stale = call("findNotes", query='"note:TaekdHub — Démonstration"')
if stale:
    call("deleteNotes", notes=stale)

check(call("importPackage", path=str(IPAD)) is True, "AnkiConnect importe le paquet d'essai iPad")
notes = demo_notes(1)
check(len(notes) == 1 and notes[0]["fields"]["Ref"]["value"] == RANG, "une seule note, retrouvée par sa référence")
card = call("cardsInfo", cards=notes[0]["cards"])[0]
expected_deck = next(n["deck"] for n in NOTES if n["ref"] == RANG)
check(card["deckName"] == expected_deck, f"paquet du chapitre : {expected_deck}")
check("Sans support" in card["question"] and "Soit S un suppl" not in card["question"], "recto rendu par Anki : consigne, sans la preuve")
check("Soit S un suppl" in card["answer"] and "Points critiques" in card["answer"], "verso rendu par Anki : preuve et points critiques")

# Une VRAIE révision, répondue par le module.
check(call("answerCards", answers=[{"cardId": card["cardId"], "ease": 3}]) == [True], "une révision est répondue dans Anki (« Bien »)")
before = call("cardsInfo", cards=[card["cardId"]])[0]
check(before["reps"] == 1, f"reps = {before['reps']}")

check(call("importPackage", path=str(FULL)) is True, "AnkiConnect importe ensuite le paquet complet (mêmes notes)")
notes = demo_notes(len(NOTES))
check(len(notes) == len(NOTES), f"{len(NOTES)} notes au total, aucun doublon de la démonstration d'essai")
refs = sorted(n["fields"]["Ref"]["value"] for n in notes)
check(refs == sorted(n["ref"] for n in NOTES), "une note par référence attendue")
after = call("cardsInfo", cards=[card["cardId"]])[0]
check((after["reps"], after["interval"], after["due"]) == (before["reps"], before["interval"], before["due"]), "la révision et la planification de la carte sont conservées")
call("importPackage", path=str(FULL))
time.sleep(3)
check(len(demo_notes()) == len(NOTES), "réimport du paquet complet : toujours aucun doublon")

print("\nTOUT EST VALIDE" if not failures else f"\n{len(failures)} ÉCHEC(S)")
sys.exit(1 if failures else 0)
