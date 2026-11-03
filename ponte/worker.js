/* myFinances on FIRE · ponte per il collegamento automatico con la banca
   ---------------------------------------------------------------------
   Gira come Cloudflare Worker (piano gratuito). Fa da intermediario tra l'app sul telefono
   e Enable Banking (servizio autorizzato di open banking), solo in LETTURA:
   - conserva la chiave privata di Enable Banking, che non puo' stare nell'app pubblica;
   - firma le richieste (JWT RS256) e risponde solo all'app (token segreto + origine consentita);
   - non salva movimenti: li passa all'app e li dimentica;
   - non puo' fare pagamenti: espone solo consenso, stato e lettura dei movimenti.

   Variabili da impostare in Cloudflare (Settings > Variables and Secrets):
     EB_APP_ID       testo    ID dell'applicazione Enable Banking (il nome del file .pem senza estensione)
     EB_PRIVATE_KEY  segreto  contenuto completo del file .pem
     APP_TOKEN       segreto  codice lungo generato dall'app (Altro > Collegamento automatico)
     ALLOWED_ORIGIN  testo    https://TUO-UTENTE.github.io
     REDIRECT_URL    testo    indirizzo esatto dell'app, es. https://TUO-UTENTE.github.io/myFinancesOnFire/
*/
const API = "https://api.enablebanking.com";
const VERSION = "1.0.0";
let KEY_CACHE = null, JWT_CACHE = null;

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = String(env.ALLOWED_ORIGIN || "").split(",").map(s => s.trim().replace(/\/+$/, "")).filter(Boolean);
    const okOrigin = allowed.includes(origin);
    const cors = { "Access-Control-Allow-Origin": okOrigin ? origin : (allowed[0] || "null"), "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Max-Age": "86400", "Vary": "Origin" };
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/") {
      const missing = ["EB_APP_ID", "EB_PRIVATE_KEY", "APP_TOKEN", "ALLOWED_ORIGIN", "REDIRECT_URL"].filter(k => !env[k]);
      return json({ ok: missing.length === 0, service: "myfinances-ponte", version: VERSION, missing }, 200, cors);
    }
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, cors);
    if (!okOrigin) return json({ error: "origin_not_allowed", origin }, 403, cors);
    if (!(await tokenOk(request, env))) return json({ error: "unauthorized" }, 401, cors);
    let body = {};
    try { body = await request.json(); } catch (e) { body = {}; }
    try {
      switch (url.pathname) {
        case "/check": {
          const r = await eb(env, "GET", "/application");
          if (!r.ok) return upstreamError(r, cors);
          const d = await r.json();
          return json({ name: d.name, environment: d.environment, active: d.active, redirect_urls: d.redirect_urls, countries: d.countries,
            redirect_ok: (d.redirect_urls || []).includes(env.REDIRECT_URL), redirect_url: env.REDIRECT_URL }, 200, cors);
        }
        case "/banks": {
          const country = String(body.country || "LT").toUpperCase();
          if (!/^[A-Z]{2}$/.test(country)) return json({ error: "bad_country" }, 400, cors);
          const filter = String(body.name || "revolut").toLowerCase();
          const r = await eb(env, "GET", "/aspsps?country=" + country + "&psu_type=personal&service=AIS");
          if (!r.ok) return upstreamError(r, cors);
          const d = await r.json();
          const banks = (d.aspsps || []).filter(a => String(a.name).toLowerCase().includes(filter))
            .map(a => ({ name: a.name, country: a.country, maximum_consent_validity: a.maximum_consent_validity, beta: !!a.beta, required_psu_headers: a.required_psu_headers || [] }));
          return json({ banks }, 200, cors);
        }
        case "/connect": {
          const country = String(body.country || "LT").toUpperCase(), name = String(body.name || "Revolut");
          const state = String(body.state || "");
          if (!/^[A-Z]{2}$/.test(country) || !/^[\w-]{16,80}$/.test(state)) return json({ error: "bad_request" }, 400, cors);
          const r0 = await eb(env, "GET", "/aspsps?country=" + country + "&psu_type=personal&service=AIS");
          if (!r0.ok) return upstreamError(r0, cors);
          const bank = ((await r0.json()).aspsps || []).find(a => a.name === name);
          if (!bank) return json({ error: "bank_not_found" }, 404, cors);
          const maxSec = Math.max(86400, +bank.maximum_consent_validity || 90 * 86400);
          const wantSec = Math.min(maxSec, Math.max(1, +body.days || 180) * 86400) - 600;
          const validUntil = new Date(Date.now() + wantSec * 1000).toISOString();
          const r = await eb(env, "POST", "/auth", { access: { valid_until: validUntil }, aspsp: { name, country }, state,
            redirect_url: env.REDIRECT_URL, psu_type: "personal", language: body.language || "it" });
          if (!r.ok) return upstreamError(r, cors);
          const d = await r.json();
          return json({ url: d.url, valid_until: validUntil }, 200, cors);
        }
        case "/session": {
          const code = String(body.code || "");
          if (!code || code.length > 400) return json({ error: "bad_code" }, 400, cors);
          const r = await eb(env, "POST", "/sessions", { code });
          if (!r.ok) return upstreamError(r, cors);
          const d = await r.json();
          return json({ session_id: d.session_id, valid_until: d.access && d.access.valid_until, aspsp: d.aspsp,
            accounts: (d.accounts || []).map(a => ({ uid: a.uid, currency: a.currency, name: a.name || a.product || a.details || "", iban: mask(a.account_id && a.account_id.iban) })) }, 200, cors);
        }
        case "/status": {
          const sid = String(body.session_id || "");
          if (!UUID.test(sid)) return json({ error: "bad_session" }, 400, cors);
          const r = await eb(env, "GET", "/sessions/" + sid);
          if (!r.ok) return upstreamError(r, cors);
          const d = await r.json();
          return json({ status: d.status, valid_until: d.access && d.access.valid_until, accounts: d.accounts || [] }, 200, cors);
        }
        case "/transactions": {
          const uid = String(body.account_uid || "");
          if (!UUID.test(uid)) return json({ error: "bad_account" }, 400, cors);
          const q = new URLSearchParams();
          if (body.date_from) { if (!DATE.test(body.date_from)) return json({ error: "bad_date" }, 400, cors); q.set("date_from", body.date_from); }
          if (body.date_to) { if (!DATE.test(body.date_to)) return json({ error: "bad_date" }, 400, cors); q.set("date_to", body.date_to); }
          if (body.continuation_key) q.set("continuation_key", String(body.continuation_key).slice(0, 2000));
          const path = "/accounts/" + uid + "/transactions" + (q.toString() ? "?" + q : "");
          let r = await eb(env, "GET", path, null, psuHeaders(request, env));
          let text = await r.text();
          if (r.status >= 400 && /PSU_HEADER|psu.?header/i.test(text)) { r = await eb(env, "GET", path); text = await r.text(); }
          return new Response(text, { status: r.ok ? 200 : 502, headers: Object.assign({ "Content-Type": "application/json", "Cache-Control": "no-store" }, cors) });
        }
        case "/disconnect": {
          const sid = String(body.session_id || "");
          if (!UUID.test(sid)) return json({ error: "bad_session" }, 400, cors);
          const r = await eb(env, "DELETE", "/sessions/" + sid);
          return json({ ok: r.ok }, 200, cors);
        }
        default: return json({ error: "not_found" }, 404, cors);
      }
    } catch (e) {
      return json({ error: "bridge_error", detail: String((e && e.message) || e).slice(0, 300) }, 502, cors);
    }
  }
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const json = (o, status, headers) => new Response(JSON.stringify(o), { status, headers: Object.assign({ "Content-Type": "application/json", "Cache-Control": "no-store" }, headers) });
const mask = iban => iban ? "\u2022\u2022\u2022\u2022 " + String(iban).replace(/\s/g, "").slice(-4) : "";
async function upstreamError(r, cors) {
  let detail = ""; try { detail = (await r.text()).slice(0, 600); } catch (e) { }
  return json({ error: "bank_error", status: r.status, detail }, r.status === 401 || r.status === 403 ? 502 : r.status >= 500 ? 502 : r.status, cors);
}
function psuHeaders(request, env) {
  return {
    "Psu-Ip-Address": request.headers.get("CF-Connecting-IP") || "127.0.0.1",
    "Psu-User-Agent": (request.headers.get("User-Agent") || "Mozilla/5.0").slice(0, 300),
    "Psu-Accept": "application/json",
    "Psu-Accept-Charset": "utf-8",
    "Psu-Accept-Encoding": "gzip, deflate, br",
    "Psu-Accept-language": (request.headers.get("Accept-Language") || "it").slice(0, 100),
    "Psu-Referer": String(env.REDIRECT_URL || "")
  };
}

/* confronto del token in tempo costante */
async function tokenOk(request, env) {
  const got = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const want = String(env.APP_TOKEN || "");
  if (!got || want.length < 24) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(got)), crypto.subtle.digest("SHA-256", enc.encode(want))]);
  const x = new Uint8Array(a), y = new Uint8Array(b); let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

/* chiamata firmata a Enable Banking */
async function eb(env, method, path, body, extra) {
  const headers = Object.assign({ "Authorization": "Bearer " + (await jwt(env)), "Accept": "application/json" }, extra || {});
  if (body) headers["Content-Type"] = "application/json";
  return fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
}
const b64url = bytes => { let s = ""; const u = new Uint8Array(bytes); for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const b64urlStr = s => b64url(new TextEncoder().encode(s));
async function jwt(env) {
  const now = Math.floor(Date.now() / 1000);
  if (JWT_CACHE && JWT_CACHE.exp - 300 > now && JWT_CACHE.kid === env.EB_APP_ID && JWT_CACHE.src === env.EB_PRIVATE_KEY) return JWT_CACHE.token;
  const key = await privateKey(env);
  const head = b64urlStr(JSON.stringify({ typ: "JWT", alg: "RS256", kid: env.EB_APP_ID }));
  const exp = now + 3600;
  const payload = b64urlStr(JSON.stringify({ iss: "enablebanking.com", aud: "api.enablebanking.com", iat: now, exp }));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(head + "." + payload));
  JWT_CACHE = { token: head + "." + payload + "." + b64url(sig), exp, kid: env.EB_APP_ID, src: env.EB_PRIVATE_KEY };
  return JWT_CACHE.token;
}
async function privateKey(env) {
  if (KEY_CACHE && KEY_CACHE.src === env.EB_PRIVATE_KEY) return KEY_CACHE.key;
  let pem = String(env.EB_PRIVATE_KEY || "").replace(/\\n/g, "\n").trim();
  const pkcs1 = /BEGIN RSA PRIVATE KEY/.test(pem);
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  let der = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  if (pkcs1) der = wrapPkcs1(der);
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  KEY_CACHE = { src: env.EB_PRIVATE_KEY, key };
  return key;
}
/* chiave "BEGIN RSA PRIVATE KEY" (PKCS#1) -> PKCS#8 */
function wrapPkcs1(der) {
  const len = n => n < 128 ? [n] : n < 256 ? [0x81, n] : n < 65536 ? [0x82, n >> 8, n & 255] : [0x83, n >> 16, (n >> 8) & 255, n & 255];
  const tlv = (tag, bytes) => [tag, ...len(bytes.length), ...bytes];
  const algo = [0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00];
  return new Uint8Array(tlv(0x30, [0x02, 0x01, 0x00, ...algo, ...tlv(0x04, Array.from(der))]));
}
