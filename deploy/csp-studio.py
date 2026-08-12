#!/usr/bin/env python3
"""Pose (et tient à jour) la CSP des pages qui embarquent du code en ligne.

Pourquoi ce script existe : le reste du portail n'a AUCUN script, sa CSP peut
donc rester figée dans les pages. Le Custom 3D Lamp Studio, lui, est un outil :
tout son moteur est un <script> en ligne dans la page. Une CSP écrite à la main
serait fausse dès la première modification du moteur — le hash ne correspondrait
plus et le navigateur bloquerait TOUT le script, donc l'outil entier.

Ce script recalcule donc les empreintes sha256 du <style> et du <script> à
chaque commit (hook pre-commit, comme inject-beacon.py) et réécrit la balise
CSP. La protection ne peut pas se périmer en silence.

Ce que la CSP autorise, et rien d'autre :
  - le style et le script en ligne de la page, par EMPREINTE (pas 'unsafe-inline'
    pour les <script> : un script injecté aurait une autre empreinte et serait
    refusé) ;
  - les attributs style="..." (style-src-attr), que les empreintes ne couvrent
    pas et que la page utilise pour sa mise en page ;
  - les images de la page, les data: (aperçus, PNG du rendu) et la balise de
    mesure d'audience ;
  - les appels réseau vers le moteur AI LOCAL (127.0.0.1:4555) uniquement : en
    ligne, l'appel échoue et la page retombe sur son rendu maison.
Tout le reste — iframe, formulaire, police externe, script tiers — est refusé.

Usage : python3 deploy/csp-studio.py [--check]
  --check : ne modifie rien, sort en code 1 si une CSP est absente ou périmée.
"""
import base64
import hashlib
import os
import re
import sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# L'affiche produit porte elle aussi un <style> et un <script> en ligne : sans
# empreinte, le `script-src 'self'` de la forteresse nginx tuerait son bouton
# de partage, et la page aurait l'air cassée sans rien dans la console.
PAGES = ["lampe-3d-studio/index.html", "lampe-3d-studio/dune.html",
         "lampe-3d-studio/gamme.html"]
BEACON_HOST = "https://atlas-studio.pro"
AI_LOCAL = "http://127.0.0.1:4555 http://localhost:4555"

BALISE = re.compile(r'\s*<meta http-equiv="Content-Security-Policy"[^>]*>')


def empreinte(contenu: str) -> str:
    return "sha256-" + base64.b64encode(
        hashlib.sha256(contenu.encode("utf-8")).digest()).decode("ascii")


def bloc(html: str, balise: str) -> str:
    """Contenu EXACT entre <balise ...> et </balise> — c'est sur ces octets-là
    que le navigateur calcule l'empreinte."""
    m = re.search(r"<%s[^>]*>(.*?)</%s>" % (balise, balise), html, re.S)
    return m.group(1) if m else ""


def csp_pour(html: str) -> str:
    style = empreinte(bloc(html, "style"))
    script = empreinte(bloc(html, "script"))
    return ("default-src 'none'; "
            "base-uri 'none'; "
            "frame-ancestors 'none'; "
            "form-action 'none'; "
            f"img-src 'self' data: {BEACON_HOST}; "
            f"style-src-elem '{style}'; "
            "style-src-attr 'unsafe-inline'; "
            f"script-src '{script}'; "
            f"connect-src 'self' {AI_LOCAL}")


def applique(html: str) -> str:
    sans = BALISE.sub("", html)          # on retire l'ancienne avant de mesurer
    meta = ('\n<meta http-equiv="Content-Security-Policy" content="%s">'
            % csp_pour(sans))
    return sans.replace("<meta charset=\"utf-8\">",
                        "<meta charset=\"utf-8\">" + meta, 1)


def main() -> int:
    check = "--check" in sys.argv
    perimees = []
    for rel in PAGES:
        chemin = os.path.join(RACINE, rel)
        if not os.path.exists(chemin):
            continue
        avant = open(chemin, encoding="utf-8").read()
        apres = applique(avant)
        if apres == avant:
            continue
        perimees.append(rel)
        if not check:
            open(chemin, "w", encoding="utf-8").write(apres)
    if check:
        if perimees:
            print("CSP absente ou périmée : " + ", ".join(perimees))
            return 1
        print("CSP à jour")
        return 0
    if perimees:
        print("CSP recalculée sur %d page(s) : %s" % (len(perimees), ", ".join(perimees)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
