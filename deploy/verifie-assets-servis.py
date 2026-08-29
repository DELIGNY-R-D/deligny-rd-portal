#!/usr/bin/env python3
"""Verifie que la production sert bien le CONTENU attendu sous chaque URL versionnee.

Pourquoi ce controle remplace le simple « repond 200 » :

  Le ?v=<empreinte> est une clef de cache, pas un chemin. `styles.css?v=neuf`
  et `styles.css?v=vieux` designent LE MEME fichier : les deux repondent 200
  meme quand la production sert encore l'ancienne version. Un controle de code
  HTTP ne prouve donc rien pour un asset MODIFIE, seulement pour un asset
  nouveau. Constate deux fois le 29/08 : la page reclamait
  `styles.css?v=b40a1ffd`, recevait 200, et le corps servi avait pour empreinte
  reelle 1e5b0a60, soit la version precedente. Les corrections etaient dans le
  depot, publiees, et invisibles pour le visiteur.

  L'empreinte etant le sha256 du fichier (voir deploy/cache-bust.py), on peut
  la recalculer sur ce que le serveur renvoie et exiger l'egalite. C'est la
  seule facon de fermer la boucle : etat SERVI, pas etat declare.

Sortie : une ligne par ecart, code 1 s'il en reste.
"""
import hashlib
import subprocess
import sys
import urllib.request
import uuid

BASE = "https://deligny-rd.fr"


def empreinte(octets):
    return hashlib.sha256(octets).hexdigest()[:8]


def sert(url):
    req = urllib.request.Request(url, headers={
        "Accept-Encoding": "identity",          # on veut les octets bruts
        "User-Agent": "verifie-assets-servis",
        "Cache-Control": "no-cache",
    })
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.status, r.read()


def main():
    liste = subprocess.run([sys.executable, "deploy/urls-versionnees.py"],
                           capture_output=True, text=True, check=True).stdout.split()
    ecarts = []
    for u in liste:
        chemin, _, requete = u.partition("?")
        attendu = requete.split("=", 1)[1] if "=" in requete else ""
        # clef jetable : on ne touche jamais a "?v=<empreinte>" (voir en-tete)
        sonde = "%s/%s?sonde=%s" % (BASE, chemin, uuid.uuid4().hex)
        try:
            code, corps = sert(sonde)
        except Exception as e:                                  # noqa: BLE001
            ecarts.append("%s : injoignable (%s)" % (u, e))
            continue
        if code != 200:
            ecarts.append("%s : code %s" % (u, code))
        elif empreinte(corps) != attendu:
            ecarts.append("%s : servi avec l'empreinte %s (version precedente)"
                          % (u, empreinte(corps)))
    print("   %d URL(s) versionnee(s) verifiees au contenu" % len(liste))
    for e in ecarts:
        print("   ECART %s" % e)
    return 1 if ecarts else 0


if __name__ == "__main__":
    sys.exit(main())
