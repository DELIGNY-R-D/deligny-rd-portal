/* GAIA, globe des signaux, rendu en Canvas 2D.
 *
 * POURQUOI PAS three.js. Le globe du poste de pilotage interne tourne sur
 * three.js et OrbitControls, avec une carte de tuiles et une importmap vers un
 * CDN. Rien de tout cela n'est necessaire ici : on dessine des lignes et des
 * points. Une projection orthographique tient en vingt lignes, elle ne demande
 * aucune bibliotheque, elle passe la CSP sans 'unsafe-inline' et elle demarre
 * instantanement sur telephone. Ce qui est montre au visiteur, ce sont les
 * DONNEES ; le moteur 3D n'aurait rien ajoute a leur lecture.
 *
 * PROJECTION ORTHOGRAPHIQUE, forme standard :
 *   cos c = sin(phi0)·sin(phi) + cos(phi0)·cos(phi)·cos(lam - lam0)
 *   un point n'est visible que si cos c >= 0 (il est sur la face tournee vers
 *   nous) ; c'est le seul test de face cachee dont on ait besoin.
 *       x = R·cos(phi)·sin(lam - lam0)
 *       y = R·(cos(phi0)·sin(phi) - sin(phi0)·cos(phi)·cos(lam - lam0))
 */
'use strict';

const $ = (id) => document.getElementById(id);
const RAD = Math.PI / 180;

/* Couleurs par domaine : celles du poste de pilotage interne, pour qu'une
 * capture de l'un se lise avec la legende de l'autre. */
const DOMAINES = {
  seismic:      { nom: 'Séismes',            c: '#e66767' },
  climate:      { nom: 'Climat',            c: '#c98500' },
  markets:      { nom: 'Marchés',            c: '#3987e5' },
  economy:      { nom: 'Économie',           c: '#31a05a' },
  health:       { nom: 'Santé',              c: '#6fd08c' },
  geopolitics:  { nom: 'Géopolitique',       c: '#d55181' },
  wildfires:    { nom: 'Feux de végétation', c: '#b3672c' },
  air_quality:  { nom: "Qualité de l'air",   c: '#1f9e9e' },
  transport:    { nom: 'Transport',         c: '#b0b34a' },
  terrain:      { nom: 'Terrain',           c: '#8c93a4' },
  attention:    { nom: 'Attention',         c: '#9085e9' },
  energy:       { nom: 'Énergie',            c: '#d95926' },
  cybersecurity:{ nom: 'Cybersécurité',      c: '#b0479e' },
};
const domaine = (id) => DOMAINES[id] || { nom: id, c: '#8c93a4' };

const cv = $('globe');
const ctx = cv.getContext('2d');

/* Etat de la camera. `lam0` et `phi0` sont le point du globe place au centre.
 * `zoom` multiplie le rayon calcule d'apres la taille du cadre : la vue reste
 * donc correcte quelle que soit la place disponible. */
const vue = { lam0: 10 * RAD, phi0: 22 * RAD, zoom: 1 };
let L = 0, H = 0, R = 0, cx = 0, cy = 0;      // geometrie logique du cadre

let frontieres = [];   // polylignes [lon,lat,lon,lat,...]
let points = [];       // signaux geolocalises
let masques = new Set();  // domaines decoches
let choisi = null;     // point epingle par un clic
let survole = null;
let ecran = [];        // positions a l'ecran de la derniere image, pour le pointage

/* Rotation lente au repos. Elle s'arrete des qu'on touche le globe : une
 * animation qui continue sous le doigt donne l'impression que la vue derape. */
const MOUVEMENT_REDUIT = matchMedia('(prefers-reduced-motion: reduce)').matches;
let tourne = !MOUVEMENT_REDUIT;

/* ── Cadre et definition ────────────────────────────────────────────────
 * On garde un systeme de coordonnees LOGIQUE en pixels CSS et on augmente la
 * memoire de rendu selon l'ecran : sans cela, les filets des cotes bavent sur
 * un ecran a haute densite. */
function ajusterCadre() {
  const r = cv.getBoundingClientRect();
  L = Math.max(1, Math.round(r.width));
  H = Math.max(1, Math.round(r.height));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.round(L * dpr), h = Math.round(H * dpr);
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  ctx.setTransform(cv.width / L, 0, 0, cv.height / H, 0, 0);
  cx = L / 2;
  cy = H / 2;
  R = Math.min(L, H) * 0.42 * vue.zoom;
}

function projete(lon, lat) {
  const lam = lon * RAD, phi = lat * RAD;
  const sp0 = Math.sin(vue.phi0), cp0 = Math.cos(vue.phi0);
  const sp = Math.sin(phi), cp = Math.cos(phi);
  const dl = lam - vue.lam0;
  const cosc = sp0 * sp + cp0 * cp * Math.cos(dl);
  return {
    x: cx + R * cp * Math.sin(dl),
    y: cy - R * (cp0 * sp - sp0 * cp * Math.cos(dl)),
    vu: cosc >= 0,
    prof: cosc,
  };
}

/* ── Dessin ─────────────────────────────────────────────────────────── */
function dessine() {
  ajusterCadre();
  ctx.clearRect(0, 0, L, H);

  // Le globe : un dégradé decale vers le haut a gauche, comme un eclairage
  // rasant. C'est ce qui donne le volume ; un aplat lirait comme un disque.
  const g = ctx.createRadialGradient(cx - R * 0.34, cy - R * 0.38, R * 0.12, cx, cy, R);
  g.addColorStop(0, '#16233a');
  g.addColorStop(0.62, '#0e1727');
  g.addColorStop(1, '#080d16');
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = g; ctx.fill();

  // halo exterieur
  ctx.strokeStyle = 'rgba(120,165,235,.20)';
  ctx.lineWidth = 1.2; ctx.stroke();

  grille();
  cotes();
  signaux();
}

function grille() {
  ctx.strokeStyle = 'rgba(255,255,255,.055)';
  ctx.lineWidth = 1;
  for (let lat = -60; lat <= 60; lat += 30) {   // paralleles
    ctx.beginPath();
    let leve = true;
    for (let lon = -180; lon <= 180; lon += 3) {
      const p = projete(lon, lat);
      if (!p.vu) { leve = true; continue; }
      if (leve) { ctx.moveTo(p.x, p.y); leve = false; } else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
  for (let lon = -180; lon < 180; lon += 30) {  // meridiens
    ctx.beginPath();
    let leve = true;
    for (let lat = -90; lat <= 90; lat += 3) {
      const p = projete(lon, lat);
      if (!p.vu) { leve = true; continue; }
      if (leve) { ctx.moveTo(p.x, p.y); leve = false; } else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
}

function cotes() {
  ctx.strokeStyle = 'rgba(174,197,232,.46)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const ligne of frontieres) {
    let leve = true;
    for (let i = 0; i < ligne.length; i += 2) {
      const p = projete(ligne[i], ligne[i + 1]);
      // Un segment dont une extremite passe derriere l'horizon est coupe net :
      // le relier au point suivant tracerait une corde a travers le globe.
      if (!p.vu) { leve = true; continue; }
      if (leve) { ctx.moveTo(p.x, p.y); leve = false; } else ctx.lineTo(p.x, p.y);
    }
  }
  ctx.stroke();
}

function signaux() {
  ecran = [];
  const visibles = [];
  for (const s of points) {
    if (masques.has(s.domaine)) continue;
    const p = projete(s.lon, s.lat);
    if (!p.vu) continue;
    visibles.push({ s, p });
  }
  // du plus lointain au plus proche : les points du bord passent DERRIERE ceux
  // du centre, sinon un signal au limbe recouvre celui qui nous fait face
  visibles.sort((a, b) => a.p.prof - b.p.prof);

  for (const { s, p } of visibles) {
    const c = domaine(s.domaine).c;
    const actif = (choisi === s) || (survole === s);
    const r = actif ? 5 : 3.2;
    ctx.beginPath(); ctx.arc(p.x, p.y, r * 3.1, 0, Math.PI * 2);
    ctx.fillStyle = c; ctx.globalAlpha = actif ? 0.30 : 0.16; ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = c; ctx.fill();
    if (actif) {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4; ctx.stroke();
    }
    ecran.push({ s, x: p.x, y: p.y });
  }
}

/* ── Boucle ─────────────────────────────────────────────────────────── */
let dernier = 0;
function image(t) {
  const dt = dernier ? Math.min(60, t - dernier) : 16;
  dernier = t;
  if (tourne && !glisse) vue.lam0 += dt * 0.000045;
  dessine();
  requestAnimationFrame(image);
}

/* ── Manipulation ───────────────────────────────────────────────────── */
let glisse = false, dernierX = 0, dernierY = 0, bouge = 0;
let pointeurs = new Map(), ecartPince = 0;

cv.addEventListener('pointerdown', (e) => {
  cv.setPointerCapture(e.pointerId);
  pointeurs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointeurs.size === 2) {
    const [a, b] = [...pointeurs.values()];
    ecartPince = Math.hypot(a.x - b.x, a.y - b.y);
  }
  glisse = true; bouge = 0;
  dernierX = e.clientX; dernierY = e.clientY;
  cv.classList.add('tire');
});

cv.addEventListener('pointermove', (e) => {
  if (pointeurs.has(e.pointerId)) pointeurs.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (pointeurs.size === 2) {           // pincement : zoom
    const [a, b] = [...pointeurs.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (ecartPince > 0) applique(d / ecartPince);
    ecartPince = d;
    bouge = 99;
    return;
  }

  if (glisse) {
    const dx = e.clientX - dernierX, dy = e.clientY - dernierY;
    dernierX = e.clientX; dernierY = e.clientY;
    bouge += Math.abs(dx) + Math.abs(dy);
    // le deplacement angulaire depend du rayon : a fort zoom, un meme geste
    // doit tourner MOINS, sinon la vue devient impilotable
    vue.lam0 -= (dx / R) * 0.9;
    vue.phi0 = Math.max(-84 * RAD, Math.min(84 * RAD, vue.phi0 + (dy / R) * 0.9));
    return;
  }

  const s = vise(e);
  if (s !== survole) { survole = s; fiche(choisi || survole); }
});

function fini(e) {
  pointeurs.delete(e.pointerId);
  if (pointeurs.size < 2) ecartPince = 0;
  if (pointeurs.size === 0) {
    // un clic net (peu de deplacement) epingle le signal vise, ou le libere
    if (bouge < 5) {
      const s = vise(e);
      choisi = (s && s !== choisi) ? s : null;
      fiche(choisi);
    }
    glisse = false;
    cv.classList.remove('tire');
  }
}
cv.addEventListener('pointerup', fini);
cv.addEventListener('pointercancel', fini);
cv.addEventListener('pointerleave', () => { survole = null; fiche(choisi); });

cv.addEventListener('wheel', (e) => {
  e.preventDefault();
  applique(Math.exp(-e.deltaY * 0.0016));
}, { passive: false });

function applique(k) {
  vue.zoom = Math.max(0.62, Math.min(4.2, vue.zoom * k));
}

/* Vise le signal le plus proche du pointeur. Le seuil est en pixels, pas en
 * degres : ce qui compte est ce que le doigt peut atteindre. */
function vise(e) {
  const r = cv.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  let best = null, bd = 15;
  for (const p of ecran) {
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bd) { bd = d; best = p.s; }
  }
  return best;
}

/* ── Fiche ──────────────────────────────────────────────────────────── */
function fiche(s) {
  const el = $('fiche');
  if (!s) { el.hidden = true; return; }
  const d = domaine(s.domaine);
  $('f-domaine').textContent = d.nom;
  $('f-domaine').style.color = d.c;
  $('f-lieu').textContent = s.lieu;
  const v = (typeof s.valeur === 'number')
    ? s.valeur.toLocaleString('fr-FR', { maximumFractionDigits: 2 })
    : s.valeur;
  $('f-valeur').textContent = s.mesure + ' : ' + v + (s.unite ? ' ' + s.unite : '');
  $('f-source').textContent = 'source ' + s.source + ' · ' + s.le.replace('T', ' ') + ' UTC';
  el.hidden = false;
}

/* ── Legende ────────────────────────────────────────────────────────── */
function legende() {
  const compte = new Map();
  for (const s of points) compte.set(s.domaine, (compte.get(s.domaine) || 0) + 1);
  const ul = $('legende');
  ul.textContent = '';
  [...compte.entries()].sort((a, b) => b[1] - a[1]).forEach(([id, n]) => {
    const d = domaine(id);
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-pressed', 'true');
    const pas = document.createElement('span');
    pas.className = 'pastille'; pas.style.background = d.c;
    const nom = document.createElement('span'); nom.textContent = d.nom;
    const cnt = document.createElement('span'); cnt.className = 'n'; cnt.textContent = n;
    b.append(pas, nom, cnt);
    b.addEventListener('click', () => {
      if (masques.has(id)) masques.delete(id); else masques.add(id);
      b.setAttribute('aria-pressed', masques.has(id) ? 'false' : 'true');
      if (choisi && choisi.domaine === id && masques.has(id)) { choisi = null; fiche(null); }
    });
    li.appendChild(b); ul.appendChild(li);
  });
}

/* ── Commandes ──────────────────────────────────────────────────────── */
$('btn-tourne').addEventListener('click', () => {
  // Un clic EXPLICITE l'emporte sur la preference systeme : demander la
  // rotation et ne rien obtenir serait un bouton mort.
  tourne = !tourne;
  $('btn-tourne').setAttribute('aria-pressed', String(tourne));
  $('btn-tourne').textContent = tourne ? 'Rotation en cours' : 'Rotation arrêtée';
});
$('btn-recadre').addEventListener('click', () => {
  vue.lam0 = 10 * RAD; vue.phi0 = 22 * RAD; vue.zoom = 1;
  choisi = null; fiche(null);
});
addEventListener('resize', ajusterCadre, { passive: true });

/* ── Chargement ─────────────────────────────────────────────────────── */
async function demarre() {
  $('btn-tourne').setAttribute('aria-pressed', String(tourne));
  $('btn-tourne').textContent = tourne ? 'Rotation en cours' : 'Rotation arrêtée';
  try {
    const [f, s] = await Promise.all([
      fetch('data/frontieres.json').then((r) => r.json()),
      fetch('data/signaux.json').then((r) => r.json()),
    ]);
    frontieres = f;
    points = s.points;
    $('compte').textContent = String(points.length);
    $('preleve').textContent = (s.preleve_le || '').slice(0, 16).replace('T', ' à ') + ' UTC';
    legende();
  } catch (e) {
    // Silence non declare interdit : si les donnees manquent, on le DIT, on ne
    // laisse pas un globe vide passer pour un monde calme.
    $('preleve').textContent = 'instantané illisible';
    $('compte').textContent = '0';
  }
  requestAnimationFrame(image);
}
demarre();
