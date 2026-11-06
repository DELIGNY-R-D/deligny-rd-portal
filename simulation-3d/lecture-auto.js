/* LECTURE AUTOMATIQUE A L'AFFICHAGE — Simulation 3D
 *
 * Demande : les videos doivent demarrer seules quand elles apparaissent.
 *
 * POURQUOI DU JAVASCRIPT ICI, alors que cette page etait volontairement sans
 * script. La solution en HTML pur serait de poser `autoplay` sur les vingt
 * balises. Mais cette page sert 54 Mo de video : un `autoplay` general laisse
 * le navigateur precharger des fichiers que le visiteur ne verra peut-etre
 * jamais, et sur un forfait mobile cela se paie. On ne lance donc QUE ce qui
 * entre a l'ecran, et on met en pause ce qui en sort — la bande passante suit
 * le regard.
 *
 * Fichier servi, jamais inline : la CSP est `script-src 'self'` et un inline
 * serait bloque sans bruit (incident du 25/08).
 *
 * CE QU'ON NE PREND PAS AU VISITEUR : les commandes restent affichees, une
 * video mise en pause a la main n'est pas relancee de force.
 * `prefers-reduced-motion` n'est PLUS respecte (05/11, demande Baptiste : « toutes
 * les videos doivent se lancer automatiquement ») : son Mac a « Reduire les
 * animations » active et il ne voyait rien demarrer. Ce sont des films muets
 * en boucle, avec leurs commandes : le visiteur garde la pause.
 */
(function () {
  var videos = [].slice.call(document.querySelectorAll('video'));
  if (!videos.length) return;

  // Une pause DELIBEREE se respecte : on retient les videos que le visiteur a
  // lui-meme arretees, pour ne pas les relancer a chaque defilement.
  var arreteesALaMain = new WeakSet();
  videos.forEach(function (v) {
    v.addEventListener('pause', function () {
      // On ne marque que les pauses venues d'un clic, pas les notres.
      if (!v.dataset.pauseAuto) arreteesALaMain.add(v);
      delete v.dataset.pauseAuto;
    });
    v.addEventListener('play', function () { arreteesALaMain.delete(v); });
    // 06/11/2026 (Baptiste) : plus de commandes du navigateur sur les films de la page
    // Simulation 3D, elles recouvraient l'image sur iPhone. La pause reste possible :
    // un toucher sur le film l'arrete, un second le relance. Sans effet sur une vignette
    // prise dans un lien, ou le toucher ouvre la page.
    if (!v.controls && !v.closest('a')) {
      v.addEventListener('click', function () {
        if (v.paused) { arreteesALaMain.delete(v); var p = v.play(); if (p && p.catch) p.catch(function () {}); }
        else v.pause();
      });
    }
  });

  // LECTURE REFUSEE (06/11/2026, demande Baptiste : « sur iPhone les videos doivent
  // tourner tout le temps »). Un iPhone en economie d'energie refuse toute lecture
  // qui ne vient pas d'un geste : `play()` echoue avec NotAllowedError. Deux secours :
  //   1. la video porte `data-anime` : on la remplace par cette image animee, qui
  //      tourne sans rien demander a personne (carte K1 de l'accueil et du catalogue) ;
  //   2. sinon on la retient, et on la relance au premier toucher du visiteur, seul
  //      moment ou le telephone l'accepte.
  var refusees = [];
  function remplacerParImage(v) {
    var img = document.createElement('img');
    img.src = v.getAttribute('data-anime');
    img.alt = v.getAttribute('aria-label') || '';
    img.width = v.width; img.height = v.height;
    img.decoding = 'async';
    img.className = v.className;
    if (v.parentNode) v.parentNode.replaceChild(img, v);
  }
  function lancer(v) {
    var p = v.play();
    if (!p || typeof p.catch !== 'function') return;
    p.catch(function (e) {
      if (!e || e.name !== 'NotAllowedError') return;      // une pause qui coupe un lancement n'est pas un refus
      if (v.getAttribute('data-anime')) { remplacerParImage(v); return; }
      if (refusees.indexOf(v) < 0) refusees.push(v);
    });
  }
  function auGeste() {
    var encore = [];
    refusees.forEach(function (v) {
      if (!v.isConnected || arreteesALaMain.has(v) || !v.dataset.aLEcran) return;
      var p = v.play();
      if (p && typeof p.catch === 'function') p.catch(function () { if (encore.indexOf(v) < 0) encore.push(v); });
    });
    refusees = refusees.filter(function (v) { return v.isConnected && !v.dataset.aLEcran; }).concat(encore);
  }
  ['touchend', 'click', 'keydown'].forEach(function (nom) {
    document.addEventListener(nom, auGeste, { capture: true, passive: true });
  });

  if (!('IntersectionObserver' in window)) return;   // navigateur ancien : comportement d'avant

  var io = new IntersectionObserver(function (entrees) {
    entrees.forEach(function (e) {
      var v = e.target;
      if (e.isIntersecting) {
        v.dataset.aLEcran = '1';
        if (arreteesALaMain.has(v)) return;
        // metadata seulement a l'approche : le fichier se charge en lisant,
        // il n'est pas telecharge d'avance.
        if (v.preload === 'none') v.preload = 'metadata';
        lancer(v);
      } else {
        delete v.dataset.aLEcran;
        if (!v.paused) {
          v.dataset.pauseAuto = '1';
          v.pause();
        }
      }
    });
  }, { threshold: 0.35 });          // un tiers visible suffit a considerer qu'on la regarde

  videos.forEach(function (v) { io.observe(v); });
})();
