/* Test di fumo: esegue l'app costruita in Node, attraversa tutte le schermate e i flussi principali.
   Uso: node tests/smoke.js app/index.html [estratto-revolut.xlsx] [pagamenti-ubs.pdf] */
"use strict";
const fs = require("fs"), path = require("path");
const stub = require("./dom-stub.js");
const [, , htmlPath, revPath, ubsPath] = process.argv;
const html = fs.readFileSync(htmlPath, "utf8");
const js = html.split("<script>")[1].split("</script>")[0];
global.document = stub.document; global.window = global; global.location = { protocol: "file:", hostname: "" };
global.history = { length: 1, pushState() { }, replaceState() { }, back() { } };
global.scrollTo = () => { }; global.addEventListener = () => { };
Object.defineProperty(global, "navigator", { value: { storage: {}, languages: ["it-CH", "it"] }, configurable: true });
global.URL.createObjectURL = () => "blob:x"; global.URL.revokeObjectURL = () => { };
const store = {}; global.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
stub.buildShell(html);
let downloads = [];
const origCreate = stub.document.createElement;
stub.document.createElement = t => { const e = origCreate(t); if (t === "a") e.click = () => downloads.push(e.download); return e; };
let nextFile = null; global.__filePicked = inp => { const f = nextFile; nextFile = null; inp.files = f ? [{ name: f.name, arrayBuffer: async () => f.buf }] : []; inp.dispatch("change"); };
const wait = ms => new Promise(r => setTimeout(r, ms || 60));
const $ = id => stub.document.getElementById(id);
const txt = el => el.textContent.replace(/\s+/g, " ").trim();
const btn = (root, label) => root.querySelectorAll("button").find(b => txt(b).includes(label));
const tap = async (root, label) => { const b = btn(root, label); if (!b) throw new Error("bottone non trovato: " + label + " in " + txt(root).slice(0, 200)); b.click(); await wait(); };
const tapLi = async (root, label) => { const it = root.querySelectorAll("div.li.tap").find(x => txt(x).startsWith(label)); if (!it) throw new Error("voce non trovata: " + label); it.dispatch("click"); await wait(); };
const tab = async t => { $("tabs").children.find(b => b.dataset.tab === t).click(); await wait(400); };
const fileBuf = p => { const b = fs.readFileSync(p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.length); };
const check = (cond, msg) => { console.log((cond ? "OK   " : "FAIL ") + msg); if (!cond) process.exitCode = 1; };

(async () => {
  eval(js);
  await wait(200);
  check(txt($("view")).includes("Benvenuto"), "primo avvio: schermata di benvenuto");
  /* configurazione guidata */
  await tap($("view"), "Configura");
  const inc = $("view").querySelectorAll("input").find(i => i.attributes["aria-label"] && i.attributes["aria-label"].startsWith("Reddito"));
  inc.value = "9000"; inc.dispatch("input");
  await tap($("view"), "Avanti");
  const rent = $("view").querySelectorAll("input")[0]; rent.value = "2000"; rent.dispatch("input");
  await tap($("view"), "Avanti");
  const by = $("view").querySelectorAll("input")[0]; by.value = "1988"; by.dispatch("input");
  const inv = $("view").querySelectorAll("input")[1]; inv.value = "150000"; inv.dispatch("input");
  await tap($("view"), "Avanti");
  check(txt($("view")).includes("Primo estratto"), "configurazione: passo import");
  await tap($("view"), "Lo faccio dopo");
  await wait(300);
  check(T.A.S.profile.onboarded && T.A.S.profile.incomeMonthly === 9000 && T.A.S.fixed[0].amount === 2000 && T.A.S.fire.birthYear === 1988, "configurazione salvata nello stato");
  check(txt($("view")).includes("Importa un estratto conto"), "home vuota invita a importare");
  /* dati di esempio */
  await tab("altro");
  await tapLi($("view"), "Prova con dati di esempio"); await wait(); if (!$("sheet").hidden) await tap($("sheetBody"), "Carica"); await wait(600);
  check(T.A.S.profile.demo && T.A.S.txs.length > 200, "dati di esempio caricati: " + T.A.S.txs.length + " movimenti");
  await wait(800);
  for (const t of ["home", "spese", "budget", "fire", "altro"]) { await tab(t); await wait(900); check(txt($("view")).length > 100, "schermata " + t + " disegnata (" + txt($("view")).length + " caratteri)"); }
  await tab("home"); await wait(900);
  { const v = txt($("view"));
    check(/dove dovresti essere oggi, giorno \d+ su \d+: [\d'’.,]+ CHF \([\d'’.,]+ CHF (di troppo|ancora disponibili)\)/.test(v), "home: tacca del mese con cifra di oggi e differenza");
    check(/Budget settimanale/.test(v) && /giorno per giorno/i.test(v) && /del numero FIRE/.test(v) && !/Ultime 8 settimane/.test(v), "home: settimana, giorno per giorno e FIRE"); }
  { const hits = $("dayCard").querySelectorAll("rect.hit");
    check(hits.length >= 1, "home: giorni toccabili (" + hits.length + ")");
    hits[hits.length - 1].dispatch("click"); await wait();
    const sb = txt($("sheetBody"));
    check(!$("sheet").hidden && /Movimenti/.test(sb) && /tetto di/.test(sb), "home: pannello del giorno (" + sb.slice(0, 60) + ")");
    const row = $("sheetBody").querySelectorAll("div.li.tap")[0];
    if (row) { row.dispatch("click"); await wait(); check(txt($("sheetBody")).includes("Modifica movimento"), "home: dal giorno si modifica un movimento"); }
    T.closeSheet(); }
  $("fireCard").dispatch("click"); await wait(900);
  check(T.A.view === "fire" && /Probabilita' di riuscita/.test(txt($("view"))), "home: la scheda FIRE apre il simulatore");
  { const v = txt($("view")), F = T.A.S.fire;
    check(/Quando smetto di lavorare/.test(v) && /Prima eta' con almeno il 90%/.test(v) && /Arrivo mediano/.test(v) && /Spesa media in pensione/.test(v) && /Capitale residuo/.test(v), "fire: cursore, indicatore e 4 riquadri");
    const sl = $("retireAge"), a = +sl.attributes.min + 3;
    sl.value = String(a); sl.dispatch("input"); sl.dispatch("change"); await wait(300);
    check(F.retireAge === a && txt($("view")).includes("Ritiro a " + a + " anni") && txt($("retireCard")).includes("Torna all'eta' stimata"), "fire: il cursore cambia l'eta' (" + a + ")");
    await tap($("retireCard"), "Torna all'eta' stimata"); await wait(300);
    check(F.retireAge == null && /E' l'eta' stimata/.test(txt($("retireCard"))), "fire: ritorno all'eta' stimata");
    $("probCard").querySelector("rect.hit").dispatch("click", { clientX: 250 }); await wait(300);
    check(F.retireAge != null && +$("retireAge").value === F.retireAge, "fire: tocco sul grafico della probabilita' sposta il cursore (" + F.retireAge + ")");
    const before = txt($("fanCard").querySelector("div.readout"));
    $("fanCard").querySelector("rect.hit").dispatch("click", { clientX: 340 }); await wait(100);
    check(txt($("fanCard").querySelector("div.readout")) !== before && /mediana/.test(txt($("fanCard"))), "fire: tocco sul grafico del patrimonio mostra i valori");
    F.retireAge = null; T.A.save(); }
  await tab("spese"); await wait(300);
  { const v = txt($("view"));
    check(!/Ultime 8 settimane/.test(v) && !/Giorni della settimana/.test(v) && /Da inizio anno/.test(v) && /Mese per mese|Settimana per settimana/.test(v), "spese: periodo in testa, senza 8 settimane e giorni della settimana");
    await tap($("periodCard"), "Mese precedente"); await wait(200);
    const p = T.A.period();
    check(p.key === "prec" && p.from.endsWith("-01") && /Giorno per giorno/.test(txt($("trendCard"))) && $("trendCard").querySelectorAll("rect.hit").length >= 28, "spese: mese precedente, grafico giorno per giorno");
    await tap($("periodCard"), "Personalizzato"); await wait(100);
    let di = $("periodCard").querySelectorAll("input").filter(i => i.attributes.type === "date"); di[0].value = "2026-08-01"; di[0].dispatch("change"); await wait(100);
    di = $("periodCard").querySelectorAll("input").filter(i => i.attributes.type === "date"); di[1].value = "2026-09-30"; di[1].dispatch("change"); await wait(100);
    check(T.A.period().from === "2026-08-01" && T.A.period().to === "2026-09-30" && /Settimana per settimana/.test(txt($("trendCard"))), "spese: periodo personalizzato, grafico settimana per settimana");
    await tap($("periodCard"), "Da inizio anno"); await wait(100);
    check(/Mese per mese/.test(txt($("trendCard"))) && T.A.period().from.endsWith("-01-01"), "spese: da inizio anno, grafico mese per mese");
    const tot0 = txt($("view").querySelector("div.kpis"));
    await tap($("periodCard"), "Con i costi fissi"); await wait(100);
    check(T.A.S.fixed.length > 0 && /di cui/.test(txt($("view").querySelector("div.kpis"))) && txt($("view").querySelector("div.kpis")) !== tot0 && /Costi fissi/.test(txt($("catCard"))), "spese: interruttore costi fissi (totale, ciambella, elenco)");
    $("catCard").querySelectorAll("div.li.tap").find(x => /^Costi fissi/.test(txt(x))).dispatch("click"); await wait(80);
    check(!$("sheet").hidden && /distribuiti giorno per giorno/.test(txt($("sheetBody"))), "spese: dettaglio dei costi fissi"); T.closeSheet();
    await tap($("periodCard"), "Solo spese variabili"); await wait(100);
    const crow = $("catCard").querySelectorAll("div.li.tap")[0], cname = txt(crow.querySelector("span.t"));
    crow.dispatch("click"); await wait(80);
    check(!$("sheet").hidden && txt($("sheetBody").querySelector("h3")) === cname && /Movimenti/.test(txt($("sheetBody"))) && T.A.view === "spese", "spese: tocco su una categoria apre il dettaglio (" + cname + ")"); T.closeSheet();
    const slice = $("catCard").querySelector("path"); slice.dispatch("click"); await wait(80);
    check(!$("sheet").hidden, "spese: tocco sulla ciambella apre il dettaglio"); T.closeSheet();
    const bars = $("trendCard").querySelectorAll("rect.hit"); bars[bars.length - 2].dispatch("click"); await wait(80);
    check(/Per categoria/.test(txt($("sheetBody"))), "spese: tocco su una colonna apre il dettaglio del mese");
    $("sheetBody").querySelectorAll("div.li.tap")[0].dispatch("click"); await wait(80);
    check(!!$("sheetBody").querySelectorAll("button").find(b => txt(b) === "Indietro"), "spese: dal mese alla categoria");
    await tap($("sheetBody"), "Indietro");
    check(/Per categoria/.test(txt($("sheetBody"))), "spese: indietro al mese"); T.closeSheet(); }
  /* spese: modifica movimento con regola */
  { const q = $("view").querySelectorAll("input").find(i => i.attributes.type === "search"); q.value = "Coop"; q.dispatch("change"); await wait(100); }
  const li = $("view").querySelectorAll("div.li.tap").find(x => /^Coop\d{2}\.\d{2}\.\d{4}/.test(txt(x)));
  li.dispatch("click"); await wait();
  check(!$("sheet").hidden && txt($("sheetBody")).includes("Modifica movimento"), "spese: apre la modifica del movimento");
  const sel = $("sheetBody").querySelector("select"); sel.value = "casa"; sel.dispatch("change");
  await tap($("sheetBody"), "Salva"); await wait(200);
  check(T.A.S.rules.some(r => r.m === "coop" && r.cat === "casa") && T.A.S.txs.filter(t => t.desc === "Coop").every(t => t.cat === "casa"), "spese: regola utente applicata a tutti i Coop");
  /* budget: preset e cursore */
  await tab("budget"); await wait(900);
  await tap($("view"), "Ambizioso"); await wait(300);
  const tot1 = T.sum(T.A.S.categories.map(c => c.budget));
  const r0 = $("view").querySelectorAll("input").find(i => i.attributes.type === "range"); r0.value = "0"; r0.dispatch("input"); r0.dispatch("change"); await wait(900);
  check(T.A.S.budget.preset === "custom" && T.sum(T.A.S.categories.map(c => c.budget)) < tot1, "budget: preset e cursori");
  check(/Eta' FIRE stimata/.test(txt($("view"))), "budget: effetto sul FIRE calcolato");
  /* fire: cambio parametro */
  await tab("fire"); await wait(1200);
  check(/Numero FIRE/.test(txt($("view"))), "fire: risultati");
  const eqf = $("view").querySelectorAll("input").find(i => (i.attributes["aria-label"] || "").startsWith("Quota in azioni")); eqf.value = "60"; eqf.dispatch("input"); await wait(1500);
  check(Math.abs(T.A.S.fire.equityShare - 0.6) < 1e-9, "fire: parametro aggiornato");
  await tap($("view"), "Aggiungi un capitale"); await wait();
  check(T.A.S.fire.lumps.length === 1, "fire: aggiunta capitale futuro");
  /* altro: sottoschermate */
  await tab("altro");
  for (const s of ["Profilo e reddito", "Costi fissi", "Categorie", "Regole degli esercenti", "Periodi di vacanza", "Storico import", "Backup", "Privacy e informazioni"]) {
    const it = $("view").querySelectorAll("div.li.tap").find(x => txt(x).startsWith(s)); it.dispatch("click"); await wait(100);
    check(txt($("view")).length > 25, "altro: " + s); T.A.go("altro"); await wait(50);
  }
  /* backup e ripristino */
  T.A.exportBackup(); await wait();
  check(downloads.some(d => /^myfinances-backup-/.test(d)), "backup scaricato");
  const bk = JSON.stringify(T.makeBackup(T.A.S));
  nextFile = { name: "b.json", buf: new TextEncoder().encode(bk).buffer };
  T.A.go("altro", "backup"); await wait(); await tap($("view"), "Ripristina da file"); await wait(200); await tap($("sheetBody"), "Ripristina"); await wait(400);
  check(T.A.S.txs.length > 200 && T.A.S.profile.onboarded, "ripristino del backup");
  /* import reali (facoltativi) */
  if (revPath) {
    await tab("altro"); await tapLi($("view"), "Ricomincia da zero"); await tap($("sheetBody"), "Ricomincia"); await wait(); await tap($("sheetBody"), "cancella tutto"); await wait(300);
    check(!T.A.S.profile.onboarded && T.A.S.txs.length === 0, "ricomincia da zero: dati cancellati");
    T.A.S.profile.onboarded = true; T.A.render();
    nextFile = { name: path.basename(revPath), buf: fileBuf(revPath) };
    $("btnImport").dispatch("click"); await wait(1500);
    check(txt($("sheetBody")).includes("Importa da Revolut"), "import Revolut: anteprima");
    await tap($("sheetBody"), "Importa"); await wait(400);
    check(T.A.S.txs.length > 1000, "import Revolut: " + T.A.S.txs.length + " movimenti");
    nextFile = { name: path.basename(revPath), buf: fileBuf(revPath) }; $("btnImport").dispatch("click"); await wait(1500);
    check(txt($("sheetBody")).includes("Niente di nuovo"), "import Revolut ripetuto: nessun doppione");
    T.closeSheet();
  }
  if (ubsPath) {
    nextFile = { name: path.basename(ubsPath), buf: fileBuf(ubsPath) }; $("btnImport").dispatch("click"); await wait(1500);
    check(txt($("sheetBody")).includes("Pagamenti registrati UBS"), "import PDF UBS: elenco pagamenti");
    await tap($("sheetBody"), "Aggiorna i costi fissi"); await wait(200);
    check(T.A.S.fixed.some(f => f.payee && /hanspeter/i.test(f.payee)), "import PDF UBS: costi fissi creati (" + T.A.S.fixed.length + " voci)");
  }
  /* CSV generico */
  const csv = "Data;Descrizione;Addebito;Accredito;Valuta\n01.10.2026;Migros Lugano;45,20;;CHF\n02.10.2026;Stipendio;;9000,00;CHF\n03.10.2026;Farmacia Centrale;12,50;;CHF\n";
  nextFile = { name: "conto.csv", buf: new TextEncoder().encode(csv).buffer }; $("btnImport").dispatch("click"); await wait(400);
  check(txt($("sheetBody")).includes("3 movimenti riconosciuti"), "CSV generico: colonne riconosciute");
  await tap($("sheetBody"), "Continua"); await wait(300); await tap($("sheetBody"), "Importa"); await wait(300);
  check(T.A.S.txs.some(t => t.desc === "Stipendio" && t.flow === "entrata") && T.A.S.txs.some(t => t.desc === "Migros Lugano" && t.cat === "alimentari"), "CSV generico: entrate e categorie");
  for (const t of ["home", "spese", "budget", "fire"]) { await tab(t); await wait(900); }
  console.log("elementi creati:", stub.all().length, "| errori JS:", stub.errors.length);
  stub.errors.slice(0, 5).forEach(e => console.log(e));
  if (stub.errors.length) process.exitCode = 1;
})().catch(e => { console.log("ERRORE", e.stack); process.exitCode = 1; });
