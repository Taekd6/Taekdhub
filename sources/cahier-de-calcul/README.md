# Cahier de calcul — source brute

Transcription texte du PDF *Cahier de calcul* (pratique et entraînement),
coordonné par Colas Bardavid, fournie par l'utilisateur dans la conversation
sous forme d'archive `cahier-de-calcul-source-complet.zip`.

**Ce dossier contient la source brute.** L'import structuré vit dans
`datasets/cahier-de-calcul-professeur.json` (122 exercices, format import
TaekdHub habituel — voir plus bas). Depuis la Phase 3 (ci-dessous), il est
amorcé automatiquement dans l'application au même titre que la banque
principale (`lib/seed.ts#loadCahierCalculSeed`, déclenché une fois par
`hooks/use-prepahub-data.ts#maybeSeedCahierCalcul`) — aucune interface
dédiée (pas de mode "15 minutes", pas de navigation propre au Cahier de
calcul), les 122 calculs vivent comme des exercices natifs de la banque,
via l'infrastructure Exercices/Focus déjà existante.

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
la lecture visuelle directe plutôt qu'à un nouveau parsing du texte.

## Reconstruction LaTeX et intégration (Phase 3)

**Problème** : même correctement rattachés à leur calcul (Phase 1), `statement`
et `correction` restaient du texte brut issu de `pdftotext -layout` — dès
qu'une fraction, une matrice, une somme ou une intégrale s'étalait sur
plusieurs lignes dans la mise en page du PDF (très fréquent dans un cahier
de calcul), le texte extrait mélangeait numérateurs/dénominateurs/exposants
dans le désordre, illisible une fois affiché tel quel dans l'app (`RichMath`
n'a alors aucun délimiteur `$…$`/`$$…$$` à reconnaître). Contrairement à ce
qu'indiquait une note antérieure de ce document, les corrigés détaillés
n'étaient PAS épargnés par ce problème (une fraction affichée sur plusieurs
lignes dans un corrigé subit exactement le même mélange qu'un énoncé).

**Méthode** : les champs `statement`, `correction` et `answer` des 122
calculs ont été intégralement reconstruits — jamais à partir du texte cassé
existant, toujours en relisant la page image correspondante du PDF (même
source visuelle que la Phase 2 : pages d'énoncé, pages "Réponses", pages
"Corrigés"). Le texte normal (consignes, "Simplifier :", numérotation
a)/b)/c)…) reste du texte normal ; chaque expression mathématique devient du
LaTeX (`$…$` inline, `$$…$$` en bloc pour ce qui était visuellement centré/
seul sur sa ligne — matrices `\begin{pmatrix}`, systèmes `\begin{cases}`,
intégrales, sommes/produits, etc.), avec les mêmes conventions que le reste
de la banque (`datasets/exercices-banque-complete.json` — `\frac`, `\sqrt`,
intervalles `]a,b[` littéraux, `\mathbb{}`, `\vec{}`…). Aucune valeur,
signe, borne ou exposant n'a été modifié par rapport à ce que montre
l'image ; une coquille du PDF source lui-même (il y en a — ex. un indice
erroné dans un corrigé, une réponse encadrée qui contredit son propre
corrigé détaillé) est transcrite fidèlement, jamais "corrigée" de son propre
chef. Le champ `correction` reste `null` là où le cahier ne fournit aucun
corrigé rédigé pour un item (11/122 désormais, contre 12/122 avant cette
phase — un corrigé de la Fiche 7 avait été manqué par le découpage
automatique de la Phase 1 et a été récupéré ici).

**Vérification** : `pnpm run verify:cahier-calcul` vérifie que `statement`/
`correction`/`answer` ne contiennent aucun délimiteur `$` ni accolade `{}`
non équilibrés, et aucun artefact connu de l'ancienne extraction (glyphe de
`\mapsto` mal décodé, pointillés de case-réponse recopiés, caractères de la
zone privée Unicode des polices du PDF). Un échantillon représentatif
(fractions, matrices multiples, systèmes, intégrales à changement de
variable, sommes/produits, équations différentielles) a en plus été
vérifié visuellement dans l'application — desktop et mobile 390px, fiche
normale et mode Focus, réponse et correction dépliées — sans texte/LaTeX
cassé ni débordement de page.

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
- `statement` : énoncé complet, texte normal + LaTeX (`$…$`/`$$…$$`, voir
  Phase 3 ci-dessous) pour toute expression mathématique — rendu par
  `RichMath`/KaTeX comme le reste de la banque, **aucune valeur, signe,
  exposant ou borne modifié** par rapport au PDF source.
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
- `answer` : réponse brute en LaTeX, lue sur la grille "Réponses" de la
  fiche ; `null` quand le cahier n'en imprime pas une pour ce calcul précis
  (1/122 — voir section précédente), jamais une valeur devinée ou recopiée
  d'un autre calcul.
- `note` : provenance exacte (fiche, calcul, sous-partie, prérequis de la
  fiche en prose — jamais forcés dans le champ `prerequisites`, qui attend
  des étiquettes courtes, pas des phrases).
- `correction` : corrigé détaillé en LaTeX, quand le cahier en fournit un
  (111/122 — voir Phase 3).
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
