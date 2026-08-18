#!/usr/bin/env python3
"""Pose (et tient à jour) la CSP de nano-worlds/index.html.

Même besoin que csp-studio.py (le moteur est un <script> en ligne, une CSP
écrite à la main se périmerait en silence à la première modification), mais
une forme différente : ce jeu importe Three.js et cannon-es depuis un CDN via
importmap, donc script-src-elem doit autoriser ces origines EN PLUS des deux
empreintes (importmap + module). Les boutons du panneau utilisent des
attributs onclick="..." (des dizaines) : réécrire chacun en addEventListener
serait un chantier séparé sur du code qui n'est pas d'ici, donc
script-src-attr reste 'unsafe-inline', comme style-src-attr sur le Lamp
Studio.

Usage : python3 deploy/csp-nano-worlds.py [--check]
  --check : ne modifie rien, sort en code 1 si la CSP est absente ou périmée.
"""
import base64
import hashlib
import os
import re
import sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = "nano-worlds/index.html"
CDN_ORIGINS = "https://cdn.jsdelivr.net https://esm.sh"
# Meme hote que inject-beacon.py (mesure d'audience) -- baked ici directement
# (pas ajoute apres coup) pour que les deux scripts restent idempotents quel
# que soit l'ordre d'execution, comme csp-studio.py le fait deja.
BEACON_HOST = "https://atlas-studio.pro"

BALISE = re.compile(r'\s*<meta http-equiv="Content-Security-Policy"[^>]*>')


def empreinte(contenu: str) -> str:
    return "sha256-" + base64.b64encode(
        hashlib.sha256(contenu.encode("utf-8")).digest()).decode("ascii")


def blocs(html: str, balise: str) -> list[str]:
    """Contenu EXACT de chaque <balise ...>...</balise> -- c'est sur ces
    octets-là que le navigateur calcule l'empreinte."""
    return re.findall(r"<%s[^>]*>(.*?)</%s>" % (balise, balise), html, re.S)


def csp_pour(html: str) -> str:
    style_hash = " ".join("'%s'" % empreinte(s) for s in blocs(html, "style"))
    script_hashes = " ".join("'%s'" % empreinte(s) for s in blocs(html, "script"))
    return ("default-src 'none'; "
            "base-uri 'none'; "
            "frame-ancestors 'none'; "
            "form-action 'none'; "
            f"img-src 'self' data: {BEACON_HOST}; "
            f"style-src-elem {style_hash}; "
            "style-src-attr 'unsafe-inline'; "
            f"script-src-elem 'self' {script_hashes} {CDN_ORIGINS}; "
            "script-src-attr 'unsafe-inline'; "
            f"connect-src 'self' {CDN_ORIGINS}")


def applique(html: str) -> str:
    sans = BALISE.sub("", html)
    meta = ('\n<meta http-equiv="Content-Security-Policy" content="%s">'
            % csp_pour(sans))
    return sans.replace('<meta charset="UTF-8">',
                         '<meta charset="UTF-8">' + meta, 1)


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
    print("CSP recalculée : " + PAGE)
    return 0


if __name__ == "__main__":
    sys.exit(main())
