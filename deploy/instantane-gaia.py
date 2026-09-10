#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""INSTANTANE GAIA POUR LA VITRINE PUBLIQUE.

Le globe du HUB interroge `/api/world/geo` en direct, sur 127.0.0.1:4567. Le
site public ne peut evidemment pas joindre cette adresse, et on ne creuse pas
de tunnel vers le reseau local pour une vitrine. On fige donc un instantane,
date, que la page publique affiche tel quel en le presentant comme tel.

CE QUI EST RETIRE, ET POURQUOI C'EST OBLIGATOIRE
------------------------------------------------
Le domaine `opportunites` n'est pas un signal du monde : c'est le carnet de
prospection de DELIGNY R&D. Il contient des SIREN, des adresses postales et
des raisons sociales qui sont, pour les entreprises individuelles, le NOM ET
L'ADRESSE d'une personne physique. Publier ce domaine reviendrait a mettre en
ligne un fichier de prospection nominatif. Il est ecarte ici, a la source, et
le controle en fin de script echoue si un seul point en rechappe.

Usage : python3 deploy/instantane-gaia.py   (le HUB doit tourner)
"""
import json, sys, urllib.request, os, re

HUB = 'http://127.0.0.1:4567/api/world/geo'
SORTIE = 'gaia/data/signaux.json'
INTERDITS = {'opportunites'}
# Une seconde barriere, par le contenu : meme si un domaine changeait de nom,
# ces clefs-la trahissent une fiche entreprise et ne doivent jamais sortir.
CLEFS_INTERDITES = {'siren', 'siret', 'adresse', 'code_postal', 'naf',
                    'tranche_effectif', 'commune'}

def propre(p):
    if p.get('domain') in INTERDITS:
        return False
    meta = p.get('meta') or {}
    return not (CLEFS_INTERDITES & set(meta.keys()))

try:
    brut = json.load(urllib.request.urlopen(HUB, timeout=15))
except Exception as e:
    sys.exit('HUB injoignable sur %s (%s). Lance-le, puis relance ce script.' % (HUB, e))

if not brut.get('available'):
    sys.exit('le HUB repond mais annonce available=false : pas de recolte a figer.')

points = [p for p in brut.get('points', []) if propre(p)]
# Les indicateurs SANS position (`globals`) ne sont pas repris : sur 157
# entrees, 105 sont la meme mesure de veille ERP repetee. Un globe montre ce
# qui a un lieu ; le reste alourdirait le fichier sans rien apprendre.

# On ne garde que ce que la page affiche vraiment. Un instantane public n'a pas
# a trainer des champs dont personne ne se sert.
def taille(p):
    return {'lat': round(p['lat'], 3), 'lon': round(p['lon'], 3),
            'domaine': p['domain'], 'mesure': p['metric'], 'lieu': p['entity'],
            'valeur': p['value'], 'unite': p.get('unit') or '',
            'source': p['source'], 'le': (p.get('at') or '')[:19]}

instantane = {
    'preleve_le': brut.get('generated_at'),
    'domaines': sorted({p['domain'] for p in points}),
    'points': [taille(p) for p in points],
}

texte = json.dumps(instantane, ensure_ascii=False, separators=(',', ':'))
# Controle de sortie : on relit ce qu'on s'apprete a ecrire. Une exclusion qui
# n'a jamais echoue n'est pas une exclusion qui marche.
for mot in list(CLEFS_INTERDITES) + ['opportunites']:
    if re.search(r'"%s"' % mot, texte):
        sys.exit('ARRET : « %s » est encore present dans le fichier de sortie.' % mot)

os.makedirs(os.path.dirname(SORTIE), exist_ok=True)
open(SORTIE, 'w', encoding='utf-8').write(texte)
print('%s : %d points retenus sur %d, %.0f Ko'
      % (SORTIE, len(points), len(brut.get('points', [])),
         os.path.getsize(SORTIE) / 1024))
print('domaines : ' + ', '.join(instantane['domaines']))
print('preleve le ' + str(instantane['preleve_le']))
