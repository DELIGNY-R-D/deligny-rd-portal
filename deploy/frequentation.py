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
         "or ref_host like '192.168.%' or page like 'sonde-%')")


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


# --------------------------------------------------------------------- digest
#
# POURQUOI UN SECOND MODE. `main` compte. Compter ne dit pas quoi changer : avec
# 289 evenements sur l'accueil et 10 sur la page contact, le probleme n'est pas
# le volume, c'est que personne n'avance. Le digest mesure donc l'ENTONNOIR et
# la TENDANCE, et n'enonce que des constats mecaniques, jamais une histoire
# inventee sur ce que « veulent » les visiteurs.
#
# Les memes trois precautions qu'en haut de fichier valent ici, et la premiere
# ligne du rapport les rappelle : une ligne n'est pas une visite, une empreinte
# n'est pas une personne, et sans referent on ne peut pas trancher entre un
# humain et un robot.

ACCUEIL = ("index",)


def _periode(c, debut, fin):
    """Les chiffres d'une fenetre [debut, fin], referents locaux ecartes."""
    ou = "type='vue' and jour > ? and jour <= ? and not " + LOCAL

    def q(s, *a):
        return c.execute(s, a).fetchall()

    r = q("select count(*) e, count(distinct empreinte) u from events where " + ou,
          debut, fin)[0]
    exterieur = q("select count(distinct empreinte) u, count(*) e from events where " + ou +
                  " and ref_host is not null and ref_host<>''", debut, fin)[0]
    sans = q("select count(distinct empreinte) u from events where " + ou +
             " and (ref_host is null or ref_host='')", debut, fin)[0]["u"]
    pages = {x["p"]: x for x in q(
        "select page p, count(*) e, count(distinct empreinte) u from events where " + ou +
        " group by p", debut, fin)}
    refs = q("select ref_host h, count(distinct empreinte) u from events where " + ou +
             " and ref_host is not null and ref_host<>'' group by h order by u desc",
             debut, fin)
    return {"evenements": r["e"], "empreintes": r["u"], "exterieur": exterieur["u"],
            "exterieur_evenements": exterieur["e"], "sans_referent": sans,
            "pages": pages, "referents": refs}


def _messages(c, debut, fin):
    """Des messages recus par le formulaire : la seule conversion mesurable."""
    try:
        n = c.execute("select count(*) from pending where type='message' "
                      "and date(cree,'unixepoch') > ? and date(cree,'unixepoch') <= ?",
                      (debut, fin)).fetchone()[0]
    except Exception:
        return None
    return n


def _fleche(a, b):
    if b is None or a is None:
        return ""
    if a == b:
        return "  (stable)"
    return "  (%+d)" % (a - b)


def digest(jours=7, labels=None):
    c = sqlite3.connect(DB)
    c.row_factory = sqlite3.Row
    fin = c.execute("select max(jour) from events").fetchone()[0]
    debut = c.execute("select date(?, ?)", (fin, "-%d days" % jours)).fetchone()[0]
    avant = c.execute("select date(?, ?)", (debut, "-%d days" % jours)).fetchone()[0]
    a = _periode(c, debut, fin)
    b = _periode(c, avant, debut)
    msg = _messages(c, debut, fin)
    msg_avant = _messages(c, avant, debut)

    L = []
    L.append("FREQUENTATION DU PORTAIL — %s au %s (%d jours)" % (debut, fin, jours))
    L.append("Comparaison avec les %d jours precedents, %s au %s." % (jours, avant, debut))
    L.append("")
    L.append("Une ligne n'est pas une visite, une empreinte n'est pas une personne,")
    L.append("et sans referent on ne distingue pas un humain d'un robot.")
    L.append("")
    L.append("CE QUI EST SUR")
    L.append("  %d empreinte(s)-jour arrivees par un lien exterieur%s" %
             (a["exterieur"], _fleche(a["exterieur"], b["exterieur"])))
    for r in a["referents"]:
        L.append("      %-28s %d" % (r["h"], r["u"]))
    if not a["referents"]:
        L.append("      aucun : personne n'est arrive par un moteur ni par un lien")
    L.append("")
    L.append("CE QUI EST AMBIGU")
    L.append("  %d empreinte(s)-jour sans referent%s : acces direct, robots et outils melanges" %
             (a["sans_referent"], _fleche(a["sans_referent"], b["sans_referent"])))
    L.append("")
    L.append("ENTONNOIR, en empreintes DISTINCTES par etape")
    ou = "type='vue' and jour > ? and jour <= ? and not " + LOCAL

    def distinctes(cond, *extra):
        return c.execute("select count(distinct empreinte) from events where " + ou +
                         " and " + cond, (debut, fin) + extra).fetchone()[0]

    toutes = distinctes("1=1")
    accueil = distinctes("page in ('index')")
    autres = distinctes("page not in ('index')")
    contact = distinctes("page='contact'")
    etapes = [("a vu une page", toutes), ("dont l'accueil", accueil),
              ("dont une autre page", autres), ("dont la page contact", contact)]
    if msg is not None:
        etapes.append(("a envoye un message", msg))
    base = toutes or 1
    for nom, n in etapes:
        L.append("  %-22s %4d   %5.1f %%" % (nom, n, 100.0 * n / base))
    L.append("")
    L.append("PAGES QUI ATTIRENT, hors accueil")
    tri = sorted(((v["u"], k) for k, v in a["pages"].items() if k not in ACCUEIL), reverse=True)
    for u, k in tri[:8]:
        av = b["pages"].get(k, {"u": 0})["u"]
        L.append("  %-30s %3d%s" % (k[:30], u, _fleche(u, av)))
    if not tri:
        L.append("  aucune")
    if labels:
        jamais = sorted(set(labels) - set(a["pages"]))
        L.append("")
        L.append("PAGES PUBLIEES SANS AUCUNE VUE SUR LA PERIODE : %d sur %d"
                 % (len(jamais), len(labels)))
        L.append("  " + ", ".join(jamais[:12]) + (" ..." if len(jamais) > 12 else ""))
    L.append("")
    L.append("CONSTATS MECANIQUES")
    faits = []
    if a["exterieur"] == 0:
        faits.append("Aucune arrivee par un lien exterieur : le site n'est pas trouve.")
    if contact and msg == 0:
        faits.append("La page contact a ete vue %d fois et aucun message n'est parti : "
                     "conversion nulle." % contact)
    if msg:
        faits.append("%d message(s) recu(s) par le formulaire." % msg)
    if toutes and autres < toutes * 0.5:
        faits.append("Moins de la moitie des empreintes ouvrent une page autre que "
                     "l'accueil : la premiere page ne donne pas envie d'avancer.")
    if labels and len(set(labels) - set(a["pages"])) > len(labels) * 0.5:
        faits.append("Plus de la moitie des pages publiees n'ont ete vues par personne : "
                     "le site est plus large que son audience.")
    if a["empreintes"] < b["empreintes"]:
        faits.append("Frequentation en baisse sur la periode.")
    for f in faits or ["Rien de notable."]:
        L.append("  - " + f)
    return "\n".join(L)


if __name__ == "__main__":
    args = [x for x in sys.argv[1:] if not x.startswith("--")]
    if "--digest" in sys.argv:
        etiquettes = None
        for x in sys.argv:
            if x.startswith("--labels="):
                etiquettes = [l.strip() for l in open(x.split("=", 1)[1]) if l.strip()]
        print(digest(int(args[0]) if args else 7, etiquettes))
    else:
        main(int(args[0]) if args else 30)
