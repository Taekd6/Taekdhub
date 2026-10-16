#!/usr/bin/env python3
"""
Lance le VRAI Anki (interface Qt, hors écran) avec le VRAI module AnkiConnect
(https://github.com/FooSoft/anki-connect, code 2055492159), sur 127.0.0.1:8765.
À utiliser à la place de ankiconnect-simulator.py pour la phase « up » de
demonstrations-e2e.mjs.

    python3 -m venv /tmp/ankienv && /tmp/ankienv/bin/pip install aqt genanki
    mkdir /tmp/ac-src && curl -sL https://codeload.github.com/FooSoft/anki-connect/tar.gz/refs/heads/master | tar xz -C /tmp/ac-src --strip-components=1
    sudo apt-get install -y libegl1 libgl1 libxkbcommon-x11-0 libnss3 libxcb-cursor0 libasound2t64   # bibliothèques Qt, sur Linux sans bureau
    QT_QPA_PLATFORM=offscreen /tmp/ankienv/bin/python scripts/e2e/run-real-anki.py /tmp/ac-src/plugin http://localhost:3115

Arguments : le DOSSIER `plugin/` d'AnkiConnect (il a plusieurs fichiers), puis l'origine de TaekdHub à
autoriser (`webCorsOriginList`) — exactement ce que l'élève doit faire pour que
son navigateur puisse parler à Anki.
"""
import json, os, pathlib, shutil, sys, tempfile

plugin_dir, origin = pathlib.Path(sys.argv[1]), sys.argv[2]
base = pathlib.Path(tempfile.mkdtemp(prefix="anki-real-"))
addon = base / "addons21" / "2055492159"
addon.mkdir(parents=True)
shutil.copytree(plugin_dir, addon, dirs_exist_ok=True)
(addon / "config.json").write_text(json.dumps({"apiKey": None, "apiLogPath": None, "webBindAddress": "127.0.0.1", "webBindPort": 8765, "webCorsOriginList": [origin], "ignoreOriginList": []}))

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
os.environ.setdefault("QTWEBENGINE_CHROMIUM_FLAGS", "--no-sandbox --disable-gpu --disable-software-rasterizer")
os.environ["ANKI_BASE"] = str(base)

from aqt.profiles import ProfileManager  # noqa: E402

# Profil prêt, langue choisie : aucune boîte de dialogue ne bloque le lancement hors écran.
ProfileManager.get_created_base_folder(str(base))
pm = ProfileManager(pathlib.Path(base))
pm.setupMeta()
pm.setLang("en_US")
pm.create("Test")

import aqt  # noqa: E402

sys.argv = ["anki", "-b", str(base), "-p", "Test", "-l", "en"]
print(f"Anki réel, base {base}, AnkiConnect autorisé pour {origin}", flush=True)
aqt.run()
