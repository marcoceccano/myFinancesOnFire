/* myFinances on FIRE · archivio locale (IndexedDB sul telefono), backup e ripristino */
"use strict";
(function () {
const DB = "myfinances-on-fire", LEGACY_DB = "traguardo", STORE = "kv", KEY = "state";
const clone = o => JSON.parse(JSON.stringify(o));

T.FIRE_DEFAULTS = {
  birthYear: null, investable: 0, cash: 0, equityShare: 0.9, market: "world", safeReturn: 0.01, inflation: 0.015,
  savingMode: "auto", monthlySaving: 0, savingGrowth: 0, spendMode: "auto", spendFire: 0,
  withdrawalRate: 0.035, strategy: "guardrail", band: 0.2, step: 0.1, floor: 0.8, taxRate: 0,
  pensions: [], lumps: [], endAge: 95, confidence: 0.85, sims: 2000, blockLen: 5
};
T.newState = () => ({
  app: T.APP.id, schema: T.APP.schema,
  profile: { name: "", lang: T.LANG, currency: "CHF", locale: "de-CH", incomeMonthly: 0, fx: { EUR: 0.94, USD: 0.80, GBP: 1.07 }, onboarded: false, demo: false, created: T.today() },
  categories: clone(T.DEFAULT_CATEGORIES).map(c => Object.assign(c, { name: T.tr(c.name), budget: 0 })),
  rules: [], txs: [], vacations: [], fixed: [],
  budget: { preset: "attuale", vacationYear: 0, investMonthly: 0 },
  fire: clone(T.FIRE_DEFAULTS),
  csvProfiles: [], imports: [], meta: { lastBackup: null, lastSaved: null }, bank: T.bankDefaults()
});

/* migrazioni future: ogni versione dello schema aggiunge un passo */
T.migrate = st => {
  if (st.profile && !st.profile.lang) st.profile.lang = "it";   /* dati creati prima delle lingue */
  const base = T.newState();
  for (const k of Object.keys(base)) if (st[k] == null) st[k] = base[k];
  st.profile = Object.assign(base.profile, st.profile);
  st.fire = Object.assign(clone(T.FIRE_DEFAULTS), st.fire);
  st.budget = Object.assign(base.budget, st.budget);
  st.bank = Object.assign(T.bankDefaults(), st.bank || {});
  st.schema = T.APP.schema;
  return st;
};

/* backend: IndexedDB, poi localStorage, poi memoria (test) */
function idb(name) {
  return new Promise((res, rej) => {
    if (typeof indexedDB === "undefined") return rej(new Error("no idb"));
    const r = indexedDB.open(name || DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
const mem = {};
T.storage = {
  async get() {
    const read = async name => { const db = await idb(name); return await new Promise((res, rej) => { const q = db.transaction(STORE).objectStore(STORE).get(KEY); q.onsuccess = () => res(q.result || null); q.onerror = () => rej(q.error); }); };
    try {
      const v = await read(DB); if (v) return v;
      /* dati salvati con il nome precedente dell'app (Traguardo): vengono ripresi */
      try { return await read(LEGACY_DB); } catch (e) { return null; }
    }
    catch (e) { try { const s = localStorage.getItem(DB + ":" + KEY) || localStorage.getItem(LEGACY_DB + ":" + KEY); return s ? JSON.parse(s) : null; } catch (e2) { return mem[KEY] ? clone(mem[KEY]) : null; } }
  },
  async set(v) {
    try { const db = await idb(); await new Promise((res, rej) => { const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).put(v, KEY); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); }
    catch (e) { try { localStorage.setItem(DB + ":" + KEY, JSON.stringify(v)); } catch (e2) { mem[KEY] = clone(v); } }
  },
  async clear() {
    try { const db = await idb(); await new Promise(res => { const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).delete(KEY); tx.oncomplete = res; tx.onerror = res; }); } catch (e) { }
    try { localStorage.removeItem(DB + ":" + KEY); } catch (e) { } delete mem[KEY];
  },
  async persist() { try { if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist(); } catch (e) { } return false; }
};
T.load = async () => { const s = await T.storage.get(); return s ? T.migrate(s) : null; };
let saveTimer = null;
T.save = (st, now) => {
  st.meta.lastSaved = new Date().toISOString();
  clearTimeout(saveTimer);
  if (now) return T.storage.set(st);
  return new Promise(res => { saveTimer = setTimeout(() => T.storage.set(st).then(res), 250); });
};

/* backup: un solo file JSON, leggibile, che contiene tutto */
T.makeBackup = st => ({ app: T.APP.id, kind: "backup", schema: T.APP.schema, version: T.APP.version, exported: new Date().toISOString(), state: st });
T.readBackup = obj => {
  if (!obj || !(obj.app === T.APP.id || obj.app === "traguardo") || !obj.state) throw new Error(T.tr("Questo file non e' un backup di ") + T.APP.name);
  if ((obj.schema || 1) > T.APP.schema) throw new Error(T.tr("Il backup arriva da una versione piu' recente dell'app: aggiorna l'app e riprova"));
  const st = T.migrate(obj.state);
  if (!Array.isArray(st.txs) || !Array.isArray(st.categories)) throw new Error(T.tr("Backup incompleto"));
  return st;
};
})();
