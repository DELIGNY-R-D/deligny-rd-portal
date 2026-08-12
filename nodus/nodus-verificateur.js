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
  const base = new URLSearchParams(location.search).get("annuaire") || "./";
  const url = base.replace(/\/?$/, "/") + encodeURIComponent(emetteur) + "/trousseau.verif.json";
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
document.getElementById("btn-verifier").onclick = () =>
  verifier(document.getElementById("entree").value);
document.getElementById("btn-exemple").onclick = async () => {
  const r = await fetch("exemple.txt").catch(() => null);
  if (r && r.ok) {
    document.getElementById("entree").value = (await r.text()).trim();
    verifier(document.getElementById("entree").value);
  }
};

/* Scan par la caméra. jsQR est chargé à la demande depuis la même origine :
   absent, le bouton se désactive proprement plutôt que de casser la page. */
document.getElementById("btn-camera").onclick = async function () {
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
if (direct) { document.getElementById("entree").value = direct; verifier(direct); }
