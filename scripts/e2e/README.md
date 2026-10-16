# Vérifications avec le vrai Anki (outils de développement)

Ces scripts ne font pas partie de `pnpm test` (ils demandent Python, Playwright et, pour le plus complet, Anki lui-même). Aucune dépendance n'est ajoutée au projet.

| Script | Ce qu'il vérifie | Contre quoi |
|---|---|---|
| `verify-apkg.py` | Les paquets `.apkg` : import, rendu des cartes par le moteur d'Anki, aucune fuite de la preuve sur le recto, réimport sans doublon, révision conservée, un seul type de note | **Vrai moteur d'Anki** (bibliothèque `anki`) |
| `ankiconnect-simulator.py` | Un serveur au protocole AnkiConnect adossé à une vraie collection. `SIM_IGNORE_DECK=1` reproduit le défaut de placement observé avec le vrai module | **Simulation** du protocole, vraie base |
| `run-real-anki.py` | Lance **Anki (interface Qt, hors écran) avec le vrai module AnkiConnect** sur 127.0.0.1:8765 | **Vrai Anki, vrai AnkiConnect** |
| `demonstrations-e2e.mjs up\|down` | Le parcours Chromium du panneau « Démonstrations » (une trentaine de vérifications) ; `down` : AnkiConnect éteint | Au choix : simulateur ou vrai Anki |
| `verify-apkg-via-ankiconnect.py` | Import des paquets par l'action `importPackage` du vrai module, révision répondue, réimport | **Vrai Anki, vrai AnkiConnect** |

Les notes Anki sont toujours retrouvées par **critères** (`Ref:th-demo-…`, étiquette, type de note), jamais par leur rang dans la collection.

## Lancer le parcours complet

```bash
# 1. Outils (une fois)
python3 -m venv /tmp/ankienv && /tmp/ankienv/bin/pip install anki genanki aqt
mkdir -p /tmp/ac/plugin && for f in __init__.py web.py util.py edit.py config.json; do
  curl -sf https://raw.githubusercontent.com/FooSoft/anki-connect/master/plugin/$f -o /tmp/ac/plugin/$f; done
sudo apt-get install -y libegl1 libgl1 libxkbcommon-x11-0 libnss3 libxcb-cursor0 libasound2t64   # Qt sans bureau
npm i -g playwright                                                                               # Chromium via PLAYWRIGHT_BROWSERS_PATH

# 2. Application
pnpm build && pnpm exec next start -p 3115 &

# 3. Anki indisponible
BASE_URL=http://localhost:3115 node scripts/e2e/demonstrations-e2e.mjs down

# 4. Vrai Anki + vrai AnkiConnect (autorise l'origine de TaekdHub, comme l'élève doit le faire)
QT_QPA_PLATFORM=offscreen /tmp/ankienv/bin/python scripts/e2e/run-real-anki.py /tmp/ac/plugin http://localhost:3115 &
BASE_URL=http://localhost:3115 node scripts/e2e/demonstrations-e2e.mjs up      # instance NEUVE : rejoue aussi le refus « type de note absent »
python3 scripts/e2e/verify-apkg-via-ankiconnect.py
/tmp/ankienv/bin/python scripts/e2e/verify-apkg.py
```

## Limites (à lire avant de dire « validé »)

- **Version d'Anki.** Les tests ont tourné contre Anki **26.9.3** (la bibliothèque disponible dans cet environnement) et le module AnkiConnect de la branche `master` du dépôt FooSoft/anki-connect, pas la version publiée sur AnkiWeb. Ton Anki est peut-être plus ancien : le comportement peut différer — c'est pourquoi TaekdHub **vérifie** après chaque ajout où sont les cartes (voir ci-dessous).
- **Hors écran.** L'interface d'Anki tourne sans affichage : rien ici ne montre à quoi ressemblent les cartes sur un écran. Le rendu HTML des cartes a été vérifié par le moteur d'Anki et dans Chromium (tailles d'iPhone et d'iPad), pas dans AnkiMobile.
- **Appareils.** AnkiMobile (iPad) et AnkiDroid ne sont pas testés. Voir `docs/DEMONSTRATIONS.md` pour valider le Scratchpad sur l'iPad.
- **Même machine.** `importPackage` lit un fichier local : ce test suppose Anki et le dépôt sur la même machine.

## Défauts découverts en testant le vrai module (et corrigés)

1. **Le paquet demandé est ignoré.** Avec ce AnkiConnect sur cet Anki, `addNotes` ignore `deckName` : les notes tombent dans « Default ». Conséquences : cartes hors du paquet du chapitre (le pont Anki ne les associe plus), et la détection de doublons « dans le paquet » ne voit rien — un renvoi recréait la carte. Le simulateur, qui respectait `deckName`, masquait le problème. Correction : `ensureDeck` (lib/anki-export.ts) vérifie, après chaque ajout, où sont les cartes des notes créées et les déplace (`changeDeck`) ; un échec est rapporté (« à ranger à la main »), pas caché.
2. **Deux types de note.** Un type créé par AnkiConnect (`createModel`) a un identifiant aléatoire ; le paquet `.apkg` apporte le sien : importer le paquet créait un second type « … Démonstration+ ». Correction : TaekdHub ne crée plus le type de note ; s'il manque, il demande d'importer le paquet d'abord (`DemoNoteTypeMissingError`).
3. **Un de mes tests validait trop tôt.** Un message d'un ajout précédent contenait déjà « déjà dans Anki » : le test comptait les notes avant la réponse du second clic. Le message est maintenant distinct et le comptage se fait après la réponse.
