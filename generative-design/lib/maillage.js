/* ============================================================================
 * MAILLAGE — soudure et contrôle d'étanchéité (lot F1 de l'audit, 22/10/2026)
 * ----------------------------------------------------------------------------
 * Module pur, sans dépendance, importable dans le navigateur comme sous Node.
 * Un maillage est { V: [[x,y,z], ...], tris: [[a,b,c], ...] } en millimètres.
 *
 *  weldMesh(V, tris, tol)  : fusionne les sommets coïncidents (à tol près) et retire
 *                            les triangles dégénérés. Les générateurs qui posent
 *                            chaque face avec ses propres sommets deviennent des
 *                            coques fermées après soudure.
 *  isWatertight(V, tris)   : vrai si chaque arête est partagée par exactement deux
 *                            triangles. Des coques fermées qui se chevauchent passent
 *                            (les trancheurs les unissent) ; une coque ouverte échoue.
 *  meshStats(V, tris)      : arêtes totales, arêtes de bord, arêtes sur-partagées.
 * ==========================================================================*/

export function weldMesh(V, tris, tol = 1e-6) {
  const q = 1 / tol;
  const map = new Map(), NV = [], remap = new Array(V.length);
  for (let i = 0; i < V.length; i++) {
    const p = V[i];
    const k = Math.round(p[0] * q) + ',' + Math.round(p[1] * q) + ',' + Math.round(p[2] * q);
    let j = map.get(k);
    if (j === undefined) { j = NV.length; NV.push([p[0], p[1], p[2]]); map.set(k, j); }
    remap[i] = j;
  }
  const NT = [];
  for (const t of tris) {
    const a = remap[t[0]], b = remap[t[1]], c = remap[t[2]];
    if (a === b || b === c || a === c) continue;
    NT.push([a, b, c]);
  }
  return { V: NV, tris: NT };
}

export function meshStats(V, tris) {
  const cnt = new Map();
  for (const t of tris) {
    for (let i = 0; i < 3; i++) {
      const a = t[i], b = t[(i + 1) % 3];
      const k = a < b ? a + '_' + b : b + '_' + a;
      cnt.set(k, (cnt.get(k) || 0) + 1);
    }
  }
  let bord = 0, sur = 0;
  for (const n of cnt.values()) { if (n === 1) bord++; else if (n > 2) sur++; }
  return { aretes: cnt.size, bord, surPartagees: sur };
}

export function isWatertight(V, tris) {
  const s = meshStats(V, tris);
  return s.bord === 0 && s.surPartagees === 0;
}

/** Soude, mesure, et complète meta : watertight (mesuré), verts, triangles. */
export function meshVolume(V, tris) {
  let s = 0;
  for (const [a, b, c] of tris) { const A = V[a], B = V[b], C = V[c];
    s += A[0]*(B[1]*C[2]-B[2]*C[1]) - A[1]*(B[0]*C[2]-B[2]*C[0]) + A[2]*(B[0]*C[1]-B[1]*C[0]); }
  return s / 6;
}

export function finaliser(V, tris, meta = {}, tol = 1e-6) {
  const m = weldMesh(V, tris, tol);
  const st = meshStats(m.V, m.tris);
  return { V: m.V, tris: m.tris, meta: { ...meta, watertight: st.bord === 0 && st.surPartagees === 0,
    aretesBord: st.bord, volumeMailleMm3: Math.round(meshVolume(m.V, m.tris)), verts: m.V.length, triangles: m.tris.length } };
}

/** Prisme fermé : polygone plan (liste de [u,v]) extrudé le long d'un axe.
 *  axe = 'x' : le polygone est en (y,z) et s'étend de x0 à x1. Orientation sortante garantie
 *  quel que soit le sens du polygone. Rend { V, tris } non soudé (à passer dans finaliser). */
export function prismeFerme(poly, axe, x0, x1) {
  // aire signée pour orienter
  let a2 = 0;
  for (let i = 0; i < poly.length; i++) { const [u1, v1] = poly[i], [u2, v2] = poly[(i + 1) % poly.length]; a2 += u1 * v2 - u2 * v1; }
  const ccw = a2 > 0;
  const P = ccw ? poly : poly.slice().reverse();
  const n = P.length;
  const pt = (uv, s) => axe === 'x' ? [s, uv[0], uv[1]] : axe === 'y' ? [uv[1], s, uv[0]] : [uv[0], uv[1], s];
  const V = [];
  for (const uv of P) V.push(pt(uv, x0));   // 0..n-1 : face x0
  for (const uv of P) V.push(pt(uv, x1));   // n..2n-1 : face x1
  const tris = [];
  // triangulation en éventail (polygones convexes ou en L simple : éventail depuis un sommet convexe
  // n'est pas sûr pour un L ; on découpe par oreilles)
  const ears = oreilles(P);
  for (const [i, j, k] of ears) { tris.push([i, k, j]); tris.push([n + i, n + j, n + k]); }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    tris.push([i, j, n + j]); tris.push([i, n + j, n + i]);
  }
  return { V, tris };
}

/** Découpe par oreilles d'un polygone simple (CCW), rend des triplets d'indices. */
function oreilles(P) {
  const idx = P.map((_, i) => i);
  const out = [];
  const cross = (a, b, c) => (P[b][0] - P[a][0]) * (P[c][1] - P[a][1]) - (P[b][1] - P[a][1]) * (P[c][0] - P[a][0]);
  const dedans = (p, a, b, c) => {
    const d1 = (P[b][0] - P[a][0]) * (p[1] - P[a][1]) - (P[b][1] - P[a][1]) * (p[0] - P[a][0]);
    const d2 = (P[c][0] - P[b][0]) * (p[1] - P[b][1]) - (P[c][1] - P[b][1]) * (p[0] - P[b][0]);
    const d3 = (P[a][0] - P[c][0]) * (p[1] - P[c][1]) - (P[a][1] - P[c][1]) * (p[0] - P[c][0]);
    return d1 > 1e-12 && d2 > 1e-12 && d3 > 1e-12;
  };
  let garde = 0;
  while (idx.length > 3 && garde++ < 10000) {
    let coupe = false;
    for (let k = 0; k < idx.length; k++) {
      const a = idx[(k + idx.length - 1) % idx.length], b = idx[k], c = idx[(k + 1) % idx.length];
      if (cross(a, b, c) <= 0) continue;                       // réflexe
      let libre = true;
      for (const m of idx) { if (m !== a && m !== b && m !== c && dedans(P[m], a, b, c)) { libre = false; break; } }
      if (!libre) continue;
      out.push([a, b, c]); idx.splice(k, 1); coupe = true; break;
    }
    if (!coupe) break;
  }
  if (idx.length === 3) out.push([idx[0], idx[1], idx[2]]);
  return out;
}

export default { weldMesh, meshStats, isWatertight, meshVolume, finaliser, prismeFerme };
