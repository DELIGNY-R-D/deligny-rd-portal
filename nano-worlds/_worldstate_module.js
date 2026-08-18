// ═══════════════════════════════════════════════════════════════════
// WORLDSTATE AGGREGATOR — module pur JS (insérer dans monde3d.html)
// Règle : aucune feature ne modifie le monde sans passer par WorldState
// ═══════════════════════════════════════════════════════════════════
//
// INTÉGRATION : coller ce bloc AVANT le premier appel à Three.js
// (après les imports de bibliothèques, avant la scène).
// Voir _WORLDSTATE_INTEGRATION.md pour la procédure complète.
//
// UTILISATION RAPIDE :
//   WorldState.set('climate.rainfall', 0.8);
//   WorldState.tick(deltaSeconds);
//   const density = WorldState.get('ecology.forestDensity');
//   WorldState.onChange('ecology.forestDensity', (val) => rebuildTrees(val));
// ═══════════════════════════════════════════════════════════════════

const WSAgg = (function () {

  // ─────────────────────────────────────────────────────────────────
  // CONSTANTES
  // ─────────────────────────────────────────────────────────────────

  const MAX_POP = 10000;

  // Bonus de connaissance par ère civilisationnelle
  const ERA_BONUS = {
    primitive: 0.0,
    medieval:  0.15,
    modern:    0.40,
    future:    0.70
  };

  // Inertie temporelle par couche (tau en secondes de jeu).
  // Plus tau est grand, plus la valeur met du temps à rejoindre sa cible.
  // Régler ici pour ajuster la vitesse de changement visuel.
  const INERTIA = {
    'geology.fertility':       60,
    'geology.erosionRate':     90,
    'hydrology.waterLevel':    45,
    'hydrology.floodRisk':     20,
    'ecology.biodiversity':    120,
    'ecology.forestDensity':   150,
    'population.capacity':     30,
    'population.growth':       10,
    'population.current':      60,
    'infrastructure.level':    180,
    'infrastructure.decay':    30,
    'economy.wealth':          120,
    'economy.growthRate':      60,
    'knowledge.level':         240
  };

  // Seuil de delta minimal pour déclencher les callbacks onChange
  const CHANGE_THRESHOLD = 0.01;

  // ─────────────────────────────────────────────────────────────────
  // ÉTAT INTERNE
  // ─────────────────────────────────────────────────────────────────

  // Entrées exogènes (pilotées par le joueur ou les events)
  const _exo = {
    'climate.temp':        15,    // °C, -20 à 40
    'climate.rainfall':    0.5,   // 0–1
    'disaster.volcanic':   0.0,   // 0–1, intensité éruption
    'disaster.drought':    0.0,   // 0–1, intensité sécheresse
    'time.era':            'primitive'
  };

  // Valeurs courantes des couches calculées (lissées par inertie)
  const _state = {
    'geology.fertility':       0.3,
    'geology.erosionRate':     0.1,
    'hydrology.waterLevel':    0.4,
    'hydrology.floodRisk':     0.0,
    'ecology.biodiversity':    0.3,
    'ecology.forestDensity':   0.2,
    'population.capacity':     0.3,
    'population.growth':       0.0,
    'population.current':      500,
    'infrastructure.level':    0.1,
    'infrastructure.decay':    0.0,
    'economy.wealth':          0.2,
    'economy.growthRate':      0.0,
    'knowledge.level':         0.1
  };

  // Valeurs cibles (calculées à chaque tick avant lissage)
  const _target = Object.assign({}, _state);

  // Registre des observateurs onChange
  // { key: [ { cb, lastVal } ] }
  const _observers = {};

  // ─────────────────────────────────────────────────────────────────
  // UTILITAIRES
  // ─────────────────────────────────────────────────────────────────

  function clamp(min, val, max) {
    return Math.max(min, Math.min(max, val));
  }

  // Lissage exponentiel : déplace _state[key] vers _target[key]
  // avec une constante de temps tau (secondes).
  // Si dt === 0 : idempotent (aucune modification).
  // Si tau <= 0 : snap instantané vers la cible.
  function smooth(key, dt) {
    if (dt <= 0) return; // tick(0) = idempotent
    const tau = INERTIA[key];
    if (!tau || tau <= 0) {
      _state[key] = _target[key];
      return;
    }
    const alpha = 1 - Math.exp(-dt / tau);
    _state[key] = _state[key] + alpha * (_target[key] - _state[key]);
  }

  // ─────────────────────────────────────────────────────────────────
  // PROPAGATION DU GRAPHE
  // Ordre strict : Geology → Hydrology → Ecology → Population
  //             → Infrastructure → Economy → Knowledge
  // ─────────────────────────────────────────────────────────────────

  function _computeTargets(dt) {
    const rain    = _exo['climate.rainfall'];
    const volcanic = _exo['disaster.volcanic'];
    const drought  = _exo['disaster.drought'];
    const era      = _exo['time.era'];

    // ── Geology ──────────────────────────────────────────────────
    _target['geology.fertility'] = clamp(0,
      rain * 0.7 - volcanic * 0.4 + 0.3,
    1);
    _target['geology.erosionRate'] = clamp(0,
      rain * 0.5 + volcanic * 0.3,
    1);

    // Raccourcis vers valeurs LISSÉES des couches précédentes
    // (utiliser _state pour la propagation inter-couches
    //  afin de ne pas propager des sauts brusques)
    const geoFert  = _state['geology.fertility'];
    const geoEros  = _state['geology.erosionRate'];

    // ── Hydrology ────────────────────────────────────────────────
    _target['hydrology.waterLevel'] = clamp(0,
      rain * 0.9 - drought * 0.6 + geoFert * 0.2,
    1);
    const wl = _state['hydrology.waterLevel'];
    _target['hydrology.floodRisk'] = wl > 0.75 ? (wl - 0.75) * 4 : 0;

    // ── Ecology ──────────────────────────────────────────────────
    _target['ecology.biodiversity'] = clamp(0,
      geoFert * 0.5 + wl * 0.4 - volcanic * 0.3,
    1);
    const bio = _state['ecology.biodiversity'];
    _target['ecology.forestDensity'] = clamp(0,
      bio * 0.8 + rain * 0.2 - 0.1,
    1);

    // ── Population ───────────────────────────────────────────────
    const infLvl = _state['infrastructure.level'];
    // Note : on utilise ecology.biodiversity comme proxy de fertility écologique
    _target['population.capacity'] = clamp(0,
      wl * 0.4 + bio * 0.3 + infLvl * 0.3,
    1);
    const cap = _state['population.capacity'];
    const pop = _state['population.current'];
    _target['population.growth'] = clamp(-0.1,
      (cap - pop / MAX_POP) * 0.05,
    0.1);
    // population.current croît/décroît selon growth (personnes/seconde jeu)
    _target['population.current'] = clamp(0,
      pop + _state['population.growth'] * MAX_POP * dt,
    MAX_POP);

    // ── Infrastructure ───────────────────────────────────────────
    const wealth = _state['economy.wealth'];
    _target['infrastructure.level'] = clamp(0,
      wealth * 0.6 + (pop / MAX_POP) * 0.4 - _state['infrastructure.decay'],
    1);
    _target['infrastructure.decay'] = clamp(0,
      drought * 0.1 + volcanic * 0.2,
    1);

    // ── Economy ──────────────────────────────────────────────────
    _target['economy.wealth'] = clamp(0,
      bio * 0.3 + (pop / MAX_POP) * 0.4 + infLvl * 0.3,
    1);
    _target['economy.growthRate'] = wealth > 0.5 ? 0.01 : -0.005;

    // ── Knowledge ────────────────────────────────────────────────
    const eraBonus = ERA_BONUS[era] !== undefined ? ERA_BONUS[era] : 0;
    _target['knowledge.level'] = clamp(0,
      wealth * 0.5 + eraBonus,
    1);
  }

  function _applySmoothing(dt) {
    for (const key of Object.keys(_state)) {
      smooth(key, dt);
    }
  }

  function _fireObservers(prevSnapshot) {
    for (const key of Object.keys(_observers)) {
      const listeners = _observers[key];
      if (!listeners || listeners.length === 0) continue;
      const cur = _readAny(key);
      for (const listener of listeners) {
        const delta = Math.abs(cur - listener.lastVal);
        if (delta >= CHANGE_THRESHOLD) {
          listener.lastVal = cur;
          try { listener.cb(cur, key); } catch (e) { /* cb ne doit pas planter le moteur */ }
        }
      }
    }
  }

  // Lecture unifiée (exo OU state)
  function _readAny(key) {
    if (key in _exo)   return _exo[key];
    if (key in _state) return _state[key];
    return undefined;
  }

  // ─────────────────────────────────────────────────────────────────
  // API PUBLIQUE
  // ─────────────────────────────────────────────────────────────────

  /**
   * tick(dt)
   * Avance la simulation de `dt` secondes (de temps jeu).
   * À appeler dans la boucle principale Three.js :
   *   WorldState.tick(clock.getDelta() * TIME_SCALE);
   * Idempotent si dt === 0.
   */
  function tick(dt) {
    dt = dt || 0;
    // dt === 0 : garantie d'idempotence — aucun calcul, aucun effet
    if (dt === 0) return;

    // Snapshot avant pour les observers
    const prev = {};
    for (const k of Object.keys(_state)) prev[k] = _state[k];
    for (const k of Object.keys(_exo))   prev[k] = _exo[k];

    _computeTargets(dt);
    _applySmoothing(dt);
    _fireObservers(prev);
  }

  /**
   * set(key, value)
   * Modifier une entrée exogène.
   * Clés valides : 'climate.temp', 'climate.rainfall',
   *   'disaster.volcanic', 'disaster.drought', 'time.era'
   * Exemple : WorldState.set('disaster.volcanic', 0.9);
   */
  function set(key, value) {
    if (!(key in _exo)) {
      console.warn('[WorldState] Clé exogène inconnue :', key);
      return;
    }
    _exo[key] = value;
  }

  /**
   * get(key)
   * Lire une valeur calculée ou exogène.
   * Exemple : WorldState.get('ecology.forestDensity')
   */
  function get(key) {
    const val = _readAny(key);
    if (val === undefined) {
      console.warn('[WorldState] Clé inconnue :', key);
    }
    return val;
  }

  /**
   * snapshot()
   * Retourne un objet plat sérialisable de tout l'état.
   * Utile pour la sauvegarde / Time Travel.
   */
  function snapshot() {
    return Object.assign({}, _exo, _state);
  }

  /**
   * restore(data)
   * Charge un snapshot précédemment obtenu via snapshot().
   * Ne fire PAS les observers (restauration silencieuse).
   */
  function restore(data) {
    if (!data || typeof data !== 'object') return;
    for (const key of Object.keys(data)) {
      if (key in _exo)   { _exo[key]   = data[key]; continue; }
      if (key in _state) { _state[key] = data[key]; _target[key] = data[key]; }
    }
  }

  /**
   * onChange(key, cb)
   * Observer une valeur. cb(value, key) est appelé dès que la valeur
   * change de plus de CHANGE_THRESHOLD (0.01 par défaut).
   * Retourne une fonction de désinscription.
   *
   * Exemple :
   *   const unsub = WorldState.onChange('ecology.forestDensity', (v) => {
   *     if (v < 0.2) reduceTreeCount();
   *   });
   *
   * Fonctionne pour les clés exogènes ET calculées.
   */
  function onChange(key, cb) {
    if (!_observers[key]) _observers[key] = [];
    const listener = { cb, lastVal: _readAny(key) || 0 };
    _observers[key].push(listener);
    // Retourne une fonction de désinscription
    return function unsubscribe() {
      const idx = _observers[key].indexOf(listener);
      if (idx !== -1) _observers[key].splice(idx, 1);
    };
  }

  /**
   * getAll()
   * Retourne un objet plat de toutes les valeurs courantes
   * (exogènes + calculées).
   */
  function getAll() {
    return snapshot();
  }

  /**
   * debug()
   * Retourne une chaîne HTML pour afficher l'état dans un panel debug.
   * Exemple : document.getElementById('ws-debug').innerHTML = WorldState.debug();
   */
  function debug() {
    const all = snapshot();
    const rows = Object.entries(all).map(([k, v]) => {
      const display = typeof v === 'number'
        ? (Number.isInteger(v) ? v : v.toFixed(3))
        : v;
      const bar = typeof v === 'number' && v >= 0 && v <= 1
        ? `<span style="display:inline-block;width:${Math.round(v*80)}px;height:8px;background:#4af;vertical-align:middle;margin-left:6px;border-radius:2px"></span>`
        : '';
      return `<tr><td style="color:#adf;padding-right:12px;font-family:monospace;font-size:11px">${k}</td>`
           + `<td style="font-family:monospace;font-size:11px">${display}${bar}</td></tr>`;
    });
    return `<table style="border-collapse:collapse;line-height:1.6">${rows.join('')}</table>`;
  }

  // ─────────────────────────────────────────────────────────────────
  // EXPORT
  // ─────────────────────────────────────────────────────────────────

  return {
    tick,
    set,
    get,
    snapshot,
    restore,
    onChange,
    getAll,
    debug,
    // Constantes exposées (lecture seule)
    MAX_POP,
    ERA_BONUS,
    INERTIA,
    CHANGE_THRESHOLD
  };

})();

// Expose sous window.WSAgg pour éviter la collision avec WorldState existant dans monde3d
window.WSAgg = WSAgg;

// ═══════════════════════════════════════════════════════════════════
// FIN DU MODULE WORLDSTATE
// ═══════════════════════════════════════════════════════════════════
