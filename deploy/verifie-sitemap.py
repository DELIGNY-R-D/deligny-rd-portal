#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Verifie EN PRODUCTION que chaque URL du sitemap est servie et canonique.

Un sitemap n'est utile que s'il dit vrai. Deux facons de mentir :
  - annoncer une adresse qui ne repond pas 200 (Google le compte comme une
    erreur d'exploration et perd confiance dans le fichier entier) ;
  - annoncer une adresse dont la page declare un AUTRE canonique, auquel cas on
    demande d'indexer une page qui se renie elle-meme.

Ce controle tourne APRES la publication des pages, sur des adresses donc deja
publiees : les interroger ne peut pas empoisonner un cache (cf. la regle du
depot, on ne sonde jamais une URL AVANT de la publier).

Sortie : une ligne par ecart, code 1 s'il en reste.
"""
import re
import sys
import urllib.request
import urllib.error

SITE = "https://deligny-rd.fr"
CANONIQUE = re.compile(rb'<link[^>]+rel=["\']canonical["\'][^>]*href=["\']([^"\']+)["\']', re.I)


def lire(url, entetes=None):
    req = urllib.request.Request(url, headers=entetes or {
        "User-Agent": "verifie-sitemap", "Accept-Encoding": "identity"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.status, r.read()


def main():
    try:
        _, brut = lire(SITE + "/sitemap.xml")
    except Exception as e:                                        # noqa: BLE001
        print("   ARRET : sitemap.xml injoignable (%s)" % e)
        return 1

    urls = re.findall(rb"<loc>([^<]+)</loc>", brut)
    urls = [u.decode("utf-8").replace("&amp;", "&") for u in urls]
    print("   %d URL declarees, verifiees une par une" % len(urls))

    ecarts = []
    for u in urls:
        try:
            code, corps = lire(u)
        except urllib.error.HTTPError as e:
            ecarts.append("%s : code %s" % (u, e.code))
            continue
        except Exception as e:                                    # noqa: BLE001
            ecarts.append("%s : injoignable (%s)" % (u, e))
            continue
        if code != 200:
            ecarts.append("%s : code %s" % (u, code))
            continue
        m = CANONIQUE.search(corps)
        if m:
            declare = m.group(1).decode("utf-8").strip()
            if declare.rstrip("/") != u.rstrip("/"):
                ecarts.append("%s : canonique declare %s" % (u, declare))

    for e in ecarts:
        print("   ECART %s" % e)
    if ecarts:
        print("   %d ecart(s) : le sitemap annonce des adresses qui ne tiennent pas." % len(ecarts))
        return 1
    print("   les %d URL repondent 200 et sont canoniques" % len(urls))
    return 0


if __name__ == "__main__":
    sys.exit(main())
