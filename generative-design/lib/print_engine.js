/* ============================================================================
 * PRINT ENGINE — profils imprimantes, estimations, export STL/3MF (PUR JS)
 * ----------------------------------------------------------------------------
 * General Engine reste l'autorité géométrie. Le Print Engine prépare la
 * FABRICATION : choix imprimante, vérif volume plateau, estimation
 * poids/temps/coût, export STL (binaire) et 3MF (zip réel). Sans dépendance.
 * Le slicing G-code réel nécessite un slicer (cf. printer_hub / fallback).
 * ==========================================================================*/

export const PRINTERS = {
  bambu_a1:     { name:"Bambu Lab A1",      bed:[256,256,256], nozzle:0.4, ams:true,  conn:"bambu" },
  bambu_a1mini: { name:"Bambu Lab A1 mini", bed:[180,180,180], nozzle:0.4, ams:true,  conn:"bambu" },
  bambu_p1s:    { name:"Bambu Lab P1S",     bed:[256,256,256], nozzle:0.4, ams:true,  conn:"bambu" },
  bambu_x1c:    { name:"Bambu Lab X1 Carbon",bed:[256,256,256],nozzle:0.4, ams:true,  conn:"bambu" },
  creality_ender3: { name:"Creality Ender-3", bed:[220,220,250], nozzle:0.4, ams:false, conn:"octoprint" },
  creality_k1:  { name:"Creality K1",       bed:[220,220,250], nozzle:0.4, ams:false, conn:"moonraker" },
  prusa_mk4:    { name:"Prusa MK4",         bed:[250,210,220], nozzle:0.4, ams:false, conn:"prusalink" },
  prusa_mini:   { name:"Prusa MINI+",       bed:[180,180,180], nozzle:0.4, ams:false, conn:"prusalink" },
  anycubic_kobra2: { name:"Anycubic Kobra 2", bed:[220,220,250], nozzle:0.4, ams:false, conn:"octoprint" },
  klipper_generic: { name:"Klipper générique", bed:[220,220,250], nozzle:0.4, ams:false, conn:"moonraker" },
  octoprint_generic:{ name:"OctoPrint générique",bed:[220,220,250],nozzle:0.4,ams:false, conn:"octoprint" },
};

// Base matériaux unique (lot P0 audit 22/10/2026) : app/materiaux.json via materiaux.js (généré).
import { IMPRIMABLES, SOURCE as MATERIALS_SOURCE } from './materiaux.js?v=d793142f';
export { MATERIALS_SOURCE };
export const MATERIALS = Object.fromEntries(Object.entries(IMPRIMABLES).map(([k, m]) =>
  [k, { density: m.densite_g_cm3, nozzleC: m.buse_C, bedC: m.plateau_C, priceKg: m.prix_eur_kg, label: m.nom }]));

/** Estimation poids / temps / coût + tient sur le plateau ?  */
export function estimate(meta, printerKey="bambu_a1", materialKey="PLA", opts={}) {
  const pr = PRINTERS[printerKey] || PRINTERS.bambu_a1;
  const mat = MATERIALS[materialKey] || MATERIALS.PLA;
  const vol = meta.materialVolumeMm3 || 0;             // mm³ de matière (paroi+base)
  const weightG = vol / 1000 * mat.density;            // cm³ * g/cm³
  const costEur = weightG / 1000 * mat.priceKg;
  // temps : débit volumétrique effectif ~10 mm³/s (paroi fine FDM), +15% marges
  const flow = opts.flow || 10;
  const timeMin = (vol / flow) / 60 * 1.15;
  const s = meta.bbox ? meta.bbox.size : [0,0,0];
  const fits = s[0] <= pr.bed[0] && s[1] <= pr.bed[2] && s[2] <= pr.bed[1]; // y = hauteur Z
  const bedUsage = Math.round(Math.max(s[0]/pr.bed[0], s[2]/pr.bed[1]) * 100);
  return {
    printer: pr.name, material: mat.label,
    weightG: Math.round(weightG), costEur: +costEur.toFixed(2),
    timeMin: Math.round(timeMin), timeH: +(timeMin/60).toFixed(1),
    fits, bedUsage, nozzleC: mat.nozzleC, bedC: mat.bedC,
    bed: pr.bed, sizeMm: s.map(x=>+x.toFixed(1)),
    note: fits ? "" : `⚠️ La pièce (${s.map(x=>Math.round(x)).join("×")} mm) dépasse le plateau ${pr.bed.join("×")} mm.`,
  };
}

// --------------------------------------------------------------- STL binaire
export function buildSTL(mesh) {
  const tris = mesh.tris, V = mesh.V;
  const buf = new ArrayBuffer(84 + tris.length * 50);
  const dv = new DataView(buf);
  dv.setUint32(80, tris.length, true);
  let o = 84;
  const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
  for (const t of tris){
    const A=V[t[0]],B=V[t[1]],C=V[t[2]];
    const u=sub(B,A),v=sub(C,A);
    let nx=u[1]*v[2]-u[2]*v[1], ny=u[2]*v[0]-u[0]*v[2], nz=u[0]*v[1]-u[1]*v[0];
    const l=Math.hypot(nx,ny,nz)||1; nx/=l;ny/=l;nz/=l;
    dv.setFloat32(o,nx,true);dv.setFloat32(o+4,ny,true);dv.setFloat32(o+8,nz,true);o+=12;
    for (const P of [A,B,C]){ dv.setFloat32(o,P[0],true);dv.setFloat32(o+4,P[1],true);dv.setFloat32(o+8,P[2],true);o+=12; }
    dv.setUint16(o,0,true); o+=2;
  }
  return new Uint8Array(buf);
}

// --------------------------------------------------------------- 3MF (zip réel, méthode "store")
function crc32(bytes){
  let c, table=crc32.t || (crc32.t=(()=>{const t=[];for(let n=0;n<256;n++){c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})());
  let crc=0xFFFFFFFF; for(let i=0;i<bytes.length;i++)crc=(crc>>>8)^table[(crc^bytes[i])&0xFF]; return (crc^0xFFFFFFFF)>>>0;
}
function strBytes(s){ return new TextEncoder().encode(s); }
function zipStore(files){ // files: [{name, data:Uint8Array}]
  const chunks=[], central=[]; let offset=0;
  const u16=v=>[v&0xFF,(v>>8)&0xFF], u32=v=>[v&0xFF,(v>>8)&0xFF,(v>>16)&0xFF,(v>>24)&0xFF];
  for(const f of files){
    const name=strBytes(f.name), crc=crc32(f.data), sz=f.data.length;
    const local=[0x50,0x4b,0x03,0x04,...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),
      ...u32(crc),...u32(sz),...u32(sz),...u16(name.length),...u16(0)];
    chunks.push(new Uint8Array(local), name, f.data);
    central.push([0x50,0x4b,0x01,0x02,...u16(20),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),
      ...u32(crc),...u32(sz),...u32(sz),...u16(name.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset)]);
    offset += local.length+name.length+sz;
    central[central.length-1]._name=name;
  }
  const cd=[]; let cdSize=0;
  for(let i=0;i<central.length;i++){ const arr=new Uint8Array(central[i]); cd.push(arr,central[i]._name); cdSize+=arr.length+central[i]._name.length; }
  const cdOffset=offset;
  const eocd=new Uint8Array([0x50,0x4b,0x05,0x06,...u16(0),...u16(0),...u16(files.length),...u16(files.length),
    ...u32(cdSize),...u32(cdOffset),...u16(0)]);
  const all=[...chunks,...cd,eocd]; let tot=0; all.forEach(a=>tot+=a.length);
  const out=new Uint8Array(tot); let p=0; all.forEach(a=>{out.set(a,p);p+=a.length;}); return out;
}
export function build3MF(mesh){
  const V=mesh.V, tris=mesh.tris;
  let vx=""; for(const v of V) vx+=`<vertex x="${v[0].toFixed(4)}" y="${v[1].toFixed(4)}" z="${v[2].toFixed(4)}"/>`;
  let tx=""; for(const t of tris) tx+=`<triangle v1="${t[0]}" v2="${t[1]}" v3="${t[2]}"/>`;
  const model=`<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
<resources><object id="1" type="model"><mesh><vertices>${vx}</vertices><triangles>${tx}</triangles></mesh></object></resources>
<build><item objectid="1"/></build></model>`;
  const ct=`<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>`;
  const rels=`<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>`;
  return zipStore([
    { name:"[Content_Types].xml", data:strBytes(ct) },
    { name:"_rels/.rels", data:strBytes(rels) },
    { name:"3D/3dmodel.model", data:strBytes(model) },
  ]);
}

// --------------------------------------------------------------- OBJ (texte)
export function buildOBJ(mesh){
  let s="# GENERAL DESIGN STUDIO export (mm)\n";
  mesh.V.forEach(v=>s+=`v ${v[0].toFixed(4)} ${v[1].toFixed(4)} ${v[2].toFixed(4)}\n`);
  mesh.tris.forEach(t=>s+=`f ${t[0]+1} ${t[1]+1} ${t[2]+1}\n`); return s;
}

// --------------------------------------------------------------- téléchargement (navigateur)
export function download(name, data, mime="application/octet-stream"){
  const blob = data instanceof Uint8Array ? new Blob([data],{type:mime}) : new Blob([data],{type:mime});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; a.click();
}

export default { PRINTERS, MATERIALS, estimate, buildSTL, build3MF, buildOBJ, download };
