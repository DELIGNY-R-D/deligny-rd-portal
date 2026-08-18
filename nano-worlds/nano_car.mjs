// ─────────────────────────────────────────────────────────────────────────────
// 🚙 nano_car.mjs — TEMPLATE de voiture Nano Worlds, PROPRE et CONFIGURABLE (repart de zéro).
//   Remplace le duo enchevêtré makeCarMesh (trafic) + buildLabVehicle (atelier) par UNE base claire.
//   Garanties par construction :
//     • pivots de roue CORRECTS : rotation.y = braquage (avant), rotation.x = roulement (axe essieu = X local)
//     • assiette au sol EXACTE : l'origine du groupe (y=0) est au CONTACT PNEU → aucune lévitation (yOffset = wheelR)
//     • aucun conducteur fantôme (option `driver:false` par défaut)
//     • style low-poly diorama cohérent
//   API :
//     const car = buildNanoCar(THREE, cfg);   // { group, wheels:[fl,fr,rl,rr], spec }
//     — group : à ajouter à la scène / positionner à (x, groundY, z)
//     — wheels : [avant-gauche, avant-droite, arrière-gauche, arrière-droite] ; les 2 premières braquent
//     — spec : { wheelR, yOffset, track, base, steerIndices:[0,1], driveIndices, wheelAnchors, config }
//   Le jeu pilote : wheels[i].rotation.y = braquage (i<2) ; wheels[i].rotation.x = roulement (tous).
// ─────────────────────────────────────────────────────────────────────────────

// Presets = juste de la CONFIG (aucune géométrie en dur par type). Ajouter un véhicule = ajouter une entrée.
export const NANO_CAR_PRESETS = {
  base:    { bodyL: 3.1, bodyW: 1.5, bodyH: 0.62, wheelR: 0.40, track: 0.86, base: 1.05, color: 0x2d6cdf, roof: true,  cabin: 0.80, ride: 0.10 },
  compact: { bodyL: 2.6, bodyW: 1.4, bodyH: 0.58, wheelR: 0.34, track: 0.80, base: 0.92, color: 0x30c060, roof: false, cabin: 0.86, ride: 0.06 },
  pickup:  { bodyL: 3.4, bodyW: 1.55,bodyH: 0.60, wheelR: 0.42, track: 0.90, base: 1.15, color: 0xc0562a, roof: true,  cabin: 0.55, ride: 0.12, fenderStyle: 'arch' },
  offroad: { bodyL: 3.0, bodyW: 1.6, bodyH: 0.70, wheelR: 0.50, track: 0.94, base: 1.05, color: 0xf2c014, roof: true,  cabin: 0.78, ride: 0.20, fenderStyle: 'arch' },
};

// petite palette pneus/vitres/chrome cohérente diorama
const COL = { tire: 0x15181d, rim: 0x8a9099, glass: 0x1a2430, dark: 0x22262c, light: 0xffe9a8, chrome: 0xb8c0c8, brake: 0xd83a2a };

function mat(THREE, color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: opts.rough ?? 0.6, metalness: opts.metal ?? 0.05, ...opts.extra });
}
let _RBG = null;   // RoundedBoxGeometry injecté (optionnel) — le template n'en DÉPEND pas
function rbox(THREE, w, h, l, r = 0.08) {
  if (_RBG) { try { return new _RBG(w, h, l, 3, Math.min(r, Math.min(w, h, l) * 0.48)); } catch (e) {} }
  return new THREE.BoxGeometry(w, h, l);
}

// ── UNE roue : groupe dont l'origine = centre roue ; axe essieu = X local (⇒ rotation.x = roulement) ──
//   `side` = signe X de l'ancre (±1) : la jante est creusée sur la face EXTÉRIEURE seulement (pas traversante).
function buildWheel(THREE, wheelR, side = 1) {
  const g = new THREE.Group();
  const wide = wheelR * 0.82;                          // pneu volontairement plus étroit → flanc/joue visible
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(wheelR, wheelR, wide, 20), mat(THREE, COL.tire, { rough: 0.9 }));
  tire.rotation.z = Math.PI / 2;                      // axe Y→X : la roue « regarde » sur le côté, l'essieu est en X
  tire.castShadow = true; g.add(tire);
  // toutes les pièces de jante vivent sur la face extérieure (X = side * wide/2) → profondeur réelle, non traversante
  const outX = side * wide * 0.5;
  const disc = (r, thick, m, x) => {                   // petit disque à axe X (comme le pneu), cosmétique
    const d = new THREE.Mesh(new THREE.CylinderGeometry(r, r, thick, 16), m);
    d.rotation.z = Math.PI / 2; d.position.x = x; d.userData._cosmetic = true; return d;
  };
  // voile sombre EN RETRAIT vers l'intérieur → creux de jante côté extérieur
  g.add(disc(wheelR * 0.66, 0.03, mat(THREE, COL.dark, { rough: 0.7 }), outX - side * 0.06));
  // couronne de jante brillante (lèvre extérieure)
  g.add(disc(wheelR * 0.74, 0.05, mat(THREE, COL.rim, { metal: 0.5, rough: 0.35 }), outX - side * 0.01));
  // moyeu central chromé, légèrement saillant (première utilisation de COL.chrome)
  g.add(disc(wheelR * 0.24, 0.06, mat(THREE, COL.chrome, { metal: 0.7, rough: 0.25 }), outX + side * 0.02));
  // rayons COURTS non-traversants : posés sur le voile, entre moyeu et couronne (pas de barre diamétrale)
  const midR = wheelR * 0.49;
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.04, wheelR * 0.46, wheelR * 0.12), mat(THREE, COL.chrome, { metal: 0.5, rough: 0.35 }));
    spoke.position.set(outX - side * 0.04, midR * Math.cos(a), midR * Math.sin(a));
    spoke.rotation.x = a; spoke.userData._cosmetic = true; g.add(spoke);
  }
  g.userData.isWheel = true;
  return g;
}

export function buildNanoCar(THREE, cfg = {}, RoundedBoxGeometry = null) {
  _RBG = RoundedBoxGeometry;
  const c = { ...NANO_CAR_PRESETS.base, ...cfg };
  const { bodyL, bodyW, bodyH, wheelR, track, base, color } = c;
  const group = new THREE.Group();
  const paint = mat(THREE, color, { rough: 0.45, metal: 0.1 });
  const bodyY = wheelR + c.ride + bodyH * 0.5;         // caisse posée au-dessus des roues, assise selon `ride`

  // ── caisse (châssis) ──
  const chassis = new THREE.Mesh(rbox(THREE, bodyW, bodyH, bodyL, 0.10), paint);
  chassis.position.y = bodyY; chassis.castShadow = chassis.receiveShadow = true; group.add(chassis);
  // ceinture de caisse (bandeau sombre = casse la boîte, ADN diorama)
  const belt = new THREE.Mesh(rbox(THREE, bodyW * 1.005, bodyH * 0.16, bodyL * 0.98, 0.05), mat(THREE, COL.dark, { rough: 0.7 }));
  belt.position.set(0, wheelR + c.ride + bodyH * 0.22, 0); group.add(belt);

  // ── cabine (fraction avant `cabin`) + vitres — assise AU RAS du toit du châssis (plus de flottement) ──
  const cabL = bodyL * 0.46, cabH = bodyH * 0.78;
  const cabZ = bodyL * (0.5 - c.cabin * 0.5) * 0.45;   // décalage vers l'avant selon `cabin`
  const chassisTop = bodyY + bodyH * 0.5;
  const cabin = new THREE.Mesh(rbox(THREE, bodyW * 0.88, cabH, cabL, 0.09), paint);
  cabin.position.set(0, chassisTop + cabH * 0.5 - 0.03, cabZ); cabin.castShadow = true; group.add(cabin);
  const glass = new THREE.Mesh(rbox(THREE, bodyW * 0.86, cabH * 0.62, cabL * 0.92, 0.04), mat(THREE, COL.glass, { metal: 0.2, rough: 0.15, extra: { transparent: true, opacity: 0.85 } }));
  glass.position.copy(cabin.position); glass.position.y += 0.01; group.add(glass);

  // ── détails diorama : pare-chocs, phares, galerie ──
  for (const zz of [bodyL * 0.5, -bodyL * 0.5]) {      // pare-chocs av/ar (débordent → cosmétiques)
    const b = new THREE.Mesh(rbox(THREE, bodyW * 1.02, bodyH * 0.28, 0.14, 0.05), mat(THREE, COL.dark));
    b.position.set(0, wheelR + c.ride + bodyH * 0.18, zz); b.userData._cosmetic = true; group.add(b);
  }
  for (const sx of [-1, 1]) {                          // phares avant
    const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 12), mat(THREE, COL.light, { extra: { emissive: 0x554400, emissiveIntensity: 0.4 } }));
    hl.rotation.x = Math.PI / 2; hl.position.set(sx * bodyW * 0.32, bodyY, bodyL * 0.5 + 0.02); hl.userData._cosmetic = true; group.add(hl);
  }
  for (const sx of [-1, 1]) {                          // feux arrière rouges émissifs (symétriques aux phares)
    const tl = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.14, bodyH * 0.18, 0.05), mat(THREE, COL.brake, { extra: { emissive: COL.brake, emissiveIntensity: 0.6 } }));
    tl.position.set(sx * bodyW * 0.30, bodyY, -bodyL * 0.5 - 0.01); tl.userData._cosmetic = true; group.add(tl);
  }
  if (c.roof) {                                        // galerie de toit (ADN off-road diorama)
    const rackY = cabin.position.y + cabH * 0.5 + 0.04;
    const rack = new THREE.Mesh(rbox(THREE, bodyW * 0.8, 0.05, cabL * 0.9, 0.02), mat(THREE, COL.dark));
    rack.position.set(0, rackY, cabZ); group.add(rack);
    for (const sx of [-0.3, 0, 0.3]) {                 // 3 feux de toit
      const lp = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.09, 10), mat(THREE, COL.light, { extra: { emissive: 0x443300, emissiveIntensity: 0.5 } }));
      lp.rotation.x = Math.PI / 2; lp.position.set(sx * bodyW * 0.5, rackY + 0.06, cabZ + cabL * 0.4); lp.userData._cosmetic = true; group.add(lp);
    }
  }

  // ── 4 roues : coins (track × base), origine au centre, contact pneu à y=0 du groupe ──
  const anchors = [
    [ track, base], [-track, base],                    // 0 avant-gauche, 1 avant-droite (BRAQUENT)
    [ track, -base], [-track, -base],                  // 2 arrière-gauche, 3 arrière-droite
  ];
  const wheels = anchors.map(([x, z]) => {
    const w = buildWheel(THREE, wheelR, Math.sign(x));  // side → creux de jante sur la bonne face
    w.position.set(x, wheelR, z);                      // centre roue à hauteur wheelR → bas du pneu à y=0 (sol)
    w.rotation.order = 'YXZ';                          // Y (braquage) externe, X (roulement) interne
    group.add(w);
    return w;
  });

  // ── passages de roue : arches bombées (demi-cylindre low-poly) qui coiffent la roue, ou plaques plates (legacy) ──
  //   COSMÉTIQUES : elles débordent au-delà de bodyW/2 → _cosmetic=true (exclues de l'AABB anti-enfoncement).
  const fenderStyle = c.fenderStyle ?? 'arch';
  const archTint = new THREE.Color(color).multiplyScalar(0.5).getHex();  // teinte carrosserie assombrie
  for (const [x, z] of anchors) {
    let f;
    if (fenderStyle === 'flat') {                      // ancien style : plaque verticale plate (rétro-compat)
      f = new THREE.Mesh(rbox(THREE, 0.16, wheelR * 0.55, wheelR * 2.4, 0.07), mat(THREE, COL.dark, { rough: 0.8 }));
      f.position.set(Math.sign(x) * (bodyW * 0.5 + 0.02), wheelR + wheelR * 0.4, z);
    } else {                                            // arche bombée demi-ouverte coiffant la roue
      f = new THREE.Mesh(new THREE.CylinderGeometry(wheelR * 1.25, wheelR * 1.25, 0.16, 12, 1, true, -Math.PI / 2, Math.PI), mat(THREE, archTint, { rough: 0.7 }));
      f.rotation.z = Math.PI / 2;                       // axe du demi-cylindre → X (l'arche s'ouvre vers le bas, coiffe l'avant-arrière)
      f.position.set(Math.sign(x) * (bodyW * 0.5 + 0.05), wheelR, z);
    }
    f.castShadow = true; f.userData._cosmetic = true; group.add(f);
  }

  return {
    group, wheels,
    spec: {
      wheelR, yOffset: 0,                              // origine groupe = sol → le jeu place group.y = groundY, pas d'offset
      track, base, wheelAnchors: anchors.map(([x, z]) => ({ x, y: 0, z })),
      steerIndices: [0, 1], driveIndices: [0, 1, 2, 3],
      config: c,
    },
  };
}

// ── SPEC PHYSIQUE dérivé de la MÊME config → mesh et cannon cohérents (mêmes voie/empattement/rayon) ──
//   Retourne { adapterSpec, yOffset }. yOffset = hauteur du centre du corps cannon au repos (sag inclus) →
//   la synchro place mesh.y = bodyCenter.y − yOffset ⇒ roues au sol, AUCUNE lévitation (dérivée, pas devinée).
// COMPORTEMENT réglable (le labo terrain passe `tune` ; le jeu utilise les défauts). Tout ce qui compte sur
// terrain difficile : raideur suspension, amorto, débattement, couple, grip, braquage, masse.
export const NANO_TUNE_DEFAULTS = { springK: 8000, damping: 6000, suspRestMul: 1.10, suspTravel: 0.28, engineForce: 2800, brakeForce: 220, friction: 6, maxSteer: 0.52 };   // ⚙️ réglages validés Baptiste (labo terrain)
export function nanoCarPhysicsSpec(cfg = {}, mass = 900, tune = {}) {
  const c = { ...NANO_CAR_PRESETS.base, ...cfg };
  const t = { ...NANO_TUNE_DEFAULTS, ...tune };
  const { bodyL, bodyW, bodyH, wheelR, track, base } = c;
  const springK = t.springK, damping = t.damping;
  const suspRest = Math.max(0.18, wheelR * t.suspRestMul);
  const sag = (mass * 9.81 / 4) / springK;             // affaissement au repos (spring vs gravité)
  const anchorY = -(bodyH * 0.45);                      // attache suspension ≈ bas de caisse (relatif au centre du corps)
  const chassisHalf = { x: bodyW * 0.46, y: bodyH * 0.5, z: bodyL * 0.47 };
  const yOffset = wheelR + suspRest - sag - anchorY;    // = R + (suspRest−sag) − anchorY → bas de roue au sol
  return {
    yOffset,
    adapterSpec: {
      chassisHalf, mass, wheelRadius: wheelR,
      suspRest, suspTravel: suspRest + t.suspTravel,
      suspStiff: springK / mass, suspMaxForce: springK * 6,
      suspDampC: (damping / mass) * 0.8, suspDampR: (damping / mass) * 1.2,
      engineForce: t.engineForce, brakeForce: t.brakeForce, friction: t.friction, maxSteer: t.maxSteer, diffMode: 'open',
      chassisMass: mass, tireCompliance: 0.0001,
      wheelAnchors: [
        { x: track, y: anchorY, z: base }, { x: -track, y: anchorY, z: base },
        { x: track, y: anchorY, z: -base }, { x: -track, y: anchorY, z: -base },
      ],
      steerWheelIndices: [0, 1], driveWheelIndices: [0, 1, 2, 3],
    },
  };
}

export default buildNanoCar;
