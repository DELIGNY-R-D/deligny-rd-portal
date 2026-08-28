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
if git diff --cached --name-status 2>/dev/null | grep -qE "^D.*\.(js|css|png|jpg|jpeg|svg|webp|woff2)$"; then
  echo "ARRET : suppression d'asset detectee dans ce lot."
  git diff --cached --name-status | grep -E "^D.*\.(js|css|png|jpg|jpeg|svg|webp|woff2)$" | sed "s/^/   /"
  echo "   Un HTML en cache peut encore reclamer ce fichier."
  echo "   Publier l'ajout d'abord, supprimer dans un lot ULTERIEUR."
  exit 1
fi
git add -A -- '*.js' '*.css' '*.png' '*.jpg' '*.jpeg' '*.svg' '*.webp' '*.woff2' 2>/dev/null || true
if ! git diff --cached --quiet; then
  git commit -q -m "$MSG (assets)"
  git push -q origin main
  echo "   assets pousses, attente de leur mise en ligne..."
else
  echo "   aucun asset modifie"
fi

echo "== 5/6  Verification que chaque asset repond 200 =="
# On ne controle que les assets VERSIONNES : leur URL est neuve, donc jamais
# presente dans un cache, ce qui rend la mesure fiable.
mapfile -t URLS < <(git ls-files '*.html' | xargs grep -ho '\(src\|href\|data-src\)="[^"]*\.\(js\|css\)?v=[0-9a-f]\{8\}"' 2>/dev/null \
                    | sed 's/.*="//;s/"$//' | sort -u | head -40)
for i in $(seq 1 12); do
  manquants=0
  for u in "${URLS[@]:-}"; do
    [ -z "$u" ] && continue
    code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/${u#/}")
    [ "$code" = "200" ] || manquants=$((manquants+1))
  done
  [ "$manquants" -eq 0 ] && { echo "   tous les assets repondent 200"; break; }
  echo "   $manquants asset(s) pas encore en ligne, nouvelle tentative ($i/12)"
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
