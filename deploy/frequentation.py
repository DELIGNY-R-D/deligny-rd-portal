#!/usr/bin/env python3
"""Frequentation du portail, mesuree par le pixel de deligny_art.

A lancer SUR atlas-app : `sudo python3 frequentation.py [jours]`.

Pourquoi un script et pas une requete a la main : les mots comptent, et les
chiffres bruts induisent en erreur de trois facons.

1. Une ligne n'est pas une page vue. L'index unique
   `(jour, type, oeuvre, page, empreinte)` fait qu'un rechargement ne compte pas.
   On parle donc d'EVENEMENTS DEDUPLIQUES, pas de visites.
2. Une empreinte n'est pas une personne. Elle est salee par jour, volontairement,
   pour ne pas suivre quelqu'un dans le temps. On parle d'EMPREINTES-JOURS.
   Quelqu'un qui revient cinq jours compte cinq fois.
3. Ecarter les referents locaux ne suffit pas a isoler de vrais visiteurs : les
   robots et les visites sans referent restent dedans, et l'agent utilisateur
   n'est pas conserve. « Hors referent local » n'est donc PAS « exterieur ».
"""
import sqlite3
import sys

DB = "/opt/deligny_art/data/art.db"
LOCAL = ("(ref_host in ('localhost','127.0.0.1') or ref_host like '127.0.0.%' "
         "or ref_host like '192.168.%')")


def main(jours=30):
    c = sqlite3.connect(DB)
    c.row_factory = sqlite3.Row
    borne = c.execute("select date(max(jour), ?) from events",
                      ("-%d days" % jours,)).fetchone()[0]
    fin = c.execute("select max(jour) from events").fetchone()[0]
    ou = "type='vue' and jour > ? and not " + LOCAL

    def q(s, *a):
        return c.execute(s, a).fetchall()

    print("Du %s au %s, hors referent local\n" % (borne, fin))
    r = q("select count(*) e, count(distinct empreinte) u, count(distinct jour) j "
          "from events where " + ou, borne)[0]
    print("  %d evenements dedupliques" % r["e"])
    print("  %d empreintes-jours (pas des personnes)" % r["u"])
    print("  %d jours avec au moins un evenement" % r["j"])
    g = q("select count(*) n from events where " + ou + " and ref_host like '%google%'",
          borne)[0]["n"]
    sans = q("select count(*) n from events where " + ou +
             " and (ref_host is null or ref_host='')", borne)[0]["n"]
    print("  %d evenements avec referent Google" % g)
    print("  %d evenements sans referent (visiteurs directs, robots, outils melanges)" % sans)
    loc = q("select count(*) n from events where type='vue' and jour > ? and " + LOCAL,
            borne)[0]["n"]
    print("  %d evenements ecartes, referent local (developpement)" % loc)

    print("\nPar etiquette de page")
    for r in q("select case when page='' then '(sans etiquette)' else page end p, "
               "count(*) e, count(distinct empreinte) u from events where " + ou +
               " group by p order by e desc limit 15", borne):
        print("  %-26s %5d evenements  %3d empreintes-jours" % (r["p"], r["e"], r["u"]))

    # Avertissement tant que des pages partagent une etiquette : l'unicite par
    # (jour, page, empreinte) fusionne alors des pages DIFFERENTES vues le meme
    # jour par la meme empreinte. Ce n'est pas seulement mal attribue, c'est
    # SOUS-COMPTE, et le detail passe ne peut pas etre reconstitue.
    print("\nEtiquettes corrigees le 25/09/2026 : avant cette date, 24 pages")
    print("s'annoncaient « index » et 10 fiches « logiciels ». Les chiffres")
    print("anterieurs par page sont donc agreges ET sous-comptes.")


if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 30)
