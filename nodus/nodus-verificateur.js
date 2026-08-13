/* ------------------------------------------------------------------ base45
   RFC 9285. Alphabet identique au mode alphanumérique du QR, ce qui est la
   raison d'être de cet encodage : il fait tenir la signature sur du papier. */
const B45 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
function base45Decode(txt) {
  const v = [];
  for (const c of txt) {
    const i = B45.indexOf(c);
    if (i < 0) throw new Error("caractère hors alphabet base45 : " + c);
    v.push(i);
  }
  const out = [];
  let i = 0;
  for (; i + 2 < v.length; i += 3) {
    const n = v[i] + v[i + 1] * 45 + v[i + 2] * 2025;
    if (n > 0xffff) throw new Error("groupe base45 hors bornes");
    out.push(n >> 8, n & 0xff);
  }
  const reste = v.length - i;
  if (reste === 2) {
    const n = v[i] + v[i + 1] * 45;
    if (n > 0xff) throw new Error("dernier groupe base45 hors bornes");
    out.push(n);
  } else if (reste === 1) throw new Error("longueur base45 invalide");
  return new Uint8Array(out);
}

/* ------------------------------------------------- lecture de la charge
   Miroir exact de nodus/passeport.py. Toute divergence ici se verrait
   immédiatement : la signature ne porterait plus sur les mêmes octets. */
const ALGOS = { 1: "ed25519", 2: "ecdsa-p256" };
const EPOQUE = 1577836800;
const PREFIXE = "NODUS1:";

/* Un lot est reconnu à sa magie "N2". Les deux lecteurs sont volontairement
   écrits séparément plutôt que fusionnés : leurs octets ne sont pas dans le
   même ordre, et un lecteur unique à rallonges finirait par lire un format
   avec les règles de l'autre. */
function lire(charge) {
  if (charge[0] === 78 && charge[1] === 50) return lireLot(charge);
  return lireIndividuel(charge);
}

function lireLot(charge) {
  const algo = ALGOS[charge[2]];
  if (!algo) throw new Error("algorithme de code " + charge[2] + " inconnu de ce vérificateur");
  let i = 4;
  const bloc = () => {
    const n = charge[i];
    const v = charge.slice(i + 1, i + 1 + n);
    if (v.length !== n) throw new Error("champ tronqué");
    i += 1 + n;
    return v;
  };
  const txt = (u) => new TextDecoder().decode(u);
  const hex = (u) => [...u].map(b => b.toString(16).padStart(2, "0")).join("");
  const emetteur = txt(bloc());
  const lot = txt(bloc());
  const minutes = new DataView(charge.buffer, charge.byteOffset + i, 4).getUint32(0); i += 4;
  const racine = charge.slice(i, i + 32); i += 32;
  if (racine.length !== 32) throw new Error("racine tronquée");
  const publique = bloc();
  const finEntete = i;
  const signature = bloc();
  const debutObjet = i;
  const objet = txt(bloc());
  const version = charge[i]; i += 1;
  const sha = charge.slice(i, i + 32); i += 32;
  const visuelle = charge.slice(i, i + 8); i += 8;
  if (sha.length !== 32 || visuelle.length !== 8) throw new Error("empreintes tronquées");
  const finEnregistrement = i;
  const rang = new DataView(charge.buffer, charge.byteOffset + i, 4).getUint32(0); i += 4;
  /* Chemin d'inclusion : un octet de profondeur, un champ de bits pour les
     côtés, puis un frère de 32 octets par niveau. */
  const p = charge[i]; i += 1;
  const nbits = Math.ceil(p / 8);
  const bits = charge.slice(i, i + nbits); i += nbits;
  if (bits.length !== nbits || charge.length - i < p * 32) throw new Error("chemin tronqué");
  const chemin = [];
  for (let k = 0; k < p; k++) {
    chemin.push({ cote: (bits[k >> 3] & (1 << (k % 8))) ? "g" : "d",
                  frere: charge.slice(i, i + 32) });
    i += 32;
  }
  if (i !== charge.length) throw new Error("octets excédentaires après le chemin");
  const d = new Date((EPOQUE + minutes * 60) * 1000);
  return { type: "lot", algo, emetteur, lot, objet, version, minutes, rang, niveaux: p,
           date: d.toISOString().slice(0, 16).replace("T", " "),
           sha: hex(sha), visuelle: hex(visuelle), racine, racineHex: hex(racine),
           publique, publiqueHex: hex(publique), signature,
           corps: charge.slice(0, finEntete),
           enregistrement: charge.slice(debutObjet, finEnregistrement),
           chemin, octets: charge.length };
}

function lireIndividuel(charge) {
  if (charge[0] !== 78 || charge[1] !== 49) throw new Error("en-tête inconnu");
  const algo = ALGOS[charge[2]];
  if (!algo) throw new Error("algorithme de code " + charge[2] + " inconnu de ce vérificateur");
  let i = 4;
  const bloc = () => {
    const n = charge[i];
    const v = charge.slice(i + 1, i + 1 + n);
    if (v.length !== n) throw new Error("champ tronqué");
    i += 1 + n;
    return v;
  };
  const txt = (u) => new TextDecoder().decode(u);
  const hex = (u) => [...u].map(b => b.toString(16).padStart(2, "0")).join("");
  const emetteur = txt(bloc());
  const objet = txt(bloc());
  const version = charge[i]; i += 1;
  const minutes = new DataView(charge.buffer, charge.byteOffset + i, 4).getUint32(0); i += 4;
  const sha = hex(charge.slice(i, i + 32)); i += 32;
  const visuelle = hex(charge.slice(i, i + 8)); i += 8;
  const publique = bloc();
  const finCorps = i;
  const signature = bloc();
  if (i !== charge.length) throw new Error("octets excédentaires après la signature");
  const d = new Date((EPOQUE + minutes * 60) * 1000);
  return { type: "individuel", algo, emetteur, objet, version, minutes,
           date: d.toISOString().slice(0, 16).replace("T", " "),
           sha, visuelle, publique, publiqueHex: hex(publique),
           signature, corps: charge.slice(0, finCorps), octets: charge.length };
}

/* ------------------------------------------------------- arbre de Merkle
   Séparation de domaine identique à nodus/merkle.py : 0x00 devant une
   feuille, 0x01 devant un nœud. Sans elle, un nœud interne pourrait être
   présenté comme une donnée légitime. */
async function sha256brut(u8) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", u8));
}
function concat(...morceaux) {
  const n = morceaux.reduce((s, m) => s + m.length, 0);
  const out = new Uint8Array(n);
  let i = 0;
  for (const m of morceaux) { out.set(m, i); i += m.length; }
  return out;
}
const feuilleMerkle = (d) => sha256brut(concat(new Uint8Array([0]), d));
const noeudMerkle = (g, d) => sha256brut(concat(new Uint8Array([1]), g, d));

async function verifierInclusion(enregistrement, chemin, racine) {
  let courant = await feuilleMerkle(enregistrement);
  for (const { cote, frere } of chemin) {
    courant = cote === "g" ? await noeudMerkle(frere, courant)
                           : await noeudMerkle(courant, frere);
  }
  return courant.length === racine.length && courant.every((b, i) => b === racine[i]);
}

/* ------------------------------------------------------ vérification WebCrypto
   P-256 est disponible dans tous les navigateurs ; Ed25519 est récent. Quand
   il manque, on le dit au lieu d'afficher un rouge trompeur : un vérificateur
   qui confond « je ne sais pas » et « c'est faux » est pire qu'inutile. */
async function verifierSignature(algo, publique, message, signature) {
  if (algo === "ed25519") {
    if (!("subtle" in crypto)) throw new Error("WebCrypto indisponible");
    let cle;
    try {
      cle = await crypto.subtle.importKey("raw", publique, { name: "Ed25519" }, false, ["verify"]);
    } catch (e) {
      throw new Error("INCONNU:ce navigateur ne sait pas vérifier Ed25519");
    }
    return crypto.subtle.verify({ name: "Ed25519" }, cle, signature, message);
  }
  if (algo === "ecdsa-p256") {
    const cle = await crypto.subtle.importKey(
      "raw", publique, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    return crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, cle, signature, message);
  }
  throw new Error("algorithme non pris en charge : " + algo);
}

async function sha256hex(u8) {
  const h = await crypto.subtle.digest("SHA-256", u8);
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, "0")).join("");
}

/* ------------------------------------------------------------ forme canonique
   Le piège central du système. Refaire en JavaScript le tri et l'échappement de
   Python, c'est parier sur une équivalence qui finit par se rompre. Là où c'est
   possible on l'évite en publiant les octets signés ; pour un certificat JSON
   déposé par l'utilisateur, il n'y a pas d'autre voie que de recanonicaliser.
   Alors on le fait de façon STRICTE, et on refuse tout ce qui pourrait diverger
   au lieu de produire silencieusement de mauvais octets. */
/* Lecture JSON qui PRÉSERVE les littéraux numériques.
   `JSON.parse` perd une information dont la forme canonique dépend : Python
   écrit `1.0` là où JavaScript écrit `1`, et une fois passé par `JSON.parse`
   plus rien ne distingue l'un de l'autre. Le manifeste d'une œuvre porte des
   scores de confiance valant 1.0, 0.85, 0.9 : recanonicaliser après un
   `JSON.parse` produirait donc d'autres octets que ceux qui ont été signés, et
   la vérification échouerait sur un certificat parfaitement valide.
   On garde donc le texte exact de chaque nombre et on le réémet tel quel. */
class NombreBrut {
  constructor(jeton) { this.jeton = jeton; }
  valueOf() { return Number(this.jeton); }
  toJSON() { return Number(this.jeton); }
  toString() { return this.jeton; }
}

function analyserJson(texte) {
  let i = 0;
  const blancs = () => { while (i < texte.length && " \t\n\r".includes(texte[i])) i++; };
  function valeur() {
    blancs();
    const c = texte[i];
    if (c === "{") {
      i++; const o = {}; blancs();
      if (texte[i] === "}") { i++; return o; }
      for (;;) {
        blancs();
        if (texte[i] !== '"') throw new Error("clé attendue en position " + i);
        const cle = chaine();
        blancs();
        if (texte[i] !== ":") throw new Error("':' attendu en position " + i);
        i++;
        o[cle] = valeur();
        blancs();
        if (texte[i] === ",") { i++; continue; }
        if (texte[i] === "}") { i++; return o; }
        throw new Error("',' ou '}' attendu en position " + i);
      }
    }
    if (c === "[") {
      i++; const a = []; blancs();
      if (texte[i] === "]") { i++; return a; }
      for (;;) {
        a.push(valeur());
        blancs();
        if (texte[i] === ",") { i++; continue; }
        if (texte[i] === "]") { i++; return a; }
        throw new Error("',' ou ']' attendu en position " + i);
      }
    }
    if (c === '"') return chaine();
    if (texte.startsWith("true", i)) { i += 4; return true; }
    if (texte.startsWith("false", i)) { i += 5; return false; }
    if (texte.startsWith("null", i)) { i += 4; return null; }
    return nombre();
  }
  function chaine() {
    const debut = i;
    i++;
    while (i < texte.length) {
      if (texte[i] === "\\") { i += 2; continue; }
      if (texte[i] === '"') { i++; return JSON.parse(texte.slice(debut, i)); }
      i++;
    }
    throw new Error("chaîne non terminée");
  }
  function nombre() {
    const debut = i;
    if (texte[i] === "-") i++;
    while (i < texte.length && "0123456789+-.eE".includes(texte[i])) i++;
    const jeton = texte.slice(debut, i);
    if (!/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(jeton)) {
      throw new Error("nombre invalide : " + jeton);
    }
    return new NombreBrut(jeton);
  }
  const v = valeur();
  blancs();
  if (i !== texte.length) throw new Error("caractères en trop après la valeur");
  return v;
}

function comparerCodePoints(a, b) {
  const A = Array.from(a), B = Array.from(b);
  for (let i = 0; i < Math.min(A.length, B.length); i++) {
    const x = A[i].codePointAt(0), y = B[i].codePointAt(0);
    if (x !== y) return x - y;
  }
  return A.length - B.length;
}

function serialiserCanonique(v) {
  if (v === null) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (v instanceof NombreBrut) return v.jeton;   // réémis à l'identique
  if (typeof v === "number") {
    if (!Number.isInteger(v)) {
      throw new Error("nombre non entier issu d'un JSON.parse : le littéral "
        + "d'origine est perdu, employer analyserJson() pour le conserver");
    }
    return String(v);
  }
  if (typeof v === "string") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(serialiserCanonique).join(",") + "]";
  if (typeof v === "object") {
    const cles = Object.keys(v).sort(comparerCodePoints);
    return "{" + cles.map(k => JSON.stringify(k) + ":"
      + serialiserCanonique(v[k])).join(",") + "}";
  }
  throw new Error("type non sérialisable : " + typeof v);
}

function canonique(objet, sauf) {
  const filtre = {};
  for (const k of Object.keys(objet)) if (k !== sauf) filtre[k] = objet[k];
  return new TextEncoder().encode(serialiserCanonique(filtre));
}

/* -------------------------------------------------------------- trousseau
   On vérifie les endossements sur les OCTETS CANONIQUES publiés, jamais sur
   une recanonicalisation locale : refaire en JavaScript le tri et
   l'échappement JSON de Python, c'est parier sur une équivalence qui finit
   toujours par se rompre sur un caractère exotique. */
function b64(s) {
  const b = atob(s);
  const u = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  return u;
}
function hexVersOctets(h) {
  const u = new Uint8Array(h.length / 2);
  for (let i = 0; i < u.length; i++) u[i] = parseInt(h.substr(i * 2, 2), 16);
  return u;
}

async function chargerTrousseau(emetteur) {
  /* Où lire l'annuaire des clés. Une page qui n'est pas servie à côté des
     trousseaux le déclare via window.NODUS_ANNUAIRE : c'est le cas de la fiche
     d'une œuvre, qui vit dans /art/verify/<id>/ pendant que les trousseaux
     vivent dans /nodus/. Le paramètre d'URL reste possible pour les bancs, et
     reste borné par `connect-src 'self'` : aucune de ces valeurs ne peut faire
     lire un trousseau servi par un tiers. */
  const base = new URLSearchParams(location.search).get("annuaire")
    || (typeof window !== "undefined" && window.NODUS_ANNUAIRE) || "./";
  /* Paramètre de fraîcheur, changé chaque minute. Le trousseau est l'ancre de
     confiance : une révocation qui met quatre heures à se propager parce qu'un
     CDN garde l'ancienne version laisserait valider pendant tout ce temps une
     clé déclarée compromise. `cache: "no-store"` ne concerne que le cache du
     navigateur, il ne traverse pas un serveur périphérique ; une URL qui change
     le traverse. Coût : deux kilooctets par minute et par visiteur. */
  const minute = Math.floor(Date.now() / 60000);
  const url = base.replace(/\/?$/, "/") + encodeURIComponent(emetteur)
    + "/trousseau.verif.json?f=" + minute;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error("trousseau introuvable (" + r.status + ")");
  return r.json();
}

async function verifierTrousseau(t) {
  const racine = (t.emetteur || {}).racine_cle_publique || "";
  const algoRacine = t.racine_algo || "ed25519";
  let precedente = null;
  const entrees = [];
  for (const e of (t.entrees || [])) {
    const octets = b64(e.canonique_b64);
    const end = e.endossement || {};
    let ok = false;
    try {
      ok = end.par === racine && await verifierSignature(
        algoRacine, hexVersOctets(end.par), octets, hexVersOctets(end.valeur_hex));
    } catch (err) { if (String(err.message).startsWith("INCONNU:")) throw err; }
    const objet = JSON.parse(new TextDecoder().decode(octets));
    const chaineOk = (objet.entree_precedente_sha256 || null) === precedente;
    precedente = await sha256hex(octets);
    entrees.push({ objet, ok, chaineOk });
  }
  const premiere = entrees[0] && entrees[0].objet;
  const racineCoherente = !!premiere && premiere.action === "racine"
    && premiere.cle_publique === racine;
  return { entrees, racine, racineCoherente,
           toutOk: entrees.length > 0 && racineCoherente
                   && entrees.every(x => x.ok && x.chaineOk) };
}

function parcDesCles(entrees) {
  const parc = {};
  for (const { objet: e } of entrees) {
    const c = e.cle_publique;
    if (e.action === "racine" || e.action === "inscrire") {
      parc[c] = { role: e.role, algo: e.algo || "ed25519",
                  depuis: e.valide_depuis, jusqu: e.valide_jusqu || null };
    } else if (e.action === "revoquer" && parc[c]) {
      parc[c].jusqu = e.valide_depuis;
    }
  }
  return parc;
}

/* ------------------------------------------------- vérification d'un manifeste
   La fiche publique d'un objet publie son manifeste signé. Le vérifier suppose
   de recanonicaliser ici les mêmes octets que Python a signés : c'est le seul
   endroit du système où ce pari est pris, et il est éprouvé par des bancs qui
   comparent aux octets réellement produits par Python.

   Ce que cette fonction établit, et ce qu'elle n'établit PAS. Elle établit que
   CE manifeste n'a pas bougé et que la clé qui l'a signé appartient bien à
   l'émetteur. Elle n'établit pas la chaîne des versions antérieures, qui n'est
   pas publiée : une v2 authentique ne prouve pas à elle seule qu'aucune v1
   n'a été réécrite. Le dire est préférable à le laisser croire. */
async function verifierManifeste(manifesteOuTexte, emetteur) {
  const r = { signature_ok: false, empreinte_ok: false, emetteur_reconnu: null,
              authentique: false, motif: "", etapes: [], cle: "", algo: "" };
  let manifeste;
  try {
    manifeste = typeof manifesteOuTexte === "string"
      ? analyserJson(manifesteOuTexte) : manifesteOuTexte;
  } catch (e) {
    r.motif = "manifeste illisible : " + e.message;
    return r;
  }
  const sig = manifeste && manifeste.signature;
  if (!sig || !sig.valeur_hex || !sig.cle_publique) {
    r.motif = "manifeste sans signature exploitable";
    return r;
  }
  r.cle = String(sig.cle_publique);

  let octets;
  try {
    octets = canonique(manifeste, "signature");
  } catch (e) {
    r.motif = "forme canonique impossible : " + e.message;
    return r;
  }

  /* L'empreinte imprimée sur le cartouche doit correspondre à ce qu'on vient
     de recalculer : c'est ce qui relie le papier au fichier. */
  const empreinte = await sha256hex(octets);
  r.empreinte_ok = !sig.manifeste_sha256 || empreinte === String(sig.manifeste_sha256);
  r.empreinte = empreinte;

  let algo = "ed25519", parc = null;
  try {
    const t = await chargerTrousseau(emetteur);
    const vt = await verifierTrousseau(t);
    if (!vt.toutOk) {
      r.etapes.push(["✕", "trousseau de l'émetteur invalide"]);
      r.motif = "trousseau de l'émetteur invalide";
      return r;
    }
    r.etapes.push(["✓", "trousseau de " + emetteur + " valide, "
      + vt.entrees.length + " entrée(s)"]);
    parc = parcDesCles(vt.entrees);
    if (parc[r.cle]) algo = parc[r.cle].algo;
  } catch (e) {
    r.etapes.push(["◇", "trousseau injoignable (" + e.message + ")"]);
  }
  r.algo = algo;

  try {
    r.signature_ok = await verifierSignature(algo, hexVersOctets(String(sig.cle_publique)),
                                             octets, hexVersOctets(String(sig.valeur_hex)));
  } catch (e) {
    r.motif = e.message.replace(/^INCONNU:/, "");
    r.indetermine = true;
    return r;
  }
  r.etapes.push([r.signature_ok ? "✓" : "✕",
    r.signature_ok ? "manifeste intact, pas un octet modifié depuis sa signature"
                   : "signature invalide : le manifeste a été modifié"]);
  if (!r.signature_ok) { r.motif = "signature invalide"; return r; }

  if (!r.empreinte_ok) {
    r.etapes.push(["✕", "l'empreinte inscrite au manifeste ne correspond pas"]);
    r.motif = "empreinte incohérente";
    return r;
  }

  if (!parc) {
    r.motif = "manifeste intact, mais l'émetteur n'a pas été confronté à son "
            + "trousseau : preuve incomplète";
    return r;
  }
  const fiche = parc[r.cle];
  const d = String((manifeste.chronologie || {}).generation_document || "");
  let refus = null;
  if (!fiche) refus = "clé absente du trousseau de l'émetteur";
  else if (fiche.role === "racine") refus = "clé racine, non habilitée à signer";
  else if (fiche.depuis && d && d < fiche.depuis) refus = "clé pas encore habilitée à cette date";
  else if (fiche.jusqu && d && d >= fiche.jusqu) refus = "clé révoquée le " + fiche.jusqu;
  r.emetteur_reconnu = !refus;
  r.authentique = !refus;
  r.etapes.push([refus ? "✕" : "✓",
    refus || ("clé " + fiche.algo + " endossée par la racine de " + emetteur)]);
  r.motif = refus || "manifeste authentique";
  return r;
}

/* ----------------------------------------------------------------- verdict */
function poser(classe, titre, motif, etapes, champs) {
  const v = document.getElementById("verdict");
  v.style.display = "block";
  v.className = classe;
  document.getElementById("verdict-titre").textContent = titre;
  document.getElementById("verdict-motif").textContent = motif;
  document.getElementById("verdict-etapes").innerHTML = (etapes || [])
    .map(([m, t]) => `<div>${m} <b>${t}</b></div>`).join("");
  document.getElementById("verdict-table").innerHTML = (champs || [])
    .map(([k, val, mono]) => `<tr><th>${k}</th><td class="${mono ? "mono" : ""}">${val}</td></tr>`)
    .join("");
  v.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function champsDe(p) {
  const champs = [
    ["Objet", p.objet, true],
    ["Émetteur annoncé", p.emetteur, false],
    ["Version du certificat", p.version, false],
    ["Scellé le", p.date + " UTC", false],
    ["Empreinte du manifeste", p.sha, true],
    ["Empreinte visuelle de la photo", p.visuelle, true],
    ["Algorithme", p.algo, false],
    ["Clé publique signataire", p.publiqueHex, true],
    ["Taille du passeport", p.octets + " octets", false],
  ];
  if (p.type === "lot") {
    champs.splice(1, 0,
      ["Lot", p.lot + " · rang " + p.rang, false],
      ["Racine du lot", p.racineHex, true]);
  }
  return champs;
}

async function verifier(texte) {
  texte = (texte || "").trim();
  let p;
  try {
    const up = texte.toUpperCase();
    if (!up.startsWith(PREFIXE)) throw new Error("ce n'est pas un passeport NODUS");
    p = lire(base45Decode(texte.slice(PREFIXE.length).trim()));
  } catch (e) {
    poser("non", "Illisible", e.message, [], []);
    return { etat: "illisible" };
  }

  const etapes = [];
  let sigOk = false, indetermine = false;

  /* Un passeport de lot doit d'abord prouver son appartenance à l'arbre signé.
     Sans ce contrôle, la signature du lot vaudrait pour n'importe quel objet
     recopié derrière le même en-tête. */
  if (p.type === "lot") {
    let inclusOk = false;
    try {
      inclusOk = await verifierInclusion(p.enregistrement, p.chemin, p.racine);
    } catch (e) { inclusOk = false; }
    if (!inclusOk) {
      etapes.push(["✕", "cet objet n'appartient pas au lot signé"]);
      poser("non", "Certificat non valide",
        "Le chemin d'inclusion de cet objet ne mène pas à la racine du lot. "
        + "L'objet a été substitué, ou le certificat a été assemblé à partir "
        + "de morceaux de deux certificats différents.", etapes, champsDe(p));
      return { etat: "inclusion_invalide", champs: p };
    }
    etapes.push(["✓", "objet inclus dans le lot " + p.lot + " (" + p.niveaux
      + " niveaux d'arbre)"]);
  }

  try {
    sigOk = await verifierSignature(p.algo, p.publique, p.corps, p.signature);
  } catch (e) {
    if (String(e.message).startsWith("INCONNU:")) {
      indetermine = true;
      etapes.push(["◇", "signature non vérifiable : " + e.message.slice(8)]);
    } else {
      poser("non", "Vérification impossible", e.message, [], []);
      return { etat: "impossible" };
    }
  }

  const champs = champsDe(p);

  if (indetermine) {
    poser("partiel", "Indéterminé", "Ce navigateur ne sait pas vérifier cet "
      + "algorithme. Le certificat n'est ni confirmé ni infirmé.", etapes, champs);
    return { etat: "indetermine", champs: p };
  }
  if (!sigOk) {
    etapes.push(["✕", "signature invalide"]);
    poser("non", "Certificat non valide",
      "La signature ne correspond pas au contenu : le passeport a été retouché, "
      + "ou il a été fabriqué.", etapes, champs);
    return { etat: "signature_invalide", champs: p };
  }
  etapes.push(["✓", "signature intacte, le contenu n'a pas été modifié"]);

  let t, verifT;
  try {
    t = await chargerTrousseau(p.emetteur);
    verifT = await verifierTrousseau(t);
  } catch (e) {
    etapes.push(["◇", "émetteur non confronté à son trousseau (" + e.message + ")"]);
    poser("partiel", "Intègre, émetteur non confirmé",
      "Le certificat n'a pas été retouché. Faute d'accès au trousseau de "
      + "l'émetteur, il n'est pas possible de confirmer que la clé qui l'a signé "
      + "est bien la sienne. Un faussaire produirait un certificat intact signé "
      + "de SA clé.", etapes, champs);
    return { etat: "hors_ligne", champs: p };
  }

  if (!verifT.toutOk) {
    etapes.push(["✕", "trousseau de l'émetteur invalide"]);
    poser("non", "Émetteur non fiable",
      "Le trousseau publié par cet émetteur ne se vérifie pas lui-même.",
      etapes, champs);
    return { etat: "trousseau_invalide", champs: p };
  }
  etapes.push(["✓", "trousseau de l'émetteur valide, " + verifT.entrees.length + " entrée(s)"]);

  const parc = parcDesCles(verifT.entrees);
  const fiche = parc[p.publiqueHex];
  const d = p.date + ":00";
  let refus = null;
  if ((t.emetteur || {}).id !== p.emetteur) refus = "le trousseau consulté est celui d'un autre émetteur";
  else if (!fiche) refus = "cette clé est absente du trousseau de l'émetteur";
  else if (fiche.role === "racine") refus = "clé racine, non habilitée à signer un document";
  else if (fiche.algo !== p.algo) refus = "algorithme divergent : le certificat annonce "
    + p.algo + ", le trousseau déclare " + fiche.algo + " pour cette clé";
  else if (fiche.depuis && d < fiche.depuis) refus = "clé pas encore habilitée à cette date";
  else if (fiche.jusqu && d >= fiche.jusqu) refus = "clé révoquée le " + fiche.jusqu;

  if (refus) {
    etapes.push(["✕", refus]);
    poser("non", "Certificat non authentique",
      "La signature est intacte, mais elle n'est pas celle de l'émetteur annoncé. "
      + "C'est exactement ce que produit une contrefaçon soignée.", etapes, champs);
    return { etat: "cle_refusee", champs: p, refus };
  }

  etapes.push(["✓", "clé " + fiche.algo + " endossée par la racine de " + p.emetteur]);
  champs.push(["Racine de l'émetteur", verifT.racine, true]);
  poser("ok", "Certificat authentique",
    "Signature intacte, et la clé signataire est bien endossée par la racine de "
    + p.emetteur + " à la date du scellage. Reste à comparer l'objet devant toi à "
    + "la photographie de référence.", etapes, champs);
  return { etat: "authentique", champs: p };
}

/* --------------------------------------------------------------- interface */
const _btnVerifier = document.getElementById("btn-verifier");
if (_btnVerifier) _btnVerifier.onclick = () =>
  verifier(document.getElementById("entree").value);
const _btnExemple = document.getElementById("btn-exemple");
if (_btnExemple) _btnExemple.onclick = async () => {
  const r = await fetch("exemple.txt").catch(() => null);
  if (r && r.ok) {
    document.getElementById("entree").value = (await r.text()).trim();
    verifier(document.getElementById("entree").value);
  }
};

/* Scan par la caméra. jsQR est chargé à la demande depuis la même origine :
   absent, le bouton se désactive proprement plutôt que de casser la page. */
const _btnCamera = document.getElementById("btn-camera");
if (_btnCamera) _btnCamera.onclick = async function () {
  const bouton = this, video = document.getElementById("apercu");
  if (!window.jsQR) {
    await new Promise((ok, ko) => {
      const s = document.createElement("script");
      s.src = "jsQR.js"; s.onload = ok; s.onerror = ko;
      document.head.appendChild(s);
    }).catch(() => {});
  }
  if (!window.jsQR) { bouton.disabled = true; bouton.textContent = "Scan indisponible"; return; }
  let flux;
  try {
    flux = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
  } catch (e) { bouton.disabled = true; bouton.textContent = "Caméra refusée"; return; }
  video.srcObject = flux; video.style.display = "block"; await video.play();
  const c = document.createElement("canvas"), ctx = c.getContext("2d", { willReadFrequently: true });
  const boucle = () => {
    if (!flux.active) return;
    if (video.videoWidth) {
      c.width = video.videoWidth; c.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      const r = window.jsQR(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
      if (r && r.data) {
        flux.getTracks().forEach(t => t.stop());
        video.style.display = "none";
        document.getElementById("entree").value = r.data;
        verifier(r.data);
        return;
      }
    }
    requestAnimationFrame(boucle);
  };
  boucle();
};

/* Point d'entrée pour les bancs automatisés et pour un lien direct
   verificateur/?p=NODUS1:... */
window.nodusVerifier = verifier;
const direct = new URLSearchParams(location.search).get("p");
if (direct && document.getElementById("entree")) {
  document.getElementById("entree").value = direct;
  verifier(direct);
}
