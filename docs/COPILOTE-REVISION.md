# Le copilote de révision : ce que l'IA voit, et ce qu'elle ne voit pas

> Tu enregistres dans TaekdHub (échéances et programmes, débriefs, restitutions). L'IA lit, par le connecteur MCP, ce qui est utile à ta question. Aucun outil ci-dessous n'écrit quoi que ce soit.

## Ce que tu saisis, et où

| Quoi | Où dans TaekdHub | Ce que l'IA en tire |
|---|---|---|
| Une khôlle, un DS, un concours blanc daté | Écran **Échéances** (ou `add_echeance` depuis Claude) | l'échéance, sa matière, sa date |
| **Son programme** : les chapitres concernés | Bouton **Programme** de la ligne (ouvert aussi aux khôlles depuis cette mission) | les chapitres, rapprochés du programme officiel par leur titre |
| Un DS corrigé | **Débrief** → « Importer un débrief IA » | les erreurs par chapitre, leur cause et sa fiabilité |
| Une restitution de démonstration | **Anki** → « Démonstrations » → « Enregistrer une restitution » | l'état observé, les lacunes, les actions |
| Les cartes Anki | **Anki** (relevé depuis l'ordinateur) | des chiffres par paquet |

## Questions possibles, et l'outil qui répond

| Tu demandes | L'IA appelle |
|---|---|
| « Que dois-je réviser pour ma prochaine khôlle ? » | `get_contexte_revision` avec `type: colle` |
| « Quelles démonstrations restituer avant vendredi ? » | `get_contexte_revision` avec `avant: <date de vendredi>` |
| « Que travailler ce week-end pour mon DS de maths ? » | `get_contexte_revision` avec `type: DS`, `matiere: maths` |
| « J'ai une heure : quelle est la meilleure action ? » | `get_contexte_revision` avec `minutes: 60` |
| « Quelles erreurs d'anciens DS risquent de me repénaliser ? » | `get_contexte_revision` (chapitres du programme), `get_debriefs` (détail des DS) |
| « Quelles cartes Anki correspondent à mes lacunes ? » | `get_contexte_revision` (champ `anki` par chapitre), `get_demonstrations` |

L'IA reçoit le contexte **à la demande** et filtré : pas tout l'historique.

## Les règles que l'outil applique

- **Programme inconnu = dit.** Une échéance sans chapitres rattachés est signalée dans `donnees_manquantes` : aucun plan n'en sort, et rien n'est déduit de la matière seule. Les erreurs de la matière sont montrées à part, « hors programme », sans recommandation.
- **Une démonstration n'entre dans une épreuve que par son chapitre.** Même matière ne suffit pas.
- **Le programme de colle de la semaine** (écran Khôlle) n'a pas de date : il est donné à part et ne se rattache pas à une khôlle précise sans ta confirmation.
- **Chaque priorité cite ses faits** (échéance, restitution observée, difficulté récurrente, souvenir attendu, cartes dues) et ce qui la vérifierait. Pas de score.
- **Ordre**, pour une khôlle : restitution ratée > difficulté récurrente > démonstration à faire > mémoire > cartes dues > signal à confirmer. Pour un DS : difficulté récurrente d'abord. Puis l'échéance la plus proche.
- **Corrigé = réussite autonome postérieure.** Une difficulté fermée par une réussite sans aide n'est plus recommandée comme active.
- **Les révisions Anki ne sont pas des restitutions.** Revoir des cartes ne prouve pas qu'une démonstration est sue.
- **Aucune carte n'est créée sans ta validation.**

## Ce que l'IA ne voit pas

- **Anki, carte par carte** : TaekdHub ne connaît que des chiffres par paquet (cartes dues, révisées, ratées sur 30 jours) d'un relevé fait depuis l'ordinateur, et seulement pour les paquets reliés à un chapitre. Il ne voit ni les cartes une à une, ni leur planification. Sans relevé : « inconnu ».
- **Les chapitres écrits en texte libre** qui ne sont pas dans Mémoire : signalés, non analysés.
- **Next Move** (aligné, pas identique) : il lit les mêmes faits (`computeRevision`, `lib/revision-context.ts`) et ne garde que ceux qu'il sait exécuter — restitution d'une démonstration déjà observée (ratée, réussie avec aide, à réactiver), rappel ou exercice ciblé pour une difficulté **récurrente** d'un chapitre au programme d'une khôlle, d'un DS ou d'un concours blanc à ≤ 7 jours. Le barème et les règles existants restent seuls juges de l'ordre ; les faits n'ajoutent qu'un terme (« Au programme de la khôlle … ») à l'action déjà proposée, ou créent l'action manquante. Divergences voulues : le contexte propose aussi la création/révision d'une carte Anki, une explication demandée à une IA, les signaux isolés et une démonstration jamais travaillée (sa carte d'abord) — Next Move ne les propose pas ; il propose aussi, grâce à son propre barème, des blocs de rattrapage hebdomadaires que le contexte ignore. Horizon : 7 jours pour Next Move, 21 par défaut pour le contexte. Programme inconnu : aucune recommandation par chapitre, seulement une ligne d'information sur l'échéance.

## Ce qui n'est possible que si le connecteur est branché

Une IA ne peut lire ces données que si elle a le **connecteur MCP de TaekdHub** (URL `/api/mcp/<secret>`, voir le README) et si tu es connecté à ton compte dans l'application (les données viennent des collections synchronisées). ChatGPT sans ce connecteur ne voit rien : il faut lui coller la sortie de l'outil.

## Valider sans toucher à tes vraies données

Les tests de l'outil utilisent des données identifiables `[TEST]` (`lib/revision-context.test.ts`) et des données écrites par la vraie interface (`lib/__fixtures__/ui-capture.json`, produites par `scripts/e2e/capture-ui-data.mjs`).
