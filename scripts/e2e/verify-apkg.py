#!/usr/bin/env python3
"""
Vérifie les paquets de démonstrations avec le VRAI moteur d'Anki (bibliothèque
`anki`, la même que l'application de bureau) : import, rendu des cartes par le
moteur de rendu d'Anki, absence de fuite de la preuve sur le recto, réimport
sans doublon, conservation d'une révision déjà faite.

Ce que cela prouve : le fichier .apkg est valide pour Anki et ses cartes
s'affichent comme prévu côté moteur. Ce que cela ne prouve PAS : l'affichage
dans AnkiMobile (iPad), à vérifier sur l'appareil.

    python3 -m venv /tmp/ankienv && /tmp/ankienv/bin/pip install anki genanki
    /tmp/ankienv/bin/python scripts/e2e/verify-apkg.py
"""
import json, pathlib, re, sys, tempfile

from anki.collection import Collection, ImportAnkiPackageOptions, ImportAnkiPackageRequest
from anki.scheduler.v3 import CardAnswer

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
NOTES = {n["ref"]: n for n in json.loads((ROOT / "data/demonstrations.notes.json").read_text(encoding="utf-8"))["notes"]}
FULL = ROOT / "public/anki/taekdhub-demonstrations.apkg"
IPAD = ROOT / "public/anki/taekdhub-demonstration-ipad.apkg"
RANG = "th-demo-m1-theoreme-du-rang"

failures = []


def check(ok, message):
    print(("OK    " if ok else "ECHEC ") + message)
    if not ok:
        failures.append(message)


def fresh():
    return Collection(str(pathlib.Path(tempfile.mkdtemp()) / "col.anki2"))


def do_import(col, package):
    return col.import_anki_package(ImportAnkiPackageRequest(package_path=str(package), options=ImportAnkiPackageOptions())).log


def by_ref(col, ref):
    ids = col.find_notes(f"Ref:{ref}")
    return col.get_note(ids[0]) if len(ids) == 1 else None


def steps_of(html):
    return [re.sub(r"<[^>]+>", "", m).strip() for m in re.findall(r"<li>(.*?)(?:<span|</li>)", html)]


def check_note(col, ref):
    note = by_ref(col, ref)
    check(note is not None, f"{ref} : retrouvée par sa référence (une seule note)")
    if note is None:
        return
    check(note.note_type()["name"] == "TaekdHub — Démonstration", f"{ref} : type de note « TaekdHub — Démonstration »")
    card = col.get_card(col.card_ids_of_note(note.id)[0])
    out = card.render_output()
    front, back = out.question_text, out.answer_text
    check(note["Nom"] in front and "Sans support" in front and "th-board" in front, f"{ref} : recto = nom, consigne, zone de travail")
    check(all(h in front for h in re.findall(r"<li>(.*?)</li>", note["Hypotheses"])), f"{ref} : recto = toutes les hypothèses")
    proof_steps = steps_of(note["Preuve"])
    check(len(proof_steps) >= 3 and not any(step[:35] in re.sub(r"<[^>]+>", "", front) for step in proof_steps), f"{ref} : aucune étape de la preuve sur le recto")
    check(note["Enonce"].split("<br>")[0] not in front and "Points critiques" not in front, f"{ref} : ni énoncé ni points critiques sur le recto")
    check("<script" not in (front + back).lower() and "javascript" not in (front + back).lower(), f"{ref} : aucun JavaScript")
    check(note["Enonce"].split("<br>")[0] in back and all(step[:35] in re.sub(r"<[^>]+>", "", back) for step in proof_steps), f"{ref} : verso = énoncé et toutes les étapes")
    check("Points critiques" in back and note["Source"].split("<br>")[0][:30] in back, f"{ref} : verso = points critiques et source")
    check(ref in back, f"{ref} : référence stable affichée au verso")
    check(col.decks.name(card.did) == NOTES[ref]["deck"], f"{ref} : paquet du chapitre « {NOTES[ref]['deck']} »")


# 1. Paquet d'essai iPad : UNE démonstration, rien d'autre.
col = fresh()
log = do_import(col, IPAD)
check(len(col.find_notes("")) == 1 and len(log.new) == 1, "paquet iPad : exactement 1 note importée")
check_note(col, RANG)
check(len(col.models.all()) >= 1 and sum(1 for m in col.models.all() if m["name"] == "TaekdHub — Démonstration") == 1, "paquet iPad : un seul type de note réutilisable")

# 2. Une révision réelle, puis le paquet complet par-dessus : mise à jour, aucun doublon, révision conservée.
card = col.get_card(col.card_ids_of_note(by_ref(col, RANG).id)[0])
card.start_timer()
col.sched.answer_card(col.sched.build_answer(card=card, states=col._backend.get_scheduling_states(card.id), rating=CardAnswer.GOOD))
before = col.get_card(card.id)
reps, due, ivl = before.reps, before.due, before.ivl
log = do_import(col, FULL)
total = len(col.find_notes(""))
check(total == len(NOTES), f"paquet complet par-dessus l'essai : {len(NOTES)} notes au total (aucun doublon de la démonstration d'essai)")
after = col.get_card(card.id)
check((after.reps, after.due, after.ivl) == (reps, due, ivl) and reps == 1, f"révision conservée (reps={after.reps}, échéance et intervalle inchangés)")
for ref in NOTES:
    check_note(col, ref)

# 3. Réimport du complet : rien de nouveau.
log = do_import(col, FULL)
check(len(log.new) == 0 and len(col.find_notes("")) == len(NOTES), "réimport du paquet complet : aucune note nouvelle")

# 4. Même type de note partout : réutilisable pour les prochaines démonstrations.
check(sum(1 for m in col.models.all() if m["name"] == "TaekdHub — Démonstration") == 1, "un seul type de note pour toutes les démonstrations")
col.close()
print()
print("TOUT EST VALIDE" if not failures else f"{len(failures)} ÉCHEC(S)")
sys.exit(1 if failures else 0)
