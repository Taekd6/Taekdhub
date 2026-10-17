# Référentiel de cours (MP) : méthode, organisation, règles

Objectif : un référentiel scientifique **traçable** par chapitre, construit en croisant des sources indépendantes, puis transformé en
cartes Anki de qualité. Il ne prétend jamais reproduire le cours de ton professeur.

## Où ça vit dans le dépôt (audit de l'existant)

| Dossier existant | Rôle | Pourquoi le référentiel n'y est pas |
|---|---|---|
| `data/` | JSON **lus par l'application** (`course-cards.json`, `demonstrations.json`) | Le référentiel n'est pas consommé par l'app ; y mêler des sources changerait la surface de test et de build. |
| `docs/` | Rapports et modes d'emploi, à plat (audits, roadmap, copilote) | Un référentiel par chapitre avec sources, matrices et cartes y serait noyé. |
| `lib/`, `scripts/` | Code TypeScript, générateurs de paquets `.apkg` | Pas de contenu pédagogique ici. |
| `public/anki/` | Paquets générés | Sortie, jamais source. |

**Choix : un dossier racine `referentiel/`**, séparé du code et des données de l'app. Les cartes validées pourront ensuite être
**converties** vers `data/` par un script, sans que le référentiel dépende de l'app.

```
referentiel/
  README.md                      ce fichier (méthode, vocabulaire, règles)
  sources.json                   registre unique des sources (id, type, URL, statut d'accès, droits)
  <matiere>/<chapitre>/
    validation-*.md              rapport de validation du chapitre (avant toute généralisation)
    matrice.md                   comparaison des sources par notion         (à créer quand les sources sont lues)
    synthese.md                  cours de référence rédigé en propres termes (idem)
    cartes.jsonl                 cartes proposées, une ligne par carte, liées aux notions (idem)
  _cache/                        copies locales temporaires de PDF : ignorées par Git, JAMAIS publiées
```

## Règles

1. **Aucune copie de document protégé dans le dépôt** (dépôt public). On garde l'URL, le titre, la section, la page ; `_cache/` est dans `.gitignore`.
2. **Un résultat n'est « confirmé » que par des sources lues.** Une source seulement repérée par une recherche a le statut `identifiée, non lue` et ne compte pour rien.
3. **Pas de vote à la majorité** : en cas de divergence, on compare hypothèses et démonstrations.
4. **Rédaction originale** : la synthèse est écrite dans nos propres termes ; pas d'extraits juxtaposés.
5. **Exigibilité** : une notion n'est « au programme » que si le programme officiel lu le dit ; sinon `exigibilité non établie` ou `hors programme (complément)`.
6. **Aucune conformité au cours du professeur n'est affirmée.**
7. **Anglais exclu.** Aucune carte d'anglais n'est lue, analysée ni modifiée.
8. Rien n'est importé dans Anki ; aucun identifiant de carte n'est modifié.

## Vocabulaire des statuts

| Niveau de validation | Sens |
|---|---|
| `vérifié mathématiquement` | résultat contrôlé par raisonnement (démonstration, contre-exemple, calcul) ; **ne dit rien** de la présence dans un cours ou un programme |
| `confirmé par une source` | résultat vérifié dans un document **effectivement consulté**, avec référence précise (titre, section, page, URL) ; jamais utilisé sans lecture réelle |
| `exigibilité à confirmer` | présence au programme ou caractère exigible non établi |

| Comparaison entre sources (quand elles auront été lues) | Sens |
|---|---|
| `confirmé (n sources)` | même énoncé, mêmes hypothèses dans n ≥ 2 sources lues |
| `source unique` | présent dans une seule source lue |
| `notation / formulation` | même résultat, écriture différente |
| `divergence réelle` | énoncés ou hypothèses mathématiquement différents (à trancher par la démonstration) |

| Statut d'une source | Sens |
|---|---|
| `lue` | consultée en entier ou en partie ; sections précisées |
| `identifiée, non lue` | trouvée par recherche ; contenu non consulté |
| `inaccessible` | l'environnement n'a pas pu l'ouvrir (réseau, droits) |
| `non consultable` | ouvrage payant ; cité comme référence, jamais comme preuve |
