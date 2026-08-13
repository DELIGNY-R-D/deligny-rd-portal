/* Sous-titre du bandeau : une phrase piochee dans une petite bibliotheque,
 * qui change toutes les heures. Le choix est calcule a partir de l'heure
 * UTC courante (pas d'appel serveur, pas d'IA) : tous les visiteurs voient
 * donc la meme phrase pendant la meme heure, ou qu'ils soient dans le monde,
 * et elle change pile au changement d'heure suivant. */
(function(){
  "use strict";
  var el = document.getElementById('daily-tagline');
  if(!el) return;

  var taglines = [
    "Imaginer. Experimenter. Construire.",
    "De l'idee au reel.",
    "Inventer ce qui manque.",
    "Explorer. Concevoir. Fabriquer.",
    "Des idees aux systemes.",
    "Concevoir autrement.",
    "Transformer l'intuition en realite.",
    "Entre recherche et creation."
  ];

  var hourNumber = Math.floor(Date.now() / 3600000);
  el.textContent = taglines[hourNumber % taglines.length];
})();
