/* Outils NODUS exécutés dans le navigateur.
   Ce fichier complète nodus-verificateur.js, dont il réemprunte les primitives
   (base45Decode, verifierSignature, sha256brut, feuilleMerkle, noeudMerkle,
   concat, b64, hexVersOctets) plutôt que d'en refaire une seconde version.

   Règle qui gouverne tout ce fichier : rien de ce qu'on dépose ici ne quitte le
   navigateur. Les empreintes sont calculées en local, les certificats vérifiés
   en local. Un outil de confiance qui téléverserait les fichiers qu'on lui
   confie serait un dépôt, avec la responsabilité de conservation qui va avec. */

/* --------------------------------------------------------------- empreintes */
async function empreinteFichier(fichier) {
  /* WebCrypto ne sait pas hacher en flux : le fichier est lu entier en mémoire.
     Au delà de quelques centaines de mégaoctets, employer la ligne de commande
     plutôt que de faire tomber l'onglet. */
  const buf = await fichier.arrayBuffer();
  const h = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, "0")).join("");
}

/* ------------------------------------------------------------------- Merkle */
async function racineMerkle(feuilles) {
  if (!feuilles.length) throw new Error("aucune feuille");
  let etage = feuilles;
  while (etage.length > 1) {
    const suivant = [];
    for (let i = 0; i + 1 < etage.length; i += 2) {
      suivant.push(await noeudMerkle(etage[i], etage[i + 1]));
    }
    if (etage.length % 2) suivant.push(etage[etage.length - 1]);  // promotion
    etage = suivant;
  }
  return etage[0];
}

async function cheminMerkle(feuilles, rang) {
  const chemin = [];
  let etage = feuilles, i = rang;
  while (etage.length > 1) {
    if (i === etage.length - 1 && etage.length % 2) {
      i = Math.floor(i / 2);
    } else {
      chemin.push(i % 2 ? { cote: "g", frere: etage[i - 1] }
                        : { cote: "d", frere: etage[i + 1] });
      i = Math.floor(i / 2);
    }
    const suivant = [];
    for (let k = 0; k + 1 < etage.length; k += 2) {
      suivant.push(await noeudMerkle(etage[k], etage[k + 1]));
    }
    if (etage.length % 2) suivant.push(etage[etage.length - 1]);
    etage = suivant;
  }
  return chemin;
}

const enHex = (u) => [...u].map(b => b.toString(16).padStart(2, "0")).join("");

/* ---------------------------------------------- vérification d'un certificat
   JSON signé (preuve d'existence, attestation SBOM). Même contrat que côté
   Python : des couches nommées, aucune n'en masquant une autre. */
async function verifierCertificatJson(cert, options) {
  options = options || {};
  const r = { lisible: false, signature_ok: false, emetteur_reconnu: null,
              fichier_concorde: null, motif: "", etapes: [] };
  const sig = cert && cert.signature;
  if (!sig || !sig.valeur_hex || !sig.cle_publique) {
    r.motif = "document sans signature exploitable";
    return r;
  }
  r.lisible = true;

  if (options.empreinteFichier !== undefined && cert.objet && cert.objet.sha256) {
    r.fichier_concorde = options.empreinteFichier === cert.objet.sha256;
    r.etapes.push([r.fichier_concorde ? "✓" : "✕",
      r.fichier_concorde ? "le fichier fourni est bien celui du certificat"
                         : "le fichier fourni n'est PAS celui du certificat"]);
    if (!r.fichier_concorde) {
      r.motif = "le fichier ne correspond pas à son certificat";
      return r;
    }
  }

  let octets;
  try {
    octets = canonique(cert, "signature");
  } catch (e) {
    r.motif = "forme canonique impossible : " + e.message;
    return r;
  }

  /* L'algorithme vient du trousseau quand il est joignable. Le lire dans le
     document qu'on vérifie serait rejouer la faille « alg » des JWT. */
  let algo = sig.algo || "ed25519";
  let parc = null, entete = null;
  const emetteur = (cert.emetteur && cert.emetteur.id) || null;
  if (emetteur) {
    try {
      const t = await chargerTrousseau(emetteur);
      const vt = await verifierTrousseau(t);
      entete = t.emetteur;
      if (!vt.toutOk) {
        r.etapes.push(["✕", "trousseau de l'émetteur invalide"]);
        r.motif = "trousseau de l'émetteur invalide";
        return r;
      }
      r.etapes.push(["✓", "trousseau de " + emetteur + " valide, "
        + vt.entrees.length + " entrée(s)"]);
      parc = parcDesCles(vt.entrees);
      const fiche = parc[sig.cle_publique];
      if (fiche) algo = fiche.algo;
    } catch (e) {
      r.etapes.push(["◇", "trousseau injoignable (" + e.message + ")"]);
    }
  }

  try {
    r.signature_ok = await verifierSignature(algo, hexVersOctets(sig.cle_publique),
                                             octets, hexVersOctets(sig.valeur_hex));
  } catch (e) {
    r.motif = e.message.replace(/^INCONNU:/, "");
    return r;
  }
  r.etapes.push([r.signature_ok ? "✓" : "✕",
    r.signature_ok ? "signature intacte, le document n'a pas été modifié"
                   : "signature invalide, le document a été modifié"]);
  if (!r.signature_ok) {
    r.motif = "signature invalide";
    return r;
  }

  if (!parc) {
    r.motif = "signature valide, mais l'émetteur n'a pas été confronté à son "
            + "trousseau : preuve incomplète";
    return r;
  }
  const fiche = parc[sig.cle_publique];
  const d = (cert.depose_le || cert.atteste_le || "");
  let refus = null;
  if (!fiche) refus = "clé absente du trousseau de l'émetteur";
  else if (fiche.role === "racine") refus = "clé racine, non habilitée à signer";
  else if (fiche.depuis && d && d < fiche.depuis) refus = "clé pas encore habilitée à cette date";
  else if (fiche.jusqu && d && d >= fiche.jusqu) refus = "clé révoquée le " + fiche.jusqu;
  r.emetteur_reconnu = !refus;
  r.etapes.push([refus ? "✕" : "✓",
    refus || ("clé " + fiche.algo + " endossée par la racine de " + emetteur)]);
  r.motif = refus || "document authentique";
  return r;
}

/* ------------------------------------------------------------- attestation SBOM */
async function racineComposants(sbom) {
  const composants = (sbom && sbom.components) || [];
  if (!composants.length) return "";
  const feuilles = [];
  for (const c of composants) feuilles.push(await feuilleMerkle(canonique(c, "")));
  return enHex(await racineMerkle(feuilles));
}

/* ------------------------------------------------------------------ onglets */
function activerOnglets() {
  const boutons = [...document.querySelectorAll("[data-onglet]")];
  const panneaux = [...document.querySelectorAll("[data-panneau]")];
  const montrer = (nom) => {
    boutons.forEach(b => b.classList.toggle("actif", b.dataset.onglet === nom));
    panneaux.forEach(p => { p.hidden = p.dataset.panneau !== nom; });
    if (location.hash.slice(1) !== nom) history.replaceState(null, "", "#" + nom);
  };
  boutons.forEach(b => { b.onclick = () => montrer(b.dataset.onglet); });
  const depart = location.hash.slice(1);
  montrer(boutons.some(b => b.dataset.onglet === depart) ? depart : "verifier");
}

function texteZone(id) {
  return (document.getElementById(id).value || "").trim();
}

function poserResultat(id, classe, titre, corps) {
  const e = document.getElementById(id);
  e.style.display = "block";
  e.className = "resultat " + classe;
  e.innerHTML = `<div class="titre-verdict">${titre}</div>` + corps;
}

function lignesEtapes(etapes) {
  return `<div class="etapes">` + etapes.map(([m, t]) =>
    `<div>${m} <b>${t}</b></div>`).join("") + `</div>`;
}

function tableau(paires) {
  return "<table>" + paires.map(([k, v, mono]) =>
    `<tr><th>${k}</th><td class="${mono ? "mono" : ""}">${v}</td></tr>`).join("")
    + "</table>";
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[<>&"]/g,
    c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
}

/* --------------------------------------------------------- câblage des outils */
function cablerOutils() {
  activerOnglets();

  /* Empreinte d'un fichier */
  const zone = document.getElementById("depot");
  const traiter = async (fichier) => {
    if (!fichier) return;
    document.getElementById("empreinte-sortie").textContent = "calcul…";
    const t0 = performance.now();
    const h = await empreinteFichier(fichier);
    poserResultat("empreinte-resultat", "neutre", "Empreinte SHA-256", tableau([
      ["Fichier", esc(fichier.name)],
      ["Taille", fichier.size.toLocaleString("fr-FR") + " octets"],
      ["SHA-256", h, true],
      ["Calculé en", Math.round(performance.now() - t0) + " ms, dans ce navigateur"],
    ]) + `<p class="note-inline">Ce fichier n'a pas quitté ton appareil. Cette
      empreinte est ce qu'on transmet à un horodateur ou à l'API, jamais le
      contenu.</p>`);
    document.getElementById("empreinte-sortie").textContent = h;
  };
  if (zone) {
    zone.ondragover = (e) => { e.preventDefault(); zone.classList.add("survol"); };
    zone.ondragleave = () => zone.classList.remove("survol");
    zone.ondrop = (e) => {
      e.preventDefault(); zone.classList.remove("survol");
      traiter(e.dataTransfer.files[0]);
    };
    document.getElementById("fichier").onchange = (e) => traiter(e.target.files[0]);
  }

  /* Merkle */
  const btnMerkle = document.getElementById("btn-merkle");
  if (btnMerkle) btnMerkle.onclick = async () => {
    const lignes = texteZone("merkle-entree").split(/\s+/).filter(Boolean);
    const mauvais = lignes.filter(l => !/^[0-9a-fA-F]{64}$/.test(l));
    if (!lignes.length || mauvais.length) {
      poserResultat("merkle-resultat", "non", "Entrée invalide",
        `<p class="motif">Une empreinte SHA-256 par ligne. ${mauvais.length
        } ligne(s) ne sont pas des SHA-256 hexadécimaux.</p>`);
      return;
    }
    const feuilles = [];
    for (const l of lignes) feuilles.push(await feuilleMerkle(hexVersOctets(l.toLowerCase())));
    const racine = enHex(await racineMerkle(feuilles));
    const rang = Math.max(0, Math.min(lignes.length - 1,
      parseInt(document.getElementById("merkle-rang").value || "0", 10)));
    const chemin = await cheminMerkle(feuilles, rang);
    const octets = 1 + Math.ceil(chemin.length / 8) + chemin.length * 32;
    poserResultat("merkle-resultat", "ok", "Racine calculée", tableau([
      ["Objets", lignes.length],
      ["Racine", racine, true],
      ["Rang prouvé", rang],
      ["Niveaux", chemin.length],
      ["Taille de la preuve", octets + " octets, soit " + Math.ceil(octets * 1.5)
        + " caractères de QR"],
    ]) + `<p class="note-inline">Une seule signature sur cette racine suffit pour
      les ${lignes.length} objets. Chaque objet emporte sa preuve de
      ${octets} octets, qui tient dans son propre QR.</p>`);
  };

  /* Signature brute */
  const btnSig = document.getElementById("btn-signature");
  if (btnSig) btnSig.onclick = async () => {
    const emp = texteZone("sig-empreinte").toLowerCase();
    const cle = texteZone("sig-cle").toLowerCase();
    const val = texteZone("sig-valeur").toLowerCase();
    const emetteur = texteZone("sig-emetteur");
    if (!/^[0-9a-f]{64}$/.test(emp)) {
      poserResultat("sig-resultat", "non", "Empreinte invalide",
        `<p class="motif">Un SHA-256 hexadécimal de 64 caractères est attendu.</p>`);
      return;
    }
    let algo = "ed25519", etapes = [], parc = null;
    if (emetteur) {
      try {
        const t = await chargerTrousseau(emetteur);
        const vt = await verifierTrousseau(t);
        if (vt.toutOk) {
          parc = parcDesCles(vt.entrees);
          if (parc[cle]) algo = parc[cle].algo;
          etapes.push(["✓", "trousseau de " + emetteur + " valide"]);
        } else etapes.push(["✕", "trousseau de l'émetteur invalide"]);
      } catch (e) { etapes.push(["◇", "trousseau injoignable"]); }
    } else {
      algo = document.getElementById("sig-algo").value;
    }
    let ok = false;
    try {
      ok = await verifierSignature(algo, hexVersOctets(cle), hexVersOctets(emp),
                                   hexVersOctets(val));
    } catch (e) {
      poserResultat("sig-resultat", "partiel", "Indéterminé",
        `<p class="motif">${esc(e.message.replace(/^INCONNU:/, ""))}</p>`);
      return;
    }
    etapes.push([ok ? "✓" : "✕", ok ? "signature valide en " + algo
                                    : "signature invalide"]);
    const reconnu = parc ? !!parc[cle] && parc[cle].role !== "racine" : null;
    if (parc) etapes.push([reconnu ? "✓" : "✕", reconnu
      ? "clé endossée par la racine de " + emetteur
      : "clé absente du trousseau de " + emetteur]);
    poserResultat("sig-resultat", ok && reconnu !== false ? "ok" : "non",
      ok && reconnu !== false ? "Signature valide" : "Signature refusée",
      lignesEtapes(etapes) + (parc ? "" :
        `<p class="motif">Sans émetteur nommé, la signature est vérifiée hors
         trousseau : elle prouve l'intégrité, pas l'identité du signataire.</p>`));
  };

  /* Certificat JSON : preuve d'existence ou attestation SBOM */
  const btnCert = document.getElementById("btn-certificat");
  if (btnCert) btnCert.onclick = async () => {
    let cert;
    try {
      cert = JSON.parse(texteZone("cert-entree"));
    } catch (e) {
      poserResultat("cert-resultat", "non", "JSON invalide",
        `<p class="motif">${esc(e.message)}</p>`);
      return;
    }
    const f = document.getElementById("cert-fichier").files[0];
    const options = {};
    if (f) options.empreinteFichier = await empreinteFichier(f);
    const r = await verifierCertificatJson(cert, options);
    const type = cert.format === "nodus.attestation/1" ? "Attestation de construction"
               : cert.format === "nodus.preuve/1" ? "Preuve d'existence"
               : "Document signé";
    const lignes = [["Type", esc(type)],
                    ["Référence", esc(cert.reference || "(sans)")],
                    ["Émetteur", esc((cert.emetteur || {}).nom || (cert.emetteur || {}).id)]];
    if (cert.objet) {
      lignes.push(["Objet", esc(cert.objet.nom), false],
                  ["SHA-256 de l'objet", esc(cert.objet.sha256), true]);
    }
    if (cert.artefact) {
      lignes.push(["Artefact", esc(cert.artefact.nom), false],
                  ["SHA-256", esc(cert.artefact.sha256), true]);
    }
    if (cert.sbom) {
      lignes.push(["SBOM", esc(cert.sbom.composants) + " composants", false],
                  ["Racine des composants", esc(cert.sbom.racine_merkle), true]);
      const recalc = await racineComposants(cert.__sbom || {});
      if (cert.__sbom) {
        lignes.push(["Racine recalculée",
          recalc === cert.sbom.racine_merkle ? "concorde" : "NE CONCORDE PAS", false]);
      }
    }
    if (cert.horodatage) {
      lignes.push(["Horodaté par un tiers",
        esc(cert.horodatage.instant) + " UTC, " + esc(cert.horodatage.tsa), false]);
    } else if (cert.avertissement) {
      lignes.push(["Horodatage", "aucun : la date est déclarée par l'émetteur", false]);
    }
    const classe = r.motif === "document authentique" ? "ok"
                 : r.signature_ok ? "partiel" : "non";
    poserResultat("cert-resultat", classe,
      classe === "ok" ? type + " authentique"
                      : classe === "partiel" ? type + ", émetteur non confirmé"
                                             : type + " refusé",
      `<p class="motif">${esc(r.motif)}</p>` + lignesEtapes(r.etapes) + tableau(lignes));
  };

  /* Trousseau d'un émetteur */
  const btnTr = document.getElementById("btn-trousseau");
  if (btnTr) btnTr.onclick = async () => {
    const nom = texteZone("trousseau-emetteur") || "DELIGNY-RD";
    let t, vt;
    try {
      t = await chargerTrousseau(nom);
      vt = await verifierTrousseau(t);
    } catch (e) {
      poserResultat("trousseau-resultat", "non", "Trousseau introuvable",
        `<p class="motif">${esc(e.message)} pour l'émetteur ${esc(nom)}.</p>`);
      return;
    }
    const parc = parcDesCles(vt.entrees);
    const lignes = Object.entries(parc).map(([cle, f]) =>
      `<tr><th>${esc(f.role)}${f.jusqu ? " (révoquée)" : ""}</th>` +
      `<td class="mono">${esc(cle)}<br><span class="dim">${esc(f.algo)} · depuis ` +
      `${esc(f.depuis)}${f.jusqu ? " · jusqu'à " + esc(f.jusqu) : ""}</span></td></tr>`).join("");
    poserResultat("trousseau-resultat", vt.toutOk ? "ok" : "non",
      vt.toutOk ? "Trousseau valide" : "Trousseau invalide",
      lignesEtapes(vt.entrees.map((e, i) => [e.ok && e.chaineOk ? "✓" : "✕",
        "entrée " + (i + 1) + " · " + esc(e.objet.action) + " · "
        + (e.ok ? "endossement vérifié" : "endossement REFUSÉ")
        + (e.chaineOk ? ", chaînage intact" : ", CHAÎNAGE ROMPU")]))
      + "<table>" + lignes + "</table>"
      + `<p class="note-inline">La clé racine n'a le droit d'endosser que des clés
         de signature. Elle ne signe jamais de document elle-même, ce que le
         vérificateur refuse explicitement.</p>`);
  };
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", cablerOutils);
} else {
  cablerOutils();
}


/* La zone de depot portait un onclick= inline. La CSP de la page est
   `script-src 'self'` : le navigateur bloquait ce gestionnaire SILENCIEUSEMENT,
   et cliquer la zone n'ouvrait donc jamais le selecteur de fichier (trouve le
   25/08 par deploy/verifie-fortress.py). Le meme comportement, en JS servi. */
(function () {
  var zone = document.getElementById('depot');
  var champ = document.getElementById('fichier');
  if (zone && champ) zone.addEventListener('click', function () { champ.click(); });
})();
