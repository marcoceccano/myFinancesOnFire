/* Prova completa: app + ponte reale + Enable Banking simulato.
   Uso: node tests/collegamento.js docs/index.html [backup.json] */
"use strict";
const fs = require("fs"), path = require("path"), { generateKeyPairSync } = require("crypto");
const stub = require("./dom-stub.js");
const [, , htmlPath, backupPath] = process.argv;
let fails = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FAIL ") + m); if (!c) fails++; };
(async () => {
  const worker = (await import(path.resolve(__dirname, "../ponte/worker.js"))).default;
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048, publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" } });
  const APP = "https://utente.github.io/myFinancesOnFire/", ORIGIN = "https://utente.github.io", TOKEN = "k".repeat(43);
  const env = { EB_APP_ID: "11111111-2222-3333-4444-555555555555", EB_PRIVATE_KEY: privateKey, APP_TOKEN: TOKEN, ALLOWED_ORIGIN: ORIGIN, REDIRECT_URL: APP };
  const SID = "497f6eca-6276-4993-bfeb-53cbbbba6f08", U1 = "07cc67f4-45d6-494b-adac-09b5cbc7e2b5", U2 = "17cc67f4-45d6-494b-adac-09b5cbc7e2b6";
  /* banca simulata: le ultime spese dell'estratto (date spostate di 1 giorno) + 5 nuove + 1 in sospeso */
  let EB_TX = { [U1]: [], [U2]: [] }, round = 1, ebCalls = 0;
  const realFetch = global.fetch;
  global.fetch = async (url, opt) => {
    const u = new URL(String(url));
    if (u.hostname === "api.enablebanking.com") {
      ebCalls++;
      const J = o => new Response(JSON.stringify(o), { status: 200, headers: { "Content-Type": "application/json" } });
      if (u.pathname === "/aspsps") return J({ aspsps: [{ name: "Revolut", country: "LT", maximum_consent_validity: 15552000 }] });
      if (u.pathname === "/auth") { const b = JSON.parse(opt.body); return J({ url: "https://auth.enablebanking.com/ais/start?sessionid=x&state=" + b.state }); }
      if (u.pathname === "/sessions") return J({ session_id: SID, access: { valid_until: "2027-05-01T00:00:00Z" }, accounts: [{ uid: U1, currency: "CHF", name: "Marco" }, { uid: U2, currency: "EUR", name: "Marco" }] });
      if (u.pathname.startsWith("/accounts/")) { const uid = u.pathname.split("/")[2]; const from = u.searchParams.get("date_from"); return J({ transactions: EB_TX[uid].filter(t => (t.transaction_date || t.booking_date) >= from).map(t => Object.assign({}, t, { status: t.pdng && round === 1 ? "PDNG" : "BOOK" })) }); }
      return new Response("{}", { status: 404 });
    }
    return worker.fetch(new Request(String(url), Object.assign({}, opt, { headers: Object.assign({ Origin: ORIGIN }, opt.headers) })), env);
  };
  const html = fs.readFileSync(htmlPath, "utf8"); const js = html.split("<script>")[1].split("</script>")[0];
  global.document = stub.document; global.window = global;
  const loc = { protocol: "https:", hostname: "utente.github.io", origin: ORIGIN, pathname: "/myFinancesOnFire/", search: "", href: APP };
  Object.defineProperty(global, "location", { value: loc, configurable: true, writable: true });
  global.history = { length: 1, pushState() { }, replaceState() { loc.search = ""; }, back() { } };
  global.scrollTo = () => { }; global.addEventListener = () => { };
  Object.defineProperty(global, "navigator", { value: { storage: {}, clipboard: { writeText: async () => { } } }, configurable: true });
  const store = {}; global.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  stub.buildShell(html);
  const wait = ms => new Promise(r => setTimeout(r, ms || 60)), $ = id => stub.document.getElementById(id), txt = e => e.textContent.replace(/\s+/g, " ").trim();
  eval(js); await wait(300);
  /* dati reali di partenza */
  if (backupPath) { const b = fs.readFileSync(backupPath); const st = T.readBackup(JSON.parse(b)); st.profile.onboarded = true; T.A.S = st; await T.save(st, true); }
  else { T.setLang("it"); T.A.S = T.makeDemoState(); Object.assign(T.A.S.profile, { lang: "it", demo: false }); await T.save(T.A.S, true); }
  const S = T.A.S;
  const base = S.txs.filter(t => /^revolut/.test(t.src) && t.flow === "spesa" && t.d >= "2026-10-04");
  for (const t of base) { const uid = t.cur === "EUR" ? U2 : t.cur === "CHF" ? U1 : null; if (!uid) continue;
    EB_TX[uid].push({ transaction_id: "old-" + t.id, transaction_amount: { currency: t.cur, amount: Math.abs(t.amtLoc).toFixed(2) }, credit_debit_indicator: t.amtLoc < 0 ? "DBIT" : "CRDT", transaction_date: T.addDays(t.d, 1), creditor: { name: t.desc.toUpperCase() } }); }
  const fresh = [["2026-10-20", "Coop", 64.3, U1], ["2026-10-24", "Pizzeria Bella", 92, U1], ["2026-10-28", "Golf Idea", 85, U1], ["2026-11-01", "Migros", 41.2, U1], ["2026-11-02", "Amazon", 39.9, U2]];
  fresh.forEach(([d, n, a, u], i) => EB_TX[u].push({ transaction_id: "new-" + i, transaction_amount: { currency: u === U2 ? "EUR" : "CHF", amount: a.toFixed(2) }, credit_debit_indicator: "DBIT", transaction_date: d, creditor: { name: n }, merchant_category_code: "5411" }));
  EB_TX[U1].push({ transaction_id: "pend-1", transaction_amount: { currency: "CHF", amount: "27.80" }, credit_debit_indicator: "DBIT", transaction_date: "2026-11-03", creditor: { name: "Bar Centrale" }, pdng: true });
  const overlap = base.filter(t => t.cur === "EUR" || t.cur === "CHF").length;
  const before = S.txs.length;
  /* configurazione dalla schermata */
  T.A.go("altro", "collega"); await wait(100);
  ok(txt($("view")).includes("Collegamento automatico Revolut") && $("view").querySelectorAll("input").some(i => i.value === APP), "schermata collegamento con l'indirizzo dell'app");
  const urlIn = $("view").querySelectorAll("input").find(i => (i.attributes["aria-label"] || "") === "Indirizzo del ponte");
  urlIn.value = "https://myfinances-ponte.utente.workers.dev"; urlIn.dispatch("input");
  const tokIn = $("view").querySelectorAll("input").find(i => (i.attributes["aria-label"] || "") === "Codice di accesso");
  tokIn.value = TOKEN; tokIn.dispatch("input");
  const verify = $("view").querySelectorAll("button").find(b => txt(b) === "Verifica il ponte");
  global.fetch_orig = null;
  /* la verifica chiama /application: la aggiungiamo alla banca simulata */
  const f0 = global.fetch; global.fetch = async (url, opt) => { if (String(url) === "https://api.enablebanking.com/application") return new Response(JSON.stringify({ name: "myFinances", environment: "PRODUCTION", active: true, redirect_urls: [APP] }), { status: 200 }); return f0(url, opt); };
  verify.click(); await wait(400);
  ok(/Ponte raggiungibile/.test(txt($("view"))) && /Indirizzo di ritorno corretto/.test(txt($("view"))) && /Applicazione attiva/.test(txt($("view"))), "verifica del ponte: tutto in ordine");
  /* consenso */
  await T.A.startConnect(); await wait(100);
  ok(/auth\.enablebanking\.com/.test(loc.href) && S.bank.pendingState && loc.href.includes(S.bank.pendingState), "avvio del consenso verso Enable Banking");
  loc.search = "?code=abc123&state=" + S.bank.pendingState;
  await T.A.finishConnect(new URLSearchParams(loc.search)); await wait(800);
  ok(T.bankConnected(S) && S.bank.accounts.length === 2 && !S.bank.pendingState, "ritorno da Revolut: sessione e 2 conti salvati");
  const r1 = S.bank.lastResult;
  ok(r1 && r1.added === 6 && r1.dup === overlap && r1.pending === 1, "primo aggiornamento: 6 nuovi (1 in sospeso), " + overlap + " gia' presenti dall'estratto riconosciuti (" + JSON.stringify(r1) + ")");
  ok(S.txs.length === before + 6, "nessun doppione nello storico (" + before + " -> " + S.txs.length + ")");
  const pizza = S.txs.find(t => t.desc === "Pizzeria Bella" && t.src === "revolut-api");
  ok(pizza && pizza.cat === "ristoranti" && pizza.flow === "spesa", "i nuovi movimenti prendono le categorie");
  const amz = S.txs.find(t => t.desc === "Amazon" && t.src === "revolut-api");
  ok(amz && Math.abs(amz.amt - (-39.9 * S.profile.fx.EUR)) < 0.01, "conversione in CHF dei movimenti in EUR");
  /* secondo giro: il sospeso diventa definitivo */
  round = 2; S.bank.lastSync = null;
  await T.A.syncNow(true); await wait(300);
  ok(S.bank.lastResult.added === 0 && S.bank.lastResult.pending === 0 && S.txs.filter(t => t.desc === "Bar Centrale" && t.src === "revolut-api").length === 1, "secondo aggiornamento: in sospeso diventato definitivo, nessun doppione");
  /* aggiornamento automatico non ripetuto entro 4 ore */
  const n0 = ebCalls; T.A.autoSync(); await wait(200);
  ok(ebCalls === n0, "aggiornamento automatico limitato (non piu' di uno ogni 4 ore)");
  /* home e barra */
  T.A.go("home"); await wait(1200);
  ok(!$("btnSync").hidden && /Revolut aggiornato/.test(txt($("subtitle"))), "barra: pulsante aggiorna e stato");
  /* scadenza vicina */
  S.bank.validUntil = new Date(Date.now() + 5 * 864e5).toISOString(); T.A.render(); await wait(1200);
  ok(/Rinnova il collegamento Revolut/.test(txt($("view"))), "home: avviso di rinnovo del consenso");
  S.bank.validUntil = new Date(Date.now() - 864e5).toISOString(); T.A.render(); await wait(1200);
  ok(/Ricollega Revolut/.test(txt($("view"))), "home: consenso scaduto");
  /* import manuale dell'estratto dopo il collegamento: niente doppioni */
  const rows = S.txs.filter(t => t.src === "revolut-api").map(t => ({ d: T.addDays(t.d, -1), desc: t.desc + " (estratto)", rcat: "Esercente", amtLoc: t.amtLoc, cur: t.cur, amt: t.amt }));
  const rr = T.mergeTxs(S, rows, "revolut");
  ok(rr.added === 0, "estratto importato dopo il collegamento: nessun doppione");
  /* errori */
  S.bank.validUntil = "2099-01-01T00:00:00Z"; S.bank.token = "sbagliato".repeat(5); S.bank.lastSync = null;
  await T.A.syncNow(false); await wait(200);
  ok(/APP_TOKEN/.test(txt($("sheetBody"))), "errore di codice spiegato in chiaro");
  T.closeSheet();
  /* ritorno con stato non valido */
  await T.A.finishConnect(new URLSearchParams("?code=x&state=altro")); await wait(100);
  ok(/non riconosciuto/.test(txt($("sheetBody"))), "ritorno non avviato dall'app rifiutato");
  T.closeSheet();
  console.log("errori JS:", stub.errors.length); stub.errors.slice(0, 3).forEach(e => console.log(e));
  if (stub.errors.length) fails++;
  console.log(fails ? fails + " test falliti" : "Prova completa del collegamento superata");
  process.exitCode = fails ? 1 : 0;
})().catch(e => { console.log("ERRORE", e.stack); process.exitCode = 1; });
