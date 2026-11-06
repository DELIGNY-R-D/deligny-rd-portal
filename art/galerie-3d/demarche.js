/* Galerie 3D publique : bouton « La démarche », en haut à droite, et son panneau.
 *
 * Fichier autonome, propre au portail : il pose son style, son bouton et son panneau
 * lui-même. La page générée par l'atelier (galerie_publique.py) ne fait que le
 * charger, si bien qu'une nouvelle publication d'œuvre ne l'efface pas.
 * Rien hors du site : photos du portfolio, vidéos du dossier demarche/.
 * La politique de la page exige media-src 'self' pour les vidéos.
 */
(function () {
  "use strict";
  var racine = document.documentElement;
  if (!racine.classList.contains("publique")) return;                 // l'atelier n'a pas ce bouton
  var q = new URLSearchParams(location.search);
  if (q.has("embed") || q.has("capture") || q.has("carte")) return;   // vues sans interface

  var IMG = "../../portfolio/img/";
  function photo(src, alt, l, h) {
    return '<img src="' + IMG + src + '" alt="' + alt + '" width="' + l + '" height="' + h + '" loading="lazy" decoding="async">';
  }
  function video(nom, legende, l, h) {
    return '<figure class="dm-video"><video controls playsinline muted loop preload="none" width="' + l + '" height="' + h + '"'
      + ' poster="demarche/' + nom + '.jpg" aria-label="' + legende + '">'
      + '<source src="demarche/' + nom + '.mp4" type="video/mp4"></video>'
      + '<figcaption>' + legende + '</figcaption></figure>';
  }

  var style = document.createElement("style");
  style.textContent = [
    "#dmBouton{position:fixed;top:18px;right:18px;z-index:15;font:500 11px Menlo,monospace;letter-spacing:.16em;",
    "text-transform:uppercase;color:var(--ink);background:color-mix(in srgb,var(--bg) 70%,transparent);",
    "border:1px solid var(--line);padding:11px 14px;cursor:pointer;transition:color .15s,border-color .15s}",
    "#dmBouton:hover,#dmBouton:focus-visible,#dmBouton[aria-expanded=true]{color:var(--accent);border-color:var(--accent)}",
    "html.immersif #dmBouton{display:none}",
    "html.publique .photo{top:68px}",                                  /* la photo passe sous le bouton */
    "#dmVoile{position:fixed;inset:0;z-index:30;background:rgba(10,9,7,.62);opacity:0;visibility:hidden;",
    "transition:opacity .25s,visibility .25s}",
    "#dmVoile.ouvert{opacity:1;visibility:visible}",
    "#dmPanneau{position:fixed;top:0;right:0;bottom:0;z-index:31;width:min(600px,100%);overflow:auto;",
    "overscroll-behavior:contain;background:var(--bg);border-left:1px solid var(--line);color:var(--ink);",
    "padding:26px 30px 44px;clip-path:inset(0 0 0 100%);visibility:hidden;",
    "transition:clip-path .3s ease,visibility .3s}",
    "#dmPanneau.ouvert{clip-path:inset(0);visibility:visible}",
    "#dmPanneau .dm-tete{display:flex;align-items:baseline;justify-content:space-between;gap:16px;",
    "border-bottom:1px solid var(--line);padding-bottom:16px;margin-bottom:22px}",
    "#dmPanneau .dm-rang{font-size:10px;letter-spacing:.3em;text-transform:uppercase;color:var(--dim)}",
    "#dmPanneau h2{font:italic 34px/1.1 var(--titre);margin-top:6px;text-wrap:balance}",
    "#dmFermer{font:500 11px Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--ink);",
    "background:transparent;border:1px solid var(--line);padding:9px 12px;cursor:pointer;white-space:nowrap}",
    "#dmFermer:hover,#dmFermer:focus-visible{color:var(--accent);border-color:var(--accent)}",
    "#dmPanneau p{font-size:14.5px;line-height:1.65;color:var(--ink);max-width:62ch}",
    "#dmPanneau p+p{margin-top:12px}",
    "#dmPanneau .dm-chapeau{font:italic 21px/1.4 var(--titre)}",
    "#dmPanneau section{margin-top:34px;padding-top:22px;border-top:1px solid var(--line)}",
    "#dmPanneau h3{font-size:10.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--accent);",
    "font-weight:500;margin-bottom:12px}",
    "#dmPanneau .dm-fiche{display:inline-block;margin-top:12px;font-size:11.5px;letter-spacing:.04em;color:var(--accent)}",
    "#dmPanneau .dm-photos{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:18px}",
    "#dmPanneau .dm-photos img,#dmPanneau video{display:block;width:100%;height:auto;border:1px solid var(--line);",
    "background:var(--panel)}",
    "#dmPanneau .dm-photos img{aspect-ratio:3/4;object-fit:cover}",
    "#dmPanneau .dm-video{margin-top:18px}",
    "#dmPanneau .dm-seule{max-width:320px}",
    "#dmPanneau .dm-videos{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;align-items:start}",
    "#dmPanneau .dm-videos .dm-video{margin-top:0}",
    "#dmPanneau figcaption{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);margin-top:7px}",
    "#dmPanneau .dm-liens{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}",
    "#dmPanneau .dm-liens a,#dmPanneau .dm-liens button{font:500 11px Menlo,monospace;letter-spacing:.14em;",
    "text-transform:uppercase;text-decoration:none;color:var(--ink);background:transparent;border:1px solid var(--line);",
    "padding:10px 13px;cursor:pointer}",
    "#dmPanneau .dm-liens a:hover,#dmPanneau .dm-liens button:hover,#dmPanneau .dm-liens a:focus-visible{",
    "color:var(--accent);border-color:var(--accent)}",
    "#dmPanneau a:focus-visible{outline:2px solid var(--accent);outline-offset:2px}",
    "@media (max-width:860px){#dmBouton{position:absolute;top:14px;right:16px;padding:9px 11px;font-size:10px}",
    "#dmPanneau{padding:20px 16px 36px}#dmPanneau h2{font-size:28px}#dmPanneau .dm-chapeau{font-size:19px}}",
    "@media (prefers-reduced-motion:reduce){#dmVoile,#dmPanneau{transition:none}}"
  ].join("");
  document.head.appendChild(style);

  var bouton = document.createElement("button");
  bouton.type = "button";
  bouton.id = "dmBouton";
  bouton.textContent = "La démarche";
  bouton.setAttribute("aria-haspopup", "dialog");
  bouton.setAttribute("aria-expanded", "false");
  bouton.setAttribute("aria-controls", "dmPanneau");

  var voile = document.createElement("div");
  voile.id = "dmVoile";

  var panneau = document.createElement("aside");
  panneau.id = "dmPanneau";
  panneau.setAttribute("role", "dialog");
  panneau.setAttribute("aria-modal", "true");
  panneau.setAttribute("aria-labelledby", "dmTitre");
  panneau.tabIndex = -1;
  var contenu =
    '<div class="dm-tete"><div><div class="dm-rang">Tableaux</div><h2 id="dmTitre">La démarche</h2></div>'
    + '<button type="button" id="dmFermer">Fermer</button></div>'
    + '<p class="dm-chapeau">Œuvres originales réalisées à la main, au format raisin (50\u00a0×\u00a065\u00a0cm), à l\'encre.</p>'
    + '<p>Chaque composition est créée à l\'aide d\'un pinceau rotatif et d\'une palette à encres sur mesure, '
    + 'deux outils développés au sein de l\'atelier pour expérimenter de nouvelles techniques picturales.</p>'

    + '<section><h3>En atelier</h3>'
    + '<div class="dm-videos">'
    + video("pochoir", "Découpe, pochoirs et aérographe", 720, 960)
    + video("encres", "Les encres au travail", 720, 900)
    + '</div></section>'

    + '<section><h3>Le pinceau rotatif</h3>'
    + '<p>Un pinceau équipé d\'un roulement à billes, qui procure un confort et une douceur d\'utilisation inégalés. '
    + 'Pensé pour le travail à l\'encre, cet outil de création offre une expérience unique : une légère inclinaison '
    + 'suffit à maîtriser le mouvement du pinceau avec précision.</p>'
    + '<div class="dm-seule">' + video("pinceau-rotatif", "Pinceau standard et pinceau rotatif", 720, 1096) + '</div>'
    + '<div class="dm-photos">'
    + photo("Rotary-brush/00.jpg", "Le pinceau rotatif, manche noir et pointe en poils bruns", 1050, 1400)
    + photo("Rotary-brush/02.jpg", "Le pinceau démonté : pointe, axe, roulement à billes et manche", 1108, 1400)
    + photo("Rotary-brush/05.jpg", "Tracé à l\'encre noire réalisé au pinceau rotatif", 1121, 1400)
    + photo("Rotary-brush/03.jpg", "Tracé à l\'encre noire sur fond d\'encres violettes et bleues", 1022, 1400)
    + '</div>'
    + '<a class="dm-fiche" href="../../portfolio/Rotary-brush.html">La fiche du pinceau →</a></section>'

    + '<section><h3>La palette à encres</h3>'
    + '<p>J\'ai conçu cette palette pour préparer et mélanger des encres indélébiles. Elle permet de garder les '
    + 'couleurs séparées et de rincer soigneusement les pinceaux avant de changer de teinte.</p>'
    + '<p>Les deux dernières images montrent des tableaux réalisés avec ces encres.</p>'
    + '<div class="dm-photos">'
    + photo("Palette-a-encres/00.jpg", "La palette à encres en service, godets de couleurs et bacs de rinçage", 1120, 1400)
    + photo("Palette-a-encres/01.jpg", "Travail au pinceau sur un tableau aux encres", 1050, 1400)
    + photo("Palette-a-encres/03.jpg", "Tableau peint aux encres indélébiles, détail", 1050, 1400)
    + photo("Palette-a-encres/04.jpg", "Tableau Rébellion en Technicolor peint aux encres indélébiles", 1050, 1400)
    + '</div>'
    + '<a class="dm-fiche" href="../../portfolio/Palette-a-encres.html">La fiche de la palette →</a></section>'

    + '<section><p>Les œuvres sont présentées dans une galerie virtuelle en 3D, avec leur certificat d\'authenticité '
    + 'et un espace dédié à l\'achat et à la vente.</p>'
    + '<div class="dm-liens"><button type="button" id="dmRetour">Voir la galerie</button>'
    + '<a href="../achat-vente/">Achat / Vente</a></div></section>';

  document.body.appendChild(bouton);
  document.body.appendChild(voile);
  document.body.appendChild(panneau);

  function ouvert() { return panneau.classList.contains("ouvert"); }
  // Lecture automatique : une vidéo joue (sans son, en boucle) tant qu'elle est visible dans
  // le panneau ouvert, et s'arrête dès qu'elle en sort. Voulu par Baptiste (06/11/2026), y
  // compris quand le système demande moins d'animations : les commandes de chaque vidéo
  // restent là pour la mettre en pause.
  var visibles = [];
  function jouer(v) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
  function suivre() {
    if (!("IntersectionObserver" in window)) return;
    var veille = new IntersectionObserver(function (entrees) {
      entrees.forEach(function (e) {
        var i = visibles.indexOf(e.target);
        if (e.isIntersecting && i < 0) visibles.push(e.target);
        if (!e.isIntersecting && i >= 0) visibles.splice(i, 1);
        if (e.isIntersecting && ouvert()) jouer(e.target); else e.target.pause();
      });
    }, { root: panneau, threshold: 0.5 });
    Array.prototype.forEach.call(panneau.querySelectorAll("video"), function (v) { veille.observe(v); });
  }
  function basculer(on) {
    panneau.classList.toggle("ouvert", on);
    voile.classList.toggle("ouvert", on);
    bouton.setAttribute("aria-expanded", on ? "true" : "false");
    if (on) {
      // Le contenu n'est posé qu'à la première ouverture : aucune photo, aucune
      // affiche de vidéo n'est chargée tant que le panneau n'a pas été demandé.
      if (contenu) { panneau.innerHTML = contenu; contenu = ""; suivre(); }
      else visibles.forEach(jouer);
      panneau.scrollTop = 0;
      document.getElementById("dmFermer").focus();
    } else {
      Array.prototype.forEach.call(panneau.querySelectorAll("video"), function (v) { v.pause(); });
      bouton.focus();
    }
  }
  bouton.addEventListener("click", function () { basculer(!ouvert()); });
  voile.addEventListener("click", function () { basculer(false); });
  panneau.addEventListener("click", function (e) {
    var cible = e.target.closest ? e.target.closest("#dmFermer, #dmRetour") : null;
    if (cible) basculer(false);
  });
  // Échap ferme ; Tab reste dans le panneau tant qu'il est ouvert ; les raccourcis de la
  // galerie (H) ne se déclenchent pas pendant la lecture.
  addEventListener("keydown", function (e) {
    if (!ouvert()) return;
    if (e.key === "Escape") { e.stopPropagation(); basculer(false); return; }
    if (e.key === "h" || e.key === "H") { e.stopPropagation(); return; }
    if (e.key !== "Tab") return;
    var f = panneau.querySelectorAll("button, a[href], video");
    if (!f.length) return;
    var premier = f[0], dernier = f[f.length - 1];
    if (e.shiftKey && document.activeElement === premier) { e.preventDefault(); dernier.focus(); }
    else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus(); }
  }, true);
})();
