// arena_mechanics.mjs
// ─────────────────────────────────────────────────────────────────────────────
// SOURCE UNIQUE des mécaniques RÉELLES d'arena_suspension.html (la VÉRITÉ visuelle
// que Baptiste voit : coilovers ressort vert/rouge, doubles triangles, porte-fusées,
// cardans/demi-arbres, barre stabilisatrice, châssis tubulaire, moteur+volant).
//
// Porté VERBATIM depuis arena_suspension.html :
//   • matériaux 836-841
//   • makeSpinShaft 882-892, makeCardan 894-905, makeCoilover 907-920,
//     makeEngine 922-932, makeFrame 935-945, makeRod 2178, _ballGeo 2179
//   • assemblage rig  buildDrivetrain 2180-2207  (+ springMeshes/coilovers 1741-1746)
//   • visibilité      applyDriveVis 2213-2231
//   • sync coilovers  updateSprings 2137-2175
//   • sync driveline  updateDrivetrain 2248-2315, _orient 2236-2241, _placeCardan 2242-2247
//   • spin diff-aware updateDiffSpin 810-828, volant moteur 2700-2703
//
// SEULES adaptations vs arena (l'API doit se brancher tel quel dans voiture_lab) :
//   • makeArenaMechanics({THREE}) -> { createMechanics(profile), syncMechanics(mech,ctx,wheelStates,dt), setDriveVisibility }
//     (même forme que vehicle_mechanics.mjs pour un swap minimal).
//   • le rig vit en repère MONDE (un Group ajouté à la scène par le caller) ;
//     chaque frame on le positionne depuis ctx.bodyPos/ctx.bodyQuat (arena le
//     posait sur chassisMesh). localToWorld == arena _l2w(x,y,z).
//   • arena lit ses propres wheelInfos ; ICI on lit wheelStates[i].worldTransform.pos
//     (== ce que PhysicsAdapter.getWheelState renvoie). hub = cette position monde.
//   • sx/wz dérivés de l'ancrage RÉEL (anchor.x/anchor.z) au lieu de l'index
//     (l'ordre des roues du spec du jeu diffère de celui d'arena).
//   • état driveline PAR INSTANCE (mech.kin : visAngle/vspinPrev/flyAngle/flyRpm).
//   • hub[] : Group VIDE par roue (arena n'a pas de porte-moyeu séparé) — sert
//     UNIQUEMENT de point de reparentage aux disques/étriers de frein de voiture_lab
//     (positionné comme dans vehicle_mechanics pour que le disque retombe pile
//     au centre de roue). Invisible -> ne change rien au rendu arena.
// ─────────────────────────────────────────────────────────────────────────────
export function makeArenaMechanics({ THREE }) {

  // ── matériaux (arena 836-841) ───────────────────────────────────────────────
  const matSteel = new THREE.MeshStandardMaterial({ color: 0x9098a2, metalness: 0.85, roughness: 0.35 });
  const matDark  = new THREE.MeshStandardMaterial({ color: 0x23272e, metalness: 0.6,  roughness: 0.55 });
  const matArm   = new THREE.MeshStandardMaterial({ color: 0x3f4750, metalness: 0.5,  roughness: 0.55 });
  const matJoint = new THREE.MeshStandardMaterial({ color: 0x717985, metalness: 0.9,  roughness: 0.3 });
  const matCoil  = new THREE.MeshStandardMaterial({ color: 0xff5a2a, metalness: 0.4,  roughness: 0.5 });
  const matMarkShaft = new THREE.MeshBasicMaterial({ color: 0xffd21a }); // repère arbre/cardan (jaune vif)
  const matRim   = new THREE.MeshStandardMaterial({ color: 0x6b7078, metalness: 0.9,  roughness: 0.4 }); // arena importe matRim de VFAC ; ici substitut métal (dents de volant)

  // ── axes / temporaires (arena 830-832) ──────────────────────────────────────
  const _DT_up = new THREE.Vector3(0, 1, 0), _DT_v = new THREE.Vector3(), _DT_idQ = new THREE.Quaternion();
  const _AX_X = new THREE.Vector3(1, 0, 0), _AX_Y = new THREE.Vector3(0, 1, 0), _AX_Z = new THREE.Vector3(0, 0, 1);
  const _UP = new THREE.Vector3(0, 1, 0);

  // état de frame courant (assigné en tête de syncMechanics depuis ctx)
  let F = {};
  const _bodyPos = new THREE.Vector3(), _bodyQuat = new THREE.Quaternion();
  const _knuckleRight = new THREE.Vector3();

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  // localToWorld == arena _l2w(x,y,z) (= applyMatrix4(chassisMesh.matrixWorld), échelle 1)
  const _wl = new THREE.Vector3();
  function _l2w(x, y, z) { return _wl.set(x, y, z).applyQuaternion(_bodyQuat).add(_bodyPos).clone(); }

  // ── KIN / driveline par instance ────────────────────────────────────────────
  function freshKIN() {
    return { visAngle: [0, 0, 0, 0], vspinPrev: [0, 0, 0, 0], flyAngle: 0, flyRpm: 6 };
  }

  // ── pièces (arena 882-945, 2178-2179) ───────────────────────────────────────
  // Un "arbre tournant" : groupe orienté entre 2 points ; enfant 'spinner' tourne (repère jaune visible)
  function makeSpinShaft(radius, mat) {
    const group = new THREE.Group();
    const spinner = new THREE.Group();
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, 12), mat);
    spinner.add(cyl);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.7, 0.9, radius * 0.7), matMarkShaft);
    stripe.position.set(radius, 0, 0);            // décalé radialement -> orbite quand ça tourne
    spinner.add(stripe);
    group.add(spinner);
    return { group, spinner, cyl };
  }
  // Cardan + noix : chape (sphère) + croisillon (2 barres) qui tourne
  function makeCardan(radius) {
    const g = new THREE.Group();
    const yoke = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.5, 10, 8), matJoint);
    g.add(yoke);
    const spin = new THREE.Group();
    for (const rot of [0, Math.PI / 2]) {         // croisillon en croix
      const bar = new THREE.Mesh(new THREE.BoxGeometry(radius * 3.0, radius * 0.5, radius * 0.5), matMarkShaft);
      bar.rotation.y = rot; spin.add(bar);
    }
    g.add(spin);
    return { g, spin };
  }
  // Coilover (amortisseur + ressort hélicoïdal) construit à hauteur unité 1, étiré via scale.y
  function makeCoilover() {
    const g = new THREE.Group();
    const bodyTube = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 10), matDark); // corps d'amortisseur (moitié basse)
    bodyTube.position.y = -0.25; g.add(bodyTube);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.55, 8), matSteel);   // tige (moitié haute)
    rod.position.y = 0.22; g.add(rod);
    // ressort hélicoïdal
    const turns = 7, pts = [];
    for (let t = 0; t <= turns * 20; t++) { const a = t / 20 * Math.PI * 2, y = t / (turns * 20) - 0.5; pts.push(new THREE.Vector3(Math.cos(a) * 0.09, y, Math.sin(a) * 0.09)); }
    const coil = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 20, 0.016, 6, false), matCoil.clone());
    g.add(coil);
    g.userData.coil = coil;
    return g;
  }
  // Bloc moteur AVANT + volant moteur (disque qui tourne selon le régime)
  function makeEngine() {
    const g = new THREE.Group();
    const block = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.34, 0.5), matDark); block.position.y = 0.05; g.add(block);
    const spin = new THREE.Group(); spin.position.set(0.30, 0.02, 0);       // le volant à droite du bloc
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 20), matSteel); disc.rotation.z = Math.PI / 2; spin.add(disc);
    for (let s = 0; s < 6; s++) { const a = s * Math.PI / 3;               // dents + repère
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.05), s === 0 ? matMarkShaft : matRim);
      tooth.position.set(0.035, Math.cos(a) * 0.19, Math.sin(a) * 0.19); spin.add(tooth); }
    g.add(spin); g.userData.spin = spin;
    return g;
  }
  // Châssis TUBULAIRE (ladder frame) — 2 longerons + traverses + 4 montants (tours de suspension)
  function makeFrame() {
    const g = new THREE.Group();
    const tubeZ = (x, z1, z2, y, r) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r || 0.05, r || 0.05, Math.abs(z2 - z1), 8), matSteel); m.rotation.x = Math.PI / 2; m.position.set(x, y, (z1 + z2) / 2); m.castShadow = true; g.add(m); };
    const tubeX = (z, x1, x2, y, r) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r || 0.045, r || 0.045, Math.abs(x2 - x1), 8), matSteel); m.rotation.z = Math.PI / 2; m.position.set((x1 + x2) / 2, y, z); m.castShadow = true; g.add(m); };
    const tubeY = (x, z, y1, y2, r) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r || 0.04, r || 0.04, Math.abs(y2 - y1), 8), matSteel); m.position.set(x, (y1 + y2) / 2, z); m.castShadow = true; g.add(m); };
    tubeZ(-0.58, -1.25, 1.25, -0.05); tubeZ(0.58, -1.25, 1.25, -0.05);       // 2 longerons bas
    for (const z of [1.15, 0.4, -0.4, -1.15]) tubeX(z, -0.58, 0.58, -0.05);   // traverses basses
    for (const z of [1.0, -1.0]) for (const x of [-0.58, 0.58]) tubeY(x, z, -0.05, 0.28);   // 4 montants (tours de suspension)
    tubeX(1.0, -0.58, 0.58, 0.28); tubeX(-1.0, -0.58, 0.58, 0.28);            // traverses hautes
    return g;
  }
  function makeRod(radius, mat) { return new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, 8), mat); }
  const _ballGeo = new THREE.SphereGeometry(0.052, 10, 8);   // rotule

  // ── construction du rig (arena buildDrivetrain 2180-2207 + coilovers 1741-1746) ──
  function createMechanics(profile) {
    const spec = (profile && (profile.adapterSpec || profile.spec)) || null;
    const g = new THREE.Group();
    g.name = 'arena-mechanics';
    const mech = {
      group: g,
      frame: null, fly: null, prop: null,
      half: [], jin: [], jout: [], wb: [], knuckle: [], ball: [], sway: [], diffs: [],
      coilover: [],   // == springMeshes d'arena
      hub: [],        // Group vide par roue (reparentage frein voiture_lab)
      kin: freshKIN(),
      _spec: spec,
    };
    const add = (o) => { g.add(o); };
    mech.frame = makeFrame(); add(mech.frame);                 // 🔩 châssis tubulaire (soutient tout)
    for (let i = 0; i < 4; i++) {
      const h = makeSpinShaft(0.035, matSteel); add(h.group); mech.half.push(h);           // demi-arbre de roue
      const ji = makeCardan(0.05); add(ji.g); mech.jin.push(ji);                            // noix de cardan (côté diff)
      const jo = makeCardan(0.05); add(jo.g); mech.jout.push(jo);                           // noix de cardan (côté roue)
      // DOUBLE TRIANGLE : bras inférieur + supérieur ; le cardan passe entre les deux
      const lower = [makeRod(0.028, matArm), makeRod(0.028, matArm), makeRod(0.024, matArm)];
      const upper = [makeRod(0.024, matArm), makeRod(0.024, matArm), makeRod(0.020, matArm)];
      [...lower, ...upper].forEach(add); mech.wb.push({ lower, upper });
      // 🔩 PORTE-FUSÉE (knuckle) vertical + 2 ROTULES (ball joints)
      const knuck = makeRod(0.032, matJoint); add(knuck); mech.knuckle.push(knuck);
      const bLo = new THREE.Mesh(_ballGeo, matJoint), bHi = new THREE.Mesh(_ballGeo, matJoint); add(bLo); add(bHi); mech.ball.push([bLo, bHi]);
      // coilover (== springMeshes[i])
      const co = makeCoilover(); add(co); mech.coilover.push(co);
      // porte-moyeu de frein (adaptation : invisible, reparentage voiture_lab)
      const hub = new THREE.Group(); add(hub); mech.hub.push({ g: hub });
    }
    // 🔩 BARRE STABILISATRICE par essieu : barre transversale + 2 biellettes (drop links)
    for (let k = 0; k < 2; k++) {
      const bar = makeRod(0.030, matArm), dl0 = makeRod(0.016, matDark), dl1 = makeRod(0.016, matDark);
      add(bar); add(dl0); add(dl1); mech.sway.push({ bar, dl: [dl0, dl1] });
    }
    // Différentiels avant / arrière
    for (let k = 0; k < 2; k++) { const d = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.24), matDark); add(d); mech.diffs.push(d); }
    // Arbre de transmission central (prop shaft)
    mech.prop = makeSpinShaft(0.045, matSteel); add(mech.prop.group);
    mech.fly = makeEngine(); add(mech.fly);                    // 🔧 bloc moteur avant + volant
    return mech;
  }

  // ── visibilité transmission (arena applyDriveVis 2213-2231) ──────────────────
  function _anchorFront(spec, i) { return ((spec && spec.wheelAnchors && spec.wheelAnchors[i] && spec.wheelAnchors[i].z) || 0) >= 0; }
  function setDriveVisibility(mech, tune) {
    if (!mech) return;
    const spec = mech._spec;
    const mode = (tune || {}).driveMode || 'awd';
    const front = mode !== 'rwd';   // essieu avant entraîné
    const rear  = mode !== 'fwd';   // essieu arrière entraîné
    const prop  = mode !== 'fwd';   // arbre de transmission
    for (let i = 0; i < 4; i++) {
      const v = _anchorFront(spec, i) ? front : rear;
      if (mech.half[i]) mech.half[i].group.visible = v;
      if (mech.jin[i]) mech.jin[i].g.visible = v;
      if (mech.jout[i]) mech.jout[i].g.visible = v;
    }
    if (mech.diffs[0]) mech.diffs[0].visible = front;   // arena : diffs[0]=avant, diffs[1]=arrière
    if (mech.diffs[1]) mech.diffs[1].visible = rear;
    if (mech.prop) mech.prop.group.visible = prop;
    mech.wb.forEach(w => { w.lower.forEach(r => r.visible = true); w.upper.forEach(r => r.visible = true); });
    if (mech.frame) mech.frame.visible = true;
    if (mech.fly) mech.fly.visible = true;
  }

  // ── helpers sync (arena _orient 2236-2241, _placeCardan 2242-2247) ───────────
  function _orient(obj, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, len = Math.hypot(dx, dy, dz) || 1e-3;
    obj.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    _DT_v.set(dx / len, dy / len, dz / len); obj.quaternion.setFromUnitVectors(_DT_up, _DT_v);
    return len;
  }
  function _placeCardan(jc, at, toward, spin) {
    jc.g.position.copy(at);
    const dx = toward.x - at.x, dy = toward.y - at.y, dz = toward.z - at.z, l = Math.hypot(dx, dy, dz) || 1e-3;
    _DT_v.set(dx / l, dy / l, dz / l); jc.g.quaternion.setFromUnitVectors(_DT_up, _DT_v);
    jc.spin.rotation.y = spin;                        // le croisillon tourne avec l'arbre
  }

  // ── spin visuel diff-aware (arena updateDiffSpin 810-828) ────────────────────
  const OVERSPIN = 20;   // vitesse d'emballement d'une roue en l'air (rad/s)
  function diffType(locked, lsd) { return locked ? 'welded' : (lsd ? 'lsd' : 'open'); }
  function updateDiffSpin(mech, wheelStates, dt) {
    const KIN = mech.kin, spec = F.spec, tune = F.tune;
    const realD = [0, 0, 0, 0], touch = [false, false, false, false];
    for (let i = 0; i < 4; i++) {
      const ws = wheelStates[i];
      const v = ws ? (ws.spin || 0) : (KIN.vspinPrev[i] || 0);
      realD[i] = v - (KIN.vspinPrev[i] || 0); KIN.vspinPrev[i] = v;
      touch[i] = !!(ws && ws.contact);
    }
    // essieux dérivés des ancrages RÉELS (avant = z>=0)
    const frontIds = [], rearIds = [];
    for (let i = 0; i < 4; i++) (_anchorFront(spec, i) ? frontIds : rearIds).push(i);
    const lsd = !!tune.lsd, gasDown = (F.throttle || 0) > 0.02;
    const axles = [
      [frontIds[0], frontIds[1], tune.driveMode !== 'rwd', diffType(tune.diffLockFront, lsd)],
      [rearIds[0],  rearIds[1],  tune.driveMode !== 'fwd', diffType(tune.diffLockRear,  lsd)],
    ];
    for (const [a, b, driven, type] of axles) {
      if (a == null || b == null) continue;
      const tA = touch[a], tB = touch[b];
      let vA = realD[a], vB = realD[b];
      if (driven && type === 'welded') {                        // SOUDÉ : les 2 roues à la même vitesse
        const s = (tA && tB) ? (realD[a] + realD[b]) / 2 : (tA ? realD[a] : (tB ? realD[b] : (realD[a] + realD[b]) / 2));
        vA = s; vB = s;
      } else if (driven && (tA !== tB)) {                       // OUVERT / LSD : une roue en l'air s'emballe
        const keep = type === 'lsd' ? 0.85 : 0.70;
        const over = type === 'lsd' ? OVERSPIN * 0.45 : OVERSPIN;
        if (tA) { vA = realD[a] * keep; vB = -(Math.sign(realD[a]) || (gasDown ? -1 : 1)) * over * dt; }
        else    { vB = realD[b] * keep; vA = -(Math.sign(realD[b]) || (gasDown ? -1 : 1)) * over * dt; }
      }
      KIN.visAngle[a] += vA; KIN.visAngle[b] += vB;
    }
  }
  function _avgSpin(mech) { const V = mech.kin.visAngle; return (V[0] + V[1] + V[2] + V[3]) / 4; }

  // ── sync per-frame (arena updateSprings 2137-2175 + updateDrivetrain 2248-2315
  //    + volant moteur 2700-2703) ───────────────────────────────────────────────
  function syncMechanics(mech, ctx, wheelStates, dt) {
    if (!mech || !ctx) return;
    // état de frame depuis ctx (remplace chassisMesh + globals arena)
    _bodyPos.set(ctx.bodyPos.x, ctx.bodyPos.y, ctx.bodyPos.z);
    _bodyQuat.set(ctx.bodyQuat.x, ctx.bodyQuat.y, ctx.bodyQuat.z, ctx.bodyQuat.w);
    F.spec = ctx.spec; F.profile = ctx.profile; F.tune = ctx.tune || {};
    F.throttle = ctx.throttle || 0; F.speed = ctx.speed || 0;
    if (!F.spec || !F.spec.wheelAnchors) return;
    const safeDt = clamp(dt || 1 / 60, 1 / 240, 0.08);
    const radius = (F.spec.wheelRadius) || (F.profile && F.profile.geo && F.profile.geo.radius) || 0.38;
    const restLength = F.tune.restLength ?? 0.35;

    // visibilité par mode de transmission (arena applyDriveVis)
    setDriveVisibility(mech, F.tune);

    // volant moteur : régime = ralenti + gaz + vitesse (arena 2700-2703)
    { const thr = F.throttle > 0 ? 1 : (F.throttle < 0 ? 0.6 : 0);
      mech.kin.flyRpm += ((6 + thr * 42 + F.speed * 2.2) - mech.kin.flyRpm) * Math.min(1, safeDt * 4);
      mech.kin.flyAngle += mech.kin.flyRpm * safeDt; }
    // spin visuel diff-aware (arena updateDiffSpin)
    updateDiffSpin(mech, wheelStates, safeDt);

    // châssis tubulaire : suit le châssis (repère local == bodyPos/bodyQuat)
    mech.frame.position.copy(_bodyPos); mech.frame.quaternion.copy(_bodyQuat);
    // arbre central + différentiels (tournent à la vitesse moyenne des roues)
    const avg = _avgSpin(mech);
    const fd = _l2w(0, -0.10, 1.00), rd = _l2w(0, -0.10, -1.00);
    const Lp = _orient(mech.prop.group, fd, rd); mech.prop.spinner.scale.y = Lp; mech.prop.spinner.rotation.y = avg;
    mech.diffs[0].position.copy(fd); mech.diffs[0].quaternion.copy(_bodyQuat);
    mech.diffs[1].position.copy(rd); mech.diffs[1].quaternion.copy(_bodyQuat);
    // bloc moteur + volant à l'AVANT (le volant tourne au régime moteur)
    mech.fly.position.copy(_l2w(0, 0.02, 1.30)); mech.fly.quaternion.copy(_bodyQuat);
    if (mech.fly.userData.spin) mech.fly.userData.spin.rotation.x = mech.kin.flyAngle;

    // axe "droite" châssis en repère monde (valable même en virage/roulis)
    _knuckleRight.copy(_AX_X).applyQuaternion(_bodyQuat).normalize();
    const kOff = radius * 0.625 + 0.13;             // demi-largeur pneu + marge anti-intersection
    const brakeOff = radius * 0.62 + 0.16;          // offset porte-moyeu de frein (== voiture_lab)
    const swayAttach = [];

    for (let i = 0; i < 4; i++) {
      const ws = wheelStates[i];
      const anchor = F.spec.wheelAnchors[i];
      const wb = mech.wb[i];
      if (!ws || !ws.worldTransform || !anchor) {
        // coin cassé / arraché : on masque tout le coin
        if (mech.half[i]) mech.half[i].group.visible = false;
        if (mech.jin[i]) mech.jin[i].g.visible = false;
        if (mech.jout[i]) mech.jout[i].g.visible = false;
        if (mech.knuckle[i]) mech.knuckle[i].visible = false;
        if (mech.ball[i]) { mech.ball[i][0].visible = false; mech.ball[i][1].visible = false; }
        if (mech.coilover[i]) mech.coilover[i].visible = false;
        if (wb) { wb.lower.forEach(r => r.visible = false); wb.upper.forEach(r => r.visible = false); }
        swayAttach[i] = null;
        continue;
      }
      // coin sain : ré-affiche (half/jin/jout re-gérés en fin de boucle selon driveMode)
      mech.knuckle[i].visible = true;
      mech.ball[i][0].visible = true; mech.ball[i][1].visible = true;
      wb.lower.forEach(r => r.visible = true); wb.upper.forEach(r => r.visible = true);
      mech.coilover[i].visible = true;

      const hub = ws.worldTransform.pos;              // position MONDE de la roue (raycast)
      const sp = mech.kin.visAngle[i] || 0;           // cardan/demi-arbre = spin diff-aware de SA roue
      const sx = anchor.x >= 0 ? 1 : -1;              // côté (droite +, gauche -)
      const spC = sx > 0 ? -sp : sp;                  // 🔄 côté droit : arbre en miroir -> sens inversé
      const wz = anchor.z >= 0 ? 1.00 : -1.00;        // avant/arrière (z d'essieu FIXE, comme arena)

      // demi-arbre + cardans (chacun tourne à la vitesse de SA roue)
      const out = _l2w(sx * 0.20, -0.10, wz);         // sortie du différentiel vers la roue
      const h = mech.half[i]; const L = _orient(h.group, out, hub); h.spinner.scale.y = L; h.spinner.rotation.y = spC;
      _placeCardan(mech.jin[i], out, hub, spC);
      _placeCardan(mech.jout[i], hub, out, spC);

      // DOUBLE TRIANGLE : porte-moyeu OFFSET vers l'intérieur du pneu (le long du vrai axe droite)
      const kdx = -sx * kOff * _knuckleRight.x, kdy = -sx * kOff * _knuckleRight.y, kdz = -sx * kOff * _knuckleRight.z;
      const hubBot = { x: hub.x + kdx, y: hub.y - 0.17 + kdy, z: hub.z + kdz };   // bas porte-moyeu
      const mAl = _l2w(sx * 0.28, -0.20, wz + 0.22), mBl = _l2w(sx * 0.28, -0.20, wz - 0.22);   // ancrages châssis bas
      { const l = _orient(wb.lower[0], mAl, hubBot); wb.lower[0].scale.set(1, l, 1); }
      { const l = _orient(wb.lower[1], mBl, hubBot); wb.lower[1].scale.set(1, l, 1); }
      { const l = _orient(wb.lower[2], mAl, mBl);    wb.lower[2].scale.set(1, l, 1); }
      const hubTop = { x: hub.x + kdx, y: hub.y + 0.17 + kdy, z: hub.z + kdz };   // haut porte-moyeu
      const mAu = _l2w(sx * 0.30, 0.22, wz + 0.18), mBu = _l2w(sx * 0.30, 0.22, wz - 0.18);      // ancrages châssis haut
      { const l = _orient(wb.upper[0], mAu, hubTop); wb.upper[0].scale.set(1, l, 1); }
      { const l = _orient(wb.upper[1], mBu, hubTop); wb.upper[1].scale.set(1, l, 1); }
      { const l = _orient(wb.upper[2], mAu, mBu);    wb.upper[2].scale.set(1, l, 1); }
      // 🔩 PORTE-FUSÉE : tige verticale rotule basse<->haute + les 2 rotules
      { const l = _orient(mech.knuckle[i], hubBot, hubTop); mech.knuckle[i].scale.set(1, l, 1); }
      mech.ball[i][0].position.set(hubBot.x, hubBot.y, hubBot.z);
      mech.ball[i][1].position.set(hubTop.x, hubTop.y, hubTop.z);
      swayAttach[i] = { x: mAl.x + (hubBot.x - mAl.x) * 0.62, y: mAl.y + (hubBot.y - mAl.y) * 0.62, z: hub.z };

      // COILOVER (arena updateSprings) : haut = tour d'amortisseur ; bas = ~62% du bras (hors pneu)
      const anchorTop = _l2w(sx * 0.44, 0.26, wz);
      const wheelIn = { x: hub.x - sx * kOff * _knuckleRight.x, y: hub.y - sx * kOff * _knuckleRight.y, z: hub.z - sx * kOff * _knuckleRight.z };   // arena updateSprings : même kOff que le porte-moyeu
      const armRoot = _l2w(sx * 0.30, -0.14, wz);
      const lowPt = { x: armRoot.x + (wheelIn.x - armRoot.x) * 0.62, y: armRoot.y + (wheelIn.y - armRoot.y) * 0.62, z: armRoot.z + (wheelIn.z - armRoot.z) * 0.62 };
      const sm = mech.coilover[i];
      const dfx = lowPt.x - anchorTop.x, dfy = lowPt.y - anchorTop.y, dfz = lowPt.z - anchorTop.z;
      const len = Math.hypot(dfx, dfy, dfz) || 1e-3;
      sm.position.set(anchorTop.x + dfx * 0.5, anchorTop.y + dfy * 0.5, anchorTop.z + dfz * 0.5);
      if (len > 0.01) { _DT_v.set(dfx / len, dfy / len, dfz / len); sm.quaternion.setFromUnitVectors(_UP, _DT_v); }
      sm.scale.set(1, len, 1);
      const comp = Math.max(0, Math.min(1, 1 - (len - 0.1) / (restLength + 0.05)));
      const coil = sm.userData && sm.userData.coil;
      if (coil) coil.material.color.setHSL(0.33 * (1 - comp * comp), 0.85, 0.5);   // vert détendu -> rouge comprimé

      // porte-moyeu de frein (adaptation, invisible) : positionné comme vehicle_mechanics
      // pour que le disque reparenté (local x = brakeOff) retombe au centre de roue.
      const hubMidX = hub.x - sx * brakeOff * _knuckleRight.x, hubMidY = hub.y - sx * brakeOff * _knuckleRight.y, hubMidZ = hub.z - sx * brakeOff * _knuckleRight.z;
      const steerAxis = _knuckleRight.clone().applyAxisAngle(_UP, ws.steer || 0).normalize();
      const hg = mech.hub[i].g;
      hg.position.set(hubMidX, hubMidY, hubMidZ);
      _DT_v.copy(steerAxis).multiplyScalar(sx);
      hg.quaternion.setFromUnitVectors(_AX_X, _DT_v.lengthSq() < 1e-6 ? _AX_X : _DT_v.normalize());

      // half/jin/jout : visibles seulement si l'essieu est entraîné
      const front = anchor.z >= 0;
      const driven = F.tune.driveMode === 'awd' || (front && F.tune.driveMode === 'fwd') || (!front && F.tune.driveMode === 'rwd');
      mech.half[i].group.visible = driven;
      mech.jin[i].g.visible = driven;
      mech.jout[i].g.visible = driven;
    }

    // 🔩 BARRE STABILISATRICE par essieu (arena 2305-2314)
    const frontIds = [], rearIds = [];
    for (let i = 0; i < 4; i++) (F.spec.wheelAnchors[i].z >= 0 ? frontIds : rearIds).push(i);
    const axleGroups = [frontIds, rearIds];
    for (let k = 0; k < 2; k++) {
      const s = mech.sway[k]; const ids = axleGroups[k];
      const L = ids[0] != null ? swayAttach[ids[0]] : null, R = ids[1] != null ? swayAttach[ids[1]] : null;
      if (!L || !R) { s.bar.scale.y = 0; s.dl[0].scale.y = 0; s.dl[1].scale.y = 0; continue; }
      const barY = Math.min(L.y, R.y) + 0.13;
      const eL = { x: L.x, y: barY, z: L.z }, eR = { x: R.x, y: barY, z: R.z };
      { const l = _orient(s.bar, eL, eR); s.bar.scale.set(1, l, 1); }
      { const l = _orient(s.dl[0], eL, L); s.dl[0].scale.set(1, l, 1); }
      { const l = _orient(s.dl[1], eR, R); s.dl[1].scale.set(1, l, 1); }
    }
  }

  return {
    createMechanics,
    syncMechanics,
    setDriveVisibility,
    getKIN: (m) => m.kin,
    materials: { matSteel, matDark, matArm, matJoint, matCoil, matMarkShaft, matRim },
  };
}

export default makeArenaMechanics;
