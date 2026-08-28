/* TEST NAVIGATEUR DU CHARGEMENT DIFFERE — deligny-rd.fr
 *
 * A coller dans la console sur https://deligny-rd.fr/ (ou a executer via
 * l'outil de pilotage du navigateur). Rend un verdict en trois points, ceux
 * exiges apres l'incident du 25/08 :
 *
 *   1. aucun telechargement du configurateur au chargement de la page ;
 *   2. il arrive apres un geste, ou a l'approche du widget ;
 *   3. le canvas est REELLEMENT dessine (un script charge mais en erreur
 *      laisserait un widget vide, ce que le point 2 seul ne verrait pas).
 *
 * Le point 3 est le plus important : c'est le seul qui distingue « le fichier
 * est arrive » de « la fonction marche ».
 */
(async function () {
  const dort = (ms) => new Promise(r => setTimeout(r, ms));
  const charge = () => [...document.querySelectorAll('script')]
    .some(s => s.src && /lampe-embed\.js/.test(s.src));

  const r = { page: location.href, points: {} };

  // 1. Au repos, rien ne doit partir.
  r.points['1_aucun_telechargement_initial'] = !charge();

  // 2. Un geste, ou l'approche du widget, declenche le chargement.
  const cible = document.getElementById('lampe-embed-root');
  if (!cible) { r.erreur = 'widget absent de la page'; console.log(JSON.stringify(r, null, 1)); return; }
  cible.scrollIntoView();
  dispatchEvent(new Event('scroll'));
  for (let i = 0; i < 20 && !charge(); i++) await dort(250);
  r.points['2_charge_apres_geste'] = charge();

  // 3. Le moteur dessine vraiment.
  await dort(1500);
  const c = cible.querySelector('canvas');
  let pixels = 0;
  if (c) {
    try {
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      for (let i = 3; i < d.length; i += 400) if (d[i] > 0) pixels++;
    } catch (e) { pixels = 'contexte 3D (non lisible en 2D)'; }
  }
  r.pixels_dessines = pixels;
  r.points['3_canvas_non_vide'] = (typeof pixels === 'number' ? pixels > 100 : true);

  r.verdict = Object.values(r.points).every(Boolean) ? 'OK' : 'ECHEC';
  console.log(JSON.stringify(r, null, 1));
  return r;
})();
