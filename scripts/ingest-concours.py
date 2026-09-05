#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Ingestion LOCALE d'un recueil d'exercices de concours au format PDF.

Pourquoi un script séparé, et pourquoi sa sortie n'est jamais versionnée :
les recueils d'oraux (CCINP, Centrale, Mines, X…) sont l'œuvre de leurs
auteurs. Le dépôt TaekdHub est public : y committer des énoncés tiers serait
une redistribution publique. Ce script produit donc un fichier d'import
DESTINÉ AU NAVIGATEUR de l'élève (Exercices → Importer), qui reste sur sa
machine. Le code d'ingestion est versionné, jamais le contenu ingéré.

Usage :
    pip install pdfminer.six
    python3 scripts/ingest-concours.py --zip exos.zip --out /tmp/concours.json
    python3 scripts/ingest-concours.py --pdf un-fichier.pdf --concours CCINP \
        --epreuve "Oral" --filiere MP --chapitre "Réduction des endomorphismes"

Puis, dans TaekdHub : Exercices → Importer → choisir le fichier produit.

QUALITÉ AVANT QUANTITÉ. Un PDF de mathématiques n'est pas une source de
texte fiable : les formules affichées (matrices, sommes, produits) y sont
dessinées morceau par morceau et ressortent en miettes. Le filtre de ce
script REJETTE tout exercice dont l'extraction n'est pas propre plutôt que
de produire un énoncé mutilé. Le taux de rejet est élevé, c'est voulu.
"""

import argparse, json, re, sys, unicodedata, zipfile
from pathlib import Path

try:
    from pdfminer.high_level import extract_pages
    from pdfminer.layout import LAParams, LTTextContainer
except ImportError:
    sys.exit("pdfminer.six est requis :  pip install pdfminer.six")

# --------------------------------------------------------------------------
# 1. Décodage des glyphes
#
# Ces PDF utilisent les polices Computer Modern avec un encodage que
# l'extraction ne sait pas résoudre : les accents ressortent en « Ø », les
# ligatures et les symboles mathématiques en « (cid:NN) ». Chaque entrée
# ci-dessous a été établie en lisant le contexte réel dans les fichiers
# (« vØri(cid:28)ant » → « vérifiant »), jamais devinée.
# --------------------------------------------------------------------------
CID_MAP = {
    # délimiteurs extensibles (grandes parenthèses, accolades, crochets)
    0: "(", 1: ")", 8: "{", 9: "}", 18: "(", 19: ")",
    26: "{", 32: "(", 33: ")", 40: "{", 74: "⟦", 75: "⟧",
    110: "{", 111: "}",
    # barres et normes
    12: "|", 13: "‖", 107: "‖",
    # ligatures
    27: "ff", 28: "fi", 30: "ffi",
    # opérateurs et relations (tables cmsy/cmex)
    20: "≤", 21: "≥", 48: "′", 54: "≠", 55: "↦",
    80: "∑", 88: "∑", 81: "∏", 89: "∏", 82: "∫", 90: "∫",
    96: "ℓ", 98: "⌊", 99: "⌋", 104: "⟨", 105: "⟩",
    112: "√", 114: "√", 115: "√",
    126: "",  # accent vecteur : la flèche est dessinée à part, on la retire
    # lettres accentuées majuscules et cédilles
    192: "À", 201: "É", 224: "à", 231: "ç", 238: "î", 239: "ï", 244: "ô",
}
CHAR_MAP = {"Ø": "é", "ß": "û", "Ł": "è", "Œ": "ê", "ø": "ù", "": "", "": "", "": ""}


def decode(text: str) -> str:
    for cid, repl in CID_MAP.items():
        text = text.replace(f"(cid:{cid})", repl)
    # « ≠ » et « ↦ » sont composés de deux glyphes dans la source : on les
    # recolle AVANT la substitution générale, sinon on obtient « ≠= » ou « ↦→ ».
    text = text.replace("(cid:54)=", "≠").replace("(cid:55)→", "↦")
    text = text.replace("≠=", "≠").replace("↦→", "↦")
    for bad, good in CHAR_MAP.items():
        text = text.replace(bad, good)
    # Les délimiteurs extensibles (grandes parenthèses/accolades dessinées)
    # occupent la zone Private Use : ils n'ont aucun sens hors mise en page.
    text = "".join(ch for ch in text if not (0xE000 <= ord(ch) <= 0xF8FF))
    return unicodedata.normalize("NFC", text)


# --------------------------------------------------------------------------
# 2. Extraction respectant les COLONNES
#
# Les pages sont en paysage et sur deux colonnes. Une lecture linéaire
# entrelace les exercices : le texte de l'exercice 1 se retrouve coupé par
# celui de l'exercice 5. On regroupe donc les blocs par colonne avant de les
# ordonner de haut en bas.
# --------------------------------------------------------------------------
def page_text(page) -> str:
    blocks = [b for b in page if isinstance(b, LTTextContainer)]
    if not blocks:
        return ""
    split = page.width / 2
    left = sorted((b for b in blocks if b.x0 < split), key=lambda b: -b.y1)
    right = sorted((b for b in blocks if b.x0 >= split), key=lambda b: -b.y1)
    return "\n".join(b.get_text() for b in left + right)


def pdf_text(path: Path) -> str:
    pages = extract_pages(str(path), laparams=LAParams(line_margin=0.3))
    return decode("\n".join(page_text(p) for p in pages))


def strip_noise(text: str) -> str:
    """Retire l'appareil de page (en-tête, pied, mention de diffusion)."""
    text = NOISE_RE.sub("", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


# --------------------------------------------------------------------------
# 3. Découpage en exercices, et appariement avec les corrections
# --------------------------------------------------------------------------
# En-têtes, pieds de page et mentions de diffusion réinjectés au fil du texte
# par les sauts de page : ils n'appartiennent à aucun énoncé.
NOISE_RE = re.compile(
    r"^\s*(?:\[http[^\]]*\]\s*édité le .*"
    r"|Diffusion autorisée[^\n]*"
    r"|Énoncés\s*|Enoncés\s*|Corrections\s*"
    r"|\d{1,3}\s*)$", re.M)

EXO_RE = re.compile(r"Exercice\s+(\d+)\s*\[\s*(\d+)\s*\]\s*\[Correction\]")
COR_RE = re.compile(r"Exercice\s+(\d+)\s*:\s*\[énoncé\]")
SECTION_RE = re.compile(r"^[A-ZÉÈÀÔ][^.\n]{3,60}$")


def split_statements(text: str):
    """Renvoie [(numéro, identifiant, énoncé, sous-thème)] pour la partie « Énoncés »."""
    head = text.split("Corrections", 1)[0]
    out, marks = [], list(EXO_RE.finditer(head))
    for i, m in enumerate(marks):
        end = marks[i + 1].start() if i + 1 < len(marks) else len(head)
        body = head[m.end():end]
        # Le titre de section apparaît juste avant un exercice : on le retire
        # du corps et on le retient comme sous-thème.
        section = None
        lines = [l.rstrip() for l in body.strip().split("\n")]
        while lines and not lines[-1].strip():
            lines.pop()
        if len(lines) >= 2 and SECTION_RE.match(lines[-1].strip()) and not lines[-1].strip().endswith((".", ":", ",")):
            section = lines.pop().strip()
            while lines and not lines[-1].strip():
                lines.pop()
        out.append((int(m.group(1)), m.group(2), strip_noise("\n".join(lines)), section))
    return out


def split_corrections(text: str):
    if "Corrections" not in text:
        return {}
    tail = text.split("Corrections", 1)[1]
    res, marks = {}, list(COR_RE.finditer(tail))
    for i, m in enumerate(marks):
        end = marks[i + 1].start() if i + 1 < len(marks) else len(tail)
        res[int(m.group(1))] = strip_noise(tail[m.end():end])
    return res


# --------------------------------------------------------------------------
# 4. Filtre QUALITÉ — le cœur du script
#
# Un énoncé n'entre dans la banque que s'il est intégralement lisible. Les
# motifs ci-dessous signalent une extraction abîmée : glyphe non résolu,
# reste de matrice éclatée en fragments, ligne réduite à un nombre isolé.
# --------------------------------------------------------------------------
def quality_issue(text: str) -> str | None:
    if len(text) < 70:
        return "trop court (extraction probablement tronquée)"
    if len(text) > 2500:
        return "trop long (exercices probablement fusionnés)"
    if "(cid:" in text:
        return "glyphe non résolu"
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    if not lines:
        return "vide"
    # Une formule affichée ressort en fragments minuscules empilés : plusieurs
    # lignes de 1 à 3 caractères d'affilée trahissent une matrice démontée.
    tiny = sum(1 for l in lines if len(l) <= 3)
    if tiny >= 3:
        return "formule affichée éclatée (matrice/somme démontée)"
    if tiny / len(lines) > 0.30:
        return "mise en page fragmentée"
    if re.search(r"\.\.\.\s*\n\s*\.\.\.", text):
        return "points de suspension de matrice"
    # Une accolade d'ensemble « { x | P(x) } » dessinée en 2D ressort avec ses
    # barres détachées, sur leur propre ligne ou en tête de ligne. L'énoncé
    # reste lisible en apparence mais l'ordre des membres est faux.
    if re.search(r"^\s*\|", text, re.M) or re.search(r"^\s*\|\s*$", text, re.M):
        return "barres d'ensemble détachées (ordre des lignes non fiable)"
    if text.count(" | ") >= 3:
        return "barres d'ensemble dispersées"
    # Une intégrale, une somme ou une fraction affichée est dessinée en
    # plusieurs morceaux empilés : bornes, numérateur, dénominateur. Quand un
    # gros opérateur voisine des fragments très courts, l'ordre de lecture
    # restitué n'a plus rien à voir avec la formule d'origine.
    if re.search(r"[∫∑∏√]", text):
        short = sum(1 for l in lines if len(l) <= 14)
        if short >= 2:
            return "formule affichée en morceaux (intégrale/somme/fraction)"
    if not re.search(r"[.?]\s*$", text.strip()) and not text.strip().endswith(("]", ")", "$")):
        return "énoncé sans fin de phrase (probablement coupé)"
    return None


# --------------------------------------------------------------------------
# 5. Métadonnées de provenance
#
# `provenance` encode le NIVEAU DE VÉRIFICATION, jamais une supposition :
#   concours-verifie  concours + année + épreuve + numéro tous connus
#   concours-partiel  concours et épreuve connus, année inconnue
# Un recueil d'oraux donne le concours et l'épreuve mais pas la session :
# ces exercices sont donc « partiel », et l'interface le dit.
# --------------------------------------------------------------------------
# X et ENS sont hors périmètre : l'élève ne les prépare pas. Les fichiers
# correspondants du recueil sont simplement ignorés.
CONCOURS_PAR_FICHIER = {
    "ccp": ("CCINP", "Oral"), "centrale": ("Centrale", "Oral"),
    "mines": ("Mines-Ponts", "Oral"),
    "tpe": ("TPE-EIVP", "Oral"), "ensiie": ("ENSIIE", "Oral"),
    "enstim": ("IMT", "Oral"),
}
CHAPITRE_PAR_FICHIER = {"algèbre": "Algèbre — oral", "analyse": "Analyse — oral", "sup": "Première année — oral"}


# Classification dans la taxonomie réelle du programme MP. L'ordre compte :
# la première entrée dont un motif apparaît l'emporte, du plus spécifique au
# plus général. Un exercice non reconnu garde le chapitre générique du
# fichier plutôt que d'être rangé arbitrairement.
CHAPITRES_MP = [
    ("Réduction des endomorphismes", r"diagonalis|trigonalis|valeur propre|vecteur propre|sous-espace propre|polynôme caractéristique|polynôme minimal|nilpotent|spectre|Cayley|\bréduction\b|réduire l"),
    ("Espaces préhilbertiens et euclidiens", r"euclidien|préhilbertien|produit scalaire|orthonormé|orthogonal|isométrie|rotation|autoadjoint|symétrique d[’']un espace"),
    ("Séries entières", r"série entière|rayon de convergence|développement en série"),
    ("Suites et séries de fonctions", r"convergence uniforme|convergence normale|série de fonctions|suite de fonctions"),
    ("Intégration sur un intervalle", r"intégrable|convergence dominée|intégrale généralisée|intégrale impropre|intégrale dépendant"),
    ("Équations différentielles", r"équation différentielle|wronskien|y[’']{1,2}\s*[+=-]"),
    ("Probabilités", r"probabilité|variable aléatoire|espérance|loi de|indépendan"),
    ("Espaces vectoriels normés et topologie", r"norme|compact|dense|adhérence|ouvert|fermé|topologi|converge vers|borné"),
    ("Groupes, anneaux et arithmétique", r"\bgroupe|\banneau|\bidéal|\bmorphisme de groupe|divisib|congru|premier entre eux|pgcd|\bZ/n"),
    ("Polynômes", r"polynôme|racine|scindé|irréductible|interpolation"),
    ("Déterminants", r"déterminant|det\("),
    ("Matrices et systèmes", r"matrice|rang|inversible|trace|système linéaire"),
    ("Applications linéaires", r"endomorphisme|application linéaire|noyau|image|forme linéaire|projecteur"),
    ("Espaces vectoriels", r"espace vectoriel|famille libre|génératrice|base|dimension|supplémentaire|hyperplan"),
    ("Séries numériques", r"série|convergen[ct]"),
    ("Suites numériques", r"suite"),
    ("Fonctions d'une variable réelle", r"continue|dérivable|développement limité|croissance"),
]


def classify(statement: str, fallback: str) -> str:
    low = statement.lower()
    for chapitre, motif in CHAPITRES_MP:
        if re.search(motif, low):
            return chapitre
    return fallback


ACTION_RE = re.compile(
    r"^\(?[a-z]?\)?\s*(Montrer|Démontrer|Calculer|Déterminer|Étudier|Trouver|Résoudre|"
    r"Établir|Prouver|Justifier|Donner|Exprimer|Comparer|Décrire)\b", re.I)


def make_title(statement: str, ident: str) -> str:
    """
    Un titre qui dit ce qu'il y a À FAIRE.

    La première phrase d'un énoncé pose le décor (« Soit E un espace
    euclidien… ») et, quand elle contient une formule affichée, elle ressort
    en miettes. La phrase d'action — « Montrer que… », « Calculer… » — décrit
    l'exercice et se lit bien ; on la préfère dès qu'on en trouve une.
    """
    flat = re.sub(r"\s+", " ", statement.replace("\n", " ")).strip()
    phrases = [p.strip() for p in re.split(r"(?<=[.?])\s+", flat) if p.strip()]
    chosen = next((p for p in phrases if ACTION_RE.match(p)), None) or (phrases[0] if phrases else "")
    chosen = chosen.strip(" .;:,")
    # Un titre saturé de symboles est le signe d'une formule mal restituée :
    # on retombe alors sur un intitulé neutre plutôt que d'afficher du bruit.
    letters = sum(ch.isalpha() or ch.isspace() for ch in chosen)
    if not chosen or (len(chosen) and letters / len(chosen) < 0.72):
        return f"Exercice d'oral {ident}"
    if len(chosen) > 88:
        chosen = chosen[:88].rsplit(" ", 1)[0] + "…"
    return chosen


def difficulty_for(concours: str, text: str) -> int:
    base = {"CCINP": 3, "TPE-EIVP": 3, "ENSIIE": 3, "IMT": 3, "Centrale": 4, "Mines-Ponts": 4, "X": 5}.get(concours, 3)
    if len(text) > 900:
        base = min(5, base + 1)
    return base


def build_row(concours, epreuve, filiere, chapitre, num, ident, statement, correction, section, origin):
    return {
        "title": make_title(statement, ident),
        "statement": statement,
        "correction": correction or "",
        "source": f"{concours} — {epreuve} — recueil D. Delaunay (CPGE Dupuy de Lôme), exercice {ident}",
        "subject": "Mathématiques",
        "type": "Concours",
        "chapter": classify(statement, chapitre),
        "tags": [t for t in [section, f"oral {concours}"] if t],
        "difficulty": difficulty_for(concours, statement),
        "estimatedMinutes": 25 if len(statement) < 500 else 40,
        "competition": concours,
        "epreuve": epreuve,
        "filiere": filiere,
        "exerciseNumber": ident,
        "provenance": "concours-partiel",
        "programmeLevel": "spe",
        "licenseStatus": "à vérifier",
        "externalId": f"delaunay-{ident}",
        "sourceUrl": "http://mp.cpgedupuydelome.fr",
        "note": f"Énoncé issu du recueil de David Delaunay ({origin}). "
                f"Concours et épreuve identifiés, SESSION INCONNUE : provenance partielle.",
    }


def process(pdf_path: Path, concours, epreuve, filiere, chapitre, stats):
    text = pdf_text(pdf_path)
    corrections = split_corrections(text)
    rows = []
    for num, ident, statement, section in split_statements(text):
        stats["vus"] += 1
        issue = quality_issue(statement)
        if issue:
            stats["rejets"][issue] = stats["rejets"].get(issue, 0) + 1
            continue
        corr = corrections.get(num, "")
        if corr and quality_issue(corr):
            corr = ""  # énoncé propre mais correction abîmée : on garde l'énoncé seul
            stats["corr_rejetees"] += 1
        rows.append(build_row(concours, epreuve, filiere, chapitre, num, ident, statement, corr, section, pdf_path.name))
        stats["gardes"] += 1
    return rows


def main():
    ap = argparse.ArgumentParser(description="Ingestion locale d'un recueil de concours (sortie NON versionnée).")
    ap.add_argument("--zip", type=Path, help="archive contenant exercices-oraux/*.pdf")
    ap.add_argument("--pdf", type=Path, help="un seul PDF")
    ap.add_argument("--concours"); ap.add_argument("--epreuve", default="Oral")
    ap.add_argument("--filiere", default="MP"); ap.add_argument("--chapitre")
    ap.add_argument("--out", type=Path, required=True)
    a = ap.parse_args()

    stats = {"vus": 0, "gardes": 0, "corr_rejetees": 0, "rejets": {}}
    rows, workdir = [], Path("/tmp/taekdhub-ingest")

    if a.zip:
        workdir.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(a.zip) as z:
            for name in z.namelist():
                if not name.startswith("exercices-oraux/") or not name.endswith(".pdf"):
                    continue
                stem = Path(name).stem.lower()
                key = stem.split("-")[0]
                if key not in CONCOURS_PAR_FICHIER:
                    continue
                concours, epreuve = CONCOURS_PAR_FICHIER[key]
                part = stem.split("-", 1)[1] if "-" in stem else ""
                if part == "sup":
                    continue  # programme de première année : hors périmètre MP
                chapitre = CHAPITRE_PAR_FICHIER.get(part, "Oral de concours")
                z.extract(name, workdir)
                print(f"  · {name} → {concours} / {epreuve}", file=sys.stderr)
                rows += process(workdir / name, concours, epreuve, "MP", chapitre, stats)
    elif a.pdf:
        if not a.concours:
            sys.exit("--concours est obligatoire avec --pdf")
        rows += process(a.pdf, a.concours, a.epreuve, a.filiere, a.chapitre or "Oral de concours", stats)
    else:
        sys.exit("Fournir --zip ou --pdf")

    # Dédoublonnage sur l'identifiant stable de l'exercice.
    seen, unique = set(), []
    for r in rows:
        if r["externalId"] in seen:
            stats["rejets"]["doublon"] = stats["rejets"].get("doublon", 0) + 1
            continue
        seen.add(r["externalId"]); unique.append(r)

    a.out.parent.mkdir(parents=True, exist_ok=True)
    a.out.write_text(json.dumps(unique, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\n{stats['vus']} exercices lus, {len(unique)} retenus "
          f"({100*len(unique)//max(1,stats['vus'])} %), {stats['corr_rejetees']} corrections écartées.")
    print("Rejets :")
    for reason, n in sorted(stats["rejets"].items(), key=lambda kv: -kv[1]):
        print(f"  {n:5d}  {reason}")
    print(f"\nÉcrit dans {a.out} — à importer depuis TaekdHub (Exercices → Importer).")


if __name__ == "__main__":
    main()
