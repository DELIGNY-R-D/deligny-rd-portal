/* COMPOSEUR DE DEMANDE — page contact de deligny-rd.fr
 *
 * POURQUOI. La page n'offrait que « contact@deligny-rd.fr » et un bouton
 * mailto vide. Un visiteur convaincu devait quitter le site, ouvrir son
 * client mail, et formuler seul sa demande depuis une page blanche : c'est le
 * moment ou l'on renonce. Mais la page assume aussi « pas de formulaire a
 * rallonge », et c'est une bonne ligne : un formulaire de dix champs ferait
 * fuir autant.
 *
 * D'OU CE COMPROMIS : trois clics, pas un formulaire. On choisit un sujet, on
 * donne une echeance et deux phrases, et le courriel part DEJA REDIGE, avec un
 * objet clair et une demande structuree. Le visiteur n'affronte jamais la page
 * blanche, et la demande arrive exploitable.
 *
 * AUCUN ENVOI D'ICI. Le site est statique et le restera : on prepare un
 * mailto, c'est le client mail du visiteur qui envoie. Rien n'est transmis a
 * un serveur, rien n'est stocke, et cela vaut mieux qu'un formulaire qui
 * promettrait un envoi sans pouvoir le tenir.
 *
 * Fichier servi, jamais inline : la CSP du site est `script-src 'self'` et un
 * inline y serait bloque SANS BRUIT (incident du 25/08).
 */
(function () {
  var hote = document.getElementById('composeur');
  if (!hote) return;

  var SUJETS = [
    { id: 'logiciel',  titre: 'Un logiciel sur mesure',        objet: 'Projet logiciel' },
    { id: 'fabrique',  titre: 'Concevoir ou fabriquer un objet', objet: 'Conception et fabrication' },
    { id: 'heberge',   titre: 'Heberger ou infogerer',          objet: 'Hebergement' },
    { id: 'autre',     titre: 'Autre chose',                    objet: 'Prise de contact' },
  ];
  var DELAIS = ['Des que possible', 'Dans le mois', 'Ce trimestre', 'Pas encore fixe'];

  var choix = { sujet: null, delai: null };

  function bouton(txt, actif) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'cp-choix' + (actif ? ' on' : '');
    b.textContent = txt;
    return b;
  }

  function ligne(legende, options, cle, apres) {
    var d = document.createElement('div');
    d.className = 'cp-ligne';
    var l = document.createElement('span');
    l.className = 'cp-legende';
    l.textContent = legende;
    d.appendChild(l);
    var zone = document.createElement('div');
    zone.className = 'cp-options';
    options.forEach(function (o) {
      var texte = o.titre || o;
      var b = bouton(texte, false);
      b.onclick = function () {
        choix[cle] = o;
        [].forEach.call(zone.children, function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        if (apres) apres();
        majEtat();
      };
      zone.appendChild(b);
    });
    d.appendChild(zone);
    return d;
  }

  // ── Construction ──────────────────────────────────────────────────────
  hote.appendChild(ligne('Je viens pour', SUJETS, 'sujet'));
  hote.appendChild(ligne('Echeance', DELAIS, 'delai'));

  var champ = document.createElement('textarea');
  champ.className = 'cp-texte';
  champ.rows = 3;
  champ.placeholder = 'En deux phrases : ce que vous cherchez, et pour qui.';
  champ.setAttribute('aria-label', 'Votre demande, en deux phrases');
  hote.appendChild(champ);

  var envoyer = document.createElement('a');
  envoyer.className = 'btn btn-small btn-primary cp-envoyer';
  envoyer.textContent = 'Preparer le message';
  envoyer.setAttribute('aria-disabled', 'true');
  hote.appendChild(envoyer);

  var note = document.createElement('p');
  note.className = 'cp-note';
  note.textContent = 'Le message s’ouvre dans votre logiciel de courrier, deja redige. Rien n’est envoye depuis ce site.';
  hote.appendChild(note);

  function majEtat() {
    var pret = !!choix.sujet;
    envoyer.setAttribute('aria-disabled', pret ? 'false' : 'true');
    if (!pret) { envoyer.removeAttribute('href'); return; }

    var objet = 'DELIGNY R&D — ' + choix.sujet.objet;
    var corps = [
      'Bonjour,',
      '',
      'Demande : ' + choix.sujet.titre + '.',
      'Echeance : ' + (choix.delai || 'a preciser') + '.',
      '',
      (champ.value.trim() || '[decrivez votre besoin en deux phrases]'),
      '',
      '—',
      'Envoye depuis deligny-rd.fr/contact.html',
    ].join('\n');

    envoyer.href = 'mailto:contact@deligny-rd.fr'
      + '?subject=' + encodeURIComponent(objet)
      + '&body=' + encodeURIComponent(corps);
  }

  champ.addEventListener('input', majEtat);
  envoyer.addEventListener('click', function (e) {
    // Sans sujet choisi, le lien n'a pas d'adresse : on explique au lieu de
    // laisser un clic sans effet.
    if (envoyer.getAttribute('aria-disabled') === 'true') {
      e.preventDefault();
      hote.querySelector('.cp-ligne').classList.add('cp-manque');
      setTimeout(function () {
        hote.querySelector('.cp-ligne').classList.remove('cp-manque');
      }, 1200);
    }
  });

  majEtat();
})();
