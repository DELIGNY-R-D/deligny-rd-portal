#!/usr/bin/env python3
"""Liste les URL versionnees (?v=<empreinte>) reellement servies par le site.

Pourquoi un script a part : une URL ecrite dans un HTML est relative A CETTE
PAGE, pas a la racine. `simulation-3d/index.html` qui appelle
`simulation-3d.css` designe `/simulation-3d/simulation-3d.css`. La version
precedente de la verification prenait la chaine telle quelle et la collait
derriere le domaine : sept fichiers bien en ligne etaient annonces en 404, et
la publication s'arretait sur un faux manque. Meme faute, meme correctif que
`resout()` dans verifie-fortress.py.
"""
import os
import re
import subprocess

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Depuis le 29/08 les icones portent aussi une empreinte (voir cache-bust.py) :
# elles entrent donc dans la verification de contenu, au meme titre que le CSS.
MOTIF = re.compile(r'(?:src|href|data-src)="([^"]*\.(?:js|css|svg|png|ico)\?v=[0-9a-f]{8})"')

pages = subprocess.run(["git", "ls-files", "*.html"], cwd=RACINE,
                       capture_output=True, text=True, check=True).stdout.split()

vues = set()
for page in pages:
    dossier = os.path.dirname(page)
    for brut in MOTIF.findall(open(os.path.join(RACINE, page), encoding="utf-8").read()):
        if brut.startswith(("http://", "https://", "//")):
            continue
        chemin, _, requete = brut.partition("?")
        if chemin.startswith("/"):
            absolu = chemin.lstrip("/")
        else:
            absolu = os.path.normpath(os.path.join(dossier, chemin))
        if absolu.startswith(".."):
            continue
        vues.add(absolu + "?" + requete)

for u in sorted(vues):
    print(u)
