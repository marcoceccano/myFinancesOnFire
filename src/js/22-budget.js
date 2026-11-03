/* myFinances on FIRE · schermata Budget */
"use strict";
(function () {
const h = T.h, A = T.A;

A.applyPreset = kind => {
  const S = A.S, p = T.presetBudget(S, kind);
  S.categories.forEach(c => c.budget = p[c.id] || 0);
  S.budget.preset = kind;
};

A.renderBudget = main => {
  const S = A.S, av = T.averages(S);
  if (!S.categories.some(c => +c.budget > 0) && av.cov) A.applyPreset("realistico");
  const pic = T.picture(S);
  /* riepilogo */
  const res = h("div.card");
  main.appendChild(res);
  const fillRes = () => {
    const p = T.picture(S); T.clear(res);
    res.appendChild(h("h2", T.tr("Il vostro budget")));
    res.appendChild(h("div.kpis", T.kpi(T.tr("A settimana"), A.money(p.weeklyCap), T.tr("spese di tutti i giorni")), T.kpi(T.tr("Al giorno"), A.money(p.dailyCap), T.tr("in media")),
      T.kpi(T.tr("Totale al mese"), A.money(p.plan.total), T.tr("fissi ") + T.fmt.k(p.plan.fixed) + T.tr(" + spese ") + T.fmt.k(p.plan.variable) + T.tr(" + vacanze ") + T.fmt.k(p.plan.vacation)),
      T.kpi(T.tr("Tasso di risparmio"), p.ratePlan == null ? "-" : T.fmt.pct(p.ratePlan), p.rateNow == null ? T.tr("inserisci il reddito") : T.tr("oggi ") + T.fmt.pct(p.rateNow), p.ratePlan != null && p.rateNow != null && p.ratePlan >= p.rateNow ? "ok" : null)));
    const delta = p.yearlyDelta;
    res.appendChild(h("p", { style: { marginBlock: "12px 4px" } }, delta >= 0 ? h("span", T.tr("Rispetto alle abitudini di oggi") + (T.hasNextFixed(S) ? T.tr(" (con i costi fissi futuri)") : "") + T.tr(" risparmiate "), h("b.ok", A.money(delta) + T.tr(" all'anno")), ".") : h("span", T.tr("Questo budget costa "), h("b.bad", A.money(-delta) + T.tr(" all'anno")), T.tr(" in piu' delle abitudini di oggi."))));
    const fx = h("div.small.muted"); res.appendChild(fx);
    A.budgetFire(fx);
  };
  /* preset */
  const pre = h("div.card", h("h2", T.tr("Punto di partenza")), h("p.sub", T.tr("Attuale = la vostra media. Realistico e Ambizioso tagliano soprattutto le spese non essenziali.")),
    T.seg([["attuale", T.tr("Attuale")], ["realistico", T.tr("Realistico")], ["ambizioso", T.tr("Ambizioso")], ["custom", T.tr("Su misura")]], S.budget.preset, v => { if (v !== "custom") { A.applyPreset(v); A.save(); A.render(); } else { S.budget.preset = "custom"; A.save(); } }));
  main.appendChild(pre);
  /* cursori per categoria */
  const sl = h("div.card", h("h2", T.tr("Spese di tutti i giorni, al mese")), h("p.sub", T.tr("Il numero piccolo e' la vostra media di oggi.")));
  for (const c of S.categories.filter(c => !c.vacation)) {
    const cur = av.byCat[c.id] || 0, max = Math.max(100, Math.ceil(Math.max(cur, +c.budget || 0) * 1.6 / 50) * 50);
    const val = h("span.val", T.fmt.n0(+c.budget || 0));
    const r = h("input", { type: "range", min: 0, max, step: 10, value: +c.budget || 0, "aria-label": T.tr("Budget ") + c.name });
    r.addEventListener("input", () => { c.budget = +r.value; val.textContent = T.fmt.n0(c.budget); S.budget.preset = "custom"; fillRes(); });
    r.addEventListener("change", () => { A.fire.key = ""; A.save(); pre.querySelectorAll(".seg button").forEach((b, i) => b.classList.toggle("on", i === 3)); fillRes(); });
    sl.appendChild(h("div.slider-row", h("i.dot", { style: { background: c.color } }), h("div", h("div.nm", c.name), h("div.cur", T.tr("oggi ") + T.fmt.n0(cur))), val, r));
  }
  main.appendChild(sl);
  /* vacanze */
  const vy = T.vacationByYear(S);
  const vVal = h("b", A.money(+S.budget.vacationYear || 0));
  const vr = h("input", { type: "range", min: 0, max: 30000, step: 250, value: +S.budget.vacationYear || 0, "aria-label": T.tr("Budget vacanze annuo") });
  vr.addEventListener("input", () => { S.budget.vacationYear = +vr.value; vVal.textContent = A.money(S.budget.vacationYear); fillRes(); });
  vr.addEventListener("change", () => { A.fire.key = ""; A.save(); });
  main.appendChild(h("div.card", h("h2", T.tr("Vacanze")), h("div.row.between", h("span", T.tr("Budget all'anno")), vVal), vr,
    h("div.small.muted", T.tr("Ogni mese mettete da parte ") + A.money((+S.budget.vacationYear || 0) / 12) + ". " + (Object.keys(vy).length ? T.tr("Speso finora: ") + Object.entries(vy).sort().map(([y, v]) => y + " " + A.money(v)).join(", ") + "." : ""))));
  /* fissi e reddito */
  const fxNow = T.fixedMonthly(S, false), fxNext = T.fixedMonthly(S, true);
  main.appendChild(h("div.card", h("h2", T.tr("Costi fissi e reddito")),
    h("div.li", h("div.grow", h("div.t", T.tr("Costi fissi")), h("div.d", T.hasNextFixed(S) ? T.tr("Oggi ") + A.money(fxNow.cost) + T.tr(", dal ") + T.fmt.month(T.nextFixedFrom(S)) + " " + A.money(fxNext.cost) : S.fixed.length + T.tr(" voci"))), h("button.btn", { type: "button", onclick: () => A.go("altro", "fissi") }, T.tr("Modifica"))),
    h("div.li", h("div.grow", h("div.t", T.tr("Reddito netto al mese")), h("div.d", pic.income ? A.money(pic.income) : T.tr("non inserito"))), h("button.btn", { type: "button", onclick: () => A.go("altro", "profilo") }, T.tr("Modifica"))),
    fxNow.save ? h("div.small.muted", T.tr("Risparmio automatico (per esempio 3a): ") + A.money(fxNow.save) + T.tr(" al mese, non conteggiato come spesa.")) : null));
  fillRes();
};

/* effetto del budget sull'eta' FIRE: due simulazioni rapide (abitudini di oggi e budget) */
let bfTimer = null;
A.budgetFire = el => {
  const S = A.S; if (!S.fire.birthYear) { el.textContent = T.tr("Per vedere l'effetto sul FIRE, inserisci eta' e patrimonio nella sezione FIRE."); return; }
  el.textContent = T.tr("Calcolo dell'effetto sul FIRE...");
  clearTimeout(bfTimer);
  bfTimer = setTimeout(() => {
    try {
      const sims = 600;
      const a = T.simulateFire(S, { sims, useBudget: false }), b = T.simulateFire(S, { sims, useBudget: true });
      const fa = a.fireAge, fb = b.fireAge;
      if (fa == null || fb == null) { el.textContent = T.tr("Con questi numeri il FIRE resta oltre i 70 anni in almeno uno dei due casi."); return; }
      const d = fa - fb;
      el.textContent = T.tr("Eta' FIRE stimata: ") + T.fmt.n1(fb) + T.tr(" anni con questo budget, ") + T.fmt.n1(fa) + T.tr(" con le abitudini di oggi (") + (d >= 0 ? T.fmt.n1(d) + T.tr(" anni prima") : T.fmt.n1(-d) + T.tr(" anni dopo")) + T.tr("). Probabilita' richiesta ") + T.fmt.pct(b.conf) + ".";
    } catch (e) { el.textContent = ""; }
  }, 350);
};
})();
