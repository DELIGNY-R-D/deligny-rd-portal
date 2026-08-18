// Source de vérité runtime pour la caméra pilotée de Nano Worlds.
// Lit le champion promu camera_follow (evolution/champions/runtime/camera.champion.json)
// et expose un profil fail-safe pour monde3d.html. Artefact absent/invalide => valeurs par défaut.

export const CAMERA_DEFAULTS = {
  dist: 17,
  pitch: 0.42,
  targetLerp: 0.10,
  posLerp: 0.18,
  height: 0.6,
};

const CAMERA_BOUNDS = {
  dist: [10, 26],
  pitch: [0.15, 0.75],
  targetLerp: [0.04, 0.35],
  posLerp: [0.06, 0.40],
  height: [0.0, 2.0],
};
const MONDE3D_CHASE_DEFAULTS = {
  posLerp: 0.22,
  targetLerp: 0.26,
};

const RUNTIME_CAMERA = {
  applied: 0,
  version: null,
  source: 'defaults',
  error: null,
  profile: { ...CAMERA_DEFAULTS },
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function applyCameraParams(params) {
  let n = 0;
  const next = { ...CAMERA_DEFAULTS };
  for (const [k, [lo, hi]] of Object.entries(CAMERA_BOUNDS)) {
    const v = params && params[k];
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    next[k] = clamp(v, lo, hi);
    n++;
  }
  RUNTIME_CAMERA.profile = next;
  return n;
}

export function getRuntimeCameraInfo() {
  return {
    applied: RUNTIME_CAMERA.applied,
    version: RUNTIME_CAMERA.version,
    source: RUNTIME_CAMERA.source,
    error: RUNTIME_CAMERA.error,
    profile: { ...RUNTIME_CAMERA.profile },
  };
}

export function getRuntimeCameraProfile() {
  return { ...RUNTIME_CAMERA.profile };
}

export async function loadCameraRuntimeChampion({ basePath = '.', engine = 'cannon', fetchImpl = (typeof fetch !== 'undefined' ? fetch : null) } = {}) {
  RUNTIME_CAMERA.source = 'defaults';
  RUNTIME_CAMERA.error = null;
  RUNTIME_CAMERA.applied = 0;
  RUNTIME_CAMERA.version = null;
  RUNTIME_CAMERA.profile = { ...CAMERA_DEFAULTS };
  if (!fetchImpl) return getRuntimeCameraInfo();
  try {
    const ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    const to = ctl ? setTimeout(() => ctl.abort(), 2500) : null;
    const r = await fetchImpl(`${basePath}/evolution/champions/runtime/camera.champion.json`, { cache: 'no-store', ...(ctl ? { signal: ctl.signal } : {}) });
    if (to) clearTimeout(to);
    if (!r || !r.ok) return getRuntimeCameraInfo();
    const ch = await r.json();
    const engineOk = String(ch && ch.engine || '').toLowerCase().startsWith('cannon') && engine === 'cannon';
    if (ch && ch.schema === 'runtime-champion/v1' && ch.system === 'camera' && engineOk && ch.params) {
      RUNTIME_CAMERA.applied = applyCameraParams(ch.params);
      RUNTIME_CAMERA.version = ch.version;
      RUNTIME_CAMERA.source = 'champion';
    } else {
      RUNTIME_CAMERA.source = (engine !== 'cannon') ? 'engine-mismatch' : 'invalid';
    }
  } catch (e) {
    RUNTIME_CAMERA.source = 'error';
    RUNTIME_CAMERA.error = String(e && e.message || e).slice(0, 80);
  }
  return getRuntimeCameraInfo();
}

// Convertit le profil arène (orbite caméra) vers les réglages chaseCam de monde3d.
// Le runtime reste volontairement conservateur : il scale distance/hauteur et remplace seulement les lerps.
export function buildChaseCameraRuntime({ dist, h, tlift }) {
  const p = RUNTIME_CAMERA.profile;
  const distScale = p.dist / CAMERA_DEFAULTS.dist;
  const pitchDelta = p.pitch - CAMERA_DEFAULTS.pitch;
  const heightDelta = p.height - CAMERA_DEFAULTS.height;
  return {
    dist: dist * distScale,
    h: h + heightDelta + Math.sin(pitchDelta) * Math.max(1, dist) * 0.7,
    tlift: tlift + heightDelta * 0.5,
    posLerp: clamp(MONDE3D_CHASE_DEFAULTS.posLerp * (p.posLerp / CAMERA_DEFAULTS.posLerp), 0.04, 0.60),
    targetLerp: clamp(MONDE3D_CHASE_DEFAULTS.targetLerp * (p.targetLerp / CAMERA_DEFAULTS.targetLerp), 0.04, 0.70),
  };
}
