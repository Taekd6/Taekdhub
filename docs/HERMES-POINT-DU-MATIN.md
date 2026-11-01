# Hermes — « Point du matin » (première et seule tâche)

Objectif : te donner chaque matin, sans ouvrir l'application, les 3 choses à faire aujourd'hui et ce qui menace d'être en retard. **Lecture seule** : Hermes ne peut rien écrire dans TaekdHub (la route `/api/mcp-hermes` n'a que deux outils de lecture).

## Prérequis vérifiés le 2026-11-01
- Hermes (application Windows, v2026.7082) lit TaekdHub : `get_today` et `list_echeances` répondent en production avec `MCP_HERMES_TOKEN`.
- Le serveur MCP de Hermes (`taekdhub`) est déclaré dans `%LOCALAPPDATA%\hermes\config.yaml` ; le jeton vient de `%LOCALAPPDATA%\hermes\.env`. Ne jamais coller de jeton dans un prompt, une issue ou un dépôt.
- Aucune tâche planifiée n'a encore jamais été exécutée par Hermes : celle-ci est la première.

## Consigne à donner à Hermes (à coller dans une tâche planifiée, tous les jours à 7 h 15)

```
Tu es mon assistant de prépa MP. Appelle l'outil `get_today` de TaekdHub puis `list_echeances` avec jours=7.
Réponds en moins de 120 mots, en français :
1. Les 3 choses à faire aujourd'hui, dans l'ordre (matière, chapitre, durée).
2. Ce qui est en retard ou à rendre dans les 48 h.
3. Une ligne sur la fraîcheur des données : si `meta.fraicheur.consigne` n'est pas nulle, applique-la et dis-le en premier.
Règles : lecture seule, aucune écriture, ne demande ni ne répète aucun jeton, n'invente rien : si un outil échoue, dis « TaekdHub injoignable » et arrête-toi.
```

## Critères de réussite (à mesurer deux semaines)
- Le message arrive tous les jours avant 7 h 30.
- Il tient en moins d'une minute de lecture et correspond à ce que montre l'application.
- Au moins une fois sur deux, il t'évite d'ouvrir l'application ou de replanifier à la main. Sinon : on arrête la tâche, elle ne réduit pas ta charge.

## Coût
Aucun outil payant n'est ajouté. L'inférence passe par le fournisseur déjà configuré dans Hermes (Nous Research) : vérifie son quota avant d'activer la tâche.
