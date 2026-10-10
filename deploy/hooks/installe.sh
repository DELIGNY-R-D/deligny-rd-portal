#!/usr/bin/env sh
# Installe les crochets git de ce depot.
#
# POURQUOI CE FICHIER EXISTE. Le crochet pre-commit vivait dans .git/hooks/,
# que git ne versionne pas : il n'existait donc que sur la machine ou il avait
# ete ecrit. Un clone neuf, une autre session, un autre poste : trois
# reparations automatiques absentes sans un mot, et des pages publiees sans
# leur empreinte CSP a jour, sans balise de mesure et sans ?v= de cache.
# Constate le 10/10/2026, en corrigeant un defaut du crochet qui n'aurait
# survecu nulle part ailleurs.
#
#     sh deploy/hooks/installe.sh
set -eu
R="$(git rev-parse --show-toplevel)"
for h in pre-commit; do
  cp "$R/deploy/hooks/$h" "$R/.git/hooks/$h"
  chmod +x "$R/.git/hooks/$h"
  echo "installe : .git/hooks/$h"
done
