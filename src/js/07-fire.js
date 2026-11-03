/* myFinances on FIRE · simulatore FIRE Monte Carlo (tutti gli importi in moneta di oggi) */
"use strict";
(function () {
T.MARKET_PROFILES = {
  world:      { label: "Azionario mondiale, sequenze dal 1972", from: 1972, gap: 1.3, mix: 0 },
  world_long: { label: "Azionario mondiale, sequenze dal 1928", from: 1928, gap: 0.2, mix: 0 },
  usa:        { label: "Solo S&P 500, dal 1972",                 from: 1972, gap: 0, mix: 0 },
  tech:       { label: "Tecnologia (50% Nasdaq 100 + 50% S&P 500), dal 1986", from: 1986, gap: 0, mix: 0.5, nas: "NDX100" }
};
/* rendimenti azionari nominali annui del profilo */
T.marketSeries = key => {
  const P = T.MARKET_PROFILES[key] || T.MARKET_PROFILES.world, M = T.MARKET;
  const nas = P.nas ? M[P.nas] : null;
  return Object.keys(M.SP500).map(Number).filter(y => y >= P.from && (!nas || y in nas)).sort((a, b) => a - b)
    .map(y => ((nas ? P.mix * nas[y] + (1 - P.mix) * M.SP500[y] : M.SP500[y]) - P.gap) / 100);
};
function rng(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const q = (s, p) => { if (!s.length) return 0; const i = (s.length - 1) * p, b = Math.floor(i), r = i - b; return s[b + 1] !== undefined ? s[b] + r * (s[b + 1] - s[b]) : s[b]; };

/* parametri effettivi: "auto" prende spesa e risparmio dall'app */
T.fireInputs = (st, override) => {
  const f = Object.assign({}, st.fire, override || {});
  const pic = T.picture(st);
  const yearNow = new Date().getFullYear();
  const age = f.birthYear ? yearNow - f.birthYear : 40;
  const spendBase = override && override.useBudget ? pic.plan.total : pic.now.total;
  const spend = f.spendMode === "auto" ? spendBase : +f.spendFire || 0;
  const income = pic.income;
  /* il risparmio automatico (3a ecc.) non e' una spesa: e' gia' dentro reddito meno spese */
  const saving = f.savingMode === "auto" ? Math.max(0, income - (override && override.useBudget ? pic.plan.total : pic.habitsNext)) : +f.monthlySaving || 0;
  return { f, age, spend, saving, income, pic };
};

/* simulazione: per ogni eta' di ritiro, quota di scenari in cui il patrimonio basta fino a endAge */
T.simulateFire = (st, override) => {
  const { f, age, spend, saving } = T.fireInputs(st, override);
  const infl = +f.inflation || 0, eq = T.clamp(+f.equityShare, 0, 1);
  const safeReal = (1 + (+f.safeReturn || 0)) / (1 + infl) - 1;
  const endAge = Math.max(age + 5, +f.endAge || 95), years = endAge - age;
  const sims = Math.max(200, Math.min(5000, +f.sims || 2000));
  const series = T.marketSeries(f.market), L = Math.max(1, +f.blockLen || 5);
  const rand = rng(12345 + (override && override.seed || 0));
  /* rendimenti reali annui di portafoglio, gli stessi per tutte le eta' (confronto equo) */
  const R = new Float64Array(sims * years);
  for (let s = 0; s < sims; s++) {
    let k = 0;
    while (k < years) { const st0 = Math.floor(rand() * series.length); for (let j = 0; j < L && k < years; j++, k++) { const re = (1 + series[(st0 + j) % series.length]) / (1 + infl) - 1; R[s * years + k] = eq * re + (1 - eq) * safeReal; } }
  }
  const W0 = (+f.investable || 0) + (+f.cash || 0);
  const pensions = (f.pensions || []).filter(p => +p.monthly > 0), lumps = (f.lumps || []).filter(l => +l.amount);
  const tax = T.clamp(+f.taxRate || 0, 0, 0.6), g = +f.savingGrowth || 0;
  /* tabelle per anno: pensioni, capitali in arrivo, risparmio */
  const PEN = new Float64Array(years + 1), LUMP = new Float64Array(years + 1), SAV = new Float64Array(years + 1);
  for (let k = 0; k <= years; k++) {
    const a = age + k;
    PEN[k] = T.sum(pensions.filter(p => a >= +p.age).map(p => +p.monthly * 12));
    LUMP[k] = T.sum(lumps.filter(l => +l.age === a + 1).map(l => +l.amount));
    SAV[k] = saving * 12 * Math.pow(1 + g, k);
  }
  const guard = f.strategy === "guardrail", band = +f.band || 0.2, step = +f.step || 0.1, floor = +f.floor || 0.8;
  const maxR = Math.min(endAge - 1, Math.max(age + 1, 70));
  const ages = []; for (let a = age; a <= maxR; a++) ages.push(a);
  function run(s, retireAge, keep) {
    let W = W0, wd0 = 0, wd = 0, wr0 = 0, path = keep ? new Float64Array(years + 1) : null, minSpend = 1;
    if (path) path[0] = W;
    for (let k = 0; k < years; k++) {
      const a = age + k, r = R[s * years + k];
      if (a < retireAge) W = W * (1 + r) + SAV[k];
      else {
        const need = Math.max(0, spend * 12 - PEN[k]);
        if (a === retireAge) { wd0 = need; wd = need; wr0 = W > 0 ? need / W : 1; }
        else if (guard && W > 0 && wr0 > 0) {
          const wr = wd / W;
          if (wr > wr0 * (1 + band)) wd = Math.max(wd * (1 - step), floor * wd0);
          else if (wr < wr0 * (1 - band)) wd = Math.min(wd * (1 + step), wd0 * 1.25);
          const base = Math.max(0, spend * 12 - PEN[k]);
          if (base < wd0) { wd = wd * (base / Math.max(1, wd0)); wd0 = base; }
        } else wd = need;
        if (wd0 > 0) minSpend = Math.min(minSpend, wd / wd0);
        W = (W - wd / (1 - tax)) * (1 + r);
      }
      W += LUMP[k];
      if (path) path[k + 1] = W;
      if (W < 0) { if (path) for (let j = k + 2; j <= years; j++) path[j] = 0; return { ok: false, W: 0, path, depleteAge: a + 1, minSpend }; }
    }
    return { ok: true, W, path, minSpend };
  }
  const prob = ages.map(ra => { let ok = 0; for (let s = 0; s < sims; s++) if (run(s, ra).ok) ok++; return ok / sims; });
  const conf = T.clamp(+f.confidence || 0.85, 0.5, 0.99);
  /* eta' FIRE: prima eta' in cui la probabilita' supera la soglia, interpolata */
  let fireAge = null;
  for (let i = 0; i < ages.length; i++) if (prob[i] >= conf) { fireAge = i === 0 ? ages[0] : ages[i - 1] + (conf - prob[i - 1]) / Math.max(1e-9, prob[i] - prob[i - 1]); break; }
  const target = fireAge != null ? Math.ceil(fireAge - 1e-9) : maxR;
  const chosen = override && override.retireAge ? +override.retireAge : target;
  /* bande del patrimonio per l'eta' scelta */
  const paths = []; let okN = 0, cuts = [];
  for (let s = 0; s < sims; s++) { const r = run(s, chosen, true); paths.push(r.path); if (r.ok) okN++; cuts.push(r.minSpend); }
  const bands = [];
  for (let k = 0; k <= years; k++) { const col = paths.map(p => p[k]).sort((a, b) => a - b); bands.push({ age: age + k, p10: q(col, 0.1), p25: q(col, 0.25), p50: q(col, 0.5), p75: q(col, 0.75), p90: q(col, 0.9) }); }
  cuts.sort((a, b) => a - b);
  const fireNumber = spend * 12 / (+f.withdrawalRate || 0.035);
  return { age, ages, prob, conf, fireAge, chosen, successChosen: okN / sims, bands, fireNumber, progress: fireNumber > 0 ? W0 / fireNumber : 0,
    spend, saving, W0, years, sims, worstCut: guard ? 1 - q(cuts, 0.1) : 0, profile: (T.MARKET_PROFILES[f.market] || T.MARKET_PROFILES.world).label };
};
})();
