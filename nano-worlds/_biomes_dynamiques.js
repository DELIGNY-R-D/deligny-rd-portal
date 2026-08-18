// ═══════════════════════════════════════════════════════════════════
// BIOMES DYNAMIQUES — reagit aux changements WSAgg.climate
// sans reinitialiser les entites (voitures, batiments, PNJ restent)
//
// INTEGRATION : <script src="_biomes_dynamiques.js"></script>
// apres _worldstate_module.js, avant </body>
//
// USAGE :
//   BiomesDynamiques.tick()          // verif + applique si changement
//   BiomesDynamiques.openUI()        // panel de controle
//   BiomesDynamiques.closeUI()       // ferme le panel
//   BiomesDynamiques.forceApply()    // applique sans attendre le seuil
//
// Compatible avec WSAgg (window.WSAgg expose WorldState depuis
// _worldstate_module.js — cf. ligne finale du module).
// ═══════════════════════════════════════════════════════════════════

const BiomesDynamiques = (function () {

  // ─────────────────────────────────────────────────────────────────
  // CONFIGURATION
  // ─────────────────────────────────────────────────────────────────

  // Seuils de changement pour declencher une mise a jour visuelle
  const TEMP_THRESHOLD = 0.5;   // degres C
  const RAIN_THRESHOLD = 0.02;  // 0..1

  // Paliers climatiques
  const TEMP_FREEZE   =  2;   // en dessous : neige possible
  const TEMP_COLD     = 10;   // en dessous : monde froid (pas de neige complete)
  const TEMP_HOT      = 28;   // au dessus  : desert chaud
  const RAIN_ARID     = 0.2;  // en dessous : aride / sable
  const RAIN_TROPICAL = 0.75; // au dessus  : tropical

  // Rayon de depot de neige (en metres monde)
  // Passe repetees accumulent -> 0.5 par passe (voir paintSnow)
  const SNOW_RADIUS_FULL  = 100; // couverture totale de la carte
  const SNOW_RADIUS_LIGHT =  45; // couverture partielle (gel leger)
  const SNOW_PASSES_MAX   =   4; // passes max pour couverture saturee

  // ─────────────────────────────────────────────────────────────────
  // ETAT INTERNE
  // ─────────────────────────────────────────────────────────────────

  let _lastTemp = null;
  let _lastRain = null;
  let _snowState = 'none';  // 'none' | 'light' | 'heavy'
  let _tintState = 'none';  // derniere valeur appliquee

  // ─────────────────────────────────────────────────────────────────
  // LECTURE DU CLIMAT
  // ─────────────────────────────────────────────────────────────────

  function _getWS() {
    // WSAgg est expose par _worldstate_module.js via window.WSAgg
    if (typeof WSAgg !== 'undefined') return WSAgg;
    // Fallback : si le module est charge sous un autre nom
    if (typeof WorldState !== 'undefined') return WorldState;
    return null;
  }

  function _getClimate() {
    const ws = _getWS();
    if (!ws) return null;
    return {
      temp: ws.get('climate.temp')      !== undefined ? ws.get('climate.temp')      : 15,
      rain: ws.get('climate.rainfall')  !== undefined ? ws.get('climate.rainfall')  : 0.5
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // ACCES AUX INTERNALS DE monde3d
  // ─────────────────────────────────────────────────────────────────
  // __M est l'objet expose par monde3d.html (window.__M).
  // Les fonctions de neige (snowDressAll, clearSnowCover) sont des
  // globals de la closure — on les appelle par leur nom si disponibles.

  function _M() { return window.__M || null; }

  // Marque le terrain a reconstruire (sans rebuild complet)
  function _dirtyTerrain() {
    const M = _M();
    if (M) M.terrainDirty = true;
  }

  // Peint la neige en plusieurs passes centrees sur (0,0)
  function _applySnowFull(passes) {
    const M = _M();
    if (!M || typeof M.paintSnow !== 'function') return;
    for (let i = 0; i < passes; i++) {
      M.paintSnow(0, 0, SNOW_RADIUS_FULL);
    }
  }

  function _applySnowLight(passes) {
    const M = _M();
    if (!M || typeof M.paintSnow !== 'function') return;
    for (let i = 0; i < passes; i++) {
      M.paintSnow(0, 0, SNOW_RADIUS_LIGHT);
    }
  }

  // Efface toute la neige (ne touche pas MUD/RUT — garde les ornières)
  // clearSnowCover() est une global de monde3d : on l'appelle si dispo
  function _clearSnow() {
    const M = _M();
    if (!M) return;
    // clearSnowCover() efface snowCov + snowGroup (calottes veg/batiments)
    // Elle efface aussi sandCov et MUD — dangereux si terrain modifie.
    // On ne reset que snowCov directement via le Float32Array expose.
    const sc = M.snowCov;
    if (sc && sc.fill) {
      sc.fill(0);
      // Retire les calottes de neige du snowGroup
      const sg = M.snowGroup;
      if (sg) {
        while (sg.children.length) sg.remove(sg.children[0]);
      }
      // Reset _snowCap sur la vegetation pour permettre un re-depot
      ['treeData', 'leafyData', 'bushData'].forEach(function (key) {
        const arr = M[key];
        if (arr) arr.forEach(function (d) { d._snowCap = 0; d._snowCapMesh = null; });
      });
      if (M.floraExtra) {
        M.floraExtra.forEach(function (e) { e._snowCap = 0; e._snowCapMesh = null; });
      }
      _dirtyTerrain();
    }
  }

  // Depose les calottes de neige sur toute la vegetation
  // snowDressAll() est une global de monde3d
  function _snowDressAll() {
    if (typeof snowDressAll === 'function') {
      snowDressAll();
    } else {
      // Fallback si la global n'est pas accessible : appel via __M.paintSnow
      // qui pose les calottes dans son propre perimetre
      _applySnowFull(1);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // LOGIQUE BIOME
  // ─────────────────────────────────────────────────────────────────

  // Calcule la cible biome selon la temperature et la pluie
  function _biomeTarget(temp, rain) {
    if (temp < TEMP_FREEZE)              return 'snow_heavy';
    if (temp < TEMP_COLD && rain < 0.5)  return 'snow_light';
    if (temp > TEMP_HOT && rain < 0.4)   return 'desert';
    if (rain < RAIN_ARID)                return 'arid';
    if (rain > RAIN_TROPICAL && temp > 18) return 'tropical';
    return 'temperate';
  }

  // Applique la transition de neige
  function _transitionSnow(target, prev) {
    const nowHeavy  = target === 'snow_heavy';
    const nowLight  = target === 'snow_light';
    const wasSnow   = prev === 'snow_heavy' || prev === 'snow_light';
    const nowSnow   = nowHeavy || nowLight;

    if (!wasSnow && nowHeavy) {
      // Passage au gel fort : depot de neige partout + calottes
      _applySnowFull(SNOW_PASSES_MAX);
      _snowDressAll();
      _snowState = 'heavy';

    } else if (!wasSnow && nowLight) {
      // Passage au gel leger : depot partiel, pas de calottes generales
      _applySnowLight(2);
      _snowState = 'light';

    } else if (wasSnow && !nowSnow) {
      // Degel : efface la neige progressivement
      // On efface la moitie des cellules de neige (fondu partiel)
      _clearSnow();
      _snowState = 'none';

    } else if (prev === 'snow_light' && nowHeavy) {
      // Aggravation : ajoute des passes supplementaires
      _applySnowFull(SNOW_PASSES_MAX - 2);
      _snowDressAll();
      _snowState = 'heavy';

    } else if (prev === 'snow_heavy' && nowLight) {
      // Allegement : efface une partie de snowCov
      _clearSnow();
      _applySnowLight(1);
      _snowState = 'light';
    }
  }

  // Applique le worldTint biome.
  // CONTRAINTE : worldTint est une variable interne a la closure de monde3d.
  // Elle n'a pas de setter dans __M (get seulement).
  // La seule voie propre sans modifier monde3d.html est via window._biomeTintRequest
  // que le code de monde3d peut lire dans sa boucle principale —
  // OU via un event custom si monde3d y souscrit.
  // En l'absence de setter, on stocke la cible et on l'expose.
  function _transitionTint(biomeTarget) {
    // Valeurs valides dans monde3d : 'none' | 'sand' | 'snow' | 'alien' | 'grid' | 'moon' | 'asphalt'
    const tintMap = {
      snow_heavy:  'snow',
      snow_light:  'none',   // gel leger : pas de worldTint snow (juste snowCov)
      desert:      'sand',
      arid:        'none',   // aride : snowCov=0 suffit, pas de tint global
      tropical:    'none',
      temperate:   'none'
    };
    const desired = tintMap[biomeTarget] || 'none';
    if (desired === _tintState) return;

    // Expose la cible pour une integration eventuelle dans la boucle monde3d
    window._biomeTintRequest = desired;
    _tintState = desired;

    // Tente un changement direct si monde3d expose un setter (futur)
    // Pour l'instant, terrainDirty=true force le recalcul des couleurs
    // avec le worldTint COURANT (inchange si pas de setter).
    // L'effet visuel est donc : snowCov blanchit le terrain sans worldTint='snow'
    // ce qui est le comportement correct pour un gel leger.
    _dirtyTerrain();
  }

  // Point d'entree principal : applique le biome pour un climat donne
  function _applyBiome(temp, rain) {
    const target = _biomeTarget(temp, rain);
    const prev   = _biomeTarget(
      _lastTemp !== null ? _lastTemp : temp,
      _lastRain !== null ? _lastRain : rain
    );

    // Transition neige
    _transitionSnow(target, prev);

    // Transition tint
    _transitionTint(target);

    // Mise a jour de la densite de vegetation via _vegMul si accessible.
    // On ne touche pas aux entites existantes — _vegMul agit seulement
    // sur les prochains scatterBiome() ou generate(), pas sur la veg en place.
    // Cela respecte la contrainte "pas de reinitialisation".
    const M = _M();
    if (M && typeof M._worldReal !== 'undefined') {
      if (target === 'desert' || target === 'arid') {
        // En aride, on peut reduire progressivement _worldReal
        // mais on ne touche PAS a la vegetation en place (pas de scatterBiome)
        // => effet sur le prochain monde genere seulement
        window._biomeWorldRealTarget = Math.max(0, (M._worldReal || 0.5) - 0.15);
      } else if (target === 'tropical') {
        window._biomeWorldRealTarget = Math.min(1, (M._worldReal || 0.5) + 0.1);
      } else {
        window._biomeWorldRealTarget = null;
      }
    }

    // Log console (debug)
    console.log('[BiomesDynamiques] temp=' + temp.toFixed(1) + 'C rain=' + rain.toFixed(2)
      + ' => biome=' + target + ' (prev=' + prev + ')'
      + (target !== prev ? ' TRANSITION' : ' stable'));
  }

  // ─────────────────────────────────────────────────────────────────
  // API PUBLIQUE
  // ─────────────────────────────────────────────────────────────────

  // tick() : a appeler depuis la boucle principale ou un setInterval
  function tick() {
    const climate = _getClimate();
    if (!climate) return;

    const tempChanged = _lastTemp === null
      || Math.abs(climate.temp - _lastTemp) >= TEMP_THRESHOLD;
    const rainChanged = _lastRain === null
      || Math.abs(climate.rain - _lastRain) >= RAIN_THRESHOLD;

    if (tempChanged || rainChanged) {
      _applyBiome(climate.temp, climate.rain);
      _lastTemp = climate.temp;
      _lastRain = climate.rain;
    }
  }

  // forceApply() : applique sans verifier le seuil de changement
  function forceApply() {
    const climate = _getClimate();
    if (!climate) return;
    _applyBiome(climate.temp, climate.rain);
    _lastTemp = climate.temp;
    _lastRain = climate.rain;
  }

  // reset() : reinitialise l'etat interne (utile apres un nouveau monde)
  function reset() {
    _lastTemp  = null;
    _lastRain  = null;
    _snowState = 'none';
    _tintState = 'none';
    window._biomeTintRequest      = null;
    window._biomeWorldRealTarget  = null;
  }

  // ─────────────────────────────────────────────────────────────────
  // PANEL UI
  // ─────────────────────────────────────────────────────────────────

  let _uiEl = null;

  function _buildUI() {
    const d = document.createElement('div');
    d.id = 'biomes-panel';
    d.style.cssText = [
      'position:fixed',
      'bottom:68px',
      'right:18px',
      'background:rgba(8,14,10,.90)',
      'border:1px solid #2a5a3a',
      'border-radius:12px',
      'padding:14px 16px',
      'z-index:9999',
      'color:#a0ffcc',
      'font:12px/1.7 monospace',
      'min-width:220px',
      'box-shadow:0 4px 24px rgba(0,0,0,.5)',
      'user-select:none'
    ].join(';');

    d.innerHTML = '<div style="font-size:13px;font-weight:bold;margin-bottom:8px;letter-spacing:.04em">'
      + '&#127807; Biomes Dynamiques'
      + '</div>'
      + '<label style="display:block;margin-bottom:4px">'
      + '  Temp <span id="bd_tv" style="color:#fff;min-width:32px;display:inline-block">15</span> &deg;C'
      + '  <input id="bd_temp" type="range" min="-20" max="40" step="0.5" value="15"'
      + '    style="width:120px;vertical-align:middle;margin-left:4px">'
      + '</label>'
      + '<label style="display:block;margin-bottom:8px">'
      + '  Pluie <span id="bd_rv" style="color:#fff;min-width:32px;display:inline-block">0.50</span>'
      + '  <input id="bd_rain" type="range" min="0" max="100" step="1" value="50"'
      + '    style="width:120px;vertical-align:middle;margin-left:4px">'
      + '</label>'
      + '<div id="bd_status" style="font-size:10px;color:#6adda0;min-height:14px;margin-bottom:8px"></div>'
      + '<div style="display:flex;gap:6px">'
      + '  <button id="bd_apply" style="flex:1;background:#0e2a1a;color:#5aff88;border:1px solid #2a5a2a;border-radius:6px;padding:4px 8px;cursor:pointer;font:11px monospace">Appliquer</button>'
      + '  <button onclick="BiomesDynamiques.closeUI()" style="background:#1a1a2a;color:#88aaff;border:1px solid #2a2a5a;border-radius:6px;padding:4px 8px;cursor:pointer;font:11px monospace">Fermer</button>'
      + '</div>';

    document.body.appendChild(d);

    var ws = _getWS();

    // Synchro initiale avec WSAgg
    if (ws) {
      var t = ws.get('climate.temp');
      var r = ws.get('climate.rainfall');
      if (t !== undefined) {
        document.getElementById('bd_temp').value = t;
        document.getElementById('bd_tv').textContent = Number(t).toFixed(1);
      }
      if (r !== undefined) {
        document.getElementById('bd_rain').value = Math.round(r * 100);
        document.getElementById('bd_rv').textContent = Number(r).toFixed(2);
      }
    }

    document.getElementById('bd_temp').addEventListener('input', function () {
      var v = parseFloat(this.value);
      document.getElementById('bd_tv').textContent = v.toFixed(1);
      var ws2 = _getWS();
      if (ws2) ws2.set('climate.temp', v);
    });

    document.getElementById('bd_rain').addEventListener('input', function () {
      var v = this.value / 100;
      document.getElementById('bd_rv').textContent = v.toFixed(2);
      var ws2 = _getWS();
      if (ws2) ws2.set('climate.rainfall', v);
    });

    document.getElementById('bd_apply').addEventListener('click', function () {
      forceApply();
      var c = _getClimate();
      var status = document.getElementById('bd_status');
      if (c) {
        var biome = _biomeTarget(c.temp, c.rain);
        status.textContent = 'Biome : ' + biome + ' | neige : ' + _snowState;
      }
    });

    return d;
  }

  function openUI() {
    if (!_uiEl) _uiEl = _buildUI();
    _uiEl.style.display = 'block';
  }

  function closeUI() {
    if (_uiEl) _uiEl.style.display = 'none';
  }

  // ─────────────────────────────────────────────────────────────────
  // HOOKS WSAgg — souscription aux changements de climat
  // ─────────────────────────────────────────────────────────────────

  function _subscribeWSAgg() {
    var ws = _getWS();
    if (!ws || typeof ws.onChange !== 'function') return false;

    ws.onChange('climate.temp', function (val) {
      var climate = _getClimate();
      if (!climate) return;
      if (Math.abs(val - (_lastTemp !== null ? _lastTemp : val)) >= TEMP_THRESHOLD) {
        _applyBiome(climate.temp, climate.rain);
        _lastTemp = climate.temp;
        _lastRain = climate.rain;
      }
    });

    ws.onChange('climate.rainfall', function (val) {
      var climate = _getClimate();
      if (!climate) return;
      if (Math.abs(val - (_lastRain !== null ? _lastRain : val)) >= RAIN_THRESHOLD) {
        _applyBiome(climate.temp, climate.rain);
        _lastTemp = climate.temp;
        _lastRain = climate.rain;
      }
    });

    return true;
  }

  // ─────────────────────────────────────────────────────────────────
  // INITIALISATION
  // ─────────────────────────────────────────────────────────────────

  window.addEventListener('load', function () {
    // Tentative de souscription aux observers WSAgg
    var subscribed = _subscribeWSAgg();

    // Fallback : tick toutes les 5 secondes si les observers ne sont pas dispo
    // (biomes changent lentement — pas besoin d'etre dans la boucle 60fps)
    if (!subscribed) {
      setInterval(tick, 5000);
      console.log('[BiomesDynamiques] mode polling (WSAgg.onChange non disponible)');
    } else {
      console.log('[BiomesDynamiques] mode observer WSAgg.onChange actif');
    }

    // Premier tick au boot
    setTimeout(tick, 500);
  });

  // ─────────────────────────────────────────────────────────────────
  // EXPORT
  // ─────────────────────────────────────────────────────────────────

  return {
    tick,
    forceApply,
    reset,
    openUI,
    closeUI,
    // Lecture d'etat (utile pour debug ou Chronicle)
    get snowState()  { return _snowState; },
    get tintState()  { return _tintState; },
    get lastClimate(){ return { temp: _lastTemp, rain: _lastRain }; }
  };

})();

// Expose sous window pour acces depuis la console et les autres modules
window.BiomesDynamiques = BiomesDynamiques;
