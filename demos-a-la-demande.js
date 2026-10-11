/* DEMONSTRATIONS CHARGEES A LA DEMANDE, PAS A L'APPROCHE
 *
 * MESURE DU 11/10/2026, sur la page SERVIE. L'accueil portait cinq cadres de
 * demonstration marques `loading="lazy"`. Le report ne s'est jamais produit :
 * le releve reseau montre que TOUT partait au chargement, dont deux copies
 * completes de three.js (une pour le studio de montre, une pour Nano Worlds),
 * une carte d'environnement HDR, deux maillages STL, huit passes de
 * post-traitement, et trois contextes WebGL vivants en meme temps. Le seul
 * studio de montre pesait 4,54 Mo mesures.
 *
 * POURQUOI PAS LE MECANISME DE lampe-differe.js. Celui-la charge A L'APPROCHE
 * (IntersectionObserver, plus des filets sur le premier defilement ou le
 * premier geste). C'est juste pour un script de 305 Ko : le visiteur qui
 * descend jusqu'au widget va s'en servir. Pour une demonstration 3D de
 * plusieurs megaoctets, c'est trop tot : un simple defilement suffirait a la
 * declencher, et on aurait deplace le probleme sans le resoudre. Ici, rien ne
 * part tant que le visiteur n'a pas CLIQUE. Deux besoins differents, deux
 * mecanismes, chacun dit pourquoi.
 *
 * POURQUOI UN FICHIER SERVI ET PAS UN <script> INLINE : la CSP de l'accueil
 * est `script-src 'self'`, sans 'unsafe-inline'. Un script inline y serait
 * bloque SILENCIEUSEMENT (precedent du 25/08 sur le configurateur de lampe).
 *
 * SANS JAVASCRIPT, la demonstration reste atteignable : chaque emplacement
 * porte un <noscript> avec le lien plein ecran. Une page qui, sans script,
 * laisse un trou a la place d'une demonstration serait pire que lourde.
 */
(function () {
  var emplacements = document.querySelectorAll('[data-demo-src]');
  if (!emplacements.length) return;

  for (var i = 0; i < emplacements.length; i++) {
    preparer(emplacements[i]);
  }

  function preparer(hote) {
    var bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'demo-lancer';
    bouton.setAttribute('style',
      'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;' +
      'width:100%;min-height:260px;padding:28px 20px;border:0;cursor:pointer;' +
      'background:transparent;color:#e8e6e1;font:inherit;text-align:center');

    var titre = document.createElement('span');
    titre.setAttribute('style', 'font-size:15px;font-weight:600');
    titre.textContent = hote.getAttribute('data-demo-libelle') || 'Lancer la démonstration';

    var note = document.createElement('span');
    note.setAttribute('style', 'font-size:13px;opacity:.72;max-width:46ch;line-height:1.5');
    var poids = hote.getAttribute('data-demo-poids');
    // On annonce le poids : le visiteur en telephone decide en connaissance de
    // cause au lieu de se faire surprendre par plusieurs megaoctets.
    note.textContent = poids
      ? 'Elle se charge seulement si vous le demandez (' + poids + ').'
      : 'Elle se charge seulement si vous le demandez.';

    bouton.appendChild(titre);
    bouton.appendChild(note);

    bouton.addEventListener('click', function () {
      var cadre = document.createElement('iframe');
      cadre.src = hote.getAttribute('data-demo-src');
      cadre.title = hote.getAttribute('data-demo-titre') || '';
      var permis = hote.getAttribute('data-demo-allow');
      if (permis) cadre.setAttribute('allow', permis);
      hote.textContent = '';
      hote.appendChild(cadre);
    }, { once: true });

    // Le <noscript> reste dans le document pour les navigateurs sans script ;
    // ici on insere le bouton avant lui, sans rien retirer.
    hote.insertBefore(bouton, hote.firstChild);
  }
})();
