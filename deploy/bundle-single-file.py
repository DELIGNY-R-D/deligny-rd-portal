#!/usr/bin/env python3
"""Bundle nano-worlds/index.html + toutes ses dependances (vendor Three.js/
addons, modules .mjs locaux, worlds/default.json) en UN SEUL fichier HTML
autonome : publiable en Artifact claude.ai, ou n'importe ou sans serveur ni
fichiers voisins.

Usage : python3 deploy/bundle-single-file.py [DOSSIER_SOURCE] [FICHIER_SORTIE]
  defaut : DOSSIER_SOURCE = nano-worlds/ du depot, FICHIER_SORTIE = /tmp/nano-worlds-embed.html
  (la sortie fait ~4 Mo : on ne la commite pas).

Strategie (reutilisable pour tout outil Three.js a importmap + es-module-shims) :
es-module-shims resout l'importmap et va chercher chaque module via `fetch()`.
On patch `window.fetch` tres tot pour servir, depuis un manifeste JS inline,
les chemins locaux connus (vendor/*, *.mjs, worlds/default.json) et on laisse
passer tout le reste (appels optionnels externes, qui echouent deja
gracieusement dans le code d'origine). Aucune reecriture du script principal :
les specificateurs d'import restent identiques, seule la source des octets change.

Pieges resolus (a relire avant de reutiliser sur un autre outil) :
- es-module-shims ne prend en charge QUE les balises `type="module-shim"` /
  `type="importmap-shim"` : une balise native type="module" est executee par le
  navigateur, qui ira chercher ./vendor/... sur le reseau (404). On retype.
- `<meta charset="utf-8">` doit rester EN TETE du fragment : le code utilise des
  identifiants non-ASCII (θ, φ), sans charset le parseur JS casse.
- Le publieur Artifact refuse tout U+FFFD : la source en a 4 dans un commentaire
  mojibake, corriges ici seulement (le fix propre est dans la source).
- La sortie est un FRAGMENT (pas de <!doctype>/<html>/<head>/<body>) : l'Artifact
  enveloppe lui-meme ; <title> dans les 8 premiers Ko, donc avant le manifeste.
- CSP Artifact verifiee le 18/08 : blob: module scripts OK, WebGL OK,
  connect-src 'self' (pas de fetch(blob:), donc on repond depuis le manifeste
  sans fetch reel).
"""
import json
import os

import sys

_DEPOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(_DEPOT, "nano-worlds")
OUT = sys.argv[2] if len(sys.argv) > 2 else "/tmp/nano-worlds-embed.html"


def read(rel_path, binary=False):
    mode = "rb" if binary else "r"
    kwargs = {} if binary else {"encoding": "utf-8"}
    with open(os.path.join(ROOT, rel_path), mode, **kwargs) as f:
        return f.read()


ASSET_FILES = [
    "vendor/three.module.js",
    "vendor/jsm/controls/OrbitControls.js",
    "vendor/jsm/geometries/RoundedBoxGeometry.js",
    "vendor/jsm/math/SimplexNoise.js",
    "vendor/jsm/postprocessing/EffectComposer.js",
    "vendor/jsm/postprocessing/MaskPass.js",
    "vendor/jsm/postprocessing/OutputPass.js",
    "vendor/jsm/postprocessing/Pass.js",
    "vendor/jsm/postprocessing/RenderPass.js",
    "vendor/jsm/postprocessing/SMAAPass.js",
    "vendor/jsm/postprocessing/SSAOPass.js",
    "vendor/jsm/postprocessing/ShaderPass.js",
    "vendor/jsm/postprocessing/UnrealBloomPass.js",
    "vendor/jsm/shaders/CopyShader.js",
    "vendor/jsm/shaders/LuminosityHighPassShader.js",
    "vendor/jsm/shaders/OutputShader.js",
    "vendor/jsm/shaders/SMAAShader.js",
    "vendor/jsm/shaders/SSAOShader.js",
    "vendor/jsm/utils/BufferGeometryUtils.js",
    "vehicle_factory.mjs",
    "nano_car.mjs",
    "vehicle_physics_profile.mjs",
    "camera_runtime_profile.mjs",
    "touch_runtime_profile.mjs",
    "arena_mechanics.mjs",
    "worlds/default.json",
]

CLASSIC_SCRIPTS = [
    ("_chronicle_module.js?v=4f22a19c", "_chronicle_module.js"),
    ("_worldstate_module.js?v=f9f5b00d", "_worldstate_module.js"),
    ("_biomes_dynamiques.js?v=2cf7846a", "_biomes_dynamiques.js"),
    ("_multiscale_transition.js?v=543c5420", "_multiscale_transition.js"),
]


def js_escape_for_inline(src: str) -> str:
    return src.replace("</script", "<\\/script")


def main():
    assets = {k: read(k) for k in ASSET_FILES}
    assets_json = json.dumps(assets, ensure_ascii=False)
    assets_json = assets_json.replace("</script", "<\\/script")

    # Journal de demarrage visible a l'ecran : dans le sandbox Artifact on n'a acces ni a la
    # console ni au DOM de l'iframe depuis l'exterieur. Se masque tout seul quand le moteur
    # a demarre (#load disparu) ; reste affiche s'il y a une erreur ou une violation CSP.
    bootlog_script = (
        "<script>\n"
        "(function(){\n"
        "  var box=null, lines=[], hadError=false;\n"
        "  function ensure(){ if(box) return box; box=document.createElement('pre'); box.id='__nwboot';\n"
        "    box.style.cssText='position:fixed;left:8px;bottom:8px;z-index:99999;max-width:60vw;max-height:40vh;overflow:auto;'+\n"
        "      'background:rgba(0,0,0,.75);color:#9fe;font:11px/1.35 monospace;padding:6px 8px;border-radius:6px;margin:0;white-space:pre-wrap;pointer-events:none';\n"
        "    (document.body||document.documentElement).appendChild(box); return box; }\n"
        "  function log(m){ lines.push(m); try{ ensure().textContent=lines.join('\\n'); }catch(e){} }\n"
        "  window.__nwlog=log;\n"
        "  window.addEventListener('error',function(e){ hadError=true; log('ERR '+(e.message||'')+' @'+(e.lineno||'?')+':'+(e.colno||'?')); },true);\n"
        "  window.addEventListener('unhandledrejection',function(e){ hadError=true; log('REJ '+(e.reason&&e.reason.message||String(e.reason))); });\n"
        "  document.addEventListener('securitypolicyviolation',function(e){ hadError=true; log('CSP '+e.violatedDirective+' blocked='+String(e.blockedURI||'').slice(0,90)); });\n"
        "  document.addEventListener('DOMContentLoaded',function(){ log('DOM pret'); });\n"
        "  var t0=Date.now(); var iv=setInterval(function(){\n"
        "    var l=document.getElementById('load'); var c=document.querySelector('canvas');\n"
        "    var done = l && getComputedStyle(l).display==='none';\n"
        "    if(done){ clearInterval(iv); if(box) box.remove(); return; }\n"   # moteur demarre : le journal a fait son office, meme si des ressources optionnelles ont fait 404
        "    if(Date.now()-t0>60000){ clearInterval(iv); }\n"
        "  },500);\n"
        "  log('boot: script inline OK');\n"
        "})();\n"
        "</script>\n"
    )

    patch_script = (
        bootlog_script +
        "<script>\n"
        "window.esmsInitOptions = {shimMode: true};\n"
        "window.__NW_FORCE_DEFAULT_WORLD = true;\n"   # equivalent de ?world=default (l'URL de l'iframe Artifact n'est pas a nous)

        "window.__NW_ASSETS__ = " + assets_json + ";\n"
        "(function(){\n"
        "  var ASSETS = window.__NW_ASSETS__;\n"
        "  var keys = Object.keys(ASSETS);\n"
        "  var origFetch = window.fetch ? window.fetch.bind(window) : null;\n"
        "  window.fetch = function(input, init){\n"
        "    try {\n"
        "      var url = (typeof input === 'string') ? input : (input && input.url) || '';\n"
        "      var path = url;\n"
        "      try { path = new URL(url, document.baseURI).pathname; } catch(e){}\n"
        "      for (var i=0;i<keys.length;i++) {\n"
        "        var key = keys[i];\n"
        "        if (path === key || path.endsWith('/'+key) || url === key || url.endsWith(key)) {\n"
        "          var body = ASSETS[key];\n"
        "          var ct = key.endsWith('.json') ? 'application/json' : 'text/javascript';\n"
        "          return Promise.resolve(new Response(body, {status:200, statusText:'OK', headers:{'Content-Type': ct}}));\n"
        "        }\n"
        "      }\n"
        "    } catch(e){}\n"
        "    return origFetch ? origFetch(input, init) : Promise.reject(new Error('fetch indisponible'));\n"
        "  };\n"
        "  if(window.__nwlog) window.__nwlog('manifeste: '+keys.length+' fichiers, fetch patche');\n"
        "})();\n"
        "</script>\n"
    )

    es_shims_src = read("vendor/es-module-shims.js")
    es_shims_inline = ("<script>if(window.__nwlog)window.__nwlog('HTML: corps analyse, chargement du shim');</script>\n"
                       "<script>\n" + js_escape_for_inline(es_shims_src) + "\n</script>\n"
                       "<script>if(window.__nwlog)window.__nwlog('shim charge, lancement du module');</script>\n")

    html = read("index.html")

    # 1) CSP meta d'origine (taillee pour deligny-rd.fr) : retiree, l'Artifact impose la sienne.
    csp_needle = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; base-uri \'none\'; frame-ancestors \'none\'; form-action \'none\'; img-src \'self\' data: https://atlas-studio.pro; style-src-elem \'unsafe-inline\'; style-src-attr \'unsafe-inline\'; script-src-elem \'self\' blob: \'unsafe-inline\'; script-src-attr \'unsafe-inline\'; connect-src \'self\' https://api.openai.com https://atlas-studio.pro">\n'
    assert csp_needle in html, "CSP meta introuvable"
    html = html.replace(csp_needle, "")

    # 2) liens manifest/icones vers des fichiers non embarques : retires (favicon gere par l'Artifact).
    for needle in [
        '<link rel="manifest" href="manifest.json">\n',
        '<link rel="apple-touch-icon" href="icon-180.png">\n',
        '<link rel="icon" href="icon.svg" type="image/svg+xml">\n',
    ]:
        assert needle in html, f"lien introuvable : {needle!r}"
        html = html.replace(needle, "")

    # 3) patch fetch() insere juste apres <meta charset>, avant TOUT le reste.
    charset_needle = '<meta charset="utf-8">\n'
    assert charset_needle in html
    html = html.replace(charset_needle, charset_needle + patch_script, 1)

    # 4) es-module-shims charge en <script async src=...> -> inline (le src= classique ne passe pas par fetch()).
    shim_needle = '<script async src="./vendor/es-module-shims.js?v=cccb3be3"></script>\n'
    assert shim_needle in html, "balise es-module-shims introuvable"
    html = html.replace(shim_needle, es_shims_inline)

    # 4b) es-module-shims ne prend en charge QUE les balises typees *-shim : une balise native
    #     type="module"/type="importmap" est executee directement par le navigateur, qui va
    #     alors chercher ./vendor/... sur le reseau (404) sans jamais passer par notre fetch().
    #     On retype donc l'importmap et le module principal en versions -shim.
    importmap_needle = '<script type="importmap">\n{ "imports": {'
    assert importmap_needle in html, "importmap introuvable"
    html = html.replace(importmap_needle, '<script type="importmap-shim">\n{ "imports": {', 1)
    module_needle = "</script>\n<script type=\"module\">\nimport * as THREE from 'three';"
    assert module_needle in html, "module principal introuvable"
    html = html.replace(module_needle, "</script>\n<script type=\"module-shim\">\nimport * as THREE from 'three';", 1)

    # 5) les 4 scripts classiques de fin (_chronicle_module.js etc.) -> inline directement.
    for tag_suffix, filename in CLASSIC_SCRIPTS:
        needle = f'<script src="{tag_suffix}"></script>'
        assert needle in html, f"balise introuvable : {needle}"
        content = read(filename)
        replacement = "<script>\n" + js_escape_for_inline(content) + "\n</script>"
        html = html.replace(needle, replacement)

    # 5b) ?world=default force par drapeau : dans l'iframe Artifact, location.search appartient au
    #     conteneur (jeton __frame_t), on ne peut pas y ajouter de parametre.
    world_needle = "if(/[?&#]world=default/i.test(location.search+location.hash) && typeof loadDefaultWorld==='function') setTimeout(loadDefaultWorld,700);"
    assert html.count(world_needle) == 1, "test ?world=default introuvable ou multiple"
    html = html.replace(world_needle,
        "if((window.__NW_FORCE_DEFAULT_WORLD || /[?&#]world=default/i.test(location.search+location.hash)) && typeof loadDefaultWorld==='function') setTimeout(loadDefaultWorld,700);")

    # 6) pixel de mesure d'audience deligny-rd.fr : hors-sujet dans un Artifact autonome.
    beacon_needle = '<img src="https://atlas-studio.pro/deligny/api/px?page=index" alt="" width="1" height="1" style="position:absolute;left:-9999px" loading="eager">\n'
    assert beacon_needle in html, "beacon introuvable"
    html = html.replace(beacon_needle, "")

    # 7) Fragment pour l'Artifact : le publieur enveloppe lui-meme dans <!doctype>/<html>/<head>/<body>.
    #    On garde <title> EN TETE (il doit tomber dans les 8 premiers Ko, avant le manifeste de 4 Mo).
    head_start = html.index("<head>") + len("<head>")
    head_end = html.index("</head>")
    head_inner = html[head_start:head_end]
    body_start = html.index("<body>") + len("<body>")
    body_end = html.rindex("</body>")
    body_inner = html[body_start:body_end]

    title_tag = "<title>Nano Worlds</title>\n"
    assert title_tag in head_inner
    head_inner = head_inner.replace(title_tag, "", 1)
    # <meta charset> deja pose par le publieur ; les meta PWA/viewport sont inutiles dans un iframe.
    for needle in [
        '<meta charset="utf-8">\n',
        '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">\n',
        '<meta name="apple-mobile-web-app-capable" content="yes">\n',
        '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n',
        '<meta name="apple-mobile-web-app-title" content="Nano Worlds">\n',
        '<meta name="theme-color" content="#0b0e13">\n',
    ]:
        assert needle in head_inner, f"meta introuvable : {needle!r}"
        head_inner = head_inner.replace(needle, "", 1)

    # <meta charset> garde EN TETE (avant tout, dans les 1024 premiers octets) : le module principal
    # utilise des identifiants non-ASCII (θ, φ...) ; sans charset explicite le source est decode en
    # Latin-1 et le parseur JS s'arrete sur "Invalid or unexpected token". Doublon inoffensif si le
    # publieur en pose deja un.
    fragment = '<meta charset="utf-8">\n' + title_tag + head_inner.strip("\n") + "\n" + body_inner.strip("\n") + "\n"

    # 8) Le publieur refuse tout U+FFFD. La source en contient 4, dans UN commentaire mojibake
    #    ("m�tadonn�es l�g�res" = "metadonnees legeres"). On le repare ici seulement.
    moji = "m�tadonn�es l�g�res"
    assert fragment.count("�") == 4 and moji in fragment, "U+FFFD inattendu ailleurs que le commentaire connu"
    fragment = fragment.replace(moji, "metadonnees legeres")
    assert "�" not in fragment

    with open(OUT, "w", encoding="utf-8") as f:
        f.write(fragment)
    html = fragment

    print(f"OK -> {OUT} ({len(html)/1024/1024:.2f} Mo, {len(html.splitlines())} lignes)")


if __name__ == "__main__":
    main()
