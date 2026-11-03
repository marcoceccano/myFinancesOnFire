/* myFinances on FIRE · schermata FIRE */
"use strict";
(function () {
const h = T.h, A = T.A;

A.renderFire = main => {
  const S = A.S, F = S.fire;
  const out = h("div"); main.appendChild(out);
  const draw = () => {
    T.clear(out);
    if (!F.birthYear) { out.appendChild(h("div.note.warn", T.tr("Inserisci almeno l'anno di nascita e il patrimonio investito qui sotto."))); return; }
    const res = A.fireResult(() => { if (A.view === "fire") draw(); });
    if (!res) { out.appendChild(h("div.card", h("div.row", h("span.spinner"), h("span.muted", T.tr("Simulazione di ") + (F.sims || 2000) + T.tr(" scenari..."))))); return; }
    const yearNow = new Date().getFullYear();
    out.appendChild(h("div.card", h("h2", T.tr("Dove sei")),
      h("div.ring-wrap", T.ring(res.progress, T.fmt.pct(res.progress), T.tr("del numero FIRE"), "var(--ok)"),
        h("div", h("div.small.muted", T.tr("Eta' FIRE con ") + T.fmt.pct(res.conf) + T.tr(" di probabilita'")), h("div.big", res.fireAge != null ? T.fmt.n1(res.fireAge) + T.tr(" anni") : T.tr("oltre i 70")),
          res.fireAge != null ? h("div.small.muted", T.tr("circa nel ") + Math.round(yearNow + res.fireAge - res.age)) : null)),
      h("div.kpis", { style: { marginBlockStart: "12px" } },
        T.kpi(T.tr("Numero FIRE"), A.money(res.fireNumber), T.tr("spesa annua / ") + T.fmt.pct1(F.withdrawalRate)),
        T.kpi(T.tr("Patrimonio oggi"), A.money(res.W0), T.tr("investito + liquidita'")),
        T.kpi(T.tr("Spesa in FIRE"), A.money(res.spend), F.spendMode === "auto" ? T.tr("al mese, come oggi") : T.tr("al mese, scelta da te")),
        T.kpi(T.tr("Risparmio"), A.money(res.saving), F.savingMode === "auto" ? T.tr("al mese, reddito meno spese") : T.tr("al mese, scelto da te")))));
    const c1 = h("div.card", h("h2", T.tr("Probabilita' di successo per eta' di ritiro")), h("p.sub", T.tr("Quota di scenari in cui il patrimonio basta fino a ") + F.endAge + T.tr(" anni.")));
    out.appendChild(c1);
    c1.appendChild(T.lineChart(c1, res.ages, res.prob, { thr: res.conf, thrLabel: T.fmt.pct(res.conf), mark: res.fireAge != null ? Math.round(res.fireAge * 10) / 10 : null, markLabel: res.fireAge != null ? T.fmt.n1(res.fireAge) : "" }));
    const c2 = h("div.card", h("h2", T.tr("Patrimonio nel tempo, smettendo a ") + res.chosen + T.tr(" anni~eta")), h("p.sub", T.tr("Linea blu: scenario mediano. Fasce: meta' e 80% degli scenari. Tratteggio rosso: 1 scenario su 10 va peggio. Importi in moneta di oggi.")));
    out.appendChild(c2);
    c2.appendChild(T.fanChart(c2, res.bands, { retire: res.chosen }));
    c2.appendChild(h("div.small.muted", T.tr("Successo smettendo a ") + res.chosen + T.tr(" anni: ") + T.fmt.pct(res.successChosen) + (F.strategy === "guardrail" ? T.tr(". Con i guardrail, nel 10% degli scenari peggiori la spesa scende fino al ") + T.fmt.pct(1 - res.worstCut) + T.tr(" del previsto.") : ".")));
    out.appendChild(h("p.small.muted", res.sims + T.tr(" scenari ricampionando a blocchi di ") + F.blockLen + T.tr(" anni le sequenze storiche reali (") + T.tr(res.profile) + T.tr("). E' una stima, non una consulenza finanziaria.")));
  };
  draw();

  /* parametri */
  const set = (k, v) => { F[k] = v; A.fire.key = ""; A.save(); clearTimeout(A._ft); A._ft = setTimeout(draw, 500); };
  const pct = (label, k, hint, step) => T.numField(label + " (%)", F[k] == null ? "" : +(F[k] * 100).toFixed(2), v => set(k, v == null ? 0 : v / 100), { step: step || 0.1, hint });
  const box = h("div.card", h("h2", T.tr("I tuoi numeri")));
  const acc = (title, open, ...kids) => h("details.acc", { open: open ? "" : null }, h("summary", title), h("div.acc-in", kids));
  const y0 = new Date().getFullYear();
  box.appendChild(acc(T.tr("Situazione di oggi"), !F.birthYear,
    T.numField(T.tr("Anno di nascita"), F.birthYear, v => set("birthYear", v), { min: 1930, max: y0 - 16, step: 1 }),
    T.numField(T.tr("Patrimonio investito"), F.investable, v => set("investable", v || 0), { hint: T.tr("Azioni, ETF, fondi. Puoi includere il 3a se e' investito.") }),
    T.numField(T.tr("Liquidita' e risparmi"), F.cash, v => set("cash", v || 0), { hint: T.tr("Conti, depositi, fondo emergenze.") }),
    pct(T.tr("Quota in azioni"), "equityShare", T.tr("Il resto rende come la parte prudente."), 5),
    T.selectField(T.tr("Mercato di riferimento"), F.market, Object.entries(T.MARKET_PROFILES).map(([k, p]) => [k, p.label]), v => set("market", v)),
    pct(T.tr("Rendimento parte prudente"), "safeReturn", T.tr("Obbligazioni o conto deposito, al lordo dell'inflazione.")),
    pct(T.tr("Inflazione"), "inflation")));
  const spendBox = h("div");
  const fillSpend = () => {
    T.clear(spendBox);
    const pic = T.picture(S);
    spendBox.appendChild(h("div.lbl", T.tr("Spesa mensile in FIRE")));
    spendBox.appendChild(T.seg([["auto", T.tr("Come oggi (") + T.fmt.k(pic.now.total) + ")"], ["manuale", T.tr("Scelgo io")]], F.spendMode, v => { set("spendMode", v); fillSpend(); }));
    if (F.spendMode !== "auto") spendBox.appendChild(T.numField(T.tr("Spesa al mese in moneta di oggi"), F.spendFire, v => set("spendFire", v || 0)));
    spendBox.appendChild(h("div", { style: { blockSize: "12px" } }));
    spendBox.appendChild(h("div.lbl", T.tr("Risparmio mensile fino al FIRE")));
    spendBox.appendChild(T.seg([["auto", T.tr("Reddito meno spese")], ["manuale", T.tr("Scelgo io")]], F.savingMode, v => { set("savingMode", v); fillSpend(); }));
    if (F.savingMode !== "auto") spendBox.appendChild(T.numField(T.tr("Risparmio investito al mese"), F.monthlySaving, v => set("monthlySaving", v || 0)));
    spendBox.appendChild(pct(T.tr("Crescita annua del risparmio, oltre l'inflazione"), "savingGrowth"));
  };
  fillSpend();
  box.appendChild(acc(T.tr("Spesa e risparmio"), false, spendBox));
  const listEd = (arr, fields, addLabel, blank) => {
    const wrap = h("div");
    const fill = () => {
      T.clear(wrap);
      arr.forEach((it, i) => wrap.appendChild(h("div.grid2", { style: { alignItems: "end", borderBlockEnd: "1px solid var(--line)", paddingBlock: "8px" } },
        fields.map(([k, label, type]) => type === "text" ? T.textField(label, it[k], v => { it[k] = v; set("pensions", F.pensions); }) : T.numField(label, it[k], v => { it[k] = v || 0; set("pensions", F.pensions); })),
        h("button.btn.danger", { type: "button", onclick: () => { arr.splice(i, 1); set("pensions", F.pensions); fill(); } }, T.tr("Rimuovi")))));
      wrap.appendChild(h("button.btn", { type: "button", onclick: () => { arr.push(Object.assign({}, blank)); fill(); } }, addLabel));
    };
    fill(); return wrap;
  };
  box.appendChild(acc(T.tr("Pensioni e capitali futuri"), false,
    h("p.small.muted", T.tr("Rendite (pensione statale, cassa pensione) in moneta di oggi, dall'eta' indicata.")),
    listEd(F.pensions, [["name", T.tr("Nome"), "text"], ["age", T.tr("Dall'eta'")], ["monthly", T.tr("Al mese")]], T.tr("Aggiungi una rendita"), { name: T.tr("Pensione"), age: 65, monthly: 0 }),
    h("p.small.muted", { style: { marginBlockStart: "14px" } }, T.tr("Capitali che arrivano in un colpo (per esempio 2\u00b0 pilastro o 3a ritirati), al netto delle imposte.")),
    listEd(F.lumps, [["name", T.tr("Nome"), "text"], ["age", T.tr("A eta'")], ["amount", T.tr("Importo")]], T.tr("Aggiungi un capitale"), { name: T.tr("Capitale"), age: 60, amount: 0 })));
  box.appendChild(acc(T.tr("Prelievo e prudenza"), false,
    pct(T.tr("Tasso di prelievo per il numero FIRE"), "withdrawalRate", T.tr("3,5% e' prudente per orizzonti lunghi.")),
    h("div.lbl", T.tr("Strategia di prelievo")),
    T.seg([["fisso", T.tr("Fisso")], ["guardrail", T.tr("Con guardrail")]], F.strategy, v => set("strategy", v)),
    h("p.small.muted", T.tr("Fisso: ogni anno prelevi la stessa spesa reale. Guardrail: se i mercati scendono molto tagli la spesa del ") + T.fmt.pct(F.step) + T.tr(", se salgono molto la aumenti; mai sotto la soglia minima.")),
    pct(T.tr("Banda dei guardrail"), "band", "", 5), pct(T.tr("Taglio o aumento"), "step", "", 5), pct(T.tr("Spesa minima"), "floor", T.tr("Quota della spesa prevista sotto cui non scendi."), 5),
    pct(T.tr("Imposte medie sui prelievi"), "taxRate"),
    T.numField(T.tr("Il patrimonio deve durare fino a (eta')"), F.endAge, v => set("endAge", v || 95), { step: 1 }),
    pct(T.tr("Probabilita' di successo richiesta"), "confidence", "", 1),
    T.numField(T.tr("Numero di scenari"), F.sims, v => set("sims", T.clamp(v || 2000, 200, 5000)), { step: 100, hint: T.tr("Di piu' = piu' preciso ma piu' lento.") })));
  main.appendChild(box);
};
})();
