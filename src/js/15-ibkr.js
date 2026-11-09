/* myFinances on FIRE · Interactive Brokers: lettura del report Flex (sola lettura) e portafoglio
   Il ponte scarica il report con il token che resta su Cloudflare; qui si legge l'XML e si tiene una sintesi. */
"use strict";
(function () {
/* lettura semplice dell'XML Flex: elementi con attributi, senza librerie */
const ENT = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'" };
const unesc = s => String(s).replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : +e.slice(1)) : (ENT[e] != null ? ENT[e] : m));
const attrs = s => { const o = {}; s.replace(/([\w:.-]+)\s*=\s*"([^"]*)"/g, (m, k, v) => { o[k] = unesc(v); return m; }); return o; };
const tags = (xml, name) => { const out = [], re = new RegExp("<" + name + "\\b([^>]*?)\\/?>", "g"); let m; while ((m = re.exec(xml))) out.push(attrs(m[1])); return out; };
const num = v => { const x = parseFloat(String(v == null ? "" : v).replace(/,/g, "")); return isFinite(x) ? x : 0; };
/* date Flex: 20261105, 2026-11-05, 20261105;061502, 11/05/2026 */
T.flexDate = v => {
  const s = String(v || "").trim(); let m;
  if ((m = s.match(/^(\d{4})-?(\d{2})-?(\d{2})/))) return m[1] + "-" + m[2] + "-" + m[3];
  if ((m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/))) return m[3] + "-" + m[1] + "-" + m[2];
  return null;
};
T.flexXmlTags = tags;

/* tipo di strumento, per la ripartizione */
T.PF_TYPES = { ETF: "ETF", STK: "Azioni", FUND: "Fondi", BOND: "Obbligazioni", OPT: "Opzioni", FUT: "Futures", CRYPTO: "Cripto", CASH: "Liquidita'", CMDTY: "Materie prime", WAR: "Warrant", OTHER: "Altro~tipo" };
const typeOf = p => /ETF/i.test(p.subCategory || "") ? "ETF" : T.PF_TYPES[p.assetCategory] ? p.assetCategory : "OTHER";

/* XML Flex -> sintesi del portafoglio (importi nella valuta base del conto) */
T.parseFlex = xml => {
  xml = String(xml || "");
  if (!/<FlexQueryResponse[\s>]/.test(xml)) {
    const code = (xml.match(/<ErrorCode>(\d+)<\/ErrorCode>/) || [])[1];
    throw new Error(code ? T.ibkrErrorText(code) : T.tr("Il report di Interactive Brokers non e' leggibile."));
  }
  const stmts = [], re = /<FlexStatement\b([^>]*)>([\s\S]*?)<\/FlexStatement>/g; let m;
  while ((m = re.exec(xml))) stmts.push({ a: attrs(m[1]), body: m[2] });
  if (!stmts.length) throw new Error(T.tr("Il report di Interactive Brokers e' vuoto: controlla le sezioni della Flex Query."));
  /* piu' conti o piu' giorni: per le posizioni conta l'ultimo estratto di ogni conto */
  const lastByAcc = {};
  for (const s of stmts) { const acc = s.a.accountId || "?", to = T.flexDate(s.a.toDate) || ""; if (!lastByAcc[acc] || to >= lastByAcc[acc].to) lastByAcc[acc] = { s, to }; }
  const accounts = Object.keys(lastByAcc);
  let base = "", date = "", cash = 0;
  const positions = [], hist = {}, divs = [], flows = [], seenDiv = new Set();
  for (const acc of accounts) {
    const body = lastByAcc[acc].s.body, info = tags(body, "AccountInformation")[0] || {};
    base = base || info.currency || "";
    date = lastByAcc[acc].to > date ? lastByAcc[acc].to : date;
    let ps = tags(body, "OpenPosition");
    if (ps.some(p => p.levelOfDetail)) ps = ps.filter(p => !p.levelOfDetail || /SUMMARY/i.test(p.levelOfDetail));
    for (const p of ps) {
      const fx = num(p.fxRateToBase) || 1;
      const valueLoc = num(p.positionValue) || num(p.position) * num(p.markPrice) * (num(p.multiplier) || 1);
      positions.push({ acc, sym: p.symbol || p.isin || "?", desc: p.description || p.symbol || "", type: typeOf(p), cur: p.currency || base, qty: num(p.position), price: num(p.markPrice),
        valueLoc, value: valueLoc * fx, cost: num(p.costBasisMoney) * fx, pnl: num(p.fifoPnlUnrealized) * fx, isin: p.isin || "", exch: p.listingExchange || "", fx });
      if (!base && p.fxRateToBase && num(p.fxRateToBase) === 1) base = p.currency;
    }
    const cr = tags(body, "CashReportCurrency"), bs = cr.find(c => c.currency === "BASE_SUMMARY");
    cash += bs ? num(bs.endingCash) : 0;
  }
  /* valore nel tempo (tutti gli estratti, sommando i conti nello stesso giorno) */
  for (const s of stmts) for (const e of tags(s.body, "EquitySummaryByReportDateInBase")) {
    const d = T.flexDate(e.reportDate); if (!d) continue;
    const k = (s.a.accountId || "?") + "|" + d; hist[k] = { d, v: num(e.total) };
    if (!base && e.currency) base = e.currency;
  }
  const byDay = {}; for (const k in hist) byDay[hist[k].d] = (byDay[hist[k].d] || 0) + hist[k].v;
  /* dividendi netti: dividendi, sostitutivi e ritenute alla fonte */
  for (const s of stmts) for (const c of tags(s.body, "CashTransaction")) {
    const d = T.flexDate(c.dateTime || c.settleDate || c.reportDate); if (!d) continue;
    /* versamenti e prelievi: servono per il rendimento ponderato nel tempo */
    if (/deposit|withdraw/i.test(c.type || "")) {
      const amt = num(c.amount) * (num(c.fxRateToBase) || 1), key = [s.a.accountId, d, c.type, c.amount, c.transactionID || "", c.description || ""].join("|");
      if (!seenDiv.has(key)) { seenDiv.add(key); flows.push({ d, amt, key: T.hash(key) }); }
      continue;
    }
    if (!/dividend|withholding|in lieu/i.test(c.type || "")) continue;
    const amt = num(c.amount) * (num(c.fxRateToBase) || 1), key = [s.a.accountId, d, c.symbol, c.type, c.amount, c.transactionID || ""].join("|");
    if (seenDiv.has(key)) continue; seenDiv.add(key);
    divs.push({ d, sym: c.symbol || "", amt, tax: /withholding/i.test(c.type || ""), key: T.hash(key) });
  }
  const invested = T.sum(positions.map(p => p.value));
  if (!date) date = Object.keys(byDay).sort().pop() || "";
  const history = Object.keys(byDay).sort().map(d => ({ d, v: T.round2(byDay[d]) }));
  /* il valore piu' recente: posizioni + liquidita' (se c'e' il riepilogo del giorno usa quello) */
  const navNow = positions.length || cash ? invested + cash : (history.length ? history[history.length - 1].v : 0);
  if (!history.length || history[history.length - 1].d < date) history.push({ d: date, v: T.round2(navNow) });
  /* se il report contiene versamenti o prelievi, la sezione Deposits & Withdrawals e' attiva: il rendimento li toglie */
  const hasFlows = flows.length > 0;
  return { base: base || "CHF", accounts: accounts.map(a => a === "?" ? "" : a), date, positions: positions.sort((a, b) => b.value - a.value), cash: T.round2(cash), invested: T.round2(invested), nav: T.round2(navNow), history, divs, flows, hasFlows };
};

/* errori di Interactive Brokers in parole semplici */
T.ibkrErrorText = (code, msg) => {
  code = String(code || "");
  if (code === "1012") return T.tr("Il token di Interactive Brokers e' scaduto: generane uno nuovo (Flex Web Service) e aggiornalo nel ponte come IBKR_TOKEN.");
  if (code === "1015") return T.tr("Il token di Interactive Brokers non e' valido: ricopialo nel ponte come IBKR_TOKEN.");
  if (code === "1014") return T.tr("Il numero della Flex Query non e' valido: controlla IBKR_QUERY_ID nel ponte (deve essere una Activity Flex Query).");
  if (code === "1013") return T.tr("Il token e' limitato a un indirizzo IP: generane uno nuovo lasciando vuoto il campo IP.");
  if (code === "1011") return T.tr("Il Flex Web Service non e' attivo: attivalo in Interactive Brokers (Flex Web Service Configuration).");
  if (code === "1018" || code === "1025") return T.tr("Troppe richieste a Interactive Brokers: riprova tra qualche minuto.");
  if (code === "1010") return T.tr("Questa Flex Query e' di tipo vecchio: creane una nuova come Activity Flex Query.");
  if (["1001", "1003", "1004", "1005", "1006", "1007", "1008", "1009", "1019", "1021"].includes(code)) return T.tr("Interactive Brokers sta ancora preparando il report: riprova tra qualche minuto.");
  return T.tr("Errore di Interactive Brokers") + (code ? " " + code : "") + (msg ? ": " + String(msg).slice(0, 120) : ".");
};

/* stato del portafoglio */
T.pfDefaults = () => ({ lastSync: null, lastError: null, auto: true, base: "", accounts: [], date: null, nav: 0, cash: 0, invested: 0, positions: [], history: [], divs: [], flows: [], hasFlows: false, tokenUntil: null });
T.pfHas = st => !!(st.portfolio && st.portfolio.date);
/* cambio dalla valuta del conto alla valuta dell'app (null se manca) */
T.pfRate = st => { const P = st.portfolio || {}, cur = (st.profile && st.profile.currency) || "CHF"; if (!P.base || P.base === cur) return 1; const r = st.profile.fx && +st.profile.fx[P.base]; return r > 0 ? r : null; };
T.pfToApp = (st, v) => v * (T.pfRate(st) || 1);
T.pfNavApp = st => T.pfHas(st) ? T.pfToApp(st, st.portfolio.nav) : 0;

/* unisce il report nuovo a quello salvato: storico e dividendi si accumulano oltre l'anno del report */
T.pfMerge = (old, rep) => {
  const P = Object.assign(T.pfDefaults(), old || {});
  const h = {}; for (const x of P.history || []) h[x.d] = x.v; for (const x of rep.history) h[x.d] = x.v;
  const dv = {}; for (const x of P.divs || []) dv[x.key] = x; for (const x of rep.divs) dv[x.key] = x;
  const fl = {}; for (const x of P.flows || []) fl[x.key] = x; for (const x of rep.flows || []) fl[x.key] = x;
  Object.assign(P, { base: rep.base, accounts: rep.accounts, date: rep.date, nav: rep.nav, cash: rep.cash, invested: rep.invested, positions: rep.positions,
    history: Object.keys(h).sort().map(d => ({ d, v: h[d] })), divs: Object.values(dv).sort((a, b) => a.d < b.d ? -1 : 1),
    flows: Object.values(fl).sort((a, b) => a.d < b.d ? -1 : 1), hasFlows: !!(P.hasFlows || rep.hasFlows) });
  return P;
};

/* scarica dal ponte, legge e salva; aggiorna il patrimonio del FIRE se collegato */
T.ibkrSync = async st => {
  if (!st.bank || !st.bank.url || !st.bank.token) throw new Error(T.tr("Il ponte non e' configurato: inseriscilo prima in Collegamento automatico."));
  let d;
  try { d = await T.bankCall(st, "/ibkr", {}); }
  catch (e) {
    const x = e.data || {};
    if (x.error === "ibkr_not_configured") throw new Error(T.tr("Nel ponte mancano IBKR_TOKEN e IBKR_QUERY_ID (vedi la guida)."));
    if (x.error === "ibkr_error") throw new Error(T.ibkrErrorText(x.code, x.message));
    if (x.error === "ibkr_pending") throw new Error(T.ibkrErrorText("1019"));
    if (x.error === "not_found") throw new Error(T.tr("Il ponte e' di una versione precedente: in Cloudflare incolla il nuovo ponte/worker.js (versione 1.2.0) e premi Deploy."));
    throw e;
  }
  const rep = T.parseFlex(d && d.xml);
  st.portfolio = T.pfMerge(st.portfolio, rep);
  st.portfolio.lastSync = new Date().toISOString(); st.portfolio.lastError = null;
  T.pfSyncFire(st);
  return rep;
};
/* patrimonio investito del FIRE = altri investimenti + Interactive Brokers (se collegato) */
T.investableNow = st => {
  const F = st.fire || {};
  return F.ibkrLink && T.pfHas(st) ? (+F.investableOther || 0) + T.pfNavApp(st) : +F.investable || 0;
};
T.pfSyncFire = st => { if (st.fire && st.fire.ibkrLink && T.pfHas(st)) st.fire.investable = Math.round(T.investableNow(st)); };

/* raggruppamenti per la ripartizione */
T.pfGroups = (st, by) => {
  const P = st.portfolio, g = {};
  for (const p of P.positions) { const k = by === "tipo" ? p.type : by === "valuta" ? p.cur : p.sym; (g[k] = g[k] || { k, v: 0, items: [] }).v += p.value; g[k].items.push(p); }
  if (P.cash > 0) { const k = by === "tipo" ? "CASH" : by === "valuta" ? P.base : "__cash"; (g[k] = g[k] || { k, v: 0, items: [] }).v += P.cash; g[k].cash = true; }
  return Object.values(g).sort((a, b) => b.v - a.v);
};
/* orizzonti del grafico: data da cui si misura (la chiusura precedente all'inizio del periodo) */
T.PF_HORIZONS = [["1G", "1G~orizzonte"], ["1S", "1S~orizzonte"], ["1M", "1M~orizzonte"], ["3M", "3M~orizzonte"], ["6M", "6M~orizzonte"], ["YTD", "Da inizio anno~orizzonte"], ["1A", "1A~orizzonte"], ["ALL", "Tutto~orizzonte"]];
T.pfFrom = (P, hz) => {
  const h = P.history || [], last = h.length ? h[h.length - 1].d : T.today();
  const back = (m, y) => { const d = T.parseIso(last); if (y) d.setFullYear(d.getFullYear() - y); if (m) d.setMonth(d.getMonth() - m); return T.iso(d); };
  switch (hz) {
    case "1G": return h.length > 1 ? h[h.length - 2].d : last;
    case "1S": return T.addDays(last, -7);
    case "1M": return back(1); case "3M": return back(3); case "6M": return back(6);
    case "YTD": return (+last.slice(0, 4) - 1) + "-12-31";
    case "1A": return back(0, 1);
    default: return h.length ? h[0].d : last;
  }
};
/* serie del periodo: valore e rendimento ponderato nel tempo (versamenti e prelievi tolti giorno per giorno) */
T.pfSeries = (P, hz) => {
  const h = P.history || []; if (!h.length) return { pts: [], twr: false };
  const from = T.pfFrom(P, hz);
  let i0 = 0; for (let i = 0; i < h.length; i++) { if (h[i].d <= from) i0 = i; else break; }
  const flows = (P.flows || []), twr = !!P.hasFlows;
  const pts = [{ d: h[i0].d, v: h[i0].v, r: 0 }]; let g = 1, fi = 0;
  while (fi < flows.length && flows[fi].d <= h[i0].d) fi++;
  for (let i = i0 + 1; i < h.length; i++) {
    let f = 0; while (fi < flows.length && flows[fi].d <= h[i].d) { f += flows[fi].amt; fi++; }
    const prev = h[i - 1].v, ret = prev > 0 ? (h[i].v - (twr ? f : 0)) / prev - 1 : 0;
    g *= 1 + ret; pts.push({ d: h[i].d, v: h[i].v, r: g - 1 });
  }
  const a = pts[0], b = pts[pts.length - 1];
  return { pts, twr, from: a.d, to: b.d, abs: b.v - a.v, ret: b.r, flows: T.sum(flows.filter(x => x.d > a.d && x.d <= b.d).map(x => x.amt)) };
};
/* variazione del valore da una data (compresi versamenti e prelievi) */
T.pfChange = (P, fromIso) => {
  const h = P.history || []; if (h.length < 2) return null;
  let b = null; for (const x of h) { if (x.d <= fromIso) b = x; else break; }
  if (!b) b = h[0];
  const last = h[h.length - 1]; if (b.d === last.d || !b.v) return null;
  return { from: b.d, v0: b.v, v1: last.v, abs: last.v - b.v, pct: (last.v - b.v) / b.v };
};
/* dividendi netti per mese, ultimi 12 mesi */
T.pfDivMonths = (P, today) => {
  const out = [], d0 = T.parseIso(today.slice(0, 7) + "-01");
  for (let i = 11; i >= 0; i--) { const d = new Date(d0); d.setMonth(d.getMonth() - i); const mk = T.iso(d).slice(0, 7); out.push({ mk, v: T.sum((P.divs || []).filter(x => x.d.slice(0, 7) === mk).map(x => x.amt)) }); }
  return out;
};
})();
