#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Publie le Montre 3D Studio dans le portail, a partir de sa source.

POURQUOI UN SCRIPT ET PAS UN PORTAGE A LA MAIN. La source est ecrite en ce
moment par une autre session : un portage manuel serait perime le lendemain, et
le refaire couterait aussi cher que la premiere fois. Ici, republier apres
chaque avancee tient en une commande.

CE QUI CHANGE ENTRE LA SOURCE ET LA PAGE PUBLIEE, et pourquoi.

  1. three.js. La source le charge depuis cdn.jsdelivr.net. Le portail ne
     charge AUCUN script tiers : sa CSP est `default-src 'none'` et la page
     revendique une entreprise souveraine. Les imports sont donc rediriges vers
     `vendor/`, ou three 160 et ses six modules sont deja deposes.

  2. CSP. La source n'en a pas, elle tourne en local. La page publiee en recoit
     une, calquee sur nano-worlds, qui est le precedent du portail pour une
     application three.js a importmap.

  3. Les fonctions qui exigent le serveur local. Le concierge, les bas-reliefs
     IA, les ornements Blender et la bibliotheque passent tous par
     GENERATIVE_DESIGN/app/server.py sur le port 4555. Sur un site statique, ce
     serveur n'existe pas. On ne laisse pas des boutons echouer en silence : la
     page publiee annonce en clair ce qu'elle ne fait pas, et le studio bascule
     sur son repli hors ligne, qu'il sait deja faire.

Ce qui reste entier : la 3D sur les vraies pieces STL, les moteurs de motifs de
lunette et de cadran, l'encyclopedie des 550 surfaces, l'export STL.

    python3 deploy/publie-montre-studio.py [--verifier]

`--verifier` ne copie rien et dit seulement si la page publiee correspond a la
source actuelle. Utile pour savoir si une republication est due.
"""
from __future__ import annotations

import hashlib
import os
import re
import shutil
import sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.expanduser(
    "~/Documents/Code/DESIGN:ART/GENERATIVE_DESIGN/montre-3d-studio")
CIBLE = os.path.join(RACINE, "montre-3d-studio")

# Les six modules que la source importe, deja deposes dans le portail.
MODULES = ("controls/OrbitControls.js", "environments/RoomEnvironment.js",
           "exporters/STLExporter.js", "loaders/RGBELoader.js",
           "loaders/STLLoader.js", "utils/BufferGeometryUtils.js")

CSP = ("default-src 'none'; "
       "script-src-elem 'self' 'unsafe-inline'; script-src-attr 'unsafe-inline'; "
       "style-src 'self' 'unsafe-inline'; "
       "img-src 'self' data: blob: https://atlas-studio.pro; "
       "connect-src 'self'; worker-src 'self' blob:; "
       "base-uri 'self'; form-action 'none'; "
       "upgrade-insecure-requests")

BANDEAU = (
    '<p id="montre-demo-publique" '
    'style="margin:0;padding:10px 16px;background:#f3efe6;color:#4a4034;'
    'font:400 13px/1.5 system-ui,sans-serif;border-bottom:1px solid #ddd5c6">'
    'Demonstration publique. Le moteur de motifs, la 3D sur les vraies pieces, '
    'l&#x27;encyclopedie des 550 surfaces et l&#x27;export STL fonctionnent ici. '
    'Le concierge repond en <b>mode limite</b> : il lit votre phrase avec un '
    'dictionnaire de mots, sans assistant. Les bas-reliefs generes et les ornements '
    'Blender, eux, demandent le studio local.</p>')


def empreinte(chemin: str) -> str:
    h = hashlib.sha256()
    with open(chemin, "rb") as f:
        for bloc in iter(lambda: f.read(1 << 20), b""):
            h.update(bloc)
    return h.hexdigest()


def transformer(html: str) -> tuple[str, list]:
    """Rend (page publiee, liste de ce qui a ete change). Chaque transformation
    qui ne trouve pas sa cible est une ERREUR : la source a bouge, et publier
    une page a moitie transformee serait pire que ne rien publier."""
    faits = []

    # 1. three.js : du CDN vers le vendor local.
    avant = html
    html = html.replace("https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
                        "./vendor/three.module.js")
    html = html.replace("https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/",
                        "./vendor/jsm/")
    if html == avant:
        raise SystemExit("ECHEC : aucun import jsdelivr trouve. La source a change "
                         "de facon de charger three : relire avant de republier.")
    if "cdn.jsdelivr.net" in html or "https://unpkg" in html:
        restes = sorted(set(re.findall(r"https://[a-z0-9.-]*(?:jsdelivr|unpkg)[^\"']*", html)))
        raise SystemExit("ECHEC : il reste des scripts tiers : %s" % ", ".join(restes[:4]))
    faits.append("three.js redirige vers vendor/ (zero CDN)")

    # 2. CSP, juste apres le charset.
    if "Content-Security-Policy" in html:
        raise SystemExit("ECHEC : la source porte deja une CSP, ce script l'ecraserait.")
    m = re.search(r'<meta charset="[^"]*">', html)
    if not m:
        raise SystemExit("ECHEC : pas de <meta charset> ou poser la CSP.")
    html = (html[:m.end()]
            + '\n<meta http-equiv="Content-Security-Policy" content="%s">' % CSP
            + html[m.end():])
    faits.append("CSP ajoutee")

    # 3. Le serveur local n'existe pas en public. On le dit, on ne le cache pas.
    avant = html
    html = re.sub(r"const AI_BASE = [^\n;]+",
                  "const AI_BASE = '';   // publie: pas de serveur local, repli hors ligne",
                  html, count=1)
    if html == avant:
        raise SystemExit("ECHEC : AI_BASE introuvable. La source a change de facon "
                         "de joindre son serveur : relire avant de republier.")
    faits.append("AI_BASE neutralise (concierge en repli hors ligne)")

    # Le concierge SAIT travailler hors ligne (dictionnaire de mots, sans IA) et
    # il le fait bien : il reconnait « ciel etoile » et l'applique. Mais il
    # passait d'abord par le reseau, echouait, et affichait au visiteur
    # « Unexpected token '<' ... is not valid JSON ». Une trace technique brute
    # dans une page client est un defaut, pas un detail. En public, on saute
    # l'appel et on annonce le mode limite (constate le 08/10/2026).
    avant = html
    html = html.replace(
        "  try{const ctl2=new AbortController();",
        "  try{if(!AI_BASE)throw new Error('DEMO_PUBLIQUE');const ctl2=new AbortController();", 1)
    html = html.replace(
        "catch(e){d=local(t);d.reponse='Le moteur du studio ne répond pas ('+(e.message||e)+'). '+d.reponse;}",
        "catch(e){d=local(t);d.reponse=(e&&e.message==='DEMO_PUBLIQUE'"
        "?'Mode limité : je lis votre phrase avec un dictionnaire de mots, sans assistant. '"
        ":'Le moteur du studio ne répond pas ('+(e.message||e)+'). ')+d.reponse;}", 1)
    if html == avant:
        raise SystemExit("ECHEC : le chemin du concierge a change, relire avant de republier.")
    faits.append("concierge en mode limite, sans appel reseau")

    # Meme chose pour la bibliotheque de bas-reliefs : inutile d'appeler.
    avant = html
    html = html.replace("async function chargerBibliotheque(){try{",
                        "async function chargerBibliotheque(){if(!AI_BASE)return;try{", 1)
    if html == avant:
        raise SystemExit("ECHEC : chargerBibliotheque introuvable.")
    faits.append("bibliotheque de bas-reliefs non appelee en public")

    m = re.search(r"<body[^>]*>", html)
    if not m:
        raise SystemExit("ECHEC : pas de <body> ou poser le bandeau.")
    html = html[:m.end()] + "\n" + BANDEAU + html[m.end():]
    faits.append("bandeau « demonstration publique » pose")

    # 4. Mesure d'audience, comme toutes les pages du portail.
    html = html.replace("</body>",
                        '<img src="https://atlas-studio.pro/deligny/api/px?page=montre-3d-studio"'
                        ' alt="" width="1" height="1" loading="eager">\n</body>', 1)
    faits.append("pixel de mesure ajoute")
    return html, faits


def main(argv=None) -> int:
    argv = list(argv if argv is not None else sys.argv[1:])
    verifier = "--verifier" in argv

    src_html = os.path.join(SOURCE, "index.html")
    if not os.path.isfile(src_html):
        print("source introuvable : %s" % src_html)
        return 2

    with open(src_html, encoding="utf-8") as f:
        publie, faits = transformer(f.read())

    emp_src = empreinte(src_html)
    marqueur = os.path.join(CIBLE, ".source.sha256")
    deja = ""
    if os.path.isfile(marqueur):
        with open(marqueur, encoding="utf-8") as f:
            deja = f.read().strip()

    if verifier:
        print("source   %s" % emp_src[:16])
        print("publiee  %s" % (deja[:16] or "jamais publiee"))
        print("A JOUR" if deja == emp_src else "REPUBLICATION DUE")
        return 0 if deja == emp_src else 3

    manquants = [m for m in MODULES
                 if not os.path.isfile(os.path.join(CIBLE, "vendor", "jsm", m))]
    if manquants or not os.path.isfile(os.path.join(CIBLE, "vendor", "three.module.js")):
        print("ECHEC : vendor incomplet, modules manquants : %s" % ", ".join(manquants))
        return 2

    os.makedirs(CIBLE, exist_ok=True)
    with open(os.path.join(CIBLE, "index.html"), "w", encoding="utf-8") as f:
        f.write(publie)
    shutil.copy2(os.path.join(SOURCE, "encyclopedie.json"), CIBLE)
    cible_media = os.path.join(CIBLE, "media")
    if os.path.isdir(cible_media):
        shutil.rmtree(cible_media)
    shutil.copytree(os.path.join(SOURCE, "media"), cible_media)
    with open(marqueur, "w", encoding="utf-8") as f:
        f.write(emp_src + "\n")

    octets = sum(os.path.getsize(os.path.join(r, n))
                 for r, _, ns in os.walk(CIBLE) for n in ns)
    print("Montre 3D Studio publie dans montre-3d-studio/ (%.1f Mo)" % (octets / 1e6))
    for f_ in faits:
        print("  - %s" % f_)
    print("  empreinte de la source : %s" % emp_src[:16])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
