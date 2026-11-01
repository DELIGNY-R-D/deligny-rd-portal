/* ============================================================================
 * CONSTATS — format unique de fabricabilité, côté navigateur (lot F1, 22/10/2026)
 * ----------------------------------------------------------------------------
 * Miroir de app/constats.py. Un constat : { id, severity (HARD|SOFT|OPT), source
 * (canon|juge|orientation), target, msg, suggestion, mesure }.
 *  - depuisCanon(resultat)        : sortie de /api/constrain ou engineering_canon.validate_params
 *  - depuisJuge(rapport)          : report.json du juge (findings avec level/id/msg)
 *  - depuisOrientation(resultat)  : sortie de geometrie.js orOptimize + orEval de l'orientation actuelle
 *  - fusionner(...listes), verdict(constats)
 * ==========================================================================*/

const ORDRE = { HARD: 0, SOFT: 1, OPT: 2 };
const SEVERITE_JUGE = { FAIL: 'HARD', WARN: 'SOFT' };

export function depuisCanon(resultat, cible = 'parametres') {
  return (resultat?.violations || []).map(v => ({
    id: v.id, severity: v.severity || 'SOFT', source: 'canon', target: cible,
    msg: v.name || v.description || '', suggestion: v.suggestion || '',
    mesure: resultat.corrections && v.auto_correct ? { auto_correct: resultat.corrections } : {},
  }));
}

export function depuisJuge(rapport) {
  const pieces = rapport?.parts || [];
  return (rapport?.findings || []).map(f => {
    const cible = f.target ?? (f.msg && f.msg.includes(':') ? f.msg.split(':')[0].trim() : null);
    const p = pieces.find(x => x.part === cible) || {};
    const mesure = {};
    for (const k of ['non_manifold_edges', 't_seam_edges', 'overhang_area_pct', 'bbox_mm']) if (k in p) mesure[k] = p[k];
    return { id: f.id || 'JUDGE', severity: f.severity || SEVERITE_JUGE[f.level] || 'SOFT', source: 'juge', target: cible, msg: f.msg, suggestion: '', mesure };
  });
}

/** resultat = { actuelle: orEval(...), optimisation: orOptimize(...) } ; la meilleure orientation est
 *  cherchée sous best, meilleure, choix ou en tête des candidats. */
export function depuisOrientation(resultat, seuilPct = 5) {
  const act = resultat?.actuelle || {};
  const opt = resultat?.optimisation || resultat || {};
  const best = opt.best || opt.meilleure || opt.choix || (opt.candidates || opt.candidats || [])[0] || {};
  const po = act.pctOver, pb = best.pctOver;
  const out = [];
  if (po != null && po > seuilPct) {
    out.push({ id: 'ORIENT-SUPPORTS', severity: 'SOFT', source: 'orientation', target: 'piece',
      msg: `${po.toFixed(1)} % de surface en surplomb dans l'orientation actuelle`,
      suggestion: pb != null && pb < po - 0.5 ? `réorienter (${best.nom || '?'}) : ${pb.toFixed(1)} % de surplomb` : 'ajouter des supports',
      mesure: { pctOver_actuelle: po, pctOver_meilleure: pb, orientation: best.nom } });
  }
  if (pb != null && po != null && pb < po - 0.5) {
    out.push({ id: 'ORIENT-MEILLEURE', severity: 'OPT', source: 'orientation', target: 'piece',
      msg: `une orientation réduit le surplomb de ${po.toFixed(1)} % à ${pb.toFixed(1)} %`,
      suggestion: `imprimer selon « ${best.nom || '?'} »`, mesure: { orientation: best.nom, pctOver: pb } });
  }
  return out;
}

export function fusionner(...listes) {
  return listes.flat().filter(Boolean).sort((a, b) => (ORDRE[a.severity] ?? 3) - (ORDRE[b.severity] ?? 3) || (a.source || '').localeCompare(b.source || '') || (a.id || '').localeCompare(b.id || ''));
}

export function verdict(constats) {
  const s = new Set(constats.map(c => c.severity));
  return s.has('HARD') ? 'FAIL' : (s.has('SOFT') ? 'WARN' : 'PASS');
}

export default { depuisCanon, depuisJuge, depuisOrientation, fusionner, verdict };
