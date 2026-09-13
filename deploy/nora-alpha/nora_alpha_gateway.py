#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""PASSERELLE ALPHA NORA (experience A0) — cerveau reel borne + instrumentation FUN GATE.

Reprend la DOCTRINE de c142 (ATLAS STUDIO PRO/atlas-backend/demo_gateway) deja
eprouvee : quota, plafond de cout, kill-switch fichier, fail-closed, journal
append-only, repli local quand l'appel paye est refuse. Etendue pour l'alpha
instrumentee (spec Baptiste 12/09) :
  - PROVIDER openai (gpt-4o) aujourd'hui ; mistral plus tard (flip DEMO_PROVIDER).
  - ACCES PAR TOKEN TESTEUR uniquement (pas de cerveau paye pour l'anonyme).
  - PLAFOND DE COUT PAR SESSION (en plus du plafond mensuel global).
  - RATE-LIMIT court + TIMEOUT dur.
  - ANONYMAT DU TESTEUR : on ne journalise JAMAIS le token brut. Chaque trace
    porte tester_id = HMAC(token, secret). La DB de quotas est elle aussi keyee
    par tester_id : aucun token brut n'est persiste.
  - ENVELOPPE D'EVENEMENT STANDARD : tester_id, session_id, timestamp_server,
    provider, model, model_cfg, client_version. Indispensable pour distinguer un
    effet "NORA" d'un effet "modele" quand on passera OpenAI -> Mistral.
  - SESSION CLOSE SERVEUR : heartbeats + reaper qui clot une session inactive
    (la duree ne depend donc pas d'un clic, robuste a une fermeture brutale).
  - Endpoint d'EVENEMENTS FUN GATE separe (/fun) + CORS pour la vitrine statique.

Le client envoie son PROPRE prompt systeme (la page NORA le contient deja),
donc la passerelle reste generique, comme c142.

Aucune cle en dur : OPENAI_API_KEY (ou MISTRAL_API_KEY/MISTRAL_RUBY) vient de
l'environnement. Sans cle, on repond « repli local ». stdlib seul : se deploie
tel quel sur merlinvps (systemd + nginx).
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import sqlite3
import threading
import time
import urllib.error
import urllib.request
from datetime import date, datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

# ── Reglages (surchargeables par l'environnement) ────────────────────────────
RACINE = Path(os.environ.get("NORA_GATEWAY_DIR", "/var/lib/nora-alpha"))
BASE = RACINE / "quotas.db"
JOURNAL = RACINE / "journal.jsonl"          # appels au cerveau (cout, latence)
FUN = RACINE / "fun.jsonl"                  # evenements FUN GATE (mesure produit)
KILL = RACINE / "STOP"                      # touch ce fichier = arret immediat

PORT = int(os.environ.get("NORA_GATEWAY_PORT", "8790"))
ORIGINE = os.environ.get("NORA_ORIGINE", "https://deligny-rd.fr")

# Provider : openai (alpha) ou mistral (souverain, quand le compte sera provisionne).
PROVIDER = os.environ.get("DEMO_PROVIDER", "openai").lower()
if PROVIDER == "mistral":
    API_URL = "https://api.mistral.ai/v1/chat/completions"
    MODELE = os.environ.get("DEMO_MODELE", "mistral-large-latest")
    CLE = os.environ.get("MISTRAL_API_KEY", "") or os.environ.get("MISTRAL_RUBY", "")
    EUR_PAR_M_ENTREE, EUR_PAR_M_SORTIE = 1.8, 5.4     # majores
else:
    API_URL = "https://api.openai.com/v1/chat/completions"
    MODELE = os.environ.get("DEMO_MODELE", "gpt-4o")
    CLE = os.environ.get("OPENAI_API_KEY", "")
    EUR_PAR_M_ENTREE, EUR_PAR_M_SORTIE = 2.6, 9.6     # majores (gpt-4o, EUR/M jetons)

TEMPERATURE = float(os.environ.get("NORA_TEMPERATURE", "0.85"))
MAX_JETONS_SORTIE = int(os.environ.get("NORA_MAX_TOKENS", "900"))  # une scene <tools> complete
MODEL_CFG = "temp=%s;max=%d" % (TEMPERATURE, MAX_JETONS_SORTIE)    # config capturee dans chaque event

# Bornes (toutes majorees : mieux vaut couper trop tot).
QUOTA_JOUR_TOKEN = int(os.environ.get("NORA_QUOTA_JOUR", "120"))   # appels/testeur/jour
PLAFOND_MOIS_EUR = float(os.environ.get("NORA_PLAFOND_MOIS_EUR", "40"))
PLAFOND_SESSION_EUR = float(os.environ.get("NORA_PLAFOND_SESSION_EUR", "0.60"))
RATE_MIN_S = float(os.environ.get("NORA_RATE_MIN_S", "1.5"))       # intervalle mini/testeur
IDLE_CLOSE_S = float(os.environ.get("NORA_IDLE_CLOSE_S", "120"))   # session close apres inactivite
MAX_CAR_SYSTEME = int(os.environ.get("NORA_MAX_SYS", "12000"))
MAX_CAR_MESSAGES = int(os.environ.get("NORA_MAX_MSG", "6000"))
TIMEOUT_S = int(os.environ.get("NORA_TIMEOUT_S", "45"))

# Secret d'anonymisation : le token brut ne quitte JAMAIS le couple (client, allowlist).
# En prod il DOIT etre fourni (NORA_TESTER_SECRET) et rester stable pour toute la vague.
TESTER_SECRET = (os.environ.get("NORA_TESTER_SECRET", "") or "dev-secret-non-prod").encode("utf-8")


def tester_id(token: str) -> str:
    return hmac.new(TESTER_SECRET, (token or "").encode("utf-8"), hashlib.sha256).hexdigest()[:16]


def _tokens_autorises() -> set:
    """Tokens testeurs autorises : env NORA_TOKENS (virgules) et/ou fichier tokens.txt."""
    s = set(t.strip() for t in os.environ.get("NORA_TOKENS", "").split(",") if t.strip())
    f = RACINE / "tokens.txt"
    if f.exists():
        try:
            for ligne in f.read_text(encoding="utf-8").splitlines():
                ligne = ligne.strip()
                if ligne and not ligne.startswith("#"):
                    s.add(ligne)
        except OSError:
            pass
    return s


_dernier_appel: dict = {}        # tester_id -> ts du dernier appel paye (rate-limit, en memoire)

# Suivi de session en memoire pour la cloture serveur (reaper).
_sessions: dict = {}             # sid -> {"tid","cv","last","ended"}
_slock = threading.Lock()


def _touch_session(sid: str, tid: str, cv: str) -> None:
    with _slock:
        s = _sessions.get(sid)
        if not s:
            s = _sessions[sid] = {"tid": tid, "cv": cv, "last": 0.0, "ended": False}
        s["last"] = time.time()
        if tid:
            s["tid"] = tid
        if cv:
            s["cv"] = cv


def _mark_ended(sid: str) -> None:
    with _slock:
        s = _sessions.get(sid)
        if s:
            s["ended"] = True


def _init() -> sqlite3.Connection:
    RACINE.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(BASE, timeout=10)
    c.execute("""CREATE TABLE IF NOT EXISTS conso(
        jour TEXT, tid TEXT, n INTEGER DEFAULT 0, PRIMARY KEY(jour, tid))""")
    c.execute("""CREATE TABLE IF NOT EXISTS cout(
        mois TEXT PRIMARY KEY, eur REAL DEFAULT 0)""")
    c.execute("""CREATE TABLE IF NOT EXISTS session(
        sid TEXT PRIMARY KEY, eur REAL DEFAULT 0, n INTEGER DEFAULT 0)""")
    c.commit()
    return c


def _stamp(tid: str, sid: str, cv: str, event: str, data: dict) -> dict:
    """Enveloppe d'evenement STANDARD (le timestamp_server est ajoute par _journal)."""
    return {"tester_id": tid, "session_id": str(sid or "")[:64], "event": event,
            "provider": PROVIDER, "model": MODELE, "model_cfg": MODEL_CFG,
            "client_version": str(cv or "")[:24],
            "data": data if isinstance(data, dict) else {}}


def _journal(fichier: Path, evt: dict) -> None:
    evt["timestamp_server"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    try:
        with open(fichier, "a", encoding="utf-8") as f:
            f.write(json.dumps(evt, ensure_ascii=False) + "\n")
    except OSError:
        pass            # un journal ne doit jamais empecher de servir


def etat(c: sqlite3.Connection, tid: str, sid: str) -> dict:
    jour, mois = date.today().isoformat(), date.today().strftime("%Y-%m")
    n = c.execute("SELECT n FROM conso WHERE jour=? AND tid=?", (jour, tid)).fetchone()
    eur = c.execute("SELECT eur FROM cout WHERE mois=?", (mois,)).fetchone()
    s = c.execute("SELECT eur,n FROM session WHERE sid=?", (sid,)).fetchone()
    return {"utilise": (n[0] if n else 0), "quota": QUOTA_JOUR_TOKEN,
            "restant": max(0, QUOTA_JOUR_TOKEN - (n[0] if n else 0)),
            "cout_mois_eur": round(eur[0] if eur else 0.0, 4), "plafond_mois_eur": PLAFOND_MOIS_EUR,
            "cout_session_eur": round(s[0] if s else 0.0, 4), "plafond_session_eur": PLAFOND_SESSION_EUR,
            "session_appels": (s[1] if s else 0)}


def _refus(motif: str, e: dict) -> dict:
    """Forme unique des refus : le client sait toujours basculer sur son repli local."""
    return {"ok": False, "repli_local": True, "motif": motif, "etat": e}


def demande(token: str, sid: str, systeme: str, messages: list, cv: str) -> dict:
    if token not in _tokens_autorises():
        return _refus("acces reserve aux testeurs", {})         # pas de cerveau paye pour l'anonyme
    tid = tester_id(token)
    _touch_session(sid, tid, cv)
    c = _init()
    e = etat(c, tid, sid)

    if KILL.exists():
        _journal(JOURNAL, _stamp(tid, sid, cv, "kill", {})); return _refus("alpha suspendue", e)
    if not CLE:
        return _refus("pas de cle configuree", e)
    if e["cout_mois_eur"] >= PLAFOND_MOIS_EUR:
        _journal(JOURNAL, _stamp(tid, sid, cv, "plafond_mois", {"eur": e["cout_mois_eur"]})); return _refus("plafond mensuel atteint", e)
    if e["cout_session_eur"] >= PLAFOND_SESSION_EUR:
        _journal(JOURNAL, _stamp(tid, sid, cv, "plafond_session", {})); return _refus("plafond de session atteint", e)
    if e["restant"] <= 0:
        _journal(JOURNAL, _stamp(tid, sid, cv, "quota", {})); return _refus("quota du jour atteint", e)
    if time.time() - _dernier_appel.get(tid, 0.0) < RATE_MIN_S:
        return _refus("trop rapide, reessaie", e)               # rate-limit court

    systeme = (systeme or "").strip()[:MAX_CAR_SYSTEME]
    if not isinstance(messages, list) or not messages:
        return _refus("messages vides", e)
    if sum(len(str(m.get("content", ""))) for m in messages if isinstance(m, dict)) > MAX_CAR_MESSAGES:
        return _refus("conversation trop longue", e)
    if not systeme:
        return _refus("systeme manquant", e)

    _dernier_appel[tid] = time.time()
    payload = json.dumps({
        "model": MODELE, "temperature": TEMPERATURE, "max_tokens": MAX_JETONS_SORTIE,
        "messages": [{"role": "system", "content": systeme}] + messages,
    }).encode()
    req = urllib.request.Request(API_URL, data=payload, method="POST", headers={
        "Content-Type": "application/json", "Authorization": f"Bearer {CLE}"})

    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_S) as r:
            data = json.loads(r.read().decode())
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, ValueError) as ex:
        _journal(JOURNAL, _stamp(tid, sid, cv, "erreur", {"code": str(getattr(ex, "code", ""))}))
        return _refus("service indisponible", e)                # jamais l'erreur brute au client

    texte = ((data.get("choices") or [{}])[0].get("message") or {}).get("content", "").strip()
    u = data.get("usage") or {}
    cout = (u.get("prompt_tokens", 0) / 1e6 * EUR_PAR_M_ENTREE
            + u.get("completion_tokens", 0) / 1e6 * EUR_PAR_M_SORTIE)

    jour, mois = date.today().isoformat(), date.today().strftime("%Y-%m")
    with c:
        c.execute("""INSERT INTO conso(jour,tid,n) VALUES(?,?,1)
                     ON CONFLICT(jour,tid) DO UPDATE SET n=n+1""", (jour, tid))
        c.execute("""INSERT INTO cout(mois,eur) VALUES(?,?)
                     ON CONFLICT(mois) DO UPDATE SET eur=eur+?""", (mois, cout, cout))
        c.execute("""INSERT INTO session(sid,eur,n) VALUES(?,?,1)
                     ON CONFLICT(sid) DO UPDATE SET eur=eur+?, n=n+1""", (sid, cout, cout))
    _journal(JOURNAL, _stamp(tid, sid, cv, "ok", {"ms": int((time.time() - t0) * 1000),
                                                  "eur": round(cout, 6), "jetons": u.get("total_tokens", 0)}))
    if not texte:
        return _refus("reponse vide", etat(c, tid, sid))
    return {"ok": True, "texte": texte, "etat": etat(c, tid, sid)}


def fun_event(token: str, sid: str, cv: str, event: str, data) -> bool:
    """Enregistre un evenement FUN GATE (token valide requis). Jamais de token brut."""
    if token not in _tokens_autorises():
        return False
    tid = tester_id(token)
    _touch_session(sid, tid, cv)
    if event == "session_end":
        _mark_ended(sid)
    _journal(FUN, _stamp(tid, sid, cv, str(event)[:40], data if isinstance(data, dict) else {}))
    return True


def _reaper() -> None:
    """Clot les sessions inactives : la duree ne depend pas d'un clic de fin."""
    tick = float(os.environ.get("NORA_REAPER_TICK_S", "30"))
    while True:
        time.sleep(tick)
        now = time.time()
        with _slock:
            a_clore = [(sid, dict(s)) for sid, s in _sessions.items()
                       if not s["ended"] and now - s["last"] > IDLE_CLOSE_S]
        for sid, s in a_clore:
            _journal(FUN, _stamp(s["tid"], sid, s["cv"], "session_end",
                                 {"reason": "timeout", "idle_s": round(now - s["last"], 1)}))
            _mark_ended(sid)


# ── Serveur HTTP (CORS, /nora, /fun, /health) ────────────────────────────────
class H(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", ORIGINE)
        self.send_header("Access-Control-Allow-Headers", "content-type")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")

    def _json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code); self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers(); self.wfile.write(body)

    def _lire(self):
        n = int(self.headers.get("Content-Length", "0") or 0)
        try:
            return json.loads(self.rfile.read(n) or b"{}")
        except Exception:
            return None

    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()

    def do_GET(self):
        if self.path == "/health":
            return self._json(200, {"ok": True, "provider": PROVIDER, "modele": MODELE,
                                    "model_cfg": MODEL_CFG, "cle": bool(CLE), "kill": KILL.exists()})
        self._json(404, {"error": "not found"})

    def do_POST(self):
        req = self._lire()
        if req is None:
            return self._json(400, {"error": "JSON invalide"})
        if self.path == "/nora":
            token = str(req.get("token", "")).strip()
            sid = str(req.get("session_id", "") or req.get("sid", "")).strip()[:64] or "anon"
            cv = req.get("client_version", "")
            return self._json(200, demande(token, sid, req.get("systeme", ""), req.get("messages", []), cv))
        if self.path == "/fun":
            ok = fun_event(str(req.get("token", "")).strip(),
                           str(req.get("session_id", "")).strip(),
                           req.get("client_version", ""),
                           req.get("event", ""), req.get("data", {}))
            return self._json(200, {"ok": ok})
        self._json(404, {"error": "not found"})

    def log_message(self, *a):
        pass        # silence : le journal applicatif suffit


def main():
    _init()
    threading.Thread(target=_reaper, daemon=True).start()
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), H)
    secret_ok = TESTER_SECRET != b"dev-secret-non-prod"
    print("NORA alpha gateway A0 — provider=%s modele=%s cle=%s secret=%s port=%d"
          % (PROVIDER, MODELE, bool(CLE), "set" if secret_ok else "DEV(!)", PORT))
    srv.serve_forever()


if __name__ == "__main__":
    main()
