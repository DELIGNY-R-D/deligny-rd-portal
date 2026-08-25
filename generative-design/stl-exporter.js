/* STLExporter minimal (STL ASCII).
 *
 * three/addons/exporters/STLExporter.js n'est pas dans le vendor local du
 * portail, et la doctrine du site interdit d'aller le chercher sur un CDN
 * (CSP : default-src 'none'). Le studio n'appelle que parse(mesh,{binary:false}) ;
 * on implemente donc exactement ce contrat, rien de plus.
 *
 * STL ASCII : une facette par triangle, avec sa normale et ses trois sommets,
 * exprimes dans le repere MONDE (d'ou l'application de matrixWorld).
 */
import * as THREE from 'three';

export class STLExporter {
  parse(objet, options = {}) {
    if (options.binary) throw new Error('STL binaire non gere par cet exporteur');
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    const ab = new THREE.Vector3(), ac = new THREE.Vector3(), n = new THREE.Vector3();
    const nm = new THREE.Matrix3();
    let out = 'solid exported\n';

    objet.updateMatrixWorld(true);
    objet.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
      const p = g.attributes.position;
      if (!p) return;
      nm.getNormalMatrix(o.matrixWorld);
      for (let i = 0; i < p.count; i += 3) {
        a.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
        b.fromBufferAttribute(p, i + 1).applyMatrix4(o.matrixWorld);
        c.fromBufferAttribute(p, i + 2).applyMatrix4(o.matrixWorld);
        // Normale recalculee depuis la geometrie transformee : une normale
        // stockee devient fausse des que l'objet porte une echelle non uniforme.
        ab.subVectors(b, a); ac.subVectors(c, a); n.crossVectors(ab, ac).normalize();
        if (!isFinite(n.x) || !isFinite(n.y) || !isFinite(n.z)) n.set(0, 0, 0);
        out += `facet normal ${n.x} ${n.y} ${n.z}\n outer loop\n`;
        out += `  vertex ${a.x} ${a.y} ${a.z}\n`;
        out += `  vertex ${b.x} ${b.y} ${b.z}\n`;
        out += `  vertex ${c.x} ${c.y} ${c.z}\n`;
        out += ' endloop\nendfacet\n';
      }
    });
    return out + 'endsolid exported\n';
  }
}
