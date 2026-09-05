# -*- coding: utf-8 -*-
"""
Décodage des glyphes mathématiques d'un PDF LaTeX, POLICE PAR POLICE.

Pourquoi ce module existe : un PDF produit par LaTeX embarque ses polices
sans table ToUnicode. L'extraction rend alors « (cid:20) », un code interne
qui n'a de sens QUE rapporté à la police qui l'a dessiné. Le même code 20
vaut « ⩽ » en CMSY10 et « [ » (crochet extensible) en CMEX10. Un dictionnaire
global, comme celui qu'on avait au début, se trompe donc forcément sur l'un
des deux — et un crochet transformé en inégalité change le sens de l'énoncé.

Les tables ci-dessous sont celles, publiques et stables depuis les années
1980, des polices Computer Modern de Knuth. On ne mappe QUE les positions
dont la lecture est certaine ; tout code inconnu reste « (cid:N) » à
l'écran, ce qui fait échouer le contrôle qualité en aval — c'est voulu :
mieux vaut rejeter un exercice que le livrer avec un symbole faux.
"""

# CMEX10 — délimiteurs extensibles et grands opérateurs.
#
# Cette table a été établie EMPIRIQUEMENT sur le document CCINP, en lisant le
# contexte de chaque code, et non recopiée de mémoire : une première version
# « déduite » plaçait des crochets de partie entière là où le document met de
# simples crochets, et des chevrons là où il met une accolade de système.
# Chaque entrée ci-dessous correspond à une lecture vérifiée :
#   16/17 « ln(1 + x/n) »          18/19 « binom(n, k) » (292 occurrences)
#   20/21 « continue sur [0, 1/n] » 26   « { x ≡ 6 [5] ; x ≡ 4 [8] »
#   32/33 « (∫ f_n)_{n∈N} »         2/3  « [−e^{−t}t^x]_0^{+∞} »
#   104/105 « ∑ [ ln(1+x/n) − x/n ] »
# Les tailles multiples d'un même délimiteur sont ramenées au même caractère :
# la taille est de la mise en page, pas du sens.
CMEX10 = {
    0: "(", 1: ")", 2: "[", 3: "]",
    12: "|", 13: "‖",
    16: "(", 17: ")", 18: "(", 19: ")", 20: "[", 21: "]",
    8: "{", 9: "}", 26: "{", 27: "}", 40: "{", 41: "}", 110: "{", 111: "}",
    32: "(", 33: ")", 34: "[", 35: "]",
    104: "[", 105: "]",
    80: "∑", 81: "∏", 82: "∫",
    88: "∑", 89: "∏", 90: "∫",
    91: "⋃", 92: "⋂",
    98: "∮", 99: "∮",
    112: "√", 113: "√", 114: "√", 115: "√", 116: "√",
    # 122-125 sont les MORCEAUX d'une accolade horizontale (\underbrace) :
    # aucun caractère ne les représente honnêtement, et l'expression qu'ils
    # annotent est de toute façon disloquée. On les laisse non résolus pour
    # que le contrôle qualité écarte l'exercice.
}

# CMSY10 — symboles mathématiques.
CMSY10 = {
    0: "−", 1: "·", 2: "×", 3: "*", 4: "÷", 5: "⋄", 6: "±", 7: "∓",
    8: "⊕", 9: "⊖", 10: "⊗", 11: "⊘", 12: "⊙", 13: "○", 14: "∘", 15: "∙",
    16: "≍", 17: "≡", 18: "⊆", 19: "⊇", 20: "≤", 21: "≥", 22: "⪯", 23: "⪰",
    24: "∼", 25: "≈", 26: "⊂", 27: "⊃", 28: "≪", 29: "≫", 30: "≺", 31: "≻",
    32: "←", 33: "→", 34: "↑", 35: "↓", 36: "↔", 37: "↗", 38: "↘", 39: "≃",
    40: "⇐", 41: "⇒", 42: "⇑", 43: "⇓", 44: "⇔", 45: "↖", 46: "↙", 47: "∝",
    48: "′", 49: "∞", 50: "∈", 51: "∋", 52: "△", 53: "▽", 54: "̸", 55: "↦",
    56: "∀", 57: "∃", 58: "¬", 59: "∅", 60: "ℜ", 61: "ℑ", 62: "⊤", 63: "⊥",
    91: "∪", 92: "∩", 93: "⊎", 94: "∧", 95: "∨", 106: "|", 107: "‖",
    112: "√", 114: "▽", 118: "√",
}

# CMMI — lettres mathématiques ; seules quelques positions non lettres nous
# concernent (les lettres, elles, ressortent correctement).
CMMI = {58: ".", 59: ",", 60: "<", 61: "/", 62: ">", 63: "⋆", 96: "ℓ"}

# stmary10 — double crochets d'intervalle d'entiers, très utilisés en prépa.
STMARY10 = {74: "⟦", 75: "⟧"}

# MSAM / MSBM (AMS) — quelques symboles courants.
MSAM10 = {54: "⩽", 62: "⩾", 44: "≦", 45: "≧"}

FONT_TABLES = [
    ("CMEX", CMEX10), ("CMSY", CMSY10), ("CMMI", CMMI),
    ("STMARY", STMARY10), ("MSAM", MSAM10), ("MSBM", MSAM10),
    # Latin Modern est le successeur direct de Computer Modern : même encodage.
    ("LMEX", CMEX10), ("LMSY", CMSY10), ("LMMI", CMMI),
]


def resolve(fontname: str, cid: int) -> str | None:
    """Le caractère réellement dessiné, ou None si la police est inconnue."""
    upper = (fontname or "").upper()
    for marker, table in FONT_TABLES:
        if marker in upper:
            return table.get(cid)
    return None
