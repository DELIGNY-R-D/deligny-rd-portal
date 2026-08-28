#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""CONTROLE DE LA FORTERESSE STATIQUE — a lancer AVANT chaque deploiement.

Ne du 25/08/2026 : le configurateur de lampe avait cesse de fonctionner sur
l'accueil. La cause n'etait pas visible a l'oeil ni dans la page — la CSP de
l'accueil est `script-src 'self'` sans 'unsafe-inline', et un <script> inline y
est bloque SILENCIEUSEMENT par le navigateur : aucune erreur affichee, le code
ne s'execute simplement jamais. Une page peut donc partir en production
apparemment intacte et amputee d'une fonction entiere.

La bonne parade n'est pas un test de navigateur : la faute est detectable a la
lecture du fichier, sur TOUTES les pages, en une seconde et sans dependance.
C'est ce que fait ce script.

Ce qu'il verifie, page par page :
  1. INLINE CONTRE CSP  — un <script> sans src, ou un gestionnaire onclick=,
     dans une page dont la CSP n'autorise pas 'unsafe-inline'. C'est le bug
     du 25/08. Bloquant.
  2. RESSOURCE EXTERNE  — un src/href vers un domaine tiers (CDN, fontes)
     alors que la CSP l'interdit. Bloquant.
  3. REFERENCE MORTE    — un fichier local reference mais absent du depot.
     Bloquant : c'est une fonction cassee ou une image manquante.
  4. VERSIONNAGE        — un asset local reference sans ?v=hash. Averti
     seulement : ce n'est pas une panne, mais un risque de cache perime.

Usage :
    python3 deploy/verifie-fortress.py            # controle tout le site
    python3 deploy/verifie-fortress.py --strict   # les avertissements bloquent

Sortie : 0 si tout va bien, 1 si un point bloquant est trouve.
"""
from __future__ import annotations

import os
import re
import sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Dossiers hors perimetre : bibliotheques tierces livrees telles quelles.
IGNORE = ("/vendor/", "/node_modules/", "/.git/")

RE_CSP = re.compile(r'http-equiv="Content-Security-Policy"\s+content="([^"]*)"', re.I)
RE_SCRIPT = re.compile(r'<script\b([^>]*)>(.*?)</script>', re.I | re.S)
# Seules les RESSOURCES CHARGEES sont soumises a la CSP. Un <a href> vers un
# site tiers est une navigation, pas un chargement : le confondre avec une
# ressource produit des faux positifs qui rendent le controle inutilisable.
RE_RESSOURCE = re.compile(
    r'<(?:script|img|iframe|source|video|audio|embed)\b[^>]*\bsrc="([^"]+)"'
    # <link> : seuls ceux qui CHARGENT quelque chose. rel=canonical ou
    # alternate sont des metadonnees, pas des ressources.
    r'|<link\b[^>]*\brel="(?:stylesheet|preload|prefetch|icon|apple-touch-icon|manifest)"[^>]*\bhref="([^"]+)"'
    r'|<link\b[^>]*\bhref="([^"]+)"[^>]*\brel="(?:stylesheet|preload|prefetch|icon|apple-touch-icon|manifest)"', re.I)
RE_LIEN = re.compile(r'<a\b[^>]*\bhref="([^"]+)"', re.I)
# Gestionnaires d'evenement REELS. Un `\bon[a-z]+=` naif attrape aussi les
# attributs personnalises (nodus/index.html porte un `onglet="..."`), et un
# controle qui signale des fautes imaginaires finit par etre ignore.
_EVENEMENTS = ("click", "dblclick", "change", "input", "submit", "load", "error",
               "focus", "blur", "keydown", "keyup", "keypress", "mouseover",
               "mouseout", "mousedown", "mouseup", "pointerdown", "pointerup",
               "touchstart", "touchend", "scroll", "resize", "toggle")
RE_ONEVT = re.compile(r'\bon(?:' + "|".join(_EVENEMENTS) + r')\s*=\s*"[^"]+"', re.I)


def pages() -> list:
    out = []
    for base, _, fichiers in os.walk(RACINE):
        if any(x in (base + "/").replace(os.sep, "/") for x in IGNORE):
            continue
        for f in fichiers:
            if f.endswith(".html"):
                out.append(os.path.join(base, f))
    return sorted(out)


def directive(csp: str, *noms: str) -> str:
    """Premiere directive presente parmi `noms`, sinon default-src.

    L'ordre compte et le repli doit venir EN DERNIER : ecrire
    `directive(csp,"script-src-elem") or directive(csp,"script-src")` ne marche
    pas, car le premier appel rend deja `default-src` et le second n'est jamais
    evalue. Une page dont la CSP porte `script-src 'sha256-...'` etait ainsi
    jugee a tort comme interdisant tout inline.
    """
    parts = [p.strip() for p in csp.split(";") if p.strip()]
    for nom in noms:
        for p in parts:
            if p == nom or p.startswith(nom + " "):
                return p
    for p in parts:
        if p.startswith("default-src"):
            return p
    return ""


def resout(base: str, u: str) -> str:
    """Chemin sur disque d'une URL locale.

    Un chemin ABSOLU (« /nodus/x.js ») part de la racine du SITE, pas du
    dossier de la page : le resoudre relativement donnait des « fichiers
    manquants » imaginaires pour les pages en sous-dossier.
    """
    if u.startswith("/"):
        return os.path.normpath(os.path.join(RACINE, u.lstrip("/")))
    return os.path.normpath(os.path.join(base, u))


def controle(chemin: str) -> tuple:
    """Retourne (bloquants, avertissements) pour une page."""
    rel = os.path.relpath(chemin, RACINE)
    try:
        s = open(chemin, encoding="utf-8", errors="ignore").read()
    except OSError:
        return [], []
    bloquants, avertis = [], []

    m = RE_CSP.search(s)
    csp = m.group(1) if m else ""
    # Sans CSP declaree, la page n'est pas soumise a ce contrat : on ne
    # verifie que les references mortes.
    script_dir = directive(csp, "script-src-elem", "script-src") if csp else ""
    # Un inline peut etre autorise autrement que par 'unsafe-inline' : par
    # l'empreinte de son contenu ('sha256-...') ou par un nonce. C'est ce que
    # fait deploy/csp-studio.py sur la page du Studio lampe, et c'est plus sur
    # que 'unsafe-inline' : seule CETTE version exacte du script s'execute.
    inline_ok = (not csp
                 or "'unsafe-inline'" in script_dir
                 or "'sha256-" in script_dir or "'sha384-" in script_dir
                 or "'sha512-" in script_dir or "'nonce-" in script_dir)

    # 1. Script inline sous une CSP qui l'interdit
    if not inline_ok:
        for attrs, corps in RE_SCRIPT.findall(s):
            if "src=" in attrs.lower():
                continue
            if 'type="application/ld+json"' in attrs.lower() or 'type="importmap"' in attrs.lower():
                continue          # donnees, pas du code executable
            if corps.strip():
                extrait = corps.strip().splitlines()[0][:58]
                bloquants.append(f"script INLINE bloque par la CSP ({script_dir.split()[0]}) : {extrait}…")
        n_evt = len(RE_ONEVT.findall(s))
        attr_dir = directive(csp, "script-src-attr", "script-src")
        if n_evt and "'unsafe-inline'" not in attr_dir:
            bloquants.append(f"{n_evt} gestionnaire(s) inline (onclick=…) bloques par la CSP")

    # 2. Ressources chargees : soumises a la CSP, et doivent exister
    base = os.path.dirname(chemin)
    ressources = [next((x for x in t if x), '') for t in RE_RESSOURCE.findall(s)]
    for url in ressources:
        u = url.split("?")[0].split("#")[0]
        if u.startswith(("http://", "https://", "//")):
            hote = u.split("/")[2] if "//" in u else ""
            if csp and hote and hote not in csp:
                bloquants.append(f"ressource externe non autorisee par la CSP : {hote}")
            continue
        if u.startswith(("data:", "blob:", "mailto:", "tel:", "javascript:")) or not u:
            continue
        # `${...}` : gabarit JavaScript construit a l'execution, pas un chemin.
        if "${" in u or "{{" in u or "' +" in u or "+ '" in u:
            continue
        cible = resout(base, u)
        if not os.path.exists(cible):
            bloquants.append(f"ressource manquante : {url}")
        elif u.endswith((".js", ".css")) and "?v=" not in url:
            avertis.append(f"asset non versionne (cache perimable) : {url}")

    # 3. Liens de navigation : une ancre #section n'est pas un fichier, on la
    #    retire avant de tester l'existence de la cible.
    for url in RE_LIEN.findall(s):
        u = url.split("?")[0].split("#")[0]
        if not u or u.startswith(("http://", "https://", "//", "data:", "mailto:", "tel:", "javascript:")):
            continue
        if "${" in u or "{{" in u or "' +" in u or "+ '" in u:
            continue
        cible = resout(base, u)
        if not os.path.exists(cible):
            bloquants.append(f"lien mort : {url}")

    # 4. Chargement differe : contrat verifiable sans navigateur.
    #    Le 25/08, la logique du differe etait inline et donc bloquee par la
    #    CSP : le widget restait vide. On verifie ici que le trio tient —
    #    balise porteuse, fichier de logique servi par le domaine, cible reelle.
    if 'id="lampeDiffere"' in s:
        d = re.search(r'id="lampeDiffere"[^>]*data-src="([^"?]+)', s)
        if not d:
            bloquants.append("chargement differe : data-src absent de la balise porteuse")
        elif not os.path.exists(resout(base, d.group(1))):
            bloquants.append(f"chargement differe : cible introuvable ({d.group(1)})")
        if not re.search(r'<script[^>]+src="[^"]*lampe-differe\.js', s):
            bloquants.append("chargement differe : la logique doit vivre dans un fichier "
                             "servi (un inline serait bloque par la CSP, sans bruit)")
        if 'id="lampe-embed-root"' not in s:
            bloquants.append("chargement differe : l'element observe est absent")

    return bloquants, avertis


def main() -> int:
    strict = "--strict" in sys.argv
    total_b = total_a = 0
    for p in pages():
        b, a = controle(p)
        if b or a:
            rel = os.path.relpath(p, RACINE)
            print(f"\n{rel}")
            for x in b:
                print(f"  BLOQUANT   {x}")
            for x in sorted(set(a)):
                print(f"  avert.     {x}")
        total_b += len(b)
        total_a += len(set(a))

    print(f"\n{len(pages())} page(s) controlees — {total_b} bloquant(s), {total_a} avertissement(s)")
    if total_b:
        print("ECHEC : corriger les points bloquants avant de deployer.")
        return 1
    if strict and total_a:
        print("ECHEC (--strict) : des avertissements subsistent.")
        return 1
    print("OK : la forteresse tient.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
