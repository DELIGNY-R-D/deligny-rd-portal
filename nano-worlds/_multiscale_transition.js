// TRANSITION MULTI-ECHELLE — cube→espace progressive (0 ecran de chargement)
// Bible Nano Worlds : couche de transition progressive (P2 Bible §simulation-multi-echelle)
// Insérer via <script src="_multiscale_transition.js"></script> avant </body>
//
// ARCHITECTURE :
//   - S'accroche à window.__M (exposé par monde3d.html) pour accéder à camera/controls/scene/skyMat/starMat
//   - N'importe aucune dépendance npm, zéro chargement, zéro écran noir
//   - Respecte le cycle jour/nuit existant : ne touche starMat.opacity que si > opacité de nuit naturelle
//   - Compatible pilotedRocket (mode espace alternatif déjà géré dans monde3d.html)
//
// ZONES D'ALTITUDE (camera.zoom comme proxy d'altitude — zoom faible = très loin = haute altitude)
//   zoom >= 0.80  → sol normal       (progress = 0.0)
//   zoom  0.80→0.45 → transition     (progress 0.0 → 1.0)
//   zoom <= 0.45  → espace complet   (progress = 1.0)
//   zoom <= 0.30  → mode espace profond (planète miniature)
//
// NOTE : OrthographicCamera Nano Worlds : zoom PLUS GRAND = plus proche.
//   controls.minZoom = 0.35, controls.maxZoom = 7  (ligne 307 monde3d.html)
//   La caméra démarre à zoom=1. Dézoomer beaucoup → zoom ≈ 0.35 (minimum imposé par controls).
//   Pour que la transition s'active sans bloquer l'usage normal, le module abaisse temporairement
//   controls.minZoom quand le module est armé (via forceSpace() ou seuil dépassé).

window.MultiScale = (function () {

  // ── CONSTANTES ───────────────────────────────────────────────────────────────
  const ZOOM_GROUND     = 0.80;   // zoom > ça → sol pur
  const ZOOM_SPACE      = 0.38;   // zoom < ça → espace complet
  const ZOOM_DEEP       = 0.26;   // zoom < ça → espace profond (planète)

  const SKY_TOP_SPACE   = new (window.THREE ? THREE.Color : Object)(0x000004);
  const SKY_BOT_SPACE   = new (window.THREE ? THREE.Color : Object)(0x00000e);
  const FOG_FAR_NORMAL  = 999999; // stocké au 1er tick pour restauration

  const LERP_SPEED  = 1.8;   // vitesse de transition par seconde (× dt)
  const STAR_MAX    = 0.92;  // opacité max des étoiles en mode espace (0-1)

  // Couleurs ciel "sol" — récupérées depuis skyMat au 1er tick pour restauration
  let _skyTopSave = null;
  let _skyBotSave = null;
  let _fogFarSave  = null;
  let _fogNearSave = null;
  let _minZoomSave = null;

  // ── ÉTAT ─────────────────────────────────────────────────────────────────────
  let _mode     = 'ground';   // 'ground' | 'transition' | 'space'
  let _progress = 0;          // 0.0 (sol) → 1.0 (espace complet)
  let _callbacks = [];
  let _lastMode = 'ground';
  let _ready = false;         // true quand window.__M est dispo et init faite

  // ── OVERLAY HUD ──────────────────────────────────────────────────────────────
  let _hud = null;

  function _ensureHud() {
    if (_hud) return;
    _hud = document.createElement('div');
    _hud.id = 'ms-space-hud';
    _hud.style.cssText = [
      'position:fixed',
      'bottom:80px',
      'left:50%',
      'transform:translateX(-50%)',
      'z-index:200',
      'display:none',
      'pointer-events:none',
      'text-align:center',
      'font-family:system-ui,sans-serif',
      'color:rgba(180,220,255,0.92)',
      'text-shadow:0 0 8px rgba(80,160,255,0.7)',
      'transition:opacity 0.6s ease',
      'opacity:0',
    ].join(';');

    // Planète SVG
    const planetSvg = `<svg width="72" height="72" viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto 6px">
  <defs>
    <radialGradient id="msGlobe" cx="38%" cy="35%" r="60%">
      <stop offset="0%"   stop-color="#5badff"/>
      <stop offset="45%"  stop-color="#2271cc"/>
      <stop offset="100%" stop-color="#071b3a"/>
    </radialGradient>
    <clipPath id="msClip"><circle cx="36" cy="36" r="28"/></clipPath>
  </defs>
  <circle cx="36" cy="36" r="28" fill="url(#msGlobe)"/>
  <!-- continents schematiques -->
  <g clip-path="url(#msClip)" fill="rgba(80,160,60,0.55)" stroke="none">
    <ellipse cx="28" cy="30" rx="9" ry="6" transform="rotate(-20,28,30)"/>
    <ellipse cx="46" cy="38" rx="7" ry="5" transform="rotate(15,46,38)"/>
    <ellipse cx="22" cy="44" rx="5" ry="3" transform="rotate(5,22,44)"/>
  </g>
  <!-- nuages -->
  <g clip-path="url(#msClip)" fill="rgba(255,255,255,0.30)" stroke="none">
    <ellipse cx="32" cy="22" rx="11" ry="3.5" transform="rotate(-10,32,22)"/>
    <ellipse cx="48" cy="29" rx="8"  ry="2.5" transform="rotate(5,48,29)"/>
    <ellipse cx="24" cy="38" rx="7"  ry="2"   transform="rotate(-5,24,38)"/>
    <ellipse cx="42" cy="48" rx="10" ry="3"   transform="rotate(8,42,48)"/>
  </g>
  <!-- nimbe atmosph -->
  <circle cx="36" cy="36" r="28" fill="none" stroke="rgba(100,190,255,0.25)" stroke-width="4"/>
</svg>`;

    const altLabel = document.createElement('div');
    altLabel.id = 'ms-alt-label';
    altLabel.style.cssText = 'font-size:13px;letter-spacing:0.08em;opacity:0.85;margin-top:2px;';
    altLabel.textContent = 'Terre — altitude ...';

    _hud.innerHTML = planetSvg;
    _hud.appendChild(altLabel);
    document.body.appendChild(_hud);
  }

  function _showHud(progress, zoom) {
    _ensureHud();
    const visible = progress > 0.75;
    _hud.style.display = 'block';
    _hud.style.opacity  = visible ? Math.min(1, (progress - 0.75) / 0.15).toFixed(3) : '0';

    // Altitude fictive 0..9999 km (cosmétique)
    const altKm = Math.round((1 - Math.max(0, Math.min(1, (zoom - ZOOM_DEEP) / (ZOOM_SPACE - ZOOM_DEEP)))) * 9800 + 200);
    const label = document.getElementById('ms-alt-label');
    if (label) label.textContent = 'Terre — altitude ' + altKm.toLocaleString('fr-FR') + ' km';

    if (!visible && parseFloat(_hud.style.opacity) <= 0.01) {
      _hud.style.display = 'none';
    }
  }

  function _hideHud() {
    if (!_hud) return;
    _hud.style.opacity = '0';
    setTimeout(() => { if (_hud) _hud.style.display = 'none'; }, 650);
  }

  // ── ETOILES FALLBACK ─────────────────────────────────────────────────────────
  // Si starMat est absent (rendu hors monde3d.html ou version différente),
  // on crée un Points minimaliste propre
  let _ownStars = null;
  let _ownStarMat = null;

  function _ensureOwnStars(scene) {
    if (_ownStars || !scene) return;
    if (typeof THREE === 'undefined') return;
    const N = 2000;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      // Distribution sphère aléatoire, rayon 400
      const u = Math.random(), v = Math.random();
      const th = u * 6.2831853;
      const ph = Math.acos(2 * v - 1);
      const r  = 380 + Math.random() * 40;
      pos[i * 3]     = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = Math.abs(r * Math.cos(ph)) * 0.85 + 10;
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    _ownStarMat = new THREE.PointsMaterial({
      color: 0xffffff, size: 1.4, sizeAttenuation: true,
      transparent: true, opacity: 0, depthWrite: false
    });
    _ownStars = new THREE.Points(geo, _ownStarMat);
    scene.add(_ownStars);
  }

  // Renvoie le PointsMaterial actif (natif si dispo, propre sinon)
  function _getStarMat(scene) {
    if (typeof starMat !== 'undefined' && starMat) return starMat;
    _ensureOwnStars(scene);
    return _ownStarMat;
  }

  // ── INIT (1er tick) ──────────────────────────────────────────────────────────
  function _init(M) {
    if (_ready) return;
    _ready = true;

    // Sauvegarde état initial du ciel pour restauration
    if (typeof skyMat !== 'undefined' && skyMat && skyMat.uniforms) {
      _skyTopSave = skyMat.uniforms.top.value.clone();
      _skyBotSave = skyMat.uniforms.bot.value.clone();
    } else if (typeof THREE !== 'undefined') {
      // Valeurs par défaut monde3d.html (ligne 331)
      _skyTopSave = new THREE.Color(0x6ea8e6);
      _skyBotSave = new THREE.Color(0xdcebf7);
    }

    const scene = M.scene;
    if (scene && scene.fog) {
      _fogNearSave = scene.fog.near;
      _fogFarSave  = scene.fog.far;
    }

    // Déverrouille le zoom minimum pour permettre le dézoom spatial
    const controls = M.controls;
    if (controls) {
      _minZoomSave = controls.minZoom;
      controls.minZoom = ZOOM_DEEP * 0.85; // autoriser un peu plus bas que ZOOM_DEEP
    }
  }

  // ── RESTAURATION SOL ─────────────────────────────────────────────────────────
  function _restoreGround(M) {
    const { camera, controls, scene } = M;

    // Ciel
    if (typeof skyMat !== 'undefined' && skyMat && skyMat.uniforms && _skyTopSave) {
      skyMat.uniforms.top.value.copy(_skyTopSave);
      skyMat.uniforms.bot.value.copy(_skyBotSave);
    }

    // Brouillard
    if (scene && scene.fog && _fogFarSave != null) {
      scene.fog.near = _fogNearSave;
      scene.fog.far  = _fogFarSave;
    }

    // Étoiles
    const sm = _getStarMat(scene);
    // Ne remet pas starMat à 0 si c'est le natif — le cycle jour/nuit le gère
    if (sm === _ownStarMat && _ownStarMat) _ownStarMat.opacity = 0;

    // Zoom : ne pas forcer (l'utilisateur contrôle)
    _hideHud();
  }

  // ── TICK PRINCIPAL ───────────────────────────────────────────────────────────
  function tick(dt, camera, controls, scene) {
    // Récupère les refs depuis window.__M si les args ne sont pas fournis
    const M = window.__M || {};
    const cam  = camera   || M.camera;
    const ctrl = controls || M.controls;
    const sc   = scene    || M.scene;

    if (!cam || !ctrl || !sc) return; // monde pas encore prêt

    _init({ camera: cam, controls: ctrl, scene: sc });

    // Ne pas interférer avec le mode fusée (il a son propre pipeline spatial)
    const pilotRocket = (typeof pilotedRocket !== 'undefined' && pilotedRocket) ||
                        (M.pilotedRocketRef);
    if (pilotRocket) return;

    const zoom = cam.zoom;

    // ── Calcul du progress cible ─────────────────────────────────────────────
    let targetProgress;
    if (zoom >= ZOOM_GROUND) {
      targetProgress = 0;
    } else if (zoom <= ZOOM_SPACE) {
      targetProgress = 1;
    } else {
      targetProgress = (ZOOM_GROUND - zoom) / (ZOOM_GROUND - ZOOM_SPACE);
    }

    // Lerp du progress (fluidité)
    const lerpFactor = Math.min(1, LERP_SPEED * Math.max(0.001, dt));
    _progress += (targetProgress - _progress) * lerpFactor;
    _progress = Math.max(0, Math.min(1, _progress));

    // ── Mode ────────────────────────────────────────────────────────────────
    const prevMode = _mode;
    if (_progress < 0.02)      _mode = 'ground';
    else if (_progress > 0.95) _mode = 'space';
    else                        _mode = 'transition';

    if (_mode !== _lastMode) {
      _lastMode = _mode;
      _callbacks.forEach(cb => { try { cb(_mode); } catch (e) {} });
      if (_mode === 'ground') _restoreGround({ camera: cam, controls: ctrl, scene: sc });
    }

    if (_progress < 0.01) return; // sol pur — rien à faire

    const p = _progress; // alias lisible

    // ── Étoiles ─────────────────────────────────────────────────────────────
    // Opacité : 0 → 0.4 entre progress 0→0.35, 0.4 → STAR_MAX entre 0.35→1
    const starTarget = p < 0.35
      ? (p / 0.35) * 0.40
      : 0.40 + ((p - 0.35) / 0.65) * (STAR_MAX - 0.40);

    const sm = _getStarMat(sc);
    if (sm) {
      // Si c'est le starMat natif, ne pousser que si on dépasse l'opacité naturelle actuelle
      // (pour ne pas casser le cycle nuit/jour quand progress est faible)
      if (sm === _ownStarMat) {
        sm.opacity = starTarget;
      } else {
        // starMat natif : on prend le max entre cycle naturel et mode spatial
        sm.opacity = Math.max(sm.opacity, starTarget);
      }
    }

    // ── Ciel → noir spatial ──────────────────────────────────────────────────
    // s'active à partir de p=0.25 (zone 60–120u)
    if (typeof skyMat !== 'undefined' && skyMat && skyMat.uniforms && _skyTopSave) {
      const skyP = Math.max(0, (p - 0.25) / 0.75);
      if (skyP > 0) {
        skyMat.uniforms.top.value.set(
          _skyTopSave.r + (SKY_TOP_SPACE.r - _skyTopSave.r) * skyP,
          _skyTopSave.g + (SKY_TOP_SPACE.g - _skyTopSave.g) * skyP,
          _skyTopSave.b + (SKY_TOP_SPACE.b - _skyTopSave.b) * skyP
        );
        skyMat.uniforms.bot.value.set(
          _skyBotSave.r + (SKY_BOT_SPACE.r - _skyBotSave.r) * skyP,
          _skyBotSave.g + (SKY_BOT_SPACE.g - _skyBotSave.g) * skyP,
          _skyBotSave.b + (SKY_BOT_SPACE.b - _skyBotSave.b) * skyP
        );
      }
    }

    // ── Brouillard ───────────────────────────────────────────────────────────
    // Repousse progressivement le brouillard (espace = pas de brume)
    if (sc && sc.fog && _fogFarSave != null) {
      const fogP = Math.min(1, p * 1.5);
      sc.fog.near = _fogNearSave  + (_fogFarSave  * 3 - _fogNearSave)  * fogP;
      sc.fog.far  = _fogFarSave   + (_fogFarSave  * 8 - _fogFarSave)   * fogP;
    }

    // ── HUD planète ─────────────────────────────────────────────────────────
    _showHud(p, zoom);
  }

  // ── API PUBLIQUE ─────────────────────────────────────────────────────────────

  function getMode()     { return _mode; }
  function getProgress() { return _progress; }

  function forceGround() {
    _progress = 0;
    _mode = 'ground';
    _lastMode = 'ground';
    const M = window.__M || {};
    if (M.camera && M.controls && M.scene) {
      _restoreGround(M);
    }
    _callbacks.forEach(cb => { try { cb('ground'); } catch (e) {} });
  }

  function forceSpace() {
    _progress = 1;
    _mode = 'space';
    _lastMode = 'space';
    // Dézoome la caméra pour visuellement entrer dans l'espace
    const M = window.__M || {};
    if (M.camera) {
      M.camera.zoom = ZOOM_SPACE;
      M.camera.updateProjectionMatrix();
    }
    _callbacks.forEach(cb => { try { cb('space'); } catch (e) {} });
  }

  function onModeChange(cb) {
    if (typeof cb === 'function') _callbacks.push(cb);
  }

  // ── INIT SKY COLORS (COLOR OBJECTS) ─────────────────────────────────────────
  // Les Color() créés avant que THREE soit disponible sont des objets vides.
  // On les recrée au premier tick (voir _init).
  function _fixColorPlaceholders() {
    if (typeof THREE === 'undefined') return;
    if (!(SKY_TOP_SPACE instanceof THREE.Color)) {
      SKY_TOP_SPACE.r = 0; SKY_TOP_SPACE.g = 0; SKY_TOP_SPACE.b = 4/255;
      SKY_BOT_SPACE.r = 0; SKY_BOT_SPACE.g = 0; SKY_BOT_SPACE.b = 14/255;
    }
  }

  // Patch pour corriger les Color placeholders si THREE pas encore prêt au parse
  const _origTick = tick;
  const tickSafe = function (dt, camera, controls, scene) {
    _fixColorPlaceholders();
    _origTick(dt, camera, controls, scene);
  };

  return {
    tick: tickSafe,
    getMode,
    getProgress,
    forceGround,
    forceSpace,
    onModeChange,
  };

})();

// ── INTÉGRATION AUTOMATIQUE ──────────────────────────────────────────────────
// Si window.__M est déjà prêt, on se greffe sur la boucle via requestAnimationFrame.
// Sinon on attend que __M soit disponible.
// IMPORTANT : cette auto-intégration est optionnelle et sans risque.
// Si vous appelez MultiScale.tick() manuellement depuis la boucle de monde3d.html,
// désactivez cette section (commentez le bloc ci-dessous).
(function () {
  let _lastT = 0;

  function _autoTick(t) {
    const dt = Math.min(0.1, (t - _lastT) / 1000);
    _lastT = t;

    // Vérif que le monde est prêt (window.__M.camera existe)
    const M = window.__M;
    if (M && M.camera && M.controls && M.scene) {
      window.MultiScale.tick(dt, M.camera, M.controls, M.scene);
    }

    requestAnimationFrame(_autoTick);
  }

  // Démarre dès que la page est prête
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => requestAnimationFrame(_autoTick));
  } else {
    requestAnimationFrame(_autoTick);
  }
})();
