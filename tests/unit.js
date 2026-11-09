/* Test dei moduli di calcolo, senza interfaccia. Uso: node tests/unit.js */
"use strict";
const fs = require("fs"), path = require("path"), D = path.join(__dirname, "..", "src", "js");
for (const f of ["00-util", "03-dict", "03-i18n", "08-market", "01-store", "02-files", "04-importers", "05-categorize", "06-stats", "07-fire", "12-bank", "13-family", "15-ibkr", "09-demo"]) require(path.join(D, f + ".js"));
let fails = 0; const eq = (a, b, m) => { const ok = JSON.stringify(a) === JSON.stringify(b); console.log((ok ? "OK   " : "FAIL ") + m + (ok ? "" : " -> " + JSON.stringify(a) + " invece di " + JSON.stringify(b))); if (!ok) fails++; };
const fx = p => fs.readFileSync(path.join(__dirname, "fixtures", p), "utf8");
eq(["1 gen 2026", "31.12.2025", "2026-03-04 10:22:11", "Jan 5, 2026", "15 ott 2026"].map(s => T.parseDate(s)), ["2026-01-01", "2025-12-31", "2026-03-04", "2026-01-05", "2026-10-15"], "date in vari formati");
eq(["-41,45 CHF", "1.234,56\u20ac", "CHF 2'700.00", "-1,234.56", "(12.00)", "0,5"].map(T.parseAmount), [-41.45, 1234.56, 2700, -1234.56, -12, 0.5], "importi in vari formati");
eq(T.fixMojibake("Titolarit\u00c3\u00a0"), "Titolarit\u00e0", "correzione testo con doppia codifica");
/* Revolut CSV */
const rows = T.parseCsv(fx("revolut-esempio.csv"));
eq(T.isRevolutCsv(rows), true, "riconosce il CSV Revolut");
const rv = T.parseRevolutCsv(rows);
eq(rv.length, 7, "scarta i movimenti non completati");
const st = T.newState(); st.profile.fx = { EUR: 0.94 };
const r1 = T.mergeTxs(st, rv, "revolut");
eq([r1.added, T.mergeTxs(st, T.parseRevolutCsv(rows), "revolut").dup], [7, 7], "nessun doppione reimportando lo stesso file");
const by = d => st.txs.find(t => t.desc === d);
eq([by("Coop").cat, by("Pizzeria Bella").cat, by("To Robo portfolio").flow, by("Exchanged to EUR").flow, by("Top-Up by *1234").flow], ["alimentari", "ristoranti", "escluso", "escluso", "escluso"], "classificazione predefinita");
eq(st.txs.find(t => t.desc === "Zalando" && t.amt < 0).amt, -84.51, "conversione EUR con il cambio del profilo");
eq(st.txs.find(t => t.desc === "Zalando" && t.amt > 0).flow, "spesa", "rimborso conta come spesa negativa");
/* CSV generico */
const b = T.parseCsv(fx("banca-esempio.csv")), m = T.guessCsvMapping(b);
eq([m.headerRow, m.date, m.debit, m.credit], [3, 0, 3, 4], "CSV banca: colonne riconosciute");
const g = T.parseGenericCsv(b, m, "CHF");
eq(g.map(x => x.amtLoc), [-2150, 8600, -85.4], "CSV banca: addebiti e accrediti");
eq(g[0].desc, "Affitto \u00b7 Immobiliare Esempio SA", "CSV banca: descrizioni unite");
/* regole utente */
T.addUserRule(st, "Coop", "spesa", "casa"); T.reclassifyAll(st);
eq(by("Coop").cat, "casa", "regola utente");
/* pagamenti UBS dal testo */
const pays = T.parseUbsPayments(["Pagamenti registrati", "02.11.2026\tImmobiliare Esempio SA\tCH0000000000000000000\tCHF 2'150.00", "Completamente vistato CH10 3000", "pigione mensile"]);
eq([pays[0].amount, pays[0].payee, T.suggestFixed(pays[0]).name], [2150, "Immobiliare Esempio SA", "Affitto"], "PDF UBS: riga di pagamento");
/* demo, statistiche, FIRE */
const demo = T.makeDemoState(), pic = T.picture(demo);
eq(pic.now.fixed > 3000 && pic.plan.variable > 0 && pic.weeklyCap > 0, true, "quadro mensile e tetto settimanale");
const f = T.simulateFire(demo, { sims: 500 });
eq(f.prob.every((p, i) => i === 0 || p >= f.prob[i - 1] - 0.02), true, "probabilita' crescente con l'eta' di ritiro");
eq(f.fireAge != null && f.fireAge > f.age, true, "eta' FIRE trovata");
const bk = T.readBackup(JSON.parse(JSON.stringify(T.makeBackup(demo))));
eq(bk.txs.length, demo.txs.length, "backup e ripristino");
console.log(fails ? fails + " test falliti" : "Tutti i test passati");
process.exitCode = fails ? 1 : 0;
/* collegamento automatico: conversione, doppioni con l'estratto, movimenti in sospeso */
(async () => {
  const acc = { uid: "07cc67f4-45d6-494b-adac-09b5cbc7e2b5", currency: "CHF", name: "Conto" };
  const m = T.mapEbTx({ transaction_id: "x1", transaction_amount: { currency: "CHF", amount: "12.50" }, credit_debit_indicator: "DBIT", status: "BOOK", transaction_date: "2026-11-01", booking_date: "2026-11-02", creditor: { name: "Coop" }, merchant_category_code: "5411" }, acc);
  eq([m.d, m.desc, m.amtLoc, m.rcat, m.pending], ["2026-11-01", "Coop", -12.5, "Esercente", false], "collegamento: conversione di un movimento");
  const st2 = T.newState(); st2.profile.fx = { EUR: 0.94 };
  T.mergeTxs(st2, [{ d: "2026-10-30", desc: "Coop Pronto", rcat: "Esercente", amtLoc: -12.5, cur: "CHF", amt: -12.5 }], "revolut");
  st2.bank = Object.assign(T.bankDefaults(), { url: "https://p", token: "t", session: "s", accounts: [acc], validUntil: "2099-01-01T00:00:00Z" });
  let page = 0;
  global.fetch = async (url, o) => { const b = JSON.parse(o.body); page++;
    const tx = [{ transaction_id: "x1", transaction_amount: { currency: "CHF", amount: "12.50" }, credit_debit_indicator: "DBIT", status: "BOOK", transaction_date: "2026-11-01", creditor: { name: "Coop" } },
      { transaction_id: "x2", transaction_amount: { currency: "CHF", amount: "40.00" }, credit_debit_indicator: "DBIT", status: page > 2 ? "BOOK" : "PDNG", transaction_date: "2026-11-02", creditor: { name: "Ristorante Sole" } }];
    return { ok: true, status: 200, json: async () => b.continuation_key ? { transactions: [tx[1]] } : { transactions: [tx[0]], continuation_key: "k" } }; };
  const r1 = await T.bankSync(st2);
  eq([r1.added, r1.dup, r1.pending], [1, 1, 1], "collegamento: nessun doppione con l'estratto, movimento in sospeso");
  st2.txs.find(t => t.desc === "Ristorante Sole").note = "Cena compleanno";
  const r2 = await T.bankSync(st2);
  const rs = st2.txs.filter(t => t.desc === "Ristorante Sole");
  eq([r2.added, rs.length, rs[0].pending || false, rs[0].note], [0, 1, false, "Cena compleanno"], "collegamento: il movimento in sospeso diventa definitivo senza doppioni e conserva la nota");
  eq(T.bankErrorText(401, { error: "unauthorized" }).includes("APP_TOKEN"), true, "collegamento: messaggio d'errore comprensibile");
  console.log(fails ? fails + " test falliti" : "Tutti i test del collegamento passati");
  process.exitCode = fails ? 1 : 0;
})();
/* la tastiera del telefono (solo altezza) non deve ridisegnare la schermata */
/* report Flex di Interactive Brokers */
{ const xml = fs.readFileSync(path.join(__dirname, "fixtures", "flex-esempio.xml"), "utf8"), r = T.parseFlex(xml);
  eq(r.positions.length, 6, "Flex: posizioni lette");
  eq(r.base + " " + r.date + " " + Math.round(r.nav), "CHF 2026-11-05 378776", "Flex: valuta, data e valore");
  eq(T.round2(T.sum(r.divs.map(d => d.amt))), T.round2(41.5 * 0.7985 * 0.85 * 2 + 45.5 * 0.7985 * 0.85 * 2 + 312.8), "Flex: dividendi netti dopo le ritenute");
  eq(T.flexDate("20261105;061502") + " " + T.flexDate("2026-11-05") + " " + T.flexDate("11/05/2026"), "2026-11-05 2026-11-05 2026-11-05", "Flex: formati delle date");
  eq([T.flexDate("05/11/2026", "dmy"), T.flexDate("05/11/26", "dmy"), T.flexDate("05-Nov-26"), T.flexDate("Nov 5, 2026"), T.flexDate("13/11/2026"), T.flexDate("2026-13-11")], ["2026-11-05", "2026-11-05", "2026-11-05", "2026-11-05", null, null], "Flex: date europee, con il mese in lettere e date impossibili");
  /* lo stesso report con le date europee (giorno/mese/anno) deve dare lo stesso storico */
  const eu = xml.replace(/(Date|date|dateTime)="(\d{4})(\d{2})(\d{2})/g, (x, k, y, mo, d) => k + '="' + d + "/" + mo + "/" + y);
  eq(T.flexDateOrder(eu, "2026-11-06"), "dmy", "Flex: riconosce le date giorno/mese");
  const re = T.parseFlex(eu, "2026-11-06");
  eq([re.date, re.history.length, re.history[0].d, re.divs.length], [r.date, r.history.length, r.history[0].d, r.divs.length], "Flex: report con date europee letto come quello standard");
  const S1 = T.pfSeries(re, "1M"), S2 = T.pfSeries(r, "1M");
  eq([S1.pts.length > 15, S1.pts.length === S2.pts.length, S1.n === r.history.length], [true, true, true], "Flex: ogni orizzonte ha i suoi giorni anche con le date europee");
  /* storico salvato da una versione precedente (senza sigillo): non si unisce, vale solo il report */
  const bad = T.pfMerge({ history: [{ d: "2026-05-11", v: 1 }, { d: "2026-13-11", v: 2 }, { d: "2025-01-02", v: 3 }], divs: [{ key: "x", d: "2025-12-11", amt: 50 }] }, r);
  eq([bad.history.length, bad.history[0].d, bad.divs.length, T.pfTrusted(bad)], [r.history.length, r.history[0].d, r.divs.length, true], "Flex: dati senza sigillo scartati, il report li sostituisce");
  /* 1.9.1, il caso vero: report con date giorno/mese salvato dalla 1.8, che scambiava giorno e mese (grafico a denti di sega) */
  { const swap = d => { const [y, mo, dd] = d.split("-"); return +dd <= 12 ? y + "-" + dd + "-" + mo : y + "-" + mo + "-" + dd; };
    const old18 = { date: swap(re.date), nav: re.nav, positions: re.positions, history: re.history.map(x => ({ d: swap(x.d), v: x.v })).sort((a, b) => a.d < b.d ? -1 : 1),
      divs: re.divs.map(x => Object.assign({}, x, { d: swap(x.d), key: x.key + "18" })), flows: re.flows.map(x => Object.assign({}, x, { d: swap(x.d), key: x.key + "18" })), hasFlows: true, lastSync: "2026-11-09T08:00:00.000Z" };
    const jumps = P => { const s = T.pfSeries(P, "1A").pts; let n = 0; for (let i = 1; i < s.length; i++) if (Math.abs(s[i].v / s[i - 1].v - 1) > 0.08) n++; return n; };
    eq(jumps(old18) > 10, true, "1.8: con le date scambiate il grafico a 1 anno salta su e giu' (" + jumps(old18) + " salti oltre l'8%)");
    const st18 = T.newState(); st18.portfolio = JSON.parse(JSON.stringify(old18)); T.migrate(st18);
    const P0 = st18.portfolio;
    eq([P0.history.length, P0.divs.length, P0.flows.length, P0.lastSync, P0.positions.length, P0.nav, T.pfTrusted(P0)], [0, 0, 0, null, re.positions.length, re.nav, true], "1.9.1: all'avvio storico, dividendi e versamenti vecchi tolti, posizioni e valore restano");
    const P1 = T.pfMerge(P0, re);
    eq([P1.history.length, P1.history[0].d, P1.divs.length, P1.flows.length, jumps(P1)], [re.history.length, re.history[0].d, re.divs.length, re.flows.length, 0], "1.9.1: dopo il report lo storico e' giusto, senza salti e senza dividendi o versamenti doppi");
    /* famiglia: un telefono non ancora aggiornato unisce i dati vecchi a quelli nuovi; la copia unita non ha piu' il sigillo giusto */
    const mixed = Object.assign({}, P1, { history: P1.history.concat(old18.history.filter(x => x.d < P1.history[0].d)).sort((a, b) => a.d < b.d ? -1 : 1), divs: P1.divs.concat(old18.divs) });
    eq(T.pfTrusted(mixed), false, "famiglia: copia unita da una versione vecchia riconosciuta");
    const fm = T.pfMergeCopies(P1, mixed), fm2 = T.pfMergeCopies(mixed, P1);
    eq([fm.history.length, fm.divs.length, fm2.history.length, fm2.divs.length], [P1.history.length, P1.divs.length, P1.history.length, P1.divs.length], "famiglia: la copia vecchia non sporca quella buona");
    const bothOld = T.pfMergeCopies(old18, Object.assign({}, old18, { lastSync: "2026-11-08T08:00:00.000Z" }));
    eq([bothOld.history.length, bothOld.lastSync, T.pfTrusted(bothOld)], [0, null, true], "famiglia: due copie vecchie, storico da riscaricare");
    /* due copie buone: la piu' recente vale nel suo periodo, della vecchia resta cio' che viene prima */
    const olderOk = T.pfSeal(Object.assign({}, P1, { lastSync: "2026-11-01T08:00:00.000Z", history: [{ d: "2024-06-03", v: 100000 }].concat(P1.history.map(x => ({ d: x.d, v: x.v + 1 }))) }));
    const j = T.pfMergeCopies(olderOk, Object.assign({}, P1, { lastSync: "2026-11-09T08:00:00.000Z" }));
    eq([j.history.length, j.history[0].d, j.history[1].v === P1.history[0].v, j.divs.length, T.pfTrusted(j)], [P1.history.length + 1, "2024-06-03", true, P1.divs.length, true], "famiglia: due copie buone si uniscono senza doppioni");
  }
  eq(T.pfSeries({ history: [{ d: "2026-13-11", v: 5 }, { d: "2026-11-01", v: 10 }, { d: "2026-11-02", v: 11 }] }, "1S").pts.length, 2, "Flex: date impossibili ignorate nel grafico");
  let err = ""; try { T.parseFlex("<FlexStatementResponse><Status>Fail</Status><ErrorCode>1012</ErrorCode></FlexStatementResponse>"); } catch (e) { err = e.message; }
  eq(/scaduto/.test(err), true, "Flex: errore di token scaduto spiegato");
  const lots = xml.replace(/levelOfDetail="SUMMARY" \/>/, 'levelOfDetail="SUMMARY" />\n<OpenPosition symbol="VWRA" currency="USD" fxRateToBase="0.7985" position="10" markPrice="145.2" positionValue="1452" levelOfDetail="LOT" />');
  eq(T.parseFlex(lots).positions.length, 6, "Flex: con i lotti conta solo il riepilogo");
  const m = T.pfMerge(T.pfSeal({ history: [{ d: "2025-01-02", v: 1 }], divs: [{ key: "old", d: "2025-01-05", amt: 3 }] }), r);
  eq(m.history[0].d === "2025-01-02" && m.history.length === r.history.length + 1 && m.divs.length === r.divs.length + 1, true, "Flex: storico e dividendi si accumulano oltre l'anno");
  const Q = { history: [{ d: "2026-01-02", v: 100 }, { d: "2026-01-05", v: 110 }, { d: "2026-01-07", v: 210 }], flows: [{ d: "2026-01-06", amt: 100, key: "a" }], hasFlows: true };
  eq(T.round2(T.pfSeries(Q, "ALL").ret * 100), 10, "rendimento ponderato nel tempo: un versamento non e' un guadagno");
  eq(T.round2(T.pfSeries(Object.assign({}, Q, { hasFlows: false }), "ALL").ret * 100), 110, "senza versamenti noti: variazione del valore");
  eq(T.pfFrom(Q, "1G") + " " + T.pfFrom(Q, "YTD") + " " + T.pfFrom(Q, "ALL"), "2026-01-05 2025-12-31 2026-01-02", "orizzonti: 1 giorno, da inizio anno, tutto");
  const st = T.makeDemoState(); st.fire.investable = 200000; st.fire.ibkrLink = true; st.fire.investableOther = 50000;
  eq(Math.round(T.investableNow(st)), Math.round(50000 + st.portfolio.nav), "FIRE: patrimonio = altri investimenti + portafoglio");
}
{ const src = fs.readFileSync(path.join(D, "30-main.js"), "utf8");
  eq(/if \(w === lastW\) return;/.test(src) && /INPUT\|TEXTAREA\|SELECT/.test(src), true, "la tastiera non chiude i campi di testo"); }
