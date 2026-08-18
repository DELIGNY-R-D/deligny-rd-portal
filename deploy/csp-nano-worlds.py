#!/usr/bin/env python3
"""Pose la CSP de nano-worlds/index.html et la maintient a jour (idempotent,
comme les autres scripts de deploy/ : le hook pre-commit peut le relancer
sans effet si rien n'a change).

Pas d'empreintes sha256 ici, contrairement a csp-studio.py. Verifie en reel
(18/08) : la CSP spec IGNORE totalement 'unsafe-inline' des qu'une empreinte
est presente dans la meme directive -- or ce moteur cree aussi, a
l'execution, des <style> dont le contenu varie (HUD, effets) et des scripts
de module via blob: (es-module-shims) : aucun des deux n'est empreintable a
l'avance. 'unsafe-inline' seul (sans empreinte) est le seul reglage qui
laisse les DEUX fonctionner. Le panneau utilise deja des dizaines
d'attributs onclick="..." en script-src-attr 'unsafe-inline' -- meme niveau
de confiance pour le contenu de <script>/<style>, sur du code qui n'est pas
d'ici.

Three.js/cannon-es/rapier sont vendorises localement (vendor/), aucune
origine externe requise pour le moteur -- seul connect-src autorise l'API
OpenAI, pour le compagnon IA optionnel (BYOK, cle saisie par l'utilisateur
et gardee en localStorage, jamais dans le code), et l'hote du beacon
(mesure d'audience + fetch optionnel d'un profil IA entraine).

Usage : python3 deploy/csp-nano-worlds.py [--check]
  --check : ne modifie rien, sort en code 1 si la CSP est absente ou périmée.
"""
import os
import re
import sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = "nano-worlds/index.html"
OPENAI_ORIGIN = "https://api.openai.com"
# Meme hote que inject-beacon.py -- coherent avec son ajout a img-src.
BEACON_HOST = "https://atlas-studio.pro"

CSP = ("default-src 'none'; "
       "base-uri 'none'; "
       "frame-ancestors 'none'; "
       "form-action 'none'; "
       f"img-src 'self' data: {BEACON_HOST}; "
       "style-src-elem 'unsafe-inline'; "
       "style-src-attr 'unsafe-inline'; "
       "script-src-elem 'self' blob: 'unsafe-inline'; "
       "script-src-attr 'unsafe-inline'; "
       f"connect-src 'self' {OPENAI_ORIGIN} {BEACON_HOST}")

BALISE = re.compile(r'\s*<meta http-equiv="Content-Security-Policy"[^>]*>')
CHARSET = re.compile(r'<meta charset="utf-8">', re.I)


def applique(html: str) -> str:
    sans = BALISE.sub("", html)
    m = CHARSET.search(sans)
    if not m:
        raise SystemExit("balise <meta charset> introuvable dans " + PAGE)
    meta = '\n<meta http-equiv="Content-Security-Policy" content="%s">' % CSP
    return sans[:m.end()] + meta + sans[m.end():]


def main() -> int:
    check = "--check" in sys.argv
    chemin = os.path.join(RACINE, PAGE)
    if not os.path.exists(chemin):
        print("introuvable : " + PAGE)
        return 0
    avant = open(chemin, encoding="utf-8").read()
    apres = applique(avant)
    if apres == avant:
        if check:
            print("CSP à jour")
        return 0
    if check:
        print("CSP absente ou périmée : " + PAGE)
        return 1
    open(chemin, "w", encoding="utf-8").write(apres)
    print("CSP posée : " + PAGE)
    return 0


if __name__ == "__main__":
    sys.exit(main())
