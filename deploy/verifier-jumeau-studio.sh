#!/usr/bin/env bash
# Le studio existe en DEUX exemplaires : ici (portail publie) et dans
# DESIGN:ART/GENERATIVE_DESIGN (copie canonique). Ils ont derive de 385 lignes
# entre septembre et le 15/10/2026 sans que personne ne le voie, au point qu'un
# correctif a du etre applique deux fois a la main.
# Ce controle refuse le silence : il compare les deux copies et dit ou elles
# different. A brancher en pre-push si besoin.
#   bash deploy/verifier-jumeau-studio.sh
set -uo pipefail

ICI="$(cd "$(dirname "$0")/.." && pwd)/lampe-3d-studio/index.html"
JUMEAU="${STUDIO_JUMEAU:-$HOME/Documents/Code/DESIGN:ART/GENERATIVE_DESIGN/lampe-3d-studio/index.html}"

[ -f "$ICI" ]     || { echo "copie du portail introuvable : $ICI"; exit 2; }
[ -f "$JUMEAU" ]  || { echo "copie canonique absente, controle ignore : $JUMEAU"; exit 0; }

if diff -q "$ICI" "$JUMEAU" >/dev/null; then
  echo "studio : les deux copies sont identiques"
  exit 0
fi

ECART=$(diff "$ICI" "$JUMEAU" | grep -c '^[<>]')
echo "STUDIO : LES DEUX COPIES ONT DIVERGE de $ECART ligne(s)."
echo "  portail   : $ICI"
echo "  canonique : $JUMEAU"
echo
echo "Premieres divergences :"
diff "$ICI" "$JUMEAU" | grep '^[<>]' | head -8 | cut -c1-110 | sed 's/^/   /'
echo
echo "Rapprocher avant de publier, sinon le correctif suivant devra etre"
echo "applique deux fois, comme le 15/10/2026."
exit 1
