// Source de verite physique des vehicules Nano Worlds.
// Le jeu et les laboratoires doivent appeler buildVehiclePhysicsSpec()
// puis passer directement adapterSpec a PhysicsAdapter.spawnVehicle().

export const GAME_CAR_MASS = 900;

export const VEHICLE_GEO = {
  '4x4':    { radius: 0.38, track: 0.98, base: 1.00, ride: 0,     bw: 2.02, bh: 0.42, bl: 2.95, color: 0x2255aa, style: 'hummer',  label: '4x4' },
  sport:    { radius: 0.32, track: 0.86, base: 1.02, ride: -0.04, bw: 1.80, bh: 0.40, bl: 3.40, color: 0xd23b3b, style: 'sport',   label: 'Sport' },
  trophy:   { radius: 0.42, track: 1.02, base: 1.16, ride: 0.02,  bw: 1.90, bh: 0.52, bl: 3.55, color: 0xe0a020, style: 'buggy',   label: 'Trophy' },
  monster:  { radius: 0.64, track: 1.16, base: 1.14, ride: 0.06,  bw: 2.00, bh: 0.70, bl: 3.10, color: 0x8b3bd2, style: 'monster', label: 'Monster' },
  crawler:  { radius: 0.50, track: 1.06, base: 1.00, ride: 0.04,  bw: 1.86, bh: 0.50, bl: 2.90, color: 0x3b7fd2, style: 'buggy',   label: 'Crawler' },
  buggy:    { radius: 0.40, track: 0.96, base: 1.02, ride: 0,     bw: 1.60, bh: 0.42, bl: 2.80, color: 0x30c060, style: 'buggy',   label: 'Buggy' },
  drift:    { radius: 0.34, track: 0.90, base: 1.00, ride: -0.03, bw: 1.78, bh: 0.40, bl: 3.30, color: 0xff5522, style: 'sport',   label: 'Drift' },
};

export const VEHICLE_PHYS = {
  '4x4':    { mass: 2800, springK: 31000, damping: 3000, restLength: 0.60, maxSuspTravel: 0.90, engineForce: 8500,  brakeF: 170, brakeR: 170, tireCompliance: 0.0001,  diff: 'open' },
  sport:    { mass: 1200, springK: 26000, damping: 3400, restLength: 0.30, maxSuspTravel: 0.35, engineForce: 6500,  brakeF: 170, brakeR: 170, tireCompliance: 0.0001,  diff: 'lsd' },
  trophy:   { mass: 1050, springK: 8500,  damping: 900,  restLength: 0.55, maxSuspTravel: 1.05, engineForce: 10800, brakeF: 100, brakeR: 100, tireCompliance: 0.0001,  diff: 'lsd' },
  monster:  { mass: 3900, springK: 35600, damping: 4750, restLength: 0.85, maxSuspTravel: 1.30, engineForce: 14000, brakeF: 60,  brakeR: 270, tireCompliance: 0.00013, diff: 'open' },
  crawler:  { mass: 2400, springK: 26000, damping: 3600, restLength: 0.72, maxSuspTravel: 1.30, engineForce: 12000, brakeF: 220, brakeR: 220, tireCompliance: 0.0001,  diff: 'welded' },
  buggy:    { mass: 1000, springK: 24000, damping: 3000, restLength: 0.50, maxSuspTravel: 0.80, engineForce: 6000,  brakeF: 170, brakeR: 170, tireCompliance: 0.0001,  diff: 'open' },
  drift:    { mass: 1300, springK: 34800, damping: 3400, restLength: 0.35, maxSuspTravel: 0.93, engineForce: 5600,  brakeF: 170, brakeR: 170, tireCompliance: 0.00003, diff: 'welded', frictionOverride: 8 },
};

// ── Réglages DYNAMIQUES par châssis (forces custom arena_suspension : anti-roulis,
//    couple lowSpeedBoost/coupe maxSpeed, poids moteur avant, grip empreinte, glisse) ──
//    Valeurs EXACTES de la table VEHICLES de l'arène (arena_suspension.html:450-528).
//    Chaque entrée hérite de VEHICLE_DYN_BASE (= 4×4/BASE4x4, arena:454-495) via {...base, ...over}.
//    ⚠ ÉCHELLE : ce sont des ratios / vitesses -> NE PAS multiplier par r (voir buildVehiclePhysicsSpec).
export const VEHICLE_DYN_BASE = {
  antiRollFront: 0.005, antiRollRear: 0.012,
  tireType: 'offroad', tirePressure: 1.6,
  lowSpeedBoost: 2.0, maxSpeed: 20,
  driveMode: 'awd', frontEngineMass: 380,
  frontGripLow: 1.0, frontGripHigh: 1.0, rearGripLow: 1.0, rearGripHigh: 1.0,
  patinage: 0.45, drift: 0.20, slideOnset: 0.45, slideHold: 0.45, ralentissement: 0.35,
  diffLockFront: false, diffLockRear: false, lsd: false,
  special: null, rearGrip: null,
};
export const VEHICLE_DYN = {
  '4x4':   { ...VEHICLE_DYN_BASE },   // over:{} -> hérite tout (arena:508)
  sport:   { ...VEHICLE_DYN_BASE, antiRollFront: 0.020, antiRollRear: 0.018, tireType: 'route', lowSpeedBoost: 1.2, maxSpeed: 34, driveMode: 'rwd', frontEngineMass: 250, lsd: true },   // arena:509
  trophy:  { ...VEHICLE_DYN_BASE, antiRollFront: 0.004, antiRollRear: 0.010, tireType: 'sable', tirePressure: 1.6, lowSpeedBoost: 2.2, maxSpeed: 17, driveMode: 'awd', frontEngineMass: 300, lsd: true },   // arena:511-516
  monster: { ...VEHICLE_DYN_BASE, antiRollFront: 0.008, antiRollRear: 0.020, tireType: 'crawler', tirePressure: 1.8, lowSpeedBoost: 2.5, maxSpeed: 24, driveMode: 'awd', frontEngineMass: 500 },   // arena:517
  crawler: { ...VEHICLE_DYN_BASE, tireType: 'crawler', lowSpeedBoost: 3.5, maxSpeed: 11, driveMode: 'awd', diffLockFront: true, diffLockRear: true },   // arena:519
  buggy:   { ...VEHICLE_DYN_BASE, tireType: 'offroad', maxSpeed: 30, driveMode: 'rwd', frontEngineMass: 200 },   // arena:521
  drift:   { ...VEHICLE_DYN_BASE, antiRollFront: 0.020, antiRollRear: 0.006, tireType: 'route', tirePressure: 1.1, lowSpeedBoost: 1.3, maxSpeed: 30, driveMode: 'rwd', frontEngineMass: 220, diffLockRear: true, lsd: true, patinage: 0.93, drift: 0.96, slideOnset: 0.83, slideHold: 1.00, special: 'drift', rearGrip: 0.45 },   // arena:523-528
};

// ── 🚀 RUNTIME CHAMPION (pont preuve→runtime, CÔTÉ JEU LIVRÉ) ──────────────────────────────────────
//   Applique le champion promu (evolution/champions/runtime/vehicle_physics.champion.json) PAR-DESSUS les
//   tables VEHICLE_PHYS/VEHICLE_DYN, au boot du JEU, si celui-ci le demande (loadRuntimeChampion). FAIL-SAFE
//   absolu : artefact absent/invalide/mauvais moteur/fetch KO ⇒ tables inchangées (le jeu ne casse jamais).
//   N'est JAMAIS appelé par le bench/l'arène (qui utilisent l'objet P) → zéro impact sur le déterminisme.
const RUNTIME_CHAMPION = { applied: 0, version: null, class: null, source: 'defaults', error: null };
export function getRuntimeChampionInfo() { return { ...RUNTIME_CHAMPION }; }

//   mapping clé champion → table cible (fail-safe : seules les clés connues sont appliquées ; chassisMass→mass)
function _applyChampionParams(params, chassis = '4x4') {
  const phys = VEHICLE_PHYS[chassis], dyn = VEHICLE_DYN[chassis];
  if (!phys || !dyn) return 0;
  let n = 0;
  for (const [k, v] of Object.entries(params || {})) {
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    if (k === 'chassisMass') { phys.mass = v; n++; }        // renommage explicite (arène 'chassisMass' → profil 'mass')
    else if (k in phys) { phys[k] = v; n++; }               // springK · damping · restLength · maxSuspTravel · engineForce · tireCompliance
    else if (k in dyn) { dyn[k] = v; n++; }                 // antiRoll* · lowSpeedBoost · maxSpeed · frontEngineMass · grips · tirePressure
    // clés inconnues ignorées (fail-safe)
  }
  return n;
}

export async function loadRuntimeChampion({ basePath = '.', engine = 'cannon', fetchImpl = (typeof fetch !== 'undefined' ? fetch : null) } = {}) {
  RUNTIME_CHAMPION.source = 'defaults'; RUNTIME_CHAMPION.error = null;
  if (!fetchImpl) return getRuntimeChampionInfo();
  try {
    const ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    const to = ctl ? setTimeout(() => ctl.abort(), 2500) : null;
    const r = await fetchImpl(`${basePath}/evolution/champions/runtime/vehicle_physics.champion.json`, { cache: 'no-store', ...(ctl ? { signal: ctl.signal } : {}) });
    if (to) clearTimeout(to);
    if (!r || !r.ok) return getRuntimeChampionInfo();
    const ch = await r.json();
    const engineOk = String(ch && ch.engine || '').toLowerCase().startsWith('cannon') && engine === 'cannon';   // parité : un champion cannon n'entre PAS dans un runtime rapier
    if (ch && ch.schema === 'runtime-champion/v1' && ch.system === 'vehicle_physics' && engineOk && ch.params) {
      const wanted = (!ch.vehicle_class || ch.vehicle_class === 'general') ? '4x4' : ch.vehicle_class;
      const cls = VEHICLE_PHYS[wanted] ? wanted : '4x4';
      RUNTIME_CHAMPION.applied = _applyChampionParams(ch.params, cls);
      RUNTIME_CHAMPION.version = ch.version; RUNTIME_CHAMPION.class = cls; RUNTIME_CHAMPION.source = 'champion';
    } else {
      RUNTIME_CHAMPION.source = (engine !== 'cannon') ? 'engine-mismatch' : 'invalid';
    }
  } catch (e) { RUNTIME_CHAMPION.source = 'error'; RUNTIME_CHAMPION.error = String(e && e.message || e).slice(0, 80); }
  return getRuntimeChampionInfo();
}

export function buildVehiclePhysicsSpec(chassis = '4x4', opts = {}) {
  const geo = VEHICLE_GEO[chassis];
  const phys = VEHICLE_PHYS[chassis];
  if (!geo || !phys) return null;

  const mass = opts.mass ?? GAME_CAR_MASS;
  const r = mass / phys.mass;
  const dampingPerKg = phys.damping / phys.mass;
  const sag = (phys.mass * 9.81 / 4) / phys.springK;

  // Réglages dynamiques (forces custom arena) — hérités de VEHICLE_DYN_BASE via {...base, ...}.
  // ⚠ NE PAS scaler par r : ratios/vitesses/pressions restent bruts ; seul engineForce garde ×r.
  const dyn = { ...VEHICLE_DYN_BASE, ...(VEHICLE_DYN[chassis] || {}) };
  // Essieux motorisés dérivés de driveMode (fwd→avant · rwd→arrière · awd→les deux) ;
  // avec l'ordre wheelAnchors ci-dessous, avant = [0,1] et arrière = [2,3].
  const driveWheelIndices = dyn.driveMode === 'fwd' ? [0, 1]
                          : dyn.driveMode === 'rwd' ? [2, 3]
                          : [0, 1, 2, 3];

  const adapterSpec = {
    x: opts.x ?? 0,
    z: opts.z ?? 0,
    yaw: opts.yaw ?? 0,
    chassisHalf: { x: geo.bw / 2 * 0.98, y: geo.bh / 2 + 0.10, z: geo.bl / 2 * 0.95 },
    mass,
    wheelRadius: geo.radius,
    suspRest: phys.restLength,
    suspTravel: phys.maxSuspTravel,
    suspStiff: phys.springK / phys.mass,
    suspMaxForce: phys.springK * 6 * r,
    suspDampC: dampingPerKg * 0.8,
    suspDampR: dampingPerKg * 1.2,
    engineForce: phys.engineForce * r,
    brakeForce: (phys.brakeF + phys.brakeR) / 2 * r,
    friction: phys.frictionOverride ?? Math.min(20, 0.0055 / phys.tireCompliance),
    maxSteer: opts.maxSteer ?? 0.52,
    diffMode: phys.diff,
    wheelAnchors: [
      { x:  geo.track, y: geo.ride || 0, z:  geo.base },
      { x: -geo.track, y: geo.ride || 0, z:  geo.base },
      { x:  geo.track, y: geo.ride || 0, z: -geo.base },
      { x: -geo.track, y: geo.ride || 0, z: -geo.base },
    ],
    steerWheelIndices: [0, 1],
    driveWheelIndices,

    // ── Forces custom arena (consommées par vehicle_dynamics via physics_adapter cannon) ──
    chassisMass: mass,                    // = adapterSpec.mass ; utilisé par anti-roll & fallback de charge
    tireCompliance: phys.tireCompliance,  // baseSlip = min(20, 0.0055/tireCompliance) (IGNORE frictionOverride)
    tireType: dyn.tireType,
    tirePressure: dyn.tirePressure,
    lowSpeedBoost: dyn.lowSpeedBoost,
    maxSpeed: dyn.maxSpeed,
    driveMode: dyn.driveMode,
    frontEngineMass: dyn.frontEngineMass,   // brut (pas ×r) — voir note applyFrontEngineMass
    antiRollFront: dyn.antiRollFront,
    antiRollRear: dyn.antiRollRear,
    frontGripLow: dyn.frontGripLow,
    frontGripHigh: dyn.frontGripHigh,
    rearGripLow: dyn.rearGripLow,
    rearGripHigh: dyn.rearGripHigh,
    patinage: dyn.patinage,
    drift: dyn.drift,
    slideOnset: dyn.slideOnset,
    slideHold: dyn.slideHold,
    ralentissement: dyn.ralentissement,
    diffLockFront: dyn.diffLockFront,
    diffLockRear: dyn.diffLockRear,
    lsd: dyn.lsd,
    special: dyn.special,
    rearGrip: dyn.rearGrip,
  };

  return {
    chassis,
    geo,
    phys,
    adapterSpec,
    yOffset: geo.radius + phys.restLength - sag - (geo.ride || 0),
  };
}

export default buildVehiclePhysicsSpec;
