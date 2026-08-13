/* Couronne DELIGNY R&D en sable de particules — script partage entre la
 * page dediee (logo-3d.html) et la section integree sur l'accueil.
 * Cherche #crown-canvas ; #crown-hint et #crown-loading sont optionnels
 * (absents sur l'accueil, presents sur la page dediee) donc le meme
 * fichier marche dans les deux contextes sans configuration. */
(function(){
  "use strict";
  var canvas = document.getElementById('crown-canvas');
  if(!canvas) return;
  var ctx = canvas.getContext('2d');
  var hint = document.getElementById('crown-hint');
  var loadingEl = document.getElementById('crown-loading');

  // Reste leger malgre la finesse : dessin en rectangles (pas d'arc(), pas
  // de shadowBlur) — c'est ce budget qui permet un DPR et un echantillonnage
  // plus fins sans faire ramer un portable modeste.
  var DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  var W = 0, H = 0, CX = 0, CY = 0, GROUND = 0;
  function resize(){
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    CX = W / 2; CY = H / 2;
    GROUND = H - 26;
  }
  window.addEventListener('resize', resize);

  // Vitesse -> couleur : au repos, vert. Plus le balayage est rapide, plus
  // la teinte glisse vers le bleu, le violet, le rouge, l'orange puis le
  // jaune au maximum.
  var BASE_HUE = 142;
  var HUE_STOPS = [142, 210, 270, 360, 390, 415];
  function hueForSpeed(t){
    t = Math.max(0, Math.min(1, t));
    var seg = t * (HUE_STOPS.length - 1);
    var i = Math.min(HUE_STOPS.length - 2, Math.floor(seg));
    var f = seg - i;
    return (HUE_STOPS[i] + (HUE_STOPS[i + 1] - HUE_STOPS[i]) * f) % 360;
  }

  // ── Nuage de particules : echantillonne le logo (couronne) depuis le PNG
  // deja utilise dans le bandeau du portail. Aucune donnee inventee : la
  // forme vient du vrai logo, pas d'une silhouette approchee a la main.
  var particles = [];
  var FIELD = 210;

  // Relief : calcule une fois, a la construction (cout nul en animation).
  // Un point entoure d'autres points opaques est "epais" (coeur du trait) —
  // un point pres d'un bord a peu de voisins opaques, donc "mince". Ce
  // ratio sert ensuite de fausse profondeur (taille + ombrage), sans
  // aucune rotation 3D a faire tourner en boucle.
  function reliefAt(data, wSize, x, y){
    var hits = 0, total = 0;
    for(var a = 0; a < 8; a++){
      var ang = a / 8 * Math.PI * 2;
      var nx = Math.round(x + Math.cos(ang) * 7);
      var ny = Math.round(y + Math.sin(ang) * 7);
      if(nx < 0 || ny < 0 || nx >= wSize || ny >= wSize) continue;
      total++;
      if(data[(ny * wSize + nx) * 4 + 3] >= 130) hits++;
    }
    return total ? hits / total : 0;
  }

  function buildFromImage(img){
    var work = document.createElement('canvas');
    var wSize = 300;
    work.width = wSize; work.height = wSize;
    var wctx = work.getContext('2d');
    wctx.drawImage(img, 0, 0, wSize, wSize);
    var data;
    try { data = wctx.getImageData(0, 0, wSize, wSize).data; }
    catch(e){ data = null; }
    if(!data){ buildFallbackCrown(); return; }
    // Stride 6 (et non 4) : moitie moins de particules a l'ecran. La forme
    // reste lisible mais la boucle par frame a bien moins de points a
    // deplacer/dessiner — c'est ce qui faisait saccader sur un DPR eleve.
    var stride = 6;
    for(var y = 0; y < wSize; y += stride){
      for(var x = 0; x < wSize; x += stride){
        var i = (y * wSize + x) * 4;
        if(data[i+3] < 130) continue;
        var px = (x - wSize/2) / wSize * FIELD;
        var py = (y - wSize/2) / wSize * FIELD;
        addParticle(px, py, reliefAt(data, wSize, x, y));
      }
    }
    finishBuild();
  }

  // Filet de securite si l'image ne charge pas (offline, chemin different) :
  // une couronne stylisee generee au meme gabarit, pour que la page reste
  // utilisable meme sans le PNG.
  function buildFallbackCrown(){
    var pts = [];
    var peaks = [-70,-35,0,35,70];
    for(var p = 0; p < peaks.length; p++){
      var px = peaks[p];
      for(var t = 0; t < 40; t++){
        var f = t/39;
        pts.push([px + (Math.random()-0.5)*8, -60 + f*70]);
      }
    }
    for(var a = 0; a < 220; a++){
      pts.push([-90 + (a/220)*180, 30 + Math.sin(a/220*Math.PI)*10]);
    }
    for(var i=0;i<pts.length;i++){ addParticle(pts[i][0], pts[i][1], 0.75); }
    finishBuild();
  }

  function addParticle(hx, hy, relief){
    particles.push({
      hx: hx, hy: hy, relief: relief,
      x: CX, y: CY, vx: 0, vy: 0,
      size: (1.3 + relief * 1.1) + Math.random() * 0.9,
      disturbed: false, settleT: 0,
      hue: BASE_HUE
    });
  }

  function finishBuild(){
    if(loadingEl) loadingEl.classList.add('hide');
    // clientWidth n'est fiable qu'apres une passe de mise en page : un
    // resize() appele trop tot (avant le premier rAF) peut encore lire 0 et
    // coller tout le nuage dans le coin — on attend un frame reel.
    requestAnimationFrame(function(){
      resize();
      for(var i = 0; i < particles.length; i++){ particles[i].x = CX; particles[i].y = CY; }
      if(!running) start();
    });
  }

  var img = new Image();
  img.onload = function(){ buildFromImage(img); };
  img.onerror = function(){ buildFallbackCrown(); };
  img.src = 'img/logo-mark.png';

  // ── Balayage : seules les particules a proximite immediate du curseur
  // sont poussees, dans la direction du geste — le reste de la page ne
  // declenche rien, la couronne ne bouge pas tant qu'on ne la touche pas.
  var SWEEP_R = 90;
  var MAX_SPEED_REF = 2.2; // px/ms pour atteindre la teinte maximale
  var lastMove = { x: 0, y: 0, t: 0 };
  var touched = false;

  function pointerPos(e){
    var r = canvas.getBoundingClientRect();
    var p = (e.touches && e.touches[0]) ? e.touches[0] : e;
    return { x: p.clientX - r.left, y: p.clientY - r.top };
  }

  function sweep(mx, my, dirx, diry, speed){
    var t = Math.min(1, speed / MAX_SPEED_REF);
    var hue = hueForSpeed(t);
    var force = Math.min(9, speed * 5);
    for(var i = 0; i < particles.length; i++){
      var p = particles[i];
      var ddx = p.x - mx, ddy = p.y - my;
      var d = Math.hypot(ddx, ddy);
      if(d < SWEEP_R){
        var influence = 1 - d / SWEEP_R;
        p.vx += dirx * force * influence;
        p.vy += diry * force * influence - influence * 1.5;
        p.disturbed = true;
        p.settleT = 0;
        p.hue = hue;
      }
    }
  }

  canvas.addEventListener('pointermove', function(e){
    var p = pointerPos(e);
    var now = performance.now();
    var dt = Math.max(8, now - lastMove.t);
    var dx = p.x - lastMove.x, dy = p.y - lastMove.y;
    var dist = Math.hypot(dx, dy);
    if(dist > 0.4){
      if(!touched){ touched = true; if(hint) hint.classList.add('hint-hidden'); }
      sweep(p.x, p.y, dx / dist, dy / dist, dist / dt);
    }
    lastMove = { x: p.x, y: p.y, t: now };
  });
  canvas.addEventListener('pointerdown', function(e){
    var p = pointerPos(e);
    lastMove = { x: p.x, y: p.y, t: performance.now() };
  });

  // ── Boucle d'animation ───────────────────────────────────────────────
  var running = false;
  var rafId = null;
  var GRAVITY = 0.34;

  // Coupe totalement la boucle quand l'onglet est en arriere-plan : zero
  // travail, pas juste un rendu invisible.
  document.addEventListener('visibilitychange', function(){
    if(document.hidden){
      if(rafId){ cancelAnimationFrame(rafId); rafId = null; }
    } else if(running && !rafId){
      rafId = requestAnimationFrame(frame);
    }
  });

  function frame(){
    rafId = requestAnimationFrame(frame);
    // Efface en transparence : le fond visible est celui du CSS derriere le
    // canvas (blanc sur la page dediee, beige de l'accueil une fois integre)
    // — un seul moteur, pas de couleur de fond a synchroniser en JS.
    ctx.clearRect(0, 0, W, H);

    for(var i = 0; i < particles.length; i++){
      var p = particles[i];
      var homeX = CX + p.hx, homeY = CY + p.hy;

      if(p.disturbed){
        p.settleT++;
        if(p.y < GROUND){
          p.vy += GRAVITY;
        } else {
          p.y = GROUND;
          if(p.vy > 0) p.vy *= -0.15;
        }

        // Rappel vers la position d'origine : quasi nul juste apres le
        // balayage (le sable finit de se repandre), il croit ensuite au
        // carre du temps ecoule — lent au debut, puis de plus en plus
        // rapide ("exponentiellement") jusqu'a revenir pile en place.
        var ramp = Math.min(1, p.settleT / 45);
        var k = 0.006 * ramp * ramp;
        p.vx += (homeX - p.x) * k;
        p.vy += (homeY - p.y) * k;

        // Friction assez forte pour que l'elan du balayage s'eteigne vite
        // et laisse la place au rappel, plutot que de deriver longtemps.
        p.vx *= 0.90; p.vy *= 0.90;
        p.x += p.vx; p.y += p.vy;

        var dHome = Math.hypot(homeX - p.x, homeY - p.y);
        if(ramp >= 1 && dHome < 1.2 && Math.hypot(p.vx, p.vy) < 0.3){
          p.x = homeX; p.y = homeY; p.vx = 0; p.vy = 0;
          p.disturbed = false; p.settleT = 0;
        }
      } else {
        p.x = homeX; p.y = homeY;
      }

      // Le relief (calcule une seule fois a la construction) fait office de
      // profondeur : coeur du trait plus sombre et dense, bord plus clair —
      // un vrai bas-relief, sans rotation ni calcul par frame.
      var hue = p.disturbed ? p.hue : BASE_HUE;
      var edgeLift = (1 - p.relief) * 16;
      var light = (p.disturbed ? 45 : 37) + edgeLift;
      ctx.fillStyle = 'hsl(' + hue.toFixed(0) + ',70%,' + light.toFixed(0) + '%)';
      var s = p.size;
      ctx.fillRect(p.x - s, p.y - s, s * 2, s * 2);
    }
  }

  function start(){ running = true; ctx.clearRect(0, 0, W, H); rafId = requestAnimationFrame(frame); }

  resize();
})();
