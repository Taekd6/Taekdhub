# Connecter Hermes Agent à TaekdHub (lecture seule)

> État vérifié le 2026-10-18. Aucun secret n'est écrit dans ce fichier : les valeurs se génèrent et se saisissent chez toi.

## 1. Ce qui existe

TaekdHub a **deux** accès MCP distincts :

| | Connecteur de Claude | Accès Hermes |
|---|---|---|
| Route | `/api/mcp/<MCP_SECRET>` | `/api/mcp-hermes` |
| Authentification | secret **dans l'URL** | jeton **dans l'en-tête** `Authorization: Bearer <MCP_HERMES_TOKEN>` |
| Outils | 16 (lecture **et** écriture) | **2, en lecture seule** : `get_today`, `list_echeances` |
| Où est le code | branche de travail et `main` | **`main` seulement** (commit `2dcd552`) |

La route Hermes (`app/api/mcp-hermes/route.ts`, sur `main`) garantit la lecture seule **par construction** : les outils d'écriture n'y sont pas enregistrés (ils ne sont pas « filtrés » après coup). Elle est **fermée par défaut** : sans `MCP_HERMES_TOKEN`, ou avec une valeur de moins de 32 caractères, tout appel est refusé. Le jeton n'est jamais dans l'URL ni renvoyé, et rien de ce que l'élève a écrit (titres, notes, fiches) n'est transmis.

Vérifié dans le code de `main` : 93 tests Hermes passent (`lib/hermes-auth.test.ts`, `hermes-route.test.ts`, `hermes-route-http.test.ts`, `hermes-snapshot.test.ts`), dont, avec un jeton valide et par le protocole réel, le refus de `log_exercise`, `add_cards`, `review_cards`, `add_echeance`, `update_echeance`, `delete_echeance` et `get_progress`.

## 2. Pourquoi `hermes mcp test taekdhub` répond 401

L'URL configurée dans Hermes est une **prévisualisation Vercel** :
`https://taekdhub-git-claude-loving-maxwell-oqm045-taekd.vercel.app/api/mcp-hermes`.

Sa réponse 401 porte un cookie `_vercel_sso_nonce` : c'est la **protection de déploiement de Vercel** (connexion Vercel obligatoire sur les prévisualisations). La requête n'arrive jamais à l'application, donc **aucun jeton ne peut y fonctionner**. Il faut utiliser le domaine de production, où la route existe (réponse 401 avec `WWW-Authenticate: Bearer`, produite par la route elle-même) :

`https://taekdhub.vercel.app/api/mcp-hermes`

Même ainsi, le 401 persistera tant que `MCP_HERMES_TOKEN` n'est pas défini côté Vercel (voir §3).

## 3. Variables

| Variable | Où | Rôle |
|---|---|---|
| `MCP_HERMES_TOKEN` | **Vercel**, projet de `taekdhub.vercel.app`, environnement **Production** | le jeton que la route compare à l'en-tête. ≥ 32 caractères, aléatoire |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | Vercel (déjà utilisées par le connecteur de Claude) | lecture des données |
| `MCP_USER_ID` | Vercel (facultatif) | compte à lire ; indispensable s'il y a plusieurs comptes |
| `MCP_TIMEZONE` | Vercel (facultatif) | fuseau de l'élève (Europe/Paris par défaut) |
| `TAEKDHUB_HERMES_TOKEN` (nom au choix) | **ton PC**, environnement de Hermes | la même valeur que `MCP_HERMES_TOKEN`, pour l'en-tête |

Les variables Vercel ne s'appliquent qu'aux **nouveaux** déploiements : après avoir ajouté `MCP_HERMES_TOKEN`, il faut **redéployer** la production.

## 4. Procédure (Windows 11, PowerShell)

**a. Générer le jeton sans l'afficher** (fonctionne en Windows PowerShell 5.1 et en PowerShell 7) :

```powershell
$b = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
$token = -join ($b | ForEach-Object { $_.ToString('x2') })
[Environment]::SetEnvironmentVariable('TAEKDHUB_HERMES_TOKEN', $token, 'User')
$env:TAEKDHUB_HERMES_TOKEN = $token
Set-Clipboard $token    # pour le coller dans Vercel
```

**b. Vercel** : Project → Settings → Environment Variables → ajouter `MCP_HERMES_TOKEN` (coller le presse-papiers), cocher **Production** → Save → **Redeploy** de la dernière production. Puis vider le presse-papiers : `Set-Clipboard $null`.
Vérifier que le projet est bien celui qui porte le domaine `taekdhub.vercel.app` (il existe aussi un projet `taekdhub-vcrx`).

**c. Hermes** : modifier l'entrée `taekdhub` pour qu'elle pointe sur `https://taekdhub.vercel.app/api/mcp-hermes` et envoie l'en-tête `Authorization: Bearer <jeton>`, **sans écrire le jeton en clair dans le fichier de configuration** (le lire dans la variable d'environnement). Forme habituelle d'une entrée MCP HTTP, **à vérifier avec `hermes mcp add --help` et la documentation de ta version 0.22.2** (elle n'a pas pu être consultée depuis ce dépôt) :

```yaml
mcp_servers:
  taekdhub:
    url: "https://taekdhub.vercel.app/api/mcp-hermes"
    headers:
      Authorization: "Bearer ${TAEKDHUB_HERMES_TOKEN}"
```

Ouvrir un **nouveau** terminal (pour que Hermes voie la variable), puis `hermes mcp test taekdhub`. Résultat attendu : connexion réussie et **2 outils** : `get_today` et `list_echeances`.

**d. Test direct, sans Hermes** (le jeton n'est pas affiché) :

```powershell
'{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | Set-Content -Encoding ascii "$env:TEMP\req.json"
curl.exe -s -i -X POST -H "content-type: application/json" -H "accept: application/json, text/event-stream" -H "authorization: Bearer $env:TAEKDHUB_HERMES_TOKEN" --data-binary "@$env:TEMP\req.json" https://taekdhub.vercel.app/api/mcp-hermes
Remove-Item "$env:TEMP\req.json"
```

## 5. Lire la réponse

| Réponse | Sens |
|---|---|
| 200 et deux outils | tout fonctionne |
| 401 + `www-authenticate: Bearer` | la route est atteinte mais refuse : jeton absent, faux, ou **`MCP_HERMES_TOKEN` non défini / de moins de 32 caractères côté Vercel, ou production non redéployée** |
| 401 + cookie `_vercel_sso_nonce` (réponse JSON) | tu as atteint une **prévisualisation protégée** : mauvaise URL |
| 404 | ce déploiement n'a pas la route (déployé avant `2dcd552`) |
| réponse « Erreur : lecture impossible… » | la route est atteinte et le jeton accepté, mais Supabase ou `MCP_USER_ID` pose problème |

## 6. Sécurité

- Le jeton ne va **jamais** dans l'URL (les URL apparaissent dans les journaux Vercel). Ne le colle pas dans une conversation, un terminal partagé ou un fichier du dépôt.
- Rotation : générer une nouvelle valeur (§4a), la remplacer dans Vercel, redéployer ; l'ancienne cesse de fonctionner dès le déploiement.
- Hermes ne reçoit **aucun texte libre** : pas de titre d'échéance, pas de note, pas de fiche, pas d'erreur (voir `docs/CARNET.md` sur `main`).

## 7. Limites et suite

- La route Hermes de `main` n'expose que `get_today` et `list_echeances`. Les outils de lecture plus riches de la branche de travail (`get_contexte_revision`, `chercher_referentiel`, `get_recommandations`…) ne sont pas disponibles pour Hermes : les ajouter suppose de **les enregistrer explicitement dans la route Hermes**, avec leurs tests, après décision sur le texte libre qu'ils renvoient.
- La branche de travail est à 17 commits de retard sur `main` ; une fusion de `main` dans cette branche aurait **2 conflits** (`lib/storage.ts`, `components/home/day-agenda-card.tsx`). Rien n'a été fusionné.
- Le déploiement de production n'a pas pu être inspecté par l'API Vercel (accès refusé) : le commit réellement en production n'est pas confirmé, seulement la présence de la route.
