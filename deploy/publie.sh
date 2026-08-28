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

echo "== 1/5  Controle de la forteresse statique =="
python3 deploy/verifie-fortress.py || { echo "ARRET : corriger les points bloquants."; exit 1; }

echo "== 2/5  Empreintes de contenu (cache-bust) et balises =="
python3 deploy/cache-bust.py
python3 deploy/csp-studio.py      || true
python3 deploy/csp-nano-worlds.py || true
python3 deploy/inject-beacon.py   || true

echo "== 3/5  Publication des ASSETS (js, css, images, fontes) =="
git add -A -- '*.js' '*.css' '*.png' '*.jpg' '*.jpeg' '*.svg' '*.webp' '*.woff2' 2>/dev/null || true
if ! git diff --cached --quiet; then
  git commit -q -m "$MSG (assets)"
  git push -q origin main
  echo "   assets pousses, attente de leur mise en ligne..."
else
  echo "   aucun asset modifie"
fi

echo "== 4/5  Verification que chaque asset repond 200 =="
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

echo "== 5/5  Publication des PAGES =="
git add -A
if ! git diff --cached --quiet; then
  git commit -q -m "$MSG"
  git push -q origin main
  echo "   pages publiees"
else
  echo "   aucune page modifiee"
fi
echo "TERMINE."
