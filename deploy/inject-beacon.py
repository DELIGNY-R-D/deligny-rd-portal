#!/usr/bin/env python3
"""Réinjecte la balise de mesure d'audience dans toutes les pages du portail.

Pourquoi ce script existe : les pages du portfolio sont régénérées de temps en
temps depuis des gabarits, ce qui efface toute modification faite à la main —
dont la balise. Plutôt que de la remettre après coup, ce script la rétablit,
et le hook pre-commit l'exécute à chaque commit : la mesure est auto-réparable,
quel que soit l'outil qui a produit la page.

Ce qu'il garantit sur chaque page HTML suivie par git :
  1. la CSP autorise les images de l'hôte de l'API (et RIEN d'autre : aucun
     script n'est autorisé sur les pages du portail) ;
  2. un GIF 1×1 invisible juste avant </body>, qui compte la vue et l'hôte du
     référent. Ni IP, ni cookie, donc aucun bandeau de consentement.

Les pages sous art/ sont ignorées : elles embarquent déjà leur propre mesure
(durée d'attention, clics) avec une CSP dédiée.

Usage : python3 deploy/inject-beacon.py [--check]
  --check : ne modifie rien, sort en code 1 si une page manque la balise.
"""
import os
import subprocess
import sys

API_PX = "https://atlas-studio.pro/deligny/api/px"
API_HOST = "https://atlas-studio.pro"
RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def pages() -> list:
    out = subprocess.run(["git", "ls-files", "*.html"], cwd=RACINE,
                         capture_output=True, text=True).stdout.split()
    # deploy/tests/ : fixtures aux empreintes calculees sur leur contenu EXACT,
    # les modifier casserait le test de non-regression du controle.
    return [f for f in out
            if not f.startswith("art/") and not f.startswith("deploy/tests/")]


def corrige(contenu: str, nom_page: str) -> str:
    if "Content-Security-Policy" in contenu and "img-src" in contenu and API_HOST not in contenu:
        contenu = contenu.replace("img-src 'self' data:;",
                                  f"img-src 'self' data: {API_HOST};")
    if "deligny/api/px" not in contenu and "</body>" in contenu:
        # PAS DE style= INLINE (28/08). La CSP des pages est `style-src 'self'`
        # sans 'unsafe-inline' : l'attribut etait bloque sur les 39 pages qui
        # portent la balise, sans bruit. Un pixel 1x1 en fin de corps n'a de
        # toute facon pas besoin d'etre deplace hors ecran pour etre invisible.
        balise = (f'<img src="{API_PX}?page={nom_page}" alt="" width="1" height="1" '
                  f'loading="eager">\n')
        contenu = contenu.replace("</body>", balise + "</body>")
    return contenu


def main() -> int:
    check = "--check" in sys.argv
    manquantes, corrigees = [], []
    for f in pages():
        chemin = os.path.join(RACINE, f)
        try:
            avant = open(chemin, encoding="utf-8").read()
        except OSError:
            continue
        apres = corrige(avant, os.path.splitext(os.path.basename(f))[0])
        if apres == avant:
            continue
        manquantes.append(f)
        if not check:
            open(chemin, "w", encoding="utf-8").write(apres)
            corrigees.append(f)
    if check:
        if manquantes:
            print("balise absente sur %d page(s) : %s" % (len(manquantes), ", ".join(manquantes[:5])))
            return 1
        print("balise présente sur toutes les pages")
        return 0
    print("balise rétablie sur %d page(s)" % len(corrigees) if corrigees
          else "balise déjà présente partout")
    if corrigees:
        subprocess.run(["git", "add", "--"] + corrigees, cwd=RACINE)
    return 0


if __name__ == "__main__":
    sys.exit(main())
