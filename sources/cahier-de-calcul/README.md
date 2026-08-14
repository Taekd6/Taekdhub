# Cahier de calcul — source brute

Transcription texte du PDF *Cahier de calcul* (pratique et entraînement),
coordonné par Colas Bardavid, fournie par l'utilisateur dans la conversation
sous forme d'archive `cahier-de-calcul-source-complet.zip`.

**Ce dossier contient la source brute.** L'import structuré vit dans
`datasets/cahier-de-calcul-professeur.json` (122 exercices, format import
TaekdHub habituel — voir plus bas) ; il n'est PAS encore branché sur
l'application (aucune interface, aucun amorçage automatique — voir
`lib/seed.ts`, qui ne le référence pas). C'est un chantier séparé, à venir.

## Provenance

| Champ | Valeur |
|---|---|
| PDF original | `cahier_de_calcul(1).pdf` |
| Pages | 119 |
| SHA-256 du PDF | `2e4597642bf1e658ed5ef4b7e0639de0e863730e48c8b4bfd475d89e453aec87` |
| Méthode d'extraction | `pdftotext -layout` |

Voir `cahier-de-calcul-professeur-manifest.json` pour la version machine-lisible
de ces informations.

## Vérifications effectuées avant intégration au dépôt

- **119 marqueurs `## PAGE NNN`**, séquence 001→119 strictement continue (pas
  de page manquante, pas de doublon).
- **16 fiches** retrouvées à la fois dans le sommaire (page 003) et comme
  en-têtes de page dans le corps du document (`Fiche de calcul no 1` à `no 16`) :
  Trigonométrie, Dérivation, Primitives, Calcul d'intégrales, Intégration par
  parties, Changements de variable, Intégration des fractions rationnelles,
  Trigonométrie et nombres complexes, Sommes et produits, Suites numériques,
  Développements limités, Décomposition en éléments simples, Calcul matriciel,
  Algèbre linéaire, Équations différentielles, Séries numériques.
- **Structure confirmée** : pages 1-6 (couverture, crédits, sommaire, mode
  d'emploi) → pages 7-54 (énoncés des 16 fiches) → pages 55-119 (réponses
  brutes et corrigés détaillés, mêmes 16 fiches, même numérotation des
  calculs).
- **Correspondance énoncé ↔ réponse vérifiée par sondage** : ex. Fiche 13
  (Calcul matriciel), les items `13.1 a)` à `13.1 i)` de l'énoncé (page 042)
  correspondent exactement aux réponses `13.1 a)` à `13.1 i)` (page 105).
- **Encodage** : UTF-8 valide sur l'intégralité du fichier (vérifié
  programmatiquement), aucun caractère mal décodé détecté.
- **Comparaison à une version Internet** : le contenu (liste des 16 fiches,
  formulations, "quinzaine de minutes par jour", système de difficulté par
  horloges 1 à 4) correspond au *Cahier de calcul* décrit par l'utilisateur —
  rien n'indique une substitution par une version différente.
- **Décompte préliminaire des calculs** (pages 7-54, en-têtes `Calcul N.M`
  uniquement, sans compter les sous-questions a)/b)/c)/… séparément) :
  **122** blocs de calcul répartis sur les 16 fiches. Ce chiffre est
  informatif — la définition exacte de "un exercice importable" (bloc entier
  vs sous-question individuelle) reste à trancher lors du chantier d'import.

## Difficulté (horloges) et réponses brutes — extraction visuelle (Phase 2)

Les pictogrammes d'horloge et la grille de réponses sont des éléments
**graphiques**, absents de la transcription `pdftotext` (voir historique
ci-dessous). Une deuxième source a été fournie par l'utilisateur pour
combler ce manque : `cahier-de-calcul-pages-visuelles.zip`, les 119 pages
du même cahier rendues en image (PNG, une par page), présentée comme fidèle
au PDF original (`cahier_de_calcul(1).pdf`, même titres de fiche, même
pagination, même contenu que la transcription texte — cohérence vérifiée
par recoupement mais SHA-256 du zip non comparable à celui du PDF, formats
différents). Ces images ne sont pas conservées dans le dépôt (utilisées en
espace de travail temporaire uniquement) ; seul le résultat de leur lecture
est intégré au dataset.

**Méthode** : détection automatique des rangées de pictogrammes (bande de
pixels sombres à droite de chaque en-tête "Calcul N.M"), puis lecture
visuelle directe de chaque rangée (convention confirmée depuis la légende
"Mode d'emploi" du cahier : rangée de 4 icônes remplie à partir de la
DROITE — 1 horloge = ○○○●, 2 = ○○●●, 3 = ○●●●, 4 = ●●●●) et de chaque page
de réponses ("Réponses", une page dense à deux colonnes par fiche, avant
les corrigés). Aucune valeur n'est déduite du contenu mathématique de
l'énoncé ni d'une source externe — uniquement ce qui est visuellement lisible
sur la page correspondante. Un échantillon a été revérifié indépendamment
(pages 9, 57, 87, 100, 117) et concorde exactement avec les valeurs
retenues.

**Résultat** : les 122 entrées portent désormais un champ `difficulty`
numérique (1 à 4, distribution 60/37/20/5), le tag `"difficulté non
vérifiée"` a été retiré partout où la difficulté a pu être lue avec
certitude (122/122 — aucune resté ambiguë). Le champ `answer` (réponse
brute) est renseigné pour 121/122 entrées.

**Seule exception** : `CDC-3.10` (Fiche 3, "Dériver puis intégrer,
intégrer puis dériver") — son énoncé indique explicitement "Reprendre
l'exercice précédent [3.9] en commençant par intégrer... Les calculs seront
évidemment les mêmes" ; la grille de réponses ne contient d'ailleurs aucune
entrée "3.10" (elle passe directement de 3.9 r) à 3.11 a)). Copier les
réponses de 3.9 aurait supposé une correspondance terme à terme non
imprimée dans le cahier : `answer` reste donc `null` plutôt que déduit.

### Réponses brutes — grille à deux colonnes, risque de mélange

Le cahier présente les réponses brutes dans une mise en page dense à deux
colonnes où le texte d'une même réponse peut se répartir sur plusieurs
lignes entrelacées avec la colonne voisine. C'est cette mise en page qui
rendait l'extraction par texte linéaire (`pdftotext -layout`) non fiable
(risque d'attribuer la réponse d'un calcul à un autre) — d'où le recours à
la lecture visuelle directe (ci-dessus) plutôt qu'à un nouveau parsing du
texte. Les **corrigés détaillés** ("Corrigés", texte linéaire, séparés par
calcul), eux, restent extraits depuis la transcription texte (fiable,
alimentent `correction` pour 110 des 122 calculs — 12 n'ont qu'une réponse
brute dans le cahier, sans corrigé détaillé, situation conservée telle
quelle).

## Fichiers

- `cahier-de-calcul-professeur-source.md` — transcription complète, un bloc
  `## PAGE NNN` par page, contenu brut entre balises ` ```text `.
- `cahier-de-calcul-professeur-manifest.json` — métadonnées de provenance.

Le zip original contenait aussi un dossier `chunks/` (le même contenu
re-découpé en 8 fichiers de ~90 Ko). Vérifié strictement identique par
concaténation (`diff` sans écart) — non conservé dans le dépôt pour éviter
une ambiguïté sur la source faisant foi : `cahier-de-calcul-professeur-source.md`
est l'unique référence.

## Import structuré

`datasets/cahier-de-calcul-professeur.json` contient les 122 calculs, au
format d'import habituel de TaekdHub (même forme que
`datasets/exercices-banque-complete.json`, consommé par
`lib/exercise-import.ts#parseExerciseImportPayload`) :

- `title` : `"Calcul N.M — <description ou fiche>"`.
- `statement` : énoncé complet, texte nettoyé (bruit de mise en page de PDF
  retiré — en-têtes/pieds de page, glyphes de délimiteurs multi-lignes —
  mais **aucune valeur, signe, exposant ou borne modifié**).
- `source` : toujours `"Cahier de calcul — professeur"`.
- `subject` : toujours `"Mathématiques"`.
- `chapter` : le titre de la fiche d'origine (ex. `"Trigonométrie"`,
  `"Calcul matriciel"`) — crée un nouveau chapitre si aucun chapitre du même
  nom n'existe déjà pour la matière, le réutilise sinon (comportement natif
  de l'import, pas une règle spécifique à ce chantier).
- `tags` : `"Cahier de calcul"`, la sous-partie de la fiche si identifiée
  (ex. `"Formules d'addition"`), et `"difficulté non vérifiée"` UNIQUEMENT
  pour une entrée dont la difficulté n'a pas pu être lue avec certitude sur
  le pictogramme horloge (aucune actuellement — voir section précédente).
- `difficulty` : 1 à 4, lu sur le pictogramme horloge de la page d'énoncé
  (voir section précédente) — jamais déduit du contenu mathématique.
- `answer` : réponse brute, lue sur la grille "Réponses" de la fiche ;
  `null` quand le cahier n'en imprime pas une pour ce calcul précis (1/122
  — voir section précédente), jamais une valeur devinée ou recopiée d'un
  autre calcul.
- `note` : provenance exacte (fiche, calcul, sous-partie, prérequis de la
  fiche en prose — jamais forcés dans le champ `prerequisites`, qui attend
  des étiquettes courtes, pas des phrases).
- `correction` : corrigé détaillé, quand le cahier en fournit un (110/122).
- `licenseStatus: "à vérifier"` : contenu externe identifié, droits de
  redistribution non vérifiés — même traitement que les sujets de concours
  existants dans l'architecture (jamais présumé "libre").
- `externalId` : `"CDC-N.M"`, identifiant stable pour retrouver le calcul
  source correspondant (traçabilité, vérification reproductible).

**Vérification reproductible** : `pnpm run verify:cahier-calcul` (voir
`scripts/verify-cahier-calcul.mjs`) recompte indépendamment les pages/fiches/
calculs directement dans la source brute, puis vérifie que l'ensemble exact
des `externalId` du dataset correspond à l'ensemble exact des `Calcul N.M`
trouvés dans la source — pas seulement une égalité de nombres. Vérifie aussi
que chaque entrée a soit une difficulté 1-4 résolue soit le tag `"difficulté
non vérifiée"` (jamais les deux, jamais aucun des deux), et rapporte la
distribution des difficultés et le nombre de réponses (`answer`) associées.

Toute ambiguïté mathématique doit être tranchée en revenant à cette
transcription, et en cas de doute persistant, à la page correspondante du
PDF original — jamais devinée.
