(function () {
  if (new URLSearchParams(location.search).has("embed")) document.documentElement.classList.add("embed");
  if (new URLSearchParams(location.search).has("capture")) document.documentElement.classList.add("capture");
  if (new URLSearchParams(location.search).get("fond") === "transparent") document.documentElement.classList.add("transparent");
  // Mode carte (?carte=1) : la 3D vivante dans une carte du répertoire. On glisse
  // pour tourner ; un simple toucher ouvre le dossier complet de l'œuvre.
  const CARTE = new URLSearchParams(location.search).has("carte");
  if (CARTE) document.documentElement.classList.add("carte");
  // Propriétaire : le jeton (lien de son espace) ouvre, dans la fiche, les photos
  // du processus et le certificat complet. Lu une fois puis retiré de l'adresse.
  const API_PLATEFORME = "https://atlas-studio.pro/deligny/api";
  const JETON = new URLSearchParams(location.search).get("t") || "";
  if (JETON) history.replaceState(null, "", location.pathname + location.hash);
  let PROPRIO = null;                                   // réponse /owner, une seule fois
  async function espaceProprio(o) {
    const z = document.getElementById("cProprio"); z.hidden = true; z.innerHTML = "";
    if (!JETON || !o) return;
    try {
      if (!PROPRIO) { const r = await fetch(API_PLATEFORME + "/owner/" + encodeURIComponent(JETON)); PROPRIO = r.ok ? await r.json() : {}; }
    } catch (e) { PROPRIO = {}; }
    if (!PROPRIO.oeuvre || PROPRIO.oeuvre.id !== o.id) return;
    const c = PROPRIO.coulisses || {}, ph = c.photos || [];
    const t = encodeURIComponent(JETON);
    z.innerHTML = '<h3>Espace propriétaire</h3>'
      + (c.note ? '<p class="note-c">' + esc(c.note) + '</p>' : '')
      + (ph.length ? '<div class="photos">' + ph.map((p, i) => '<img id="cph' + i + '" alt="' + esc(p.legende || "photo de l'atelier") + '" title="' + esc(p.legende || "") + '">').join("") + '</div>' : '')
      + '<a href="../verify/' + esc(o.id) + '/?t=' + t + '">Certificat complet (signature) →</a>'
      + '<a href="../proprietaire/?t=' + t + '">Gérer mon œuvre →</a>';
    z.hidden = false;
    ph.forEach(async (p, i) => {
      try { const r = await fetch(API_PLATEFORME + "/owner/" + t + "/photo/" + encodeURIComponent(p.nom)); if (!r.ok) return;
        const im = document.getElementById("cph" + i); im.src = URL.createObjectURL(await r.blob());
        im.onclick = () => { document.getElementById("zoomCImg").src = im.src; document.getElementById("zoomC").style.display = "flex"; };
      } catch (e) {}
    });
  }
  document.getElementById("zoomC").onclick = () => { document.getElementById("zoomC").style.display = "none"; };
  const $ = id => document.getElementById(id);
  const esc = t => String(t || "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const canvas = $("scene");
  if (!window.THREE) { $("cNote").textContent = "La 3D n'a pas pu se charger (pas de connexion ?)."; return; }
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.NoToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 1, 2000);
  const controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.08; controls.minDistance = 22; controls.maxDistance = 360;
  if (CARTE) {
    // Pas de zoom ni de déplacement (la molette et le pincement font défiler la
    // page) ; sur téléphone, le glissé vertical reste le défilement de la page.
    controls.enableZoom = false; controls.enablePan = false; canvas.style.touchAction = "pan-y";
    let dep = null;
    canvas.addEventListener("pointerdown", e => { dep = [e.clientX, e.clientY]; });
    canvas.addEventListener("pointerup", e => {
      if (dep && Math.hypot(e.clientX - dep[0], e.clientY - dep[1]) < 6)
        window.top.location.href = location.pathname + location.hash;
      dep = null;
    });
  }

  // Une pièce claire avec deux fenêtres : de quoi faire briller l'or et le verre.
  const pmrem = new THREE.PMREMGenerator(renderer);
  function hdri() {
    // Galerie de musée en haute dynamique, dessinée par code (aucune photo) :
    // verrière à croisillons, voûte sombre et corniche dorée, murs vert sombre,
    // mur de fond bordeaux, colonnes cuivrées à chapiteaux dorés, tableaux sous
    // spots, parquet en damier. ph = tour horizontal (0,75 = derrière le visiteur
    // en vue de face : c'est ce que le verre renvoie), th = 0 en haut, 1 en bas.
    const W = 1024, H = 512, d = new Float32Array(W * H * 4);
    const colonnes = [0.06, 0.19, 0.31, 0.44, 0.56, 0.665, 0.835, 0.94];
    const tableaux = [[0.125, 0.036], [0.375, 0.032], [0.5, 0.028], [0.75, 0.04], [0.625, 0.026], [0.885, 0.026]];   // moitié plus petits
    const prox = (a, b) => { const x = Math.abs(a - b); return Math.min(x, 1 - x); };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const ph = x / W, th = 1 - (y + 0.5) / H;
      let c;
      if (th < 0.19) {                                        // verrière
        const grille = (ph * 64) % 1 < 0.06 || (th * 70) % 1 < 0.08;
        c = grille ? [0.18, 0.18, 0.2] : [5.2, 5.4, 6.0];
      } else if (th < 0.3) {                                  // voûte et corniche
        c = th > 0.285 ? [0.9, 0.62, 0.22] : [0.07, 0.06, 0.055];
      } else if (th < 0.64) {                                 // murs
        c = (ph > 0.7 && ph < 0.8) ? [0.13, 0.045, 0.04] : [0.035, 0.06, 0.045];
        if (th < 0.34) {                                      // rail et spots au-dessus des tableaux
          c = [0.04, 0.04, 0.04];
          tableaux.forEach(([p]) => { if (prox(ph, p) < 0.006 && th > 0.315) c = [14, 13, 11]; });
        }
        tableaux.forEach(([p, l]) => {
          // Tableau flou : un dégradé doux (pas de bord net, pas de détail), le cadre
          // doré réduit à une teinte chaude qui se fond dans la toile, halo du spot autour.
          const dx = prox(ph, p) / (l / 2), dy = Math.abs(th - 0.45) / 0.045;
          const r = Math.max(dx, dy);
          const lissage = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
          const toile = 1 - lissage(0.55, 1.15, r);
          const halo = (1 - lissage(1.0, 2.2, r)) * 0.9;
          const teinte = [0.42 + 0.08 * Math.sin(p * 40), 0.38, 0.26 + 0.08 * Math.cos(p * 30)];
          const dore = [0.75, 0.55, 0.24];
          const mel = r > 0.8 ? 0.5 : 0.15;                  // l'or domine sur le pourtour flou
          const tab = teinte.map((v, i) => v * (1 - mel) + dore[i] * mel);
          c = c.map((v, i) => v * (1 + halo) * (1 - toile) + tab[i] * toile);
        });
        colonnes.forEach(p => {
          const dx = prox(ph, p);
          if (dx < 0.011) {
            const rond = 0.6 + 0.4 * Math.cos(dx / 0.011 * Math.PI / 2);
            c = th < 0.36 ? [1.4 * rond, 1.0 * rond, 0.38 * rond]       // chapiteau doré
                          : [0.42 * rond, 0.14 * rond, 0.09 * rond];    // fût cuivré
          }
        });
      } else {                                                // parquet en damier
        const u = ph * 80, v = (th - 0.64) * 120 / (th + 0.05);
        const k = ((Math.floor(u + v) + Math.floor(u - v)) & 1) ? 0.3 : 0.22;
        const grain = 0.9 + 0.1 * Math.sin(u * 23 + v * 7);
        c = [k * 1.25 * grain, k * 0.8 * grain, k * 0.42 * grain];
        // reflet diffus de la verrière sur le parquet ciré, au loin
        if (th < 0.7) c = c.map(v2 => v2 * 1.6);
      }
      const i = (y * W + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 1;
    }
    const t = new THREE.DataTexture(d, W, H, THREE.RGBAFormat, THREE.FloatType);
    t.mapping = THREE.EquirectangularReflectionMapping; t.minFilter = t.magFilter = THREE.NearestFilter;
    t.needsUpdate = true;
    return pmrem.fromEquirectangular(t).texture;
  }
  scene.environment = hdri();
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x2a2116, 0.55));
  const cle = new THREE.DirectionalLight(0xfff1d6, 1.2); cle.position.set(-50, 55, 75); scene.add(cle);
  const contre = new THREE.DirectionalLight(0xdfe8ff, 0.35); contre.position.set(-20, 30, -80); scene.add(contre);

  // ---------- textures procédurales ----------
  const TEINTES = {   // fond, strie (baguettes de l'atelier : doré, noir, blanc)
    or: [[226, 186, 98], [86, 50, 20]], noir: [[34, 32, 30], [84, 78, 70]], blanc: [[238, 234, 225], [190, 184, 172]] };

  // Effet holo (carte de collection) sur les REFLETS du verre : la lumière réfléchie
  // se décompose en arc-en-ciel selon l'angle de vue et la position sur la vitre.
  // Seuls les reflets lumineux se colorent (seuil de luminance) : l'œuvre reste intacte.
  function holo(mat) {
    mat.onBeforeCompile = sh => {
      sh.vertexShader = "varying vec2 vHolo;\n" + sh.vertexShader.replace("#include <uv_vertex>", "#include <uv_vertex>\n  vHolo = uv;");
      sh.fragmentShader = "varying vec2 vHolo;\n" + sh.fragmentShader.replace(
        "gl_FragColor = vec4( outgoingLight, diffuseColor.a );",
        "float angH = dot(normalize(normal), normalize(vViewPosition));\n" +
        "  float hH = fract(angH * 3.2 + vHolo.x * 2.1 + vHolo.y * 1.3 + sin(vHolo.y * 18.0) * 0.06);\n" +
        "  vec3 arc = 0.55 + 0.45 * cos(6.2831 * (hH + vec3(0.0, 0.33, 0.67)));\n" +
        "  float lumH = dot(outgoingLight, vec3(0.299, 0.587, 0.114));\n" +
        "  outgoingLight = mix(outgoingLight, arc * lumH * 2.1, smoothstep(0.015, 0.22, lumH) * 0.9);\n" +
        "  gl_FragColor = vec4( outgoingLight, diffuseColor.a );");
    };
    mat.needsUpdate = true;
    return mat;
  }

  function texStries(a, b) {
    // Accepte texStries(relief) (or) ou texStries(teinte, relief).
    const teinte = typeof a === "string" ? a : "or", relief = typeof a === "string" ? b : a;
    texStries.cache = texStries.cache || {};
    const cle = teinte + (relief ? ":relief" : ":couleur");
    if (texStries.cache[cle]) return texStries.cache[cle];
    const PAL = {
      or:    { fond: [226, 186, 98], strie: [86, 50, 20],    usure: [140, 58, 34], reflet: [255, 242, 190] },
      noir:  { fond: [34, 32, 30],   strie: [86, 80, 72],    usure: [92, 70, 52],  reflet: [118, 112, 104] },
      blanc: { fond: [238, 234, 225], strie: [192, 186, 174], usure: [172, 150, 118], reflet: [255, 255, 252] },
    }[teinte] || null;
    const P = PAL || { fond: [226, 186, 98], strie: [86, 50, 20], usure: [140, 58, 34], reflet: [255, 242, 190] };
    // Suite pseudo-aléatoire à graine fixe : couleur et relief tirent les mêmes défauts.
    let graine = 20261005;
    const R = () => { graine |= 0; graine = graine + 0x6D2B79F5 | 0; let t = Math.imul(graine ^ graine >>> 15, 1 | graine);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const rgba = (c, al) => "rgba(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + "," + al.toFixed(3) + ")";
    const gris = (v, al) => "rgba(" + v + "," + v + "," + v + "," + al.toFixed(3) + ")";
    const N = 512, c = document.createElement("canvas"); c.width = c.height = N;
    const g = c.getContext("2d");
    // Échelle : u (x) = 32 cm le long de la baguette, v (y) = 2,2 cm à travers le profil.
    // Un défaut rond en vrai est donc très étroit en x : rx ≈ ry × 0,07.
    for (let y = 0; y < N; y++) {
      const k = 0.94 + 0.1 * Math.sin(y * 0.09 + R() * 0.8);
      g.fillStyle = relief ? gris(128, 1) : rgba([P.fond[0] * k, P.fond[1] * k, P.fond[2] * k], 1);
      g.fillRect(0, y, N, 1);
    }
    // stries ondulées, d'épaisseur et de force variables, interrompues par endroits
    let y = 0;
    while (y < N) {
      y += 3 + R() * 12;
      const ep = R() < 0.7 ? 1 : (R() < 0.7 ? 1.6 : 2.6), amp = 0.5 + R() * 2.4, f = 0.004 + R() * 0.012,
            ph = R() * 6.28, force = 0.3 + R() * 0.55, tiret = 40 + R() * 220, trou = R() < 0.35 ? 3 + R() * 14 : 0;
      g.beginPath();
      for (let x = 0; x <= N; x += 4) {
        const yy = y + Math.sin(x * f + ph) * amp + (R() - 0.5) * 0.8;
        if (x === 0) g.moveTo(x, yy); else g.lineTo(x, yy);
      }
      g.setLineDash(trou ? [tiret, trou] : []);
      g.lineWidth = ep; g.strokeStyle = relief ? gris(70, force) : rgba(P.strie, force); g.stroke();
    }
    g.setLineDash([]);
    // pores du bois : petites fentes allongées dans le fil
    for (let i = 0; i < 1400; i++) {
      const x = R() * N, yy = R() * N, l = 2 + R() * 5, al = 0.25 + R() * 0.45;
      g.fillStyle = relief ? gris(60, al) : rgba(P.strie, al * 0.8);
      g.fillRect(x, yy, l, 1 + (R() < 0.3 ? 1 : 0));
    }
    // bosses et creux : petites déformations rondes (étroites en x, voir l'échelle)
    for (let i = 0; i < 70; i++) {
      const x = R() * N, yy = R() * N, ry = 4 + R() * 12, creux = R() < 0.6;
      const gr = g.createRadialGradient(x, yy, 0, x, yy, ry);
      const v = creux ? 60 : 200, al = 0.35 + R() * 0.35;
      gr.addColorStop(0, relief ? gris(v, al) : (creux ? rgba(P.strie, al * 0.35) : rgba(P.reflet, al * 0.35)));
      gr.addColorStop(1, relief ? gris(v, 0) : rgba(P.fond, 0));
      g.save(); g.translate(x, yy); g.scale(0.07, 1); g.translate(-x, -yy);
      g.fillStyle = gr; g.beginPath(); g.arc(x, yy, ry, 0, Math.PI * 2); g.fill(); g.restore();
    }
    // éclats d'usure : la dorure manque, le fond brun-rouge apparaît (en creux)
    for (let i = 0; i < 14; i++) {
      const x = R() * N, yy = R() * N, ry = 2 + R() * 5, al = 0.6 + R() * 0.35;
      g.save(); g.translate(x, yy); g.scale(0.09, 1); g.translate(-x, -yy);
      g.fillStyle = relief ? gris(40, al) : rgba(P.usure, al);
      g.beginPath();
      for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2, r = ry * (0.6 + R() * 0.6);
        const px = x + Math.cos(a) * r, py = yy + Math.sin(a) * r; if (k === 0) g.moveTo(px, py); else g.lineTo(px, py); }
      g.closePath(); g.fill(); g.restore();
    }
    // rayures fines, légèrement en biais par rapport au fil
    for (let i = 0; i < 30; i++) {
      const x = R() * N, yy = R() * N, l = 30 + R() * 140, pente = (R() - 0.5) * 0.25, al = 0.15 + R() * 0.3;
      g.strokeStyle = relief ? gris(80, al) : rgba(P.reflet, al);
      g.lineWidth = 0.7; g.beginPath(); g.moveTo(x, yy); g.lineTo(x + l, yy + l * pente); g.stroke();
    }
    // petits reflets sur les crêtes
    for (let i = 0; i < 80; i++) {
      const x = R() * N, yy = R() * N, l = 20 + R() * 110, al = 0.2 + R() * 0.3;
      g.fillStyle = relief ? gris(175, al) : rgba(P.reflet, al);
      g.fillRect(x, yy, l, 1);
    }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (!relief) t.encoding = THREE.sRGBEncoding;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    texStries.cache[cle] = t;
    return t;
  }
  function texIsorel() {
    // Carton du dos : photo du vrai carton de l'atelier, éclairage retiré
    // (uniformisée) et rendue raccordable. Une tuile couvre ~18 × 33 cm.
    const t = new THREE.TextureLoader().load("carton.jpg");
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  }
  function texAttache() {
    const c = document.createElement("canvas"); c.width = 256; c.height = 128; const g = c.getContext("2d");
    const l = g.createLinearGradient(0, 0, 256, 128); l.addColorStop(0, "#e8d58f"); l.addColorStop(.5, "#b99a4c"); l.addColorStop(1, "#dcc477");
    g.fillStyle = l; g.fillRect(4, 4, 248, 120); g.globalCompositeOperation = "destination-out";
    g.beginPath(); g.moveTo(22, 26); g.lineTo(106, 26); g.lineTo(106, 102); g.lineTo(22, 102);
    for (let k = 0; k < 7; k++) { const yy = 98 - k * 11; g.lineTo(32, yy - 5); g.lineTo(22, yy - 10); } g.closePath(); g.fill();
    [30, 64, 98].forEach(yy => { g.beginPath(); g.arc(196, yy, 11, 0, Math.PI * 2); g.fill(); });
    g.globalCompositeOperation = "source-over"; g.fillStyle = "rgba(70,55,20,.5)"; g.fillRect(124, 4, 8, 120);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
  }
  function texCache() {
    const c = document.createElement("canvas"); c.width = 256; c.height = 256; const g = c.getContext("2d");
    const gr = g.createLinearGradient(0, 0, 256, 256); gr.addColorStop(0, "#d9d9d6"); gr.addColorStop(.5, "#9fa09c"); gr.addColorStop(1, "#d0d0cc");
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256); g.strokeStyle = "rgba(255,255,255,.35)";
    for (let i = -256; i < 256; i += 10) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 256, 256); g.stroke(); }
    g.fillStyle = "#2b2b2b"; g.textAlign = "center"; g.font = "600 22px Georgia, serif"; g.fillText("DELIGNY R&D", 128, 116);
    g.font = "13px Menlo, monospace"; g.fillText("NE PAS DÉCOLLER", 128, 146); g.fillText("AVANT L'ACHAT", 128, 166);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
  }
  const ISOREL = texIsorel(), ATTACHE = texAttache();
  const SCELLE = new THREE.TextureLoader().load("scelle.png"); SCELLE.encoding = THREE.sRGBEncoding;
  const loader = new THREE.TextureLoader();

  // ---------- montage d'un tableau ----------
  let tableau = null, pivotCache = null, cacheMesh = null, cacheOuvert = false, cacheAngle = 0, VUES = {};

  function monter(o, dimsImage) {
    if (tableau) { scene.remove(tableau); tableau.traverse(m => { if (m.geometry) m.geometry.dispose(); }); }
    tableau = new THREE.Group(); scene.add(tableau);
    pivotCache = cacheMesh = null; cacheOuvert = false; cacheAngle = 0; majCache();
    // Dimensions : les deux nombres de la fiche, l'orientation suit l'image.
    const n = (String(o.dimensions).match(/[\d.,]+/g) || ["50", "65"]).map(v => parseFloat(v.replace(",", ".")));
    const grand = Math.max(n[0], n[1] || n[0]), petit = Math.min(n[0], n[1] || n[0]);
    const paysage = dimsImage.w > dimsImage.h;
    const L = paysage ? grand : petit, H = paysage ? petit : grand;
    const PP = (o.passe_partout_mm || 0) / 10, FOND = 2.4;
    const lw = L + 2 * PP, lh = H + 2 * PP;

    const tex = loader.load(o.image_3d); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const oeuvre = new THREE.Mesh(new THREE.PlaneGeometry(L, H), new THREE.MeshStandardMaterial({ map: tex, bumpMap: tex, bumpScale: .012,
      roughness: .85, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: .32, color: 0xb8b8b8, envMapIntensity: .45 }));
    oeuvre.position.z = .02; tableau.add(oeuvre);
    if (o.etiquette) {
      // Nouvelle étiquette collée SUR l'ancien autocollant, aux cotes de CARTOUCHE :
      // 168 × 28 mm (pièce découpée), à 23 mm du bord droit, centrée en hauteur sur l'ancien.
      const te = loader.load(o.etiquette); te.encoding = THREE.sRGBEncoding; te.anisotropy = renderer.capabilities.getMaxAnisotropy();
      // Étiquette de 143,5 × 28 mm (cadre imprimé et pièce découpée ont la même hauteur depuis le 05/10).
      const EL = 14.35, EH = 2.8, PIECE = 2.8, cy = -H / 2 + 1.9 + 1.275;   // cadre imprimé = pièce = 28 mm (05/10)
      const papier = new THREE.Mesh(new THREE.PlaneGeometry(EL, PIECE), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .8, envMapIntensity: .35 }));
      papier.position.set(L / 2 - 2.3 - EL / 2, cy, .045); tableau.add(papier);
      const eti = new THREE.Mesh(new THREE.PlaneGeometry(EL, EH), new THREE.MeshStandardMaterial({ map: te, roughness: .7, envMapIntensity: .35 }));
      eti.position.set(L / 2 - 2.3 - EL / 2, cy, .05); tableau.add(eti);
    }
    if (PP) {   // rebord blanc
      const r = new THREE.Mesh(new THREE.PlaneGeometry(lw, lh), new THREE.MeshStandardMaterial({ color: 0xfaf6ec, roughness: .95, envMapIntensity: .3 }));
      r.position.z = 0; tableau.add(r);
    }
    if (o.cadre !== "aucun") {
      const or = new THREE.MeshStandardMaterial({ color: 0xffffff, map: texStries(o.cadre, false), bumpMap: texStries(o.cadre, true), bumpScale: .04,
        metalness: o.cadre === "or" ? .85 : .1, roughness: o.cadre === "or" ? .3 : .42, envMapIntensity: o.cadre === "or" ? .75 : .4 });
      const PROFIL = (() => {
        // Quart-de-rond relevé sur la coupe du vrai cadre : flanc extérieur droit,
        // arrondi plein qui culmine côté extérieur et redescend en courbe douce vers l'œuvre.
        const p = [[0, -FOND + .4], [0, .12]];
        for (let i = 1; i <= 16; i++) { const t = i / 16; p.push([t * 1.2, .12 + .62 * Math.sin(t * Math.PI / 2)]); }
        for (let i = 1; i <= 10; i++) { const a = i / 10 * Math.PI / 2; p.push([1.2 + .4 * Math.sin(a), .34 + .4 * Math.cos(a)]); }
        p.push([1.6, -FOND + .4], [0, -FOND + .4]); return p;
      })();
      const cote = (A, B, d, nn) => {
        const len = Math.hypot(B[0] - A[0], B[1] - A[1]), pos = [], uv = [], idx = []; let arc = 0;
        PROFIL.forEach(([u, z], k) => { if (k) arc += Math.hypot(u - PROFIL[k - 1][0], z - PROFIL[k - 1][1]);
          const s0 = -u, s1 = len + u;
          pos.push(A[0] + d[0] * s0 + nn[0] * u, A[1] + d[1] * s0 + nn[1] * u, z, A[0] + d[0] * s1 + nn[0] * u, A[1] + d[1] * s1 + nn[1] * u, z);
          uv.push(s0 / 32, arc / 2.2, s1 / 32, arc / 2.2); });
        for (let k = 0; k < PROFIL.length - 1; k++) { const a0 = 2 * k; idx.push(a0, a0 + 1, a0 + 3, a0, a0 + 3, a0 + 2); }
        const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
        return new THREE.Mesh(g, or);
      };
      const ax = lw / 2, ay = lh / 2;
      tableau.add(cote([-ax, ay], [ax, ay], [1, 0], [0, 1]), cote([ax, ay], [ax, -ay], [0, -1], [1, 0]),
                  cote([ax, -ay], [-ax, -ay], [-1, 0], [0, -1]), cote([-ax, -ay], [-ax, ay], [0, 1], [-1, 0]));
      // verre : seulement ses reflets
      const vitre = new THREE.Mesh(new THREE.PlaneGeometry(lw, lh), new THREE.MeshPhysicalMaterial({ color: 0x000000, metalness: 0, roughness: 0, reflectivity: 0.5,   /* verre : ~4 % de face, Fresnel de biais */
      envMapIntensity: 0.42, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      holo(vitre.material); vitre.position.z = .3; tableau.add(vitre);
    }
    // ---------- dos ----------
    const ZD = -FOND + .85;
    ISOREL.repeat.set((lw + .4) / 18, (lh + .4) / 32.9);   // échelle réelle du carton
    const dos = new THREE.Mesh(new THREE.PlaneGeometry(lw + .4, lh + .4), new THREE.MeshStandardMaterial({ map: ISOREL, bumpMap: ISOREL, bumpScale: .004, roughness: .97, envMapIntensity: .28 }));
    dos.rotation.y = Math.PI; dos.position.z = ZD; tableau.add(dos);
    const noir = new THREE.MeshStandardMaterial({ color: 0x141414, metalness: .6, roughness: .45 });
    const pointe = (x, y, h) => { const m = new THREE.Mesh(new THREE.BoxGeometry(h ? .9 : .25, h ? .25 : .9, .06), noir); m.position.set(x, y, ZD - .03); tableau.add(m); };
    const bx = (lw + .4) / 2, by = (lh + .4) / 2;
    [-.5, 0, .5].forEach(t => { pointe(t * lw * .9, by - .2, false); pointe(t * lw * .9, -by + .2, false); });
    [-.6, -.2, .2, .6].forEach(t => { pointe(bx - .2, t * lh / 2, true); pointe(-bx + .2, t * lh / 2, true); });   // t en demi-hauteur : sinon les pointes sortaient du cadre
    const matA = new THREE.MeshStandardMaterial({ map: ATTACHE, transparent: true, alphaTest: .5, metalness: .85, roughness: .35, side: THREE.DoubleSide });
    const attache = (x, y, rot) => { const g = new THREE.Group(); const pl = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.6), matA); pl.rotation.y = Math.PI;
      const ch = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, 1.55, 10), new THREE.MeshStandardMaterial({ color: 0xd8c27a, metalness: .9, roughness: .3 }));
      ch.position.z = -.05; g.add(pl, ch); g.rotation.z = rot; g.position.set(x, y, ZD - .02); tableau.add(g); };
    attache(0, lh / 2 - 7, Math.PI / 2); attache(lw / 2 - 6, 2, 0);

    // Cartouche réel (aperçu masqué de CARTOUCHE), 18,59 × 21,54 cm, à 2,5 cm du coin bas-droit vu de dos.
    const CW = 18.59, CH = 21.54, cx = -(lw / 2 - 2.5 - CW / 2), cy = -(lh / 2 - 2.5 - CH / 2);
    if (o.cartouche) {
      const tc = loader.load(o.cartouche); tc.encoding = THREE.sRGBEncoding; tc.anisotropy = renderer.capabilities.getMaxAnisotropy();
      const cart = new THREE.Mesh(new THREE.PlaneGeometry(CW, CH), new THREE.MeshStandardMaterial({ map: tc, roughness: .9, envMapIntensity: .3 }));
      cart.rotation.y = Math.PI; cart.position.set(cx, cy, ZD - .02); tableau.add(cart);
      // Le scellé RÉEL (planche de stickers.py : 23,5 × 25,2 mm, logo rouge répété),
      // centré sur la case du jeton MESURÉE sur ce cartouche (o.jeton, fractions).
      const z = o.jeton || [.016, .65, .139, .765];
      const cw = 2.35, chh = 2.52;
      const qx = ((z[0] + z[2]) / 2 - .5) * CW, qtop = (.5 - (z[1] + z[3]) / 2) * CH + chh / 2;
      pivotCache = new THREE.Group();
      cacheMesh = new THREE.Mesh(new THREE.PlaneGeometry(cw, chh), new THREE.MeshStandardMaterial({ map: SCELLE, roughness: .6, envMapIntensity: .3, side: THREE.DoubleSide }));
      cacheMesh.position.y = -chh / 2; pivotCache.add(cacheMesh); pivotCache.rotation.y = Math.PI;
      pivotCache.position.set(cx - qx, cy + qtop, ZD - .035); tableau.add(pivotCache);
    }
    $("bCache").hidden = !o.cartouche;
    const D = Math.max(lw, lh);
    DIM = { w: lw + 3.2, h: lh + 3.2, D };
    VUES = { face: { p: [0, 0, D * 2.05], t: [0, 0, 0] }, biais: { p: [D * 1.05, D * .2, D * 1.6], t: [0, 0, 0] },
             detail: { p: [lw * .2, lh * .15, D * .65], t: [lw * .16, lh * .12, 0] },
             dos: { p: [-D * .45, D * .1, -D * 1.9], t: [0, 0, 0] },
             // dos vu bien en face, comme une photo : verso de la page de vérification
             dosface: { p: [0, 0, -D * 2.05], t: [0, 0, 0] },
             // de dos, reculé et visé sous le cartouche pour qu'il remonte au-dessus du cartel
             cartouche: { p: [cx + 4, cy - 4, -62], t: [cx + 4, cy - 9, -2] } };
    // capture : la vue demandée (?vue=dosface…), sinon trois quarts
    const vueInit = new URLSearchParams(location.search).has("capture") && new URLSearchParams(location.search).get("vue");
    aller(vueInit && VUES[vueInit] ? vueInit : "biais", true);
  }

  // ---------- vues et animation ----------
  let anim = null;
  // Recul automatique : en portrait (téléphone), le cadre entier doit tenir en LARGEUR.
  // Les vues sont écrites pour un écran large ; on les éloigne d'autant qu'il faut.
  let DIM = { w: 1, h: 1, D: 1 };
  function recul() {
    const v = THREE.MathUtils.degToRad(camera.fov) / 2, h = Math.atan(Math.tan(v) * camera.aspect);
    const besoin = Math.max((DIM.h / 2) / Math.tan(v), (DIM.w / 2) / Math.tan(h)) * 1.12;
    return Math.max(1, besoin / (DIM.D * 2.05));
  }
  function aller(nom, direct) {
    const v = VUES[nom]; if (!v) return;
    const p0 = camera.position.clone(), t0 = controls.target.clone(), p1 = new THREE.Vector3(...v.p), t1 = new THREE.Vector3(...v.t);
    if (nom === "face" || nom === "biais" || nom === "dos" || nom === "dosface") p1.sub(t1).multiplyScalar(recul()).add(t1);
    if (direct) { camera.position.copy(p1); controls.target.copy(t1); return; }
    const reduit = matchMedia("(prefers-reduced-motion: reduce)").matches, duree = reduit ? 1 : 900, debut = performance.now();
    anim = now => { const k = Math.min(1, (now - debut) / duree), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      camera.position.lerpVectors(p0, p1, e); controls.target.lerpVectors(t0, t1, e); if (k >= 1) anim = null; };
  }
  function majCache() { const b = $("bCache"); b.setAttribute("aria-pressed", cacheOuvert); b.textContent = cacheOuvert ? "Recoller le cache" : "Décoller le cache"; }
  document.querySelectorAll("[data-vue]").forEach(b => b.addEventListener("click", () => aller(b.dataset.vue)));
  $("bCache").addEventListener("click", () => { if (!cacheOuvert) aller("cartouche"); cacheOuvert = !cacheOuvert; majCache(); });
  const rayon = new THREE.Raycaster(), souris = new THREE.Vector2(); let depart = null;
  canvas.addEventListener("pointerdown", e => { depart = [e.clientX, e.clientY]; });
  canvas.addEventListener("pointerup", e => {
    if (!cacheMesh || !depart || Math.hypot(e.clientX - depart[0], e.clientY - depart[1]) > 6) return;
    const r = canvas.getBoundingClientRect(); souris.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    rayon.setFromCamera(souris, camera); if (rayon.intersectObject(cacheMesh).length) { cacheOuvert = !cacheOuvert; majCache(); }
  });
  function taille() { const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  addEventListener("resize", taille);
  // Capture : une fois toutes les textures chargées, quelques images puis arrêt de
  // la boucle, pour que Chrome sans écran puisse prendre sa photo et terminer.
  const CAPTURE = new URLSearchParams(location.search).has("capture");
  let texturesPretes = false, imagesApres = 0;
  THREE.DefaultLoadingManager.onLoad = () => { texturesPretes = true; };
  // Pivot automatique (carte du répertoire ET dossier) : un lent va-et-vient de
  // ±14° autour de la vue courante, suspendu pendant que l'on manipule, repris
  // 2,5 s après. Volontairement indépendant du réglage « réduire les
  // animations » : demande explicite de l'artiste (05/10/2026), mouvement lent.
  // (révision 2 : nouvelle empreinte du script après un échec de construction GitHub)
  const pivot = { libre: true, reprise: 0, angle: 0, t: 0, dernier: 0 };
  controls.addEventListener("start", () => { pivot.libre = false; });
  controls.addEventListener("end", () => { pivot.reprise = performance.now() + 2500; pivot.libre = true; });
  const _axeY = new THREE.Vector3(0, 1, 0), _off = new THREE.Vector3();
  function pivoter(now) {
    const dt = Math.min(.05, (now - (pivot.dernier || now)) / 1000); pivot.dernier = now;
    if (CAPTURE || !pivot.libre || now < pivot.reprise) return;
    pivot.t += dt;
    const cible = 0.24 * Math.sin(pivot.t * 2 * Math.PI / 24);          // ±14°, un aller-retour en 24 s
    _off.copy(camera.position).sub(controls.target).applyAxisAngle(_axeY, cible - pivot.angle);
    camera.position.copy(controls.target).add(_off); pivot.angle = cible;
  }
  (function boucle(now) {
    if (CAPTURE && texturesPretes && ++imagesApres > 30) { document.title = "capture-prete"; return; }
    requestAnimationFrame(boucle); if (anim) anim(now); else pivoter(now);
    // Carte : prévenir la page du répertoire quand la 3D est vraiment dessinée,
    // pour qu'elle la révèle à ce moment-là (jamais l'en-tête ni une scène vide).
    if (CARTE && texturesPretes && !pivot.annonce && ++imagesApres > 3) {
      pivot.annonce = true; try { window.parent.postMessage({ type: "deligny-3d-pret" }, "*"); } catch (e) {}
    }
    if (pivotCache) { cacheAngle += ((cacheOuvert ? 2.4 : 0) - cacheAngle) * .12; pivotCache.rotation.x = cacheAngle; }
    controls.update(); renderer.render(scene, camera);
  })(performance.now());

  // ---------- liste des œuvres ----------
  let ITEMS = [];
  function choisir(i) {
    const o = ITEMS[i];
    document.querySelectorAll(".oeuvre").forEach((b, k) => b.setAttribute("aria-pressed", k === i));
    $("photoImg").src = o.photo;
    $("cRef").textContent = o.id;
    $("cTitre").textContent = o.titre || ("Titre à choisir : " + (o.titres_proposes || []).join(", "));
    const cadreNom = { or: "baguette dorée sous verre", noir: "baguette noire sous verre", blanc: "baguette blanche sous verre", aucun: "sans cadre" }[o.cadre];
    $("cFiche").innerHTML = [["Artiste", o.artiste], ["Création", o.date], ["Technique", o.technique],
      ["Format", o.dimensions], ["Cadre", cadreNom + (o.passe_partout_mm ? ", rebord blanc " + o.passe_partout_mm + " mm" : "")],
      ["Édition", o.edition], ["Prix public", o.prix_public], o.numero_serie ? ["N° série", o.numero_serie] : null, ["Statut", o.statut]]
      .filter(x => x && x[1]).map(([k, v]) => "<dt>" + esc(k) + "</dt><dd>" + esc(v) + "</dd>").join("");
    const notes = [];
    if (!o.cartouche) notes.push("Pas encore de cartouche au dos : l'œuvre n'est pas signée.");
    if (!o.image_redressee) notes.push("Image à recadrer : la 3D montre la photo telle qu'elle a été prise.");
    $("cNote").textContent = notes.join(" ");
    // Extrait de l'intention et lien vers le certificat (galerie publique)
    $("cIntention").textContent = o.intention || ""; $("cIntention").hidden = !o.intention;
    $("cVerif").hidden = !o.verifier; if (o.verifier) $("cVerif").href = o.verifier;
    espaceProprio(o);
    const img = new Image();
    img.onload = () => monter(o, { w: img.naturalWidth, h: img.naturalHeight });
    img.src = o.image_3d;
    try { localStorage.setItem("galerie.choix", o.id); } catch (e) {}
  }
  fetch("data.json?v=bb91a5be").then(r => r.json()).then(d => {
    ITEMS = d.items || [];
    $("liste").innerHTML = ITEMS.map((o, i) => `<button type="button" class="oeuvre" data-i="${i}" aria-pressed="false">
        <img src="${esc(o.photo)}" alt="" loading="lazy">
        <div><div class="t">${esc(o.titre || (o.titres_proposes || [])[0] || "Sans titre")}${o.titre ? "" : " ?"}</div>
        <div class="m">${esc(o.id.replace("DLG-ART-2026-", ""))} · ${esc(o.dimensions)}<br>${esc(o.prix_public)}${o.numero_serie ? " · " + esc(o.numero_serie) : ""}</div>
        <span class="pastille ${o.statut === "publié" ? "publie" : ""}">${esc(o.statut)}</span></div></button>`).join("");
    document.querySelectorAll(".oeuvre").forEach(b => b.addEventListener("click", () => choisir(+b.dataset.i)));
    let dep = 0; try { const m = localStorage.getItem("galerie.choix"); const k = ITEMS.findIndex(o => o.id === m); if (k >= 0) dep = k; } catch (e) {}
    const k = location.hash ? ITEMS.findIndex(o => o.id === location.hash.slice(1)) : -1;
    // Aperçu de l'atelier : le cadre et le rebord en cours de choix, même non enregistrés.
    const Q = new URLSearchParams(location.search);
    if (k >= 0 && Q.has("cadre")) ITEMS[k].cadre = Q.get("cadre");
    if (k >= 0 && Q.has("pp")) ITEMS[k].passe_partout_mm = +Q.get("pp") || 0;
    taille(); if (ITEMS.length) choisir(k >= 0 ? k : dep);
  });
})();
