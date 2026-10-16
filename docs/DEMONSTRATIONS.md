# Démonstrations : Anki pour apprendre, restitution pour vérifier

> Ce que fait TaekdHub, ce qu'il ne fait pas, et comment valider le Scratchpad sur ton iPad.
> Le système : `data/demonstrations.json`, `lib/demo-cards.ts`, `lib/demonstrations.ts`, le panneau « Démonstrations » de la page Anki.

## La boucle

1. **Apprendre** la démonstration avec sa carte dans Anki. Anki décide du calendrier de révision ; TaekdHub n'y touche pas.
2. **Restituer sans aide**, au tableau, sur papier ou au Scratchpad.
3. **Comparer** ta preuve à la référence avec ChatGPT ou Claude (copie la consigne depuis le panneau).
4. **Coller** la réponse JSON de l'IA dans le panneau, **vérifier** l'aperçu, puis **enregistrer**. Rien n'est écrit avant ce clic.
5. TaekdHub conserve la restitution (même historique que les DS et exercices, origine « démonstration »).
6. L'IA lit les difficultés récurrentes (`get_demonstrations`) et propose une action adaptée :

| Observation | Action |
|---|---|
| Première hypothèse ou justification oubliée | Revoir la carte existante (ou l'ajouter si elle manque) |
| Étape manquante, ou aucune lacune précisée | Refaire la démonstration entière |
| Lacune de raisonnement, ou 3 échecs d'affilée | Demander une explication à l'IA |
| Même lacune dans 2 restitutions **et** carte dans Anki | Carte ciblée (aperçu puis validation) |

7. Une **réussite autonome** (sans aucune aide) postérieure ferme la difficulté : elle passe en « corrigée », avec la date de la preuve.

Ce que TaekdHub ne fait jamais : compter les révisions d'Anki comme des restitutions, déclarer une démonstration maîtrisée parce que la carte a été vue, créer une carte sans ton clic, modifier un intervalle de révision.

## Valider le Scratchpad sur l'iPad (à faire sur ton appareil)

Je n'ai **pas** pu vérifier l'affichage dans AnkiMobile : cette étape demande ton iPad.

**Fichier :** `public/anki/taekdhub-demonstration-ipad.apkg` (une seule démonstration : le théorème du rang). Il se télécharge depuis le panneau « Démonstrations » de la page Anki de TaekdHub (bouton « Paquet d'essai »).

1. **Importer.** Sur l'iPad, ouvre TaekdHub dans Safari, page Anki, touche « Paquet d'essai (1 démonstration) ». Quand Safari propose d'ouvrir le fichier, choisis **AnkiMobile** (ou « Enregistrer dans Fichiers », puis touche le fichier et choisis AnkiMobile). AnkiMobile annonce une importation de 1 note dans le paquet « TaekdHub::Mathématiques::Applications linéaires ».
2. **Étudier.** Ouvre ce paquet et lance l'étude. Tu vois le recto : nom, hypothèses, consigne « Sans support », grand cadre en pointillés.
3. **Ouvrir le Scratchpad.** Pendant l'étude, ouvre le menu des outils d'étude d'AnkiMobile et choisis **Scratchpad** (c'est le nom donné par le manuel d'AnkiMobile, rubrique « Study Tools » ; si le menu est présenté autrement sur ta version, cherche « Scratchpad »). Un volet d'écriture apparaît ; avec l'Apple Pencil, la pression est prise en compte.
4. **Écrire** la démonstration dans le Scratchpad, sans regarder le verso.
5. **Révéler le verso.** Touche pour afficher la réponse : énoncé, preuve étape par étape avec justifications, points critiques, source. Compare.
6. **Noter** dans Anki comme d'habitude.

**Ce qu'il faut me dire après l'essai :**
- le Scratchpad s'ouvre-t-il, et laisse-t-il assez de place par-dessus le cadre pointillé ?
- les symboles mathématiques s'affichent-ils bien (⊕, ∈, ℒ, ℂ, ‖·‖, exposants et indices) ?
- le verso est-il lisible sur l'iPad en portrait et en paysage ?
- le trait écrit au recto reste-t-il visible quand tu retournes la carte (cela n'est pas nécessaire au fonctionnement, juste utile à savoir) ?

**Si quelque chose ne va pas**, ne touche pas au paquet : dis-moi ce que tu vois. Le recto n'utilise aucun JavaScript, donc un défaut d'affichage vient du style de la carte, que je peux corriger sans toucher à tes notes.

Quand l'essai te convient, importe `taekdhub-demonstrations.apkg` (toutes les démonstrations) : les mêmes notes sont **mises à jour**, jamais dupliquées, et ton historique de révision est conservé.

## AnkiConnect : ce qui est vrai aujourd'hui

- **Local seulement.** AnkiConnect est un petit serveur que le module ouvre sur ton ordinateur (127.0.0.1:8765) : seul un TaekdHub ouvert dans le navigateur de la **même machine** peut l'interroger, après avoir autorisé son adresse dans la configuration d'AnkiConnect (`webCorsOriginList`). Ni le serveur de TaekdHub, ni une IA distante, ni l'iPad ne le peuvent. Les IA ne voient que les références stockées dans TaekdHub.
- **L'import du paquet d'abord.** C'est le paquet `.apkg` qui installe le type de note « TaekdHub — Démonstration », avec son identifiant stable. TaekdHub ne le crée plus par AnkiConnect : un type créé ainsi aurait un identifiant différent, et l'import du paquet en créerait un second (« … Démonstration+ »). Si le type manque, l'envoi s'arrête avec un message clair et ne crée rien.
- **Ce que l'envoi direct fait :** il retrouve les cartes déjà présentes par leur référence (`Ref`) et n'ajoute que celles qui manquent. Il ne modifie jamais une carte existante, ni sa planification. Après chaque ajout, il vérifie que les nouvelles cartes sont dans le paquet du chapitre et les y déplace sinon (Anki ne respecte pas toujours le paquet demandé : constaté avec le vrai module).
- **Testé avec le vrai Anki 26.9.3 et le module AnkiConnect de la branche `master`** (hors écran), pas avec ta version d'Anki ni la version publiée sur AnkiWeb. Détails et limites : `scripts/e2e/README.md`.
- **Règle d'or du type de note :** ne jamais renommer ni réordonner ses champs. Un champ ajouté plus tard demande une nouvelle version du type de note.

## Ajouter ou corriger une démonstration

1. Édite `data/demonstrations.json` (chaque démonstration : `id` stable et jamais renommé, chapitre du programme, hypothèses, énoncé, étapes avec justifications, points critiques, sources).
2. Régénère :
   ```
   node --experimental-strip-types scripts/export-demo-notes.mjs
   pip install genanki
   python3 scripts/build-demo-deck.py
   python3 scripts/build-demo-deck.py --only m1-theoreme-du-rang --out public/anki/taekdhub-demonstration-ipad.apkg
   ```
3. Un test (`lib/demonstrations.test.ts`) refuse le fichier généré s'il n'est plus à jour.
4. Vérification avec le vrai moteur d'Anki : `python3 scripts/e2e/verify-apkg.py` (voir `scripts/e2e/README.md`).

**Sources des énoncés.** Chaque démonstration cite une question de cours **présente dans le programme de TaekdHub** (`lib/programme-data.ts`), et le verso rappelle que la rédaction est une preuve classique à confronter à TON cours. Aucun énoncé n'est présenté comme le texte officiel de ton professeur.

## Ce qui est testé, et ce qui ne l'est pas

Voir `scripts/e2e/README.md` : le fichier `.apkg` et le dialogue avec Anki sont vérifiés avec le vrai moteur d'Anki ; l'affichage dans AnkiMobile, AnkiDroid et Anki de bureau ne l'est pas.
