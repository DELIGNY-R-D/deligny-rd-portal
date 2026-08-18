// ─────────────────────────────────────────────────────────────────────────────
// vehicle_factory.mjs — NANO WORLDS · usine à véhicules PARTAGÉE
//
//   SOURCE DE VÉRITÉ des véhicules "nouvelle génération" (look mini Hot Wheels :
//   peinture vernie clearcoat, chrome, vitres teintées, roues à crampons/jantes
//   5 branches, livrées, panneaux déformables tagués façon BeamNG).
//
//   Extrait du cœur Suspension Arena pour Nano Worlds 3 :
//     • index.html  (jeu V3 — conduite, réglage, crash, progression autour du véhicule)
//
//   Convention : carrosserie construite AUTOUR DU CENTRE CHÂSSIS, avant = +Z.
//   Les roues (makeWheel) sont dessinées à R=0.36 → scale par (radius/0.36).
//
//   Usage :
//     import { makeVehicleFactory } from './vehicle_factory.mjs';
//     const VFAC = makeVehicleFactory({ THREE, RoundedBoxGeometry });
//     const mesh = VFAC.buildBodyMesh({ geo: VFAC.GEO.buggy }, { livery:'stripes', modules:{} });
//     const wheel = VFAC.makeWheel();   // × scale radius/0.36
// ─────────────────────────────────────────────────────────────────────────────

export function makeVehicleFactory({ THREE, RoundedBoxGeometry }) {

  // ── Géométries des 7 châssis du labo (radius roue · track ±x · base ±z · ride y · dimensions caisse · style) ──
  const GEO = {
    '4x4':    { radius: 0.38, track: 0.98, base: 1.00, ride: 0,     bw: 2.02, bh: 0.42, bl: 2.95, color: 0x2255aa, style: 'hummer',  label: '🚙 4×4' },
    sport:    { radius: 0.32, track: 0.86, base: 1.02, ride: -0.04, bw: 1.80, bh: 0.40, bl: 3.40, color: 0xd23b3b, style: 'sport',   label: '🏎 Sport' },
    trophy:   { radius: 0.42, track: 1.02, base: 1.16, ride: 0.02,  bw: 1.90, bh: 0.52, bl: 3.55, color: 0xe0a020, style: 'buggy',   label: '🏜 Trophy' },
    monster:  { radius: 0.64, track: 1.16, base: 1.14, ride: 0.06,  bw: 2.00, bh: 0.70, bl: 3.10, color: 0x8b3bd2, style: 'monster', label: '👹 Monster' },
    crawler:  { radius: 0.50, track: 1.06, base: 1.00, ride: 0.04,  bw: 1.86, bh: 0.50, bl: 2.90, color: 0x3b7fd2, style: 'buggy',   label: '🧗 Crawler' },
    buggy:    { radius: 0.40, track: 0.96, base: 1.02, ride: 0,     bw: 1.60, bh: 0.42, bl: 2.80, color: 0x30c060, style: 'buggy',   label: '🏁 Buggy' },
    drift:    { radius: 0.34, track: 0.90, base: 1.00, ride: -0.03, bw: 1.78, bh: 0.40, bl: 3.30, color: 0xff5522, style: 'sport',   label: '🏎 Drift' },
  };

  // ── Matériaux roue (partagés) ──
  const matRubber = new THREE.MeshStandardMaterial({ color: 0x141619, roughness: 0.92, metalness: 0.04 });
  const matLug    = new THREE.MeshStandardMaterial({ color: 0x22252b, roughness: 0.95, metalness: 0.03 }); // crampons (un peu plus clairs)
  const matRim    = new THREE.MeshStandardMaterial({ color: 0x9aa2ac, roughness: 0.35, metalness: 0.85 });

  function rbox(w, h, l, r = 0.08) { const rr = Math.min(r, Math.min(w, h, l) * 0.48); return new RoundedBoxGeometry(w, h, l, 3, rr); }

  // ── 🎨 LIVRÉES : décos "super cool" dessinées sur canvas → texture décalque ──
  const _livTexCache = {};
  function makeLiveryTexture(kind) {
    if (_livTexCache[kind]) return _livTexCache[kind];
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
    const c = cv.getContext('2d'); c.clearRect(0, 0, 256, 128);
    if (kind === 'flames') {
      const grad = c.createLinearGradient(0, 0, 256, 0); grad.addColorStop(0, '#ffd21a'); grad.addColorStop(0.5, '#ff8a00'); grad.addColorStop(1, '#ff2a00');
      c.fillStyle = grad; c.beginPath(); c.moveTo(256, 128); c.lineTo(0, 128); c.lineTo(0, 70);
      const tips = [[40, 30], [70, 62], [110, 18], [150, 55], [190, 22], [230, 60], [256, 40]];
      for (const [x, y] of tips) { c.lineTo(x - 14, y + 34); c.lineTo(x, y); }
      c.lineTo(256, 128); c.closePath(); c.fill();
      c.strokeStyle = '#7a1500'; c.lineWidth = 4; c.stroke();
    } else if (kind === 'checker') {
      const s = 21, y0 = 42;
      for (let i = 0; i < 13; i++) for (let j = 0; j < 2; j++) { c.fillStyle = ((i + j) % 2) ? '#0e0e0e' : '#f4f4f4'; c.fillRect(i * s, y0 + j * s, s, s); }
    } else if (kind === 'bolt') {
      c.fillStyle = '#ffd83a'; c.strokeStyle = '#c25a00'; c.lineWidth = 5;
      c.beginPath(); c.moveTo(150, 8); c.lineTo(96, 68); c.lineTo(132, 68); c.lineTo(104, 120); c.lineTo(176, 52); c.lineTo(138, 52); c.lineTo(172, 8); c.closePath();
      c.fill(); c.stroke();
    } else if (kind === 'number') {
      const n = ((kind.length * 7) % 9) + 1;   // numéro stable
      c.fillStyle = '#f4f6fa'; c.beginPath(); c.arc(128, 64, 52, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#12161c'; c.font = 'bold 78px Arial Black, Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(String(n), 128, 68);
    }
    const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 4; tex.needsUpdate = true;
    _livTexCache[kind] = tex; return tex;
  }

  // Roue réaliste : pneu caoutchouc + jante à 5 branches (des DEUX côtés) + moyeu -> la rotation se lit sur les branches
  function makeWheel() {
    const g = new THREE.Group();
    const rubberParts = [];                                // pneu + crampons : masqués quand le pneu éclate (roule sur jante)
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.45, 24), matRubber);   // pneu large (+50%)
    tire.rotation.z = Math.PI / 2; g.add(tire); rubberParts.push(tire);
    // 🔩 CRAMPONS (tread) : blocs qui dépassent de la bande de roulement, en chevrons sur 2 rangées
    const lugCount = 18;
    for (let s = 0; s < lugCount; s++) {
      const a = s * (Math.PI * 2 / lugCount);
      for (const row of [0.115, -0.115]) {              // 2 rangées, décalées (chevron) — pneu large
        const off = (s % 2 === 0) ? row : row * 0.45;
        const lug = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.09), matLug);
        lug.position.set(off, Math.cos(a) * 0.38, Math.sin(a) * 0.38);   // sur la bande, dépasse à ~0.41
        lug.rotation.x = a; lug.castShadow = true; g.add(lug); rubberParts.push(lug);
      }
    }
    g.userData.rubber = rubberParts;                       // -> setTireBurst() les masque
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.42, 20), matRim); // voile de jante (large)
    inner.rotation.z = Math.PI / 2; g.add(inner);
    for (const fx of [0.225, -0.225]) {                 // les 2 faces (écartées : pneu large)
      const face = new THREE.Mesh(new THREE.CylinderGeometry(0.255, 0.255, 0.02, 20), matRim);
      face.rotation.z = Math.PI / 2; face.position.x = fx; g.add(face);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 12), matRim);
      hub.rotation.z = Math.PI / 2; hub.position.x = fx * 1.15; g.add(hub);
      for (let s = 0; s < 5; s++) {                     // 5 branches -> repère de rotation naturel
        const a = s * (Math.PI * 2 / 5);
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.20, 0.032), matRim);
        spoke.position.set(fx, Math.cos(a) * 0.13, Math.sin(a) * 0.13);
        spoke.rotation.x = a; g.add(spoke);
      }
    }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return g;
  }

  // ── Carrosserie complète : caisse + panneaux déformables + vitres + livrée + accessoires méca ──
  //    (verbatim labo — opts.livery ∈ stripes/flames/checker/bolt/number/twotone, opts.modules {boost,wing,ballast})
  function buildBodyMesh(V, opts = {}) {
    const LIVERY = opts.livery || 'stripes';
    const MODULES = opts.modules || {};
    const g = V.geo, grp = new THREE.Group(), W = g.bw, H = g.bh, L = g.bl;
    // 🏎️ look "mini Hot Wheels" : peinture vernie brillante (clearcoat), chrome, verre teinté cool
    const paint  = new THREE.MeshPhysicalMaterial({ color: g.color, roughness: 0.30, metalness: 0.0, clearcoat: 1.0, clearcoatRoughness: 0.06, envMapIntensity: 1.3 });
    const glass  = new THREE.MeshPhysicalMaterial({ color: 0x1e2c3e, transparent: true, opacity: 0.74, roughness: 0.05, metalness: 0.0, clearcoat: 1.0, envMapIntensity: 1.4 });
    const chrome = new THREE.MeshStandardMaterial({ color: 0xe9eef4, metalness: 1.0, roughness: 0.15, envMapIntensity: 1.6 });   // pare-chocs / pots / jonc
    const dark   = new THREE.MeshStandardMaterial({ color: 0x14171c, roughness: 0.5,  metalness: 0.4 });   // bas de caisse / grille
    const metal  = new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.55, metalness: 0.85 });  // ⚙️ métal nu (radiateur/boîte/carter)
    const rust   = new THREE.MeshStandardMaterial({ color: 0x6b6f74, roughness: 0.7,  metalness: 0.9 });   // 🔩 acier terne (échappement/pot)
    const rubber = new THREE.MeshStandardMaterial({ color: 0x101215, roughness: 0.85, metalness: 0.1 });   // 🔌 caoutchouc (durites/courroie)
    const stripe = new THREE.MeshPhysicalMaterial({ color: 0xf4f6fa, roughness: 0.22, metalness: 0.0, clearcoat: 1.0, clearcoatRoughness: 0.05, envMapIntensity: 1.1 });  // bandes racing
    const light  = new THREE.MeshStandardMaterial({ color: 0xfff4cc, emissive: 0xffe79a, emissiveIntensity: 0.9, roughness: 0.2 });
    const tail   = new THREE.MeshStandardMaterial({ color: 0xff3030, emissive: 0x7a0d0d, emissiveIntensity: 0.8, roughness: 0.25 });
    // couleur d'accent = complémentaire vive de la peinture (rondeau numéro course "super cool")
    const _hsl = {}; new THREE.Color(g.color).getHSL(_hsl);
    const accent = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL((_hsl.h + 0.5) % 1, 0.9, 0.56), roughness: 0.32, metalness: 0.1, envMapIntensity: 1.1 });

    // ── 💥 Pièces déformables (caisse ~incassable · panneaux plient puis se détachent · vitres éclatent) ──
    const deform = [];
    const tag = (mesh, o) => {   // stampe le comportement de déformation + mémorise la pose d'origine
      const flexJit = 0.75 + Math.random() * 0.6;   // 🔧 SOUPLESSE VARIÉE par pièce
      mesh.userData.deform = { kind: o.kind, part: o.part || '', fixation: o.fixation || '',
        hingeAxis: (o.hingeAxis || new THREE.Vector3(1, 0, 0)).clone().normalize(),
        hingePivot: o.hingePivot ? o.hingePivot.clone() : mesh.position.clone(),
        bendGain: (o.bendGain ?? 1.6) * flexJit, maxBend: (o.maxBend ?? 1.1) * (0.85 + Math.random() * 0.3),
        detachAt: (o.detachAt ?? Infinity) * (0.8 + Math.random() * 0.45),   // 🔩 force d'attache VARIÉE par pièce
        shatterAt: o.shatterAt ?? Infinity, squash: (o.squash ?? 0.4) * flexJit, damage: 0,
        baseColor: (mesh.material && mesh.material.color) ? mesh.material.color.clone() : null,
        dents: [], _baseVerts: null, _baseNormals: null, bbox: null,
        home: { pos: mesh.position.clone(), quat: mesh.quaternion.clone(), scale: mesh.scale.clone() } };
      deform.push(mesh); return mesh;
    };
    const mkPanel = (geo, mat, pos, o) => { const m = new THREE.Mesh(geo, mat.clone()); m.position.set(pos[0], pos[1], pos[2]); if (o.cast) m.castShadow = true; grp.add(m); return tag(m, o); };   // mat clonée -> usure par pièce
    const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
    // portes/capot/coffre/bas de caisse/pare-chocs : distincts, plient puis se détachent
    const addPanels = (W, H, L, topY) => {
      mkPanel(rbox(W * 0.80, 0.045, L * 0.34, 0.03), paint, [0, topY + 0.012, L * 0.28],
        { kind: 'panel', part: 'capot', hingeAxis: V3(1, 0, 0), hingePivot: V3(0, topY + 0.012, L * 0.11), maxBend: 1.38, bendGain: 2.21, detachAt: 2.6, cast: 1 });
      mkPanel(rbox(W * 0.80, 0.05, L * 0.24, 0.03), paint, [0, topY + 0.012, -L * 0.30],
        { kind: 'panel', part: 'coffre', hingeAxis: V3(1, 0, 0), hingePivot: V3(0, topY + 0.012, -L * 0.18), maxBend: 1.26, bendGain: 2.08, detachAt: 2.4, cast: 1 });
      const four = L > 3.0;   // longues carrosseries -> 4 portes
      const doorZ = four ? [L * 0.16, -L * 0.16] : [0], dl = four ? L * 0.30 : L * 0.42;
      for (const zc of doorZ) for (const sx of [-1, 1])
        mkPanel(rbox(0.045, H * 0.86, dl, 0.02), paint, [sx * (W / 2 + 0.006), 0.16, zc],
          { kind: 'panel', part: 'porte', hingeAxis: V3(0, sx, 0), hingePivot: V3(sx * (W / 2 + 0.006), 0.16, zc + dl / 2), maxBend: 1.72, bendGain: 2.34, detachAt: 2.9, squash: 0.28 });
      for (const sx of [-1, 1])
        mkPanel(rbox(0.05, 0.11, L * 0.70, 0.02), dark, [sx * (W / 2 + 0.002), -0.03, 0],
          { kind: 'panel', part: 'bas_de_caisse', hingeAxis: V3(0, 0, sx), hingePivot: V3(sx * (W / 2 + 0.002), 0.02, 0), maxBend: 1.03, bendGain: 1.56, detachAt: 3.4 });
      mkPanel(rbox(W * 0.98, 0.16, 0.16, 0.06), chrome, [0, 0.10, L / 2 + 0.02],
        { kind: 'panel', part: 'parechoc_av', hingeAxis: V3(1, 0, 0), hingePivot: V3(0, 0.10, L / 2 - 0.06), maxBend: 1.15, bendGain: 2.60, detachAt: 1.9 });
      mkPanel(rbox(W * 0.98, 0.16, 0.16, 0.06), chrome, [0, 0.10, -L / 2 - 0.02],
        { kind: 'panel', part: 'parechoc_ar', hingeAxis: V3(1, 0, 0), hingePivot: V3(0, 0.10, -L / 2 + 0.06), maxBend: 1.15, bendGain: 2.60, detachAt: 1.9 });
      // 🚗 AILES (fenders) avant/arrière G/D : passages de roue, plient puis se détachent (comme une vraie caisse)
      for (const zc of [L * 0.36, -L * 0.36]) for (const sx of [-1, 1])
        mkPanel(rbox(0.05, H * 0.72, L * 0.22, 0.03), paint, [sx * (W / 2 + 0.004), 0.14, zc],
          { kind: 'panel', part: zc > 0 ? 'aile_av' : 'aile_ar', hingeAxis: V3(0, sx, 0),
            hingePivot: V3(sx * (W / 2 + 0.004), 0.14, zc - Math.sign(zc) * L * 0.11), maxBend: 1.49, bendGain: 2.08, detachAt: 2.7, squash: 0.3 });
    };

    // ── Décos réutilisables (bandes, rondeaux, chrome) ──
    const twinStripe = (cz, len, y, gap = 0.13, wid = 0.16) => {
      for (const sx of [-gap, gap]) { const s = new THREE.Mesh(rbox(wid, 0.03, len, 0.012), stripe); s.position.set(sx, y, cz); grp.add(s); }
    };
    const raceRoundel = (zc, yc = 0.20) => {
      for (const sx of [-1, 1]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.05, 10, 22), chrome); ring.rotation.y = Math.PI / 2; ring.position.set(sx * (W / 2 + 0.012), yc, zc); grp.add(ring);
        const disc = new THREE.Mesh(new THREE.CircleGeometry(0.15, 22), accent); disc.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2; disc.position.set(sx * (W / 2 + 0.014), yc, zc); grp.add(disc);
      }
    };
    const chromeKit = (frontZ, rearZ, bumpY = 0.10) => {   // calandre + pots (les pare-chocs sont des panneaux déformables, cf. addPanels)
      const grille = new THREE.Mesh(rbox(W * 0.46, 0.13, 0.05, 0.03), dark); grille.position.set(0, bumpY + 0.12, frontZ - 0.01); grp.add(grille);
      for (const sx of [-0.22, 0.22]) { const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, 0.18, 12), chrome); ex.rotation.x = Math.PI / 2; ex.position.set(sx, 0.03, rearZ - 0.06); grp.add(ex); }
    };
    const decalMat = (tex) => new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.42, roughness: 0.42, metalness: 0.0, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, envMapIntensity: 0.5 });
    const sideDecal = (tex, zc, w, h, yc) => {   // décalque sur les deux flancs (portières)
      for (const sx of [-1, 1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), decalMat(tex));
        m.position.set(sx * (W / 2 + 0.02), yc, zc); m.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2; if (sx < 0) m.scale.x = -1; grp.add(m); }
    };
    const hoodDecal = (tex, zc, w, l, yc) => {    // décalque à plat sur le capot
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), decalMat(tex)); m.position.set(0, yc, zc); m.rotation.x = -Math.PI / 2; grp.add(m);
    };
    const twoTone = (roofY) => {                  // peinture deux-tons : haut de caisse + toit clairs
      const tt = new THREE.MeshPhysicalMaterial({ color: 0xf4f6fa, roughness: 0.28, metalness: 0.0, clearcoat: 1.0, clearcoatRoughness: 0.05, envMapIntensity: 1.2 });
      const belt = new THREE.Mesh(rbox(W * 1.006, 0.15, L * 0.98, 0.11), tt); belt.position.set(0, 0.16 + H / 2 - 0.03, 0); grp.add(belt);
      const cap = new THREE.Mesh(rbox(W * 0.84, 0.07, L * 0.40, 0.05), tt); cap.position.set(0, roofY + 0.02, 0); grp.add(cap);
    };
    const applyLivery = (o) => {
      chromeKit(o.frontZ, o.rearZ, o.bumpY);
      if (LIVERY === 'stripes') {
        twinStripe(o.hoodZ, o.hoodLen, o.topY); twinStripe(o.trunkZ, o.trunkLen, o.topY); twinStripe(o.roofZ, o.roofLen, o.roofY);
        raceRoundel(o.doorZ, o.doorY);
      } else if (LIVERY === 'twotone') {
        twoTone(o.roofY); raceRoundel(o.doorZ, o.doorY);
      } else {
        const tex = makeLiveryTexture(LIVERY);
        sideDecal(tex, o.doorZ, o.decalW, o.decalH, o.doorY + 0.03);
        if (LIVERY === 'number' || LIVERY === 'flames') hoodDecal(tex, o.hoodZ, o.decalW * 0.7, o.hoodLen + 0.3, o.topY + 0.02);
        twinStripe(o.roofZ, o.roofLen, o.roofY, 0.10, 0.10);   // fine bande toit pour la cohérence
      }
    };

    // ── ⚙️ ACCESSOIRES MÉCANIQUES sous-caisse/sous-capot : plient à peine puis s'ARRACHENT tôt ──
    const cyl = (r1, r2, len, seg = 12) => new THREE.CylinderGeometry(r1, r2, len, seg);
    const addAccessories = (W, H, L) => {
      const low = -0.06;   // niveau sous-caisse
      // 🌡️ RADIATEUR — bloc plat à l'avant, sous la calandre
      mkPanel(rbox(W * 0.52, H * 0.5, 0.06, 0.02), metal, [0, 0.08, L / 2 - 0.09],
        { kind: 'panel', part: 'radiateur', fixation: 'boulon', hingeAxis: V3(1, 0, 0), hingePivot: V3(0, 0.08, L / 2 - 0.14), maxBend: 0.40, bendGain: 2.08, detachAt: 1.4, squash: 0.2, cast: 1 });
      // 🔩 POULIE / COURROIE — devant le moteur (haut-avant)
      { const pul = new THREE.Mesh(cyl(0.09, 0.09, 0.05, 14), metal); pul.rotation.z = Math.PI / 2; pul.position.set(0, 0.14, L / 2 - 0.24); grp.add(pul);
        tag(pul, { kind: 'panel', part: 'poulie', fixation: 'boulon', hingeAxis: V3(0, 1, 0), hingePivot: V3(0.05, 0.14, L / 2 - 0.24), maxBend: 0.46, bendGain: 2.21, detachAt: 1.3, squash: 0.2 }); }
      // 🔌 FAISCEAUX / DURITES — deux tuyaux souples au-dessus du moteur
      for (const sx of [-0.14, 0.16]) { const ho = new THREE.Mesh(cyl(0.022, 0.022, 0.34, 8), rubber); ho.rotation.x = Math.PI / 2 - 0.2; ho.position.set(sx, 0.15, L / 2 - 0.34); grp.add(ho);
        tag(ho, { kind: 'panel', part: 'durite', fixation: 'clip', hingeAxis: V3(1, 0, 0), hingePivot: V3(sx, 0.15, L / 2 - 0.18), maxBend: 0.57, bendGain: 2.34, detachAt: 1.3, squash: 0.15 }); }
      // ⚙️ BOÎTE DE VITESSE — juste derrière le moteur (avant-centre, sous-caisse)
      mkPanel(rbox(0.28, 0.22, 0.4, 0.05), metal, [0, low + 0.02, L * 0.22],
        { kind: 'panel', part: 'boite_vitesse', fixation: 'boulon', hingeAxis: V3(1, 0, 0), hingePivot: V3(0, low + 0.02, L * 0.30), maxBend: 0.40, bendGain: 1.82, detachAt: 1.6, squash: 0.25 });
      // ⛽ RÉSERVOIR CARBURANT — caisson arrière sous-caisse
      mkPanel(rbox(W * 0.5, 0.18, L * 0.22, 0.05), metal, [0, low, -L * 0.30],
        { kind: 'panel', part: 'reservoir', fixation: 'sangle', hingeAxis: V3(1, 0, 0), hingePivot: V3(0, low, -L * 0.22), maxBend: 0.46, bendGain: 1.95, detachAt: 1.5, squash: 0.25 });
      // 🚿 ÉCHAPPEMENT — long tuyau fin sous-caisse (traîne quand détaché)
      { const ex = new THREE.Mesh(cyl(0.035, 0.035, L * 0.64, 10), rust); ex.rotation.x = Math.PI / 2; ex.position.set(W * 0.16, low - 0.02, -L * 0.06); grp.add(ex);
        tag(ex, { kind: 'panel', part: 'echappement', fixation: 'collier', hingeAxis: V3(0, 1, 0), hingePivot: V3(W * 0.16, low - 0.02, L * 0.24), maxBend: 0.52, bendGain: 2.21, detachAt: 1.4, squash: 0.15 }); }
      // 🛑 FREINS — disque + étrier à chaque roue
      const fZ = L * 0.34, rZ = -L * 0.34;
      for (const zc of [fZ, rZ]) for (const sx of [-1, 1]) {
        const disc = new THREE.Mesh(cyl(0.13, 0.13, 0.03, 16), metal); disc.rotation.z = Math.PI / 2; disc.position.set(sx * (W / 2 - 0.04), low + 0.02, zc); grp.add(disc);
        tag(disc, { kind: 'panel', part: 'frein', fixation: 'boulon', hingeAxis: V3(0, 0, 1), hingePivot: V3(sx * (W / 2 - 0.12), low + 0.02, zc), maxBend: 0.40, bendGain: 1.95, detachAt: 1.5, squash: 0.2 });
        const cal = new THREE.Mesh(rbox(0.05, 0.09, 0.07, 0.02), rust); cal.position.set(sx * (W / 2 - 0.04), low + 0.12, zc); grp.add(cal);
        tag(cal, { kind: 'panel', part: 'etrier', fixation: 'boulon', hingeAxis: V3(0, 0, 1), hingePivot: V3(sx * (W / 2 - 0.10), low + 0.12, zc), maxBend: 0.46, bendGain: 2.08, detachAt: 1.4, squash: 0.2 });
      }
    };

    if (g.style === 'hummer') {
      const body = new THREE.Mesh(rbox(2.02, 0.42, 2.95, 0.13), paint); body.castShadow = true; body.position.y = 0.16; grp.add(body);
      tag(body, { kind: 'shell', part: 'caisse', maxBend: 0.25, bendGain: 0.65, squash: 0.5 });
      const skirt = new THREE.Mesh(rbox(2.06, 0.20, 2.75, 0.07), dark); skirt.position.y = -0.02; grp.add(skirt);
      const hood = new THREE.Mesh(rbox(1.9, 0.16, 0.8, 0.06), paint); hood.position.set(0, 0.30, 1.15); grp.add(hood);
      tag(hood, { kind: 'panel', part: 'capot', hingeAxis: V3(1, 0, 0), hingePivot: V3(0, 0.30, 0.75), maxBend: 1.38, bendGain: 2.21, detachAt: 2.6 });
      const trunk = new THREE.Mesh(rbox(1.9, 0.20, 0.7, 0.07), paint); trunk.position.set(0, 0.30, -1.25); grp.add(trunk);
      tag(trunk, { kind: 'panel', part: 'coffre', hingeAxis: V3(1, 0, 0), hingePivot: V3(0, 0.30, -0.90), maxBend: 1.26, bendGain: 2.08, detachAt: 2.4 });
      const green = new THREE.Mesh(rbox(1.8, 0.34, 1.35, 0.12), glass); green.position.set(0, 0.50, 0.02); grp.add(green);
      tag(green, { kind: 'glass', part: 'vitres', shatterAt: 0.9 });
      const roof = new THREE.Mesh(rbox(1.7, 0.10, 1.25, 0.05), paint); roof.position.set(0, 0.70, 0.02); roof.castShadow = true; grp.add(roof);
      tag(roof, { kind: 'shell', part: 'toit', maxBend: 0.23, bendGain: 0.52, squash: 0.4 });
      for (const sx of [-1, 1]) mkPanel(rbox(0.05, 0.34, 1.4, 0.02), paint, [sx * 1.02, 0.16, 0.1],
        { kind: 'panel', part: 'porte', hingeAxis: V3(0, sx, 0), hingePivot: V3(sx * 1.02, 0.16, 0.8), maxBend: 1.61, bendGain: 2.21, detachAt: 2.9, squash: 0.28 });
      for (const sx of [-1, 1]) mkPanel(rbox(0.05, 0.12, 2.4, 0.02), dark, [sx * 1.02, -0.04, 0],
        { kind: 'panel', part: 'bas_de_caisse', hingeAxis: V3(0, 0, sx), hingePivot: V3(sx * 1.02, 0.02, 0), maxBend: 1.03, bendGain: 1.56, detachAt: 3.4 });
      mkPanel(rbox(1.98, 0.18, 0.16, 0.06), chrome, [0, 0.12, 1.50], { kind: 'panel', part: 'parechoc_av', hingeAxis: V3(1, 0, 0), hingePivot: V3(0, 0.12, 1.42), maxBend: 1.15, bendGain: 2.60, detachAt: 1.9 });
      mkPanel(rbox(1.98, 0.18, 0.16, 0.06), chrome, [0, 0.12, -1.55], { kind: 'panel', part: 'parechoc_ar', hingeAxis: V3(1, 0, 0), hingePivot: V3(0, 0.12, -1.47), maxBend: 1.15, bendGain: 2.60, detachAt: 1.9 });
      for (const zc of [1.05, -1.05]) for (const sx of [-1, 1]) mkPanel(rbox(0.05, 0.34, 0.7, 0.03), paint, [sx * 1.02, 0.14, zc],
        { kind: 'panel', part: zc > 0 ? 'aile_av' : 'aile_ar', hingeAxis: V3(0, sx, 0), hingePivot: V3(sx * 1.02, 0.14, zc - Math.sign(zc) * 0.35), maxBend: 1.49, bendGain: 2.08, detachAt: 2.7, squash: 0.3 });
      for (const sz of [1.0, -1.0]) for (const sx of [-0.98, 0.98]) { const arch = new THREE.Mesh(rbox(0.28, 0.22, 0.62, 0.08), dark); arch.position.set(sx, 0.02, sz); grp.add(arch); }
      for (const sx of [-0.78, 0.78]) { const hl = new THREE.Mesh(rbox(0.26, 0.16, 0.06, 0.03), light); hl.position.set(sx, 0.26, 1.55); grp.add(hl);
        const tl = new THREE.Mesh(rbox(0.24, 0.16, 0.06, 0.03), tail); tl.position.set(sx, 0.30, -1.60); grp.add(tl); }
      // ✨ toit lumière rallye
      const bar = new THREE.Mesh(rbox(1.2, 0.10, 0.22, 0.05), dark); bar.position.set(0, 0.80, 0.5); grp.add(bar);
      for (const sx of [-0.4, 0, 0.4]) { const lp = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.12, 12), light); lp.rotation.x = Math.PI / 2; lp.position.set(sx, 0.86, 0.62); grp.add(lp); }
      addAccessories(2.02, 0.42, 2.95);
      applyLivery({ frontZ: 1.48, rearZ: -1.48, bumpY: 0.14, hoodZ: 1.15, hoodLen: 0.7, trunkZ: -1.25, trunkLen: 0.6, roofZ: 0.02, roofLen: 1.15, topY: 0.40, roofY: 0.77, doorZ: 0.2, doorY: 0.30, decalW: 1.5, decalH: 0.62 });
    } else {
      const body = new THREE.Mesh(rbox(W, H, L, 0.14), paint); body.position.y = 0.16; body.castShadow = true; grp.add(body);
      tag(body, { kind: 'shell', part: 'caisse', maxBend: 0.25, bendGain: 0.65, squash: 0.5 });   // la caisse se déforme, casse presque pas
      const skirt = new THREE.Mesh(rbox(W * 1.02, 0.18, L * 0.9, 0.07), dark); skirt.position.y = -0.02; grp.add(skirt);
      addPanels(W, H, L, 0.16 + H / 2);
      { const green = new THREE.Mesh(rbox(W * 0.9, 0.32, L * 0.42, 0.12), glass); green.position.set(0, 0.46, 0.0); grp.add(green);
        tag(green, { kind: 'glass', part: 'vitres', shatterAt: 0.9 });
        const roof = new THREE.Mesh(rbox(W * 0.82, 0.09, L * 0.38, 0.05), paint); roof.position.set(0, 0.63, 0.0); roof.castShadow = true; grp.add(roof);
        tag(roof, { kind: 'shell', part: 'toit', maxBend: 0.23, bendGain: 0.52, squash: 0.4 });
        if (g.style === 'buggy') for (const zz of [0.28, -0.28]) { const bar = new THREE.Mesh(new THREE.BoxGeometry(W * 0.8, 0.05, 0.05), dark); bar.position.set(0, 0.66, zz * L); grp.add(bar); }
        if (g.style === 'sport') { for (const sx of [-W * 0.4, W * 0.4]) { const py = new THREE.Mesh(rbox(0.06, 0.16, 0.06, 0.02), chrome); py.position.set(sx, 0.44, -L / 2 + 0.18); grp.add(py); }
          const wing = new THREE.Mesh(rbox(W * 0.94, 0.05, 0.28, 0.02), paint); wing.position.set(0, 0.54, -L / 2 + 0.18); grp.add(wing); } }
      for (const sx of [-W * 0.36, W * 0.36]) { const hl = new THREE.Mesh(rbox(0.22, 0.14, 0.06, 0.03), light); hl.position.set(sx, 0.24, L / 2 - 0.05); grp.add(hl);
        const tl = new THREE.Mesh(rbox(0.20, 0.14, 0.06, 0.03), tail); tl.position.set(sx, 0.28, -L / 2 + 0.05); grp.add(tl); }
      const topY = 0.16 + H / 2 + 0.015;
      addAccessories(W, H, L);
      applyLivery({ frontZ: L / 2, rearZ: -L / 2, bumpY: 0.10, hoodZ: L * 0.31, hoodLen: L * 0.26, trunkZ: -L * 0.31, trunkLen: L * 0.26, roofZ: 0, roofLen: L * 0.34, topY, roofY: 0.69, doorZ: 0, doorY: 0.20, decalW: L * 0.5, decalH: Math.max(0.42, H * 1.25) });
    }
    // ── MODULES visibles ──
    if (MODULES.boost) { const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.20, 0.5, 12), dark); noz.rotation.x = Math.PI / 2; noz.position.set(0, 0.26, -L / 2 - 0.12); grp.add(noz);
      const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 12), new THREE.MeshBasicMaterial({ color: 0x66ccff })); glow.rotation.x = Math.PI / 2; glow.position.set(0, 0.26, -L / 2 - 0.40); grp.add(glow); }
    if (MODULES.wing) { for (const sx of [-W * 0.35, W * 0.35]) { const py = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.05), dark); py.position.set(sx, 0.5, -L / 2 + 0.15); grp.add(py); }
      const blade = new THREE.Mesh(new THREE.BoxGeometry(W * 0.9, 0.05, 0.30), new THREE.MeshLambertMaterial({ color: 0x101418 })); blade.position.set(0, 0.62, -L / 2 + 0.15); grp.add(blade); }
    if (MODULES.ballast) { const wt = new THREE.Mesh(new THREE.BoxGeometry(W * 0.6, 0.14, L * 0.4), new THREE.MeshLambertMaterial({ color: 0x333940 })); wt.position.set(0, -0.06, 0); grp.add(wt); }
    grp.userData.deformParts = deform;                                          // 💥 caisse/toit/vitres/panneaux déformables
    grp.userData.panels = deform.filter(m => m.userData.deform.kind === 'panel');   // (compat) panneaux détachables
    return grp;
  }

  // ── ⚙️ RÉGLAGES PHYSIQUES par châssis — les tunings VALIDÉS du labo (P de base 4×4 + overrides
  //    de la table VEHICLES d'arena_suspension.html, copiés le 06/07). Unités Bullet du labo :
  //    springK/damping en N/m et N·s/m ABSOLUS (à normaliser par la masse pour le RaycastVehicle),
  //    engineForce/brake pour la masse indiquée. Source unique des véhicules Nano Worlds 3.
  const PHYS = {
    '4x4':    { mass: 2800, springK: 31000, damping: 3000, restLength: 0.60, maxSuspTravel: 0.90, engineForce: 8500,  brakeF: 170, brakeR: 170, tireCompliance: 0.0001,  diff: 'open' },
    sport:    { mass: 1200, springK: 26000, damping: 3400, restLength: 0.30, maxSuspTravel: 0.35, engineForce: 6500,  brakeF: 170, brakeR: 170, tireCompliance: 0.0001,  diff: 'lsd' },
    trophy:   { mass: 1050, springK: 8500,  damping: 900,  restLength: 0.55, maxSuspTravel: 1.05, engineForce: 10800, brakeF: 100, brakeR: 100, tireCompliance: 0.0001,  diff: 'lsd' },
    monster:  { mass: 3900, springK: 35600, damping: 4750, restLength: 0.85, maxSuspTravel: 1.30, engineForce: 14000, brakeF: 60,  brakeR: 270, tireCompliance: 0.00013, diff: 'open' },
    crawler:  { mass: 2400, springK: 26000, damping: 3600, restLength: 0.72, maxSuspTravel: 1.30, engineForce: 12000, brakeF: 220, brakeR: 220, tireCompliance: 0.0001,  diff: 'welded' },
    buggy:    { mass: 1000, springK: 24000, damping: 3000, restLength: 0.50, maxSuspTravel: 0.80, engineForce: 6000,  brakeF: 170, brakeR: 170, tireCompliance: 0.0001,  diff: 'open' },
    drift:    { mass: 1300, springK: 34800, damping: 3400, restLength: 0.35, maxSuspTravel: 0.93, engineForce: 5600,  brakeF: 170, brakeR: 170, tireCompliance: 0.00003, diff: 'welded', frictionOverride: 8 },   // pont AR soudé au labo ; grip abaissé (le jeu n'a pas la machinerie de glisse dynamique du labo)
  };

  return { GEO, PHYS, makeWheel, buildBodyMesh, makeLiveryTexture, rbox, materials: { matRubber, matLug, matRim } };
}

export default makeVehicleFactory;
