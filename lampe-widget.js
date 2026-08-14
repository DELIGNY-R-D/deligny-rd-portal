/* Lampe Designer — vitrine interactive de l'accueil. Moteur independant,
 * pas un extrait de lampe-3d-studio/index.html : ce fichier est modifie en
 * continu par un autre chantier, le dupliquer/le fragmenter maintenant
 * garantirait un conflit. Trois panneaux : profil editable (coupe 2D),
 * coque 3D (lathe du profil, glisse pour tourner), rendu studio (meme
 * maillage, camera fixe) — calcules et rendus 100% dans le navigateur,
 * aucun appel reseau. */
(function(){
  "use strict";
  var pc = document.getElementById('lampeProfileCanvas');
  if(!pc) return;
  var pctx = pc.getContext('2d');
  var vc = document.getElementById('lampePreviewCanvas');
  var vctx = vc.getContext('2d');
  var rc = document.getElementById('lampeRenderCanvas');
  var rctx = rc.getContext('2d');

  // ── Profil : silhouette par defaut, modifiable ────────────────────────
  var HMAX = 190, RMAX = 115;
  var profile = [
    { h: 0,   r: 76 },
    { h: 16,  r: 86 },
    { h: 55,  r: 88 },
    { h: 95,  r: 74 },
    { h: 130, r: 48 },
    { h: 158, r: 37 },
    { h: 176, r: 33 }
  ];

  var pW = pc.width, pH = pc.height;
  var pPadT = 20, pPadB = 34, pPadX = 30;
  var pScale = Math.min((pW/2 - pPadX) / RMAX, (pH - pPadT - pPadB) / HMAX);
  function pMapX(r){ return pW/2 + r * pScale; }
  function pMapY(h){ return pH - pPadB - h * pScale; }
  function pUnmapR(x){ return Math.max(0, Math.abs(x - pW/2) / pScale); }
  function pUnmapH(y){ return Math.min(HMAX, Math.max(0, (pH - pPadB - y) / pScale)); }

  function drawProfile(){
    pctx.clearRect(0, 0, pW, pH);
    pctx.fillStyle = '#ffffff';
    pctx.fillRect(0, 0, pW, pH);

    pctx.strokeStyle = 'rgba(21,19,26,0.08)';
    pctx.fillStyle = 'rgba(21,19,26,0.35)';
    pctx.font = '10px -apple-system, sans-serif';
    pctx.lineWidth = 1;
    for(var mm = 0; mm <= HMAX; mm += 50){
      var y = pMapY(mm);
      pctx.beginPath();
      pctx.moveTo(pPadX * 0.4, y);
      pctx.lineTo(pW - pPadX * 0.4, y);
      pctx.stroke();
      pctx.fillText(mm + ' mm', 4, y - 3);
    }

    pctx.strokeStyle = 'rgba(21,19,26,0.25)';
    pctx.setLineDash([3, 4]);
    pctx.beginPath();
    pctx.moveTo(pW/2, pPadT);
    pctx.lineTo(pW/2, pMapY(0));
    pctx.stroke();
    pctx.setLineDash([]);

    // Silhouette pleine : profil droit, miroir a gauche.
    pctx.beginPath();
    pctx.moveTo(pMapX(-profile[0].r), pMapY(profile[0].h));
    var i;
    for(i = 1; i < profile.length; i++) pctx.lineTo(pMapX(-profile[i].r), pMapY(profile[i].h));
    for(i = profile.length - 1; i >= 0; i--) pctx.lineTo(pMapX(profile[i].r), pMapY(profile[i].h));
    pctx.closePath();
    pctx.fillStyle = 'rgba(124,92,191,0.10)';
    pctx.fill();
    pctx.strokeStyle = 'rgba(21,19,26,0.55)';
    pctx.lineWidth = 1.5;
    pctx.stroke();

    // Points de controle (cote droit, canonique).
    for(i = 0; i < profile.length; i++){
      var x = pMapX(profile[i].r), y = pMapY(profile[i].h);
      pctx.beginPath();
      pctx.arc(x, y, i === dragIndex ? 6 : 5, 0, Math.PI * 2);
      pctx.fillStyle = '#ffffff';
      pctx.fill();
      pctx.strokeStyle = '#7c5cbf';
      pctx.lineWidth = 2;
      pctx.stroke();
    }
  }

  var dragIndex = -1;
  var addedNew = false;

  function nearestIndex(x, y){
    var best = -1, bestD = 12 * 12;
    for(var i = 0; i < profile.length; i++){
      var dx = pMapX(profile[i].r) - x, dy = pMapY(profile[i].h) - y;
      var d = dx*dx + dy*dy;
      if(d < bestD){ bestD = d; best = i; }
    }
    return best;
  }

  function canvasPos(e, canvas){
    var r = canvas.getBoundingClientRect();
    var p = (e.touches && e.touches[0]) ? e.touches[0] : e;
    return { x: (p.clientX - r.left) * (canvas.width / r.width), y: (p.clientY - r.top) * (canvas.height / r.height) };
  }

  pc.addEventListener('pointerdown', function(e){
    var pos = canvasPos(e, pc);
    var idx = nearestIndex(pos.x, pos.y);
    if(idx === -1){
      var h = pUnmapH(pos.y), r = pUnmapR(pos.x);
      profile.push({ h: h, r: r });
      profile.sort(function(a, b){ return a.h - b.h; });
      idx = profile.findIndex(function(p){ return p.h === h && p.r === r; });
      addedNew = true;
    }
    dragIndex = idx;
    try { pc.setPointerCapture(e.pointerId); } catch(err) {}
    drawProfile();
  });

  pc.addEventListener('pointermove', function(e){
    if(dragIndex === -1) return;
    var pos = canvasPos(e, pc);
    var lo = dragIndex > 0 ? profile[dragIndex - 1].h + 1 : 0;
    var hi = dragIndex < profile.length - 1 ? profile[dragIndex + 1].h - 1 : HMAX;
    profile[dragIndex].h = Math.min(hi, Math.max(lo, pUnmapH(pos.y)));
    profile[dragIndex].r = Math.min(RMAX, Math.max(4, pUnmapR(pos.x)));
    drawProfile();
    rebuildAndDraw();
  });

  function endDrag(){ dragIndex = -1; addedNew = false; drawProfile(); }
  pc.addEventListener('pointerup', endDrag);
  pc.addEventListener('pointercancel', endDrag);

  // ── Maillage : revolution du profil autour de l'axe vertical ─────────
  var SEGMENTS = 28;
  var mesh = [];

  function rebuildMesh(){
    var rings = profile.map(function(p){
      var ring = [];
      for(var i = 0; i < SEGMENTS; i++){
        var a = i / SEGMENTS * Math.PI * 2;
        ring.push({ x: p.r * Math.cos(a), y: p.h, z: p.r * Math.sin(a) });
      }
      return ring;
    });
    var tris = [];
    for(var s = 0; s < rings.length - 1; s++){
      var r0 = rings[s], r1 = rings[s + 1];
      for(var i = 0; i < SEGMENTS; i++){
        var n = (i + 1) % SEGMENTS;
        tris.push([r0[i], r0[n], r1[n]]);
        tris.push([r0[i], r1[n], r1[i]]);
      }
    }
    mesh = tris;
  }

  function cross(a, b){ return { x: a.y*b.z - a.z*b.y, y: a.z*b.x - a.x*b.z, z: a.x*b.y - a.y*b.x }; }
  function sub(a, b){ return { x: a.x-b.x, y: a.y-b.y, z: a.z-b.z }; }
  function normalize(v){
    var m = Math.sqrt(v.x*v.x + v.y*v.y + v.z*v.z) || 1;
    return { x: v.x/m, y: v.y/m, z: v.z/m };
  }
  var LIGHT = normalize({ x: 0.45, y: 0.7, z: 0.55 });

  function projectPoint(p, az, el, cx, cy, scale, midH){
    var cosA = Math.cos(az), sinA = Math.sin(az);
    var x1 = p.x*cosA - p.z*sinA;
    var z1 = p.x*sinA + p.z*cosA;
    var cosE = Math.cos(el), sinE = Math.sin(el);
    var y1 = (p.y - midH)*cosE - z1*sinE;
    var z2 = (p.y - midH)*sinE + z1*cosE;
    return { x: cx + x1*scale, y: cy - y1*scale, z: z2 };
  }

  function shadeColor(intensity, lit){
    var t = Math.min(1, Math.max(0, intensity));
    if(lit){
      var r = 255, g = Math.round(210 + t*40), b = Math.round(140 + t*80);
      return 'rgb(' + r + ',' + g + ',' + b + ')';
    }
    var v = Math.round(150 + t*105);
    return 'rgb(' + v + ',' + v + ',' + v + ')';
  }

  function renderMesh(ctx, w, h, opts){
    ctx.clearRect(0, 0, w, h);
    var grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, opts.bgTop);
    grad.addColorStop(1, opts.bgBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    var midH = HMAX / 2;
    var scale = opts.scale;
    var cx = w / 2, cy = h / 2 + h * 0.06;
    var ambient = opts.lit ? 0.5 : 0.28;

    var faces = mesh.map(function(t){
      var p0 = projectPoint(t[0], opts.az, opts.el, cx, cy, scale, midH);
      var p1 = projectPoint(t[1], opts.az, opts.el, cx, cy, scale, midH);
      var p2 = projectPoint(t[2], opts.az, opts.el, cx, cy, scale, midH);
      var n = normalize(cross(sub(t[1], t[0]), sub(t[2], t[0])));
      var ndotl = Math.max(0, n.x*LIGHT.x + n.y*LIGHT.y + n.z*LIGHT.z);
      var intensity = ambient + (1 - ambient) * ndotl;
      return { p: [p0, p1, p2], z: (p0.z + p1.z + p2.z) / 3, c: shadeColor(intensity, opts.lit) };
    });
    faces.sort(function(a, b){ return a.z - b.z; });
    for(var i = 0; i < faces.length; i++){
      var f = faces[i];
      ctx.beginPath();
      ctx.moveTo(f.p[0].x, f.p[0].y);
      ctx.lineTo(f.p[1].x, f.p[1].y);
      ctx.lineTo(f.p[2].x, f.p[2].y);
      ctx.closePath();
      ctx.fillStyle = f.c;
      ctx.fill();
    }

    if(opts.lit){
      var glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, scale * 60);
      glow.addColorStop(0, 'rgba(255,210,140,0.28)');
      glow.addColorStop(1, 'rgba(255,210,140,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
    }
  }

  // ── Vue coque (rotation a la souris) ──────────────────────────────────
  var view = { az: 0.7, el: 0.22 };
  var vScale = 1.55;

  function drawPreview(){
    renderMesh(vctx, vc.width, vc.height, {
      az: view.az, el: view.el, scale: vScale, lit: litState,
      bgTop: '#1e4535', bgBottom: '#123024'
    });
  }

  var orbiting = false, lastX = 0, lastY = 0;
  vc.addEventListener('pointerdown', function(e){
    orbiting = true;
    var pos = canvasPos(e, vc);
    lastX = pos.x; lastY = pos.y;
    try { vc.setPointerCapture(e.pointerId); } catch(err) {}
  });
  vc.addEventListener('pointermove', function(e){
    if(!orbiting) return;
    var pos = canvasPos(e, vc);
    view.az += (pos.x - lastX) * 0.008;
    view.el = Math.min(1.1, Math.max(-0.3, view.el + (pos.y - lastY) * 0.006));
    lastX = pos.x; lastY = pos.y;
    drawPreview();
  });
  function endOrbit(){ orbiting = false; }
  vc.addEventListener('pointerup', endOrbit);
  vc.addEventListener('pointercancel', endOrbit);

  // ── Rendu studio : meme maillage, camera fixe, cadre plus doux ───────
  var litState = false;

  function drawRender(){
    renderMesh(rctx, rc.width, rc.height, {
      az: 0.55, el: 0.18, scale: vScale, lit: litState,
      bgTop: litState ? '#3a2f22' : '#efeae0', bgBottom: litState ? '#20180f' : '#e2dccf'
    });
  }

  function rebuildAndDraw(){
    rebuildMesh();
    drawPreview();
    drawRender();
  }

  var btnOff = document.getElementById('lampeToggleOff');
  var btnOn = document.getElementById('lampeToggleOn');
  function syncToggle(){
    if(btnOff) btnOff.classList.toggle('btn-primary', !litState);
    if(btnOn) btnOn.classList.toggle('btn-primary', litState);
  }
  if(btnOff) btnOff.addEventListener('click', function(){ litState = false; syncToggle(); drawRender(); });
  if(btnOn) btnOn.addEventListener('click', function(){ litState = true; syncToggle(); drawRender(); });

  drawProfile();
  rebuildAndDraw();
  syncToggle();
})();
