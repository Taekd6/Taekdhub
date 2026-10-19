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

## 5. Statut du paquet (avant test d'import)
`public/anki/taekdhub-referentiel.apkg` : **valide, 3 423 notes, GUID uniques, régénéré après la correction de `og-06`**. Non importé : à importer à la main. Ta collection Anki n'est pas modifiée ; l'anglais n'est pas touché.

## 6. Test d'import réel (2026-10-18)

**Environnement.** Bibliothèque officielle `anki` 26.9.3 (moteur Rust d'Anki), collection **temporaire** créée dans `/tmp/anki-test-*` (supprimée après coup). Ton profil Anki, ta collection principale et AnkiWeb n'ont été ni ouverts ni touchés. L'interface graphique d'Anki n'a **pas** été lancée : l'import a été fait par la fonction d'import du moteur, avec les options par défaut (aucune fusion de types de notes). Paquet testé : `public/anki/taekdhub-referentiel.apkg`, créé à 05:08:07, soit après la correction de `og-06` et juste avant son commit (05:08:27) ; il n'a pas été régénéré.

**Tests exécutés et résultats** (scripts rejouables : `scripts/referentiel/test_import.py` et `scripts/referentiel/test_historique_import.py`).
| Test | Résultat |
|---|---|
| Import 1 dans une collection contenant 6 « anciennes » notes factices | **3 423 notes nouvelles**, 0 doublon, 0 conflit ; total 3 429 notes et 3 429 cartes |
| Anciennes notes et cartes après l'import | **identiques** (ids, GUID, dates, champs, intervalle, échéance) |
| Historique de révision (4 révisions factices créées avant l'import) | **identique après l'import 1 et après l'import 2** (revlog, état des cartes, notes) |
| Import 2 du même paquet | **0 nouvelle note, 3 423 reconnues comme déjà présentes, 0 mise à jour** ; totaux inchangés |
| GUID | 3 429 distincts sur 3 429 notes |
| Type de note | un seul type ajouté, « TaekdHub — Référentiel » (champs Recto, Verso, Id ; 1 gabarit) ; aucun type existant modifié |
| Paquets | 59 paquets créés sous `TaekdHub::Référentiel::<matière>::<chapitre>` (54 chapitres + niveaux parents), séparés de tes paquets existants |
| Champs | **0 champ vide** ; texte des 3 423 notes **identique** à celui des `.jsonl` (comparaison exacte) ; 0 identifiant du JSONL absent |
| Rendu par le moteur | question et réponse générées pour les 3 423 cartes, la question contient toujours son recto ; `og-06` affiche bien la version corrigée |
| 5 recouvrements | les 5 paires sont **importées toutes les deux**, avec des GUID distincts et dans des paquets différents ; rien n'est supprimé ni fusionné |

**Constats (pas de correction nécessaire).**
- Les champs `origine` et `note` des `.jsonl` ne sont **pas** des champs de la note Anki : seuls Recto, Verso et l'id de la carte (affiché en pied de réponse) sont importés. La traçabilité complète reste dans les `.jsonl` et les `validation.md`.
- Les formules sont du texte Unicode simple (pas de MathJax) : aucun problème de syntaxe possible, mais l'apparence dépend des polices de l'appareil. Le texte contient 777 caractères de l'alphabet mathématique (𝒞, 𝟙, 𝓜…) et 1 548 diacritiques combinants. **Voir §8 : la flèche des vecteurs a été corrigée.**
- Un second import du même paquet n'écrase rien. Le cas d'un paquet *modifié* puis réimporté (mise à jour des notes à GUID identique) n'a pas été testé, faute de nouvelle génération.

**Limites restantes.**
- L'application Anki (bureau, AnkiDroid, AnkiMobile) n'a pas été utilisée : le rendu visuel des symboles et des combinants n'a pas été vu à l'écran. À vérifier au premier import sur ton appareil (quelques cartes de vecteurs et de lettres cursives).
- Le test porte sur une collection factice : tes vraies notes ne partagent aucun GUID avec le paquet (GUID dérivés de nos ids de carte), donc aucune ne peut être écrasée, mais je n'ai pas lu ta collection pour le confirmer.
- Conseil pour le vrai import : sauvegarder la collection (Fichier > Exporter > .colpkg) avant, importer dans le profil habituel sans cocher « mettre à jour les types de notes », puis vérifier le nombre de notes (+3 423).

## 7. Statut du paquet
**Importable sans perte** dans le test isolé (paquet régénéré le 2026-10-19 pour le correctif du §8) : valide, 3 423 notes, GUID uniques, réimportation sans doublon, anciennes notes et historique intacts. Aucune modification du paquet n'a été nécessaire.

## 8. Rendu visuel : défaut trouvé et corrigé (2026-10-19)

**Test.** Six cartes à risque (lettres cursives, doubles barres, vecteurs) rendues dans Chromium avec la feuille de style du paquet, captures d'écran relues.

**Résultat avant correction.**
- Les lettres cursives et doubles barres (𝒮, 𝔻, ℝ, ℂ, 𝕂) et les accents combinants macron, tilde, point, tréma, circonflexe s'affichent correctement.
- **Défaut reproduit** : la flèche combinante U+20D7 des vecteurs (E⃗, n⃗, AM⃗…) s'affichait comme un **carré vide** avec la police par défaut du conteneur. Elle apparaît 1 304 fois dans 327 cartes. Sur ton appareil, le résultat dépend de ses polices, donc la correction est préventive mais le défaut était reproductible.

**Correction.** `scripts/referentiel/referentiel.py` : la fonction `cell()` remplace chaque `X⃗` par `<span class="vec">X</span>`, et la feuille de style du type de note dessine la flèche « → » (présente dans toutes les polices) au-dessus de la lettre. Aucune carte, aucun GUID, aucun JSONL modifié : seul l'habillage du champ change.

**Contrôles après correction (paquet régénéré une seule fois).**
- Rendu : les vecteurs s'affichent avec une flèche au-dessus de la lettre (même échantillon de 6 cartes, capture relue).
- Texte : pour les 3 423 cartes, le texte reconstruit depuis le champ Anki (balise `vec` remplacée par la flèche combinante) est **identique** au JSONL ; 0 flèche combinante restante hors habillage.
- Import réel (collection temporaire, `scripts/referentiel/test_import.py`) rejoué : 3 423 notes nouvelles, réimport = 0 nouvelle note et 3 423 déjà présentes, GUID 3 429/3 429 distincts, 0 champ vide, 0 écart texte, anciennes notes inchangées, 5 recouvrements importés (GUID distincts). L'historique de révision (test déjà réussi) n'est pas affecté, le paquet n'ayant changé que par l'habillage des champs et la feuille de style.
- Le test d'import signale 4 cartes « sans recto dans la question » : artefact du test (le recto commence par une flèche combinante comparée avant habillage), non un défaut ; le texte de ces cartes est identique au JSONL.

**Limites restantes.** Toujours aucun test dans l'application Anki elle-même ; la mise en page fine (flèche légèrement serrée contre la ligne du dessus quand un vecteur est en début de ligne) et les polices de ton appareil restent à voir au premier import. Seuls la flèche combinante et ses cartes ont été corrigés : les autres symboles s'affichent correctement dans l'échantillon.
