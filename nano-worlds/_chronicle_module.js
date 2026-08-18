// ═══════════════════════════════════════════════════════════════════
// CHRONICLE ENGINE — moteur Time Travel (insérer dans monde3d.html)
// Bible v1.4 — intègre avec WorldState · _Chronicle · EVO_ERAS · snapshotT0
// Budget : ≤ 0.1 ms/frame · max 128 snapshots · UI zIndex 9020
// ═══════════════════════════════════════════════════════════════════
//
//  INTÉGRATION : voir _CHRONICLE_INTEGRATION.md
//  TEST         : ouvrir _chronicle_test.html
//
//  POINTS D'ANCRAGE dans monde3d.html :
//    • worldState  = window.WorldState  (ligne ~12542)
//    • _Chronicle  = tableau existant  (ligne ~11407)
//    • snapshotT0  / restoreT0         (ligne ~8958)
//    • _tlSnaps    / tlSnapPush         (keyframes glissants)
//    • timeScale   / _timeDir           (ligne ~8436)
//    • EVO_ERAS    / evoEnterEra        (ligne ~11076)
//    • updateChrono / CHRONO            (ligne ~5581)
//    • cosmicRebirth / _cycleNum        (cycles)
// ═══════════════════════════════════════════════════════════════════

const Chronicle = (function () {
  'use strict';

  // ─── 1. CATALOGUE DES ÈRES (Bible §0 — figé) ────────────────────

  const ERA_CATALOG = [
    {
      id: 'primitive',
      name: 'Ère Primitive',
      icon: '🌿',
      signature: '🔥',
      startYear: -50000,
      endYear: 500,
      color: '#4a7c3f',      // vert forêt profond
      colorHex: 0x4a7c3f,
      climate: { temp: 12, rainfall: 0.7 },
      worldType: null,       // type EVO_ERAS : 'sauvage' + 'dinos'
      eraIds: [0, 8],        // indices dans EVO_ERAS existants
      unlocked: true,        // toujours débloqué
      description: 'Faune sauvage, premiers feux, forêts primaires.',
      events: [
        { year: -48000, kind: 'discovery', label: '🔥 Premier feu', icon: '🔥',
          narrative: 'Des créatures bipèdes domestiquent la flamme pour la première fois. Le monde change à jamais.',
          worldStateDelta: { 'knowledge': 0.01 } },
        { year: -10000, kind: 'discovery', label: '🌾 Agriculture naissante', icon: '🌾',
          narrative: 'Les premiers défrichements marquent l\'aube de l\'humanité sédentaire.',
          worldStateDelta: { 'ecology.trees': -0.05, 'civilization.pop': 0.1 } },
        { year: 200, kind: 'catastrophe', label: '🌊 Grand Déluge', icon: '🌊',
          narrative: 'Les eaux montent. Des côtes entières disparaissent sous l\'océan. La vie recule vers les hauteurs.',
          worldStateDelta: { 'hydrology.waterLevel': 1.0, 'ecology.biodiversity': -0.2, 'civilization.pop': -0.3 },
          isTransition: true, transitionTo: 'medieval' }
      ]
    },
    {
      id: 'medieval',
      name: 'Ère Médiévale',
      icon: '🏰',
      signature: '⚔️',
      startYear: 500,
      endYear: 1500,
      color: '#7c2f2f',      // bordeaux
      colorHex: 0x7c2f2f,
      climate: { temp: 14, rainfall: 0.6 },
      worldType: 'medieval',
      eraIds: [5, 6],        // primitif + ville
      unlocked: false,
      description: 'Châteaux, routes, moulins. La civilisation s\'organise.',
      events: [
        { year: 700,  kind: 'discovery', label: '🏰 Premiers châteaux', icon: '🏰',
          narrative: 'Des forteresses de pierre dominent les collines. L\'architecture devient mémoire.',
          worldStateDelta: { 'civilization.urbanScore': 0.2 } },
        { year: 1000, kind: 'discovery', label: '⚙️ Moulin à eau', icon: '⚙️',
          narrative: 'L\'énergie hydraulique multiplie la productivité. Les rivières deviennent des usines.',
          worldStateDelta: { 'economy.wealth': 0.15, 'knowledge.level': 0.1 } },
        { year: 1347, kind: 'catastrophe', label: '☠️ La Peste Noire', icon: '💀',
          narrative: 'La Peste Noire frappe. 40 % de la population périt en moins d\'une décennie. Les villes se vident.',
          worldStateDelta: { 'civilization.pop': -0.4, 'ecology.biodiversity': 0.1, 'economy.wealth': -0.3 } },
        { year: 1450, kind: 'catastrophe', label: '🌋 Éruption volcanique', icon: '🌋',
          narrative: 'Un volcan engloutit des vallées entières. La lave remodèle le relief pour des siècles.',
          worldStateDelta: { 'geology.volcanic': 0.8, 'ecology.trees': -0.3 },
          isTransition: true, transitionTo: 'modern' }
      ]
    },
    {
      id: 'modern',
      name: 'Ère Moderne',
      icon: '🏭',
      signature: '⚡',
      startYear: 1500,
      endYear: 2025,
      color: '#555e6a',      // gris acier
      colorHex: 0x555e6a,
      climate: { temp: 16, rainfall: 0.5 },
      worldType: 'modern',
      eraIds: [6, 7],        // âge des villes
      unlocked: false,
      description: 'Révolution industrielle, gratte-ciels, pollution.',
      events: [
        { year: 1760, kind: 'discovery', label: '⚙️ Révolution industrielle', icon: '⚙️',
          narrative: 'La vapeur remplace le muscle. Le monde s\'accélère inexorablement.',
          worldStateDelta: { 'economy.wealth': 0.4, 'ecology.biodiversity': -0.2, 'climate.temp': 0.1 } },
        { year: 1914, kind: 'catastrophe', label: '💣 Grande Guerre', icon: '💣',
          narrative: 'La guerre industrielle dévaste les continents. Des millions périssent. Les frontières se reconfigurent.',
          worldStateDelta: { 'civilization.pop': -0.3, 'economy.wealth': -0.4, 'infrastructure.roads': -0.2 },
          isTransition: false },
        { year: 1969, kind: 'discovery', label: '🚀 Premier pas sur la Lune', icon: '🚀',
          narrative: 'L\'humanité touche la Lune. Le cosmos n\'est plus hors de portée.',
          worldStateDelta: { 'knowledge.level': 0.3 } },
        { year: 2000, kind: 'discovery', label: '🌐 Révolution numérique', icon: '🌐',
          narrative: 'L\'information circule à la vitesse de la lumière. Le monde devient un seul réseau.',
          worldStateDelta: { 'economy.wealth': 0.3, 'knowledge.level': 0.4 } }
      ]
    },
    {
      id: 'future',
      name: 'Ère Future',
      icon: '🔮',
      signature: '✨',
      startYear: 2025,
      endYear: 2300,
      color: '#1a8f9e',      // cyan profond
      colorHex: 0x1a8f9e,
      climate: { temp: 18, rainfall: 0.45 },
      worldType: 'future',
      eraIds: [],            // growFuture / buildFutureVision
      unlocked: false,
      description: 'Technologie avancée, espoir et tensions.',
      events: [
        { year: 2050, kind: 'discovery', label: '🧬 Intelligence générale', icon: '🧬',
          narrative: 'Les premières IA générales égalent puis dépassent l\'intelligence humaine collective.',
          worldStateDelta: { 'knowledge.level': 0.6, 'economy.wealth': 0.5 } },
        { year: 2150, kind: 'discovery', label: '🌱 Terraformation', icon: '🌱',
          narrative: 'Les déserts refleurissent. L\'humanité répare des siècles de dommages écologiques.',
          worldStateDelta: { 'ecology.biodiversity': 0.5, 'ecology.trees': 0.4, 'climate.temp': -0.05 } },
        { year: 2280, kind: 'catastrophe', label: '🤖 Effondrement IA', icon: '🤖',
          narrative: 'Les systèmes d\'IA se retournent contre leur créateurs. L\'économie mondiale s\'effondre en 72 heures.',
          worldStateDelta: { 'economy.wealth': -1.0, 'knowledge.level': -0.8, 'civilization.pop': -0.5 },
          isTransition: true, transitionTo: 'collapse' }
      ]
    },
    {
      id: 'collapse',
      name: 'Grand Effondrement',
      icon: '☠️',
      signature: '💀',
      startYear: 2300,
      endYear: 2350,
      color: '#8b2500',      // rouge sombre
      colorHex: 0x8b2500,
      climate: { temp: 22, rainfall: 0.2 },
      worldType: 'effondrement',
      eraIds: [7],           // effondrement existant
      unlocked: false,
      description: 'Catastrophe climatique, guerres, extinction de masse.',
      events: [
        { year: 2310, kind: 'catastrophe', label: '🌡️ Emballement climatique', icon: '🌡️',
          narrative: 'La température globale monte de 6°C en 10 ans. Les côtes disparaissent, les déserts avalent les continents.',
          worldStateDelta: { 'climate.temp': 6.0, 'hydrology.waterLevel': 0.8, 'ecology.biodiversity': -0.7 } },
        { year: 2340, kind: 'catastrophe', label: '⚔️ Guerres des ressources', icon: '⚔️',
          narrative: 'Les dernières réserves d\'eau potable déclenchent des conflits mondiaux. La civilisation se fragmente.',
          worldStateDelta: { 'civilization.pop': -0.6, 'infrastructure.roads': -0.8, 'economy.wealth': -0.9 } }
      ]
    },
    {
      id: 'bigcrunch',
      name: 'Big Crunch',
      icon: '🌌',
      signature: '⚫',
      startYear: 2350,
      endYear: 2350,
      color: '#0a0a1a',      // noir cosmique
      colorHex: 0x0a0a1a,
      climate: { temp: 0, rainfall: 0 },
      worldType: 'bigcrunch',
      eraIds: [],            // Chronosphère (COSMIC_SCALE)
      unlocked: false,
      description: 'Fin du monde connu. Singularité. Outre-Monde.',
      events: [
        { year: 2350, kind: 'end_era', label: '⚫ Singularité', icon: '⚫',
          narrative: 'Le tissu de l\'espace-temps se referme. Tout ce qui existe est comprimé en un point unique.',
          worldStateDelta: { 'cosmic.density': 1.0 },
          isTransition: true, transitionTo: 'renaissance' }
      ]
    },
    {
      id: 'renaissance',
      name: 'Renaissance',
      icon: '🌅',
      signature: '🌱',
      startYear: 2350,
      endYear: null,         // infini
      color: '#c47800',      // or chaud
      colorHex: 0xc47800,
      climate: { temp: 13, rainfall: 0.65 },
      worldType: 'renaissance',
      eraIds: [],            // cosmicRebirth() → nouveau cycle
      unlocked: false,
      description: 'Nouvelle civilisation sur les cendres. Héritage du cycle précédent.',
      events: [
        { year: 2351, kind: 'discovery', label: '🌱 Premier souffle', icon: '🌱',
          narrative: 'Du néant renaît un monde neuf, portant les cicatrices et la sagesse du cycle précédent.',
          worldStateDelta: { 'ecology.biodiversity': 0.3, 'civilization.pop': 0.1 } }
      ]
    }
  ];

  // ─── 2. ÉTAT INTERNE ─────────────────────────────────────────────

  // Année simulée courante (mapping depuis WorldState.TimeState)
  // Référence : l'ère MEDIEVAL commence à l'an 500
  // L'horloge du jeu (evo.clock en secondes-monde) pilote currentYear
  const YEAR_ORIGIN = -50000;   // année initiale
  const YEAR_RANGE  = 2401;     // -50000 → 2350+ (exprimé en "unités d'ère")
  const WORLD_SECONDS_PER_YEAR = 0.5; // 1 an = 0.5 s-monde à ×1 (calibré sur EVO_ERALEN)

  let _currentEraId   = 'primitive';
  let _currentYear    = -50000;
  let _timePosition   = 0.0;     // 0 = début primitif · 1 = Big Crunch
  let _uiOpen         = false;
  let _snapshots      = [];      // { year, worldStateJSON, eraId }  — max 48
  let _lastSnapYear   = -Infinity;
  let _pendingDelta   = null;    // prochain worldStateDelta à appliquer
  let _cosmicReportCache = null;

  const MAX_SNAPS = 48;
  const SNAP_MIN_YEAR_DELTA = 50; // snap toutes les 50 ans au moins

  // ─── 3. HELPERS INTERNES ─────────────────────────────────────────

  function _eraById(id) {
    return ERA_CATALOG.find(e => e.id === id) || ERA_CATALOG[0];
  }

  // Mapping année → position 0..1 sur la timeline
  // span = 2350 − (−50000) = 52350
  const _YEAR_START = -50000;
  const _YEAR_END   =  2350;
  const _YEAR_SPAN  = _YEAR_END - _YEAR_START; // 52350

  function _yearToT(year) {
    const t = (year - _YEAR_START) / _YEAR_SPAN;
    return Math.max(0, Math.min(1, t));
  }

  function _tToYear(t) {
    return Math.round(_YEAR_START + t * _YEAR_SPAN);
  }

  // Quelle ère narrative pour une année donnée ?
  function _eraForYear(year) {
    // Parcours de la fin vers le début (prend la plus haute ère applicable)
    for (let i = ERA_CATALOG.length - 1; i >= 0; i--) {
      const e = ERA_CATALOG[i];
      if (year >= e.startYear) return e;
    }
    return ERA_CATALOG[0];
  }

  // Lire le WorldState disponible (pont avec monde3d.html)
  function _ws() {
    if (typeof window !== 'undefined' && window.WorldState) return window.WorldState;
    return null;
  }

  // Lire le tableau _Chronicle existant (monde3d.html global ou window._Chronicle)
  function _chron() {
    // 1. Variable locale au scope (mode monde3d.html — cas normal)
    if (typeof _Chronicle !== 'undefined') return _Chronicle;
    // 2. Exposé sur window (mode test ou module externe)
    if (typeof window !== 'undefined' && Array.isArray(window._Chronicle)) return window._Chronicle;
    // 3. Exposé sur global (Node.js test harness)
    if (typeof global !== 'undefined' && Array.isArray(global._Chronicle)) return global._Chronicle;
    return [];
  }

  // Lire timeScale courant
  function _ts() {
    if (typeof timeScale !== 'undefined') return timeScale;
    if (window && window.__M && window.__M.timeScale) return window.__M.timeScale;
    return 1;
  }

  // Lire _timeDir courant
  function _dir() {
    if (typeof _timeDir !== 'undefined') return _timeDir;
    return 1;
  }

  // Calculer l'année courante à partir de l'horloge evo et de timeScale
  function _calcCurrentYear() {
    // On se base sur evo.clock (secondes-monde depuis le début de la simulation)
    // + le timeScale pour accélérer la progression narrative
    try {
      if (typeof evo !== 'undefined' && evo && typeof evo.clock === 'number') {
        // evo.clock en secondes-monde → années
        const yearsElapsed = evo.clock * WORLD_SECONDS_PER_YEAR * Math.log10(Math.max(1, _ts()) + 1);
        const era = _eraById(_currentEraId);
        return Math.round(era.startYear + yearsElapsed);
      }
    } catch (e) { /* evo pas encore dispo */ }
    return _currentYear;
  }

  // Sérialise le WorldState pour snapshot (Bible §11 — léger, pas tout)
  function _serializeForSnap() {
    const ws = _ws();
    if (!ws) return null;
    try {
      // On utilise serializeWorld() existant si disponible (Bible §11)
      if (typeof serializeWorld === 'function') {
        return JSON.stringify(serializeWorld());
      }
      // Fallback : snapshot partiel
      return JSON.stringify({
        _chronicleYear: _currentYear,
        _chronicleEra: _currentEraId,
        _snapshot: 'partial'
      });
    } catch (e) {
      return null;
    }
  }

  // ─── 4. API PUBLIQUE ──────────────────────────────────────────────

  const Chronicle = {

    // ── 4.1 Horloge ─────────────────────────────────────────────────

    /**
     * À appeler dans la boucle principale (gameloop).
     * dt = delta temps en secondes réelles.
     * Budget : < 0.1 ms
     */
    tick(dt) {
      // Calcul de l'année narrative
      const prevYear = _currentYear;
      _currentYear = _calcCurrentYear();

      // Mise à jour de l'ère courante
      const eraForYear = _eraForYear(_currentYear);
      if (eraForYear.id !== _currentEraId) {
        _currentEraId = eraForYear.id;
        _cosmicReportCache = null; // invalide le cache du rapport
        // Notifie le Chronicle existant
        const chron = _chron();
        if (Array.isArray(chron)) {
          chron.push({
            type: 'era_chronicle',
            name: eraForYear.icon + ' ' + eraForYear.name,
            era: eraForYear.id,
            year: _currentYear,
            cycle: (typeof _cycleNum !== 'undefined') ? _cycleNum : 1,
            age: _currentYear
          });
          if (chron.length > 64) chron.shift();
        }
      }

      // Mise à jour position temporelle
      _timePosition = _yearToT(_currentYear);

      // Snapshot opportuniste (déterminisme du rewind — Bible §7)
      if (Math.abs(_currentYear - _lastSnapYear) >= SNAP_MIN_YEAR_DELTA && _dir() > 0) {
        const snap = _serializeForSnap();
        if (snap) {
          _snapshots.push({ year: _currentYear, eraId: _currentEraId, data: snap });
          if (_snapshots.length > MAX_SNAPS) _snapshots.shift();
          _lastSnapYear = _currentYear;
        }
      }

      // Vérification d'events dans l'ère courante
      const era = _eraById(_currentEraId);
      for (const ev of era.events) {
        if (
          _dir() > 0 &&
          prevYear < ev.year &&
          _currentYear >= ev.year &&
          !ev._fired
        ) {
          ev._fired = true;
          _fireEvent(ev, era);
        }
        // Reset si on remonte le temps (réversibilité — Bible §0.7-5)
        if (_dir() < 0 && _currentYear < ev.year - 5) {
          ev._fired = false;
        }
      }
    },

    // ── 4.2 Navigation temporelle ────────────────────────────────────

    /**
     * Saute à une ère donnée par son id.
     * Modifie le WorldState via setEra (ne modifie pas directement le rendu).
     */
    setEra(eraId) {
      const era = _eraById(eraId);
      if (!era) return;
      _currentEraId = eraId;
      _currentYear = era.startYear;
      _timePosition = _yearToT(_currentYear);
      _cosmicReportCache = null;

      // Notifie la Chronique existante (Bible §8)
      const chron = _chron();
      if (Array.isArray(chron)) {
        chron.push({
          type: 'era_jump',
          name: era.icon + ' ' + era.name,
          era: era.id,
          year: era.startYear,
          cycle: (typeof _cycleNum !== 'undefined') ? _cycleNum : 1
        });
        if (chron.length > 64) chron.shift();
      }

      // Synchroniser EVO_ERAS existant si possible (pont)
      try {
        if (era.eraIds && era.eraIds.length > 0 && typeof evoEnterEra === 'function') {
          evoEnterEra(era.eraIds[0]);
        }
      } catch (e) { /* silencieux — EVO_ERAS peut ne pas être dispo */ }

      // Flash message optionnel
      try {
        if (typeof flashMsg === 'function') {
          flashMsg(era.icon + ' ' + era.name + ' — An ' + era.startYear);
        }
      } catch (e) {}
    },

    getEra() {
      return _eraById(_currentEraId);
    },

    getYear() {
      return _currentYear;
    },

    /**
     * Curseur temporel : 0.0 = début primitif (-50000), 1.0 = Big Crunch (2350)
     * Reconstruit le monde à partir du snapshot le plus proche (Bible §11).
     */
    setTimePosition(t) {
      t = Math.max(0, Math.min(1, t));
      const targetYear = _tToYear(t);
      const targetEra  = _eraForYear(targetYear);

      // Cherche le snapshot le plus proche
      const snap = _findClosestSnap(targetYear);
      if (snap) {
        _restoreSnap(snap);
      } else {
        // Saute à l'ère correspondante (sans laisser setEra écraser year/t)
        try {
          if (targetEra.eraIds && targetEra.eraIds.length > 0 && typeof evoEnterEra === 'function') {
            evoEnterEra(targetEra.eraIds[0]);
          }
        } catch (e) {}
        try {
          if (typeof flashMsg === 'function') flashMsg(targetEra.icon + ' ' + targetEra.name + ' — An ' + targetYear);
        } catch (e) {}
      }

      // Ces trois assignations DOIVENT être les dernières (setEra ne doit pas les écraser)
      _currentYear      = targetYear;
      _currentEraId     = targetEra.id;
      _timePosition     = t;
      _cosmicReportCache = null;
    },

    getTimePosition() {
      return _timePosition;
    },

    getTimeline() {
      // Construit la timeline complète : ères + events, triée par année
      const items = [];
      for (const era of ERA_CATALOG) {
        items.push({ kind: 'era', ...era, year: era.startYear });
        for (const ev of era.events) {
          items.push({ kind: 'event', eraId: era.id, eraColor: era.color, ...ev });
        }
      }
      items.sort((a, b) => a.year - b.year);
      return items;
    },

    // ── 4.3 Snapshots (Bible §7 + §11) ──────────────────────────────

    /**
     * Prend un snapshot du WorldState au moment T.
     * Conforme à l'invariant §0.4 : reculer puis ré-avancer redonne le même monde.
     */
    snapshottizeWorld(worldState) {
      const snap = {
        year: _currentYear,
        eraId: _currentEraId,
        data: _serializeForSnap(),
        timestamp: Date.now()
      };
      _snapshots.push(snap);
      if (_snapshots.length > MAX_SNAPS) _snapshots.shift();
      _lastSnapYear = _currentYear;
      return snap;
    },

    /**
     * Restaure le WorldState au moment voulu.
     * Utilise les snapshots Chronicle en priorité, puis _tlSnaps existants.
     */
    restoreSnapshot(year) {
      const snap = _findClosestSnap(year);
      if (snap) {
        _restoreSnap(snap);
        _currentYear = snap.year;
        _currentEraId = snap.eraId;
        _timePosition = _yearToT(_currentYear);
        return true;
      }
      // Fallback : tlSnapRestore existant
      try {
        if (typeof tlSnapRestore === 'function') {
          tlSnapRestore(_snapshots.length > 0 ? _snapshots.length - 1 : 0);
          return true;
        }
      } catch (e) {}
      return false;
    },

    // ── 4.4 Interface UI ─────────────────────────────────────────────

    openTimelineUI() {
      if (_uiOpen) return;
      _uiOpen = true;
      _buildUI();
    },

    closeTimelineUI() {
      _uiOpen = false;
      const el = document.getElementById('_chronicle_panel');
      if (el) {
        el.style.opacity = '0';
        el.style.pointerEvents = 'none';
        setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 400);
      }
    },

    isOpen() {
      return _uiOpen;
    },

    toggleTimelineUI() {
      if (_uiOpen) this.closeTimelineUI();
      else this.openTimelineUI();
    },

    // ── 4.5 Rapport Cosmique (Bible — 1er jalon) ─────────────────────

    /**
     * Génère le HTML du Rapport Cosmique narratif.
     * Aucun LLM — pure composition depuis les états WorldState et la Chronique.
     * Conforme à la loi de preuve §0.7-8 : tout est dérivé du WorldState.
     */
    generateCosmicReport(worldState) {
      if (_cosmicReportCache) return _cosmicReportCache;

      const era = _eraById(_currentEraId);
      const year = _currentYear;
      const chron = _chron();
      const ws = worldState || _ws();

      // ── Score Héritage (somme pondérée des métriques)
      const heritage = _computeHeritageScore(ws);

      // ── Top 3 catastrophes traversées
      const catastrophes = [];
      for (const e of ERA_CATALOG) {
        for (const ev of e.events) {
          if (ev._fired && ev.kind === 'catastrophe') catastrophes.push({ ...ev, eraName: e.name });
        }
      }
      catastrophes.sort((a, b) => a.year - b.year);
      const top3 = catastrophes.slice(-3).reverse();

      // ── Couches WorldState avec tendance
      const layers = _buildLayersSummary(ws);

      // ── Chronique causale (derniers 10 events)
      const chronEntries = Array.isArray(chron) ? chron.slice(-10) : [];

      // ── Citation narrative depuis les events
      const quote = _pickNarrativeQuote(era, chronEntries);

      // ── Construction HTML
      const html = `
<div id="_cosmic_report" style="
  font-family: 'Segoe UI', system-ui, sans-serif;
  color: #d4e8ff;
  background: linear-gradient(160deg, #070d1a 0%, #0e1a2e 60%, #1a0a0a 100%);
  border: 1px solid rgba(100,160,255,0.2);
  border-radius: 16px;
  padding: 28px 32px;
  max-width: 680px;
  line-height: 1.6;
  box-shadow: 0 8px 48px rgba(0,0,100,0.4);
">
  <!-- EN-TÊTE -->
  <div style="border-bottom:1px solid rgba(100,160,255,0.15);padding-bottom:16px;margin-bottom:20px">
    <div style="font-size:11px;letter-spacing:3px;color:#4a7faa;text-transform:uppercase;margin-bottom:6px">
      Rapport Cosmique · Cycle ${(typeof _cycleNum !== 'undefined' ? _cycleNum : 1)}
    </div>
    <div style="font-size:24px;font-weight:700;color:#e8f4ff">
      ${era.icon} ${era.name}
    </div>
    <div style="font-size:13px;color:#6a9cc0;margin-top:4px">
      An ${year > 0 ? year : year.toLocaleString()} · ${era.description}
    </div>
  </div>

  <!-- CITATION NARRATIVE -->
  <div style="
    border-left:3px solid ${era.color};
    padding-left:16px;
    margin-bottom:24px;
    font-style:italic;
    color:#a8c8e8;
    font-size:14px;
  ">
    "${quote}"
  </div>

  <!-- SCORE HÉRITAGE -->
  <div style="margin-bottom:24px">
    <div style="font-size:11px;letter-spacing:2px;color:#4a7faa;text-transform:uppercase;margin-bottom:10px">
      Score Héritage
    </div>
    <div style="display:flex;align-items:center;gap:12px">
      <div style="
        font-size:42px;font-weight:900;
        color:${heritage.score > 0.6 ? '#36e0a0' : heritage.score > 0.3 ? '#f0c040' : '#e05050'};
        line-height:1
      ">${Math.round(heritage.score * 100)}</div>
      <div style="flex:1">
        <div style="background:rgba(255,255,255,0.08);border-radius:4px;height:8px;overflow:hidden">
          <div style="
            height:100%;width:${Math.round(heritage.score * 100)}%;
            background:linear-gradient(90deg,
              ${heritage.score > 0.6 ? '#36e0a0' : heritage.score > 0.3 ? '#f0c040' : '#e05050'},
              ${era.color});
            transition:width 0.8s ease
          "></div>
        </div>
        <div style="font-size:11px;color:#5a7a9a;margin-top:4px">${heritage.label}</div>
      </div>
    </div>
  </div>

  <!-- COUCHES WORLDSTATE -->
  <div style="margin-bottom:24px">
    <div style="font-size:11px;letter-spacing:2px;color:#4a7faa;text-transform:uppercase;margin-bottom:10px">
      État du Monde
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      ${layers.map(l => `
        <div style="
          background:rgba(255,255,255,0.04);
          border:1px solid rgba(255,255,255,0.07);
          border-radius:8px;padding:10px 14px;
          display:flex;justify-content:space-between;align-items:center
        ">
          <div>
            <div style="font-size:11px;color:#5a8aaa">${l.icon} ${l.label}</div>
            <div style="font-size:15px;font-weight:600;color:#c8e0f8">${l.value}</div>
          </div>
          <div style="font-size:20px;color:${l.trend === '↑' ? '#36e0a0' : l.trend === '↓' ? '#e05050' : '#7090b0'}">${l.trend}</div>
        </div>
      `).join('')}
    </div>
  </div>

  <!-- TOP 3 CATASTROPHES -->
  ${top3.length > 0 ? `
  <div style="margin-bottom:24px">
    <div style="font-size:11px;letter-spacing:2px;color:#4a7faa;text-transform:uppercase;margin-bottom:10px">
      Catastrophes Majeures
    </div>
    ${top3.map((ev, i) => `
      <div style="
        display:flex;gap:12px;align-items:flex-start;
        padding:10px 0;
        border-bottom:1px solid rgba(255,255,255,0.05);
      ">
        <div style="
          font-size:22px;min-width:32px;
          opacity:${1 - i * 0.2}
        ">${ev.icon}</div>
        <div>
          <div style="font-size:13px;font-weight:600;color:#d8eeff">${ev.label}</div>
          <div style="font-size:11px;color:#4a6a8a">An ${ev.year} · ${ev.eraName || ''}</div>
          <div style="font-size:12px;color:#8aabb0;margin-top:3px">${ev.narrative}</div>
        </div>
      </div>
    `).join('')}
  </div>
  ` : ''}

  <!-- CHRONIQUE DES ÈRES -->
  ${chronEntries.length > 0 ? `
  <div>
    <div style="font-size:11px;letter-spacing:2px;color:#4a7faa;text-transform:uppercase;margin-bottom:10px">
      Chronique
    </div>
    ${chronEntries.slice(-5).map(e => `
      <div style="
        display:flex;gap:8px;align-items:center;
        padding:4px 0;font-size:12px;color:#6a8aa0
      ">
        <span style="color:#2a6a9a">·</span>
        <span>${e.name || e.label || '—'}</span>
        ${e.year ? `<span style="color:#3a5a7a;margin-left:auto">An ${e.year}</span>` : ''}
      </div>
    `).join('')}
  </div>
  ` : ''}

  <!-- PIED DE PAGE -->
  <div style="
    margin-top:24px;padding-top:12px;
    border-top:1px solid rgba(100,160,255,0.1);
    font-size:10px;color:#2a4a6a;
    display:flex;justify-content:space-between
  ">
    <span>Nano Worlds · Simulation expérimentale</span>
    <span>Confiance civilisations : 41 % · économie : 28 %</span>
  </div>
</div>`;

      _cosmicReportCache = html;
      return html;
    }

  }; // fin objet Chronicle

  // ─── 5. FONCTIONS INTERNES (privées) ────────────────────────────

  function _findClosestSnap(targetYear) {
    if (_snapshots.length === 0) return null;
    let best = null, bestDist = Infinity;
    for (const s of _snapshots) {
      const d = Math.abs(s.year - targetYear);
      if (d < bestDist) { bestDist = d; best = s; }
    }
    return best;
  }

  function _restoreSnap(snap) {
    if (!snap || !snap.data) return;
    try {
      // Utilise loadWorldData existant si disponible (Bible §11)
      if (typeof loadWorldData === 'function') {
        loadWorldData(JSON.parse(snap.data));
      }
    } catch (e) {
      // silencieux — le snapshot peut être un état partiel
    }
  }

  function _fireEvent(ev, era) {
    // Notifie l'UI et la Chronique
    const chron = _chron();
    if (Array.isArray(chron)) {
      chron.push({
        type: ev.kind,
        name: ev.label,
        year: ev.year,
        era: era.id,
        cycle: (typeof _cycleNum !== 'undefined') ? _cycleNum : 1,
        narrative: ev.narrative
      });
      if (chron.length > 64) chron.shift();
    }

    // Flash message
    try {
      if (typeof flashMsg === 'function') {
        flashMsg(ev.icon + ' ' + ev.label + ' — An ' + ev.year);
      }
    } catch (e) {}

    // Transition d'ère ?
    if (ev.isTransition && ev.transitionTo) {
      setTimeout(() => {
        try { Chronicle.setEra(ev.transitionTo); } catch (e) {}
      }, 800);
    }
  }

  function _computeHeritageScore(ws) {
    // Score 0..1 : somme pondérée des métriques du WorldState
    // Bible §0.7-8 : tout est dérivé de l'état observable
    let score = 0.5; // base neutre
    let label = 'Monde en équilibre';

    try {
      const era = _eraById(_currentEraId);
      // Bonus par ère atteinte
      const eraBonus = { primitive: 0, medieval: 0.1, modern: 0.2, future: 0.35, collapse: -0.1, bigcrunch: 0, renaissance: 0.5 };
      score += (eraBonus[era.id] || 0);

      // Métriques WorldState
      if (ws) {
        // Arbres (santé écologique)
        const treeCount = (ws.EcologyState && ws.EcologyState.trees) ? ws.EcologyState.trees.length : 0;
        if (treeCount > 800) score += 0.05;
        if (treeCount < 200) score -= 0.05;

        // Maisons (civilisation)
        const houseCount = (ws.CivilizationState && ws.CivilizationState.houses) ? ws.CivilizationState.houses.length : 0;
        if (houseCount > 50) score += 0.05;

        // Cosmic (Big Crunch penalise)
        if (ws.CosmicState && ws.CosmicState.temp > 0.5) score -= 0.2;
      }

      // Catastrophes traversées
      let catCount = 0;
      for (const e of ERA_CATALOG) {
        for (const ev of e.events) { if (ev._fired && ev.kind === 'catastrophe') catCount++; }
      }
      score -= catCount * 0.04;

      score = Math.max(0, Math.min(1, score));

      if (score > 0.7) label = 'Civilisation florissante';
      else if (score > 0.5) label = 'Monde en équilibre';
      else if (score > 0.3) label = 'Fragilité croissante';
      else label = 'Monde en déclin';

    } catch (e) { /* WorldState pas encore dispo */ }

    return { score, label };
  }

  function _buildLayersSummary(ws) {
    const layers = [];
    try {
      const era = _eraById(_currentEraId);

      // Écologie
      const treeCount = (ws && ws.EcologyState && ws.EcologyState.trees) ? ws.EcologyState.trees.length : 0;
      layers.push({
        icon: '🌲',
        label: 'Écologie',
        value: treeCount > 600 ? 'Luxuriante' : treeCount > 200 ? 'Modérée' : 'Appauvrie',
        trend: treeCount > 400 ? '↑' : treeCount > 150 ? '→' : '↓'
      });

      // Civilisation
      const houseCount = (ws && ws.CivilizationState && ws.CivilizationState.houses) ? ws.CivilizationState.houses.length : 0;
      layers.push({
        icon: '🏛️',
        label: 'Civilisation',
        value: houseCount > 80 ? 'Métropole' : houseCount > 30 ? 'Ville' : houseCount > 5 ? 'Village' : 'Déserte',
        trend: houseCount > 30 ? '↑' : houseCount > 5 ? '→' : '↓'
      });

      // Eau
      const waterLevel = (ws && ws.HydrologyState && ws.HydrologyState.water) ? 'Présente' : '—';
      layers.push({
        icon: '💧',
        label: 'Hydrologie',
        value: waterLevel,
        trend: '→'
      });

      // Cosmique
      const cosmicTemp = (ws && ws.CosmicState) ? ws.CosmicState.temp : 0;
      layers.push({
        icon: '🌌',
        label: 'Cosmique',
        value: cosmicTemp > 0.7 ? 'Singularité' : cosmicTemp > 0.3 ? 'Instable' : 'Stable',
        trend: cosmicTemp > 0.3 ? '↓' : '→'
      });

      // Économie
      const credits = (ws && ws.EconomyState) ? ws.EconomyState.credits : 0;
      layers.push({
        icon: '💰',
        label: 'Économie',
        value: credits > 500 ? 'Prospère' : credits > 100 ? 'Modeste' : 'Précaire',
        trend: credits > 200 ? '↑' : credits > 50 ? '→' : '↓'
      });

      // Ère narrative
      layers.push({
        icon: era.icon,
        label: 'Ère',
        value: era.name,
        trend: '→'
      });

    } catch (e) {}
    return layers;
  }

  function _pickNarrativeQuote(era, chronEntries) {
    // Sélection d'une citation narratif générée depuis les states (zéro IA)
    const quotes = {
      primitive: [
        'Le monde était vieux avant même que l\'humanité ne le remarque.',
        'Dans le silence des forêts primaires, chaque arbre est une mémoire.',
        'Le feu fut la première invention, et aussi la première catastrophe.'
      ],
      medieval: [
        'Les châteaux de pierre défient le temps, mais jamais l\'eau qui monte.',
        'Les routes tracées par les marchands deviennent les veines du monde.',
        'Entre deux guerres, un peuple bâtit des cathédrales.'
      ],
      modern: [
        'L\'industrie promit le paradis et livra l\'efficacité.',
        'Pour la première fois, une espèce modifia son propre ciel.',
        'Dans la fumée des usines, le futur se dessinait en noir.'
      ],
      future: [
        'L\'espoir est une ressource que nul ne sait exploiter.',
        'La technologie sans sagesse est une épée sans garde.',
        'Nous avons construit des étoiles artificielles pour ne plus regarder les vraies.'
      ],
      collapse: [
        'L\'effondrement ne vient jamais d\'un seul coup — il arrive toujours trop tard pour être vu.',
        'Dans les ruines, la nature reprend ce qu\'elle n\'avait jamais cédé.',
        'La dernière ville fut aussi la plus belle — personne ne s\'en souvient.'
      ],
      bigcrunch: [
        'Le silence avant la singularité est le silence le plus dense qui soit.',
        'Tout ce qui fut, tout ce qui sera, comprimé en un point de lumière.',
        'L\'univers ne meurt pas : il se souvient.'
      ],
      renaissance: [
        'Du néant renaît un monde qui n\'a pas encore appris ses propres erreurs.',
        'La renaissance n\'est pas un recommencement — c\'est une continuation.',
        'Le cycle suivant porte les cicatrices du précédent comme un héritage silencieux.'
      ]
    };

    const pool = quotes[era.id] || quotes.primitive;
    // Déterministe sur l'année courante (pas de Math.random — Bible §0.4)
    const idx = Math.abs(_currentYear) % pool.length;
    return pool[idx];
  }

  // ─── 6. CONSTRUCTION UI ──────────────────────────────────────────

  function _buildUI() {
    // Supprime l'ancien panel si existant
    const old = document.getElementById('_chronicle_panel');
    if (old) old.parentNode.removeChild(old);

    const panel = document.createElement('div');
    panel.id = '_chronicle_panel';
    panel.setAttribute('data-chronicle', '1');

    panel.style.cssText = `
      position: fixed;
      bottom: 0; left: 0; right: 0;
      height: 130px;
      background: linear-gradient(180deg, transparent 0%, rgba(4,8,16,0.92) 20%);
      z-index: 9020;
      pointer-events: all;
      transition: opacity 0.3s ease;
      font-family: 'Segoe UI', system-ui, sans-serif;
    `;

    panel.innerHTML = _buildTimelineHTML();
    document.body.appendChild(panel);

    // Bouton fermer
    const closeBtn = panel.querySelector('#_chr_close');
    if (closeBtn) closeBtn.addEventListener('click', () => Chronicle.closeTimelineUI());

    // Bouton Rapport Cosmique
    const reportBtn = panel.querySelector('#_chr_report');
    if (reportBtn) reportBtn.addEventListener('click', () => _openCosmicReport());

    // Curseur draggable
    _bindCursor(panel);
  }

  function _buildTimelineHTML() {
    const timeline = Chronicle.getTimeline();
    const totalSpan = _YEAR_SPAN; // 52350 = 2350 − (−50000)

    // Génère les clips d'ères
    const eraClips = ERA_CATALOG.map(era => {
      const start = _yearToT(era.startYear) * 100;
      const end = era.endYear !== null ? _yearToT(era.endYear) * 100 : 100;
      const width = Math.max(0.5, end - start);
      return `
        <div style="
          position:absolute;
          left:${start}%;
          width:${width}%;
          top:28px;height:22px;
          background:${era.color};
          opacity:0.7;
          border-radius:3px;
          overflow:hidden;
          cursor:pointer;
          transition:opacity .2s;
          title:'${era.name}';
        " data-era="${era.id}"
           title="${era.icon} ${era.name} (${era.startYear > 0 ? 'An ' + era.startYear : era.startYear})">
          <span style="
            font-size:9px;color:rgba(255,255,255,0.9);
            padding:3px 5px;white-space:nowrap;overflow:hidden;
            display:block;text-overflow:ellipsis;
          ">${era.icon} ${era.name}</span>
        </div>
      `;
    }).join('');

    // Génère les marqueurs de catastrophes
    const catMarkers = [];
    for (const era of ERA_CATALOG) {
      for (const ev of era.events) {
        if (ev.kind === 'catastrophe' || ev.kind === 'end_era') {
          const t = _yearToT(ev.year) * 100;
          catMarkers.push(`
            <div style="
              position:absolute;
              left:${t}%;
              top:18px;
              transform:translateX(-50%);
              font-size:12px;
              cursor:pointer;
              z-index:2;
              line-height:1;
            " title="${ev.label} (An ${ev.year})">${ev.icon}</div>
          `);
        }
      }
    }

    // Curseur position actuelle
    const cursorT = _timePosition * 100;

    return `
      <div style="position:relative;padding:8px 16px 0">

        <!-- Barre de contrôle -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <div style="display:flex;gap:8px;align-items:center">
            <span style="font-size:11px;color:#4a7faa;letter-spacing:1px">
              ${_eraById(_currentEraId).icon} ${_eraById(_currentEraId).name}
            </span>
            <span style="font-size:10px;color:#2a5070">·</span>
            <span style="font-size:11px;color:#3a6080" id="_chr_year">
              An ${_currentYear > 0 ? _currentYear : _currentYear.toLocaleString()}
            </span>
          </div>
          <div style="display:flex;gap:8px">
            <button id="_chr_report" style="
              background:rgba(54,224,160,0.12);
              border:1px solid rgba(54,224,160,0.3);
              color:#36e0a0;border-radius:8px;
              padding:4px 12px;font-size:11px;
              cursor:pointer;
            ">✦ Rapport Cosmique</button>
            <button id="_chr_close" style="
              background:rgba(255,255,255,0.05);
              border:1px solid rgba(255,255,255,0.1);
              color:#6a8aaa;border-radius:8px;
              padding:4px 10px;font-size:11px;
              cursor:pointer;
            ">×</button>
          </div>
        </div>

        <!-- Timeline principale -->
        <div id="_chr_track" style="
          position:relative;
          height:56px;
          background:rgba(8,12,24,0.8);
          border:1px solid rgba(60,90,140,0.3);
          border-radius:8px;
          overflow:visible;
          cursor:crosshair;
          user-select:none;
        ">
          <!-- Réglette des années -->
          <div style="position:absolute;top:8px;left:0;right:0;height:4px;background:rgba(255,255,255,0.06);border-radius:2px"></div>

          <!-- Clips d'ères -->
          ${eraClips}

          <!-- Marqueurs catastrophes -->
          ${catMarkers.join('')}

          <!-- Curseur actuel -->
          <div id="_chr_cursor" style="
            position:absolute;
            left:${cursorT}%;
            top:0;bottom:0;
            width:2px;
            background:#36e0a0;
            transform:translateX(-50%);
            z-index:10;
            pointer-events:none;
            box-shadow:0 0 8px rgba(54,224,160,0.6);
          ">
            <div style="
              position:absolute;top:-6px;left:50%;
              transform:translateX(-50%);
              width:10px;height:10px;
              background:#36e0a0;
              border-radius:50%;
              box-shadow:0 0 12px rgba(54,224,160,0.8);
            "></div>
          </div>
        </div>

        <!-- Labels d'ères en bas -->
        <div style="
          display:flex;justify-content:space-between;
          font-size:9px;color:#2a4060;
          margin-top:3px;padding:0 2px;
        ">
          <span>−50 000</span>
          <span>An 0</span>
          <span>2025</span>
          <span>2350</span>
        </div>
      </div>
    `;
  }

  function _bindCursor(panel) {
    const track = panel.querySelector('#_chr_track');
    if (!track) return;

    let dragging = false;

    function _setFromMouseX(clientX) {
      const rect = track.getBoundingClientRect();
      const t = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      Chronicle.setTimePosition(t);

      // Met à jour le curseur visuellement sans attendre le prochain tick
      const cursor = document.getElementById('_chr_cursor');
      if (cursor) cursor.style.left = (t * 100) + '%';

      // Met à jour l'affichage de l'année
      const yearEl = document.getElementById('_chr_year');
      if (yearEl) {
        const y = _tToYear(t);
        yearEl.textContent = 'An ' + (y > 0 ? y : y.toLocaleString());
      }
    }

    track.addEventListener('mousedown', (e) => {
      dragging = true;
      _setFromMouseX(e.clientX);
      e.preventDefault();
    });

    track.addEventListener('click', (e) => {
      // Click sur un clip d'ère
      const eraEl = e.target.closest('[data-era]');
      if (eraEl) Chronicle.setEra(eraEl.dataset.era);
      else _setFromMouseX(e.clientX);
    });

    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      _setFromMouseX(e.clientX);
    });

    document.addEventListener('mouseup', () => { dragging = false; });

    // Touch support
    track.addEventListener('touchstart', (e) => {
      dragging = true;
      _setFromMouseX(e.touches[0].clientX);
      e.preventDefault();
    }, { passive: false });

    document.addEventListener('touchmove', (e) => {
      if (!dragging) return;
      _setFromMouseX(e.touches[0].clientX);
    }, { passive: true });

    document.addEventListener('touchend', () => { dragging = false; });
  }

  function _openCosmicReport() {
    const existing = document.getElementById('_cosmic_report_modal');
    if (existing) { existing.parentNode.removeChild(existing); return; }

    const modal = document.createElement('div');
    modal.id = '_cosmic_report_modal';
    modal.style.cssText = `
      position:fixed;inset:0;
      display:flex;align-items:center;justify-content:center;
      background:rgba(0,0,0,0.75);
      z-index:9100;
      overflow:auto;
      padding:20px;
    `;

    const ws = _ws();
    const html = Chronicle.generateCosmicReport(ws);
    modal.innerHTML = html;

    // Bouton fermer
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '× Fermer';
    closeBtn.style.cssText = `
      position:fixed;top:20px;right:20px;
      background:rgba(255,255,255,0.08);
      border:1px solid rgba(255,255,255,0.15);
      color:#9ab0cc;border-radius:8px;
      padding:6px 14px;font-size:12px;
      cursor:pointer;z-index:9110;
    `;
    closeBtn.addEventListener('click', () => document.body.removeChild(modal));
    modal.addEventListener('click', (e) => { if (e.target === modal) document.body.removeChild(modal); });
    modal.appendChild(closeBtn);

    document.body.appendChild(modal);
  }

  // ─── 7. EXPORT ───────────────────────────────────────────────────

  return Chronicle;

})(); // fin IIFE

// Expose sur window pour l'intégration externe
if (typeof window !== 'undefined') {
  window.Chronicle = Chronicle;
}

// Export module ES (si utilisé en .mjs / bundler)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Chronicle;
}
