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

## Limites connues de l'extraction

### Difficulté par horloge — non récupérable de ce texte

Le cahier signale la difficulté de chaque calcul par des **pictogrammes
d'horloge** (1 à 4 horloges). Ce sont des glyphes graphiques, pas du texte :
`pdftotext` ne les capture pas — vérifié explicitement (la ligne du "Mode
d'emploi" qui les décrit contient des espaces vides à cet endroit, aucun
caractère caché). **Elles sont absentes de cette transcription et du
dataset importé** (`datasets/cahier-de-calcul-professeur.json`), où chaque
exercice porte le tag `"difficulté non vérifiée"` plutôt qu'une valeur
devinée. Toute future extraction nécessitera une inspection visuelle ciblée
du PDF original (page par page, ou rendu en image) — pas une relecture de ce
fichier texte.

### Réponses brutes — non décomposées par calcul individuel

Le cahier présente les réponses brutes ("Réponses", une par calcul, avant
les corrigés détaillés) dans une grille dense à deux colonnes où le texte
d'une même réponse peut se répartir sur plusieurs lignes entrelacées avec
la colonne voisine (vérifié sur plusieurs fiches, y compris les plus
simples — pas un cas isolé). Reconstruire cette mise en page en texte
linéaire de façon fiable, calcul par calcul, dépasse ce que `pdftotext
-layout` seul permet de faire sans risquer d'attribuer la réponse d'un
calcul à un autre — **exactement le risque que ce chantier doit éviter**.

En conséquence, le champ `answer` (réponse brute) de `Exercise` reste
`null` pour les 122 entrées importées : rien n'est deviné, rien n'est
mélangé. Les **corrigés détaillés** ("Corrigés", en texte linéaire, séparés
par calcul), eux, sont fiables à extraire et alimentent `correction` pour
110 des 122 calculs (12 n'ont qu'une réponse brute dans le cahier, sans
corrigé détaillé — situation conservée telle quelle, jamais un corrigé
inventé). Voir le rapport de sprint pour le détail exact.

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
- `tags` : `"Cahier de calcul"`, `"difficulté non vérifiée"`, et la
  sous-partie de la fiche si identifiée (ex. `"Formules d'addition"`).
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
trouvés dans la source — pas seulement une égalité de nombres.

Toute ambiguïté mathématique doit être tranchée en revenant à cette
transcription, et en cas de doute persistant, à la page correspondante du
PDF original — jamais devinée.
