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

# ── Attendre le build GitHub Pages DU COMMIT QU'ON VIENT DE POUSSER ─────────
#
# Le 08/10/2026, un build a echoue (« Page build failed. », sans autre
# explication) et la production a continue de servir la version precedente. Le
# push avait reussi, le depot etait juste, et le site mentait. Rien ne l'a dit :
# c'est un second commit, pousse par hasard quelques minutes plus tard, qui a
# relance un build et mis la correction en ligne. UN PUSH REUSSI N'EST PAS UN
# DEPLOIEMENT REUSSI.
#
# Regle : on n'accepte un build que s'il CONTIENT notre commit. Le sien, ou
# celui d'un descendant, car GitHub regroupe parfois deux poussees rapprochees
# en un seul build et notre SHA n'apparaitrait alors jamais. Un build d'un
# commit qui ne contient pas le notre ne prouve rien et n'est jamais retenu.
DEPOT=$(git remote get-url origin | sed -E 's#.*github\.com[:/]##; s#\.git$##')
BUILD_DELAI_MAX=${BUILD_DELAI_MAX:-600}

attendre_build() {
  local sha="$1" etape="$2" t0=$SECONDS
  echo "   build Pages attendu pour ${sha:0:7} ($etape)"
  while :; do
    local lignes statut commit_du_build erreur retenu=""
    lignes=$(gh api "repos/$DEPOT/pages/builds?per_page=30" \
             --jq '.[] | "\(.commit)\t\(.status)\t\(.error.message // "")"' 2>/dev/null || true)
    while IFS=$'\t' read -r commit_du_build statut erreur; do
      [ -z "${commit_du_build:-}" ] && continue
      # Ce build contient-il notre commit ? Lui-meme, ou un descendant.
      if [ "$commit_du_build" != "$sha" ]; then
        git merge-base --is-ancestor "$sha" "$commit_du_build" 2>/dev/null || continue
      fi
      retenu="$commit_du_build"
      case "$statut" in
        built)
          if [ "$commit_du_build" = "$sha" ]; then
            echo "   build REUSSI pour ${sha:0:7} (${SECONDS}s)"
          else
            echo "   build REUSSI pour ${commit_du_build:0:7}, qui contient ${sha:0:7} (${SECONDS}s)"
          fi
          return 0;;
        errored|cancelled|failure)
          echo "ARRET : build Pages en echec pour ${commit_du_build:0:7} — ${erreur:-aucun message}."
          echo "   La production sert encore la version precedente."
          echo "   Relancer en poussant un commit, ou depuis l'onglet Pages du depot."
          return 1;;
      esac
      break
    done <<< "$lignes"
    if [ $((SECONDS - t0)) -ge "$BUILD_DELAI_MAX" ]; then
      echo "ARRET : aucun build termine pour ${sha:0:7} apres ${BUILD_DELAI_MAX}s."
      echo "   Etat du dernier build retenu : ${retenu:+${retenu:0:7} }${statut:-aucun}."
      echo "   Ne PAS considerer la publication comme faite."
      return 1
    fi
    sleep 10
  done
}

echo "== 1/9  Non-regression du controle lui-meme =="
# Un garde-fou qui s'est mis a taire les fautes est pire que pas de garde-fou :
# on verifie d'abord qu'il alerte ET qu'il se tait quand il faut.
python3 deploy/tests/test_verifie_fortress.py >/dev/null || {
  echo "ARRET : le controle ne se comporte plus comme prevu (lancer le test pour voir)."; exit 1; }
echo "   controle conforme"

echo "== 2/9  Controle de la forteresse statique =="
python3 deploy/verifie-fortress.py || { echo "ARRET : corriger les points bloquants."; exit 1; }

echo "== 3/9  Empreintes de contenu (cache-bust) et balises =="
python3 deploy/cache-bust.py
python3 deploy/csp-studio.py      || true
python3 deploy/csp-nano-worlds.py || true
python3 deploy/inject-beacon.py   || true
# Le sitemap est REGENERE ici, jamais ecrit a la main : au 10/09 il declarait
# 14 adresses pour 81 pages publiques. Voir deploy/genere-sitemap.py pour la
# regle d'inclusion (canonique, indexable, pas une redirection).
python3 deploy/genere-sitemap.py

echo "== 4/9  Publication des ASSETS (js, css, images, fontes) =="
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
EXT='\.(js|css|png|jpg|jpeg|svg|webp|woff2|ico)$'
SUPPRIMES=$(git ls-files -d | grep -Ei "$EXT" || true)
if [ -n "$SUPPRIMES" ]; then
  echo "ARRET : suppression d'asset detectee dans ce lot."
  echo "$SUPPRIMES" | sed "s/^/   /"
  echo "   Un HTML en cache peut encore reclamer ce fichier."
  echo "   Publier l'ajout d'abord, supprimer dans un lot ULTERIEUR."
  exit 1
fi
# 29/08, troisieme defaut de cette etape : `git ls-files -mo` enumere les
# fichiers MODIFIES et les NON SUIVIS. Un fichier NEUF deja mis en scene
# (`git add`) n'est ni l'un ni l'autre : il tombait dans un angle mort et
# n'etait jamais pousse. Constate sur presentation.js, dont le commit
# « (assets) » ne contenait que styles.css, ce qui a fait attendre l'etape 5
# jusqu'a l'echec pour un fichier qui n'existait nulle part. On ajoute donc les
# ajouts et modifications DEJA en scene.
ASSETS=$( { git ls-files -mo --exclude-standard
            git diff --cached --name-only --diff-filter=ACMR; } \
          | sort -u | grep -Ei "$EXT" || true )
if [ -n "$ASSETS" ]; then
  echo "$ASSETS" | sed "s/^/   + /"
  echo "$ASSETS" | tr '\n' '\0' | xargs -0 git add --
fi
# On commit EXPLICITEMENT la liste d'assets, jamais l'index entier : si
# l'appelant a fait un `git add -A` avant de lancer ce script (arrive le
# 29/08), un `git commit` nu emporterait le HTML avec les assets et
# annulerait toute la publication en deux temps, sans un mot.
AUTRES=$(git diff --cached --name-only | grep -Ev "$EXT" || true)
if [ -n "$AUTRES" ]; then
  echo "   note : $(echo "$AUTRES" | wc -l | tr -d ' ') fichier(s) non-asset deja en scene, ils attendront l'etape 6"
fi
if [ -n "$ASSETS" ]; then
  echo "$ASSETS" | tr '\n' '\0' | xargs -0 git commit -q -m "$MSG (assets)" --
  git push -q origin main
  SHA_ASSETS=$(git rev-parse HEAD)
  echo "   assets pousses (${SHA_ASSETS:0:7}), attente de leur mise en ligne..."
  attendre_build "$SHA_ASSETS" "assets" || exit 1
else
  echo "   aucun asset modifie"
fi

echo "== 5/9  Verification que la prod sert bien le CONTENU attendu =="
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

echo "== 6/9  Publication des PAGES =="
git add -A
PAGES_POUSSEES=non
if ! git diff --cached --quiet; then
  git commit -q -m "$MSG"
  git push -q origin main
  SHA_PAGES=$(git rev-parse HEAD)
  PAGES_POUSSEES=oui
  echo "   pages poussees (${SHA_PAGES:0:7})"
else
  echo "   aucune page modifiee"
fi

echo "== 7/9  Build GitHub Pages du commit pousse =="
if [ "$PAGES_POUSSEES" = oui ]; then
  attendre_build "$SHA_PAGES" "pages" || exit 1
else
  echo "   rien a attendre"
fi

echo "== 8/9  Les pages servies sont-elles CELLES DU DEPOT ? =="
# Un build reussi dit que GitHub a construit, pas que le visiteur recoit la
# bonne page. On compare donc l'empreinte du corps servi a celle du fichier
# local, l'injection Cloudflare mise a part. Un 200 ne prouve rien : c'est
# exactement ce que repondait la page perimee du 08/10.
if [ "$PAGES_POUSSEES" = oui ]; then
  for i in $(seq 1 10); do
    if python3 deploy/verifie-pages-servies.py; then break; fi
    [ "$i" = "10" ] && { echo "ARRET : la production ne sert pas les pages de ce commit."
                         echo "   Build reussi mais contenu perime : ne pas considerer la publication comme faite."
                         exit 1; }
    echo "   nouvelle tentative ($i/10)"
    sleep 15
  done
else
  echo "   rien a verifier"
fi

echo "== 9/9  Controle du sitemap en production =="
# Apres publication seulement : ces adresses sont deja en ligne, les sonder ne
# peut donc pas empoisonner un cache. Bloquant : un sitemap qui annonce une
# adresse morte ou non canonique fait perdre confiance dans le fichier entier.
for i in $(seq 1 8); do
  if python3 deploy/verifie-sitemap.py; then break; fi
  [ "$i" = "8" ] && { echo "ARRET : le sitemap publie annonce des adresses qui ne tiennent pas."; exit 1; }
  echo "   nouvelle tentative ($i/8)"
  sleep 20
done

echo "TERMINE."
