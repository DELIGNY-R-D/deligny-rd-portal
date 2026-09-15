#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""COUVERTURES CARREES DU PORTFOLIO (15/09).

Trois tentatives dans le navigateur ont echoue pour une raison simple :
- `cover` rogne les objets plus longs que le carre (Strate, Le Papillon) ;
- `contain` laisse des bandes, et une bande de couleur unie se voit des qu'une
  photo a du grain (Lock center caps) ou un degrade (Bellows) ;
- `object-position` ne deplace l'image que dans UN sens : impossible de
  recentrer K2 horizontalement dans une photo en hauteur.

On produit donc de VRAIES images carrees, une par piece : un carre choisi sur
l'objet (il peut deborder de la photo), et le debord rempli en prolongeant le
bord de la photo, lisse pour qu'un detail qui touche le bord (un cable, une
main) ne se change pas en rayure. La page n'a plus rien a recadrer.

Chaque boite est (centre_x, centre_y, cote) en pixels de l'image d'origine.
Les originaux `cover.jpg` ne sont PAS supprimes : un HTML en cache peut encore
les demander.
"""
import os
from PIL import Image, ImageFilter

RACINE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'portfolio', 'img')
SORTIE = 'cover-carre.jpg'
COTE_MAX = 800

def portrait(W, H, pos):
    """Carre de la largeur, descendu de `pos` % dans la hauteur disponible."""
    return (W / 2, W / 2 + (H - W) * pos / 100, W)

BOITES = {
    # en largeur, ou objet a recentrer : boites mesurees sur l'objet
    'K2':               ('cover.jpg', lambda W, H: (240, 290, 450)),
    'Lock-center-caps': ('cover.jpg', lambda W, H: (290, 264.5, 529)),
    'Bellows':          ('04.jpg',    lambda W, H: (650, 508, 1016)),
    'Granular':         ('02.jpg',    lambda W, H: (470, 830, 1120)),
    'Strate':           ('cover.jpg', lambda W, H: (305, 232, 470)),
    'Le-Papillon':      ('cover.jpg', lambda W, H: (304, 270, 600)),
    'La-Factory':       ('cover.jpg', lambda W, H: (297, 199.5, 399)),
    'Toge':             ('cover.jpg', lambda W, H: (300, 192, 400)),
    'Fanzine':          ('cover.jpg', lambda W, H: (305, 230, 460)),
    # en hauteur : carre de la largeur, cadre choisi sur l'objet
    'Pattern-watch':     ('cover.jpg', lambda W, H: portrait(W, H, 55)),
    'Plis':              ('cover.jpg', lambda W, H: portrait(W, H, 50)),
    'K1-Kinetic':        ('cover.jpg', lambda W, H: portrait(W, H, 85)),
    'L1-Marble':         ('cover.jpg', lambda W, H: portrait(W, H, 45)),
    'L3':                ('cover.jpg', lambda W, H: portrait(W, H, 50)),
    'L4C':               ('cover.jpg', lambda W, H: portrait(W, H, 75)),
    'Le-dirigeable':     ('cover.jpg', lambda W, H: portrait(W, H, 10)),
    'Moaroom-Paris':     ('cover.jpg', lambda W, H: portrait(W, H, 40)),
    'Palette-a-encres':  ('cover.jpg', lambda W, H: portrait(W, H, 50)),
    'Rotary-brush':      ('cover.jpg', lambda W, H: portrait(W, H, 25)),
    'Transparent-Watch': ('cover.jpg', lambda W, H: portrait(W, H, 56)),
    'Frankenstein-W1':   ('cover.jpg', lambda W, H: portrait(W, H, 50)),
    'Frankenstein-W2':   ('cover.jpg', lambda W, H: portrait(W, H, 50)),
    'Affiches':          ('cover.jpg', lambda W, H: portrait(W, H, 50)),
    'Tableaux':          ('cover.jpg', lambda W, H: portrait(W, H, 50)),
    'Stepdrive-230':     ('cover.jpg', lambda W, H: portrait(W, H, 39)),
}

def carre(im, cx, cy, cote):
    W, H = im.size
    cote = round(cote)
    x0, y0 = round(cx - cote / 2), round(cy - cote / 2)
    g, h = max(0, -x0), max(0, -y0)                       # debord gauche, haut
    d, b = max(0, x0 + cote - W), max(0, y0 + cote - H)   # debord droite, bas
    if g or h or d or b:
        # 1) on prolonge le bord de la photo (repetition de la derniere rangee)
        grand = Image.new('RGB', (W + g + d, H + h + b))
        grand.paste(im, (g, h))
        if g: grand.paste(im.crop((0, 0, 1, H)).resize((g, H)), (0, h))
        if d: grand.paste(im.crop((W - 1, 0, W, H)).resize((d, H)), (g + W, h))
        if h: grand.paste(grand.crop((0, h, W + g + d, h + 1)).resize((W + g + d, h)), (0, 0))
        if b: grand.paste(grand.crop((0, h + H - 1, W + g + d, h + H)).resize((W + g + d, b)), (0, h + H))
        # 2) on lisse UNIQUEMENT le debord : un cable ou une main qui touchait le
        #    bord deviendrait sinon une rayure nette sur toute la marge
        flou = grand.filter(ImageFilter.GaussianBlur(18))
        masque = Image.new('L', grand.size, 255)
        masque.paste(0, (g, h, g + W, h + H))
        masque = masque.filter(ImageFilter.GaussianBlur(4))
        grand = Image.composite(flou, grand, masque)
        im, x0, y0 = grand, x0 + g, y0 + h
    out = im.crop((x0, y0, x0 + cote, y0 + cote))
    if cote > COTE_MAX:
        out = out.resize((COTE_MAX, COTE_MAX), Image.LANCZOS)
    return out

for nom, (src, boite) in BOITES.items():
    chemin = os.path.join(RACINE, nom, src)
    im = Image.open(chemin).convert('RGB')
    cx, cy, cote = boite(*im.size)
    out = carre(im, cx, cy, cote)
    dest = os.path.join(RACINE, nom, SORTIE)
    out.save(dest, quality=86, optimize=True, progressive=True)
    print('%-18s %s %dx%d -> %s %dx%d' % (nom, src, im.size[0], im.size[1], SORTIE, *out.size))
