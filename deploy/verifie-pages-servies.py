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
    python3 deploy/verifie-pages-servies.py --depuis <sha>

CE QUE « LES PAGES A CONTROLER » VEUT DIRE. Le 09/10/2026 ce controle a
annonce « aucune page HTML dans ce lot » et publie.sh a affiche TERMINE sans
avoir compare l'accueil, qui venait justement de changer : le changement
etait dans un commit fait A LA MAIN avant de lancer le script, et le dernier
commit, celui du script, ne portait que le sitemap. Un controle qui ne
regarde que le dernier commit ne couvre donc QUE les publications ou l'on a
laisse le script commiter, et il se tait dans les autres sans le dire.

`--depuis <sha>` prend tout ce qui a change depuis le commit REELLEMENT
publie en production, quel que soit le nombre de commits intermediaires.
C'est la forme que publie.sh utilise. Sans argument, on retombe sur le
dernier commit, utile a la main mais insuffisant pour une publication.
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


def pages_depuis(sha: str) -> tuple:
    """Pages HTML ajoutees ou modifiees entre `sha` et HEAD. Rend (pages, erreur).

    Trois sorties distinctes, jamais une liste vide muette : la liste des pages,
    « commit inconnu » (on ne peut rien affirmer, l'appelant doit s'arreter ou
    elargir), ou une liste vide AVEC erreur None, qui signifie pour de bon
    qu'aucune page n'a change.

    Les suppressions sont ecartees (--diff-filter=ACMR) : une page supprimee n'a
    plus de fichier local auquel comparer le servi.
    """
    connu = subprocess.run(["git", "cat-file", "-e", sha + "^{commit}"],
                           capture_output=True)
    if connu.returncode != 0:
        return [], "commit %s inconnu du depot local" % sha[:12]
    r = subprocess.run(["git", "diff", "--name-only", "--diff-filter=ACMR",
                        sha, "HEAD"], capture_output=True, text=True)
    if r.returncode != 0:
        return [], (r.stderr.strip().split("\n")[-1] or "git diff a echoue")
    return [p for p in r.stdout.split("\n") if p.endswith(".html")], None


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
    if "--depuis" in argv:
        i = argv.index("--depuis")
        if i + 1 >= len(argv):
            print("   --depuis attend un commit")
            return 2
        sha = argv[i + 1]
        pages, err = pages_depuis(sha)
        if err:
            # Fail-closed : ne pas rendre 0 sur une base qu'on ne sait pas lire,
            # ce serait rejouer exactement la panne que ce controle existe pour
            # attraper, en plus discret.
            print("   REFUS : impossible d'etablir ce qui n'est pas publie (%s)" % err)
            return 2
        if not pages:
            print("   aucune page HTML modifiee depuis %s, rien a comparer" % sha[:7])
            return 0
        print("   %d page(s) non publiee(s) depuis %s" % (len(pages), sha[:7]))
    else:
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
