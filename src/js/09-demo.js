/* myFinances on FIRE · dati di esempio inventati (per provare l'app senza dati reali) */
"use strict";
(function () {
T.makeDemoState = () => {
  const st = T.newState();
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const pick = a => a[Math.floor(rnd() * a.length)];
  Object.assign(st.profile, { name: T.tr("Demo"), currency: "CHF", incomeMonthly: 8600, onboarded: true, demo: true });
  st.fixed = [
    { id: "f1", name: T.tr("Affitto"), payee: T.tr("Immobiliare Esempio SA"), amount: 2150, freq: "mensile", kind: "costo" },
    { id: "f2", name: T.tr("Cassa malati"), payee: T.tr("Assicurazione Esempio"), amount: 790, freq: "mensile", kind: "costo" },
    { id: "f3", name: T.tr("Leasing auto"), payee: T.tr("Leasing Esempio"), amount: 420, freq: "mensile", kind: "costo", next: { from: (new Date().getFullYear() + 1) + "-01", amount: 0 } },
    { id: "f4", name: T.tr("Energia e acqua"), payee: T.tr("Azienda elettrica"), amount: 390, freq: "trimestrale", kind: "costo" },
    { id: "f5", name: T.tr("Internet e telefono"), payee: T.tr("Operatore"), amount: 65, freq: "mensile", kind: "costo" },
    { id: "f6", name: T.tr("Pilastro 3a"), payee: T.tr("Fondazione 3a"), amount: 604.8, freq: "mensile", kind: "risparmio" }
  ];
  const M = {
    alimentari: [["Coop", 25, 120], ["Migros", 20, 110], ["Denner", 10, 60], ["Lidl", 15, 80], ["Panetteria Sole", 4, 15]],
    ristoranti: [["Ristorante Da Gino", 45, 140], ["Bar Centrale", 4, 12], ["Pizzeria Bella", 30, 80], ["Starbucks", 6, 14]],
    shopping: [["Zalando", 40, 160], ["Galaxus", 20, 220], ["Manor", 25, 120], ["Amazon", 15, 90]],
    trasporti: [["Shell", 50, 90], ["SBB", 8, 60], ["EasyPark", 2, 8]],
    salute: [["Farmacia Centrale", 10, 60]],
    persona: [["Parrucchiere Stile", 45, 90]],
    sport: [["Palestra Fit", 79, 79]],
    digitale: [["Netflix", 18.9, 18.9], ["Spotify", 12.95, 12.95]],
    svago: [["Cinema Lux", 18, 40]],
    casa: [["IKEA", 30, 180]]
  };
  const freq = { alimentari: 0.75, ristoranti: 0.45, shopping: 0.18, trasporti: 0.16, salute: 0.05, persona: 0.03, sport: 0, digitale: 0, svago: 0.05, casa: 0.04 };
  const end = new Date(); end.setDate(end.getDate() - 1);
  const start = new Date(end); start.setMonth(start.getMonth() - 6); start.setDate(1);
  const rows = [];
  const vacFrom = new Date(end); vacFrom.setMonth(vacFrom.getMonth() - 3); vacFrom.setDate(10);
  const vacTo = new Date(vacFrom); vacTo.setDate(vacTo.getDate() + 9);
  st.vacations = [{ from: T.iso(vacFrom), to: T.iso(vacTo), label: T.tr("Vacanza al mare") }];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const ds = T.iso(d), inVac = d >= vacFrom && d <= vacTo;
    if (d.getDate() === 1) { rows.push({ d: ds, desc: "Palestra Fit", amt: -79 }); rows.push({ d: ds, desc: "Netflix", amt: -18.9 }); rows.push({ d: ds, desc: "Spotify", amt: -12.95 }); rows.push({ d: ds, desc: "Ricarica da conto principale", amt: 2500, rcat: "Ricarica" }); }
    if (d.getDate() === 15) rows.push({ d: ds, desc: "To Robo portfolio", amt: -300 });
    if (inVac) { if (d.getTime() === vacFrom.getTime()) rows.push({ d: ds, desc: "Hotel Mare Blu", amt: -1450 }); rows.push({ d: ds, desc: pick(["Trattoria del Porto", "Gelateria Riva", "Lido Sole"]), amt: -(30 + rnd() * 70) }); continue; }
    for (const cat in freq) { if (rnd() < freq[cat]) { const [n, a, b] = pick(M[cat]); rows.push({ d: ds, desc: n, amt: -(a + rnd() * (b - a)) }); } }
  }
  for (const r of rows) r.amt = T.round2(r.amt);
  const tx = rows.map(r => ({ d: r.d, desc: r.desc, rcat: r.rcat || "Esercente", amtLoc: r.amt, cur: "CHF", amt: r.amt, fee: 0, acct: "Conto demo" }));
  T.mergeTxs(st, tx, "demo");
  const pre = T.presetBudget(st, "realistico"); st.categories.forEach(c => c.budget = pre[c.id] || 0);
  st.budget = { preset: "realistico", vacationYear: 4000, investMonthly: 300 };
  Object.assign(st.fire, { birthYear: new Date().getFullYear() - 38, investable: 140000, cash: 25000, equityShare: 0.85,
    pensions: [{ name: T.tr("Pensione statale"), age: 65, monthly: 1900 }, { name: T.tr("Rendita cassa pensione"), age: 65, monthly: 1100 }], lumps: [] });
  st.portfolio = T.demoPortfolio();
  return st;
};
/* portafoglio inventato per i dati di esempio (valuta del conto: CHF) */
T.demoPortfolio = () => {
  let seed = 99; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const td = T.today(), P = T.pfDefaults();
  const pos = [["VWRA", "VANGUARD FTSE ALL-WORLD UCITS ETF", "ETF", "USD", 520, 145.2, 0.8, 52000], ["CHSPI", "ISHARES CORE SPI ETF", "ETF", "CHF", 120, 170.3, 1, 19000],
    ["CSPX", "ISHARES CORE S&P 500 UCITS ETF", "ETF", "USD", 30, 640.5, 0.8, 14500], ["EIMI", "ISHARES CORE MSCI EM IMI ETF", "ETF", "USD", 300, 38.4, 0.8, 8900], ["AGGH", "ISHARES GLOBAL AGGREGATE BOND ETF", "ETF", "CHF", 1500, 4.95, 1, 7600]];
  P.positions = pos.map(([sym, desc, type, cur, qty, price, fx, cost]) => ({ acc: "U0000000", sym, desc, type, cur, qty, price, valueLoc: qty * price, value: T.round2(qty * price * fx), cost, pnl: T.round2(qty * price * fx - cost), isin: "", exch: "", fx }));
  P.cash = 4200; P.invested = T.round2(T.sum(P.positions.map(p => p.value))); P.nav = T.round2(P.invested + P.cash);
  P.base = "CHF"; P.accounts = ["U0000000"]; P.date = T.addDays(td, -1); P.lastSync = new Date().toISOString();
  const n = 365, vals = []; let v = 1;
  for (let i = 0; i < n; i++) { vals.push(v); v *= 1 + (rnd() - 0.47) * 0.018; }
  const k = P.nav / vals[n - 1];
  for (let i = 0; i < n; i++) { const d = T.addDays(P.date, i - n + 1), wd = T.parseIso(d).getDay(); if (wd === 0 || wd === 6) continue; P.history.push({ d, v: T.round2(vals[i] * k * (0.82 + 0.18 * i / n)) }); }
  P.history[P.history.length - 1] = { d: P.date, v: P.nav };
  for (let m = 1; m <= 12; m += 3) { const d = T.addDays(td, -m * 30); P.divs.push({ d, sym: "CHSPI", amt: 95, tax: false, key: "demo" + m }); }
  return P;
};
})();
