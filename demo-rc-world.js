/* DEMO JOUABLE DE RC WORLD, chargee au clic.
 *
 * POURQUOI AU CLIC. Le jeu est un build web complet : l'embarquer au
 * chargement ferait payer plusieurs mega-octets a tout visiteur, y compris a
 * celui qui vient pour un devis. On affiche donc une image, et le joueur
 * decide.
 *
 * POURQUOI html-classic.itch.zone ET PAS itch.io. Mesure du 05/10/2026 :
 * https://itch.io/embed-upload/... repond « x-frame-options: SAMEORIGIN ». Le
 * cadre reste donc VIDE sur un autre domaine, sans la moindre erreur visible,
 * et c'est exactement ce qui s'est passe au premier essai. Le lecteur du jeu,
 * lui, n'interdit pas l'encadrement : c'est lui qu'on charge.
 *
 * POURQUOI UN LIEN PERMANENT SOUS LE CADRE, ET PAS UNE DETECTION D'ECHEC.
 * L'adresse d'un build itch.io change a chaque nouvelle version televersee :
 * le jour ou RC WORLD est mis a jour, ce cadre pointera dans le vide. Or un
 * cadre bloque declenche quand meme l'evenement « load » : depuis l'exterieur,
 * on ne peut pas distinguer un jeu qui tourne d'un rectangle mort. Plutot
 * qu'une detection qui mentirait, le lien vers itch.io est TOUJOURS affiche
 * sous le cadre : si le jeu ne s'affiche pas, le chemin reste ouvert.
 *
 * Fichier servi, jamais inline : la CSP du site est `script-src 'self'`.
 */
(function () {
  var JEU = 'https://html-classic.itch.zone/html/19583892/index.html';
  var PAGE = 'https://deligny-rd.itch.io/rc-world';

  function lance(bloc) {
    var cadre = document.createElement('iframe');
    cadre.className = 'demo-rc-cadre';
    cadre.src = JEU;
    cadre.title = 'RC WORLD, demonstration jouable';
    cadre.setAttribute('allow', 'fullscreen; gamepad; autoplay');
    cadre.setAttribute('allowfullscreen', 'true');

    bloc.textContent = '';
    bloc.appendChild(cadre);
    bloc.classList.add('demo-rc-lance');

    var pied = document.createElement('p');
    pied.className = 'demo-rc-repli';
    var a = document.createElement('a');
    a.href = PAGE;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = 'ouvrir RC WORLD sur itch.io';
    pied.appendChild(document.createTextNode('Le jeu ne demarre pas, ou vous le voulez en grand ? '));
    pied.appendChild(a);
    pied.appendChild(document.createTextNode('.'));
    bloc.appendChild(pied);
  }

  var blocs = document.querySelectorAll('.demo-rc');
  [].forEach.call(blocs, function (bloc) {
    var bouton = bloc.querySelector('.demo-rc-bouton');
    if (!bouton) return;
    bouton.addEventListener('click', function (e) {
      e.preventDefault();
      lance(bloc);
    });
  });
})();
