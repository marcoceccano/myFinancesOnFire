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

/* preparazione: rendimenti ricampionati e tabelle per anno, condivisi da tutte le eta' di ritiro */
T.firePrepare = (st, override) => {
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
  const S12 = spend * 12;
  /* un percorso: patrimonio anno per anno; keep = salva il percorso e la spesa effettiva */
  function run(s, retireAge, keep) {
    let W = W0, wd0 = 0, wd = 0, wr0 = 0, path = keep ? new Float64Array(years + 1) : null, minSpend = 1, cons = 0, ny = 0;
    if (path) path[0] = W;
    for (let k = 0; k < years; k++) {
      const a = age + k, r = R[s * years + k];
      if (a < retireAge) W = W * (1 + r) + SAV[k];
      else {
        const need = Math.max(0, S12 - PEN[k]);
        if (a === retireAge) { wd0 = need; wd = need; wr0 = W > 0 ? need / W : 1; }
        else if (guard && W > 0 && wr0 > 0) {
          const wr = wd / W;
          if (wr > wr0 * (1 + band)) wd = Math.max(wd * (1 - step), floor * wd0);
          else if (wr < wr0 * (1 - band)) wd = Math.min(wd * (1 + step), wd0 * 1.25);
          const base = Math.max(0, S12 - PEN[k]);
          if (base < wd0) { wd = wd * (base / Math.max(1, wd0)); wd0 = base; }
        } else wd = need;
        if (wd0 > 0) minSpend = Math.min(minSpend, wd / wd0);
        if (keep) { cons += wd + Math.min(PEN[k], S12); ny++; }
        W = (W - wd / (1 - tax)) * (1 + r);
      }
      W += LUMP[k];
      if (path) path[k + 1] = W;
      if (W < 0) {
        if (path) for (let j = k + 2; j <= years; j++) path[j] = 0;
        /* finito il capitale restano solo le rendite */
        if (keep) for (let j = k + 1; j < years; j++) { if (age + j >= retireAge) { cons += Math.min(PEN[j], S12); ny++; } }
        return { ok: false, W: 0, path, depleteAge: a + 1, minSpend, spendM: ny ? cons / ny / 12 : 0 };
      }
    }
    return { ok: true, W, path, minSpend, spendM: ny ? cons / ny / 12 : 0 };
  }
  return { f, age, spend, saving, W0, years, sims, endAge, maxR, ages, guard, run };
};

/* curva: per ogni eta' di ritiro, quota di scenari in cui il patrimonio basta fino a endAge */
T.fireCurve = ctx => ctx.ages.map(ra => { let ok = 0; for (let s = 0; s < ctx.sims; s++) if (ctx.run(s, ra).ok) ok++; return ok / ctx.sims; });

/* dettaglio per un'eta' di ritiro: bande del patrimonio, riuscita, spesa e capitale residuo mediani */
T.fireAt = (ctx, ra) => {
  const paths = [], cuts = [], spends = []; let okN = 0;
  for (let s = 0; s < ctx.sims; s++) { const r = ctx.run(s, ra, true); paths.push(r.path); if (r.ok) okN++; cuts.push(r.minSpend); spends.push(r.spendM); }
  const bands = [];
  const col = new Float64Array(ctx.sims);
  for (let k = 0; k <= ctx.years; k++) { for (let s = 0; s < ctx.sims; s++) col[s] = paths[s][k]; col.sort(); bands.push({ age: ctx.age + k, p10: q(col, 0.1), p25: q(col, 0.25), p50: q(col, 0.5), p75: q(col, 0.75), p90: q(col, 0.9) }); }
  cuts.sort((a, b) => a - b); spends.sort((a, b) => a - b);
  return { chosen: ra, successChosen: okN / ctx.sims, bands, worstCut: ctx.guard ? 1 - q(cuts, 0.1) : 0,
    spendRetired: q(spends, 0.5), residual: bands[bands.length - 1].p50 };
};

/* riepilogo della curva: eta' stimata alla soglia e prime eta' a varie probabilita' */
T.fireSummary = (ctx, prob) => {
  const f = ctx.f, ages = ctx.ages;
  const conf = T.clamp(+f.confidence || 0.9, 0.5, 0.99);
  /* eta' FIRE: prima eta' in cui la probabilita' supera la soglia, interpolata */
  let fireAge = null;
  for (let i = 0; i < ages.length; i++) if (prob[i] >= conf) { fireAge = i === 0 ? ages[0] : ages[i - 1] + (conf - prob[i - 1]) / Math.max(1e-9, prob[i] - prob[i - 1]); break; }
  const target = fireAge != null ? Math.ceil(fireAge - 1e-9) : ctx.maxR;
  const firstAt = th => { const i = prob.findIndex(p => p >= th - 1e-9); return i < 0 ? null : ages[i]; };
  const fireNumber = ctx.spend * 12 / (+f.withdrawalRate || 0.035);
  return { age: ctx.age, ages, prob, conf, fireAge, target, firstAt: { 50: firstAt(0.5), 80: firstAt(0.8), 90: firstAt(0.9), 95: firstAt(0.95), conf: firstAt(conf) },
    fireNumber, progress: fireNumber > 0 ? ctx.W0 / fireNumber : 0, spend: ctx.spend, saving: ctx.saving, W0: ctx.W0, years: ctx.years, sims: ctx.sims,
    endAge: ctx.endAge, maxR: ctx.maxR, profile: (T.MARKET_PROFILES[f.market] || T.MARKET_PROFILES.world).label };
};

/* zone della probabilita' di riuscita (come nel simulatore Monte Carlo) */
T.FIRE_ZONES = [
  { to: 0.5,  name: "Non regge",       c: "var(--z1)", text: "In piu' della meta' degli scenari il capitale finisce prima. Sposta in avanti l'eta' o riduci la spesa prevista." },
  { to: 0.75, name: "Da rivedere",     c: "var(--z2)", text: "Il piano regge in molti scenari, ma non abbastanza. Qualche anno di lavoro in piu' o una spesa un po' piu' bassa lo rendono solido." },
  { to: 0.85, name: "Ragionevole",     c: "var(--z3)", text: "Il piano regge nella maggior parte degli scenari. Nei periodi difficili dovrai ridurre un po' la spesa." },
  { to: 0.95, name: "Solido",          c: "var(--z4)", text: "Il piano regge in quasi tutti gli scenari. E' la fascia sana, fra l'85% e il 95%." },
  { to: 1.01, name: "Molto probabile", c: "var(--z5)", text: "Il piano regge quasi sempre. Il 100% non e' l'obiettivo: puntarci vuol dire lavorare anni in piu' per proteggerti da scenari estremi." }
];
T.fireZone = p => T.FIRE_ZONES.find(z => p < z.to) || T.FIRE_ZONES[T.FIRE_ZONES.length - 1];

/* simulazione completa (curva + dettaglio per l'eta' scelta o stimata) */
T.simulateFire = (st, override) => {
  const ctx = T.firePrepare(st, override), prob = T.fireCurve(ctx), sum = T.fireSummary(ctx, prob);
  const chosen = override && override.retireAge ? +override.retireAge : sum.target;
  return Object.assign(sum, T.fireAt(ctx, chosen));
};
})();
