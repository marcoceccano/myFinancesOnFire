/* Prova del portafoglio: app vera + ponte vero + Interactive Brokers simulato (report Flex inventato).
   Uso: node tests/portafoglio.js docs/index.html [backup.json] */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm"), { generateKeyPairSync } = require("crypto");
const [, , htmlPath, backupPath] = process.argv;
let fails = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FAIL ") + m); if (!c) fails++; };
const wait = ms => new Promise(r => setTimeout(r, ms || 60));
(async () => {
  const worker = (await import(require("url").pathToFileURL(path.resolve(__dirname, "../ponte/worker.js")).href)).default;
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048, publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" } });
  const ORIGIN = "https://utente.github.io", APP = ORIGIN + "/myFinancesOnFire/", BRIDGE = "https://myfinances-ponte.utente.workers.dev", TOKEN = "k".repeat(43);
  const env = { EB_APP_ID: "11111111-2222-3333-4444-555555555555", EB_PRIVATE_KEY: privateKey, APP_TOKEN: TOKEN, ALLOWED_ORIGIN: ORIGIN, REDIRECT_URL: APP, IBKR_TOKEN: "9".repeat(24), IBKR_QUERY_ID: "1099104", IBKR_POLL_MS: "0" };
  const XML = fs.readFileSync(path.join(__dirname, "fixtures/flex-esempio.xml"), "utf8");
  let ibMode = "ok", ibCalls = 0;
  global.fetch = async (url, opt) => {
    const u = new URL(String(url)), X = t => new Response(t, { status: 200, headers: { "Content-Type": "text/xml" } });
    if (/interactivebrokers\.com$/.test(u.hostname)) {
      ibCalls++;
      if (/SendRequest/.test(u.pathname)) return ibMode === "expired" ? X("<FlexStatementResponse><Status>Fail</Status><ErrorCode>1012</ErrorCode><ErrorMessage>Token has expired.</ErrorMessage></FlexStatementResponse>") : X("<FlexStatementResponse><Status>Success</Status><ReferenceCode>555</ReferenceCode><Url>https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService/GetStatement</Url></FlexStatementResponse>");
      return X(XML);
    }
    throw new Error("rete non disponibile nei test: " + url);
  };
  const html = fs.readFileSync(htmlPath, "utf8"), js = html.split("<script>")[1].split("</script>")[0];
  const stub = require("./dom-stub.js");
  const loc = { protocol: "https:", hostname: "utente.github.io", origin: ORIGIN, pathname: "/myFinancesOnFire/", search: "", hash: "", href: APP };
  const store = {};
  const ctx = { console, setTimeout, clearTimeout, setInterval, clearInterval, TextEncoder, TextDecoder, URL, URLSearchParams, Blob, Response, Request, Headers,
    crypto: globalThis.crypto, CompressionStream, DecompressionStream, atob, btoa, structuredClone, queueMicrotask,
    fetch: (url, opt) => /workers\.dev/.test(String(url)) ? worker.fetch(new Request(String(url), Object.assign({}, opt, { headers: Object.assign({ Origin: ORIGIN }, opt.headers) })), env) : global.fetch(url, opt),
    document: stub.document, location: loc, history: { length: 1, pushState() { }, replaceState() { }, back() { } },
    navigator: { storage: {}, languages: ["it-CH", "it"], clipboard: { writeText: async () => { } } },
    localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } }, scrollTo() { }, addEventListener() { } };
  ctx.window = ctx; ctx.globalThis = ctx; vm.createContext(ctx); stub.buildShell(html); vm.runInContext(js, ctx);
  const T = ctx.T, A = T.A, $ = id => stub.document.getElementById(id), txt = el => el.textContent.replace(/\s+/g, " ").trim();
  const btn = (root, l) => root.querySelectorAll("button").find(b => txt(b).includes(l));
  await wait(300);
  let st = backupPath ? T.readBackup(JSON.parse(fs.readFileSync(backupPath, "utf8"))) : T.makeDemoState();
  st.portfolio = null; st.profile.onboarded = true; st.profile.demo = false;
  Object.assign(st.bank, { url: BRIDGE, token: TOKEN });
  st.fire.investable = 450000; st.fire.ibkrLink = false;
  A.S = st; await T.save(st, true);
  /* Home senza portafoglio: nessun riquadro */
  A.go("home"); await wait(1500);
  ok(!$("pfCard"), "home: nessun riquadro portafoglio prima del collegamento");
  /* configurazione e primo scaricamento */
  A.go("altro"); await wait(50);
  ok(/Interactive Brokers/.test(txt($("view"))), "altro: voce Interactive Brokers");
  A.go("altro", "ibkr"); await wait(50);
  ok(/1 · Crea la Flex Query/.test(txt($("view"))) && /IBKR_TOKEN/.test(txt($("view"))), "configurazione: i 3 passi");
  btn($("view"), "Scarica il portafoglio").click(); await wait(400);
  const P = A.S.portfolio;
  ok(T.pfHas(A.S) && P.base === "CHF" && P.positions.length === 6 && Math.abs(P.nav - 378775.51) < 1 && P.cash === 12450.6, "report letto: 6 posizioni, valore " + (P && P.nav) + " CHF, liquidita' " + (P && P.cash));
  ok(P.history.length > 250 && P.history[P.history.length - 1].d === "2026-11-05" && P.divs.length === 9 && P.flows.length === 2 && P.hasFlows, "storico di un anno (" + P.history.length + " giorni), dividendi (" + P.divs.length + "), versamenti e prelievi (" + (P.flows || []).length + ")");
  /* rendimento ponderato nel tempo: i versamenti non sono guadagni */
  { const all = T.pfSeries(P, "ALL"), h = P.history, fl = { "2026-03-02": 12000, "2026-08-03": -5000 };
    let g = 1; for (let i = 1; i < h.length; i++) g *= (h[i].v - (fl[h[i].d] || 0)) / h[i - 1].v;
    const exp = g - 1;
    ok(Math.abs(all.ret - exp) < 1e-9 && Math.abs(all.abs - (h[h.length - 1].v - h[0].v)) < 0.01, "TWR dall'inizio " + (all.ret * 100).toFixed(2) + "% (valore " + ((h[h.length - 1].v / h[0].v - 1) * 100).toFixed(2) + "% con i versamenti)");
    const d1 = T.pfSeries(P, "1G"), w1 = T.pfSeries(P, "1S"), ytd = T.pfSeries(P, "YTD");
    ok(d1.pts.length === 2 && w1.pts.length >= 5 && w1.pts.length <= 7 && ytd.from <= "2025-12-31" && ytd.pts[1].d >= "2026-01-01", "orizzonti: 1 giorno (2 punti), 1 settimana (" + w1.pts.length + "), da inizio anno dal " + ytd.from); }
  const vwra = P.positions[0];
  ok(vwra.sym === "VWRA" && vwra.type === "ETF" && Math.abs(vwra.value - 1500 * 145.2 * 0.7985) < 0.01 && vwra.pnl > 0, "posizione in USD convertita in CHF con il cambio del report");
  ok(/Collegato/.test(txt($("view"))) && /05\.11\.2026/.test(txt($("view"))), "configurazione: stato collegato con la data del report");
  /* Home e schermata */
  A.go("home"); await wait(1500);
  ok($("pfCard") && /378/.test(txt($("pfCard"))) && /in 1 mese/.test(txt($("pfCard"))), "home: riquadro portafoglio con valore e rendimento a 1 mese");
  $("pfCard").dispatch("click"); await wait(100);
  ok(A.view === "fire" && A.ui.fireTab === "portafoglio" && $("fireTabs") && $("pfPerf") && $("pfValue") && $("pfAlloc") && $("pfPos") && $("pfDiv") && $("pfFire"), "il riquadro della Home apre il portafoglio dentro la voce FIRE");
  ok(/Guadagno non realizzato/.test(txt($("pfValue"))) && /Dividendi/.test(txt($("pfValue"))) && /Liquidit/.test(txt($("pfValue"))), "numeri chiave: guadagno, liquidita', dividendi, posizioni");
  /* grafico Valore / Rendimento con gli orizzonti */
  ok(/Variazione del valore \(1A\)/.test(txt($("pfPerf"))) && $("pfPerf").querySelectorAll("polyline").length >= 1 && $("pfPerf").querySelectorAll("button.chip").length === 8, "grafico: valore a 1 anno, 8 orizzonti");
  btn($("pfPerf"), "Rendimento").click(); await wait(50);
  ok(A.ui.pfMode === "rend" && /Rendimento \(1A\)/.test(txt($("pfPerf"))) && /TWR/.test(txt($("pfPerf"))) && /[+−]\d/.test(txt($("pfPerf"))), "grafico: rendimento % ponderato nel tempo");
  for (const [k, l] of [["1G", "1G"], ["1S", "1S"], ["1M", "1M"], ["3M", "3M"], ["6M", "6M"], ["YTD", "Da inizio anno"], ["1A", "1A"], ["ALL", "Tutto"]]) {
    $("pfPerf").querySelectorAll("button.chip").find(b => txt(b) === l).click(); await wait(30);
    if (A.ui.pfHz !== k || !$("pfPerf").querySelectorAll("polyline").length) { ok(false, "orizzonte " + l); break; }
  }
  ok(A.ui.pfHz === "ALL" && /\(Tutto\)/.test(txt($("pfPerf"))), "grafico: tutti gli orizzonti, da 1G a Tutto");
  const read0 = txt($("pfPerf").querySelector("div.readout"));
  $("pfPerf").querySelector("rect.hit").dispatch("click", { clientX: 120 }); await wait(50);
  ok(txt($("pfPerf").querySelector("div.readout")) !== read0 && /dal/.test(txt($("pfPerf").querySelector("div.readout"))), "grafico: tocco legge un giorno con il rendimento dall'inizio del periodo");
  btn($("pfPerf"), "Valore").click(); await wait(50);
  btn($("fireTabs"), "Simulatore").click(); await wait(1500);
  ok($("probCard") && !$("pfPerf"), "voce FIRE: si torna al simulatore");
  btn($("fireTabs"), "Portafoglio").click(); await wait(100);
  ok($("pfPerf") && !$("probCard"), "voce FIRE: e di nuovo al portafoglio");
  ok($("pfAlloc").querySelectorAll("path").length >= 6 && /VWRA/.test(txt($("pfAlloc"))) && /Liquidit/.test(txt($("pfAlloc"))), "ripartizione per titolo con la liquidita'");
  btn($("pfAlloc"), "Per tipo").click(); await wait(80);
  ok(/ETF/.test(txt($("pfAlloc"))) && /Azioni/.test(txt($("pfAlloc"))) && A.ui.pfBy === "tipo", "ripartizione per tipo (ETF, azioni, liquidita')");
  btn($("pfAlloc"), "Per valuta").click(); await wait(80);
  ok(/USD/.test(txt($("pfAlloc"))) && /CHF/.test(txt($("pfAlloc"))), "ripartizione per valuta");
  $("pfAlloc").querySelectorAll("div.li.tap")[0].dispatch("click"); await wait(50);
  ok(!$("sheet").hidden && /posizioni|VWRA/.test(txt($("sheetBody"))), "tocco su un gruppo: dettaglio delle posizioni"); T.closeSheet();
  btn($("pfAlloc"), "Per titolo").click(); await wait(80);
  $("pfPos").querySelectorAll("div.li.tap")[3].dispatch("click"); await wait(50);
  ok(/ISIN/.test(txt($("sheetBody"))) && /Prezzo/.test(txt($("sheetBody"))) && /Costo di acquisto/.test(txt($("sheetBody"))), "tocco su una posizione: scheda con prezzo, costo e ISIN"); T.closeSheet();
  ok(/Ultimi 12 mesi/.test(txt($("pfDiv"))) && /MSFT/.test(txt($("pfDiv"))) && /CHSPI/.test(txt($("pfDiv"))), "dividendi netti per mese e per titolo");
  /* legame con il FIRE */
  const w0 = T.investableNow(A.S);
  ok(w0 === 450000 && /inserito a mano/.test(txt($("pfFire"))), "FIRE ancora sul valore a mano");
  btn($("pfFire"), "Collega al FIRE").click(); await wait(50);
  ok(/comprende gia'/.test(txt($("sheetBody"))), "collega: chiede se il valore comprende gia' Interactive Brokers");
  btn($("sheetBody"), "e' gia' compreso").click(); await wait(100);
  const F = A.S.fire;
  ok(F.ibkrLink && F.investableOther === Math.round(450000 - P.nav) && Math.abs(T.investableNow(A.S) - 450000) < 1, "gia' compreso: altri investimenti = " + F.investableOther + ", totale invariato");
  /* nuovo report con valore piu' alto: il FIRE si aggiorna da solo */
  const xml2 = XML.replace('positionValue="217800.00"', 'positionValue="227800.00"').replace(/(<OpenPosition[^>]*symbol="VWRA"[^>]*positionValue=")[\d.]+/, "$1227800.00");
  global.fetch = (f => async (url, opt) => /GetStatement/.test(String(url)) ? new Response(xml2, { status: 200 }) : f(url, opt))(global.fetch);
  A.S.portfolio.lastSync = null; await A.pfSync(true); await wait(50);
  const inc = T.investableNow(A.S) - 450000;
  ok(Math.abs(inc - 10000 * 0.7985) < 1 && F.investable === Math.round(T.investableNow(A.S)), "nuovo report: il patrimonio del FIRE sale da solo di " + Math.round(inc) + " CHF");
  const ctx2 = T.firePrepare(A.S);
  ok(Math.abs(ctx2.W0 - (T.investableNow(A.S) + (+F.cash || 0))) < 1, "la simulazione FIRE usa il valore aggiornato");
  A.ui.fireTab = "sim"; A.go("fire"); await wait(1500);
  ok(/Altri investimenti \(fuori da Interactive Brokers\)/.test(txt($("view"))) && /Piu' Interactive Brokers/.test(txt($("view"))), "schermata FIRE: altri investimenti piu' Interactive Brokers");
  /* aggiornamento automatico: non piu' di uno ogni 12 ore */
  const c0 = ibCalls; A.pfAutoSync(); await wait(100);
  ok(ibCalls === c0, "aggiornamento automatico limitato (12 ore)");
  A.S.portfolio.lastSync = new Date(Date.now() - 13 * 3600e3).toISOString(); A.S.portfolio.lastTry = null; A.pfAutoSync(); await wait(300);
  ok(ibCalls > c0, "aggiornamento automatico dopo 12 ore");
  /* token scaduto: messaggio chiaro, dati tenuti */
  ibMode = "expired"; A.S.portfolio.lastSync = null; await A.pfSync(false); await wait(50);
  ok(/scaduto/.test(A.S.portfolio.lastError) && /IBKR_TOKEN/.test(txt($("sheetBody"))) && T.pfHas(A.S), "token scaduto: spiegazione e dati precedenti tenuti"); T.closeSheet();
  /* promemoria della scadenza */
  A.S.portfolio.tokenUntil = T.addDays(T.today(), 10); A.go("home"); await wait(1500);
  ok(/Il token di Interactive Brokers scade tra 10 giorni/.test(txt($("view"))), "home: promemoria 14 giorni prima della scadenza del token");
  /* scollega e togli */
  ibMode = "ok"; A.openPf(); await wait(50);
  btn($("pfFire"), "Scollega dal FIRE").click(); await wait(50);
  ok(!A.S.fire.ibkrLink && Math.abs(A.S.fire.investable - Math.round(T.investableNow(A.S))) < 1, "scollegato: il FIRE tiene l'ultimo valore");
  A.go("altro", "ibkr"); await wait(50);
  btn($("view"), "Togli il portafoglio").click(); await wait(50); btn($("sheetBody"), "Togli").click(); await wait(100);
  ok(!A.S.portfolio && !T.pfHas(A.S), "portafoglio tolto");
  /* conto in USD senza cambio: avviso */
  A.S.portfolio = T.pfMerge(null, T.parseFlex(XML.replace(/currency="CHF"/g, 'currency="USD"'))); A.S.portfolio.lastSync = new Date().toISOString(); A.S.profile.fx = { EUR: 0.93 };
  A.go("portafoglio"); await wait(50);
  ok(/Manca il cambio USD/.test(txt($("view"))) && /USD/.test(txt($("pfValue"))), "conto in USD senza cambio: avviso e importi in USD");
  console.log("errori JS:", stub.errors.length); stub.errors.slice(0, 3).forEach(e => console.log(e));
  if (stub.errors.length) fails++;
  console.log(fails ? fails + " test falliti" : "Prova del portafoglio superata");
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log("ERRORE", e.stack); process.exit(1); });
