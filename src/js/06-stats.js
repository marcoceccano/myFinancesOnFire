/* myFinances on FIRE · calcoli su spese, budget e risparmio */
"use strict";
(function () {
const catById = st => Object.fromEntries(st.categories.map(c => [c.id, c]));
T.catById = catById;

/* movimenti di spesa con importo positivo = speso (i rimborsi sono negativi) */
T.spendRows = st => st.txs.filter(t => t.flow === "spesa").map(t => ({ t, d: t.d, v: -t.amt, cat: t.cat, vac: T.isVacation(t, st) }));

T.coverage = st => {
  const rows = st.txs.filter(t => t.flow === "spesa");
  if (!rows.length) return null;
  let a = rows[0].d, b = rows[0].d; for (const r of rows) { if (r.d < a) a = r.d; if (r.d > b) b = r.d; }
  const days = T.daysBetween(a, b) + 1;
  return { from: a, to: b, days, months: days / T.DAYS_PER_MONTH };
};

/* medie mensili per categoria sul periodo coperto, vacanze a parte */
T.averages = (st, from, to) => {
  const cov = T.coverage(st); if (!cov) return { byCat: {}, variable: 0, vacation: 0, months: 0, cov: null };
  from = from || cov.from; to = to || cov.to;
  const months = (T.daysBetween(from, to) + 1) / T.DAYS_PER_MONTH;
  const byCat = {}; let vac = 0;
  for (const r of T.spendRows(st)) {
    if (r.d < from || r.d > to) continue;
    if (r.vac) { vac += r.v; continue; }
    byCat[r.cat] = (byCat[r.cat] || 0) + r.v;
  }
  for (const k in byCat) byCat[k] /= months;
  return { byCat, variable: T.sum(Object.values(byCat)), vacation: vac / months, months, cov, from, to };
};

T.vacationByYear = st => { const y = {}; for (const r of T.spendRows(st)) if (r.vac) y[r.d.slice(0, 4)] = (y[r.d.slice(0, 4)] || 0) + r.v; return y; };
T.fixedMonthly = (st, next) => {
  let cost = 0, save = 0;
  for (const f of st.fixed) { const v = next && f.next && f.next.amount != null ? (+f.next.amount || 0) / (T.FREQ[f.freq] || 1) : T.monthlyOf(f); if (f.kind === "risparmio") save += v; else cost += v; }
  return { cost, save };
};
T.hasNextFixed = st => st.fixed.some(f => f.next && f.next.amount != null);
T.nextFixedFrom = st => (st.fixed.find(f => f.next && f.next.from) || {}).next?.from || null;

/* quadro mensile: oggi (abitudini) e con il budget */
T.picture = st => {
  const av = T.averages(st);
  const fx = T.fixedMonthly(st, false), fxN = T.fixedMonthly(st, true);
  const vacYears = T.vacationByYear(st), yrs = Object.keys(vacYears);
  const vacActual = av.months >= 11 ? av.vacation : yrs.length ? T.sum(Object.values(vacYears)) / Math.max(1, yrs.length) / 12 : 0;
  const budgetVar = T.sum(st.categories.map(c => +c.budget || 0));
  const vacBudget = (+st.budget.vacationYear || 0) / 12;
  const income = +st.profile.incomeMonthly || 0;
  const now = { fixed: fx.cost, variable: av.variable, vacation: vacActual, total: fx.cost + av.variable + vacActual };
  const plan = { fixed: fxN.cost, variable: budgetVar || av.variable, vacation: st.budget.vacationYear ? vacBudget : vacActual };
  plan.total = plan.fixed + plan.variable + plan.vacation;
  const habitsNext = fxN.cost + av.variable + vacActual;
  const rate = tot => income > 0 ? (income - tot) / income : null;
  return { av, now, plan, habitsNext, income, saving3a: fx.save, rateNow: rate(now.total), ratePlan: rate(plan.total),
    weeklyCap: plan.variable * 12 / 52, dailyCap: plan.variable * 12 / 365, yearlyDelta: (habitsNext - plan.total) * 12 };
};

/* aggregati per mese e per categoria, con filtri */
T.aggregate = (st, f) => {
  f = f || {};
  const months = {}, cats = {}, merch = {}, days = {}, wd = [0, 0, 0, 0, 0, 0, 0];
  let total = 0, n = 0, vac = 0;
  for (const r of T.spendRows(st)) {
    if (f.from && r.d < f.from) continue; if (f.to && r.d > f.to) continue;
    if (f.months && f.months.size && !f.months.has(r.d.slice(0, 7))) continue;
    if (!f.vac && r.vac) continue;
    if (f.cat && r.cat !== f.cat) continue;
    if (f.q && !(r.t.desc + " " + (r.t.note || "")).toLowerCase().includes(f.q.toLowerCase())) continue;
    const mk = r.d.slice(0, 7);
    (months[mk] = months[mk] || {})[r.cat] = (months[mk][r.cat] || 0) + r.v;
    cats[r.cat] = (cats[r.cat] || 0) + r.v;
    const m = r.t.note || r.t.desc; merch[m] = merch[m] || { v: 0, n: 0 }; merch[m].v += r.v; merch[m].n++;
    days[r.d] = (days[r.d] || 0) + r.v; wd[(T.parseIso(r.d).getDay() + 6) % 7] += r.v;
    total += r.v; n++; if (r.vac) vac += r.v;
  }
  return { months, cats, merch, days, wd, total, n, vac };
};

/* settimana: speso (senza vacanze) contro il tetto */
T.week = (st, start) => {
  const end = T.addDays(start, 6), pic = T.picture(st);
  let spent = 0, vac = 0; const perDay = [0, 0, 0, 0, 0, 0, 0], list = [];
  for (const r of T.spendRows(st)) { if (r.d < start || r.d > end) continue; if (r.vac) { vac += r.v; continue; } spent += r.v; perDay[T.daysBetween(start, r.d)] += r.v; list.push(r); }
  return { start, end, spent, vac, cap: pic.weeklyCap, perDay, list };
};
T.weeksHistory = (st, n, lastStart) => { const out = []; for (let i = n - 1; i >= 0; i--) { const s = T.addDays(lastStart, -7 * i); const w = T.week(st, s); out.push({ start: s, spent: w.spent, vac: w.vac, cap: w.cap }); } return out; };

/* proposte di budget: attuale, realistico, ambizioso */
T.presetBudget = (st, kind) => {
  const av = T.averages(st);
  const r10 = v => Math.max(0, Math.round(v / 10) * 10);
  return Object.fromEntries(st.categories.map(c => {
    const cur = av.byCat[c.id] || 0;
    const k = kind === "attuale" ? 1 : kind === "realistico" ? (c.essential ? 0.97 : 0.82) : (c.essential ? 0.93 : 0.65);
    return [c.id, c.vacation ? 0 : r10(cur * k)];
  }));
};
})();
