#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Genere sitemap.xml a partir des pages REELLEMENT indexables du portail.

Pourquoi ce script existe : le sitemap etait ecrit a la main. Au 10/09/2026 il
declarait 14 adresses pour 81 pages publiques, il annoncait encore
`cube-violet.html` devenu une simple redirection, et il ignorait la page
Logiciels comme les sept fiches d'offre. La strategie de visibilite du portail
repose entierement sur le fait d'etre indexe et cite ; elle tournait donc sur une
carte decrivant 17 % du site.

REGLE D'INCLUSION. Une page entre dans le sitemap si et seulement si :
  1. elle est suivie par git et se termine par .html ;
  2. elle n'est pas un outil interne du depot (deploy/) ;
  3. elle ne porte pas de `robots ... noindex` ;
  4. elle n'est pas une redirection (`http-equiv="refresh"`) ;
  5. si elle declare un `<link rel="canonical">`, celui-ci designe SA PROPRE
     adresse — sinon c'est un doublon qui pointe ailleurs, et Google ne veut
     que les canoniques.

`priority` et `changefreq` sont volontairement omis : Google les ignore.

LASTMOD. Jamais l'heure de generation, sinon le sitemap ment a chaque
publication en pretendant que tout le site vient de changer. On remonte
l'historique git jusqu'au dernier commit qui a change le CONTENU de la page :
les reecritures mecaniques (empreintes `?v=` du cache-bust, empreintes
`sha256-` de la CSP) ne comptent pas comme une modification. Une page modifiee
mais pas encore committee est datee d'aujourd'hui, ce qui est vrai.
"""
import os
import re
import subprocess
import sys
from datetime import date, datetime, timezone

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://deligny-rd.fr"

NOINDEX = re.compile(r'<meta[^>]+name=["\']robots["\'][^>]*content=["\'][^"\']*noindex', re.I)
REDIRECTION = re.compile(r'<meta[^>]+http-equiv=["\']refresh["\']', re.I)
CANONIQUE = re.compile(r'<link[^>]+rel=["\']canonical["\'][^>]*href=["\']([^"\']+)["\']', re.I)

# Reecritures mecaniques : elles changent le fichier, pas ce qu'il dit.
MECANIQUE = [
    (re.compile(r'\?v=[0-9a-f]{8}'), '?v='),
    (re.compile(r"'sha256-[A-Za-z0-9+/=]{40,}'"), "'sha256-'"),
]


def git(*args):
    return subprocess.run(["git"] + list(args), cwd=RACINE,
                          capture_output=True, text=True).stdout


def pages():
    for p in git("ls-files", "*.html").split():
        if p.startswith("deploy/"):
            continue
        yield p


def adresse(p):
    """Chemin du depot -> URL absolue canonique."""
    if p == "index.html":
        return SITE + "/"
    if p.endswith("/index.html"):
        return SITE + "/" + p[:-len("index.html")]
    return SITE + "/" + p


def normalise(ligne):
    for motif, remplacement in MECANIQUE:
        ligne = motif.sub(remplacement, ligne)
    return ligne


def changement_reel(sha, chemin):
    """Ce commit a-t-il change le CONTENU de la page, hors reecritures mecaniques ?"""
    diff = git("show", "--format=", "--unified=0", sha, "--", chemin)
    ajouts, retraits = [], []
    for l in diff.split("\n"):
        if l.startswith("+++") or l.startswith("---"):
            continue
        if l.startswith("+"):
            ajouts.append(normalise(l[1:]))
        elif l.startswith("-"):
            retraits.append(normalise(l[1:]))
    if not ajouts and not retraits:
        return False
    return sorted(ajouts) != sorted(retraits)


def derniere_modif(chemin):
    """Date de la derniere modification de CONTENU, au format AAAA-MM-JJ."""
    # Modifiee mais pas encore committee : c'est aujourd'hui, et c'est vrai.
    en_cours = git("status", "--porcelain", "--", chemin).strip()
    if en_cours:
        return date.today().isoformat()
    journal = git("log", "--format=%H %cI", "--", chemin).split("\n")
    repli = None
    for ligne in journal:
        if not ligne.strip():
            continue
        sha, iso = ligne.split(" ", 1)
        if repli is None:
            repli = iso[:10]
        if changement_reel(sha, chemin):
            return iso[:10]
    return repli or date.today().isoformat()


def retenues():
    gardees, ecartees = [], []
    for p in sorted(pages()):
        s = open(os.path.join(RACINE, p), encoding="utf-8").read()
        url = adresse(p)
        if NOINDEX.search(s):
            ecartees.append((p, "noindex"))
            continue
        if REDIRECTION.search(s):
            ecartees.append((p, "redirection"))
            continue
        m = CANONIQUE.search(s)
        if m:
            declare = m.group(1).rstrip()
            if declare.rstrip("/") != url.rstrip("/"):
                ecartees.append((p, "canonique pointe ailleurs : " + declare))
                continue
        gardees.append((p, url))
    return gardees, ecartees


def main():
    controle = "--check" in sys.argv
    gardees, ecartees = retenues()

    lignes = ['<?xml version="1.0" encoding="UTF-8"?>',
              '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for p, url in gardees:
        lignes.append("  <url>")
        lignes.append("    <loc>%s</loc>" % url.replace("&", "&amp;"))
        lignes.append("    <lastmod>%s</lastmod>" % derniere_modif(p))
        lignes.append("  </url>")
    lignes.append("</urlset>")
    xml = "\n".join(lignes) + "\n"

    chemin = os.path.join(RACINE, "sitemap.xml")
    ancien = open(chemin, encoding="utf-8").read() if os.path.exists(chemin) else ""

    if controle:
        if xml != ancien:
            print("Sitemap perime : %d URL attendues, %d declarees"
                  % (len(gardees), ancien.count("<loc>")))
            return 1
        print("Sitemap a jour (%d URL)" % len(gardees))
        return 0

    if xml != ancien:
        open(chemin, "w", encoding="utf-8").write(xml)
        print("Sitemap regenere : %d URL (etait %d), %d page(s) ecartee(s)"
              % (len(gardees), ancien.count("<loc>"), len(ecartees)))
        for p, raison in ecartees[:6]:
            print("   ecartee %-34s %s" % (p, raison))
        if len(ecartees) > 6:
            print("   ... et %d autre(s)" % (len(ecartees) - 6))
    else:
        print("Sitemap inchange (%d URL)" % len(gardees))
    return 0


if __name__ == "__main__":
    sys.exit(main())
