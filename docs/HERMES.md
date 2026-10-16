# Hermes ↔ TaekdHub — accès en lecture seule

Fiche pratique pour brancher Hermes sur TaekdHub et vérifier la connexion. Aucun secret ici :
les valeurs restent dans Vercel et dans le `.env` d'Hermes.

## 1. URL

| Environnement | URL | Remarque |
|---|---|---|
| **Production** | `https://taekdhub.vercel.app/api/mcp-hermes` | à utiliser au quotidien |
| Preview d'une branche | `https://taekdhub-git-<branche>-taekd.vercel.app/api/mcp-hermes` | protégé par le SSO Vercel : exige en plus `x-vercel-protection-bypass` |

C'est un serveur MCP en HTTP (« streamable HTTP »), méthode `POST`. Il est **séparé** du connecteur
de Claude (`/api/mcp/<secret>`), qui garde son propre secret et ses outils d'écriture.

## 2. Authentification

- En-tête obligatoire : `Authorization: Bearer <MCP_HERMES_TOKEN>`.
- Le jeton n'est **jamais** dans l'URL (refusé s'il y est) ; pas de cookie, pas de paramètre.
- Fermé par défaut : sans variable `MCP_HERMES_TOKEN` sur le déploiement, ou avec une valeur de moins de
  32 caractères, **tout** est refusé. Comparaison à temps constant. Refus : `401 Unauthorized`, sans détail.
- Le jeton vit à deux endroits, qui doivent avoir **la même valeur** :
  - Vercel → projet `taekdhub` → Settings → Environment Variables → `MCP_HERMES_TOKEN` (Production) ;
  - `%LOCALAPPDATA%\hermes\.env` → `TAEKDHUB_MCP_TOKEN=…`.

**Récupérer la valeur.** `MCP_HERMES_TOKEN` est une variable « sensitive » : Vercel ne la réaffiche
jamais. La valeur est celle que tu as enregistrée en la créant (gestionnaire de mots de passe). Si tu
ne l'as plus, crée-en une nouvelle (étape 3.1) : on ne relit pas l'ancienne.

> Une variable Vercel ne s'applique qu'aux déploiements créés **après** elle. Après tout ajout ou
> changement de `MCP_HERMES_TOKEN`, il faut **redéployer** la production.

## 3. Configurer Hermes (à faire une fois)

1. **Jeton** (seulement si tu n'as plus la valeur de production) : génère-en un, dans un terminal :
   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Colle-le dans Vercel (`MCP_HERMES_TOKEN`, Production, type Sensitive) **et** dans le `.env` d'Hermes
   (`TAEKDHUB_MCP_TOKEN=…`). Ne le colle nulle part ailleurs (ni conversation, ni dépôt).
2. **Redéployer la production** : Vercel → Deployments → le dernier déploiement Production → ⋯ → Redeploy.
3. **Pointer Hermes vers la production**, dans `%LOCALAPPDATA%\hermes\config.yaml` :
   ```yaml
   mcp_servers:
     taekdhub:
       url: "https://taekdhub.vercel.app/api/mcp-hermes"
       headers:
         Authorization: "Bearer ${TAEKDHUB_MCP_TOKEN}"
   ```
   L'en-tête `x-vercel-protection-bypass` ne sert qu'aux Previews : retire-le pour la production.
4. Redémarre Hermes.

## 4. Outils

| Outil | Paramètres | Réponse |
|---|---|---|
| `get_today` | aucun | l'état du jour (voir 5) |
| `list_echeances` | `jours` (entier 0–366, facultatif) | échéances à faire, la plus proche d'abord |

Il n'y en a pas d'autre : aucun outil d'écriture n'est enregistré sur cette route.

## 5. Données accessibles

Uniquement des nombres, des dates, des valeurs de listes fermées et des chapitres du **programme
officiel** — construits par liste blanche (`lib/hermes-snapshot.ts`).

- `agenda_du_jour` : tâches retenues (matière, chapitre du programme, durée, priorité, niveau cognitif,
  plage suggérée, échéance), capacité planifiable, temps restant, tâches reportées (nature seulement).
- `prochain_mouvement` (genre, matière, minutes, identifiants de raisons), verrous de cours, point faible
  principal, à refaire sans aide, chapitres qui s'effacent, erreurs récentes (matière, type, jour),
  programme (chapitres vus, fragiles, jamais revus), annales en chiffres, cartes Anki dues.
- `echeances` : type, matière, date, jours et minutes restants, importance — **sans titre ni identifiant**.
- `meta.fraicheur` : date de dernière écriture par collection, `donnees_anciennes`, `seances_anciennes`,
  `echeances_synchronisees`, `consigne`. Si `consigne` n'est pas nulle, Hermes doit l'appliquer.

**Jamais transmis** : titres, notes, fiches, énoncés, descriptions d'erreurs, contenu de cartes Anki,
check-ins (sommeil, énergie, stress), séances, identifiants internes. Les données viennent du compte
Supabase : ce que l'appareil n'a pas encore synchronisé n'y est pas.

## 6. Sécurité

- Lecture seule garantie par le code (aucun `insert`/`update`/`delete`/`upsert` dans la route, vérifié par les tests).
- Données filtrées par `user_id` (le compte de `MCP_USER_ID`, sinon l'unique compte du projet ; deux comptes sans `MCP_USER_ID` ⇒ « lecture impossible », jamais les données d'un autre).
- Aucune journalisation du jeton, des en-têtes ni des paramètres. Une erreur Supabase n'est jamais relayée :
  la réponse est « Erreur : lecture impossible pour le moment. » (une lecture qui échoue est retentée une fois).
- La clé `SUPABASE_SECRET_KEY` reste côté serveur (variable non publique).

## 7. Test simple

Depuis le dossier du dépôt :

```
node scripts/hermes-check.mjs https://taekdhub.vercel.app/api/mcp-hermes %LOCALAPPDATA%\hermes\.env
```

Le script n'affiche jamais le jeton. Il vérifie : refus sans jeton, refus d'un jeton inventé, les deux outils
annoncés, puis `get_today` et `list_echeances` en JSON. « Tout est bon » = Hermes peut lire TaekdHub.
Dernier essai côté Hermes : lui demander « Qu'est-ce que je fais aujourd'hui d'après TaekdHub ? ».

## 8. Erreurs courantes

| Symptôme | Cause probable | Résolution |
|---|---|---|
| `401` avec ton jeton | valeur différente de celle de Vercel, **ou** production déployée avant la variable | aligner les deux valeurs, puis redéployer |
| `401` sans rien d'autre | en-tête absent, autre schéma que `Bearer`, jeton dans l'URL | utiliser `Authorization: Bearer …` |
| page de connexion Vercel / `401` sur un Preview | Preview protégé par le SSO | ajouter `x-vercel-protection-bypass`, ou utiliser la production |
| `404` | URL erronée | vérifier `/api/mcp-hermes` (sans `/` final ni paramètre) |
| « Erreur : lecture impossible pour le moment. » | Supabase injoignable deux fois de suite, ou variables `SUPABASE_URL`/`SUPABASE_SECRET_KEY` absentes du déploiement | réessayer ; sinon vérifier les variables et redéployer |
| « Aucune donnée synchronisée… » | aucun compte connecté dans TaekdHub | se connecter dans Réglages → Compte |
| `liste_concluante: false` | aucune échéance jamais synchronisée | une liste vide ne veut pas dire « aucune échéance » |

## 9. À la fin des essais

Révoquer ce qui ne sert plus : le jeton Preview de l'ancienne branche et le contournement Vercel
(Vercel → Settings → Deployment Protection), s'ils ne sont plus utilisés.
