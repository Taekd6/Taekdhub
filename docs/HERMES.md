# Hermes ↔ TaekdHub — accès en lecture seule

Fiche pratique pour brancher Hermes sur TaekdHub et vérifier la connexion. Aucun secret ici :
les valeurs restent dans Vercel et dans le `.env` d'Hermes. État vérifié en production le 2026-11-01.

## 1. URL et authentification

- Production : `https://taekdhub.vercel.app/api/mcp-hermes` (serveur MCP en HTTP, méthode `POST`).
- Séparé du connecteur de Claude (`/api/mcp/<secret>`, qui a des outils d'écriture) : Hermes n'a **que** deux outils de lecture.
- En-tête obligatoire : `Authorization: Bearer <MCP_HERMES_TOKEN>`. Jamais dans l'URL, pas de cookie.
- **Fermé par défaut** : sans variable `MCP_HERMES_TOKEN` sur le déploiement, ou avec moins de 32 caractères, tout est refusé (`401`, sans détail). Comparaison à temps constant.
- **Un seul nom de variable : `MCP_HERMES_TOKEN`**, avec la même valeur à deux endroits :
  - Vercel → projet `taekdhub` → Settings → Environment Variables → `MCP_HERMES_TOKEN` (Production, type Sensitive) ;
  - `%LOCALAPPDATA%\hermes\.env` → `MCP_HERMES_TOKEN=…`.
- `TAEKDHUB_MCP_TOKEN` est l'**ancien** nom (jeton d'un Preview). Hermes ne le lit pas : ne pas s'en servir pour tester la production.
- `MCP_HERMES_TOKEN` est « sensitive » : Vercel ne le réaffiche jamais. Si la valeur est perdue, en créer une nouvelle, la mettre aux deux endroits, puis **redéployer** la production (une variable ne s'applique qu'aux déploiements créés après elle).

## 2. Configuration d'Hermes

Dans `%LOCALAPPDATA%\hermes\config.yaml` :

```yaml
mcp_servers:
  taekdhub:
    url: "https://taekdhub.vercel.app/api/mcp-hermes"
    headers:
      Authorization: "Bearer ${env:MCP_HERMES_TOKEN}"
```

L'en-tête `x-vercel-protection-bypass` ne sert qu'aux Previews (protégés par le SSO Vercel) : inutile en production, à retirer s'il y est encore. Redémarrer Hermes après toute modification.

## 3. Outils

| Outil | Paramètres | Réponse |
|---|---|---|
| `get_today` | aucun | l'état du jour (voir 4) |
| `list_echeances` | `jours` (entier 0–366, facultatif) | échéances à faire, la plus proche d'abord |

Il n'y en a pas d'autre : aucun outil d'écriture n'est enregistré sur cette route.

## 4. Données accessibles

Uniquement des nombres, des dates, des valeurs de listes fermées et des chapitres du **programme officiel**, construits par liste blanche (`lib/hermes-snapshot.ts`).

- `agenda_du_jour` : tâches retenues (matière, chapitre, durée, priorité, niveau cognitif, plage suggérée, échéance), capacité planifiable, temps restant, tâches reportées. `provisoire: true` = plan à présenter comme provisoire.
- `prochain_mouvement`, verrous de cours, point faible principal, à refaire sans aide, chapitres qui s'effacent, erreurs récentes (matière, type, jour), programme, annales en chiffres, cartes Anki dues.
- `echeances` : type, matière, date, jours et minutes restants, importance — **sans titre ni identifiant**.
- `meta.fraicheur` : dernière écriture par collection, `donnees_anciennes`, `seances_anciennes`, `echeances_synchronisees`, `consigne`. **Si `consigne` n'est pas nulle, Hermes doit l'appliquer** et le dire en premier.

**Jamais transmis** : titres, notes, fiches, énoncés, descriptions d'erreurs, contenu de cartes Anki, check-ins (sommeil, énergie, stress), séances, identifiants internes.

## 5. Sécurité

- Lecture seule garantie par le code (aucun `insert`/`update`/`delete`/`upsert` dans la route, vérifié par les tests).
- Données filtrées par `user_id` (`MCP_USER_ID`, sinon l'unique compte du projet ; plusieurs comptes sans `MCP_USER_ID` ⇒ « lecture impossible »).
- Aucune journalisation du jeton, des en-têtes ni des paramètres ; une erreur Supabase n'est jamais relayée (« Erreur : lecture impossible pour le moment. », avec une relecture).
- La clé `SUPABASE_SECRET_KEY` reste côté serveur.

## 6. Test simple

Depuis le dossier du dépôt, dans PowerShell :

```powershell
node scripts/hermes-check.mjs https://taekdhub.vercel.app/api/mcp-hermes "$env:LOCALAPPDATA\hermes\.env"
```

Le script lit `MCP_HERMES_TOKEN` (repli : `TAEKDHUB_MCP_TOKEN`) et n'affiche jamais le jeton. Il vérifie : refus sans jeton, refus d'un jeton inventé, les deux outils annoncés, puis `get_today` et `list_echeances`. « Tout est bon » = Hermes peut lire TaekdHub.

Si `liste concluante : false`, aucune échéance n'a jamais atteint le compte : une liste vide ne veut pas dire « aucune échéance ».

## 7. Erreurs courantes

| Symptôme | Cause probable | Résolution |
|---|---|---|
| `401` avec ton jeton | valeur différente de celle de Vercel, **ou** variable lue sous l'ancien nom `TAEKDHUB_MCP_TOKEN`, **ou** production déployée avant la variable | utiliser `MCP_HERMES_TOKEN`, aligner les deux valeurs, redéployer |
| `401` sans rien d'autre | en-tête absent, autre schéma que `Bearer`, jeton dans l'URL | `Authorization: Bearer …` |
| page de connexion Vercel / `401` sur un Preview | Preview protégé par le SSO | utiliser la production |
| `404` | URL erronée | `/api/mcp-hermes`, sans `/` final ni paramètre |
| « lecture impossible pour le moment » | Supabase injoignable deux fois, ou variables `SUPABASE_*` absentes du déploiement | réessayer ; sinon vérifier les variables et redéployer |
| « Aucune donnée synchronisée… » | aucun compte connecté dans TaekdHub | Réglages → Compte |

## 8. Tâche planifiée

La première (et seule) tâche prévue est décrite dans `docs/HERMES-POINT-DU-MATIN.md`.
