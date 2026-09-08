/* PRESENTATION ANIMEE DE L'ACCUEIL (29/08).
 * Elle ne demarre PAS toute seule au chargement : une animation qui tourne en
 * boucle en bas d'une page qu'on ne regarde pas est du bruit, et elle fait
 * travailler la machine pour rien. Elle part quand elle entre a l'ecran, joue
 * UNE fois, et s'arrete sur son dernier plan. Le bouton la rejoue.
 * Sous prefers-reduced-motion, rien ne bouge : le dernier plan est affiche
 * d'emblee (voir la feuille de styles), et ce fichier ne fait rien.
 */
(function () {
  var scene = document.getElementById('presScene');
  var rejouer = document.getElementById('presRejouer');
  if (!scene) return;

  function jouer() {
    scene.classList.remove('joue');
    void scene.offsetWidth;          // force le redemarrage des animations
    scene.classList.add('joue');
  }

  if (rejouer) rejouer.addEventListener('click', jouer);

  var immobile = matchMedia('(prefers-reduced-motion: reduce)');
  if (immobile.matches) return;      // la CSS affiche deja le plan final

  if (!('IntersectionObserver' in window)) { jouer(); return; }
  var io = new IntersectionObserver(function (entrees) {
    entrees.forEach(function (e) {
      if (!e.isIntersecting) return;
      jouer();
      io.disconnect();               // une seule fois : ensuite c'est le bouton
    });
  }, { threshold: 0.45 });
  io.observe(scene);
})();

/* 29/08, empreinte forcee. La clef `?v=d67e4950` a ete figee sur un 404 avant
   meme la publication du fichier : je l'ai interrogee a la main pour verifier
   qu'elle etait en ligne, ce qui est exactement la faute que ce depot
   documente. Une clef neuve n'a jamais ete vue par aucun cache. Pour savoir
   si un fichier est publie, on regarde le depot, pas le reseau. */
