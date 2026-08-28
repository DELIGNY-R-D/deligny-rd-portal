#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""NON-REGRESSION DE deploy/verifie-fortress.py

Le controle est notre seul filet contre une classe de panne INVISIBLE : un
script bloque par la CSP ne produit aucune erreur dans la page. Si le controle
se met a taire une faute, ou a en inventer, personne ne s'en apercevra avant le
prochain incident. Ces fixtures verifient donc les deux sens :

  - il ALERTE sur ce qui est reellement casse ;
  - il SE TAIT sur ce qui est legitime (une empreinte valide, une ancre, un
    canonical, un gabarit JS), car un controle bruyant finit ignore.

Usage : python3 deploy/tests/test_verifie_fortress.py
"""
import os
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(ICI))          # pour importer le controle
import importlib.util
spec = importlib.util.spec_from_file_location(
    "verifie_fortress", os.path.join(os.path.dirname(ICI), "verifie-fortress.py"))
VF = importlib.util.module_from_spec(spec)
spec.loader.exec_module(VF)

FIX = os.path.join(ICI, "fixtures")

# (fixture, doit_alerter, ce que la regle protege)
CAS = [
    ("01-inline-interdit",         True,  "script inline sous script-src 'self'"),
    ("02-hash-valide",             False, "inline autorise par SON empreinte exacte"),
    ("03-hash-invalide",           True,  "empreinte presente mais qui ne correspond pas"),
    ("03b-hash-valide-plus-inline", True, "un hash valide n'exempte pas les AUTRES inline"),
    ("04-onclick-interdit",        True,  "onclick= sans 'unsafe-hashes'"),
    ("04b-onclick-autorise",       False, "onclick= avec 'unsafe-hashes' et son empreinte"),
    ("05-ancre",                   False, "#section n'est pas un fichier"),
    ("06-canonical",               False, "rel=canonical est une metadonnee, pas une ressource"),
    ("07-template-js",             False, "${...} est un gabarit, pas un chemin"),
    ("08-ressource-absente",       True,  "script src pointant un fichier absent"),
    ("09-domaine-interdit",        True,  "image chargee depuis un domaine hors CSP"),
]


def main() -> int:
    echecs = 0
    for nom, doit_alerter, propos in CAS:
        chemin = os.path.join(FIX, nom + ".html")
        bloquants, _ = VF.controle(chemin)
        alerte = len(bloquants) > 0
        ok = (alerte == doit_alerter)
        if not ok:
            echecs += 1
            attendu = "une alerte" if doit_alerter else "le silence"
            print(f"ECHEC  {nom}\n       attendu : {attendu} ({propos})")
            for b in bloquants:
                print(f"       obtenu  : {b}")
            if doit_alerter and not bloquants:
                print("       obtenu  : rien")
        else:
            print(f"ok     {nom:<30} {propos}")
    print(f"\n{len(CAS) - echecs}/{len(CAS)} cas conformes")
    if echecs:
        print("ECHEC : le controle ne protege plus ce qu'il devrait.")
        return 1
    print("OK : le garde-fou se comporte comme prevu, dans les deux sens.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
