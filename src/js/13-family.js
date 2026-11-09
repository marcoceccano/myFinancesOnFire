/* myFinances on FIRE · famiglia: una copia condivisa, cifrata sul telefono, custodita dal ponte.
   - La chiave (AES-GCM 256) nasce sul telefono di chi crea la famiglia e passa solo nel QR: il ponte e Cloudflare vedono dati illeggibili.
   - Ogni telefono tiene la "base" dell'ultimo allineamento e unisce a tre vie (base, locale, remoto) voce per voce:
     vince chi ha cambiato; se cambiano tutti e due la stessa voce, vince l'ultima modifica arrivata.
   - Il FIRE e il reddito li gestisce chi ha creato la famiglia (ruolo "master"); gli altri li vedono. */
"use strict";
(function () {
const te = new TextEncoder(), td = new TextDecoder();
const b64u = {
  enc: bytes => { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); },
  dec: str => { str = String(str); const s = atob(str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4)); const out = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out; }
};
T.b64u = b64u;

/* JSON canonico (chiavi ordinate): due oggetti uguali danno lo stesso testo */
T.canon = v => {
  if (v === null || v === undefined) return "null";
  if (typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(T.canon).join(",") + "]";
  return "{" + Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => JSON.stringify(k) + ":" + T.canon(v[k])).join(",") + "}";
};

/* che cosa si condivide: elenchi con la loro chiave, e voci singole */
const LISTS = { txs: t => t.id, rules: r => r.m + "|" + (r.exact ? 1 : 0), categories: c => c.id, vacations: v => [v.from, v.to, v.label].join("|"),
  fixed: f => f.id, imports: i => (i.at || "") + "|" + (i.file || ""), csvProfiles: p => p.sig };
const PROFILE = ["name", "currency", "incomeMonthly", "fx"];
const BANK = ["url", "token", "country", "aspsp", "session", "validUntil", "accounts", "lastSync", "lastResult", "cursors"];
const pick = (o, ks) => { const r = {}; for (const k of ks) if (o && o[k] !== undefined) r[k] = o[k]; return r; };
const copy = o => JSON.parse(JSON.stringify(o));
T.famShared = st => {
  const out = { v: 1 };
  for (const k in LISTS) out[k] = st[k] || [];
  out.budget = st.budget; out.fire = st.fire; out.profile = pick(st.profile, PROFILE); out.bank = pick(st.bank, BANK);
  out.devices = (st.family && st.family.devices) || {};
  out.portfolio = st.portfolio ? Object.assign({}, st.portfolio, { lastError: null }) : null;
  return copy(out);
};
const core = sh => { if (!sh) return null; const c = Object.assign({}, sh); delete c.by; delete c.at; return c; };
T.famSame = (a, b) => T.canon(core(a)) === T.canon(core(b));

/* unione a tre vie */
function mergeList(base, loc, rem, keyFn) {
  const idx = arr => { const m = new Map(); for (const x of arr || []) { const k = keyFn(x); if (!m.has(k)) m.set(k, { o: x, s: T.canon(x) }); } return m; };
  const B = idx(base), L = idx(loc), R = idx(rem), keys = [], seen = new Set();
  for (const k of L.keys()) { keys.push(k); seen.add(k); }
  for (const k of R.keys()) if (!seen.has(k)) { keys.push(k); seen.add(k); }
  const out = [];
  for (const k of keys) {
    const b = B.get(k), l = L.get(k), r = R.get(k), bs = b && b.s, ls = l && l.s, rs = r && r.s;
    const win = ls === rs ? l : ls === bs ? r : rs === bs ? l : (l || r);
    if (win) out.push(win.o);
  }
  return out;
}
const merge1 = (b, l, r) => { const bs = T.canon(b), ls = T.canon(l), rs = T.canon(r); return ls === rs ? l : ls === bs ? r : l; };
const mergeMap = (b, l, r) => {
  const toL = o => Object.entries(o || {}).map(([k, v]) => ({ k, v }));
  const out = {}; for (const x of mergeList(toL(b), toL(l), toL(r), x => x.k)) out[x.k] = x.v; return out;
};
function mergeBank(l, r, role) {
  const owner = role === "master" ? l : r, res = Object.assign({}, owner || {});
  const ls = (l && l.lastSync) || "", rs = (r && r.lastSync) || "", newer = ls >= rs ? l : r;
  res.lastSync = (newer && newer.lastSync) || null; res.lastResult = (newer && newer.lastResult) || null;
  const cur = {}; for (const src of [r && r.cursors, l && l.cursors]) for (const k in src || {}) if (!cur[k] || src[k] > cur[k]) cur[k] = src[k];
  res.cursors = cur;
  return res;
}
/* portafoglio: vince l'ultimo scaricato; storico e dividendi si uniscono */
function mergePf(l, r) {
  if (!l || !r) return l || r || null;
  const newer = (l.lastSync || "") >= (r.lastSync || "") ? l : r, older = newer === l ? r : l;
  const res = Object.assign({}, newer), h = {}, dv = {};
  for (const x of (older.history || []).concat(newer.history || [])) h[x.d] = x.v;
  for (const x of (older.divs || []).concat(newer.divs || [])) dv[x.key] = x;
  const fl = {}; for (const x of (older.flows || []).concat(newer.flows || [])) fl[x.key] = x;
  res.flows = Object.values(fl).sort((a, b) => a.d < b.d ? -1 : 1); res.hasFlows = !!(older.hasFlows || newer.hasFlows);
  res.history = Object.keys(h).sort().map(d => ({ d, v: h[d] }));
  res.divs = Object.values(dv).sort((a, b) => a.d < b.d ? -1 : 1);
  if (res.tokenUntil == null && older.tokenUntil) res.tokenUntil = older.tokenUntil;
  return res;
}
T.famMerge = (base, loc, rem, role) => {
  const out = { v: 1 };
  for (const k in LISTS) out[k] = mergeList(base && base[k], loc[k], rem[k], LISTS[k]);
  out.txs.sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : 0);
  out.budget = merge1(base && base.budget, loc.budget, rem.budget);
  out.devices = mergeMap(base && base.devices, loc.devices, rem.devices);
  const own = role === "master" ? loc : rem;
  out.fire = own.fire; out.profile = own.profile;
  out.bank = mergeBank(loc.bank, rem.bank, role);
  out.portfolio = mergePf(loc.portfolio, rem.portfolio);
  return copy(out);
};
/* applica la copia condivisa allo stato del telefono (lingua, interfaccia e chiavi restano locali).
   Sostituisce solo cio' che e' cambiato, cosi' le schermate aperte restano legate agli stessi oggetti. */
T.famApply = (st, sh, role, keepLocalRetire) => {
  const same = (a, b) => T.canon(a) === T.canon(b);
  for (const k in LISTS) if (!same(st[k] || [], sh[k] || [])) st[k] = copy(sh[k] || []);
  if (!same(st.budget, sh.budget)) st.budget = Object.assign(st.budget || {}, copy(sh.budget || {}));
  const nf = Object.assign(copy(T.FIRE_DEFAULTS), copy(sh.fire || {}));
  if (role === "member" && keepLocalRetire) nf.retireAge = st.fire && st.fire.retireAge != null ? st.fire.retireAge : null;
  if (!same(st.fire, nf)) st.fire = nf;
  Object.assign(st.profile, copy(sh.profile || {}));
  st.bank = Object.assign(st.bank || T.bankDefaults(), copy(sh.bank || {}));
  if (st.family) st.family.devices = copy(sh.devices || {});
  if (!same(st.portfolio || null, sh.portfolio || null)) { const err = st.portfolio && st.portfolio.lastError; st.portfolio = sh.portfolio ? copy(sh.portfolio) : null; if (st.portfolio && err) st.portfolio.lastError = err; }
};

/* cifratura: JSON compresso (gzip) e cifrato AES-GCM, con l'identificativo della famiglia come dato associato */
const gz = async (bytes, on) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(on ? new CompressionStream("gzip") : new DecompressionStream("gzip"))).arrayBuffer());
const aes = k => crypto.subtle.importKey("raw", b64u.dec(k), "AES-GCM", false, ["encrypt", "decrypt"]);
T.famEncrypt = async (F, obj) => {
  let bytes = te.encode(JSON.stringify(obj)), g = "r";
  if (typeof CompressionStream === "function") { bytes = await gz(bytes, true); g = "g"; }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: te.encode(F.id) }, await aes(F.key), bytes));
  return "v1." + g + "." + b64u.enc(iv) + "." + b64u.enc(ct);
};
T.famDecrypt = async (F, data) => {
  const p = String(data || "").split(".");
  if (p.length !== 4 || p[0] !== "v1") throw new Error(T.tr("I dati della famiglia non sono leggibili."));
  let bytes;
  try { bytes = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64u.dec(p[2]), additionalData: te.encode(F.id) }, await aes(F.key), b64u.dec(p[3]))); }
  catch (e) { throw new Error(T.tr("La chiave non apre i dati della famiglia: serve un QR nuovo.")); }
  if (p[1] === "g") bytes = await gz(bytes, false);
  return JSON.parse(td.decode(bytes));
};

/* collegamento da mettere nel QR: [versione, famiglia, chiave, ponte, codice del ponte, nome di chi invita] */
T.famLink = (st, appUrl) => {
  const F = st.family;
  return appUrl + "#famiglia=" + b64u.enc(te.encode(JSON.stringify([1, F.id, F.key, st.bank.url, st.bank.token, F.master || F.name || ""])));
};
T.famParse = str => {
  const m = String(str || "").trim().match(/#famiglia=([\w-]+)/) || String(str || "").trim().match(/^([\w-]{60,})$/);
  if (!m) return null;
  try {
    const a = JSON.parse(td.decode(b64u.dec(m[1])));
    if (!Array.isArray(a) || a[0] !== 1 || !/^[\w-]{20,64}$/.test(a[1]) || b64u.dec(a[2]).length !== 32 || !/^https:\/\//.test(a[3]) || !a[4]) return null;
    return { fid: a[1], key: a[2], url: a[3], token: a[4], name: a[5] || "" };
  } catch (e) { return null; }
};

const famCall = (st, body) => T.bankCall({ bank: { url: st.bank.url, token: st.bank.token } }, "/family", body);
const famError = e => {
  const code = e && e.data && e.data.error;
  if (code === "not_found" && e.status === 404) return new Error(T.tr("Il ponte e' di una versione precedente: in Cloudflare incolla il nuovo ponte/worker.js (versione 1.1.0) e premi Deploy (vedi la guida)."));
  if (code === "family_storage_missing") return new Error(T.tr("Il ponte non ha ancora lo spazio per la famiglia: in Cloudflare aggiungi al Worker un KV namespace chiamato FAMIGLIA (vedi la guida)."));
  return e;
};
T.famBase = { get: () => T.storage.getKey("famBase"), set: v => T.storage.setKey("famBase", v), del: () => T.storage.delKey("famBase") };
const now = () => new Date().toISOString();
const touch = F => {
  const d = (F.devices = F.devices || {}), me = d[F.device];
  if (!me || me.name !== (F.name || "") || me.role !== F.role || !me.seen || Date.now() - Date.parse(me.seen) > 6 * 3600e3) d[F.device] = { name: F.name || "", role: F.role, seen: now() };
};

/* crea la famiglia con i dati di questo telefono */
T.famCreate = async (st, name) => {
  if (!st.bank.url || !st.bank.token) throw new Error(T.tr("Prima configura il ponte in Collegamento automatico."));
  const F = { id: T.randomToken(18), key: T.randomToken(32), role: "master", name: name || "", master: name || "", device: T.randomToken(9), ver: 0, devices: {}, created: now() };
  const prev = st.family; st.family = F; touch(F);
  const sh = T.famShared(st); sh.by = F.name; sh.at = now();
  try { const r = await famCall(st, { op: "put", fid: F.id, create: true, data: await T.famEncrypt(F, sh) }); F.ver = r.ver; }
  catch (e) { st.family = prev; throw famError(e); }
  await T.famBase.set(JSON.stringify(sh)); F.lastSync = now();
  return F;
};
/* entra nella famiglia: scarica e apre la copia condivisa, crea lo stato del telefono */
T.famJoin = async (p, name, lang) => {
  const F = { id: p.fid, key: p.key, role: "member", name: name || "", master: p.name || "", device: T.randomToken(9), ver: 0, devices: {}, joined: now() };
  let got;
  try { got = await T.bankCall({ bank: { url: p.url, token: p.token } }, "/family", { op: "get", fid: F.id }); }
  catch (e) { if (e.status === 404) throw new Error(T.tr("Questa famiglia non esiste piu': chiedi un QR nuovo.")); throw famError(e); }
  const sh = await T.famDecrypt(F, got.data);
  const st = T.newState();
  st.family = F; T.famApply(st, sh, "member", false);
  st.bank.url = p.url; st.bank.token = p.token;
  st.profile.lang = lang || st.profile.lang; st.profile.onboarded = true; st.meta.v14 = true;
  F.ver = got.ver; F.devices = copy(sh.devices || {});
  await T.famBase.set(JSON.stringify(sh)); F.lastSync = now();
  return st;
};
/* allineamento: scarica, unisce, applica, e carica se c'e' qualcosa di nuovo */
T.famSync = async st => {
  const F = st.family; if (!F || !F.id) return { skipped: true };
  for (let attempt = 0; attempt < 4; attempt++) {
    const baseStr = await T.famBase.get(), base = baseStr ? JSON.parse(baseStr) : null;
    let got;
    try { got = await famCall(st, { op: "get", fid: F.id, have: base ? F.ver : undefined }); }
    catch (e) { if (e.status === 404 && e.data && e.data.error === "family_not_found") { F.gone = true; throw new Error(T.tr("La famiglia non esiste piu' o la chiave e' cambiata: chiedi un QR nuovo.")); } throw famError(e); }
    F.gone = false;
    const remote = got.same ? null : await T.famDecrypt(F, got.data);
    const rem = remote || base;
    /* da qui senza attese: legge lo stato locale, unisce e applica nello stesso momento */
    touch(F);
    const local = T.famShared(st);
    let merged = T.famMerge(base, local, rem, F.role);
    const pulled = !!remote && !!base && !T.famSame(remote, base);
    if (T.canon(merged) !== T.canon(local)) {
      const rulesChanged = T.canon(merged.rules) !== T.canon(local.rules);
      T.famApply(st, merged, F.role, true);
      if (rulesChanged && T.reclassifyAll) { T.reclassifyAll(st); merged = T.famMerge(base, T.famShared(st), rem, F.role); }
    }
    if (!T.famSame(merged, rem)) {
      merged.by = F.name || ""; merged.at = now();
      const data = await T.famEncrypt(F, merged);
      try { const r = await famCall(st, { op: "put", fid: F.id, base: got.ver, data }); F.ver = r.ver; }
      catch (e) { if (e.status === 409) continue; if (e.status === 404) { F.gone = true; throw new Error(T.tr("La famiglia non esiste piu' o la chiave e' cambiata: chiedi un QR nuovo.")); } throw famError(e); }
      await T.famBase.set(JSON.stringify(merged)); F.lastSync = now();
      return { pulled, pushed: true, by: pulled ? remote.by : null };
    }
    F.ver = got.ver;
    if (remote || !baseStr) await T.famBase.set(JSON.stringify(rem || merged));
    F.lastSync = now();
    return { pulled, pushed: false, by: pulled ? remote.by : null };
  }
  throw new Error(T.tr("Gli altri telefoni stanno modificando proprio ora: riprova tra poco."));
};
/* nuova chiave: la vecchia copia viene cancellata, gli altri telefoni devono inquadrare il nuovo QR */
T.famRekey = async st => {
  const old = st.family; if (!old || old.role !== "master") throw new Error("solo chi ha creato la famiglia");
  const F = Object.assign({}, old, { id: T.randomToken(18), key: T.randomToken(32), ver: 0, devices: {}, created: now() });
  st.family = F; touch(F);
  const sh = T.famShared(st); sh.by = F.name; sh.at = now();
  try { const r = await famCall(st, { op: "put", fid: F.id, create: true, data: await T.famEncrypt(F, sh) }); F.ver = r.ver; }
  catch (e) { st.family = old; throw famError(e); }
  try { await famCall(st, { op: "delete", fid: old.id }); } catch (e) { }
  await T.famBase.set(JSON.stringify(sh)); F.lastSync = now();
  return F;
};
/* uscita: chi ha creato la famiglia la scioglie (cancella la copia dal ponte); gli altri escono e perdono il collegamento Revolut */
T.famLeave = async st => {
  const F = st.family; if (!F) return;
  if (F.role === "master") { try { await famCall(st, { op: "delete", fid: F.id }); } catch (e) { } }
  else Object.assign(st.bank, { url: "", token: "", session: null, validUntil: null, accounts: [], cursors: {}, lastError: null });
  st.family = null;
  await T.famBase.del();
};
})();
