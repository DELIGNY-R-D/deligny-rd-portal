/* Un clic sur une ancre interne ne doit pas FAIRE GLISSER la page.
 *
 * 13/10/2026. Avec `scroll-behavior: smooth`, cliquer un lien de sommaire
 * faisait defiler tout le document jusqu'a la cible : on voyait le site
 * chercher l'endroit, parfois sur plusieurs ecrans. La regle est retiree de
 * styles.css. A la place, on ANNONCE un chargement -- banderole de progression
 * et voile, l'idiome que tout le monde reconnait -- puis on se retrouve a
 * destination d'un coup.
 *
 * Le saut reste instantane meme si quelqu'un remet un scroll-behavior ailleurs :
 * `behavior: "instant"` est passe explicitement, jamais laisse par defaut.
 */
(function () {
  "use strict";

  var DUREE = 380;                 // le temps du chargement annonce
  var barre, voile, enCours = false;

  function cible(hash) {
    if (!hash || hash === "#" || hash.length < 2) return null;
    var id = decodeURIComponent(hash.slice(1));
    return document.getElementById(id) ||
           document.querySelector('[name="' + CSS.escape(id) + '"]');
  }

  function poser() {
    if (barre) return;
    barre = document.createElement("div");
    barre.className = "cs-barre";
    barre.setAttribute("aria-hidden", "true");
    voile = document.createElement("div");
    voile.className = "cs-voile";
    voile.setAttribute("aria-hidden", "true");
    document.body.appendChild(voile);
    document.body.appendChild(barre);
  }

  function aller(el, hash) {
    // L'adresse change AVANT le saut : un rechargement ou un partage retombe
    // au bon endroit, et le bouton Retour fonctionne.
    try { history.pushState(null, "", hash); } catch (e) { /* file:// */ }
    el.scrollIntoView({ behavior: "instant", block: "start" });
    // Le focus suit la vue, sinon le clavier reste en haut de page.
    if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
    try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
  }

  function charger(el, hash) {
    if (enCours) return;
    enCours = true;
    poser();
    // Le chargement est annonce MEME en mouvement reduit : une banderole qui
    // apparait n'est pas du mouvement, et c'est le defilement -- lui, retire --
    // qui genait. styles.css coupe les transitions dans ce mode, pas l'annonce.
    // Deux images d'attente avant d'activer : sans cela la transition CSS
    // part de sa valeur finale et rien ne s'anime.
    barre.classList.remove("cs-actif");
    voile.classList.remove("cs-actif");
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        barre.classList.add("cs-actif");
        voile.classList.add("cs-actif");
      });
    });
    window.setTimeout(function () {
      aller(el, hash);
      barre.classList.remove("cs-actif");
      voile.classList.remove("cs-actif");
      enCours = false;
    }, DUREE);
  }

  document.addEventListener("click", function (ev) {
    // On ne detourne QUE le clic simple gauche : ctrl/cmd/shift/alt et le
    // clic du milieu ouvrent un onglet, ce n'est pas a nous de le casser.
    if (ev.defaultPrevented || ev.button !== 0) return;
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    var a = ev.target && ev.target.closest ? ev.target.closest("a[href]") : null;
    if (!a || a.target === "_blank" || a.hasAttribute("download")) return;

    var href = a.getAttribute("href") || "";
    if (href.charAt(0) !== "#") return;      // lien vers une autre page : vrai chargement
    var el = cible(href);
    if (!el) return;                          // ancre morte : laisser le navigateur dire

    ev.preventDefault();
    charger(el, href);
  }, false);
})();
