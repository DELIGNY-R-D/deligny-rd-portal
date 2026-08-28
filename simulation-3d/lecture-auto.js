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
 * video mise en pause a la main n'est pas relancee de force, et sous
 * `prefers-reduced-motion` rien ne demarre tout seul.
 */
(function () {
  var videos = [].slice.call(document.querySelectorAll('video'));
  if (!videos.length) return;

  var mouvementReduit = window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
  });

  if (mouvementReduit) return;      // rien ne demarre seul, les commandes suffisent

  if (!('IntersectionObserver' in window)) return;   // navigateur ancien : comportement d'avant

  var io = new IntersectionObserver(function (entrees) {
    entrees.forEach(function (e) {
      var v = e.target;
      if (e.isIntersecting) {
        if (arreteesALaMain.has(v)) return;
        // metadata seulement a l'approche : le fichier se charge en lisant,
        // il n'est pas telecharge d'avance.
        if (v.preload === 'none') v.preload = 'metadata';
        var p = v.play();
        // Un navigateur peut refuser (economie d'energie, reglage) : ce n'est
        // pas une panne, la video reste jouable a la main.
        if (p && typeof p.catch === 'function') p.catch(function () {});
      } else if (!v.paused) {
        v.dataset.pauseAuto = '1';
        v.pause();
      }
    });
  }, { threshold: 0.35 });          // un tiers visible suffit a considerer qu'on la regarde

  videos.forEach(function (v) { io.observe(v); });
})();
