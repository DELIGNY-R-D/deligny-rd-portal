/* LES DEMONSTRATIONS SE CHARGENT SEULES, A L'APPROCHE
 *
 * HISTOIRE COURTE. Le 11/10 les cadres de demonstration portaient
 * `loading="lazy"` et le report ne se produisait jamais : le releve reseau sur
 * la page servie montrait deux copies completes de three.js, une carte
 * d'environnement HDR, deux maillages STL et trois contextes WebGL vivants des
 * l'ouverture, pour 4,54 Mo mesures sur le seul studio de montre. On est alors
 * passe a un chargement AU CLIC. Economie reelle, mais le visiteur tombait sur
 * un grand rectangle noir a la place de la montre : le remede etait pire que le
 * mal, et Baptiste l'a dit le 12/10.
 *
 * CE QUE FAIT CELUI-CI. La demonstration part TOUTE SEULE quand le visiteur
 * s'en approche, avec 900 px d'avance, donc elle est generalement deja la quand
 * elle entre dans l'ecran. Aucun clic. Et rien ne part au chargement de la page
 * pour qui ne descend jamais jusque-la.
 *
 * POURQUOI 900 PX ET PAS PLUS. Au-dela, on rechargerait pour presque tout le
 * monde et l'economie disparaitrait ; en deca, le visiteur verrait le cadre
 * vide se remplir sous ses yeux.
 *
 * POURQUOI UN FICHIER SERVI ET PAS UN <script> INLINE : la CSP de l'accueil est
 * `script-src 'self'`, sans 'unsafe-inline'. Un script inline y serait bloque
 * SILENCIEUSEMENT (precedent du 25/08 sur le configurateur de lampe).
 *
 * SANS JAVASCRIPT, chaque emplacement garde un <noscript> avec le lien plein
 * ecran : une page qui laisserait un trou a la place d'une demonstration serait
 * pire que lourde.
 *
 * Remplace demos-a-la-demande.js, laisse en place : la publication du portail
 * interdit de supprimer un asset deja servi dans le meme lot (un HTML en cache
 * peut encore le reclamer). Menage dans un lot ulterieur.
 */
(function () {
  var emplacements = document.querySelectorAll('[data-demo-src]');
  if (!emplacements.length) return;

  for (var i = 0; i < emplacements.length; i++) preparer(emplacements[i]);

  function preparer(hote) {
    var charge = false;

    // Etat d'attente discret : il occupe la hauteur finale du cadre, pour que
    // rien ne saute quand la demonstration prend sa place.
    var attente = document.createElement('p');
    attente.className = 'demo-attente';
    attente.textContent = hote.getAttribute('data-demo-attente') || 'Chargement de la démonstration…';
    hote.insertBefore(attente, hote.firstChild);

    function charger() {
      if (charge) return;
      charge = true;
      var cadre = document.createElement('iframe');
      cadre.src = hote.getAttribute('data-demo-src');
      cadre.title = hote.getAttribute('data-demo-titre') || '';
      var permis = hote.getAttribute('data-demo-allow');
      if (permis) cadre.setAttribute('allow', permis);
      hote.textContent = '';
      hote.appendChild(cadre);
    }

    // Verification directe, utilisable a tout moment : l'emplacement est-il a
    // moins de 900 px de l'ecran ? Elle ne sert a rien tant que la fenetre n'a
    // pas de hauteur, et c'est voulu : on ne charge pas dans le vide.
    function verifier() {
      if (charge || !window.innerHeight) return;
      var r = hote.getBoundingClientRect();
      if (r.top < window.innerHeight + 900 && r.bottom > -900) {
        retirer();
        charger();
      }
    }

    function retirer() {
      removeEventListener('scroll', verifier);
      removeEventListener('resize', verifier);
      document.removeEventListener('visibilitychange', verifier);
      if (observateur) observateur.disconnect();
    }

    var observateur = null;
    if ('IntersectionObserver' in window) {
      observateur = new IntersectionObserver(function (entrees) {
        for (var i = 0; i < entrees.length; i++) {
          if (entrees[i].isIntersecting) { retirer(); charger(); return; }
        }
      }, { rootMargin: '900px' });
      observateur.observe(hote);
    } else {
      charger();   // navigateur sans observateur : comportement d'avant
      return;
    }

    // FILETS, et ils ne sont pas decoratifs. Constate le 12/10 en mesurant :
    // dans un onglet dont la fenetre a une hauteur NULLE (ouvert en arriere-plan
    // par un clic du milieu, volet masque), `innerHeight` vaut 0,
    // `document.visibilityState` vaut « hidden », et l'observateur ne se
    // declenche jamais. Sans ces ecouteurs, le visiteur qui revient sur cet
    // onglet resterait devant « Chargement... » indefiniment : un cadre
    // d'attente qui ne se remplit pas est pire que le poids qu'il evite.
    document.addEventListener('visibilitychange', verifier);
    addEventListener('scroll', verifier, { passive: true });
    addEventListener('resize', verifier, { passive: true });
    addEventListener('pointerdown', charger, { once: true, passive: true });
    addEventListener('keydown', charger, { once: true });
  }
})();
