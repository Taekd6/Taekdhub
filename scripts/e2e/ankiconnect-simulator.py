#!/usr/bin/env python3
"""
SIMULATEUR d'AnkiConnect (protocole v6) adossé à une VRAIE collection Anki
(bibliothèque `anki`). Ce n'est PAS le module AnkiConnect.

Ce qu'il prouve : le type de note, les champs et les notes que TaekdHub envoie
sont acceptés par le vrai moteur d'Anki, et les recherches par `Ref` / étiquette
y retrouvent les notes. Ce qu'il ne prouve pas : le comportement du vrai module
(analyse des requêtes, CORS, permissions, fil d'exécution d'Anki) — pour cela,
voir scripts/e2e/real-ankiconnect.md.

    /tmp/ankienv/bin/python scripts/e2e/ankiconnect-simulator.py        # écoute sur 127.0.0.1:8765
    SIM_IGNORE_DECK=1 /tmp/ankienv/bin/python scripts/e2e/ankiconnect-simulator.py   # reproduit un défaut constaté avec le vrai module :
                                                                                       # `deckName` d'addNotes ignoré, notes rangées dans « Default »
"""
import json, os, pathlib, sys, tempfile
from http.server import BaseHTTPRequestHandler, HTTPServer

from anki.collection import Collection, ImportAnkiPackageOptions, ImportAnkiPackageRequest

col = Collection(str(pathlib.Path(tempfile.mkdtemp()) / "col.anki2"))
IGNORE_DECK = os.environ.get("SIM_IGNORE_DECK") == "1"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765


def note_info(nid):
    n = col.get_note(nid)
    fields = {name: {"value": n[name], "order": i} for i, name in enumerate(n.keys())}
    return {"noteId": nid, "modelName": n.note_type()["name"], "tags": n.tags, "fields": fields, "cards": list(col.card_ids_of_note(nid))}


def act(action, p):
    if action == "version":
        return 6
    if action == "requestPermission":
        return {"permission": "granted", "version": 6}
    if action == "modelNames":
        return [m["name"] for m in col.models.all()]
    if action == "modelFieldNames":
        return [f["name"] for f in col.models.by_name(p["modelName"])["flds"]]
    if action == "createModel":
        m = col.models.new(p["modelName"])
        for f in p["inOrderFields"]:
            col.models.add_field(m, col.models.new_field(f))
        for t in p["cardTemplates"]:
            tm = col.models.new_template(t["Name"])
            tm["qfmt"], tm["afmt"] = t["Front"], t["Back"]
            col.models.add_template(m, tm)
        m["css"] = p.get("css", "")
        col.models.add(m)
        return None
    if action == "createDeck":
        return col.decks.id(p["deck"])
    if action == "findNotes":
        return list(col.find_notes(p["query"]))
    if action == "findCards":
        return list(col.find_cards(p["query"]))
    if action == "notesInfo":
        return [note_info(n) for n in p["notes"]]
    if action == "cardsInfo":
        out = []
        for cid in p["cards"]:
            c = col.get_card(cid)
            out.append({"cardId": cid, "note": c.nid, "deckName": col.decks.name(c.did), "reps": c.reps, "interval": c.ivl})
        return out
    if action == "canAddNotes":
        res = []
        for n in p["notes"]:
            first = list(n["fields"].values())[0]
            res.append(not [i for i in col.find_notes(f'deck:"{n["deckName"]}"') if col.get_note(i).fields[0] == first])
        return res
    if action == "addNotes":
        ids = []
        for n in p["notes"]:
            note = col.new_note(col.models.by_name(n["modelName"]))
            for k, v in n["fields"].items():
                note[k] = v
            note.tags = n.get("tags", [])
            col.add_note(note, 1 if IGNORE_DECK else col.decks.id(n["deckName"]))
            ids.append(note.id)
        return ids
    if action == "importPackage":
        col.import_anki_package(ImportAnkiPackageRequest(package_path=p["path"], options=ImportAnkiPackageOptions()))
        return True
    if action == "changeDeck":
        col.set_deck(p["cards"], col.decks.id(p["deck"]))
        return None
    if action == "deleteNotes":
        col.remove_notes(p["notes"])
        return None
    if action == "multi":
        return [act(a["action"], a.get("params", {})) for a in p["actions"]]
    raise Exception("unsupported action: " + action)


class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        for k, v in (("Access-Control-Allow-Origin", "*"), ("Access-Control-Allow-Headers", "*"), ("Access-Control-Allow-Private-Network", "true")):
            self.send_header(k, v)

    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        try:
            out = {"result": act(body["action"], body.get("params", {})), "error": None}
        except Exception as e:  # le vrai AnkiConnect renvoie aussi l'erreur dans le corps
            out = {"result": None, "error": str(e)}
        data = json.dumps(out).encode()
        self.send_response(200); self._cors()
        self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(data)))
        self.end_headers(); self.wfile.write(data)

    def log_message(self, *args):
        pass


print(f"Simulateur AnkiConnect sur 127.0.0.1:{PORT} (vraie collection Anki, protocole simulé)", flush=True)
HTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
