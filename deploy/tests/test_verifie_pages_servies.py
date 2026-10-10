#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Le controle sait-il DIRE quelles pages ne sont pas publiees ?

POURQUOI CE TEST EXISTE. Le 09/10/2026, publie.sh a affiche TERMINE sans avoir
compare l'accueil, qui venait de changer. L'etape de controle ne regardait que
le DERNIER commit ; le changement etait dans un commit fait a la main avant de
lancer le script, et le dernier commit, celui du script, ne portait que le
sitemap. Un garde-fou qui se desactive selon la facon dont on a commite est
pire qu'un garde-fou absent : il rassure.

Ce test porte sur la SELECTION des pages, qui se verifie sans reseau. Il cree
un depot git jetable, ce qui le rend independant de l'etat du vrai depot et de
ce qu'une autre session y fait au meme moment.

    python3 deploy/tests/test_verifie_pages_servies.py
"""
from __future__ import annotations

import os
import subprocess
import sys
import tempfile

RACINE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(RACINE, "deploy"))
import importlib.util

spec = importlib.util.spec_from_file_location(
    "vps", os.path.join(RACINE, "deploy", "verifie-pages-servies.py"))
vps = importlib.util.module_from_spec(spec)
spec.loader.exec_module(vps)

echecs = []


def verifie(ce_qui_est_teste, obtenu, attendu):
    if obtenu == attendu:
        print("  ok  %s" % ce_qui_est_teste)
    else:
        print("  ECHEC  %s\n        attendu : %r\n        obtenu  : %r"
              % (ce_qui_est_teste, attendu, obtenu))
        echecs.append(ce_qui_est_teste)


def git(*args, cwd):
    return subprocess.run(["git", *args], cwd=cwd, capture_output=True,
                          text=True, check=True).stdout.strip()


def ecrire(cwd, nom, contenu):
    chemin = os.path.join(cwd, nom)
    os.makedirs(os.path.dirname(chemin), exist_ok=True) if os.path.dirname(nom) else None
    with open(chemin, "w", encoding="utf-8") as f:
        f.write(contenu)


def main() -> int:
    with tempfile.TemporaryDirectory() as d:
        git("init", "-q", "-b", "main", cwd=d)
        git("config", "user.email", "test@local", cwd=d)
        git("config", "user.name", "test", cwd=d)

        ecrire(d, "index.html", "v1")
        ecrire(d, "styles.css", "css1")
        git("add", "-A", cwd=d)
        git("commit", "-q", "-m", "socle", cwd=d)
        socle = git("rev-parse", "HEAD", cwd=d)

        # LE CAS DU 09/10 : un commit a la main qui touche une page, PUIS un
        # commit « du script » qui ne touche que le sitemap.
        ecrire(d, "index.html", "v2")
        git("add", "-A", cwd=d)
        git("commit", "-q", "-m", "a la main : accueil", cwd=d)
        ecrire(d, "sitemap.xml", "<urlset/>")
        git("add", "-A", cwd=d)
        git("commit", "-q", "-m", "du script : sitemap", cwd=d)

        ici = os.getcwd()
        os.chdir(d)
        try:
            verifie("l'ancien controle ne voyait RIEN (c'est le defaut du 09/10)",
                    vps.pages_du_dernier_commit(), [])
            verifie("depuis la base publiee, l'accueil est vu",
                    vps.pages_depuis(socle), (["index.html"], None))

            # Une page supprimee n'a plus de fichier local : la comparer au
            # servi n'a pas de sens, elle doit etre ecartee.
            os.remove(os.path.join(d, "index.html"))
            git("add", "-A", cwd=d)
            git("commit", "-q", "-m", "retrait de l'accueil", cwd=d)
            verifie("une page supprimee est ecartee",
                    vps.pages_depuis(socle), ([], None))

            # Une page ajoutee doit etre vue.
            ecrire(d, "neuve.html", "n1")
            git("add", "-A", cwd=d)
            git("commit", "-q", "-m", "page neuve", cwd=d)
            verifie("une page ajoutee est vue",
                    vps.pages_depuis(socle), (["neuve.html"], None))

            # FAIL-CLOSED : une base illisible ne doit JAMAIS rendre une liste
            # vide sans erreur, sinon l'appelant conclut « rien a verifier ».
            pages, err = vps.pages_depuis("0" * 40)
            verifie("une base inconnue rend une erreur, pas un silence",
                    (pages, err is not None), ([], True))

            # Et le controle lui-meme doit s'arreter dessus, pas rendre 0.
            verifie("main(--depuis <inconnu>) refuse au lieu de passer",
                    vps.main(["--depuis", "0" * 40]), 2)
            verifie("main(--depuis) sans commit refuse",
                    vps.main(["--depuis"]), 2)
        finally:
            os.chdir(ici)

    if echecs:
        print("\n%d controle(s) en echec." % len(echecs))
        return 1
    print("\nControle de selection conforme.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
