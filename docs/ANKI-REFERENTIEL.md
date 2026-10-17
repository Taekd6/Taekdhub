# Anki et référentiel de cours : index et état des lieux

Point d'entrée unique. Il remplace la lecture croisée des rapports successifs et signale ce qui est périmé.
Dernière consolidation : voir `git log -- docs/ANKI-REFERENTIEL.md`.

## 1. Sources réellement accessibles (état vérifié)

| Ressource | Accessible ? | Utilisée pour |
|---|---|---|
| `data/course-cards.json` (117 cartes de cours maths, 13 chapitres de spé), `data/demonstrations*.json` (8 démonstrations) | oui, dans le dépôt | `AUDIT-ANKI-MATHS.md` |
| Export JSONL de ta collection **sans anglais** (2 162 cartes ; Maths MP 1 309, Physique 757, Chimie 96, Informatique 0) | oui, téléversé (hors dépôt, jamais committé) | `AUDIT-COLLECTION-ANKI.md` |
| Sauvegarde `.colpkg` d'origine | **non** | : |
| PDF de cours, programme officiel, manuels | **non** | : |
| Accès réseau (sites de CPGE, éduscol, Wikipédia…) | **non** (politique réseau : 403) | : |

Conséquences : aucune carte n'est **confirmée par une source** ; tout ce qui est « vérifié » l'est par raisonnement (voir les trois niveaux de
validation dans `referentiel/README.md`). Aucune conformité au programme ou à ton cours n'est affirmée.
L'anglais est hors périmètre : le fichier JSONL ne contient aucun paquet d'anglais (vérifié sur les noms de paquets uniquement).

## 2. Les documents, leur statut

| Document | Contenu | Statut |
|---|---|---|
| `docs/AUDIT-ANKI-MATHS.md` | audit des 117 cartes + 8 démonstrations **livrées par TaekdHub** | **Valable** pour ces cartes. Son §0 (« ta collection n'est pas accessible ») est **périmé** : voir `AUDIT-COLLECTION-ANKI.md`. |
| `docs/AUDIT-COLLECTION-ANKI.md` | audit de **ta** collection (export sans anglais) : inventaire, erreurs vérifiées, couverture, forme des cartes | **Valable** (≈ 200 cartes lues une à une, le reste par mesures automatiques). |
| `docs/ANKI-PILOTE-SERIES-NUMERIQUES.md` | pilote v1, 46 cartes | **Remplacé** par la v2 (conservé pour mémoire). |
| `referentiel/` | méthode, registre des sources, cartes par chapitre | **Référence vivante.** |
| `referentiel/maths/series-numeriques/` | validation + cartes v2 (61) | **Fait**, vérifié mathématiquement, aucune source consultée. |
| `referentiel/maths/fondements-probabilites/` | validation + cartes (49) | **Première version**, vérifié mathématiquement, aucune source consultée, 3 exigibilités à confirmer. |

## 3. Contradictions relevées et résolues
- **« Ta collection n'est pas accessible »** (`AUDIT-ANKI-MATHS.md`) contre un audit de ta collection (`AUDIT-COLLECTION-ANKI.md`) : l'export JSONL a été fourni entre les deux ; le premier rapport porte sur les cartes du dépôt, le second sur ta collection.
- **Nombre de cartes de séries numériques** : 31 + 24 (première version du rapport de collection) corrigé en **25 cartes de cours + 21 démonstrations** après recomptage.
- **Pilote v1 (46 cartes) contre v2 (61)** : la v2 corrige P1 à P5, scinde des cartes à plusieurs faits et réintègre les faits perdus ; la v1 n'était pas un sur-ensemble des 25 cartes d'origine.

## 4. Règles qui s'appliquent à tout le chantier
1. Anglais : jamais lu, compté, exporté, modifié (un garde-fou automatique refuse tout fichier qui en porte le nom : `lib/referentiel-cartes.test.ts`).
2. Aucune modification de ta collection Anki personnelle ; aucun import automatique ; les identifiants des cartes existantes ne changent pas.
3. Trois niveaux de validation par carte : vérifié mathématiquement / confirmé par une source / exigibilité à confirmer.
4. Une carte = une connaissance. Pas de recto qui n'est qu'un nom de théorème.
5. Pas de déploiement, pas de fusion dans `main`.
