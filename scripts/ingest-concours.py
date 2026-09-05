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
    from pdfminer.layout import LAParams, LTChar, LTLine, LTRect, LTTextLine
except ImportError:
    sys.exit("pdfminer.six est requis :  pip install pdfminer.six")

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pdf_glyphs import resolve  # noqa: E402

# --------------------------------------------------------------------------
# 1. Décodage des glyphes, POLICE PAR POLICE
#
# Un même code interne ne veut pas dire la même chose selon la police qui l'a
# dessiné : 20 est « ⩽ » en CMSY10 et « [ » en CMEX10. La table globale qu'on
# utilisait au début se trompait donc nécessairement sur l'un des deux. Le
# module pdf_glyphs résout chaque code en fonction de sa police réelle, et
# laisse « (cid:N) » visible quand il ne sait pas — ce qui fait échouer le
# contrôle qualité plutôt que de livrer un symbole faux.
# --------------------------------------------------------------------------
CHAR_MAP = {"Ø": "é", "ß": "û", "Ł": "è", "Œ": "ê", "ø": "ù"}
CID_RE = re.compile(r"^\(cid:(\d+)\)$")


def decode(text: str) -> str:
    """Nettoyage des caractères mal transcodés qui ne dépendent pas d'une police."""
    text = text.replace("(cid:54)=", "≠").replace("(cid:55)→", "↦")
    text = text.replace("≠=", "≠").replace("↦→", "↦").replace("↦−→", "↦")
    for bad, good in CHAR_MAP.items():
        text = text.replace(bad, good)
    # Faux-gras : LaTeX simule le gras en redessinant le glyphe avec un
    # léger décalage, et l'extraction rend « α ⩽⩽⩽ 0 ». On ramène toute
    # répétition d'un même symbole de relation à une seule occurrence.
    text = re.sub(r"([⩽⩾≤≥<>=≠∈⊂⇒⇔])\1{2,}", r"\1", text)
    # Les délimiteurs extensibles occupent la zone à usage privé d'Unicode :
    # ils n'ont de sens que pour la mise en page.
    text = "".join(ch for ch in text if not (0xE000 <= ord(ch) <= 0xF8FF))
    return unicodedata.normalize("NFC", text)


def char_text(ch) -> str:
    """Le caractère réellement dessiné, résolu via sa police si nécessaire."""
    raw = ch.get_text()
    match = CID_RE.match(raw)
    if not match:
        return raw
    resolved = resolve(ch.fontname, int(match.group(1)))
    return resolved if resolved is not None else raw


# --------------------------------------------------------------------------
# 2. Extraction respectant les COLONNES
#
# Les pages sont en paysage et sur deux colonnes. Une lecture linéaire
# entrelace les exercices : le texte de l'exercice 1 se retrouve coupé par
# celui de l'exercice 5. On regroupe donc les blocs par colonne avant de les
# ordonner de haut en bas.
# --------------------------------------------------------------------------
# Marqueur injecté là où un SURLIGNAGE a été détecté — voir _overline_marks.
OVERLINE_MARK = "⟪surlignage⟫"


def _lines_and_rules(page):
    lines, rules, chars, stack = [], [], [], [page]
    while stack:
        obj = stack.pop()
        if isinstance(obj, LTTextLine):
            lines.append(obj)
            chars.extend(c for c in obj if isinstance(c, LTChar))
        elif isinstance(obj, (LTRect, LTLine)):
            rules.append(obj)
        elif hasattr(obj, "__iter__"):
            try:
                stack.extend(list(obj))
            except TypeError:
                pass
    return lines, rules, chars


def _overline_marks(lines, rules, chars):
    """
    Repère les lignes portant un SURLIGNAGE, et elles seules.

    Un surlignage — adhérence d'une partie, conjugué d'un complexe, événement
    contraire — est tracé comme un TRAIT, pas comme un caractère : il
    s'évapore à l'extraction. « A ⊂ B ⟹ Ā ⊂ B̄ » devient alors
    « A ⊂ B ⟹ A ⊂ B », c'est-à-dire un énoncé trivial et FAUX. Rien dans le
    texte obtenu ne permet de s'en apercevoir : c'est le pire cas possible,
    une corruption silencieuse.
    
    On distingue le surlignage de la barre de fraction par ce qui l'entoure :
    une fraction a du texte au-dessus ET au-dessous, un surlignage seulement
    au-dessous. Sur le document CCINP, 1330 barres de fraction pour 65
    surlignages — c'est bien une minorité identifiable, pas un rejet massif.
    """
    marked = set()
    for rule in rules:
        height, width = rule.y1 - rule.y0, rule.x1 - rule.x0
        if height > 2.5 or width < 4:
            continue
        overlaps = lambda c: c.x1 > rule.x0 and c.x0 < rule.x1
        # La fenêtre « au-dessus » doit rester PLUS SERRÉE que l'interligne
        # (environ 13,7 pt ici) : trop large, elle prenait la ligne de texte
        # précédente pour un numérateur et classait tous les surlignages en
        # barres de fraction. Un numérateur, lui, colle à sa barre.
        above = any(rule.y1 - 0.5 <= c.y0 <= rule.y1 + 4.5 and overlaps(c) for c in chars)
        below = any(rule.y0 - 9 <= c.y1 <= rule.y0 + 1.5 and overlaps(c) for c in chars)
        if above or not below:
            continue
        for index, line in enumerate(lines):
            # Le trait se pose juste au-dessus des lettres qu'il surligne :
            # sa hauteur dépasse donc légèrement le sommet de la ligne.
            if line.y0 - 9 <= rule.y0 <= line.y1 + 5 and line.x1 > rule.x0 and line.x0 < rule.x1:
                marked.add(index)
                break
    return marked


def page_text(page, two_columns: bool) -> str:
    """
    Texte d'une page, dans l'ordre de LECTURE.

    Les recueils d'oraux sont composés sur deux colonnes en paysage : lues
    linéairement, elles entrelacent les exercices (le texte de l'exercice 1
    se retrouve coupé par celui de l'exercice 5). Le document officiel du
    CCINP, lui, est sur une seule colonne. D'où le paramètre.
    """
    lines, rules, chars = _lines_and_rules(page)
    if not lines:
        return ""
    marked = _overline_marks(lines, rules, chars)
    # Les espaces d'une ligne sont des LTAnno, pas des LTChar : les filtrer
    # collerait tous les mots entre eux (« EXERCICE1analyse »).
    render = lambda line: "".join(
        char_text(c) if isinstance(c, LTChar) else c.get_text() for c in line
    ).rstrip()
    tag = lambda index, line: render(line) + (OVERLINE_MARK if index in marked else "")
    numbered = list(enumerate(lines))
    if not two_columns:
        numbered.sort(key=lambda p: (-round(p[1].y1, 1), p[1].x0))
        return "\n".join(tag(i, l) for i, l in numbered)
    split = page.width / 2
    left = sorted((p for p in numbered if p[1].x0 < split), key=lambda p: -p[1].y1)
    right = sorted((p for p in numbered if p[1].x0 >= split), key=lambda p: -p[1].y1)
    return "\n".join(tag(i, l) for i, l in left + right)


def pdf_text(path: Path, two_columns: bool = True) -> str:
    pages = extract_pages(str(path), laparams=LAParams(line_margin=0.3))
    return decode("\n".join(page_text(p, two_columns) for p in pages))


def strip_noise(text: str) -> str:
    """Retire l'appareil de page (en-tête, pied, mention de diffusion)."""
    text = NOISE_RE.sub("", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


# --------------------------------------------------------------------------
# 3. Découpage en exercices, et appariement avec les corrections
# --------------------------------------------------------------------------
# En-têtes, pieds de page et mentions de diffusion réinjectés au fil du texte
# par les sauts de page : ils n'appartiennent à aucun énoncé.
# Une ligne réduite à des délimiteurs ou à un grand opérateur, sans rien
# d'autre : la formule qu'elle structurait a perdu son contenu.
ORPHAN_DELIM_RE = re.compile(r"^[()\[\]{}√∑∏∫|‖⟦⟧⌊⌋⟨⟩]+$")

NOISE_RE = re.compile(
    r"^\s*(?:\[http[^\]]*\]\s*édité le .*"
    r"|Diffusion autorisée[^\n]*"
    r"|Banque épreuve orale de mathématiques session \d{4}, CCINP[^\n]*"
    r"|Mise à jour\s*:\s*\d{2}/\d{2}/\d{4}\s*"
    r"|CC BY-NC-SA[^\n]*"
    r"|Page\s+\d+\s*"
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
def quality_issue(text: str, *, strict_end: bool = True, max_len: int = 2500) -> str | None:
    """
    `strict_end` n'a de sens que lorsque la fin de l'énoncé est DEVINÉE. Dans
    un recueil à deux colonnes, on découpe au marqueur de l'exercice suivant
    et une phrase inachevée trahit une troncature. Le document officiel du
    CCINP, lui, délimite explicitement énoncé et corrigé : un énoncé peut donc
    parfaitement se terminer par une formule, et l'exiger ponctué écartait
    quatorze exercices intacts.
    """
    if len(text) < 70:
        return "trop court (extraction probablement tronquée)"
    if len(text) > max_len:
        return "trop long (exercices probablement fusionnés)"
    if "(cid:" in text:
        return "glyphe non résolu"
    if OVERLINE_MARK in text:
        return "surlignage perdu (adhérence, conjugué ou événement contraire)"
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    if not lines:
        return "vide"
    # SIGNAL DÉCISIF : un délimiteur orphelin.
    #
    # Une formule affichée est dessinée en deux dimensions ; l'extraction la
    # met à plat. Deux cas très différents en résultent. Une BORNE déplacée
    # (« ∑ » puis « n=1 » puis « n » sur trois lignes) reste parfaitement
    # lisible : l'élève reconstitue la somme sans effort. Une PARENTHÈSE ou un
    # opérateur seul sur sa ligne, en revanche, signale que la structure de
    # l'expression est perdue — on ne sait plus ce qu'elle enferme.
    #
    # Le seuil de trois a été calibré sur le document CCINP : à zéro, un ou
    # deux orphelins les 85 énoncés restent lisibles ; au-delà, les
    # expressions sont réellement disloquées. Compter les lignes courtes, ce
    # qu'on faisait avant, rejetait au contraire des énoncés parfaits dont la
    # seule faute était une somme indexée.
    # On mesure une DENSITÉ, pas un total : un corrigé de deux pages contient
    # naturellement plus de formules qu'un énoncé de dix lignes, et un seuil
    # absolu le condamnait pour sa seule longueur. Trois orphelins restent le
    # plancher — en dessous, l'énoncé se lit toujours.
    orphans = sum(1 for l in lines if ORPHAN_DELIM_RE.match(l))
    if orphans >= 3 and orphans / len(lines) >= 0.08:
        return f"formule affichée disloquée ({orphans} délimiteurs orphelins sur {len(lines)} lignes)"
    # Une matrice éclatée : plusieurs lignes ne contenant que des entrées
    # séparées par des espaces, sans un mot de français.
    matrix_rows = sum(1 for l in lines if re.fullmatch(r"[-−\d\s.,a-z]{2,40}", l) and len(l.split()) >= 3)
    if matrix_rows >= 3:
        return "matrice éclatée en fragments"
    if re.search(r"\.\.\.\s*\n\s*\.\.\.", text):
        return "points de suspension de matrice"
    if strict_end and not re.search(r"[.?]\s*$", text.strip()) and not text.strip().endswith(("]", ")", "$")):
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
    # Du plus SPÉCIFIQUE au plus général : la première entrée qui reconnaît un
    # motif l'emporte. « Analyse » et « Algèbre » n'y figurent pas — ce sont
    # les deux moitiés du programme, pas des chapitres : y ranger un exercice
    # revient à ne pas le ranger.
    ("Réduction des endomorphismes", r"diagonalis|trigonalis|valeur propre|vecteur propre|sous-espace propre|polynôme caractéristique|polynôme minimal|nilpotent|spectre|cayley|\bréduction\b"),
    ("Calcul différentiel", r"sur r2|de r2 dans r|\(x, ?y\) ∈ r2|dérivée partielle|∂f|∂x|extremum|extrema|point critique|gradient"),
    ("Espaces préhilbertiens et euclidiens", r"euclidien|préhilbertien|produit scalaire|orthonormé|orthogonal|isométrie|autoadjoint|matrice symétrique|\bs\+?n ?\(r\)"),
    ("Séries entières", r"série entière|rayon de convergence|développement en série"),
    ("Suites et séries de fonctions", r"convergence uniforme|convergence normale|série de fonctions|suite de fonctions"),
    ("Intégration", r"intégrable|convergence dominée|intégrale généralisée|intégrale impropre|intégrale dépendant|∫|primitive"),
    ("Équations différentielles", r"équation différentielle|wronskien"),
    ("Probabilités", r"probabilité|variable aléatoire|espérance|\bloi de\b|indépendan|espace probabilisé"),
    ("Nombres complexes", r"argument d[’\']un nombre complexe|forme trigonométrique|racine n-ième de l|module et argument"),
    ("Arithmétique", r"≡.{0,12}\[\d|congru|pgcd|nombre premier|premiers entre eux|divisibilité"),
    ("Espaces vectoriels normés et topologie", r"norme|compact|dense|adhérence|ouvert|fermé|topologi|borné"),
    ("Groupes, anneaux et arithmétique", r"\bgroupe|\banneau|\bidéal|morphisme de groupe|\bz/n"),
    ("Polynômes", r"polynôme|racine|scindé|irréductible|interpolation"),
    ("Déterminants", r"déterminant|det\("),
    ("Matrices et systèmes", r"matrice|rang|inversible|trace|système linéaire"),
    ("Applications linéaires", r"endomorphisme|application linéaire|noyau|image|forme linéaire|projecteur"),
    ("Espaces vectoriels", r"espace vectoriel|famille libre|génératrice|\bbase\b|dimension|supplémentaire|hyperplan"),
    ("Séries numériques", r"série|convergen[ct]"),
    ("Suites numériques", r"\bsuite\b"),
    ("Dérivation", r"dérivée d[’\']ordre|formule de leibniz|accroissements finis|dérivable"),
    ("Fonctions", r"continue|développement limité|croissance|théorème des valeurs"),
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
    # Les numéros de question ne font pas partie du titre : « (a) Prouver
    # que… » ou « 1. Montrer que… » donnaient des intitulés qui commençaient
    # au milieu de l'énoncé.
    strip_marker = lambda p: re.sub(r"^(?:N\.B\.\s*:\s*|\(?[a-z0-9]{1,2}[.)]\s*)+", "", p).strip()
    phrases = [strip_marker(p) for p in re.split(r"(?<=[.?])\s+", flat) if strip_marker(p)]
    # Une phrase d'action assez longue pour dire quelque chose : « Justifier »
    # tout seul n'est pas un titre.
    chosen = next((p for p in phrases if ACTION_RE.match(p) and len(p) >= 28), None)
    if not chosen:
        chosen = next((p for p in phrases if len(p) >= 28), phrases[0] if phrases else "")
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


# --------------------------------------------------------------------------
# 5 bis. Banque officielle CCINP — provenance COMPLÈTE
#
# Contrairement à un recueil d'oraux, ce document dit tout : le concours, la
# session, l'épreuve, le numéro de chaque exercice et le domaine. C'est donc
# la seule source rencontrée jusqu'ici qui puisse prétendre à
# « concours-verifie ». Le document est publié sous licence CC BY-NC-SA 3.0
# FR, ce qui autorise sa réutilisation avec attribution.
#
# Une précision qui compte : le PDF est publié « filière MP et filière MPI ».
# Rien n'y rattache un exercice donné à l'une plutôt qu'à l'autre, donc les
# deux filières sont enregistrées. Choisir MP seul serait inventer.
# --------------------------------------------------------------------------
CCINP_HEADER_RE = re.compile(r"EXERCICE\s+(\d+)\s+(analyse|alg[èe]bre|probabilit[ée]s)", re.I)
CCINP_ENONCE_RE = re.compile(r"[ÉE]nonc[ée]\s+[Ee]xercice\s+(\d+)")
CCINP_CORRIGE_RE = re.compile(r"Corrig[ée]\s+[Ee]xercice\s+(\d+)")

# Domaine annoncé par le document → chapitre de repli, utilisé seulement si
# l'analyse du contenu ne reconnaît rien de plus précis.
# Repli quand l'analyse du contenu ne reconnaît rien. « Analyse » et
# « Algèbre » ne sont PAS des chapitres : ce sont les deux moitiés du
# programme. Y ranger un exercice, c'est ne pas le ranger. On préfère donc
# un chapitre réel, quitte à ce qu'il soit large.
CCINP_DOMAINE = {"analyse": "Fonctions", "algèbre": "Espaces vectoriels",
                 "algebre": "Espaces vectoriels",
                 "probabilités": "Probabilités", "probabilites": "Probabilités"}


def parse_ccinp(paths, session: str, stats):
    text = strip_noise("\n".join(pdf_text(p, two_columns=False) for p in paths))
    heads = list(CCINP_HEADER_RE.finditer(text))
    rows = []
    for i, head in enumerate(heads):
        number = int(head.group(1))
        domaine = head.group(2).lower()
        end = heads[i + 1].start() if i + 1 < len(heads) else len(text)
        block = text[head.end():end]

        enonce = CCINP_ENONCE_RE.search(block)
        corrige = CCINP_CORRIGE_RE.search(block)
        stats["vus"] += 1
        if not enonce:
            stats["rejets"].setdefault("énoncé introuvable", []).append(number)
            continue
        statement = strip_noise(block[enonce.end(): corrige.start() if corrige else len(block)])
        correction = strip_noise(block[corrige.end():]) if corrige else ""

        # Les bornes sont explicites dans ce document, donc pas de contrôle de
        # fin de phrase ; un corrigé est légitimement long, d'où un plafond
        # nettement plus haut que pour un énoncé.
        issue = quality_issue(statement, strict_end=False, max_len=4500)
        if issue:
            stats["rejets"].setdefault(issue, []).append(number)
            continue
        if correction and quality_issue(correction, strict_end=False, max_len=20000):
            correction = ""
            stats["corr_rejetees"] += 1

        chapitre = classify(statement, CCINP_DOMAINE.get(domaine, "Oral de concours"))
        rows.append({
            "title": make_title(statement, str(number)),
            "statement": statement,
            "correction": correction,
            "source": f"CCINP — banque de l'épreuve orale de mathématiques, session {session}, "
                      f"exercice {number} (filière MP et MPI). Licence CC BY-NC-SA 3.0 FR.",
            "subject": "Mathématiques",
            "type": "Concours",
            "chapter": chapitre,
            "tags": [domaine, "oral CCINP"],
            "difficulty": difficulty_for("CCINP", statement),
            "estimatedMinutes": 25,
            "competition": "CCINP",
            "epreuve": "Oral de mathématiques",
            # Le document ne distingue pas MP de MPI : on garde les deux.
            "filieres": ["MP", "MPI"],
            "exerciseNumber": str(number),
            "year": int(session),
            "provenance": "concours-verifie",
            "programmeLevel": "spe",
            "licenseStatus": "libre",
            "externalId": f"ccinp-{session}-{number}",
            "sourceUrl": "https://www.concours-commun-inp.fr/fr/epreuves/les-epreuves-orales.html",
            "note": f"Banque officielle CCINP, session {session}, exercice {number}, "
                    f"filières MP et MPI. Publié sous licence CC BY-NC-SA 3.0 FR.",
        })
        stats["gardes"] += 1
    return rows


def process(pdf_path: Path, concours, epreuve, filiere, chapitre, stats):
    text = pdf_text(pdf_path)
    corrections = split_corrections(text)
    rows = []
    for num, ident, statement, section in split_statements(text):
        stats["vus"] += 1
        issue = quality_issue(statement)
        if issue:
            stats["rejets"].setdefault(issue, []).append(ident)
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
    ap.add_argument("--ccinp", type=Path, nargs="+", help="PDF(s) de la banque officielle CCINP")
    ap.add_argument("--session", default="2025", help="session de la banque CCINP (défaut : 2025)")
    ap.add_argument("--out", type=Path, required=True)
    a = ap.parse_args()

    stats = {"vus": 0, "gardes": 0, "corr_rejetees": 0, "rejets": {}}
    if a.ccinp:
        rows = parse_ccinp(sorted(a.ccinp), a.session, stats)
        write_output(rows, a.out, stats)
        return
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

    write_output(rows, a.out, stats)


def write_output(rows, out: Path, stats):
    """Dédoublonne sur l'identifiant stable, écrit le fichier, rend compte."""
    seen, unique = set(), []
    for row in rows:
        if row["externalId"] in seen:
            stats["rejets"].setdefault("doublon", []).append(row["externalId"])
            continue
        seen.add(row["externalId"])
        unique.append(row)

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(unique, ensure_ascii=False, indent=2), encoding="utf-8")

    kept = len(unique)
    print(f"\n{stats['vus']} exercices lus, {kept} retenus "
          f"({100 * kept // max(1, stats['vus'])} %), {stats['corr_rejetees']} corrections écartées.")
    if stats["rejets"]:
        print("Rejets :")
        for reason, items in sorted(stats["rejets"].items(), key=lambda kv: -len(kv[1])):
            detail = ", ".join(str(x) for x in sorted(items, key=str)[:24])
            more = "…" if len(items) > 24 else ""
            print(f"  {len(items):5d}  {reason}\n         exercices : {detail}{more}")
    print(f"\nÉcrit dans {out} — à importer depuis TaekdHub (Exercices → Importer).")


if __name__ == "__main__":
    main()
