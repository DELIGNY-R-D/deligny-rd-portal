#!/usr/bin/env python3
"""Colle un ?v=<empreinte> sur chaque <link>/<script> qui pointe vers un
fichier CSS ou JS local (jamais une URL externe).

Pourquoi ce script existe : Cloudflare cache chaque URL statique jusqu'a 4h
(cache-control max-age=14400), et chaque edge (datacenter) le fait de facon
independante. Un git push met a jour GitHub Pages instantanement, mais tant
qu'un edge Cloudflare donne n'a pas de raison de revalider, il continue de
servir l'ancienne version — parfois pendant des heures, de facon invisible et
differente selon la zone geographique du visiteur. Vecu le 13/08 : l'ancien
logo3d-frame (bordure/ombre, ere iframe) encore servi en prod alors que le
depot avait la version corrigee depuis longtemps, sans qu'aucune purge
manuelle n'ait ete faite.

En faisant dependre l'URL du contenu du fichier, toute modification change
la cle de cache : chaque edge Cloudflare la voit pour la premiere fois et va
la chercher a la source — aucun purge manuel necessaire, la staleness
devient impossible par construction. Meme logique que csp-studio.py et
inject-beacon.py : auto-reparable a chaque commit, quel que soit l'outil qui
a modifie la page ou l'asset.

Usage : python3 deploy/cache-bust.py [--check]
  --check : ne modifie rien, sort en code 1 si une reference est perimee.
"""
import hashlib
import os
import re
import subprocess
import sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

REF = re.compile(r'((?:href|src)=")([^"?]+\.(?:css|js))(?:\?v=[0-9a-f]{8})?(")')

# Un module ES ne se declare pas avec src= mais avec `import ... from './x.js'`.
# Ces URL echappaient donc au versionnage, avec la meme consequence : le
# 25/08, generative-design/shapes_cad.js et stl-exporter.js ont ete servis en
# 404 par Cloudflare (cf-cache-status HIT, age 157) parce qu'une requete faite
# pendant la propagation avait mis le 404 en cache, alors que le fichier
# existait bien a la source. Une URL versionnee n'a jamais ete vue par l'edge :
# le probleme ne peut plus se produire.
IMPORT = re.compile(r"""((?:from|import)\s+['"])(\.{1,2}/[^'"?]+\.js)(?:\?v=[0-9a-f]{8})?(['"])""")

# Les icones (favicon, apple-touch-icon) sont des assets comme les autres, et
# elles echappaient au versionnage : le 29/08, le passage du D orange a la
# couronne, puis l'arrondi des coins, seraient restes invisibles derriere le
# cache pour qui avait deja charge la version precedente. On ne versionne QUE
# les liens d'icone, pas toutes les images : un <img> de contenu n'a pas les
# memes enjeux et la reecriture en masse serait risquee.
ICONE = re.compile(r'(<link[^>]*rel="[^"]*icon[^"]*"[^>]*href=")'
                   r'([^"?:]+\.(?:svg|png|ico))(?:\?v=[0-9a-f]{8})?(")')


def pages() -> list:
    out = subprocess.run(["git", "ls-files", "*.html"], cwd=RACINE,
                          capture_output=True, text=True).stdout.split()
    # Les modules ES importent d'autres modules : un fichier .js qui n'est
    # reference par aucune page doit tout de meme voir SES imports versionnes.
    mods = subprocess.run(["git", "ls-files", "generative-design/*.js"], cwd=RACINE,
                          capture_output=True, text=True).stdout.split()

    # Les fixtures de deploy/tests/ portent des fautes VOLONTAIRES et des
    # empreintes calculees sur leur contenu EXACT : les modifier casserait
    # le test de non-regression du controle de publication.
    out = [p for p in out if not p.startswith("deploy/tests/")]
    return out + mods


def empreinte(chemin_fichier: str):
    try:
        data = open(chemin_fichier, "rb").read()
    except OSError:
        return None
    return hashlib.sha256(data).hexdigest()[:8]


def corrige(contenu: str, dossier_page: str) -> str:
    def remplace(m):
        pre, url, post = m.groups()
        if url.startswith(("http://", "https://", "//")):
            return m.group(0)
        chemin_local = os.path.normpath(os.path.join(dossier_page, url))
        h = empreinte(chemin_local)
        if not h:
            return m.group(0)
        return f"{pre}{url}?v={h}{post}"
    return ICONE.sub(remplace, IMPORT.sub(remplace, REF.sub(remplace, contenu)))


def main() -> int:
    check = "--check" in sys.argv
    perimees = []
    for rel in pages():
        chemin = os.path.join(RACINE, rel)
        try:
            avant = open(chemin, encoding="utf-8").read()
        except OSError:
            continue
        apres = corrige(avant, os.path.dirname(chemin))
        if apres == avant:
            continue
        perimees.append(rel)
        if not check:
            open(chemin, "w", encoding="utf-8").write(apres)
    if check:
        if perimees:
            print("Cache-bust perime : " + ", ".join(perimees))
            return 1
        print("Cache-bust a jour")
        return 0
    if perimees:
        print("Cache-bust recalcule sur %d page(s) : %s" % (len(perimees), ", ".join(perimees)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
