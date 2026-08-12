# Cahier de calcul — source brute

Transcription texte du PDF *Cahier de calcul* (pratique et entraînement),
coordonné par Colas Bardavid, fournie par l'utilisateur dans la conversation
sous forme d'archive `cahier-de-calcul-source-complet.zip`.

**Ce dossier contient uniquement la source brute.** Rien n'a encore été
importé dans la banque d'exercices de TaekdHub (`datasets/`) — c'est un
chantier séparé, volontairement pas commencé ici.

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

## Limite connue de l'extraction

Le cahier signale la difficulté de chaque calcul par des **pictogrammes
d'horloge** (1 à 4 horloges). Ce sont des glyphes graphiques, pas du texte :
`pdftotext` ne les capture pas. **Ils sont absents de cette transcription.**

Toute future extraction de la difficulté par calcul nécessitera une
inspection visuelle ciblée du PDF original (page par page), pas une
relecture de ce fichier texte.

## Fichiers

- `cahier-de-calcul-professeur-source.md` — transcription complète, un bloc
  `## PAGE NNN` par page, contenu brut entre balises ` ```text `.
- `cahier-de-calcul-professeur-manifest.json` — métadonnées de provenance.

Le zip original contenait aussi un dossier `chunks/` (le même contenu
re-découpé en 8 fichiers de ~90 Ko). Vérifié strictement identique par
concaténation (`diff` sans écart) — non conservé dans le dépôt pour éviter
une ambiguïté sur la source faisant foi : `cahier-de-calcul-professeur-source.md`
est l'unique référence.

## Utilisation prévue

Ce fichier sert de **source de vérité** pour un futur chantier d'import
structuré dans `datasets/` (au format `Exercise` de TaekdHub), avec
`source: "Cahier de calcul"`. Toute ambiguïté mathématique lors de cet import
doit être tranchée en revenant à cette transcription, et en cas de doute
persistant, à la page correspondante du PDF original — jamais devinée.
