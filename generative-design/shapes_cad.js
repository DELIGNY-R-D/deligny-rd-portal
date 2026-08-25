/* ============================================================================
 * SHAPES CAD — 5 formes paramétriques (PUR, sans Three.js)
 * buildShadeMesh | buildVaseMesh | buildBracketMesh | buildBoxMesh | buildShelfMesh
 * Retourne { V:[x,y,z][], tris:[i,j,k][], meta:{} } — contrat lamp_cad.js
 * ==========================================================================*/

// ─── moteur révolution (identique à lamp_cad.js) ────────────────────────────
function _rev(P, S) {
  const M = P.length, V = [], tris = [];
  for (let i = 0; i < M; i++) {
    const [r, y] = P[i];
    for (let j = 0; j < S; j++) {
      const a = j / S * Math.PI * 2;
      V.push([r * Math.cos(a), y, r * Math.sin(a)]);
    }
  }
  const I = (i, j) => (i % M) * S + (j % S);
  for (let i = 0; i < M; i++)
    for (let j = 0; j < S; j++) {
      const a = I(i,j), b = I(i,j+1), c = I(i+1,j+1), d = I(i+1,j);
      tris.push([a,b,c], [a,c,d]);
    }
  return { V, tris };
}

function _bbox(V) {
  const mn = [1e9,1e9,1e9], mx = [-1e9,-1e9,-1e9];
  V.forEach(v => { for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k],v[k]); mx[k] = Math.max(mx[k],v[k]); } });
  return { min: mn, max: mx, size: [mx[0]-mn[0], mx[1]-mn[1], mx[2]-mn[2]] };
}

// quad faces helper (4 pts → 2 tris)
function _addFace(V, tris, pts, flip = false) {
  const i = V.length; V.push(...pts);
  if (flip) tris.push([i,i+2,i+1], [i,i+3,i+2]);
  else      tris.push([i,i+1,i+2], [i,i+2,i+3]);
}

// ─── 1. SHADE (abat-jour) ────────────────────────────────────────────────────
export function defaultShadeSpec(ov = {}) {
  return Object.assign({ topDia:140, bottomDia:80, height:160, wall:1.4, belly:0,
    style:'conical', segments:64 }, ov);
}

export function buildShadeMesh(spec) {
  const s = defaultShadeSpec(spec);
  const N = (s.style === 'geometric' && !('segments' in (spec || {}))) ? 8 : Math.max(24, s.segments | 0);
  const Rt = s.topDia/2, Rb = s.bottomDia/2, H = s.height, W = s.wall, nS = 20;

  function rO(t) {
    const b = Rb + (Rt - Rb) * t;
    if (s.style === 'barrel')      return b + (s.belly||0.3) * Math.min(Rb,Rt) * 0.5 * Math.sin(Math.PI*t);
    if (s.style === 'cylindrical') return (Rb + Rt) / 2;
    if (s.style === 'organic')     return b + 0.2 * Rb * Math.sin(Math.PI * t * 1.8);
    return b; // conical
  }

  // Méridien fermé : outer bas→haut | rebord haut | inner haut→bas | (auto-close = rebord bas)
  const P = [[Rb, 0]];
  for (let k = 1; k <= nS; k++) P.push([rO(k/nS), (k/nS)*H]);
  P.push([Math.max(W+2, Rt-W), H]);
  for (let k = nS-1; k >= 0; k--) P.push([Math.max(W+2, rO(k/nS)-W), (k/nS)*H]);

  const { V, tris } = _rev(P, N);
  const bbox = _bbox(V);
  return { V, tris, meta: {
    type:'shade', style:'conical', risk_flags:[], units:'mm', generator:'shade', params:{...s}, bbox, wallMm:W, watertight:true,
    materialVolumeMm3: Math.round(Math.PI * W * ((Rb+Rt)/2) * H * 2),
    verts:V.length, triangles:tris.length,
  }};
}

// ─── 2. VASE ─────────────────────────────────────────────────────────────────
export function defaultVaseSpec(ov = {}) {
  return Object.assign({ baseDia:80, maxDia:120, neckDia:50, height:200,
    wall:2.5, belly:0.35, twist:0, segments:64 }, ov);
}

export function buildVaseMesh(spec) {
  const s = defaultVaseSpec(spec);
  const N = Math.max(24, s.segments | 0);
  const Rb = s.baseDia/2, Rm = s.maxDia/2, Rn = s.neckDia/2;
  const H = s.height, W = s.wall, nS = 32;

  // Bezier cubique : base → ventre → épaule → col
  function rO(t) {
    const t2=t*t, t3=t2*t, mt=1-t, mt2=mt*mt, mt3=mt2*mt;
    return mt3*Rb + 3*mt2*t*(Rm*1.15) + 3*mt*t2*(Rm*0.9) + t3*Rn;
  }

  // Méridien : centre bas → paroi ext → col → paroi int → centre sol → fermeture
  const P = [[0.1, 0], [Rb, 0]];
  for (let k = 1; k <= nS; k++) P.push([rO(k/nS), (k/nS)*H]);
  P.push([Math.max(W+2, Rn-W), H]);
  for (let k = nS-1; k >= 1; k--) P.push([Math.max(0.2+W, rO(k/nS)-W), (k/nS)*H]);
  P.push([Rb-W, 0], [0.1, W]);

  const { V, tris } = _rev(P, N);

  // Torsion optionnelle
  if (s.twist) {
    const twR = s.twist * Math.PI / 180, M = P.length;
    for (let i = 0; i < M; i++) {
      const angle = (P[i][1] / H) * twR, cos = Math.cos(angle), sin = Math.sin(angle);
      for (let j = 0; j < N; j++) {
        const vi = i*N + j, x = V[vi][0], z = V[vi][2];
        V[vi][0] = x*cos - z*sin; V[vi][2] = x*sin + z*cos;
      }
    }
  }

  const bbox = _bbox(V);
  return { V, tris, meta: {
    units:'mm', generator:'vase', params:{...s}, bbox, wallMm:W, watertight:true,
    materialVolumeMm3: Math.round(Math.PI*Rb*Rb*W + Math.PI*((Rb+Rn)/2)*H*W),
    verts:V.length, triangles:tris.length,
  }};
}

// ─── 3. BRACKET (équerre) ────────────────────────────────────────────────────
export function defaultBracketSpec(ov = {}) {
  return Object.assign({ width:60, height:80, depth:60, wall:4 }, ov);
}

export function buildBracketMesh(spec) {
  const s = defaultBracketSpec(spec), { width:W, height:H, depth:D, wall:T } = s;
  const V = [], tris = [], hw = W/2;
  const AF = (pts, flip=false) => _addFace(V, tris, pts, flip);

  // Plaque verticale : y∈[T,H], z∈[0,T], x∈[-hw,hw]
  AF([[-hw,T,0],[hw,T,0],[hw,H,0],[-hw,H,0]]);       // face avant
  AF([[hw,T,T],[-hw,T,T],[-hw,H,T],[hw,H,T]]);        // face arrière
  AF([[-hw,T,T],[-hw,T,0],[-hw,H,0],[-hw,H,T]]);      // côté gauche
  AF([[hw,T,0],[hw,T,T],[hw,H,T],[hw,H,0]]);           // côté droit
  AF([[-hw,H,0],[hw,H,0],[hw,H,T],[-hw,H,T]]);         // sommet

  // Plaque horizontale : y∈[0,T], z∈[T,D], x∈[-hw,hw]
  AF([[-hw,T,T],[hw,T,T],[hw,T,D],[-hw,T,D]]);         // dessus
  AF([[hw,0,D],[-hw,0,D],[-hw,0,T],[hw,0,T]]);         // dessous
  AF([[-hw,0,T],[-hw,T,T],[-hw,T,D],[-hw,0,D]]);       // gauche
  AF([[hw,T,T],[hw,0,T],[hw,0,D],[hw,T,D]]);            // droite
  AF([[-hw,0,D],[hw,0,D],[hw,T,D],[-hw,T,D]]);          // bout
  // Jonction verticale/horizontale
  AF([[-hw,0,0],[hw,0,0],[hw,T,0],[-hw,T,0]], true);   // face base avant
  AF([[hw,T,T],[hw,T,0],[-hw,T,0],[-hw,T,T]], true);   // plafond intérieur coin

  // Nervure triangulaire (angle intérieur)
  const ribW = Math.min(T, 5), ribH = Math.min(H-T, D-T) * 0.7;
  if (ribH > 5) {
    const rx = W/2 - ribW/2;
    const rb = V.length;
    V.push([-rx,T,T],[-rx,T+ribH,T],[-rx,T,T+ribH*0.85]);
    V.push([rx,T,T],[rx,T+ribH,T],[rx,T,T+ribH*0.85]);
    tris.push([rb,rb+1,rb+2], [rb+3,rb+5,rb+4]);
    for (let i = 0; i < 3; i++) {
      const ni = (i+1)%3;
      tris.push([rb+i,rb+3+ni,rb+ni], [rb+i,rb+3+i,rb+3+ni]);
    }
  }

  const bbox = _bbox(V);
  return { V, tris, meta: {
    units:'mm', generator:'bracket', params:{...s}, bbox, wallMm:T, watertight:false,
    materialVolumeMm3: Math.round(W*(H-T)*T + W*(D-T)*T),
    verts:V.length, triangles:tris.length,
  }};
}

// ─── 4. BOX (boite ouverte en haut) ──────────────────────────────────────────
export function defaultBoxSpec(ov = {}) {
  return Object.assign({ width:100, height:60, depth:80, wall:2.5, bottomThk:3 }, ov);
}

export function buildBoxMesh(spec) {
  const s = defaultBoxSpec(spec), { width:W, height:H, depth:D, wall:T, bottomThk:BT } = s;
  const V = [], tris = [];
  const hw = W/2, hd = D/2, iw = hw-T, id = hd-T;
  const AF = (pts, flip=false) => _addFace(V, tris, pts, flip);

  // Fond extérieur
  AF([[-hw,0,-hd],[hw,0,-hd],[hw,0,hd],[-hw,0,hd]], true);
  // Parois extérieures (4 faces)
  AF([[-hw,0,-hd],[-hw,H,-hd],[hw,H,-hd],[hw,0,-hd]]);
  AF([[hw,0,hd],[hw,H,hd],[-hw,H,hd],[-hw,0,hd]]);
  AF([[-hw,0,hd],[-hw,H,hd],[-hw,H,-hd],[-hw,0,-hd]]);
  AF([[hw,0,-hd],[hw,H,-hd],[hw,H,hd],[hw,0,hd]]);
  // Fond intérieur
  AF([[-iw,BT,-id],[iw,BT,-id],[iw,BT,id],[-iw,BT,id]]);
  // Parois intérieures (normes inversées)
  AF([[iw,BT,-id],[iw,H+1,-id],[-iw,H+1,-id],[-iw,BT,-id]], true);
  AF([[-iw,BT,id],[-iw,H+1,id],[iw,H+1,id],[iw,BT,id]], true);
  AF([[iw,BT,id],[iw,H+1,id],[iw,H+1,-id],[iw,BT,-id]], true);
  AF([[-iw,BT,-id],[-iw,H+1,-id],[-iw,H+1,id],[-iw,BT,id]], true);
  // Lèvres bas (jonction fond ext ↔ fond int)
  AF([[-hw,0,-hd],[-iw,BT,-id],[iw,BT,-id],[hw,0,-hd]], true);
  AF([[hw,0,hd],[iw,BT,id],[-iw,BT,id],[-hw,0,hd]], true);
  AF([[-hw,0,hd],[-iw,BT,id],[-iw,BT,-id],[-hw,0,-hd]], true);
  AF([[hw,0,-hd],[iw,BT,-id],[iw,BT,id],[hw,0,hd]], true);

  const bbox = _bbox(V);
  return { V, tris, meta: {
    units:'mm', generator:'box', params:{...s}, bbox, wallMm:T, watertight:false,
    materialVolumeMm3: Math.round(2*H*(W+D)*T + W*D*BT),
    verts:V.length, triangles:tris.length,
  }};
}

// ─── 5. SHELF (étagère murale) ───────────────────────────────────────────────
export function defaultShelfSpec(ov = {}) {
  return Object.assign({ width:200, depth:150, thickness:18, backHeight:30, wall:4 }, ov);
}

export function buildShelfMesh(spec) {
  const s = defaultShelfSpec(spec), { width:W, depth:D, thickness:T, backHeight:BH, wall:WL } = s;
  const V = [], tris = [], hw = W/2;
  const AF = (pts, flip=false) => _addFace(V, tris, pts, flip);

  // Plateau horizontal (dessus à y=T, dessous à y=0, z∈[0,D])
  AF([[-hw,T,0],[hw,T,0],[hw,T,D],[-hw,T,D]]);
  AF([[-hw,0,D],[hw,0,D],[hw,0,0],[-hw,0,0]]);
  AF([[-hw,0,0],[-hw,0,D],[-hw,T,D],[-hw,T,0]]);
  AF([[hw,T,0],[hw,T,D],[hw,0,D],[hw,0,0]]);
  AF([[-hw,0,D],[hw,0,D],[hw,T,D],[-hw,T,D]]);
  AF([[-hw,T,0],[hw,T,0],[hw,0,0],[-hw,0,0]], true);

  // Dosseret (y∈[T, T+BH], z∈[0,WL])
  AF([[-hw,T,0],[hw,T,0],[hw,T+BH,0],[-hw,T+BH,0]]);
  AF([[hw,T,WL],[-hw,T,WL],[-hw,T+BH,WL],[hw,T+BH,WL]]);
  AF([[-hw,T,WL],[-hw,T,0],[-hw,T+BH,0],[-hw,T+BH,WL]]);
  AF([[hw,T,0],[hw,T,WL],[hw,T+BH,WL],[hw,T+BH,0]]);
  AF([[-hw,T+BH,0],[hw,T+BH,0],[hw,T+BH,WL],[-hw,T+BH,WL]]);
  AF([[-hw,T,0],[-hw,T,WL],[hw,T,WL],[hw,T,0]], true);

  const bbox = _bbox(V);
  return { V, tris, meta: {
    units:'mm', generator:'shelf', params:{...s}, bbox, wallMm:T, watertight:false,
    materialVolumeMm3: Math.round(W*D*T + W*BH*WL),
    verts:V.length, triangles:tris.length,
  }};
}

// ─── 6. SPLINE LATHE (révolution profil Catmull-Rom) ─────────────────────────
export function defaultSplineLatheSpec(ov = {}) {
  return {
    height: 200,
    segments: 64,
    rings: 48,
    wall: 2.5,
    radii: [40, 55, 35, 50, 30],
    ...ov
  };
}

export function buildSplineLathe(spec) {
  const s = { ...defaultSplineLatheSpec(), ...spec };
  const SEG = Math.max(8, s.segments | 0);
  const RINGS = Math.max(4, s.rings | 0);
  const H = s.height;
  const radii = s.radii || [40, 55, 35, 50, 30];
  const wall = s.wall || 2.5;

  function crSpline(pts, t) {
    const n = pts.length;
    const T = Math.max(0, Math.min(0.9999, t)) * (n - 1);
    const i = Math.floor(T);
    const u = T - i;
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[Math.min(n - 1, i + 1)];
    const p3 = pts[Math.min(n - 1, i + 2)];
    return 0.5 * ((2 * p1) + (-p0 + p2) * u +
      (2*p0 - 5*p1 + 4*p2 - p3) * u*u +
      (-p0 + 3*p1 - 3*p2 + p3) * u*u*u);
  }

  const MM2U = 0.1;
  const verts = [];
  const indices = [];

  for (let layer = 0; layer < 2; layer++) {
    const isInner = layer === 1;
    for (let ring = 0; ring <= RINGS; ring++) {
      const t = ring / RINGS;
      const z = t * H * MM2U;
      const r = (crSpline(radii, t) - (isInner ? wall : 0)) * MM2U;
      const rClamped = Math.max(1 * MM2U, r);
      for (let seg = 0; seg <= SEG; seg++) {
        const angle = (seg / SEG) * Math.PI * 2;
        verts.push(Math.cos(angle) * rClamped, z, Math.sin(angle) * rClamped);
      }
    }
  }

  function addQuad(a, b, c, d) {
    indices.push(a, b, c, a, c, d);
  }
  const stride = SEG + 1;
  const outerOffset = 0;
  const innerOffset = (RINGS + 1) * stride;

  for (let ring = 0; ring < RINGS; ring++) {
    for (let seg = 0; seg < SEG; seg++) {
      const o = outerOffset + ring * stride + seg;
      addQuad(o, o + 1, o + stride + 1, o + stride);
      const i2 = innerOffset + ring * stride + seg;
      addQuad(i2 + 1, i2, i2 + stride, i2 + stride + 1);
    }
  }

  // Fond (bottom cap)
  const outerBot = 0;
  const innerBot = innerOffset;
  for (let seg = 0; seg < SEG; seg++) {
    indices.push(outerBot + seg + 1, outerBot + seg, innerBot + seg);
    indices.push(innerBot + seg + 1, outerBot + seg + 1, innerBot + seg);
  }

  // Bord supérieur (top rim)
  const outerTop = outerOffset + RINGS * stride;
  const innerTop = innerOffset + RINGS * stride;
  for (let seg = 0; seg < SEG; seg++) {
    indices.push(outerTop + seg, outerTop + seg + 1, innerTop + seg);
    indices.push(outerTop + seg + 1, innerTop + seg + 1, innerTop + seg);
  }

  const V = new Float32Array(verts);
  const tris = new Uint32Array(indices);
  const extX = Math.max(...radii) * 2;
  return { V, tris, meta: { type: 'spline_lathe', style:'lathe', risk_flags:[], triangles: tris.length / 3,
    size: [Math.round(extX), Math.round(extX), Math.round(H)] } };
}

// ─── 7. PHYLLOTAXIS SHADE (abat-jour spirale phyllotaxique) ──────────────────
export function defaultPhyllotaxisShadeSpec(ov = {}) {
  return {
    topDia: 100, bottomDia: 200, height: 180,
    wall: 2.0,
    holeRadius: 8,
    numHoles: 40,
    rimHeight: 8,
    segments: 96,
    ...ov
  };
}

export function buildPhyllotaxisShade(spec) {
  const s = { ...defaultPhyllotaxisShadeSpec(), ...spec };
  const MM2U = 0.1;
  const SEG = Math.max(32, s.segments | 0);
  const RINGS = SEG * 2;
  const PHI = Math.PI * (3 - Math.sqrt(5));

  const holes = [];
  const zMin = s.rimHeight / s.height;
  const zMax = 1 - s.rimHeight / s.height;
  for (let n = 0; n < s.numHoles; n++) {
    const angle = n * PHI;
    const z = zMin + (n / s.numHoles) * (zMax - zMin);
    holes.push({ angle: angle % (Math.PI * 2), z });
  }

  const holeRad_angle = (s.holeRadius / (Math.PI * s.bottomDia)) * Math.PI * 2 * 1.3;
  const holeRad_z = s.holeRadius / s.height * 1.3;

  function inHole(angle, z) {
    for (const h of holes) {
      let da = Math.abs(angle - h.angle);
      if (da > Math.PI) da = Math.PI * 2 - da;
      const dz = Math.abs(z - h.z);
      if (da < holeRad_angle && dz < holeRad_z) return true;
    }
    return false;
  }

  const verts = [];
  const indices = [];
  const vertCache = new Map();

  function addVert(seg, ring, layer) {
    const key = `${seg},${ring},${layer}`;
    if (vertCache.has(key)) return vertCache.get(key);
    const t = ring / RINGS;
    const z = t * s.height * MM2U;
    const angle = (seg / SEG) * Math.PI * 2;
    const rTop = s.topDia / 2, rBot = s.bottomDia / 2;
    const r = (rBot + (rTop - rBot) * t - (layer === 1 ? s.wall : 0)) * MM2U;
    const rC = Math.max(1 * MM2U, r);
    const idx = verts.length / 3;
    verts.push(Math.cos(angle) * rC, z, Math.sin(angle) * rC);
    vertCache.set(key, idx);
    return idx;
  }

  for (let ring = 0; ring < RINGS; ring++) {
    for (let seg = 0; seg < SEG; seg++) {
      const t = (ring + 0.5) / RINGS;
      const angle = ((seg + 0.5) / SEG) * Math.PI * 2;
      if (inHole(angle, t)) continue;

      const nextSeg = seg + 1 > SEG ? 0 : seg + 1;
      const a = addVert(seg, ring, 0), b = addVert(nextSeg, ring, 0);
      const c = addVert(nextSeg, ring + 1, 0), d = addVert(seg, ring + 1, 0);
      indices.push(a, b, c, a, c, d);

      const e = addVert(seg, ring, 1), f = addVert(nextSeg, ring, 1);
      const g = addVert(nextSeg, ring + 1, 1), h2 = addVert(seg, ring + 1, 1);
      indices.push(e, h2, g, e, g, f);
    }
  }

  const V = new Float32Array(verts);
  const tris = new Uint32Array(indices);
  return { V, tris, meta: { type: 'phyllotaxis_shade', style:'organic',
    risk_flags:['heavy_mesh','complex_perforations','slow_slicing'],
    triangles: tris.length / 3,
    size: [Math.round(s.bottomDia), Math.round(s.bottomDia), Math.round(s.height)] } };
}

// ─── 8. GYROID SHELL (coque surface gyroïde, marching cubes) ─────────────────
export function defaultGyroidShellSpec(ov = {}) {
  return {
    width: 120, height: 120, depth: 120,
    frequency: 2,
    thickness: 4,
    resolution: 22,
    ...ov
  };
}

export function buildGyroidShell(spec) {
  const s = { ...defaultGyroidShellSpec(), ...spec };
  const MM2U = 0.1;
  const N = Math.min(30, Math.max(10, s.resolution | 0));
  const freq = s.frequency || 2;
  const t = (s.thickness / Math.min(s.width, s.height, s.depth)) * N * freq * Math.PI * 2;

  function gyroid(x, y, z) {
    const fx = (x / N) * freq * Math.PI * 2;
    const fy = (y / N) * freq * Math.PI * 2;
    const fz = (z / N) * freq * Math.PI * 2;
    return Math.sin(fx) * Math.cos(fy) + Math.sin(fy) * Math.cos(fz) + Math.sin(fz) * Math.cos(fx);
  }

  const thresh = (t / (N * freq * Math.PI * 2)) * 2;

  const verts = [];
  const tris = [];

  function lerp(a, b, t2) { return a + (b - a) * t2; }

  function interpVert(x0, y0, z0, f0, x1, y1, z1, f1, target) {
    const frac = (target - f0) / (f1 - f0 + 1e-10);
    const xi = lerp(x0, x1, frac), yi = lerp(y0, y1, frac), zi = lerp(z0, z1, frac);
    const idx = verts.length / 3;
    verts.push(
      (xi / N - 0.5) * s.width * MM2U,
      (yi / N - 0.5) * s.height * MM2U,
      (zi / N - 0.5) * s.depth * MM2U
    );
    return idx;
  }

  for (let iz = 0; iz < N - 1; iz++) {
    for (let iy = 0; iy < N - 1; iy++) {
      for (let ix = 0; ix < N - 1; ix++) {
        const corners = [
          [ix,iy,iz],[ix+1,iy,iz],[ix+1,iy+1,iz],[ix,iy+1,iz],
          [ix,iy,iz+1],[ix+1,iy,iz+1],[ix+1,iy+1,iz+1],[ix,iy+1,iz+1]
        ];
        const fv = corners.map(([x,y,z]) => gyroid(x,y,z));

        for (const iso of [thresh, -thresh]) {
          const inside = fv.map(f => (iso > 0 ? f > iso : f < iso));
          const allIn = inside.every(Boolean);
          const allOut = inside.every(v => !v);
          if (allIn || allOut) continue;

          const edges = [
            [0,1],[1,2],[2,3],[3,0],
            [4,5],[5,6],[6,7],[7,4],
            [0,4],[1,5],[2,6],[3,7]
          ];
          const edgeVerts = [];
          for (const [a, b] of edges) {
            if (inside[a] !== inside[b]) {
              const [x0,y0,z0] = corners[a], [x1,y1,z1] = corners[b];
              edgeVerts.push(interpVert(x0,y0,z0,fv[a], x1,y1,z1,fv[b], iso));
            } else {
              edgeVerts.push(-1);
            }
          }
          const pts = edgeVerts.filter(v => v >= 0);
          for (let k = 1; k < pts.length - 1; k++) {
            if (iso > 0) {
              tris.push(pts[0], pts[k], pts[k+1]);
            } else {
              tris.push(pts[0], pts[k+1], pts[k]);
            }
          }
        }
      }
    }
  }

  const V = new Float32Array(verts);
  const triIdx = new Uint32Array(tris);
  return { V, tris: triIdx, meta: { type: 'gyroid_shell', triangles: triIdx.length / 3,
    size: [s.width, s.height, s.depth] } };
}

// ═══════════════════════════════════════════════════════════════════════════════
// φ SHAPES — Nombre d'Or  (φ = 1.618033…)
// Trois formes génératives gouvernées par le rapport doré.
// ═══════════════════════════════════════════════════════════════════════════════
const PHI = 1.6180339887498948482;

// ── Helpers partagés ──────────────────────────────────────────────────────────
function _latheShell(getR_outer, H, SEG, RINGS, wall) {
  const MM2U = 0.1;
  const verts = [], indices = [];
  for (let layer = 0; layer < 2; layer++) {
    const isInner = layer === 1;
    for (let ring = 0; ring <= RINGS; ring++) {
      const t = ring / RINGS;
      const z = t * H * MM2U;
      const ro = getR_outer(t);
      const r = Math.max(0.5, ro - (isInner ? wall : 0)) * MM2U;
      for (let seg = 0; seg <= SEG; seg++) {
        const a = (seg / SEG) * Math.PI * 2;
        verts.push(Math.cos(a) * r, z, Math.sin(a) * r);
      }
    }
  }
  function addQ(a,b,c,d){ indices.push(a,b,c,a,c,d); }
  const stride = SEG + 1;
  const inner = (RINGS + 1) * stride;
  for (let ring = 0; ring < RINGS; ring++) {
    for (let seg = 0; seg < SEG; seg++) {
      const o = ring*stride+seg;
      addQ(o, o+1, o+stride+1, o+stride);
      const i2 = inner+ring*stride+seg;
      addQ(i2+1, i2, i2+stride, i2+stride+1);
    }
  }
  for (let seg=0; seg<SEG; seg++) {  // bottom cap
    indices.push(seg+1, seg, inner+seg);
    indices.push(inner+seg+1, seg+1, inner+seg);
  }
  const oT = RINGS*stride, iT = inner+RINGS*stride;
  for (let seg=0; seg<SEG; seg++) {  // top rim
    indices.push(oT+seg, oT+seg+1, iT+seg);
    indices.push(oT+seg+1, iT+seg+1, iT+seg);
  }
  return { V: new Float32Array(verts), tris: new Uint32Array(indices) };
}

// ── 1. PHI VASE — proportions dorées aux sections dorées ─────────────────────
// ─── Sphère UV ────────────────────────────────────────────────────────────────
export function defaultSphereSpec(ov = {}) {
  return { radius: 89, segments: 64, rings: 48, ...ov };
}
export function buildSphere(spec = {}) {
  const s = { ...defaultSphereSpec(), ...spec };
  const R = s.radius, SEG = Math.max(6, s.segments), RINGS = Math.max(3, s.rings);
  const verts = [], indices = [];
  for (let r = 0; r <= RINGS; r++) {
    const phi = (Math.PI * r) / RINGS;
    for (let sg = 0; sg <= SEG; sg++) {
      const theta = (2 * Math.PI * sg) / SEG;
      verts.push(R * Math.sin(phi) * Math.cos(theta), R * Math.cos(phi), R * Math.sin(phi) * Math.sin(theta));
    }
  }
  const stride = SEG + 1;
  for (let r = 0; r < RINGS; r++) {
    for (let sg = 0; sg < SEG; sg++) {
      const a = r * stride + sg, b = a + 1, c = a + stride, d = c + 1;
      if (r !== 0)        indices.push(a, b, c);
      if (r !== RINGS-1)  indices.push(b, d, c);
    }
  }
  const V = new Float32Array(verts);
  const tris = new Uint32Array(indices);
  const D = R * 2;
  return { V, tris, meta: { type: 'sphere', triangles: tris.length / 3, size: [D, D, D] } };
}

// Profile contrôlé par 5 points aux hauteurs de la section dorée imbriquée :
//   z = [0, h/φ², h/φ, h(1−1/φ³), h] = [0, 38.2%, 61.8%, 76.4%, 100%]
//   r = [R₀, R₀·φ, R₀, R₀/φ, R₀·0.55]
// → ventre au premier tiers doré, col au second, hanches progressives.
export function defaultPhiVaseSpec(ov = {}) {
  return { height:233, baseDia:144, wall:3, segments:72, rings:64, ...ov };
}
export function buildPhiVase(spec) {
  const s = { ...defaultPhiVaseSpec(), ...spec };
  const SEG = Math.max(8, s.segments|0);
  const RINGS = Math.max(16, s.rings|0);
  const H = s.height;
  const R0 = (s.baseDia || s.dia || 144) / 2;
  const wall = s.wall || 3;

  // Hauteurs & rayons aux sections dorées
  const gH = [0, H/PHI**2, H/PHI, H*(1-1/PHI**3), H];
  const gR = [R0, R0*PHI, R0, R0/PHI, R0*0.55];

  function smoothstep(t){ return t*t*(3-2*t); }
  function getR(t) {
    const z = t * H;
    for (let i=0; i<gH.length-1; i++) {
      if (z <= gH[i+1] || i===gH.length-2) {
        const span = gH[i+1]-gH[i];
        const u = span>0 ? (z-gH[i])/span : 0;
        return gR[i] + (gR[i+1]-gR[i]) * smoothstep(Math.max(0,Math.min(1,u)));
      }
    }
    return gR[gR.length-1];
  }

  const { V, tris } = _latheShell(getR, H, SEG, RINGS, wall);
  const maxR = Math.max(...gR);
  return { V, tris, meta:{ type:'phi_vase', triangles:tris.length/3,
    size:[Math.round(maxR*2), Math.round(maxR*2), Math.round(H)],
    phi_heights: gH.map(h=>Math.round(h)), phi_radii: gR.map(r=>Math.round(r)) } };
}

// ── 2. PENROSE SHADE — symétrie pentagonale (5·φ) ────────────────────────────
// L'abat-jour est pentagonal à l'ouverture basse, circulaire en haut.
// La modulation pentagonale s'atténue de depth→0 sur la hauteur.
// Chaque face correspond à un angle de 72° = 360°/5 (géométrie du pentagone).
// La proportion hauteur/Ø = 1/φ, et topDia/bottomDia = 1/φ.
export function defaultPenroseShadeSpec(ov = {}) {
  return { height:89, bottomDia:144, topDia:89, wall:2.5,
           depth:0.18, folds:5, segments:180, levels:56, ...ov };
}
export function buildPenroseShade(spec) {
  const s = { ...defaultPenroseShadeSpec(), ...spec };
  const SEG   = Math.max(10, s.segments|0);  // azimuthal (multiple de folds)
  const LVLS  = Math.max(8,  s.levels|0);
  const H     = s.height;
  const Rb    = (s.bottomDia||144) / 2;
  const Rt    = (s.topDia||89)     / 2;
  const wall  = s.wall || 2.5;
  const depth = s.depth || 0.18;
  const folds = s.folds || 5;
  const MM2U  = 0.1;

  const verts = [], indices = [];

  // Pour chaque niveau, on génère un anneau outer + inner
  // La section pentagonale: r(θ,t) = R(t) × (1 + depth×(1-t²)×cos(folds×θ))
  const stride = SEG + 1;
  const perLevel = stride;
  const totalLevels = LVLS + 1;

  for (let layer = 0; layer < 2; layer++) {
    const isInner = layer === 1;
    for (let lv = 0; lv <= LVLS; lv++) {
      const t = lv / LVLS;
      const z = t * H * MM2U;
      const R = Rb + (Rt - Rb) * t;         // radius linearly interpolates
      const mod = depth * (1 - t*t);         // modulation → 0 at top
      for (let seg = 0; seg <= SEG; seg++) {
        const theta = (seg / SEG) * Math.PI * 2;
        const ro = R * (1 + mod * Math.cos(folds * theta));
        const r = Math.max(0.5, ro - (isInner ? wall : 0)) * MM2U;
        verts.push(Math.cos(theta)*r, z, Math.sin(theta)*r);
      }
    }
  }

  function addQ(a,b,c,d){ indices.push(a,b,c,a,c,d); }
  const innerOff = totalLevels * perLevel;
  for (let lv=0; lv<LVLS; lv++) {
    for (let seg=0; seg<SEG; seg++) {
      const o = lv*stride+seg;
      addQ(o, o+1, o+stride+1, o+stride);
      const i2 = innerOff+lv*stride+seg;
      addQ(i2+1, i2, i2+stride, i2+stride+1);
    }
  }
  // bottom cap
  const ib = innerOff;
  for (let seg=0; seg<SEG; seg++) {
    indices.push(seg+1, seg, ib+seg);
    indices.push(ib+seg+1, seg+1, ib+seg);
  }
  // top rim
  const oT = LVLS*stride, iT = innerOff+LVLS*stride;
  for (let seg=0; seg<SEG; seg++) {
    indices.push(oT+seg, oT+seg+1, iT+seg);
    indices.push(oT+seg+1, iT+seg+1, iT+seg);
  }

  const V = new Float32Array(verts);
  const tris = new Uint32Array(indices);
  return { V, tris, meta:{ type:'penrose_shade', style:'geometric',
    risk_flags:['heavy_mesh','sharp_edges'],
    triangles:tris.length/3,
    size:[Math.round(Rb*2), Math.round(Rb*2), Math.round(H)],
    phi_score: 9.5, symmetry: folds } };
}

// ── 3. GOLDEN HELIX — torsion par l'angle d'or (137.508°) ───────────────────
// La section transversale est légèrement elliptique (squeeze = 1/φ).
// Elle tourne de (turns × 360°) sur la hauteur totale.
// L'angle d'avance = golden angle = 137.508° (irrational — jamais de répétition).
// → surface semblable à une feuille torsadée / un virage φ continu.
export function defaultGoldenHelixSpec(ov = {}) {
  return { height:233, dia:144, wall:2.5, turns:1.618, squeeze:0.12,
           segments:120, rings:80, ...ov };
}
export function buildGoldenHelix(spec) {
  const s = { ...defaultGoldenHelixSpec(), ...spec };
  const SEG    = Math.max(12, s.segments|0);
  const RINGS  = Math.max(12, s.rings|0);
  const H      = s.height;
  const R      = (s.dia || 89) / 2;
  const wall   = s.wall || 2.5;
  const turns  = s.turns || PHI;           // default = φ turns
  const squeeze= Math.min(0.4, s.squeeze || 0.12);  // elliptic squeeze
  const GOLD_R = 2.3999632  ;             // golden angle in radians (137.508°)
  const MM2U   = 0.1;

  const verts = [], indices = [];
  const stride = SEG + 1;

  for (let layer = 0; layer < 2; layer++) {
    const isInner = layer === 1;
    for (let ring = 0; ring <= RINGS; ring++) {
      const t = ring / RINGS;
      const z = t * H * MM2U;
      // Base radius: slight taper (narrower at top, ratio = 1/√φ)
      const R_t = R * (1 - (1-1/Math.sqrt(PHI)) * t);
      // Rotation increases with height: golden angle × turns × t
      const phi_rot = turns * GOLD_R * t;

      for (let seg = 0; seg <= SEG; seg++) {
        const theta = (seg / SEG) * Math.PI * 2;
        // Rotate the ellipse by phi_rot
        const theta_rot = theta + phi_rot;
        // Elliptic cross-section: squeeze in one axis
        const rx = R_t * (1 + squeeze * Math.cos(2 * theta_rot));
        const ry = R_t * (1 - squeeze * Math.cos(2 * theta_rot));
        const ro = Math.sqrt(
          (Math.cos(theta)*rx)**2 + (Math.sin(theta)*ry)**2
        );
        const r = Math.max(0.5, ro - (isInner ? wall : 0)) * MM2U;
        verts.push(Math.cos(theta)*r, z, Math.sin(theta)*r);
      }
    }
  }

  function addQ(a,b,c,d){ indices.push(a,b,c,a,c,d); }
  const inner = (RINGS+1)*stride;
  for (let ring=0; ring<RINGS; ring++) {
    for (let seg=0; seg<SEG; seg++) {
      const o = ring*stride+seg;
      addQ(o, o+1, o+stride+1, o+stride);
      const i2 = inner+ring*stride+seg;
      addQ(i2+1, i2, i2+stride, i2+stride+1);
    }
  }
  for (let seg=0; seg<SEG; seg++) {
    indices.push(seg+1, seg, inner+seg);
    indices.push(inner+seg+1, seg+1, inner+seg);
  }
  const oT=RINGS*stride, iT=inner+RINGS*stride;
  for (let seg=0; seg<SEG; seg++) {
    indices.push(oT+seg, oT+seg+1, iT+seg);
    indices.push(oT+seg+1, iT+seg+1, iT+seg);
  }

  const V = new Float32Array(verts);
  const tris = new Uint32Array(indices);
  return { V, tris, meta:{ type:'golden_helix', triangles:tris.length/3,
    size:[Math.round(R*2), Math.round(R*2), Math.round(H)],
    phi_score: 10.0, turns, golden_angle_deg: 137.508 } };
}

// ─── 11. TORE ────────────────────────────────────────────────────────────────
export function defaultTorusSpec(ov = {}) {
  return { majorRadius: 60, tubeRadius: 18, segMajor: 64, segMinor: 24, ...ov };
}
export function buildTorus(spec = {}) {
  const s = { ...defaultTorusSpec(), ...spec };
  const { majorRadius: R, tubeRadius: r, segMajor: SM, segMinor: Sm } = s;
  const V = [], tris = [];
  for (let i = 0; i < SM; i++) {
    const phi = 2 * Math.PI * i / SM;
    const cp = Math.cos(phi), sp = Math.sin(phi);
    for (let j = 0; j < Sm; j++) {
      const theta = 2 * Math.PI * j / Sm;
      const d = R + r * Math.cos(theta);
      V.push([d * cp, r * Math.sin(theta), d * sp]);
    }
  }
  for (let i = 0; i < SM; i++) {
    const ni = (i + 1) % SM;
    for (let j = 0; j < Sm; j++) {
      const nj = (j + 1) % Sm;
      const a = i * Sm + j, b = i * Sm + nj;
      const c = ni * Sm + nj, d = ni * Sm + j;
      tris.push([a, b, c], [a, c, d]);
    }
  }
  const bbox = _bbox(V);
  return { V, tris, meta: { type: 'torus', triangles: tris.length,
    size: [(R + r) * 2, r * 2, (R + r) * 2], bbox } };
}

// ─── 12. TUBE (cylindre creux) ───────────────────────────────────────────────
export function defaultTubeSpec(ov = {}) {
  return { outerRadius: 40, wall: 4, height: 80, segments: 48, ...ov };
}
export function buildTube(spec = {}) {
  const s = { ...defaultTubeSpec(), ...spec };
  const { outerRadius: OR, wall: W, height: H, segments: S } = s;
  const IR = Math.max(1, OR - W);
  const ot = [], ob = [], it = [], ib = [];
  for (let i = 0; i < S; i++) {
    const a = 2 * Math.PI * i / S, c = Math.cos(a), sn = Math.sin(a);
    ot.push([OR * c, H, OR * sn]); ob.push([OR * c, 0, OR * sn]);
    it.push([IR * c, H, IR * sn]); ib.push([IR * c, 0, IR * sn]);
  }
  const V = [...ot, ...ob, ...it, ...ib];
  const OT = 0, OB = S, IT = S * 2, IB = S * 3;
  const tris = [];
  for (let i = 0; i < S; i++) {
    const ni = (i + 1) % S;
    tris.push([OT+i, OT+ni, OB+ni], [OT+i, OB+ni, OB+i]);
    tris.push([IT+i, IB+i, IB+ni], [IT+i, IB+ni, IT+ni]);
    tris.push([OT+i, IT+ni, OT+ni], [OT+i, IT+i, IT+ni]);
    tris.push([OB+i, OB+ni, IB+ni], [OB+i, IB+ni, IB+i]);
  }
  const bbox = _bbox(V);
  return { V, tris, meta: { type: 'tube', triangles: tris.length,
    size: [OR * 2, H, OR * 2], bbox } };
}

// ─── 13. ENGRENAGE (spur gear) ───────────────────────────────────────────────
export function defaultGearSpec(ov = {}) {
  return { teeth: 16, radius: 50, toothH: 7, thickness: 10, bore: 10, ...ov };
}
export function buildGear(spec = {}) {
  const s = { ...defaultGearSpec(), ...spec };
  const { teeth: N, radius: R, toothH: TH, thickness: T, bore: BR } = s;
  const r = R - TH;
  const nPts = N * 4;
  const outerT = [], outerB = [], boreT = [], boreB = [];
  for (let i = 0; i < N; i++) {
    const base = 2 * Math.PI * i / N, da = Math.PI / N;
    const pts = [
      { a: base - da * 0.7, r: r }, { a: base - da * 0.28, r: R },
      { a: base + da * 0.28, r: R }, { a: base + da * 0.7, r: r },
    ];
    pts.forEach(({ a, r: rad }) => {
      outerT.push([rad * Math.cos(a), T / 2, rad * Math.sin(a)]);
      outerB.push([rad * Math.cos(a), -T / 2, rad * Math.sin(a)]);
    });
    for (let k = 0; k < 4; k++) {
      const ba = 2 * Math.PI * (i * 4 + k) / nPts;
      boreT.push([BR * Math.cos(ba), T / 2, BR * Math.sin(ba)]);
      boreB.push([BR * Math.cos(ba), -T / 2, BR * Math.sin(ba)]);
    }
  }
  const V = [...outerT, ...outerB, ...boreT, ...boreB];
  const OT = 0, OB = nPts, BT = nPts * 2, BB = nPts * 3;
  const tris = [];
  for (let i = 0; i < nPts; i++) {
    const ni = (i + 1) % nPts;
    tris.push([OT+i, OT+ni, OB+ni], [OT+i, OB+ni, OB+i]);
    tris.push([BT+i, BB+i, BB+ni], [BT+i, BB+ni, BT+ni]);
    tris.push([OT+i, BT+ni, OT+ni], [OT+i, BT+i, BT+ni]);
    tris.push([OB+i, OB+ni, BB+ni], [OB+i, BB+ni, BB+i]);
  }
  const bbox = _bbox(V);
  return { V, tris, meta: { type: 'gear', triangles: tris.length,
    size: [R * 2, T, R * 2], bbox } };
}

// ─── 14. CÔNE CREUX (frustum) ────────────────────────────────────────────────
export function defaultConeSpec(ov = {}) {
  return { topRadius: 20, bottomRadius: 70, height: 120, wall: 2.5, segments: 48, ...ov };
}
export function buildCone(spec = {}) {
  const s = { ...defaultConeSpec(), ...spec };
  const { topRadius: TR, bottomRadius: BR, height: H, wall: W, segments: S } = s;
  const iTR = Math.max(2, TR - W), iBR = Math.max(2, BR - W);
  const outerB = [], outerT = [], innerT = [], innerB = [];
  for (let i = 0; i < S; i++) {
    const a = 2 * Math.PI * i / S, c = Math.cos(a), sn = Math.sin(a);
    outerB.push([BR * c, 0, BR * sn]); outerT.push([TR * c, H, TR * sn]);
    innerT.push([iTR * c, H, iTR * sn]); innerB.push([iBR * c, 0, iBR * sn]);
  }
  const V = [...outerB, ...outerT, ...innerT, ...innerB];
  const OB = 0, OT = S, IT = S * 2, IB = S * 3;
  const tris = [];
  for (let i = 0; i < S; i++) {
    const ni = (i + 1) % S;
    tris.push([OB+i, OT+ni, OB+ni], [OB+i, OT+i, OT+ni]);
    tris.push([IT+i, IB+i, IB+ni], [IT+i, IB+ni, IT+ni]);
    tris.push([OT+i, IT+ni, OT+ni], [OT+i, IT+i, IT+ni]);
    tris.push([OB+i, OB+ni, IB+ni], [OB+i, IB+ni, IB+i]);
  }
  const bbox = _bbox(V);
  return { V, tris, meta: { type: 'cone', triangles: tris.length,
    size: [BR * 2, H, BR * 2], bbox } };
}

// ─── 15. RESSORT (helix coil) ────────────────────────────────────────────────
export function defaultSpringSpec(ov = {}) {
  return { coilRadius: 35, wireRadius: 4, turns: 5, height: 90, coilSegs: 48, tubeSegs: 12, ...ov };
}
export function buildSpring(spec = {}) {
  const s = { ...defaultSpringSpec(), ...spec };
  const { coilRadius: CR, wireRadius: WR, turns: NT, height: H, coilSegs: CS, tubeSegs: TS } = s;
  const N_PATH = NT * CS;
  const V = [], tris = [];
  for (let p = 0; p <= N_PATH; p++) {
    const t = p / N_PATH;
    const phi = 2 * Math.PI * NT * t;
    const dphi = 2 * Math.PI * NT / N_PATH;
    const px = CR * Math.cos(phi), py = H * t, pz = CR * Math.sin(phi);
    // Tangent (normalized)
    const tx = -CR * Math.sin(phi) * dphi, ty = H / N_PATH, tz = CR * Math.cos(phi) * dphi;
    const tl = Math.sqrt(tx*tx + ty*ty + tz*tz);
    const [Tx, Ty, Tz] = [tx/tl, ty/tl, tz/tl];
    // Radially inward normal, orthogonalized
    const rx = -Math.cos(phi), ry = 0, rz = -Math.sin(phi);
    const dot = rx*Tx + ry*Ty + rz*Tz;
    const Nx = rx-dot*Tx, Ny = ry-dot*Ty, Nz = rz-dot*Tz;
    const nl = Math.sqrt(Nx*Nx + Ny*Ny + Nz*Nz);
    const [nx, ny, nz] = [Nx/nl, Ny/nl, Nz/nl];
    // Binormal = T × N
    const Bx = Ty*nz - Tz*ny, By = Tz*nx - Tx*nz, Bz = Tx*ny - Ty*nx;
    for (let j = 0; j < TS; j++) {
      const theta = 2 * Math.PI * j / TS;
      const cr = Math.cos(theta) * WR, sr = Math.sin(theta) * WR;
      V.push([px + nx*cr + Bx*sr, py + ny*cr + By*sr, pz + nz*cr + Bz*sr]);
    }
  }
  for (let p = 0; p < N_PATH; p++) {
    const rA = p * TS, rB = (p + 1) * TS;
    for (let j = 0; j < TS; j++) {
      const nj = (j + 1) % TS;
      tris.push([rA+j, rA+nj, rB+nj], [rA+j, rB+nj, rB+j]);
    }
  }
  // Endcaps
  const bc = [0, 0, 0];
  for (let j = 0; j < TS; j++) { bc[0] += V[j][0]; bc[1] += V[j][1]; bc[2] += V[j][2]; }
  const bi = V.length; V.push([bc[0]/TS, bc[1]/TS, bc[2]/TS]);
  for (let j = 0; j < TS; j++) tris.push([bi, (j+1)%TS, j]);
  const ls = N_PATH * TS;
  const tc = [0, 0, 0];
  for (let j = 0; j < TS; j++) { tc[0] += V[ls+j][0]; tc[1] += V[ls+j][1]; tc[2] += V[ls+j][2]; }
  const ti = V.length; V.push([tc[0]/TS, tc[1]/TS, tc[2]/TS]);
  for (let j = 0; j < TS; j++) tris.push([ti, ls+j, ls+(j+1)%TS]);
  const bbox = _bbox(V);
  return { V, tris, meta: { type: 'spring', triangles: tris.length,
    size: [(CR + WR) * 2, H, (CR + WR) * 2], bbox } };
}

// ─── 16. NIDS D'ABEILLE (hex panel) ──────────────────────────────────────────
export function defaultHexPanelSpec(ov = {}) {
  return { cellDiam: 22, cols: 5, rows: 4, height: 10, wall: 2, ...ov };
}
export function buildHexPanel(spec = {}) {
  const s = { ...defaultHexPanelSpec(), ...spec };
  const { cellDiam: D, cols: NC, rows: NR, height: H, wall: W } = s;
  const R = D / 2, ri = R - W;
  const SQ3 = Math.sqrt(3);
  // Pointy-top hex angles: 30, 90, 150, 210, 270, 330°
  const angs = Array.from({ length: 6 }, (_, k) => (Math.PI / 6) + k * (Math.PI / 3));
  const V = [], tris = [];
  for (let col = 0; col < NC; col++) {
    for (let row = 0; row < NR; row++) {
      const cx = col * R * SQ3;
      const cz = row * R * 1.5 + (col % 2 ? 0 : R * 0.75);
      const base = V.length;
      angs.forEach(a => V.push([cx + R  * Math.cos(a), H, cz + R  * Math.sin(a)]));
      angs.forEach(a => V.push([cx + R  * Math.cos(a), 0, cz + R  * Math.sin(a)]));
      angs.forEach(a => V.push([cx + ri * Math.cos(a), H, cz + ri * Math.sin(a)]));
      angs.forEach(a => V.push([cx + ri * Math.cos(a), 0, cz + ri * Math.sin(a)]));
      const OT = base, OB = base+6, IT = base+12, IB = base+18;
      for (let k = 0; k < 6; k++) {
        const nk = (k + 1) % 6;
        tris.push([OT+k, OT+nk, OB+nk], [OT+k, OB+nk, OB+k]);
        tris.push([IT+k, IB+k, IB+nk], [IT+k, IB+nk, IT+nk]);
        tris.push([OT+k, IT+nk, OT+nk], [OT+k, IT+k, IT+nk]);
        tris.push([OB+k, OB+nk, IB+nk], [OB+k, IB+nk, IB+k]);
      }
    }
  }
  const bbox = _bbox(V);
  return { V, tris, meta: { type: 'hex_panel', triangles: tris.length,
    cells: NC * NR, size: bbox.size, bbox } };
}

// ─── 17. ABAT-JOUR POLYGONAL FACETTÉ ─────────────────────────────────────────
// Frustum à N faces plates : chaque panel est un quadrilatère coplanaire garanti.
export function defaultShadeFacetteSpec(ov = {}) {
  return { faces: 6, topDia: 100, bottomDia: 260, height: 180, wall: 2.0, ...ov };
}

export function buildShadeFacette(spec = {}) {
  const s = { ...defaultShadeFacetteSpec(), ...spec };
  const N = Math.max(3, Math.min(24, s.faces | 0));
  const H = s.height, W = s.wall;
  const Rt = s.topDia / 2, Rb = s.bottomDia / 2;
  const Rti = Rt <= W ? 0 : Rt - W;
  const Rbi = Math.max(1, Rb - W);
  const V = [], tris = [];
  // 4 rings of N vertices: outer-bottom, outer-top, inner-top, inner-bottom
  for (let ring = 0; ring < 4; ring++) {
    const r = [Rb, Rt, Rti, Rbi][ring];
    const y = [0, H, H, 0][ring];
    for (let i = 0; i < N; i++) {
      const a = 2 * Math.PI * i / N;
      V.push([r * Math.cos(a), y, r * Math.sin(a)]);
    }
  }
  const OB = 0, OT = N, IT = 2 * N, IB = 3 * N;
  for (let i = 0; i < N; i++) {
    const ni = (i + 1) % N;
    tris.push([OB+i, OT+ni, OB+ni], [OB+i, OT+i,  OT+ni]); // outer face
    tris.push([IT+i, IB+ni, IT+ni], [IT+i, IB+i,  IB+ni]); // inner face
    tris.push([OT+i, IT+i,  IT+ni], [OT+i, IT+ni, OT+ni]); // top rim
    tris.push([OB+i, OB+ni, IB+ni], [OB+i, IB+ni, IB+i ]); // bottom rim
  }
  const bbox = _bbox(V);
  return { V, tris, meta: {
    type: 'shade_facette', style:'facetted', risk_flags:['sharp_edges'],
    generator: 'shade_facette', params: { ...s },
    triangles: tris.length, size: [Rb * 2, H, Rb * 2], bbox,
    wallMm: W, watertight: true,
  }};
}

// ─── 18. CHAISE — builder menuisier paramétrique ─────────────────────────────
// Géométrie composée : assise + 4 pieds + dossier (lattes) + 4 traverses
// Toutes dimensions en mm. Pieds arrière continus → montants du dossier.
export function defaultChairSpec(ov = {}) {
  return {
    seatW: 450, seatD: 420, seatT: 38,   // assise largeur / profondeur / épaisseur
    seatH: 450,                            // hauteur de l'assise (sol → dessus)
    legS:  38,                             // section carrée des pieds (mm)
    backH: 490,                            // hauteur dossier (assise → sommet)
    slatN: 3, slatH: 55, slatT: 18,       // lattes : nombre / hauteur / épaisseur
    stretH: 120, stretT: 22,              // traverse : hauteur depuis sol / épaisseur
    wall: 38,                              // épaisseur paroi (= legS pour pied massif)
    ...ov
  };
}

export function buildChairMesh(spec = {}) {
  const s = defaultChairSpec(spec);
  const { seatW: SW, seatD: SD, seatT: ST, seatH: SH, legS: LS,
          backH: BH, slatN: SN, slatH: SL_H, slatT: SL_T,
          stretH: STH, stretT: STT } = s;

  const V = [], tris = [];

  // Helper : ajoute un bloc (boîte fermée 6 faces)
  // cx=centre-X, by=base-Y, cz=centre-Z, w,h,d = demi-largeur/hauteur totale/demi-profondeur
  function _box(cx, by, cz, w, h, d) {
    const x0=cx-w/2, x1=cx+w/2, y0=by, y1=by+h, z0=cz-d/2, z1=cz+d/2;
    _addFace(V,tris,[[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]], true);  // bas
    _addFace(V,tris,[[x0,y1,z0],[x0,y1,z1],[x1,y1,z1],[x1,y1,z0]]);        // haut
    _addFace(V,tris,[[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],[x1,y0,z0]], true);  // avant
    _addFace(V,tris,[[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]]);        // arrière
    _addFace(V,tris,[[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0]]);        // gauche
    _addFace(V,tris,[[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[x1,y0,z1]]);        // droite
  }

  // Coordonnées des axes de pied (depuis centre chaise)
  const px = (SW - LS) / 2;    // demi-écart pieds X
  const pzF = (SD - LS) / 2;   // Z pied avant (positif = face avant)
  const pzB = -(SD - LS) / 2;  // Z pied arrière (négatif = face arrière)

  // Assise (planche)
  _box(0, SH - ST, 0, SW, ST, SD);

  // Pieds avant : du sol → dessous de l'assise
  _box(-px, 0, pzF, LS, SH - ST, LS);
  _box( px, 0, pzF, LS, SH - ST, LS);

  // Pieds arrière : continus du sol → sommet dossier
  const rearH = SH + BH;
  _box(-px, 0, pzB, LS, rearH, LS);
  _box( px, 0, pzB, LS, rearH, LS);

  // Lattes de dossier (réparties entre SH+60 et SH+BH-40)
  const slatSpan = BH - 100;
  for (let i = 0; i < SN; i++) {
    const sy = SH + 60 + (i / Math.max(1, SN - 1)) * slatSpan;
    _box(0, sy, pzB + LS/2, SW - LS*2, SL_H, SL_T);
  }

  // Traverses sous l'assise (renforts)
  const inner_x = SW - LS*2;
  const inner_z = SD - LS*2;
  _box(0,     STH, pzF + LS/2, inner_x, STT, STT);  // avant
  _box(0,     STH, pzB - LS/2, inner_x, STT, STT);  // arrière
  _box(-px + LS/2, STH, 0, STT, STT, inner_z);       // gauche
  _box( px - LS/2, STH, 0, STT, STT, inner_z);       // droite

  const bbox = _bbox(V);
  const sz = bbox.size.map(v => Math.round(v));
  return { V, tris, meta: {
    type: 'chair', style: 'scandinavian', risk_flags: ['assembly_required'],
    generator: 'chair', units: 'mm', params: { ...s },
    triangles: tris.length, verts: V.length,
    size: sz, bbox, watertight: true,
    pieces: {
      assise:    { n:1,  dims:[SW, ST, SD],           matiere:'chêne massif' },
      piedAvant: { n:2,  dims:[LS, SH-ST, LS],        matiere:'chêne massif' },
      piedArriere:{ n:2, dims:[LS, SH+BH, LS],        matiere:'chêne massif' },
      latte:     { n:SN, dims:[SW-LS*2, SL_H, SL_T],  matiere:'chêne massif' },
      traverse:  { n:4,  dims:['variable', STT, STT], matiere:'chêne massif' },
    },
  }};
}

// ─── VEHICLE 4×4 LOW POLY ────────────────────────────────────────────────────
// Dimensions en mm au 1:18 (printable sur BamBu A1 256³)
export function defaultVehicleSpec(ov = {}) {
  return {
    bodyL:      240,   // longueur totale
    bodyW:      105,   // largeur carrosserie
    wheelbase:  140,   // empattement (axe→axe)
    trackW:      88,   // voie (centre roue G↔D)
    wheelR:      22,   // rayon roue
    wheelW:      14,   // largeur pneu
    groundClear: 13,   // garde au sol
    cabinH:      50,   // ht. cabine (ligne de caisse → toit)
    cabinL:     120,   // longueur cabine
    hoodH:       22,   // ht. capot / coffre (ligne de caisse)
    panelT:       2,   // épaisseur paroi carrosserie (impression)
    ...ov
  };
}

export function buildVehicleMesh(spec = {}) {
  const s = defaultVehicleSpec(spec);
  const { bodyL:BL, bodyW:BW, wheelbase:WB, trackW:TW,
          wheelR:WR, wheelW:WW, groundClear:GC,
          cabinH:CH, cabinL:CL, hoodH:HH, panelT:PT } = s;

  const V = [], tris = [];

  // boîte fermée 6 faces (cx/cz = centre X/Z, by = base Y)
  function _box(cx, by, cz, w, h, d) {
    if (w <= 0 || h <= 0 || d <= 0) return;
    const x0=cx-w/2, x1=cx+w/2, y0=by, y1=by+h, z0=cz-d/2, z1=cz+d/2;
    _addFace(V,tris,[[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]], true);
    _addFace(V,tris,[[x0,y1,z0],[x0,y1,z1],[x1,y1,z1],[x1,y1,z0]]);
    _addFace(V,tris,[[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],[x1,y0,z0]], true);
    _addFace(V,tris,[[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]]);
    _addFace(V,tris,[[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0]]);
    _addFace(V,tris,[[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[x1,y0,z1]]);
  }

  // prisme polygonal low-poly = roue (axle center cx, axleY, cz)
  function _wheel(cx, axleY, cz, R, W, N=10) {
    const o = V.length;
    V.push([cx, axleY, cz + W/2]);          // o: centre face Z+
    for (let i=0;i<N;i++) {
      const a = i/N * Math.PI*2;
      V.push([cx + Math.cos(a)*R, axleY + Math.sin(a)*R, cz + W/2]);
    }
    V.push([cx, axleY, cz - W/2]);          // o+N+1: centre face Z-
    for (let i=0;i<N;i++) {
      const a = i/N * Math.PI*2;
      V.push([cx + Math.cos(a)*R, axleY + Math.sin(a)*R, cz - W/2]);
    }
    for (let i=0;i<N;i++) tris.push([o, o+1+i, o+1+(i+1)%N]);
    for (let i=0;i<N;i++) tris.push([o+N+1, o+N+2+(i+1)%N, o+N+2+i]);
    for (let i=0;i<N;i++) {
      const a=o+1+i, b=o+1+(i+1)%N, c=o+N+2+(i+1)%N, d=o+N+2+i;
      tris.push([a,b,c],[a,c,d]);
    }
  }

  // ── Coordonnées clés ─────────────────────────────────────────────────
  const axleY   = WR;                 // centre essieu (roue pose sur sol Y=0)
  const bodyY   = GC;                 // fond carrosserie
  const bodyTopY= bodyY + HH;         // ligne de caisse haute = dessus capot/coffre
  const roofY   = bodyY + CH;         // dessus toit

  // Z : front = +, rear = - (caméra Three.js voit le +)
  const frontZ  =  WB / 2;           // axe avant
  const rearZ   = -WB / 2;           // axe arrière
  // overhang (capot + coffre symétriques)
  const ohL     = (BL - CL) / 2;     // longueur overhang avant ET arrière
  const cabFZ   =  CL / 2;           // avant cabine
  const cabRZ   = -CL / 2;           // arrière cabine
  const noseZ   =  BL / 2;           // avant pare-chocs
  const tailZ   = -BL / 2;           // arrière pare-chocs

  const wheelXL = -TW / 2;
  const wheelXR =  TW / 2;

  // ── 1. Roues (4×, low-poly 10 faces) ─────────────────────────────────
  _wheel(wheelXL, axleY, frontZ, WR, WW);
  _wheel(wheelXR, axleY, frontZ, WR, WW);
  _wheel(wheelXL, axleY, rearZ,  WR, WW);
  _wheel(wheelXR, axleY, rearZ,  WR, WW);

  // ── 2. Capot (avant — entre nez et cabine) ───────────────────────────
  _box(0, bodyY, (cabFZ + noseZ) / 2, BW, HH, ohL);

  // ── 3. Coffre (arrière — entre cabine et pare-chocs) ─────────────────
  _box(0, bodyY, (cabRZ + tailZ) / 2, BW, HH * 0.85, ohL);

  // ── 4. Plancher cabine (dalle basse) ──────────────────────────────────
  _box(0, bodyY, 0, BW, PT * 2, CL);

  // ── 5. Parois latérales cabine ────────────────────────────────────────
  const cabSideY = bodyY + PT * 2;
  const cabSideH = CH - PT * 2;
  _box(-BW/2 + PT/2, cabSideY, 0, PT, cabSideH, CL);
  _box( BW/2 - PT/2, cabSideY, 0, PT, cabSideH, CL);

  // ── 6. Toit (plus court que la cabine = sur-toit court SUV) ──────────
  const roofLen = CL * 0.78;
  _box(0, roofY - PT, 0, BW, PT, roofLen);

  // ── 7. Pare-brise avant (panneau vertical fin) ────────────────────────
  const pwH = CH - HH - PT * 2;
  _box(0, bodyY + HH, cabFZ - PT/2, BW, pwH, PT);

  // ── 8. Lunette arrière ───────────────────────────────────────────────
  _box(0, bodyY + HH * 0.85, cabRZ + PT/2, BW, pwH * 0.7, PT);

  // ── 9. Passages de roue (4 arches basses autour de chaque roue) ──────
  const archH  = axleY + WR * 0.6 - bodyY;  // hauteur arche depuis fond carrosserie
  const archW  = WW + PT * 3;                // largeur arche = pneu + débord
  const archD  = WR * 2.2;                   // profondeur arche
  _box(wheelXL, bodyY, frontZ, archW, archH, archD);
  _box(wheelXR, bodyY, frontZ, archW, archH, archD);
  _box(wheelXL, bodyY, rearZ,  archW, archH, archD);
  _box(wheelXR, bodyY, rearZ,  archW, archH, archD);

  // ── 10. Marchepieds (entre arches avant et arrière) ──────────────────
  const stepH = bodyY;
  const stepW = WW * 0.8;
  const stepD = Math.max(1, WB - WR * 2.2);
  const stepY = GC * 0.4;
  _box(-TW/2, stepY, 0, stepW, stepH - stepY, stepD);
  _box( TW/2, stepY, 0, stepW, stepH - stepY, stepD);

  // ── 11. Pare-chocs avant / arrière ────────────────────────────────────
  const bmpH = Math.max(1, GC * 1.4);
  const bmpD = PT * 2.5;
  _box(0, bodyY, noseZ - bmpD/2, BW + 6, bmpH, bmpD);
  _box(0, bodyY, tailZ + bmpD/2, BW + 6, bmpH, bmpD);

  // ── 12. Barres de toit (look 4×4) ────────────────────────────────────
  const brW = 3, brH = 3;
  _box(-BW/2 + 6, roofY, 0, brW, brH, roofLen * 0.75);
  _box( BW/2 - 6, roofY, 0, brW, brH, roofLen * 0.75);

  const bbox = _bbox(V);
  const sz = bbox.size.map(v => Math.round(v));
  return { V, tris, meta: {
    type: 'vehicle_4x4', style: 'low_poly_beamng',
    risk_flags: ['multi_part', 'assembly_required'],
    generator: 'vehicle_4x4', units: 'mm', params: { ...s },
    triangles: tris.length, verts: V.length,
    size: sz, bbox, watertight: true,
    pieces: {
      carrosserie: { n:1,  dims:[BW, CH, BL],         matiere:'PLA/ABS' },
      roue:        { n:4,  dims:[WW, WR*2, WR*2],     matiere:'TPU' },
      pare_chocs:  { n:2,  dims:[BW+6, bmpH, bmpD],   matiere:'TPU flex' },
      toit:        { n:1,  dims:[BW, PT, roofLen],     matiere:'PLA transp.' },
      barre_toit:  { n:2,  dims:[brW, brH, roofLen*.75], matiere:'PLA' },
    },
  }};
}

// ─── SHADE LAMELLES (couronne de lamelles verticales sur anneaux) ────────────
// N lamelles plates disposées en couronne autour de l'axe Y.
// tiltDeg > 0 : sommet s'écarte du centre (évasé haut = bol).
// tiltDeg < 0 : sommet se rapproche (abat-jour classique).
// Deux anneaux (bas + haut) maintiennent les lamelles.
export function defaultShadellesSpec(ov = {}) {
  return {
    numLamelles: 18,   // nombre de lamelles
    lamelleW:    22,   // largeur d'une lamelle (mm)
    lamelleT:   1.8,   // épaisseur lamelle (mm)
    height:     200,   // hauteur totale (anneaux inclus)
    radius:      85,   // rayon de la couronne (axe→centre lamelle)
    tiltDeg:      0,   // inclinaison depuis la verticale (°)
    rimH:         8,   // hauteur anneau haut / bas
    rimT:         5,   // épaisseur radiale anneau
    segments:    64,   // résolution des anneaux
    ...ov
  };
}

export function buildShadellesMesh(spec = {}) {
  const s = defaultShadellesSpec(spec);
  const { numLamelles: N, lamelleW: LW, lamelleT: LT, height: H,
          radius: R, tiltDeg, rimH: RH, rimT: RT, segments: SEG } = s;

  const V = [], tris = [];
  const tiltRad = tiltDeg * Math.PI / 180;
  const lamelleH = Math.max(10, H - 2 * RH);
  const halfW = LW / 2, halfT = LT / 2;

  // Décalage radial du sommet dû à l'inclinaison
  const topRadialOff = Math.sin(tiltRad) * lamelleH;
  const topY = RH + Math.cos(Math.abs(tiltRad)) * lamelleH;

  // ── Lamelles ──────────────────────────────────────────────────────────────
  for (let i = 0; i < N; i++) {
    const ang = (i / N) * Math.PI * 2;
    const rx = Math.cos(ang), rz = Math.sin(ang);   // direction radiale
    const tx = -Math.sin(ang), tz = Math.cos(ang);  // direction tangentielle

    // Pied de la lamelle (anneau bas) — à Y=RH, rayon R
    const bx = R * rx, bz = R * rz;
    // Sommet (anneau haut) — décalé radialement par l'inclinaison
    const topX = (R + topRadialOff) * rx, topZ = (R + topRadialOff) * rz;

    // 8 sommets du parallélépipède (face externe = radial+, interne = radial-)
    const b0 = [bx - halfW*tx - halfT*rx, RH,  bz - halfW*tz - halfT*rz];
    const b1 = [bx + halfW*tx - halfT*rx, RH,  bz + halfW*tz - halfT*rz];
    const b2 = [bx + halfW*tx + halfT*rx, RH,  bz + halfW*tz + halfT*rz];
    const b3 = [bx - halfW*tx + halfT*rx, RH,  bz - halfW*tz + halfT*rz];
    const t0 = [topX - halfW*tx - halfT*rx, topY, topZ - halfW*tz - halfT*rz];
    const t1 = [topX + halfW*tx - halfT*rx, topY, topZ + halfW*tz - halfT*rz];
    const t2 = [topX + halfW*tx + halfT*rx, topY, topZ + halfW*tz + halfT*rz];
    const t3 = [topX - halfW*tx + halfT*rx, topY, topZ - halfW*tz + halfT*rz];

    _addFace(V, tris, [b0, b1, t1, t0]);          // face avant (radial-)
    _addFace(V, tris, [b2, b3, t3, t2], true);    // face arrière (radial+)
    _addFace(V, tris, [b3, b0, t0, t3]);           // côté gauche
    _addFace(V, tris, [b1, b2, t2, t1], true);    // côté droit
    _addFace(V, tris, [b3, b2, b1, b0], true);    // fond bas
    _addFace(V, tris, [t0, t1, t2, t3]);           // fond haut
  }

  // ── Anneaux (anneau cylindrique creux, SEG segments) ──────────────────────
  function _ring(y0, y1, rIn, rOut) {
    for (let s = 0; s < SEG; s++) {
      const a0 = (s / SEG) * Math.PI * 2, a1 = ((s + 1) / SEG) * Math.PI * 2;
      const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      // Paroi extérieure
      _addFace(V, tris, [[c0*rOut,y0,s0*rOut],[c1*rOut,y0,s1*rOut],[c1*rOut,y1,s1*rOut],[c0*rOut,y1,s0*rOut]]);
      // Paroi intérieure
      _addFace(V, tris, [[c0*rIn,y0,s0*rIn],[c0*rIn,y1,s0*rIn],[c1*rIn,y1,s1*rIn],[c1*rIn,y0,s1*rIn]]);
      // Dessus
      _addFace(V, tris, [[c0*rIn,y1,s0*rIn],[c0*rOut,y1,s0*rOut],[c1*rOut,y1,s1*rOut],[c1*rIn,y1,s1*rIn]]);
      // Dessous
      _addFace(V, tris, [[c0*rIn,y0,s0*rIn],[c1*rIn,y0,s1*rIn],[c1*rOut,y0,s1*rOut],[c0*rOut,y0,s0*rOut]], true);
    }
  }

  // Anneau bas : centré sur R, de y=0 à y=RH
  _ring(0, RH, R - RT, R + RT);
  // Anneau haut : centré sur R + topRadialOff, de y=topY à y=topY+RH
  _ring(topY, topY + RH, R + topRadialOff - RT, R + topRadialOff + RT);

  const bbox = _bbox(V);
  const sz = bbox.size.map(v => Math.round(v));
  return { V, tris, meta: {
    type: 'shade_lamelles', style: 'lamelle_crown',
    risk_flags: tiltDeg !== 0 ? ['overhang_warning'] : [],
    generator: 'shade_lamelles', units: 'mm', params: { ...s },
    triangles: tris.length, verts: V.length,
    size: sz, bbox, watertight: false,
    pieces: {
      lamelle:     { n: N, dims: [LW, LT, Math.round(lamelleH)], matiere: 'PLA/bois' },
      anneau_bas:  { n: 1, dims: [Math.round((R + RT) * 2), RH, Math.round((R + RT) * 2)], matiere: 'PLA' },
      anneau_haut: { n: 1, matiere: 'PLA' },
    },
  }};
}

// ─── TABLE PARAMÉTRIQUE ───────────────────────────────────────────────────────
// topShape: 'rect' | 'round' | 'square'
// legStyle: 'straight' | 'tapered' | 'column' (1 colonne centrale)
// Toutes dimensions en mm.
export function defaultTableSpec(ov = {}) {
  return {
    topW:     800,   // largeur plateau (ou Ø si round/square)
    topD:     400,   // profondeur plateau (ignoré si round)
    topT:      22,   // épaisseur plateau
    legH:     720,   // hauteur pied (sol → dessous plateau)
    legS:      45,   // section carrée pied (ou Ø si column)
    legInset:  40,   // retrait pied depuis bord plateau
    stretchH: 200,   // hauteur traverse depuis sol (0 = pas de traverse)
    stretchT:  22,   // épaisseur traverse
    topShape: 'rect',
    legStyle: 'straight',
    ...ov
  };
}

export function buildTableMesh(spec = {}) {
  const s = defaultTableSpec(spec);
  const { topW:TW, topD:TD, topT:TT, legH:LH, legS:LS,
          legInset:LI, stretchH:STH, stretchT:STT,
          topShape, legStyle } = s;

  const V = [], tris = [];
  function _box(cx, by, cz, w, h, d) {
    if (w <= 0 || h <= 0 || d <= 0) return;
    const x0=cx-w/2, x1=cx+w/2, y0=by, y1=by+h, z0=cz-d/2, z1=cz+d/2;
    _addFace(V,tris,[[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]], true);
    _addFace(V,tris,[[x0,y1,z0],[x0,y1,z1],[x1,y1,z1],[x1,y1,z0]]);
    _addFace(V,tris,[[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],[x1,y0,z0]], true);
    _addFace(V,tris,[[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]]);
    _addFace(V,tris,[[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0]]);
    _addFace(V,tris,[[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[x1,y0,z1]]);
  }
  function _cylinder(cx, by, cz, r, h, N=16) {
    const base = V.length;
    const bc = V.length; V.push([cx, by, cz]);
    for (let i=0;i<N;i++) {
      const a = i/N*Math.PI*2;
      V.push([cx+Math.cos(a)*r, by, cz+Math.sin(a)*r]);
    }
    const tc = V.length; V.push([cx, by+h, cz]);
    for (let i=0;i<N;i++) {
      const a = i/N*Math.PI*2;
      V.push([cx+Math.cos(a)*r, by+h, cz+Math.sin(a)*r]);
    }
    for (let i=0;i<N;i++) {
      tris.push([base, base+1+i, base+1+(i+1)%N]);
      tris.push([tc, tc+1+(i+1)%N, tc+1+i]);
      const a=base+1+i, b=base+1+(i+1)%N, c=tc+1+(i+1)%N, d=tc+1+i;
      tris.push([a,b,c],[a,c,d]);
    }
  }

  // ── Plateau ───────────────────────────────────────────────────────────────
  const pY = LH;
  const pW = topShape === 'square' ? TW : TW;
  const pD = topShape === 'round' || topShape === 'square' ? pW : TD;

  if (topShape === 'round') {
    _cylinder(0, pY, 0, pW/2, TT, 48);
  } else {
    _box(0, pY, 0, pW, TT, pD);
  }

  // ── Pieds ─────────────────────────────────────────────────────────────────
  const hpW = pW/2 - LI - LS/2;
  const hpD = pD/2 - LI - LS/2;

  if (legStyle === 'column') {
    // 1 colonne centrale
    _cylinder(0, 0, 0, LS/2, LH, 16);
    // Base disque
    _cylinder(0, 0, 0, LS*1.8, 25, 24);
  } else {
    const taper = legStyle === 'tapered' ? 0.6 : 1.0;
    const legPositions = [[-hpW,hpD],[hpW,hpD],[-hpW,-hpD],[hpW,-hpD]];
    for (const [lx, lz] of legPositions) {
      if (legStyle === 'tapered') {
        // Frustum pied fuselé : plus fin en bas
        const baseS = LS, topS = LS * taper;
        const oi = V.length;
        const pts = (r, y) => {
          for (let i=0;i<4;i++) {
            const a = Math.PI/4 + i*Math.PI/2;
            V.push([lx + Math.cos(a)*r/Math.SQRT2, y, lz + Math.sin(a)*r/Math.SQRT2]);
          }
        };
        pts(baseS, 0); pts(topS, LH);
        for (let i=0;i<4;i++) {
          const ni=(i+1)%4;
          tris.push([oi+i,oi+ni,oi+4+ni],[oi+i,oi+4+ni,oi+4+i]);
        }
        tris.push([oi,oi+2,oi+1],[oi,oi+3,oi+2]);
        tris.push([oi+4,oi+5,oi+6],[oi+4,oi+6,oi+7]);
      } else {
        _box(lx, 0, lz, LS, LH, LS);
      }
    }

    // ── Traverses (sous plateau) ──────────────────────────────────────────
    if (STH > 0 && STH < LH) {
      const spanX = hpW * 2 - LS;
      const spanZ = hpD * 2 - LS;
      if (spanX > 0) {
        _box(0, STH, -hpD, spanX, STT, STT); // traverse avant
        _box(0, STH,  hpD, spanX, STT, STT); // traverse arrière
      }
      if (spanZ > 0) {
        _box(-hpW, STH, 0, STT, STT, spanZ); // traverse gauche
        _box( hpW, STH, 0, STT, STT, spanZ); // traverse droite
      }
    }
  }

  const bbox = _bbox(V);
  const sz = bbox.size.map(v => Math.round(v));
  return { V, tris, meta: {
    type: 'table', style: topShape + '_' + legStyle,
    risk_flags: [],
    generator: 'table', units: 'mm', params: { ...s },
    triangles: tris.length, verts: V.length,
    size: sz, bbox, watertight: true,
    pieces: {
      plateau: { n:1, dims:[pW, TT, pD], matiere:'chêne/noyer massif' },
      pied:    { n: legStyle === 'column' ? 1 : 4, dims:[LS, LH, LS], matiere:'chêne massif' },
      ...(STH > 0 && legStyle !== 'column' ? {
        traverse: { n:4, dims:['variable', STT, STT], matiere:'chêne massif' }
      } : {}),
    },
  }};
}

// ─── LAMP KINETIC (couronne de lamelles pivotantes sur bosses axiales) ────────
// Mécanisme : chaque lamelle a 2 bosses cylindriques (haut + bas) qui s'insèrent
// dans les logements des anneaux. La lamelle peut pivoter autour de son axe vertical.
// Pièces : N lamelles PLA (flat-on-bed) + 2 anneaux PLA + aucun achat requis.
export function defaultLampKineticSpec(ov = {}) {
  return {
    numLamelles: 18,
    lamelleW:    28,    // largeur lamelle (mm)
    lamelleT:    2.5,   // épaisseur lamelle (mm)
    height:      220,   // hauteur totale (mm)
    radius:       90,   // rayon couronne (mm)
    tiltDeg:       0,   // inclinaison repos (° / vertical, 0 = fermé)
    rimH:         10,   // hauteur anneau (mm)
    rimT:          7,   // épaisseur radiale anneau (mm)
    pivotDia:    3.0,   // Ø boss pivot (mm)
    pivotLen:    5.0,   // longueur boss pivot (mm)
    segments:     64,
    ...ov
  };
}

export function buildLampKinetic(spec = {}) {
  const s = { ...defaultLampKineticSpec(), ...spec };
  const { numLamelles:N, lamelleW:LW, lamelleT:LT, height:H,
          radius:R, tiltDeg, rimH:RH, rimT:RT,
          pivotDia:PD, pivotLen:PL, segments:SEG } = s;

  const V = [], tris = [];
  const tiltRad     = tiltDeg * Math.PI / 180;
  const lamelleH    = Math.max(10, H - 2 * RH);
  const halfW       = LW / 2, halfT = LT / 2;
  const topRadialOff = Math.sin(tiltRad) * lamelleH;
  const topY        = RH + Math.cos(Math.abs(tiltRad)) * lamelleH;
  const PR          = PD / 2;  // rayon boss pivot
  const PBORE       = 8;       // segments cylindre boss

  // ── 1. Lamelles + bosses pivot ────────────────────────────────────────────
  for (let i = 0; i < N; i++) {
    const ang = (i / N) * Math.PI * 2;
    const rx  = Math.cos(ang), rz = Math.sin(ang);
    const tx  = -Math.sin(ang), tz = Math.cos(ang);

    const bx = R * rx, bz = R * rz;
    const topX = (R + topRadialOff) * rx, topZ = (R + topRadialOff) * rz;

    // Boîte lamelle (6 faces)
    const b0=[bx-halfW*tx-halfT*rx, RH,   bz-halfW*tz-halfT*rz];
    const b1=[bx+halfW*tx-halfT*rx, RH,   bz+halfW*tz-halfT*rz];
    const b2=[bx+halfW*tx+halfT*rx, RH,   bz+halfW*tz+halfT*rz];
    const b3=[bx-halfW*tx+halfT*rx, RH,   bz-halfW*tz+halfT*rz];
    const t0=[topX-halfW*tx-halfT*rx, topY, topZ-halfW*tz-halfT*rz];
    const t1=[topX+halfW*tx-halfT*rx, topY, topZ+halfW*tz-halfT*rz];
    const t2=[topX+halfW*tx+halfT*rx, topY, topZ+halfW*tz+halfT*rz];
    const t3=[topX-halfW*tx+halfT*rx, topY, topZ-halfW*tz+halfT*rz];
    _addFace(V,tris,[b0,b1,t1,t0]);
    _addFace(V,tris,[b2,b3,t3,t2],true);
    _addFace(V,tris,[b3,b0,t0,t3]);
    _addFace(V,tris,[b1,b2,t2,t1],true);
    _addFace(V,tris,[b3,b2,b1,b0],true);
    _addFace(V,tris,[t0,t1,t2,t3]);

    // Boss pivot bas : cylindre Ø PD × PL pointant vers le bas depuis y=RH
    // Cercle perpendiculaire à Y, dans le plan XZ
    function _boss(cx, y0, cz, downward) {
      const ySign = downward ? -1 : 1;
      const base = V.length;
      V.push([cx, y0, cz]);  // centre cap interne (face contre la lamelle)
      for (let k=0; k<PBORE; k++) {
        const a = k/PBORE*Math.PI*2;
        V.push([cx + Math.cos(a)*PR*tx + Math.cos(a)*PR*rx*0,
                y0,
                cz + Math.cos(a)*PR*tz + Math.cos(a)*PR*rz*0]);
      }
      // En réalité le cercle est dans XZ : combiner rx et tx
      // Recalculer proprement : cercle dans plan XZ centré sur (cx,y0,cz)
      // mais on ne peut pas modifier V déjà pushé → construire en avance
    }
    // Construction directe pour chaque boss (bas et haut)
    for (let bossIdx = 0; bossIdx < 2; bossIdx++) {
      const down   = bossIdx === 0;        // 0=bas, 1=haut
      const yFloor = down ? RH : topY;
      const yTip   = down ? (RH - PL) : (topY + PL);
      // Centre dans XZ : centre de la lamelle à ce rayon
      const lcx = (down ? bx : topX), lcz = (down ? bz : topZ);

      const bBase = V.length;
      // Cap proche de la lamelle (yFloor)
      V.push([lcx, yFloor, lcz]);
      for (let k=0; k<PBORE; k++) {
        const a = k/PBORE*Math.PI*2;
        V.push([lcx+Math.cos(a)*PR*rx + Math.sin(a)*PR*tx,
                yFloor,
                lcz+Math.cos(a)*PR*rz + Math.sin(a)*PR*tz]);
      }
      // Cap tip
      const bTip = V.length;
      V.push([lcx, yTip, lcz]);
      for (let k=0; k<PBORE; k++) {
        const a = k/PBORE*Math.PI*2;
        V.push([lcx+Math.cos(a)*PR*rx + Math.sin(a)*PR*tx,
                yTip,
                lcz+Math.cos(a)*PR*rz + Math.sin(a)*PR*tz]);
      }
      // Caps
      for (let k=0; k<PBORE; k++) {
        const nk=(k+1)%PBORE;
        if (down) {
          tris.push([bBase,bBase+1+k,bBase+1+nk]);
          tris.push([bTip,bTip+1+nk,bTip+1+k]);
        } else {
          tris.push([bBase,bBase+1+nk,bBase+1+k]);
          tris.push([bTip,bTip+1+k,bTip+1+nk]);
        }
      }
      // Paroi cylindre boss
      for (let k=0; k<PBORE; k++) {
        const nk=(k+1)%PBORE;
        tris.push([bBase+1+k,bTip+1+k,bTip+1+nk]);
        tris.push([bBase+1+k,bTip+1+nk,bBase+1+nk]);
      }
    }
  }

  // ── 2. Anneaux avec logements aux positions des lamelles ─────────────────
  // Les logements sont représentés en omettant les segments d'anneau autour
  // de chaque position de lamelle → trou visible = logement boss.
  function _ringSlotted(y0, y1, rIn, rOut, rCtr) {
    const halfSlot = (PD * 1.1) / rCtr; // demi-angle du logement (+ 10% jeu)
    for (let s=0; s<SEG; s++) {
      const a0 = (s/SEG)*Math.PI*2;
      const a1 = ((s+1)/SEG)*Math.PI*2;
      const aMid = (a0+a1)/2;
      let inSlot = false;
      for (let j=0; j<N; j++) {
        const la = (j/N)*Math.PI*2;
        let da = Math.abs(aMid-la);
        if (da > Math.PI) da = Math.PI*2-da;
        if (da < halfSlot) { inSlot=true; break; }
      }
      if (inSlot) continue;
      const c0=Math.cos(a0), s0=Math.sin(a0);
      const c1=Math.cos(a1), s1=Math.sin(a1);
      _addFace(V,tris,[[c0*rOut,y0,s0*rOut],[c1*rOut,y0,s1*rOut],[c1*rOut,y1,s1*rOut],[c0*rOut,y1,s0*rOut]]);
      _addFace(V,tris,[[c0*rIn,y0,s0*rIn],[c0*rIn,y1,s0*rIn],[c1*rIn,y1,s1*rIn],[c1*rIn,y0,s1*rIn]]);
      _addFace(V,tris,[[c0*rIn,y1,s0*rIn],[c0*rOut,y1,s0*rOut],[c1*rOut,y1,s1*rOut],[c1*rIn,y1,s1*rIn]]);
      _addFace(V,tris,[[c0*rIn,y0,s0*rIn],[c1*rIn,y0,s1*rIn],[c1*rOut,y0,s1*rOut],[c0*rOut,y0,s0*rOut]],true);
    }
  }

  _ringSlotted(0,   RH,        R-RT, R+RT, R);
  _ringSlotted(topY, topY+RH,  R+topRadialOff-RT, R+topRadialOff+RT, R+topRadialOff);

  const bbox = _bbox(V);
  const sz   = bbox.size.map(v => Math.round(v));

  return { V, tris, meta: {
    type: 'lamp_kinetic', style: 'kinetic_pivot',
    mechanism: 'pivot_boss',
    risk_flags: ['assembly_required'],
    generator: 'lamp_kinetic', units: 'mm', params: { ...s },
    triangles: tris.length, verts: V.length,
    size: sz, bbox, watertight: false,
    pivot: {
      type: 'boss_axial',
      boss_dia_mm: PD,
      boss_len_mm: PL,
      ring_hole_dia_mm: +(PD+0.3).toFixed(1),
      clearance_mm: 0.15,
      note: `Boss Ø${PD}mm intégré à la lamelle — logements Ø${(PD+0.3).toFixed(1)}mm dans les anneaux (imprimer directement ou percer)`,
    },
    assembly_steps: [
      `1. Imprimer ${N} lamelles (flat-on-bed, orientation LW×LH) + 2 anneaux`,
      `2. Vérifier les ${N} logements Ø${(PD+0.3).toFixed(1)}mm sur chaque anneau (percer si trop serrés)`,
      `3. Insérer les bosses basses de chaque lamelle dans l'anneau bas`,
      `4. Poser l'anneau haut en alignant les ${N} logements sur les bosses hautes`,
      `5. Les lamelles pivotent librement autour de leur axe vertical`,
    ],
    pieces: {
      lamelle:     { n:N, dims:[LW, LT, Math.round(lamelleH)], matiere:'PLA', orientation_impression:'flat-on-bed', feature:`2 bosses Ø${PD}mm × ${PL}mm` },
      anneau_bas:  { n:1, matiere:'PLA', features:`${N} logements Ø${(PD+0.3).toFixed(1)}mm sur la face supérieure` },
      anneau_haut: { n:1, matiere:'PLA', features:`${N} logements Ø${(PD+0.3).toFixed(1)}mm sur la face inférieure` },
    },
  }};
}

// ─── dispatcher ──────────────────────────────────────────────────────────────
export function buildShape(type, params = {}) {
  const B = { sphere:buildSphere,
               shade:buildShadeMesh, shade_facette:buildShadeFacette,
               vase:buildVaseMesh, bracket:buildBracketMesh,
               box:buildBoxMesh, shelf:buildShelfMesh,
               spline_lathe:buildSplineLathe, phyllotaxis_shade:buildPhyllotaxisShade,
               gyroid_shell:buildGyroidShell,
               phi_vase:buildPhiVase, penrose_shade:buildPenroseShade,
               golden_helix:buildGoldenHelix,
               torus:buildTorus, tube:buildTube, gear:buildGear,
               cone:buildCone, spring:buildSpring, hex_panel:buildHexPanel,
               chair:buildChairMesh, vehicle_4x4:buildVehicleMesh,
               table:buildTableMesh, shade_lamelles:buildShadellesMesh,
               lamp_kinetic:buildLampKinetic };
  if (!B[type]) throw new Error(`Shape inconnue: "${type}". Options: ${Object.keys(B).join(', ')}`);
  return B[type](params);
}

export function defaultSpec(type, ov = {}) {
  const D = { sphere:defaultSphereSpec,
               shade:defaultShadeSpec, shade_facette:defaultShadeFacetteSpec,
               vase:defaultVaseSpec, bracket:defaultBracketSpec,
               box:defaultBoxSpec, shelf:defaultShelfSpec,
               spline_lathe:defaultSplineLatheSpec, phyllotaxis_shade:defaultPhyllotaxisShadeSpec,
               gyroid_shell:defaultGyroidShellSpec,
               phi_vase:defaultPhiVaseSpec, penrose_shade:defaultPenroseShadeSpec,
               golden_helix:defaultGoldenHelixSpec,
               torus:defaultTorusSpec, tube:defaultTubeSpec, gear:defaultGearSpec,
               cone:defaultConeSpec, spring:defaultSpringSpec, hex_panel:defaultHexPanelSpec,
               chair:defaultChairSpec, vehicle_4x4:defaultVehicleSpec,
               table:defaultTableSpec, shade_lamelles:defaultShadellesSpec,
               lamp_kinetic:defaultLampKineticSpec };
  return (D[type] || (x => x))(ov);
}
