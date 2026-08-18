// Source de vérité runtime pour les contrôles tactiles de Nano Worlds.
// Lit le champion promu touch_controls (evolution/champions/runtime/touch_controls.champion.json)
// et fournit un mapper fail-safe pour le joystick de monde3d.html.

export const TOUCH_DEFAULTS = {
  steerDeadzone: 0.08,
  steerExpo: 1.35,
  steerSmoothing: 0.32,
  throttleDeadzone: 0.06,
  throttleExpo: 1.15,
  throttleSmoothing: 0.40,
  throttleReleaseLag: 0.12,
};

const TOUCH_BOUNDS = {
  steerDeadzone: [0.0, 0.22],
  steerExpo: [0.65, 2.40],
  steerSmoothing: [0.12, 0.85],
  throttleDeadzone: [0.0, 0.20],
  throttleExpo: [0.65, 2.20],
  throttleSmoothing: [0.14, 0.90],
  throttleReleaseLag: [0.0, 0.45],
};

const LEGACY_JOYSTICK = {
  deadzone: 0.26,
  smoothing: 1,
  expo: 1,
  releaseLag: 0,
};

const RUNTIME_TOUCH = {
  applied: 0,
  version: null,
  source: 'defaults',
  error: null,
  profile: { ...TOUCH_DEFAULTS },
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function applyTouchParams(params) {
  let n = 0;
  const next = { ...TOUCH_DEFAULTS };
  for (const [k, [lo, hi]] of Object.entries(TOUCH_BOUNDS)) {
    const v = params && params[k];
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    next[k] = clamp(v, lo, hi);
    n++;
  }
  RUNTIME_TOUCH.profile = next;
  return n;
}

export function getRuntimeTouchInfo() {
  return {
    applied: RUNTIME_TOUCH.applied,
    version: RUNTIME_TOUCH.version,
    source: RUNTIME_TOUCH.source,
    error: RUNTIME_TOUCH.error,
    profile: { ...RUNTIME_TOUCH.profile },
  };
}

export async function loadTouchRuntimeChampion({ basePath = '.', engine = 'cannon', fetchImpl = (typeof fetch !== 'undefined' ? fetch : null) } = {}) {
  RUNTIME_TOUCH.source = 'defaults';
  RUNTIME_TOUCH.error = null;
  RUNTIME_TOUCH.applied = 0;
  RUNTIME_TOUCH.version = null;
  RUNTIME_TOUCH.profile = { ...TOUCH_DEFAULTS };
  if (!fetchImpl) return getRuntimeTouchInfo();
  try {
    const ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    const to = ctl ? setTimeout(() => ctl.abort(), 2500) : null;
    const r = await fetchImpl(`${basePath}/evolution/champions/runtime/touch_controls.champion.json`, { cache: 'no-store', ...(ctl ? { signal: ctl.signal } : {}) });
    if (to) clearTimeout(to);
    if (!r || !r.ok) return getRuntimeTouchInfo();
    const ch = await r.json();
    const engineOk = String(ch && ch.engine || '').toLowerCase().startsWith('cannon') && engine === 'cannon';
    if (ch && ch.schema === 'runtime-champion/v1' && ch.system === 'touch_controls' && engineOk && ch.params) {
      RUNTIME_TOUCH.applied = applyTouchParams(ch.params);
      RUNTIME_TOUCH.version = ch.version;
      RUNTIME_TOUCH.source = 'champion';
    } else {
      RUNTIME_TOUCH.source = (engine !== 'cannon') ? 'engine-mismatch' : 'invalid';
    }
  } catch (e) {
    RUNTIME_TOUCH.source = 'error';
    RUNTIME_TOUCH.error = String(e && e.message || e).slice(0, 80);
  }
  return getRuntimeTouchInfo();
}

function mapAxis(x, deadzone, expo) {
  const s = Math.sign(x), a = Math.abs(x);
  if (a <= deadzone) return 0;
  const n = (a - deadzone) / Math.max(1e-6, 1 - deadzone);
  return s * Math.pow(clamp(n, 0, 1), expo);
}

export function createTouchMapper() {
  let steer = 0;
  let throttle = 0;
  return {
    update({ ax = 0, ay = 0 } = {}) {
      const p = RUNTIME_TOUCH.profile;
      const rawSteer = mapAxis(ax, p.steerDeadzone, p.steerExpo);
      const rawThrottle = mapAxis(-ay, p.throttleDeadzone, p.throttleExpo);
      const rawReverse = mapAxis(ay, p.throttleDeadzone, p.throttleExpo);
      steer += (rawSteer - steer) * p.steerSmoothing;
      const targetThrottle = rawThrottle > throttle ? rawThrottle : Math.max(rawThrottle, throttle * p.throttleReleaseLag);
      throttle += (targetThrottle - throttle) * p.throttleSmoothing;
      return {
        steer,
        throttle,
        reverse: rawReverse,
        left: steer < -0.5,
        right: steer > 0.5,
        up: throttle > 0.5,
        down: rawReverse > 0.5,
      };
    },
    reset() {
      steer = 0;
      throttle = 0;
    },
  };
}

export function createLegacyTouchMapper() {
  let steer = 0;
  let throttle = 0;
  return {
    update({ ax = 0, ay = 0 } = {}) {
      const left = ax < -LEGACY_JOYSTICK.deadzone;
      const right = ax > LEGACY_JOYSTICK.deadzone;
      const up = ay < -LEGACY_JOYSTICK.deadzone;
      const down = ay > LEGACY_JOYSTICK.deadzone;
      steer = left ? -1 : right ? 1 : 0;
      throttle = up ? 1 : 0;
      return { steer, throttle, reverse: down ? 1 : 0, left, right, up, down };
    },
    reset() {
      steer = 0;
      throttle = 0;
    },
  };
}
