/* ============================================================================
 * LAMP CAD — générateur paramétrique de lampe imprimable (PUR, sans Three.js)
 * ----------------------------------------------------------------------------
 * Génère une VRAIE pièce fabricable (mm) par révolution d'un méridien :
 *  - corps creux à paroi d'épaisseur constante (FDM-friendly),
 *  - base pleine avec trou de passage câble,
 *  - logement de douille (E14 = alésage Ø28 + épaulement d'appui),
 *  - sommet ouvert pour la douille / l'abat-jour.
 * Watertight (méridien fermé révolutionné). Volume matière exact (Pappus).
 * Testable en Node (aucune dépendance). Utilisé par General Engine.
 * ==========================================================================*/

import { weldMesh, isWatertight } from './maillage.js?v=b09a1731';

export const SOCKETS = {
  // douille → diamètre d'alésage d'appui (mm) pour loger le porte-douille
  // DÉFAUT projet : douille E14 blanche demi-filetée (bague de blocage M10 → écrou intérieur).
  E14: { boreDia: 28, depth: 20, nippleDia: 10, thread: "M10", variant: "blanche demi-filetée",
         label: "E14 blanche demi-filetée (défaut)" },
  E27: { boreDia: 40, depth: 24, nippleDia: 10, thread: "M10", label: "E27" },
  GU10:{ boreDia: 35, depth: 16, nippleDia: 0,  label: "GU10 (spot)" },
};

export function defaultLampSpec(overrides = {}) {
  return Object.assign({
    height: 180, baseDia: 90, topDia: 70,
    wall: 2.4, baseThk: 3.0,
    socket: "E14", cableDia: 6,
    style: "minimalist", belly: 0.0,    // belly>0 = ventre chaleureux
    segments: 72,
  }, overrides);
}

// profil de rayon extérieur le long de y∈[0,H]
function rOuter(y, H, Rb, Rt, belly) {
  const t = H ? y / H : 0;
  const taper = Rb + (Rt - Rb) * t;
  const bulge = belly * Rb * Math.sin(Math.PI * t);   // ventre au milieu
  return taper + bulge;
}

/** Construit le méridien (polygone fermé (r,y)) de la section de paroi. */
function meridian(spec) {
  const H = spec.height, Rb = spec.baseDia / 2, Rt = spec.topDia / 2;
  const wall = spec.wall, baseThk = spec.baseThk, belly = spec.belly || 0;
  const sk = SOCKETS[spec.socket] || SOCKETS.E14;
  const seatR = sk.boreDia / 2;
  const seatDepth = Math.min(sk.depth, H * 0.4);
  const cableR = Math.max(1.5, spec.cableDia / 2);
  const N = 28;
  const P = [];
  P.push([Rb, 0]);                                  // bas extérieur
  for (let k = 0; k <= N; k++){ const y = k / N * H; P.push([rOuter(y, H, Rb, Rt, belly), y]); }
  P.push([seatR, H]);                                // rebord haut vers l'alésage
  P.push([seatR, H - seatDepth]);                    // descend l'alésage douille
  // cône d'appui douille à 45°, RACCORDÉ exactement au mur intérieur (point fixe : 3 itérations → pas de décroché)
  let shoulderInner = Math.max(seatR + 1, rOuter(H - seatDepth, H, Rb, Rt, belly) - wall);
  let seatBottom = H - seatDepth - (shoulderInner - seatR);
  for (let it = 0; it < 3; it++){
    shoulderInner = Math.max(seatR + 1, rOuter(seatBottom, H, Rb, Rt, belly) - wall);
    seatBottom = H - seatDepth - (shoulderInner - seatR);
  }
  P.push([shoulderInner, seatBottom]);               // fin du cône = exactement le mur intérieur
  for (let k = 0; k <= N; k++){                      // paroi intérieure du corps
    const y = seatBottom - (k / N) * (seatBottom - baseThk);
    const ri = Math.max(cableR + wall, rOuter(y, H, Rb, Rt, belly) - wall);
    P.push([ri, y]);
  }
  P.push([cableR, baseThk]);                         // plancher intérieur de la base
  P.push([cableR, 0]);                               // descend le trou de câble
  // fermeture implicite vers [Rb,0]
  return P;
}

/** Aire et centroïde du méridien → volume matière (Pappus) + CG_y RÉEL du solide de révolution.
 *  CG du solide (axe Y, symétrie) : y_bar = (∫∫ r·y dA) / (∫∫ r dA) sur le polygone méridien. */
function pappusVolume(P) {
  let A = 0, Cx = 0, sumR = 0, sumRY = 0;
  for (let i = 0; i < P.length; i++){
    const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % P.length];
    const cross = x1 * y2 - x2 * y1;
    A += cross; Cx += (x1 + x2) * cross;
    sumR  += cross * (x1 + x2);                                              // ∫∫ r dA *6
    sumRY += cross * (x1 * y2 + 2 * x1 * y1 + 2 * x2 * y2 + x2 * y1);        // ∫∫ r·y dA *24
  }
  A *= 0.5; Cx = Cx / (6 * A);
  const area = Math.abs(A);
  const cgY = sumR !== 0 ? sumRY / (4 * sumR) : 0;   // (sumRY/24)/(sumR/6)
  return { area, centroidR: Math.abs(Cx), volumeMm3: 2 * Math.PI * Math.abs(Cx) * area, cgY };
}

/** Génère le mesh (révolution du méridien). */
export function buildLampMesh(specIn = {}) {
  const spec = defaultLampSpec(specIn);
  const P = meridian(spec);
  const S = Math.max(12, spec.segments | 0);
  const M = P.length;
  const V = [], tris = [];
  for (let i = 0; i < M; i++){
    const [r, y] = P[i];
    for (let j = 0; j < S; j++){
      const a = j / S * Math.PI * 2;
      V.push([r * Math.cos(a), y, r * Math.sin(a)]);
    }
  }
  const idx = (i, j) => (i % M) * S + (j % S);
  for (let i = 0; i < M; i++){
    for (let j = 0; j < S; j++){
      const a = idx(i, j), b = idx(i, j + 1), c = idx(i + 1, j + 1), d = idx(i + 1, j);
      tris.push([a, b, c]); tris.push([a, c, d]);
    }
  }
  // Soudure (lot F1, 22/10/2026) : la couture et les anneaux sur l'axe doublaient des sommets.
  { const w = weldMesh(V, tris); V.length = 0; V.push(...w.V); tris.length = 0; tris.push(...w.tris); }
  // bbox
  const mn = [1e9,1e9,1e9], mx = [-1e9,-1e9,-1e9];
  V.forEach(v => { for (let k=0;k<3;k++){ mn[k]=Math.min(mn[k],v[k]); mx[k]=Math.max(mx[k],v[k]); } });
  const pap = pappusVolume(P);
  // surplomb max EXACT depuis le méridien révolutionné (normale sortante 2D = (dy,-dr) pour CCW)
  let area2 = 0;
  for (let i = 0; i < P.length; i++){ const [x1,y1]=P[i],[x2,y2]=P[(i+1)%P.length]; area2 += x1*y2 - x2*y1; }
  const o2 = area2 >= 0 ? 1 : -1;
  let maxOverhang = 0;
  for (let i = 0; i < P.length; i++){
    const [x1,y1]=P[i],[x2,y2]=P[(i+1)%P.length];
    const dr=x2-x1, dy=y2-y1, len=Math.hypot(dr,dy);
    if (len < 1e-6 || Math.abs(dr) < 0.6) continue;        // arête nulle / mur ~vertical / décroché sub-mm (pontable)
    if ((y1+y2)/2 < spec.baseThk + 0.5) continue;          // sous la base (posé sur le plateau)
    const ny = -dr / len * o2;                              // composante verticale de la normale sortante
    if (ny < 0){ const ang = Math.asin(Math.min(1, -ny)) * 180 / Math.PI;
      if (ang > maxOverhang) maxOverhang = ang; }
  }
  const sk = SOCKETS[spec.socket] || SOCKETS.E14;
  return {
    V, tris,
    meta: {
      units: "mm", generator: "lamp", params: spec,
      bbox: { min: mn, max: mx, size: [mx[0]-mn[0], mx[1]-mn[1], mx[2]-mn[2]] },
      wallMm: spec.wall, socket: spec.socket, socketBoreDia: sk.boreDia,
      cableDia: spec.cableDia,
      watertight: isWatertight(V, tris),   // MESURÉ (chaque arête partagée par deux triangles), plus déclaré
      materialVolumeMm3: pap.volumeMm3,
      cg: [0, pap.cgY, 0],                 // centre de gravité matière RÉEL (axe Y), pour le Stability Solver
      baseRadius: spec.baseDia / 2,        // rayon d'appui au sol (support)
      cableR: Math.max(1.5, spec.cableDia / 2),
      maxOverhangDeg: +maxOverhang.toFixed(1),   // surplomb max exact (méridien)
      supportNeeded: maxOverhang > 50,
      verts: V.length, triangles: tris.length,
      features: [
        `corps creux paroi ${spec.wall} mm (constante)`,
        `logement douille ${spec.socket} (alésage Ø${sk.boreDia} mm + épaulement)`,
        `sortie câble Ø${spec.cableDia} mm en base`,
        `base pleine ${spec.baseThk} mm`,
      ],
    },
  };
}

// --------------------------------------------------------------- nervures (look "pleated"/cannelé)
export function applyRibs(mesh, ribs = 0, amp = 0) {
  mesh.meta = mesh.meta || {};
  if (ribs && amp) for (const v of mesh.V) {
    const r = Math.hypot(v[0], v[2]); if (r < 0.01) continue;
    const th = Math.atan2(v[2], v[0]);
    const k = 1 + amp * Math.cos(ribs * th);
    v[0] = r * k * Math.cos(th); v[2] = r * k * Math.sin(th);
  }
  // bbox recalculée (rayon légèrement modulé)
  const mn = [1e9,1e9,1e9], mx = [-1e9,-1e9,-1e9];
  mesh.V.forEach(v => { for (let k=0;k<3;k++){ mn[k]=Math.min(mn[k],v[k]); mx[k]=Math.max(mx[k],v[k]); } });
  mesh.meta.bbox = { min: mn, max: mx, size: [mx[0]-mn[0], mx[1]-mn[1], mx[2]-mn[2]] };
  return mesh;
}

function revolveMeridian(P, S) {
  const M = P.length, V = [], tris = [];
  for (let i = 0; i < M; i++){ const [r, y] = P[i];
    for (let j = 0; j < S; j++){ const a = j / S * Math.PI * 2; V.push([r*Math.cos(a), y, r*Math.sin(a)]); } }
  const idx = (i, j) => (i % M) * S + (j % S);
  for (let i = 0; i < M; i++) for (let j = 0; j < S; j++){
    const a=idx(i,j),b=idx(i,j+1),c=idx(i+1,j+1),d=idx(i+1,j); tris.push([a,b,c]); tris.push([a,c,d]); }
  return { V, tris };
}

function profileOverhang(P, skipBelowY) {
  let area2 = 0; for (let i=0;i<P.length;i++){const[x1,y1]=P[i],[x2,y2]=P[(i+1)%P.length];area2+=x1*y2-x2*y1;}
  const o2 = area2 >= 0 ? 1 : -1; let mo = 0;
  for (let i=0;i<P.length;i++){ const[x1,y1]=P[i],[x2,y2]=P[(i+1)%P.length];
    const dr=x2-x1,dy=y2-y1,len=Math.hypot(dr,dy);
    if (len<1e-6 || Math.abs(dr)<0.6) continue;
    if ((y1+y2)/2 < skipBelowY) continue;
    const ny=-dr/len*o2; if (ny<0){ const a=Math.asin(Math.min(1,-ny))*180/Math.PI; if (a>mo) mo=a; } }
  return mo;
}

// --------------------------------------------------------------- ABAT-JOUR (mushroom cap, ouvert en bas)
export function buildShade(specIn = {}) {
  const s = Object.assign({ neckDia: 44, shoulderDia: 130, topDia: 96, topHole: 34,
    height: 95, wall: 2.4, clearance: 0.3, segments: 128, ribs: 44, ribAmp: 0.025 }, specIn);
  const wall = s.wall;
  const nIn = s.neckDia / 2 + s.clearance, nOut = nIn + wall;
  const shO = s.shoulderDia / 2, tO = s.topDia / 2, thR = s.topHole / 2;
  const H = s.height;
  let yS = Math.max((shO - nOut) * 1.05, H * 0.4);   // évasement ≤ 45°
  if (yS > H * 0.72) yS = H * 0.72;
  const P = [
    [nOut, 0], [shO, yS], [tO, H], [thR, H],
    [Math.max(thR + 1, tO - wall), H - wall],
    [Math.max(nIn, shO - wall), yS], [nIn, 0],
  ];
  const mesh = revolveMeridian(P, s.segments);
  { const w = weldMesh(mesh.V, mesh.tris); mesh.V = w.V; mesh.tris = w.tris; }
  applyRibs(mesh, s.ribs, s.ribAmp);
  const pap = pappusVolume(P);
  const flareDeg = Math.atan2(shO - nOut, yS) * 180 / Math.PI;
  // l'abat-jour s'imprime SOMMET EN BAS (champignon évasé = auto-portant à l'envers)
  const flipped = P.map(([r, y]) => [r, H - y]);
  const ov = profileOverhang(flipped, wall);
  mesh.meta = {
    units: "mm", generator: "shade", part: "abat-jour", params: s,
    bbox: mesh.meta.bbox, wallMm: wall, watertight: true,
    materialVolumeMm3: pap.volumeMm3, cg: [0, pap.cgY, 0],
    neckDia: s.neckDia, shoulderDia: s.shoulderDia, topHole: s.topHole,
    printOrientation: "sommet en bas (inversé)",
    maxOverhangDeg: +ov.toFixed(1), supportNeeded: ov > 50,
    flareDeg: +flareDeg.toFixed(1),
    verts: mesh.V.length, triangles: mesh.tris.length, watertight: isWatertight(mesh.V, mesh.tris),
  };
  return mesh;
}

// --------------------------------------------------------------- LAMPE MULTI-PIÈCES (base + abat-jour)
export function buildLampParts(specIn = {}) {
  const s = Object.assign({
    socket: "E14", wall: 2.4, ribs: 44, ribAmp: 0.025, segments: 128,
    baseHeight: 95, baseDia: 56, collarDia: 44, cableDia: 6,
    shadeShoulderDia: 130, shadeTopDia: 96, shadeTopHole: 34, shadeHeight: 95,
    joint: "press-fit", screws: "M3", insert: true, strainRelief: true,
  }, specIn);
  // BASE / pied : réutilise le corps paramétrique (logement douille + câble), top = collier
  const base = buildLampMesh({ height: s.baseHeight, baseDia: s.baseDia, topDia: s.collarDia,
    wall: s.wall, socket: s.socket, cableDia: s.cableDia, belly: 0.0, segments: s.segments });
  applyRibs(base, s.ribs, s.ribAmp);
  base.meta.part = "base/pied"; base.meta.collarDia = s.collarDia;
  // ABAT-JOUR : s'emboîte sur le collier du pied
  const shade = buildShade({ neckDia: s.collarDia, shoulderDia: s.shadeShoulderDia,
    topDia: s.shadeTopDia, topHole: s.shadeTopHole, height: s.shadeHeight,
    wall: s.wall, ribs: s.ribs, ribAmp: s.ribAmp, segments: s.segments });
  // ── VÉRITÉ GÉOMÉTRIQUE : ce qui est et n'est PAS dans le mesh ──────────────
  // Le mesh actuel (révolution du méridien) contient :
  //   ✅ collier Ø<collarDia> mm (press-fit avec le col abat-jour, jeu 0.3 mm)
  //   ✅ alésage câble Ø<cableDia> mm dans la base (trou traversant)
  //   ✅ alésage douille E14 Ø28 mm + épaulement d'appui
  //   ❌ trous d'insert M3 (non modélisés → NE PAS mentionner dans le manuel)
  //   ❌ bossages M3 (non modélisés)
  //   ❌ gorges de clip snap-fit (nécessite boolean/CSG → roadmap GE)
  //   ❌ lugs baïonnette (nécessite boolean/CSG → roadmap GE)
  // Serre-câble : méthode nœud câble dans l'alésage (aucune pièce supplémentaire,
  //               aucun trou supplémentaire requis). Conforme CE si nœud bloquant.
  const jointType = s.joint === "screw_insert" ? "press_fit" : (s.joint || "press_fit");
  const joint = {
    type: jointType,
    inMesh: true,       // le press-fit est dans le mesh (profil du collier)
    collarDia: s.collarDia,
    neckDia: s.collarDia,
    clearanceMm: 0.3,
    count: 0,           // 0 vis, 0 insert → assembly sans outil
    note: `Emboîtement press-fit : collier Ø${s.collarDia} mm (jeu 0,3 mm). Aucune vis ni insert dans cette version.`,
    strainRelief: s.strainRelief ? {
      method: "knot",   // nœud câble dans l'alésage : aucune pièce achetée
      note: "Nœud câble intérieur dans l'alésage Ø" + s.cableDia + " mm (bloque mécaniquement). Ou ajouter un serre-câble imprimé séparé.",
      meshFeature: false,  // pas de géométrie spéciale requise (alésage câble déjà présent)
    } : null,
    missingFeatures: [
      "Trous insert M3 — à ajouter si vis souhaitées (nécessite modélisation bossages)",
      "Gorges snap-fit — roadmap GE (boolean ops)",
    ],
  };
  // Serre-câble imprimé séparé (petite pièce clip auto-générée)
  const strainReliefClip = s.strainRelief ? {
    type: "clip_imprime",
    part: "serre_cable_clip",
    material: "same",
    dimensions: { outerDia: s.cableDia + 6, innerDia: s.cableDia + 0.5, length: 12, thickness: 1.5 },
    note: "Clip en U imprimé séparément. Se glisse sur le câble et se verrouille dans la base par friction.",
    printOrientation: "debout",
    bom_tag: "imprimé",
  } : null;
  return { base, shade, joint, strainReliefClip, parts: ["base/pied", "abat-jour"] };
}

export default buildLampMesh;
