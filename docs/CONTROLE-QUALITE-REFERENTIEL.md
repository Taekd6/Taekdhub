# Contrôle qualité économique du référentiel (3 423 cartes)

Contrôle fait sans sous-agent, sans nouvelle recherche web, sans relecture intégrale. Outil réutilisable : `python3 scripts/referentiel/controle.py` (lecture seule).

## 1. Contrôles exécutés (une fois chacun)
| Contrôle | Résultat |
|---|---|
| `referentiel.py check` (schéma, types, ids, versos ≤ 450, rectos interrogatifs, sources citées = sources lues) | 3 423 cartes, 56 fichiers, **0 erreur** |
| Test vitest `lib/referentiel-cartes.test.ts` (6 tests : schéma, ids, anglais interdit, sources lues, ids de sources uniques) | 6 sur 6 passés au dernier commit de production ; non relancé (aucun code modifié) |
| Intégrité du `.apkg` (zip, base SQLite, notes, GUID, champs vides) | zip valide ; 3 423 notes, 3 423 GUID distincts, 3 423 cartes, **0 champ vide**, 54 paquets |
| Identifiants dupliqués | aucun |
| Résidus de format (LaTeX, `[latex]`, balises HTML, `None`/`nan`, versos vides, versos coupés) | aucun réel (les 10 « HTML » détectés sont des `a<b` ; les 69 « accolades » sont des ensembles `{0}`, `{1}`) |
| Rectos identiques (global) | 6 paires, dont 1 faux positif (`rn-183/184` : +∞ contre −∞) ; **5 recouvrements entre chapitres** (voir §3) |
| Paquet régénéré | une fois, après la correction de `og-06` |

## 2. Priorisation par risque (réutilise les champs des cartes)
- versos reconstruits depuis des cartes vides : 121 ;
- cartes sans source lue : 200 (dont 43 en physique-chimie qui sont aussi « exigibilité à confirmer ») ;
- exigibilité incertaine (« à confirmer », hors programme, rappel MPSI) : 563 ;
- formules de physique-chimie sans unité repérable : 27.

## 3. Vérification ciblée
Relues et recalculées (à la main ou par calcul) : les **43 cartes de physique-chimie sans source et à exigibilité incertaine**, un **échantillon de 14 versos reconstruits** (tiré au hasard), les **27 formules sans unité** et les **constantes physiques citées** (ε₀, μ₀, k_B, N_A, R, c, e, h, g : valeurs correctes).
Cartes contrôlées : ailette et équation de la chaleur (dt-39 à 44), moment magnétique et magnéton de Bohr (dp-17 à 23), disque, fil, condensateurs, temps de relaxation, polarisabilité de Thomson (es-27 à 42), plan de courant et tore (ms), câble coaxial (om-18/19), optique géométrique (og-02 à 14), statique des fluides (sp-50 à 54), Clapeyron et Joule-Thomson (td), puissance rayonnée par un dipôle (dr-08), dispersion du plasma (mx-43), Drude (ci-07), comparateur à hystérésis (ea-51), spectre d'un créneau (sg-19).

**Erreur confirmée et corrigée : 1.**
- `og-06` (conjugaison de Newton) : le grandissement était écrit γ = −f'/FA. La bonne relation est **γ = f'/FA = −F'A'/f'**. Vérification chiffrée : f' = 10, OA = −30 ⇒ OA' = 15, γ = −0,5 ; f'/FA = 10/(−20) = −0,5 ✓ ; −f'/FA = +0,5 ✗. Corrigée dans la carte, avec la vérification dans le champ `note`.

**Recouvrements signalés (non supprimés)** dans le champ `note` de la seconde carte de chaque paire : `ra-83`/`cp-116` (A∧BC = 1), `rn-114`/`ev-125` (lipschitzienne ⇒ UC), `rn-110`/`ev-162` et `rn-112`/`ev-163` (théorème de Heine et sa preuve), `ta-33`/`rn-207` (Taylor-Young). Les GUID sont distincts : l'import n'écrase rien ; il suffit de suspendre l'un des deux dans Anki.

## 4. Risques restants
- 200 cartes sans source lue et 563 à exigibilité incertaine : justes d'après les vérifications faites, mais non confirmées par un document (surtout rappels MPSI, hors-programme explicite, ordres de grandeur).
- 107 des 121 versos reconstruits n'ont pas été relus individuellement (14 sur 121 échantillonnés) : leur question a parfois été déduite du nom du paquet (signalé dans `note`).
- Électrochimie (Nernst, piles), dipôle magnétique, induction, corde vibrante : une seule source partielle lue.
- Les ordres de grandeur ajoutés lors de la production (champs magnétiques, ALI…) sont à recouper.
- Le programme officiel est lu sur des copies hébergées par des tiers, non comparées au Bulletin officiel.
- La relecture intégrale des 3 423 cartes n'a pas été faite : l'absence d'erreur détectée n'est pas une preuve d'absence d'erreur.

## 5. Statut du paquet
`public/anki/taekdhub-referentiel.apkg` : **valide, 3 423 notes, GUID uniques, régénéré après la correction de `og-06`**. Non importé : à importer à la main. Ta collection Anki n'est pas modifiée ; l'anglais n'est pas touché.
