# Tâches techniques entre agents

File unique : les **issues GitHub** de ce dépôt. Pas de copie dans Notion ni dans TaekdHub : Notion garde les décisions, TaekdHub garde le travail de prépa.

## Circuit

1. **Créer** une issue avec le modèle « Tâche technique pour un agent » (Hermes, ChatGPT, Taekd). Elle reçoit le label `agent:a-prendre`.
2. **Prendre** : Claude Code ne traite que les issues portant `agent:a-prendre`. Il passe le label à `agent:en-cours` et travaille sur une branche `claude/<sujet>`.
3. **Rendre** : une pull request qui référence l'issue (`Closes #n`) et colle dans sa description le résultat réel de `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test`, `pnpm build`, plus ce qui n'a PAS été vérifié. Label `agent:a-relire`.
4. **Valider** : Taekd relit, fusionne ou refuse. Rien ne se fusionne ni ne se déploie sans lui.

## Règles

- Une issue « Sensible » (secret, variable Vercel, donnée, déploiement) n'est jamais exécutée sans accord écrit de Taekd dans l'issue.
- Aucun secret, jeton ni donnée personnelle dans une issue, une PR ou un commit.
- Hermes ne fait que **créer** des issues et lire leur état ; il n'écrit jamais dans TaekdHub.
- Une issue sans critère de fin vérifiable est renvoyée à son auteur.

## Labels à créer (une fois, à la main dans GitHub)

`agent:a-prendre`, `agent:en-cours`, `agent:a-relire`.
