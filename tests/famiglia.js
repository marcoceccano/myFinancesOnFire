/* Prova della famiglia: due telefoni (Marco e Debora) con l'app vera, ponte vero con spazio KV simulato, Enable Banking simulato.
   Uso: node tests/famiglia.js docs/index.html [backup.json] */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm"), { generateKeyPairSync } = require("crypto");
const [, , htmlPath, backupPath] = process.argv;
let fails = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FAIL ") + m); if (!c) fails++; };
const wait = ms => new Promise(r => setTimeout(r, ms || 60));
(async () => {
  const worker = (await import(path.resolve(__dirname, "../ponte/worker.js"))).default;
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048, publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" } });
  const ORIGIN = "https://utente.github.io", APP = ORIGIN + "/myFinancesOnFire/", BRIDGE = "https://myfinances-ponte.utente.workers.dev", TOKEN = "k".repeat(43);
  const kv = new Map(), writes = { n: 0 };
  const KV = { get: async (k, t) => kv.has(k) ? (t === "json" ? JSON.parse(kv.get(k)) : kv.get(k)) : null, put: async (k, v) => { writes.n++; kv.set(k, v); }, delete: async k => { kv.delete(k); } };
  const env = { EB_APP_ID: "11111111-2222-3333-4444-555555555555", EB_PRIVATE_KEY: privateKey, APP_TOKEN: TOKEN, ALLOWED_ORIGIN: ORIGIN, REDIRECT_URL: APP, FAMIGLIA: KV };
  const SID = "497f6eca-6276-4993-bfeb-53cbbbba6f08", U1 = "07cc67f4-45d6-494b-adac-09b5cbc7e2b5";
  const EB_TX = [], eb = { A: 0, B: 0, deleted: 0 };
  /* Enable Banking simulato: il ponte lo chiama con il fetch globale; "cur" dice quale telefono ha fatto la richiesta */
  let cur = "A";
  global.fetch = async (url, opt) => {
    const u = new URL(String(url)), J = o => new Response(JSON.stringify(o), { status: 200, headers: { "Content-Type": "application/json" } });
    if (u.hostname !== "api.enablebanking.com") throw new Error("rete non disponibile nei test: " + url);
    if (u.pathname.startsWith("/accounts/")) { eb[cur]++; return J({ transactions: EB_TX }); }
    if (u.pathname === "/sessions/" + SID && opt.method === "DELETE") { eb.deleted++; return J({}); }
    return new Response("{}", { status: 404 });
  };
  const html = fs.readFileSync(htmlPath, "utf8"), js = html.split("<script>")[1].split("</script>")[0];

  function phone(label, hash) {
    delete require.cache[require.resolve("./dom-stub.js")];
    const stub = require("./dom-stub.js");
    const loc = { protocol: "https:", hostname: "utente.github.io", origin: ORIGIN, pathname: "/myFinancesOnFire/", search: "", hash: hash || "", href: APP + (hash || "") };
    const store = {}, P = { label, stub, loc, beforePut: null };
    const pfetch = async (url, opt) => {
      const u = new URL(String(url));
      cur = label;
      if (u.pathname === "/family" && P.beforePut && JSON.parse(opt.body).op === "put") { const f = P.beforePut; P.beforePut = null; await f(); }
      return worker.fetch(new Request(String(url), Object.assign({}, opt, { headers: Object.assign({ Origin: ORIGIN }, opt.headers) })), env);
    };
    const ctx = { console, setTimeout, clearTimeout, setInterval, clearInterval, TextEncoder, TextDecoder, URL, URLSearchParams, Blob, Response, Request, Headers,
      crypto: globalThis.crypto, CompressionStream, DecompressionStream, atob, btoa, structuredClone, queueMicrotask, fetch: pfetch,
      document: stub.document, location: loc, history: { length: 1, pushState() { }, replaceState(a, b, url) { if (url !== undefined) { loc.hash = ""; loc.search = ""; } }, back() { } },
      navigator: { storage: {}, languages: ["it-CH", "it"], clipboard: { writeText: async () => { } } },
      localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
      scrollTo() { }, addEventListener() { } };
    ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
    vm.createContext(ctx);
    stub.buildShell(html);
    vm.runInContext(js, ctx);
    P.T = ctx.T; P.A = ctx.T.A; P.store = store;
    P.$ = id => stub.document.getElementById(id);
    P.txt = el => el.textContent.replace(/\s+/g, " ").trim();
    P.btn = label2 => P.stub.document.body.querySelectorAll("button").find(b => P.txt(b).includes(label2));
    P.sbtn = label2 => P.$("sheetBody").querySelectorAll("button").find(b => P.txt(b) === label2);
    P.input = aria => P.stub.document.body.querySelectorAll("input").find(i => (i.attributes["aria-label"] || "") === aria);
    return P;
  }
  /* allineamento esplicito, aspettando che finisca quello eventualmente gia' in corso */
  const sync = async P => { for (let i = 0; i < 100 && P.A._famBusy; i++) await wait(100); const r = await P.A.famSync(true, true); for (let i = 0; i < 100 && P.A._famBusy; i++) await wait(100); return r; };
  const canon = (P, v) => P.T.canon(JSON.parse(JSON.stringify(v)));

  /* --- telefono di Marco --- */
  const M = phone("A"); await wait(300);
  let st;
  if (backupPath) { st = M.T.readBackup(JSON.parse(fs.readFileSync(backupPath, "utf8"))); } else st = M.T.makeDemoState();
  st.profile.onboarded = true; st.profile.demo = false;
  Object.assign(st.bank, { url: BRIDGE, token: TOKEN, session: SID, validUntil: "2027-05-01T00:00:00Z", accounts: [{ uid: U1, currency: "CHF", name: "Marco" }], lastSync: new Date().toISOString(), auto: true });
  M.A.S = st; await M.T.save(st, true);
  M.A.go("altro", "famiglia"); await wait(50);
  ok(/Crea la famiglia/.test(M.txt(M.$("view"))), "Marco: schermata Famiglia con la creazione");
  const nm = M.input("Il tuo nome"); nm.value = "Marco"; nm.dispatch("input");
  M.btn("Crea la famiglia").click(); await wait(600);
  const S = M.A.S;
  ok(S.family && S.family.role === "master" && kv.size === 1, "Marco: famiglia creata, una copia nel ponte");
  const stored = [...kv.values()][0];
  const sample = S.txs.filter(t => t.flow === "spesa").slice(0, 30).map(t => t.desc).filter(d => d.length > 4);
  ok(!sample.some(d => stored.includes(d)) && !stored.includes(String(S.profile.incomeMonthly || "xx")) && /"data":"v1\.g\./.test(stored), "la copia nel ponte e' cifrata (nessun esercente o importo leggibile)");
  ok(M.$("view").querySelector("svg.qr") && /Mostralo solo di persona/.test(M.txt(M.$("view"))), "Marco: QR mostrato con l'avviso di sicurezza");
  const link = M.T.famLink(S, M.A.appUrl()), q = M.T.qr(link);
  ok(link.startsWith(APP + "#famiglia=") && q.version <= 13, "collegamento nel QR: " + link.length + " caratteri, QR versione " + q.version);

  /* --- telefono di Debora: inquadra il QR --- */
  const D = phone("B", link.slice(link.indexOf("#"))); await wait(400);
  ok(!D.$("sheet").hidden && /Entra nella famiglia/.test(D.txt(D.$("sheetBody"))) && /Marco ti invita/.test(D.txt(D.$("sheetBody"))), "Debora: l'app si apre con l'invito di Marco");
  ok(D.loc.hash === "", "il collegamento con la chiave viene tolto dalla barra degli indirizzi");
  const dn = D.input("Il tuo nome"); dn.value = "Debora"; dn.dispatch("input");
  D.btn("Entra nella famiglia").click(); await wait(1500);
  const DS = () => D.A.S;
  ok(DS().family && DS().family.role === "member" && DS().family.master === "Marco", "Debora: e' nella famiglia di Marco");
  ok(DS().txs.length === S.txs.length && canon(D, DS().categories) === canon(M, S.categories) && canon(D, DS().rules) === canon(M, S.rules) && canon(D, DS().fixed) === canon(M, S.fixed), "Debora: stessi movimenti (" + DS().txs.length + "), categorie, regole e costi fissi");
  ok(canon(D, DS().fire) === canon(M, S.fire) && DS().profile.incomeMonthly === S.profile.incomeMonthly && DS().bank.session === SID && DS().bank.url === BRIDGE, "Debora: stesso FIRE, reddito e collegamento Revolut");
  ok(eb.B === 0, "Debora non scarica da Revolut: Marco l'ha appena fatto");
  await sync(D); await sync(M);
  ok(Object.values(S.family.devices).map(d => d.name).sort().join(",") === "Debora,Marco", "Marco vede i due telefoni della famiglia");

  /* --- modifiche da tutti e due --- */
  const cat = id => c => c.id === id;
  DS().categories.find(cat("ristoranti")).budget = 777; D.A.save();
  await sync(D); await sync(M);
  ok(S.categories.find(cat("ristoranti")).budget === 777 && /modifiche di Debora/.test(M.txt(M.$("toast"))), "budget cambiato da Debora arriva a Marco (con avviso)");
  DS().vacations.push({ from: "2026-12-20", to: "2026-12-30", label: "Natale" }); D.A.save();
  const removed = S.vacations[0]; S.vacations.splice(0, 1); M.A.save();
  await sync(D); await sync(M); await sync(D);
  ok(canon(M, S.vacations) === canon(D, DS().vacations) && S.vacations.some(v => v.label === "Natale") && !S.vacations.some(v => v.label === (removed && removed.label)), "modifiche contemporanee su voci diverse: tenute tutte e due (vacanza aggiunta e tolta)");
  DS().categories.find(cat("shopping")).budget = 111; D.A.save(); await sync(D);
  S.categories.find(cat("shopping")).budget = 222; M.A.save(); await sync(M); await sync(D);
  ok(S.categories.find(cat("shopping")).budget === 222 && DS().categories.find(cat("shopping")).budget === 222, "stessa voce cambiata da tutti e due: vince l'ultima");
  /* conflitto sul ponte: Debora scrive proprio mentre Marco sta caricando */
  M.beforePut = async () => { DS().categories.find(cat("salute")).budget = 55; D.A.save(); await sync(D); };
  S.categories.find(cat("svago")).budget = 66; M.A.save(); await sync(M); await sync(D);
  ok(S.categories.find(cat("salute")).budget === 55 && S.categories.find(cat("svago")).budget === 66 && DS().categories.find(cat("svago")).budget === 66, "scritture incrociate sul ponte: nessuna modifica persa");
  /* regola nuova di Debora: riclassifica anche da Marco */
  const coop = S.txs.find(t => /coop/i.test(t.desc) && t.flow === "spesa");
  if (coop) { D.T.addUserRule(DS(), coop.desc, "spesa", "casa", null); D.T.reclassifyAll(DS()); D.A.save(); await sync(D); await sync(M);
    ok(S.txs.filter(t => t.desc === coop.desc && !t.manual).every(t => t.cat === "casa"), "regola creata da Debora applicata anche sul telefono di Marco"); }

  /* --- il FIRE lo gestisce Marco --- */
  const wr = S.fire.withdrawalRate;
  DS().fire.withdrawalRate = 0.05; DS().fire.retireAge = 50; D.A.save(); await sync(D); await sync(M);
  ok(DS().fire.withdrawalRate === wr && S.fire.withdrawalRate === wr && DS().fire.retireAge === 50 && S.fire.retireAge !== 50, "Debora non cambia il FIRE di Marco; il cursore dell'eta' resta suo");
  S.fire.spendFire = 6100; M.A.save(); await sync(M); await sync(D);
  ok(DS().fire.spendFire === 6100, "i numeri del FIRE di Marco arrivano a Debora");
  D.A.go("fire"); await wait(1500);
  const fsx = D.$("view").querySelector("fieldset.plain");
  ok(fsx && fsx.attributes.disabled !== undefined && /li gestisce Marco/.test(D.txt(D.$("view"))), "Debora: parametri del FIRE in sola lettura");
  D.A.go("altro", "profilo"); await wait(50);
  ok(D.$("view").querySelector("fieldset.plain").attributes.disabled !== undefined, "Debora: reddito e valuta in sola lettura");
  D.A.go("altro", "collega"); await wait(50);
  ok(!D.btn("Scollega") && D.btn("Aggiorna ora") && !/Il tuo ponte/.test(D.txt(D.$("view"))), "Debora: puo' aggiornare Revolut ma non scollegarlo ne' vedere il ponte");
  M.A.go("fire"); await wait(1500);
  ok(!M.$("view").querySelector("fieldset.plain"), "Marco: parametri del FIRE modificabili");

  /* --- portafoglio: lo scarica un telefono, lo vede anche l'altro --- */
  S.portfolio = M.T.demoPortfolio(); M.A.save(); await sync(M); await sync(D);
  ok(DS().portfolio && DS().portfolio.nav === S.portfolio.nav && DS().portfolio.positions.length === S.portfolio.positions.length, "portafoglio di Marco visibile anche a Debora");
  /* --- Revolut: scarica un telefono, l'altro riceve --- */
  EB_TX.push({ transaction_id: "fam-1", transaction_amount: { currency: "CHF", amount: "58.40" }, credit_debit_indicator: "DBIT", transaction_date: "2026-11-04", creditor: { name: "Migros Lugano" }, merchant_category_code: "5411" });
  S.bank.lastSync = null; await M.A.syncNow(true); await wait(100); await sync(M); await sync(D);
  ok(eb.A >= 1 && DS().txs.some(t => t.desc === "Migros Lugano"), "movimento scaricato da Marco arriva a Debora");
  const nB = eb.B; D.A.autoSync(); await wait(200);
  ok(eb.B === nB, "Debora non riscarica da Revolut (ultimo aggiornamento condiviso)");
  ok(writes.n < 40, "scritture sul ponte contenute: " + writes.n);

  /* --- chiave nuova: Debora deve inquadrare il nuovo QR --- */
  M.A.go("altro", "famiglia"); await wait(50);
  await M.T.famRekey(S); await M.T.save(S, true);
  ok(kv.size === 1 && !kv.has("fam:" + DS().family.id), "chiave cambiata: la vecchia copia e' stata cancellata");
  await sync(D); D.A.go("home"); await wait(1500);
  ok(DS().family.gone && /La famiglia non e' piu' raggiungibile/.test(D.txt(D.$("view"))), "Debora: avviso che serve un QR nuovo");
  D.A.go("altro", "famiglia"); await wait(50);
  D.btn("Esci dalla famiglia").click(); await wait(80); D.sbtn("Esci").click(); await wait(300);
  ok(!DS().family && !DS().bank.token && !DS().bank.session && DS().txs.length > 0, "Debora esce: tiene i dati, perde il collegamento Revolut di Marco");

  /* --- ricomincia da zero --- */
  M.A.go("altro"); await wait(50);
  ok(/Ricomincia da zero/.test(M.txt(M.$("view"))) && !/Cancella tutti i dati/.test(M.txt(M.$("view"))), "Altro: voce Ricomincia da zero");
  [...M.$("view").querySelectorAll("div.li.tap")].find(x => M.txt(x).startsWith("Ricomincia da zero")).dispatch("click"); await wait(80);
  ok(/Scarica prima un backup/.test(M.txt(M.$("sheetBody"))) && /Tieni il ponte e il collegamento Revolut/.test(M.txt(M.$("sheetBody"))) && /famiglia viene sciolta/.test(M.txt(M.$("sheetBody"))), "foglio di reset: backup, scelta sul collegamento, avviso famiglia");
  M.btn("Ricomincia").click(); await wait(80);
  ok(/Sei sicuro/.test(M.txt(M.$("sheetBody"))), "doppia conferma");
  M.btn("cancella tutto").click(); await wait(600);
  const R = M.A.S;
  ok(R.txs.length === 0 && R.categories.length > 0 && !R.family && /Benvenuto/.test(M.txt(M.$("view"))), "reset: dati cancellati, si riparte dalla configurazione iniziale");
  ok(R.bank.url === BRIDGE && R.bank.token === TOKEN && R.bank.session === SID && kv.size === 0 && !M.store["myfinances-on-fire:famBase"], "reset: ponte e Revolut tenuti, famiglia sciolta, base cancellata");
  /* reset senza tenere il collegamento: consenso revocato */
  R.profile.onboarded = true; await M.T.save(R, true);
  const del0 = eb.deleted;
  await M.A.doReset(false); await wait(300);
  ok(!M.A.S.bank.url && !M.A.S.bank.session && eb.deleted === del0 + 1, "reset completo: consenso Revolut revocato e ponte dimenticato");
  /* il vecchio archivio "traguardo" non ricompare */
  M.store["traguardo:state"] = JSON.stringify(st); await M.T.storage.wipe();
  ok(!M.store["traguardo:state"] && !(await M.T.load()), "reset: anche i dati col vecchio nome vengono cancellati");

  const errs = M.stub.errors.length + D.stub.errors.length;
  console.log("errori JS:", errs); M.stub.errors.concat(D.stub.errors).slice(0, 3).forEach(e => console.log(e));
  if (errs) fails++;
  console.log(fails ? fails + " test falliti" : "Prova della famiglia superata");
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log("ERRORE", e.stack); process.exit(1); });
