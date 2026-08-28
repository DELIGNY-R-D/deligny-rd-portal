/* CHARGEMENT DIFFERE DU CONFIGURATEUR DE LAMPE
 *
 * lampe-embed.js pese 305 Ko compresses, soit 88 % du poids de l'accueil, pour
 * un widget que la plupart des visiteurs ne descendent jamais ouvrir. On ne le
 * charge qu'a l'approche de son emplacement, ou au premier geste du visiteur.
 *
 * POURQUOI CE FICHIER EXISTE AU LIEU D'UN <script> INLINE : la CSP de l'accueil
 * est `script-src 'self'`, sans 'unsafe-inline'. Un script inline y est bloque
 * SILENCIEUSEMENT — le configurateur ne se chargeait plus du tout (25/08). La
 * doctrine forteresse statique du site n'admet que des fichiers servis par le
 * domaine : c'est le cas de celui-ci.
 *
 * PAS DE MINUTEUR DE SECOURS : il chargerait le fichier pour TOUT LE MONDE au
 * bout de quelques secondes et annulerait l'economie. Sans geste ni defilement,
 * le visiteur n'atteint de toute facon jamais le widget.
 */
(function () {
  var balise = document.getElementById('lampeDiffere');
  var cible = document.getElementById('lampe-embed-root');
  if (!balise || !cible) return;

  var lance = false;
  function charger() {
    if (lance) return;
    lance = true;
    var s = document.createElement('script');
    s.src = balise.getAttribute('data-src');
    document.body.appendChild(s);
  }

  if ('IntersectionObserver' in window) {
    // 700 px d'avance : le script est pret avant que le widget soit a l'ecran.
    var io = new IntersectionObserver(function (entrees) {
      for (var i = 0; i < entrees.length; i++) {
        if (entrees[i].isIntersecting) { io.disconnect(); charger(); return; }
      }
    }, { rootMargin: '700px' });
    io.observe(cible);
  } else {
    charger();   // navigateur sans observateur : comportement d'avant
  }

  // Filets : un differe qui echoue laisserait un widget VIDE, ce qui serait
  // pire que 305 Ko de trop. L'observateur ne se declenche jamais si la fenetre
  // a une hauteur nulle (onglet ouvert en arriere-plan, cas exotiques).
  addEventListener('scroll', charger, { once: true, passive: true });
  addEventListener('pointerdown', charger, { once: true, passive: true });
  addEventListener('keydown', charger, { once: true });
})();
