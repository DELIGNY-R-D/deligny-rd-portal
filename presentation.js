/* PRESENTATION ANIMEE DE L'ACCUEIL (29/08, corrigee le 10/09).
 *
 * Elle ne demarre pas au chargement : une sequence qui tourne en bas d'une page
 * qu'on ne regarde pas est du bruit. Elle part quand elle entre a l'ecran, joue
 * UNE fois, et s'arrete sur son dernier plan.
 *
 * CORRECTION DU 10/09. Sous prefers-reduced-motion, la feuille de styles coupait
 * l'animation avec un !important, et ce fichier s'arretait avant meme de cabler
 * quoi que ce soit. Consequence : sur une machine ou « Reduire les animations »
 * est actif, la section restait figee sur son dernier plan ET le bouton ne
 * servait a rien. Or une preference systeme dit « ne m'impose pas de mouvement »,
 * pas « refuse-moi le mouvement que je demande explicitement ». Un clic sur le
 * bouton force donc la sequence, dans tous les cas.
 */
(function () {
  var scene = document.getElementById('presScene');
  var bouton = document.getElementById('presRejouer');
  if (!scene) return;

  function jouer(force) {
    scene.classList.remove('joue', 'force');
    void scene.offsetWidth;                 // force le redemarrage des animations
    if (force) scene.classList.add('force');
    scene.classList.add('joue');
  }

  // Le bouton passe AVANT toute condition : c'est une demande explicite.
  if (bouton) bouton.addEventListener('click', function () { jouer(true); });

  var immobile = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)');
  if (immobile && immobile.matches) {
    // On le dit, au lieu de laisser croire que la section est cassee.
    var note = document.getElementById('presNote');
    if (note) note.hidden = false;
    return;                                 // pas de demarrage automatique
  }

  var lance = false;
  function auto() { if (!lance) { lance = true; jouer(false); } }

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entrees) {
      entrees.forEach(function (e) { if (e.isIntersecting) { auto(); io.disconnect(); } });
    }, { threshold: 0.25 });                // 0.45 etait exigeant sur un ecran court
    io.observe(scene);
  } else {
    auto();
  }
  // Filet : si l'observateur ne se declenche pas (cas rares de mise en page),
  // un defilement suffit. `once` : aucun cout ensuite.
  addEventListener('scroll', function () {
    var r = scene.getBoundingClientRect();
    if (r.top < innerHeight && r.bottom > 0) auto();
  }, { once: true, passive: true });
})();
