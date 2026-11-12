#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Cartes de partage (og:image 1200 x 630) et balises Open Graph du portail (12/11).

Pourquoi : 72 pages indexables sur 84 n'avaient pas d'og:image, un lien partage
(LinkedIn, WhatsApp, iMessage) s'affichait sans vignette. Regle : uniquement des
visuels REELS des projets. Une page sans visuel propre recoit l'image generique
du site (img/og-image.jpg), jamais une image fabriquee.

Produit, pour chaque page listee dans VISUELS : un fichier og-<source>.jpg
1200 x 630 a cote du visuel source (paysage : recadrage centre ; portrait : fond flou issu
de la meme photo, photo entiere au centre). Puis complete le <head> des pages
du sitemap qui n'ont pas d'og:image : og:type, og:site_name, og:title (depuis
<title>), og:description (depuis la meta description), og:image, og:url,
twitter:card. Les balises deja presentes ne sont jamais reecrites.
Relancable sans effet si rien ne manque.
"""
import os, re, sys, html
from PIL import Image, ImageFilter

RACINE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SITE = 'https://deligny-rd.fr'
W, H = 1200, 630

# page -> visuel source (chemin depuis la racine). og.jpg est ecrit a cote.
VISUELS = {
    'montre-3d-studio/index.html': 'portfolio/img/Pattern-watch/00.jpg',
    'lampe-3d-studio/index.html': 'lampe-3d-studio/media/gal01.png',
    'lampe-3d-studio/gamme.html': 'lampe-3d-studio/media/gal01.png',
    'lampe-3d-studio/cgv.html': 'lampe-3d-studio/media/gal01.png',
    'lampe-3d-studio/dune.html': 'lampe-3d-studio/media/dune-hero.png',
    'logiciels/lampe-designer.html': 'img/screenshots/lampe-designer.jpg',
    'logiciels.html': 'img/screenshots/atlas-vue-normale-20261105b.jpg',
    'reponses/atlas.html': 'img/screenshots/atlas-vue-normale-20261105b.jpg',
    'logiciels/rc-world.html': 'img/rc-world.jpg',
    'art/achat-vente/index.html': 'art/verify/DLG-ART-2026-UV9R-M7NP/oeuvre.jpg',
    'art/galerie-3d/index.html': 'art/verify/DLG-ART-2026-UV9R-M7NP/oeuvre.jpg',
    'art/avis/index.html': 'art/verify/DLG-ART-2026-UV9R-M7NP/oeuvre.jpg',
    'art/claim/index.html': 'art/verify/DLG-ART-2026-UV9R-M7NP/oeuvre.jpg',
    'art/echange/index.html': 'art/verify/DLG-ART-2026-UV9R-M7NP/oeuvre.jpg',
    'art/proprietaire/index.html': 'art/verify/DLG-ART-2026-UV9R-M7NP/oeuvre.jpg',
    'art/s/index.html': 'art/verify/DLG-ART-2026-UV9R-M7NP/oeuvre.jpg',
}
# Planches du portfolio : premiere image de la galerie.
for f in sorted(os.listdir(os.path.join(RACINE, 'portfolio'))):
    if f.endswith('.html') and f != 'index.html':
        nom = f[:-5]
        for cand in ('00.jpg', '01.jpg'):
            src = os.path.join('portfolio', 'img', nom, cand)
            if os.path.exists(os.path.join(RACINE, src)):
                VISUELS['portfolio/' + f] = src
                break


def carte(src):
    """og.jpg 1200x630 a cote de src ; retourne son chemin relatif."""
    # og-<nom de la source>.jpg : deux sources d'un meme dossier ne doivent pas
    # partager une carte (img/screenshots : atlas ET lampe-designer).
    out = os.path.join(os.path.dirname(src), 'og-' + os.path.splitext(os.path.basename(src))[0] + '.jpg')
    if os.path.exists(os.path.join(RACINE, out)):
        return out
    im = Image.open(os.path.join(RACINE, src)).convert('RGB')
    w, h = im.size
    if w / h >= 1.45:
        s = max(W / w, H / h)
        im2 = im.resize((round(w * s), round(h * s)), Image.LANCZOS)
        x = (im2.width - W) // 2; y = (im2.height - H) // 2
        res = im2.crop((x, y, x + W, y + H))
    else:
        s = max(W / w, H / h)
        fond = im.resize((round(w * s), round(h * s)), Image.LANCZOS)
        x = (fond.width - W) // 2; y = (fond.height - H) // 2
        fond = fond.crop((x, y, x + W, y + H)).filter(ImageFilter.GaussianBlur(28))
        s2 = min(W / w, H / h)
        av = im.resize((round(w * s2), round(h * s2)), Image.LANCZOS)
        fond.paste(av, ((W - av.width) // 2, (H - av.height) // 2))
        res = fond
    res.save(os.path.join(RACINE, out), quality=85, optimize=True)
    return out


def sitemap():
    t = open(os.path.join(RACINE, 'sitemap.xml'), encoding='utf-8').read()
    for u in re.findall(r'<loc>https://deligny-rd\.fr/([^<]*)</loc>', t):
        yield (u or 'index.html') if not u.endswith('/') else u + 'index.html'


def meta(t, nom, prop='property'):
    m = re.search(r'<meta %s="%s" content="([^"]*)"' % (prop, re.escape(nom)), t)
    return m.group(1) if m else None


def main():
    faits = 0
    for p in sitemap():
        chemin = os.path.join(RACINE, p)
        t = open(chemin, encoding='utf-8').read()
        if 'og:image' in t:
            continue
        titre = re.search(r'<title>(.*?)</title>', t, re.S)
        titre = html.unescape(re.sub(r'\s+', ' ', titre.group(1))).strip() if titre else 'DELIGNY R&D'
        desc = meta(t, 'description', 'name') or ''
        url = SITE + '/' + ('' if p == 'index.html' else p[:-10] if p.endswith('/index.html') else p)
        img = SITE + '/' + (carte(VISUELS[p]) if p in VISUELS else 'img/og-image.jpg')
        q = lambda s: html.escape(s, quote=True).replace('&amp;amp;', '&amp;')
        lignes = []
        if not meta(t, 'og:type'): lignes.append('<meta property="og:type" content="website" />')
        if not meta(t, 'og:site_name'): lignes.append('<meta property="og:site_name" content="DELIGNY R&amp;D" />')
        if not meta(t, 'og:title'): lignes.append('<meta property="og:title" content="%s" />' % q(titre))
        if desc and not meta(t, 'og:description'): lignes.append('<meta property="og:description" content="%s" />' % desc)
        lignes.append('<meta property="og:image" content="%s" />' % img)
        lignes.append('<meta property="og:image:width" content="1200" />')
        lignes.append('<meta property="og:image:height" content="630" />')
        if not meta(t, 'og:url'): lignes.append('<meta property="og:url" content="%s" />' % url)
        if not meta(t, 'twitter:card', 'name'): lignes.append('<meta name="twitter:card" content="summary_large_image" />')
        # indentation : celle de la balise <title>
        ind = re.search(r'^([ \t]*)<title>', t, re.M)
        ind = ind.group(1) if ind else '  '
        bloc = ''.join(ind + l + '\n' for l in lignes)
        if '</head>' not in t:
            print('SANS </head> :', p); continue
        t = t.replace('</head>', bloc + ind.rstrip(' ') + '</head>' if False else bloc + '</head>', 1)
        open(chemin, 'w', encoding='utf-8').write(t)
        faits += 1
        print('  %-48s %s' % (p, img.replace(SITE + '/', '')))
    print('pages completees :', faits)


if __name__ == '__main__':
    main()
