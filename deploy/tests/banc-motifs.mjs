// Banc BUBBLE V1 : extrait le coeur geometrique (GEOM-CORE) de la page et prouve
// etancheite, epaisseur perpendiculaire, absence d'auto-intersection, bornes,
// determinisme et distribution. Usage : node deploy/tests/banc-motifs.mjs lampe-3d-studio/index.html [--rapide]
import fs from 'fs';
import crypto from 'crypto';

const html = fs.readFileSync(process.argv[2], 'utf8');
const RAPIDE = process.argv.includes('--rapide');
const iA = html.indexOf('==GEOM-CORE-START==');
const debut = html.lastIndexOf('/*', iA), fin = html.indexOf('/* ==GEOM-CORE-END== */');
if(iA < 0 || fin < 0) throw new Error('marqueurs GEOM-CORE introuvables');
const NOMS = ['motifContexte','motifParams','motifBornes','motifGeo','GENERATEURS_MOTIF','MOTIF_BORNES',
  'buildShellMesh','meshOpenEdges','resampleMeridian','angularSegments','styleStepMm',
  'offsetMeridianInward','surfaceDisplacement','isPerforated','hasRelief','styleLabel','CHAMP'];
const K = new Function('$', html.slice(debut, fin) + '\nreturn {' + NOMS.join(',') + '};')(() => null);

const PROFILS = {
  poser: [{h:0,r:72},{h:35,r:80},{h:110,r:74},{h:180,r:56},{h:230,r:34},{h:245,r:30}],
  cloche: [{h:0,r:95},{h:40,r:88},{h:120,r:58},{h:170,r:40},{h:190,r:28}],
};
const SCULPT = { twistDegPerMm: 0, bendDeg: 0 };
let echecs = 0;
const verdict = (ok, msg) => { if(!ok) echecs++; console.log((ok ? '  PASS ' : '  FAIL ') + msg); };

function surface(motif, profil, wall, extra = {}){
  const surf = { base: 'lisse', smoothing: 45, voroBandMm: 14, motif, ...extra };
  surf.motifCtx = K.motifContexte(motif, profil, wall, 0);
  return surf;
}
function mailler(surf, profil, wall, capSeg){
  let seg = K.angularSegments(surf, 14);
  if(capSeg) seg = Math.min(seg, capSeg);
  const step = K.styleStepMm(surf);
  const base = K.resampleMeridian(profil, surf, capSeg ? Math.max(step, 1.2) : step);
  const t0 = Date.now();
  const tris = K.buildShellMesh(base, wall, seg, surf, SCULPT, base[base.length-1].h);
  return { tris, base, seg, ms: Date.now() - t0 };
}
const empreinte = tris => {
  const h = crypto.createHash('sha256');
  for(const t of tris) for(const v of t) h.update(v[0].toFixed(4) + ',' + v[1].toFixed(4) + ',' + v[2].toFixed(4) + ';');
  return h.digest('hex').slice(0, 16);
};
const fini = tris => tris.every(t => t.every(v => Number.isFinite(v[0]) && Number.isFinite(v[1]) && Number.isFinite(v[2])));

/* Epaisseur PERPENDICULAIRE : depuis un point de la face exterieure, on descend
 * le long de la normale exterieure jusqu'a traverser la face interieure (racine
 * par dichotomie). Couronnes haute et basse exclues (3 mm), ou la paroi est
 * volontairement ramenee a l'horizontale. Hors zones percees. */
function epaisseur(surf, profil, wall, pasTheta, pasH){
  const base = K.resampleMeridian(profil, surf, K.styleStepMm(surf) || 1);
  const inner = K.offsetMeridianInward(base, wall).inner;
  const interp = (poly, h) => {
    if(h <= poly[0].h) return poly[0].r;
    for(let k = 0; k < poly.length - 1; k++) if(h <= poly[k+1].h){
      const t = (h - poly[k].h)/Math.max(1e-9, poly[k+1].h - poly[k].h); return poly[k].r + t*(poly[k+1].r - poly[k].r);
    }
    return poly[poly.length-1].r;
  };
  const d = (th, h) => K.surfaceDisplacement(surf, th, h);
  const ext = (th, h) => { const r = interp(base, h) + d(th, h); return [r*Math.cos(th), r*Math.sin(th), h]; };
  const h0 = base[0].h, h1 = base[base.length-1].h;
  let tMin = Infinity, ecartMin = Infinity, ou = null, n = 0;
  const ctx = surf.motifCtx;
  for(let h = h0 + 3; h <= h1 - 3; h += pasH){
    for(let th = 0; th < 2*Math.PI; th += pasTheta){
      if(ctx && ctx.bornes.ouvert){
        const dur = ctx.G.champ(ctx, th, h).dur;
        if(dur > ctx.bornes.seuil - 0.15) continue;           // bord de trou : autre geometrie
      }
      const e = 0.05, P = ext(th, h);
      const Pt = ext(th + e/Math.max(1, interp(base, h)), h), Ph = ext(th, h + e);
      const u = [Pt[0]-P[0], Pt[1]-P[1], Pt[2]-P[2]], v = [Ph[0]-P[0], Ph[1]-P[1], Ph[2]-P[2]];
      let nx = u[1]*v[2]-u[2]*v[1], ny = u[2]*v[0]-u[0]*v[2], nz = u[0]*v[1]-u[1]*v[0];
      const L = Math.hypot(nx, ny, nz); nx /= L; ny /= L; nz /= L;
      if(nx*Math.cos(th) + ny*Math.sin(th) < 0){ nx = -nx; ny = -ny; nz = -nz; }   // normale sortante
      const f = t => {
        const q = [P[0]-t*nx, P[1]-t*ny, P[2]-t*nz];
        const thq = Math.atan2(q[1], q[0]);
        return Math.hypot(q[0], q[1]) - (interp(inner, q[2]) + d(thq, q[2]));
      };
      if(f(0) <= 0){ ecartMin = Math.min(ecartMin, f(0)); continue; }
      let a = 0, b = 3*wall;
      if(f(b) > 0) continue;
      for(let k = 0; k < 40; k++){ const m = (a+b)/2; if(f(m) > 0) a = m; else b = m; }
      n++;
      if(b < tMin){ tMin = b; ou = { thetaDeg: +(th*180/Math.PI).toFixed(1), h: +h.toFixed(1) }; }
      ecartMin = Math.min(ecartMin, interp(base, h) - interp(inner, h));
    }
  }
  return { tMin, ecartMin, ou, n };
}

function statsGraines(ctx){
  const pts = [];
  ctx.near(0, 0, 1e6, () => {});
  // relit toutes les graines par un balayage complet de l'index
  const vues = new Set();
  for(let s = 0; s <= ctx.geo.S; s += 2) ctx.near(Math.PI, s, ctx.rowsQ + 2, q => { if(!vues.has(q)){ vues.add(q); pts.push(q); } });
  const nn = [], dirs = new Array(12).fill(0);
  for(const p of pts){
    let best = Infinity, bv = null;
    ctx.near(p.th, p.s, ctx.rowsQ + 1, q => {
      if(q === p) return;
      let dt = q.th - p.th; if(dt > Math.PI) dt -= 2*Math.PI; if(dt < -Math.PI) dt += 2*Math.PI;
      const du = dt*(p.r+q.r)/2, dv = q.s - p.s, dd = Math.hypot(du, dv);
      if(dd < best){ best = dd; bv = [du, dv]; }
    });
    if(bv){ nn.push(best/p.R); dirs[Math.floor(((Math.atan2(bv[1], bv[0]) + 2*Math.PI) % Math.PI)/Math.PI*12) % 12]++; }
  }
  const moy = nn.reduce((a,b)=>a+b,0)/nn.length;
  const cv = Math.sqrt(nn.reduce((a,b)=>a+(b-moy)*(b-moy),0)/nn.length)/moy;
  const att = nn.length/12, chi2 = dirs.reduce((a,c)=>a+(c-att)*(c-att)/att, 0);
  return { graines: pts.length, nnMoyenSurR: +moy.toFixed(3), cvNN: +cv.toFixed(3), chi2Directions11ddl: +chi2.toFixed(1) };
}
function statsChamp(surf){
  const ctx = surf.motifCtx, v = [];
  for(let h = ctx.geo.hs[0] + 20; h < ctx.geo.hs[ctx.geo.hs.length-1] - 20; h += 1.5)
    for(let th = 0; th < 2*Math.PI; th += 0.02) v.push(ctx.G.champ(ctx, th, h).s);
  const moy = v.reduce((a,b)=>a+b,0)/v.length;
  const sd = Math.sqrt(v.reduce((a,b)=>a+(b-moy)*(b-moy),0)/v.length);
  const plat = v.filter(x => x < 0.02).length/v.length;
  return { sMoyen: +moy.toFixed(3), sEcartType: +sd.toFixed(3), partPlate: +plat.toFixed(3) };
}

const G = K.GENERATEURS_MOTIF.bubble;
const cfg = (nom, extra = {}) => ({ type: 'bubble', ...G.defauts, ...(G.presets[nom] || {}), ...extra });

console.log('== 1. Presets sur un corps a poser, paroi 1,8 mm, resolution d\'EXPORT');
const signatures = {};
for(const nom of ['Fin', 'Organique', 'Fusion', 'XXL']){
  const m = cfg(nom), wall = 1.8, pr = PROFILS.poser;
  const surf = surface(m, pr, wall);
  const { tris, seg, ms } = mailler(surf, pr, wall, RAPIDE ? 200 : 0);
  const ouv = K.meshOpenEdges(tris);
  const ep = epaisseur(surf, pr, wall, RAPIDE ? 0.03 : 0.012, RAPIDE ? 1.5 : 0.7);
  const B = surf.motifCtx.bornes, st = statsGraines(surf.motifCtx), ch = statsChamp(surf);
  signatures[nom] = ch;
  console.log(`  [${nom}] ${tris.length} triangles, ${seg} segments, ${ms} ms, relief ${B.reliefMm.toFixed(2)} mm (max ${B.reliefMaxMm.toFixed(2)})`, st, ch);
  verdict(ouv === 0, `${nom} : maillage etanche (${ouv} arete(s) ouverte(s))`);
  verdict(fini(tris), `${nom} : aucune coordonnee non finie`);
  verdict(ep.tMin >= K.MOTIF_BORNES.tMinMm - 0.02, `${nom} : epaisseur perpendiculaire mini ${ep.tMin.toFixed(3)} mm >= ${K.MOTIF_BORNES.tMinMm} (${ep.n} rayons, pire ${JSON.stringify(ep.ou)})`);
  verdict(ep.ecartMin > 0, `${nom} : faces jamais croisees (ecart radial mini ${ep.ecartMin.toFixed(3)} mm)`);
  verdict(Math.abs(B.reliefMm) <= B.reliefMaxMm + 1e-9, `${nom} : relief dans la borne`);
  verdict(st.cvNN > 0.05 && st.chi2Directions11ddl < 40, `${nom} : distribution sans grille (cv ${st.cvNN}, chi2 ${st.chi2Directions11ddl})`);
}
const ecarts = [];
const noms = Object.keys(signatures);
for(let i = 0; i < noms.length; i++) for(let j = i+1; j < noms.length; j++){
  const a = signatures[noms[i]], b = signatures[noms[j]];
  ecarts.push(Math.abs(a.sMoyen-b.sMoyen) + Math.abs(a.sEcartType-b.sEcartType) + Math.abs(a.partPlate-b.partPlate));
}
console.log('  graines par preset differentes, champ :', signatures);

console.log('== 2. Relief creuse, ouverture, corps cloche');
for(const [nom, m, pr, wall] of [
  ['Organique creuse', cfg('Organique', { reliefMm: -6 }), PROFILS.cloche, 1.8],
  ['Organique ajouree', cfg('Organique', { densite: 20, ouverture: 70 }), PROFILS.poser, 1.8],
  ['XXL ajouree paroi 1,2', cfg('XXL', { densite: 10, ouverture: 100 }), PROFILS.cloche, 1.2],
]){
  const surf = surface(m, pr, wall);
  const { tris, seg, ms } = mailler(surf, pr, wall, RAPIDE ? 200 : 0);
  const ouv = K.meshOpenEdges(tris), B = surf.motifCtx.bornes;
  const ep = epaisseur(surf, pr, wall, RAPIDE ? 0.03 : 0.015, RAPIDE ? 1.5 : 0.8);
  console.log(`  [${nom}] ${tris.length} tri, ${seg} seg, ${ms} ms, perfore=${K.isPerforated(surf)}, ouvert=${B.ouvert}, seuil ${B.seuil.toFixed(3)} (mini ${surf.motifCtx.A.seuilMin.toFixed(3)}), relief ${B.reliefMm.toFixed(2)}`, B.avert);
  verdict(ouv === 0, `${nom} : maillage etanche (${ouv})`);
  verdict(fini(tris), `${nom} : coordonnees finies`);
  verdict(ep.tMin >= K.MOTIF_BORNES.tMinMm - 0.02, `${nom} : epaisseur perpendiculaire mini ${ep.tMin.toFixed(3)} mm`);
  verdict(ep.ecartMin > 0, `${nom} : faces jamais croisees`);
  if(m.ouverture) verdict(B.seuil >= surf.motifCtx.A.seuilMin - 1e-9, `${nom} : seuil d'ouverture >= seuil mini (nervures >= ${K.MOTIF_BORNES.nervureMinMm} mm)`);
}

console.log('== 3. Bornes par paroi');
for(const wall of [0.8, 1.2, 1.6, 2.0]){
  const m = cfg('XXL', { reliefMm: 12 });
  const p = K.motifParams(m), geo = K.motifGeo(PROFILS.poser, wall);
  const B = K.motifBornes(p, geo, G.analyse(p), 0);
  console.log(`  paroi ${wall} : relief demande 12 -> ${B.reliefMm.toFixed(2)} mm`, B.avert);
  if(wall === 0.8) verdict(B.reliefMm === 0, 'paroi 0,8 mm : aucun relief autorise');
  else verdict(B.reliefMm > 0 && B.reliefMm <= K.CHAMP.ampMaxMm, `paroi ${wall} : relief borne et non nul`);
}
const hors = K.motifParams({ type: 'bubble', tailleMm: 999, densite: -5, fusion: 'x', reliefMm: -99, degrade: 500, ouverture: 1e9, graine: -3 });
verdict(hors.tailleMm === 60 && hors.densite === 0 && hors.fusion === G.defauts.fusion && hors.reliefMm === -8 && hors.degrade === 100 && hors.ouverture === 100 && hors.graine === 1,
  'parametres hors plage ramenes dans les plages de l\'interface');

console.log('== 4. Determinisme');
{
  const pr = PROFILS.poser, wall = 1.8;
  const a = mailler(surface(cfg('Organique'), pr, wall), pr, wall, 160).tris;
  const b = mailler(surface(cfg('Organique'), pr, wall), pr, wall, 160).tris;
  const c = mailler(surface(cfg('Organique', { graine: 2 }), pr, wall), pr, wall, 160).tris;
  verdict(empreinte(a) === empreinte(b), `meme graine, meme maillage (${empreinte(a)})`);
  verdict(empreinte(a) !== empreinte(c), `autre graine, autre maillage (${empreinte(c)})`);
}

console.log('== 5. Balayage aleatoire dans les plages de l\'interface');
{
  let x = 12345; const rnd = () => { x = (x*1103515245 + 12345) % 2147483648; return x/2147483648; };
  const N = RAPIDE ? 8 : 24;
  let pireT = Infinity, pireCfg = null, ouvTot = 0, t0 = Date.now();
  for(let i = 0; i < N; i++){
    const m = { type: 'bubble' };
    for(const r of G.reglages) m[r.cle] = +(r.min + rnd()*(r.max - r.min)).toFixed(1);
    if(rnd() < 0.5) m.ouverture = 0;
    m.graine = 1 + Math.floor(rnd()*500);
    const pr = rnd() < 0.5 ? PROFILS.poser : PROFILS.cloche, wall = [1.2, 1.6, 1.8, 2.0][Math.floor(rnd()*4)];
    const surf = surface(m, pr, wall);
    const { tris } = mailler(surf, pr, wall, 120);
    const o = K.meshOpenEdges(tris); ouvTot += o;
    if(o || !fini(tris)) console.log('   maillage fautif', m, wall, o);
    const ep = epaisseur(surf, pr, wall, 0.05, 2.5);
    if(ep.tMin < pireT){ pireT = ep.tMin; pireCfg = { ...m, wall }; }
    if(ep.ecartMin <= 0) console.log('   faces croisees', m, wall);
  }
  console.log(`  ${N} configurations en ${Date.now()-t0} ms ; pire epaisseur ${pireT.toFixed(3)} mm`, pireCfg);
  verdict(ouvTot === 0, `balayage : ${ouvTot} arete(s) ouverte(s) au total`);
  verdict(pireT >= K.MOTIF_BORNES.tMinMm - 0.03, `balayage : epaisseur perpendiculaire mini ${pireT.toFixed(3)} mm`);
}

console.log(echecs ? `\n${echecs} ECHEC(S)` : '\nTOUT PASSE');
process.exit(echecs ? 1 : 0);
