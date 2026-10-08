#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""La production sert-elle EXACTEMENT les pages que nous venons de publier ?

POURQUOI. Le 08/10/2026, un build GitHub Pages a echoue (« Page build failed »,
sans autre explication) et le site a continue de servir la version precedente.
Le `git push` avait reussi, le depot etait juste, et la production mentait.
Rien ne l'aurait dit si un second commit n'avait pas, par hasard, relance un
build. Un push reussi n'est pas un deploiement reussi.

Ce controle compare l'EMPREINTE du corps servi a celle du fichier local. Un
code 200 ne prouve rien : c'est exactement ce que repondait la page perimee.

LA SEULE DIFFERENCE TOLEREE est l'injection Cloudflare. Cloudflare ajoute,
juste avant </body>, un script de sa plateforme de defi (`__CF$cv$params`). Il
ne vient pas de nous, il change a chaque reponse, et il est retire avant la
comparaison. Tout le reste doit coincider a l'octet pres : si Cloudflare se met
un jour a minifier le HTML, ce controle le dira au lieu de l'ignorer.

    python3 deploy/verifie-pages-servies.py [chemin.html ...]

Sans argument, controle les pages HTML du DERNIER COMMIT. Rend 0 seulement si
toutes les pages demandees sont servies a l'identique.
"""
from __future__ import annotations

import hashlib
import re
import subprocess
import sys
import urllib.error
import urllib.request

BASE = "https://deligny-rd.fr"
DELAI = 20

# Le script que Cloudflare glisse avant </body>. Reconnu a sa signature, pas a
# sa position : il ne faut pas retirer un script a nous par mégarde.
RE_CLOUDFLARE = re.compile(
    r"<script>\(function\(\)\{[^<]*?__CF\$cv\$params[^<]*?\}\)\(\);</script>", re.S)


def pages_du_dernier_commit() -> list:
    out = subprocess.run(["git", "diff-tree", "--no-commit-id", "--name-only",
                          "-r", "--diff-filter=ACMR", "HEAD"],
                         capture_output=True, text=True, check=True).stdout
    return [p for p in out.split("\n") if p.endswith(".html")]


def empreinte(donnees: bytes) -> str:
    return hashlib.sha256(donnees).hexdigest()


def servie(chemin: str) -> tuple:
    """Rend (empreinte, erreur). Trois sorties distinctes, jamais un None muet :
    servie et lue, injoignable, ou lue mais vide."""
    url = "%s/%s" % (BASE, chemin.lstrip("/"))
    req = urllib.request.Request(url, headers={"User-Agent": "deligny-publie/1"})
    try:
        with urllib.request.urlopen(req, timeout=DELAI) as r:
            brut = r.read()
    except urllib.error.HTTPError as e:
        return None, "HTTP %d" % e.code
    except Exception as e:
        return None, type(e).__name__
    if not brut:
        return None, "corps vide"
    texte = brut.decode("utf-8", "replace")
    return empreinte(RE_CLOUDFLARE.sub("", texte).encode("utf-8")), None


def main(argv=None) -> int:
    argv = list(argv if argv is not None else sys.argv[1:])
    pages = argv or pages_du_dernier_commit()
    if not pages:
        print("   aucune page HTML dans ce lot")
        return 0

    ecarts = []
    for p in pages:
        try:
            with open(p, "rb") as f:
                attendu = empreinte(RE_CLOUDFLARE.sub("", f.read().decode("utf-8", "replace"))
                                    .encode("utf-8"))
        except OSError as e:
            print("   %-46s LOCAL ILLISIBLE (%s)" % (p, type(e).__name__))
            ecarts.append(p)
            continue
        obtenu, err = servie(p)
        if err:
            print("   %-46s INJOIGNABLE : %s" % (p, err))
            ecarts.append(p)
        elif obtenu != attendu:
            print("   %-46s SERVIE DIFFERENTE (attendu %s, servi %s)"
                  % (p, attendu[:12], obtenu[:12]))
            ecarts.append(p)
        else:
            print("   %-46s conforme" % p)

    if ecarts:
        print("   %d page(s) sur %d ne sont pas celles du depot." % (len(ecarts), len(pages)))
        return 1
    print("   %d page(s) servies a l'identique" % len(pages))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
