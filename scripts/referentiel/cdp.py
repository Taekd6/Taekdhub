#!/usr/bin/env python3
"""Lecture de documents publics sur cahier-de-prepa.fr (cours mis en ligne par leurs auteurs).

  python3 scripts/referentiel/cdp.py sections <site>                  # matières d'un site (ex. mp-ism)
  python3 scripts/referentiel/cdp.py ls <site> <section|rep=N> [prof]  # dossiers et documents (id téléchargeable)
  python3 scripts/referentiel/cdp.py get <site> <id> <nom>            # télécharge dans referentiel/_cache/<site>/<nom>.pdf + .txt

Les PDF restent dans referentiel/_cache/ (ignoré par git) : consultation seulement, aucune republication.
"""
import hashlib, html, os, re, subprocess, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BASE = "https://cahier-de-prepa.fr"


def fetch(url):
    return subprocess.run(["curl", "-sS", "-m", "40", "-L", url], capture_output=True).stdout


def parse(t):
    reps, docs = [], []
    for m in re.finditer(r'<p class="(rep|doc)">.*?</p>', t, re.S):
        s = m.group(0)
        n = re.sub(r"^\(.*?\)\s*", "", re.sub(r"\s+", " ", html.unescape(re.sub("<[^>]+>", " ", s))).strip())
        if m.group(1) == "rep":
            r = re.search(r"rep=(\d+)", s)
            if r:
                reps.append((r.group(1), n))
        else:
            i = re.search(r"download\?id=(\d+)", s)
            if i:
                docs.append((i.group(1), n))
    return reps, docs


def ls(site, where, depth=0, path=""):
    q = where if where.startswith("rep=") else where
    reps, docs = parse(fetch(f"{BASE}/{site}/docs?{q}").decode("utf-8", "ignore"))
    for i, n in docs:
        print(f"doc {i}\t{path}{n}")
    for r, n in reps:
        print(f"rep rep={r}\t{path}{n}/")
        if depth > 0:
            ls(site, f"rep={r}", depth - 1, f"{path}{n}/")


def get(site, ident, name):
    d = os.path.join(ROOT, "referentiel", "_cache", site)
    os.makedirs(d, exist_ok=True)
    pdf = os.path.join(d, name + ".pdf")
    open(pdf, "wb").write(fetch(f"{BASE}/{site}/download?id={ident}"))
    txt = pdf[:-4] + ".txt"
    subprocess.run(["pdftotext", "-layout", pdf, txt])
    h = hashlib.sha256(open(pdf, "rb").read()).hexdigest()[:16]
    pages = re.search(r"Pages:\s+(\d+)", subprocess.run(["pdfinfo", pdf], capture_output=True, text=True).stdout)
    print(f"{pdf}\nsha256_16={h} pages={pages.group(1) if pages else '?'} texte={os.path.getsize(txt)} octets")


if __name__ == "__main__":
    a = sys.argv[1:]
    if a[0] == "sections":
        print("\n".join(sorted(set(re.findall(r'href="docs\?([a-zA-Z_0-9]+)"', fetch(f"{BASE}/{a[1]}/docs").decode("utf-8", "ignore"))))))
    elif a[0] == "ls":
        ls(a[1], a[2], int(a[3]) if len(a) > 3 else 0)
    elif a[0] == "get":
        get(a[1], a[2], a[3])
