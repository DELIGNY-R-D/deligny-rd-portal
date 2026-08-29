#!/usr/bin/env bash
# PUBLICATION EN DEUX TEMPS — deligny-rd.fr
#
# Ne du 25/08/2026. Deux incidents du meme jour ont montre qu'un `git push`
# unique ne suffit pas :
#
#  1. Un HTML peut partir en production en referencant un fichier qui n'y est
#     pas encore : GitHub Pages ne publie pas tout au meme instant. Le visiteur
#     tombe alors sur une page amputee.
#  2. Pire, une requete faite pendant cette fenetre fait mettre le 404 EN CACHE
#     par Cloudflare (vu : cf-cache-status HIT, age 157) : le fichier existe a
#     la source et reste introuvable pendant des heures.
#
# D'ou l'ordre impose ici : les ASSETS d'abord, on attend qu'ils repondent 200,
# et SEULEMENT ensuite le HTML qui les reference. On ne teste jamais une URL
# avant de l'avoir publiee, pour ne pas empoisonner le cache soi-meme.
#
# Usage : ./deploy/publie.sh "message de commit"
set -euo pipefail
cd "$(dirname "$0")/.."
MSG="${1:?message de commit requis}"
BASE="https://deligny-rd.fr"

echo "== 1/6  Non-regression du controle lui-meme =="
# Un garde-fou qui s'est mis a taire les fautes est pire que pas de garde-fou :
# on verifie d'abord qu'il alerte ET qu'il se tait quand il faut.
python3 deploy/tests/test_verifie_fortress.py >/dev/null || {
  echo "ARRET : le controle ne se comporte plus comme prevu (lancer le test pour voir)."; exit 1; }
echo "   controle conforme"

echo "== 2/6  Controle de la forteresse statique =="
python3 deploy/verifie-fortress.py || { echo "ARRET : corriger les points bloquants."; exit 1; }

echo "== 3/6  Empreintes de contenu (cache-bust) et balises =="
python3 deploy/cache-bust.py
python3 deploy/csp-studio.py      || true
python3 deploy/csp-nano-worlds.py || true
python3 deploy/inject-beacon.py   || true

echo "== 4/6  Publication des ASSETS (js, css, images, fontes) =="
# NE JAMAIS SUPPRIMER UN ANCIEN ASSET VERSIONNE ICI.
# Un HTML deja servi peut rester des heures dans le cache d'un visiteur ou d'un
# edge Cloudflare et continuer de reclamer l'ancienne URL (…?v=<ancien hash>).
# Effacer ce fichier casserait ces pages-la, sans qu'aucun controle local ne le
# voie. On AJOUTE, on ne retire pas : aucun --delete, aucun `git rm` d'asset
# dans cette etape. Le menage se fait dans un lot ULTERIEUR, quand plus aucun
# HTML en circulation ne peut y renvoyer.
# Deux defauts corriges le 29/08, tous les deux silencieux :
#
#  1. `git add -A -- '*.jpg' '*.jpeg' ...` echouait EN ENTIER (« pathspec ne
#     correspond a aucun fichier ») des qu'une extension etait absente du
#     depot : jpeg, webp et woff2 le sont. Le `|| true` avalait l'erreur, plus
#     rien n'etait mis en scene, et les assets partaient donc dans le MEME
#     commit que le HTML. La publication en deux temps n'a jamais separe quoi
#     que ce soit depuis sa creation.
#  2. Le controle anti-suppression inspectait l'INDEX, alors qu'il s'executait
#     AVANT que le moindre fichier y soit ajoute : il ne pouvait rien voir.
#
# On lit donc l'arbre de travail, pas l'index, et on n'enumere que ce qui
# existe reellement.
EXT='\.(js|css|png|jpg|jpeg|svg|webp|woff2)$'
SUPPRIMES=$(git ls-files -d | grep -Ei "$EXT" || true)
if [ -n "$SUPPRIMES" ]; then
  echo "ARRET : suppression d'asset detectee dans ce lot."
  echo "$SUPPRIMES" | sed "s/^/   /"
  echo "   Un HTML en cache peut encore reclamer ce fichier."
  echo "   Publier l'ajout d'abord, supprimer dans un lot ULTERIEUR."
  exit 1
fi
ASSETS=$(git ls-files -mo --exclude-standard | grep -Ei "$EXT" || true)
if [ -n "$ASSETS" ]; then
  echo "$ASSETS" | sed "s/^/   + /"
  echo "$ASSETS" | tr '\n' '\0' | xargs -0 git add --
fi
if ! git diff --cached --quiet; then
  git commit -q -m "$MSG (assets)"
  git push -q origin main
  echo "   assets pousses, attente de leur mise en ligne..."
else
  echo "   aucun asset modifie"
fi

echo "== 5/6  Verification que la prod sert bien le CONTENU attendu =="
# On ne se contente PAS d'un code 200 : le ?v=<empreinte> est une clef de cache,
# pas un chemin, donc `styles.css?v=neuf` repond 200 meme quand le serveur sert
# encore l'ancien fichier. Deux publications du 29/08 sont parties comme ca, les
# corrections invisibles pour le visiteur. On recalcule donc l'empreinte du
# corps servi et on exige l'egalite. Detail : deploy/verifie-assets-servis.py
for i in $(seq 1 12); do
  if python3 deploy/verifie-assets-servis.py; then
    echo "   contenu conforme"
    break
  fi
  [ "$i" = "12" ] && { echo "ARRET : la production sert encore une version precedente."
                       echo "   Publier le HTML maintenant le ferait pointer vers un contenu perime."
                       exit 1; }
  echo "   nouvelle tentative ($i/12)"
  sleep 15
done

echo "== 6/6  Publication des PAGES =="
git add -A
if ! git diff --cached --quiet; then
  git commit -q -m "$MSG"
  git push -q origin main
  echo "   pages publiees"
else
  echo "   aucune page modifiee"
fi
echo "TERMINE."
