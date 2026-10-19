#!/usr/bin/env python3
"""Outils du référentiel de cours (referentiel/**/cartes*.jsonl).

  python3 scripts/referentiel/referentiel.py check           # valide le schéma et les règles
  python3 scripts/referentiel/referentiel.py md              # régénère les tableaux Markdown (cartes.md)
  python3 scripts/referentiel/referentiel.py deck            # .apkg (nécessite `pip install genanki`)
  python3 scripts/referentiel/referentiel.py index           # data/referentiel-index.json (outil MCP chercher_referentiel)

Rien ne touche à une collection Anki : le paquet produit est un fichier à importer à la main.
L'anglais est hors périmètre : tout chemin ou champ qui en porte le nom fait échouer `check`.
"""
import json, re, sys, glob, os, html

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
REF = os.path.join(ROOT, "referentiel")
TYPES = {"définition", "énoncé", "hypothèses", "piège", "contre-exemple", "exemple", "méthode", "formule", "démonstration", "ordre de grandeur", "interprétation", "dimension"}
SOURCE_OK = re.compile(r"^(aucune consultée.*|[A-Z0-9-]+(, [A-Z0-9-]+)*)$")
MATIERES = {"maths": "Mathématiques", "physique": "Physique", "chimie": "Chimie", "info": "Informatique"}
ENGLISH = re.compile(r"anglais|english", re.I)


def files():
    return sorted(glob.glob(os.path.join(REF, "**", "cartes*.jsonl"), recursive=True))


def load(path):
    with open(path, encoding="utf-8") as f:
        return [json.loads(l) for l in f if l.strip()]


def check():
    errors, ids, total = [], set(), 0
    for path in files():
        rel = os.path.relpath(path, ROOT)
        if ENGLISH.search(rel):
            errors.append(f"{rel}: chemin d'anglais interdit")
            continue
        rows = load(path)
        rectos = set()
        for i, c in enumerate(rows, 1):
            where = f"{rel}:{i}"
            for k in ("id", "chapitre", "groupe", "type", "recto", "verso", "validation"):
                if k not in c:
                    errors.append(f"{where}: champ manquant « {k} »")
            if errors and errors[-1].startswith(where):
                continue
            total += 1
            if ENGLISH.search(json.dumps(c, ensure_ascii=False)) and re.search(r"\b(anglais|english)\b", c["groupe"] + c["chapitre"], re.I):
                errors.append(f"{where}: contenu d'anglais interdit")
            if c["id"] in ids:
                errors.append(f"{where}: identifiant dupliqué {c['id']}")
            ids.add(c["id"])
            if c["type"] not in TYPES:
                errors.append(f"{where}: type inconnu {c['type']}")
            if c["recto"] in rectos:
                errors.append(f"{where}: recto dupliqué")
            rectos.add(c["recto"])
            if len(c["verso"]) > 450:
                errors.append(f"{where}: verso trop long ({len(c['verso'])} caractères) : scinder la carte")
            if "?" not in c["recto"] and not re.match(r"^(Énoncer|Donner|Citer|Calculer|Définir|Écrire|Rappeler|Démontrer|Montrer|Déterminer|Expliquer|Compléter|Caractériser|Justifier|Conclure|Dériver|Esquisser|Étudier|Exprimer|Décomposer|Déduire|Appliquer|Résoudre|Simplifier|Retrouver|Interpréter|Vérifier|Réduire|Comparer|Distinguer|Identifier|Utiliser|Quelle|Quel|Que|Qu')", c["recto"]):
                errors.append(f"{where}: recto sans question (« {c['recto'][:50]} »)")
            v = c["validation"]
            if v.get("mathematique") not in ("vérifié", "à vérifier"):
                errors.append(f"{where}: validation.mathematique invalide")
            if not SOURCE_OK.match(v.get("source", "")):
                errors.append(f"{where}: validation.source invalide : {v.get('source')}")
    # une carte ne peut citer qu'une source effectivement lue
    try:
        sources = {s["id"]: s for s in json.load(open(os.path.join(REF, "sources.json"), encoding="utf-8"))["sources"]}
        for extra in sorted(glob.glob(os.path.join(REF, "sources", "*.json"))):
            for s in json.load(open(extra, encoding="utf-8"))["sources"]:
                if s["id"] in sources:
                    errors.append(f"{os.path.relpath(extra, ROOT)}: id de source déjà défini : {s['id']}")
                sources[s["id"]] = s
    except Exception as e:
        sources = {}
        errors.append(f"sources.json illisible : {e}")
    for path in files():
        for c in load(path):
            src = c["validation"].get("source", "")
            if not src.startswith("aucune"):
                for sid in src.split(", "):
                    if sid not in sources or not sources[sid].get("statut_acces", "").startswith("lue"):
                        errors.append(f"{c['id']}: source {sid} citée mais non lue (statut_acces)")
    for e in errors:
        print("ERREUR", e)
    print(f"{total} cartes dans {len(files())} fichier(s), {len(errors)} erreur(s)")
    return 1 if errors else 0


def md():
    esc = lambda s: s.replace("|", "\\|").replace("\n", " ")
    for path in files():
        rows = load(path)
        cur, out = None, [f"# Cartes : {rows[0]['chapitre']}", "",
                          "Généré par `scripts/referentiel/referentiel.py md` depuis le `.jsonl` voisin : **ne pas modifier à la main**.", "",
                          "Validation : « vérifié » = contrôlé par raisonnement ; source : voir `referentiel/sources.json` ; exigibilité : voir colonne.", ""]
        for c in rows:
            if c["groupe"] != cur:
                cur = c["groupe"]
                out += ["", f"### {cur}", "", "| # | Type | Recto | Verso | Exigibilité | Remarque |", "|---|---|---|---|---|---|"]
            out.append(f"| {c['id']} | {c['type']} | {esc(c['recto'])} | {esc(c['verso'])} | {esc(c['validation']['exigibilite'])} | {esc(c.get('note',''))} |")
        target = path.replace(".jsonl", ".md")
        open(target, "w", encoding="utf-8").write("\n".join(out) + "\n")
        print("écrit", os.path.relpath(target, ROOT))


def cell(t):
    """Texte d'un champ Anki. La flèche combinante U+20D7 (vecteur) s'affiche comme un carré vide avec beaucoup de
    polices : on l'habille en HTML/CSS (flèche « → » présente partout) au lieu de compter sur la police."""
    return re.sub(r"([^\s;])\u20d7", r'<span class="vec">\1</span>', html.escape(t, quote=False).replace("\n", "<br>"))


VEC_CSS = ".vec{position:relative;display:inline-block}.vec::after{content:'\\2192';position:absolute;left:50%;top:-.6em;transform:translateX(-50%);font-size:.7em;line-height:1}"


def index():
    """data/referentiel-index.json : index compact (lu côté serveur par l'outil MCP `chercher_referentiel`). Aucune
    copie de cours : uniquement nos cartes (rédigées de notre main), leurs sources et leur niveau de validation."""
    sources = {}
    for path in [os.path.join(REF, "sources.json")] + sorted(glob.glob(os.path.join(REF, "sources", "*.json"))):
        for src in json.load(open(path, encoding="utf-8"))["sources"]:
            sources[src["id"]] = src
    cards, used = [], set()
    for path in files():
        matiere = MATIERES.get(os.path.relpath(path, REF).split(os.sep)[0], "?")
        for c in load(path):
            ids = [] if c["validation"]["source"].startswith("aucune") else c["validation"]["source"].split(", ")
            used.update(ids)
            cards.append({"id": c["id"], "c": c["chapitre"], "m": matiere, "g": c["groupe"], "t": c["type"], "r": c["recto"], "v": c["verso"],
                          "s": ids, "e": "confirmé" if c["validation"]["exigibilite"].startswith("confirmé") else "à confirmer"})
    reg = {i: {"titre": sources[i].get("titre", ""), "auteur": sources[i].get("auteur", ""), "url": sources[i].get("url_candidate", ""), "type": sources[i].get("type", "")} for i in sorted(used)}
    out = os.path.join(ROOT, "data", "referentiel-index.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump({"cartes": cards, "sources": reg}, f, ensure_ascii=False, separators=(",", ":"))
    print("écrit", os.path.relpath(out, ROOT), len(cards), "cartes,", len(reg), "sources,", os.path.getsize(out) // 1024, "Ko")


def deck():
    import genanki
    def sid(s):
        import zlib
        return zlib.crc32(s.encode()) & 0x7FFFFFFF | 0x40000000
    css = ".card{font-family:system-ui,sans-serif;font-size:19px;text-align:left;max-width:34em;margin:auto}.src{color:#888;font-size:13px;margin-top:1em}" + VEC_CSS
    model = genanki.Model(sid("taekdhub-referentiel-modele-v1"), "TaekdHub — Référentiel", fields=[{"name": "Recto"}, {"name": "Verso"}, {"name": "Id"}],
        templates=[{"name": "Carte", "qfmt": "{{Recto}}", "afmt": "{{FrontSide}}<hr id=answer>{{Verso}}<div class=src>{{Id}}</div>"}], css=css)
    decks = {}
    for path in files():
        rel = os.path.relpath(path, REF).split(os.sep)
        matiere = MATIERES.get(rel[0], rel[0])
        for c in load(path):
            name = f"TaekdHub::Référentiel::{matiere}::{c['chapitre']}"
            d = decks.setdefault(name, genanki.Deck(sid(name), name))
            # GUID dérivé de l'identifiant de la carte, JAMAIS de son texte : corriger un recto ne crée pas de doublon.
            note = genanki.Note(model=model, fields=[cell(c["recto"]), cell(c["verso"]), c["id"]], tags=["taekdhub", "referentiel", c["type"].replace(" ", "_")], guid=genanki.guid_for("taekdhub-referentiel", c["id"]))
            d.add_note(note)
    out = os.path.join(ROOT, "public", "anki", "taekdhub-referentiel.apkg")
    genanki.Package(list(decks.values())).write_to_file(out)
    print("écrit", os.path.relpath(out, ROOT), sum(len(d.notes) for d in decks.values()), "cartes")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "check"
    sys.exit({"check": check, "md": lambda: md() or 0, "deck": lambda: deck() or 0, "index": lambda: index() or 0}[cmd]())
