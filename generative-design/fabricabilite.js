/* Rapport de fabricabilité, côté navigateur, pour le General Design Studio public (bêta publique ouverte le 23/10/2026, sans date de fin définie).
 * Sans DOM : analyserTris(tris, options, onProgress) rend un rapport au format commun de l'atelier
 * (lib/constats.js). Moteurs : lib/geometrie.js (santé, orientation, parois), lib/maillage.js (volume),
 * lib/print_engine.js (masse, temps, coût). Copies de GENERAL DESIGN STUDIO, voir lib/ORIGINE.txt.
 * Convention : les triangles analysés ont leur hauteur sur Z (pièce posée) ; le studio affiche en Y haut. */
import * as G from './lib/geometrie.js?v=2a2ad325';
import { weldMesh, meshStats, meshVolume } from './lib/maillage.js?v=b09a1731';
import { depuisOrientation, fusionner, verdict as verdictDe } from './lib/constats.js?v=afa386ad';
import { estimate, MATERIALS } from './lib/print_engine.js?v=6f8287b5';

export const DEBUT_BETA = '2026-10-23';
export const MACHINES = {
  bambu_a1:     { nom: 'Bambu Lab A1',      bed: [256, 256, 256] },
  bambu_a1mini: { nom: 'Bambu Lab A1 mini', bed: [180, 180, 180] },
  prusa_mk4:    { nom: 'Prusa MK4',         bed: [250, 210, 220] },
  ender3_s1:    { nom: 'Ender-3 S1',        bed: [220, 220, 270] },
};
export { MATERIALS };

// ---------------------------------------------------------------- conversions
export function stlVersTris(buffer) {
  const u8 = new Uint8Array(buffer);
  const enTete = new TextDecoder('latin1').decode(u8.subarray(0, 5));
  const n = u8.length >= 84 ? new DataView(buffer).getUint32(80, true) : 0;
  if (enTete !== 'solid' || 84 + 50 * n === u8.length) {
    if (84 + 50 * n !== u8.length) throw new Error('STL binaire incohérent (taille ≠ 84 + 50 × triangles).');
    const dv = new DataView(buffer), tris = [];
    for (let i = 0; i < n; i++) {
      const o = 84 + 50 * i + 12;
      tris.push([[dv.getFloat32(o, true), dv.getFloat32(o + 4, true), dv.getFloat32(o + 8, true)],
                 [dv.getFloat32(o + 12, true), dv.getFloat32(o + 16, true), dv.getFloat32(o + 20, true)],
                 [dv.getFloat32(o + 24, true), dv.getFloat32(o + 28, true), dv.getFloat32(o + 32, true)]]);
    }
    return tris;
  }
  const texte = new TextDecoder().decode(u8), tris = []; let cur = [];
  for (const ligne of texte.split('\n')) {
    const t = ligne.trim().split(/\s+/);
    if (t[0] === 'vertex') { cur.push([+t[1], +t[2], +t[3]]); if (cur.length === 3) { tris.push(cur); cur = []; } }
  }
  return tris;
}
/** { V, tris } d'un générateur (indices, plats ou non) → triangles [[p,p,p]...] */
export function meshVersTris(mesh) {
  const V = mesh.V, T = mesh.tris;
  const plat = V instanceof Float32Array || V instanceof Float64Array || typeof V[0] === 'number';
  const pt = i => plat ? [V[3 * i], V[3 * i + 1], V[3 * i + 2]] : [V[i][0], V[i][1], V[i][2]];
  const out = [];
  if (!Array.isArray(T) || typeof T[0] === 'number') { for (let i = 0; i + 2 < T.length; i += 3) out.push([pt(T[i]), pt(T[i + 1]), pt(T[i + 2])]); }
  else for (const t of T) out.push([pt(t[0]), pt(t[1]), pt(t[2])]);
  return out;
}
/** réflexion y ↔ z avec ordre inversé : garde les normales sortantes */
export const yVersZ = tris => tris.map(t => [t[2], t[1], t[0]].map(p => [p[0], p[2], p[1]]));
export const zVersY = yVersZ;
export const echelle = (tris, k) => tris.map(t => t.map(p => [p[0] * k, p[1] * k, p[2] * k]));
/** triangles → { V plat Float32Array, tris Uint32Array } pour Three.js (sans soudure : normales plates) */
export function trisVersMesh(tris) {
  const V = new Float32Array(tris.length * 9), I = new Uint32Array(tris.length * 3);
  let k = 0; for (const t of tris) for (const p of t) { V[3 * k] = p[0]; V[3 * k + 1] = p[1]; V[3 * k + 2] = p[2]; I[k] = k; k++; }
  return { V, tris: I, meta: { units: 'mm', source: 'stl' } };
}
export function volumeSigne(tris) {
  let s = 0;
  for (const [a, b, c] of tris) s += a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
  return s / 6;
}
export const normalesSortantes = tris => volumeSigne(tris) < 0 ? tris.map(t => [t[0], t[2], t[1]]) : tris;
function boite(tris) {
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (const t of tris) for (const p of t) for (let k = 0; k < 3; k++) { if (p[k] < mn[k]) mn[k] = p[k]; if (p[k] > mx[k]) mx[k] = p[k]; }
  return { mn, mx, size: mx.map((v, i) => v - mn[i]) };
}
function volumeEtStats(tris) {
  const V = [], idx = [];
  for (const t of tris) { const b = V.length; V.push(t[0], t[1], t[2]); idx.push([b, b + 1, b + 2]); }
  const w = weldMesh(V, idx, 1e-4);
  return { volume: Math.abs(meshVolume(w.V, w.tris)), stats: meshStats(w.V, w.tris), sommets: w.V.length };
}

// ---------------------------------------------------------------- analyse
/** tris : hauteur sur Z, en mm. options : { machine, matiere, buse, nom, origine }. onProgress(0..1). */
export async function analyserTris(tris, options = {}, onProgress = () => {}) {
  const machine = MACHINES[options.machine] || MACHINES.bambu_a1;
  const cleMachine = MACHINES[options.machine] ? options.machine : 'bambu_a1';
  const matiere = MATERIALS[options.matiere] ? options.matiere : 'PLA';
  const buse = +options.buse || 0.4;
  const constats = [], mesures = {};
  onProgress(0.05);
  const sante = G.meshHealth(tris); mesures.sante = sante;
  const vs = volumeEtStats(tris); mesures.volume_mm3 = Math.round(vs.volume); mesures.sommets = vs.sommets; mesures.triangles = tris.length;
  const bb = boite(tris); mesures.boite_mm = bb.size.map(x => +x.toFixed(2));
  if (!sante.watertight) constats.push({ id: 'JUDGE-MANIFOLD', severity: 'HARD', source: 'juge', target: 'piece', msg: `solide non fermé : ${sante.open} arête(s) ouverte(s), ${sante.nm} non manifold`, suggestion: 'réparer (soudure, bouchage) avant tranchage', mesure: { open: sante.open, nm: sante.nm } });
  if (sante.badDir > 0) constats.push({ id: 'JUDGE-NORMALES', severity: 'SOFT', source: 'juge', target: 'piece', msg: `${sante.badDir} triangle(s) orienté(s) à l'envers`, suggestion: 'recalculer les normales vers l\'extérieur', mesure: { badDir: sante.badDir } });
  if (sante.deg > 0) constats.push({ id: 'JUDGE-DEGENERATE', severity: 'SOFT', source: 'juge', target: 'piece', msg: `${sante.deg} triangle(s) dégénéré(s) (aire nulle)`, suggestion: 'sans effet à l\'impression, à nettoyer dans le modèle', mesure: { deg: sante.deg } });
  if (sante.shells > 1) constats.push({ id: 'JUDGE-COQUES', severity: 'OPT', source: 'juge', target: 'piece', msg: `${sante.shells} coques distinctes`, suggestion: 'vérifier qu\'elles se touchent ou s\'unissent au tranchage', mesure: { shells: sante.shells } });
  onProgress(0.2);
  const tient = bb.size[0] <= machine.bed[0] && bb.size[1] <= machine.bed[1] && bb.size[2] <= machine.bed[2];
  if (!tient) constats.push({ id: 'FDM-H001', severity: 'HARD', source: 'canon', target: 'piece', msg: `la pièce (${mesures.boite_mm.join(' × ')} mm) dépasse le volume de ${machine.nom} (${machine.bed.join(' × ')} mm)`, suggestion: 'réduire, découper ou changer de machine', mesure: { boite: mesures.boite_mm, bed: machine.bed } });
  const orient = G.orSign(tris);
  const actuelle = G.orEval(tris, [0, 0, 1], orient);
  const opt = await G.orOptimize(tris, { bed: machine.bed, seuil: 50, maxCand: 12, shortlist: 5, layerH: 0.2, firstH: 0.2, nozzle: buse, lineW: buse * 1.125 }, p => onProgress(0.2 + 0.4 * (p || 0)));
  mesures.surplomb_pct = +actuelle.pctOver.toFixed(1);
  mesures.meilleure_orientation = opt && opt.best ? { nom: opt.best.nom, surplomb_pct: +(opt.best.pctOver || 0).toFixed(1) } : null;
  constats.push(...depuisOrientation({ actuelle, optimisation: opt }));
  onProgress(0.62);
  const seuil = buse * 2;
  try {
    const px = Math.max(seuil / 4, Math.max(bb.size[0], bb.size[1]) / 600, 0.06);
    const th = await G.slAnalyzeThickness(tris, { bed: machine.bed, seuil, screen: false, px }, p => onProgress(0.62 + 0.3 * (p || 0)));
    const pctCrit = th.vol > 0 ? th.critVol / th.vol * 100 : 0, pctWarn = th.vol > 0 ? Math.max(0, th.warnVol - th.critVol) / th.vol * 100 : 0;
    mesures.paroi_min_mm = th.minZone == null ? null : +th.minZone.toFixed(2); mesures.parois_critiques_pct = +pctCrit.toFixed(1); mesures.parois_fragiles_pct = +pctWarn.toFixed(1); mesures.coupes_parois_fines = th.critLayers || 0; mesures.resolution_parois_mm = +px.toFixed(3);
    if (pctCrit > 0.05) constats.push({ id: 'FDM-H002', severity: 'HARD', source: 'canon', target: 'piece', msg: `${pctCrit.toFixed(1)} % de la matière est plus fine qu'un cordon de buse (${buse} mm) sur ${th.critLayers} coupe(s)`, suggestion: `épaissir ces zones à ${(2 * buse).toFixed(1)} mm au moins`, mesure: { pct: pctCrit, coupes: th.critLayers, buse } });
    else if (pctWarn > 2) constats.push({ id: 'FDM-S001', severity: 'SOFT', source: 'canon', target: 'piece', msg: `${pctWarn.toFixed(1)} % de la pièce a des parois entre 1 et 2 cordons de buse : fragiles`, suggestion: `viser ${(2 * buse).toFixed(1)} mm`, mesure: { pct: pctWarn, buse } });
  } catch (e) { mesures.erreur_parois = String(e.message || e); }
  onProgress(0.95);
  const est = estimate({ materialVolumeMm3: vs.volume, bbox: { size: [bb.size[0], bb.size[2], bb.size[1]] } }, cleMachine, matiere);
  mesures.estimation = est;
  const tous = fusionner(constats);
  onProgress(1);
  return {
    schema: 'gds-constats-v1', outil: 'deligny-rd.fr/generative-design', date: new Date().toISOString(),
    beta: { debut: DEBUT_BETA }, piece: { nom: options.nom || 'piece', triangles: tris.length, origine: options.origine || 'studio' },
    machine: cleMachine, materiau: matiere, buse_mm: buse, verdict: verdictDe(tous), constats: tous, mesures,
    sources: [...new Set(tous.map(c => c.source))],
    perimetre: 'santé du maillage, surplombs et orientation, parois fines, volume machine, estimation masse/temps/coût ; sans règles sur les paramètres ni résistance mécanique',
  };
}
