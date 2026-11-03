/* myFinances on FIRE · schermata FIRE */
"use strict";
(function () {
const h = T.h, A = T.A;

A.renderFire = main => {
  const S = A.S, F = S.fire;
  const out = h("div"); main.appendChild(out);
  const draw = () => {
    T.clear(out);
    if (!F.birthYear) { out.appendChild(h("div.note.warn", "Inserisci almeno l'anno di nascita e il patrimonio investito qui sotto.")); return; }
    const res = A.fireResult(() => { if (A.view === "fire") draw(); });
    if (!res) { out.appendChild(h("div.card", h("div.row", h("span.spinner"), h("span.muted", "Simulazione di " + (F.sims || 2000) + " scenari...")))); return; }
    const yearNow = new Date().getFullYear();
    out.appendChild(h("div.card", h("h2", "Dove sei"),
      h("div.ring-wrap", T.ring(res.progress, T.fmt.pct(res.progress), "del numero FIRE", "var(--ok)"),
        h("div", h("div.small.muted", "Eta' FIRE con " + T.fmt.pct(res.conf) + " di probabilita'"), h("div.big", res.fireAge != null ? T.fmt.n1(res.fireAge) + " anni" : "oltre i 70"),
          res.fireAge != null ? h("div.small.muted", "circa nel " + Math.round(yearNow + res.fireAge - res.age)) : null)),
      h("div.kpis", { style: { marginBlockStart: "12px" } },
        T.kpi("Numero FIRE", A.money(res.fireNumber), "spesa annua / " + T.fmt.pct1(F.withdrawalRate)),
        T.kpi("Patrimonio oggi", A.money(res.W0), "investito + liquidita'"),
        T.kpi("Spesa in FIRE", A.money(res.spend), F.spendMode === "auto" ? "al mese, come oggi" : "al mese, scelta da te"),
        T.kpi("Risparmio", A.money(res.saving), F.savingMode === "auto" ? "al mese, reddito meno spese" : "al mese, scelto da te"))));
    const c1 = h("div.card", h("h2", "Probabilita' di successo per eta' di ritiro"), h("p.sub", "Quota di scenari in cui il patrimonio basta fino a " + F.endAge + " anni."));
    out.appendChild(c1);
    c1.appendChild(T.lineChart(c1, res.ages, res.prob, { thr: res.conf, thrLabel: T.fmt.pct(res.conf), mark: res.fireAge != null ? Math.round(res.fireAge * 10) / 10 : null, markLabel: res.fireAge != null ? T.fmt.n1(res.fireAge) : "" }));
    const c2 = h("div.card", h("h2", "Patrimonio nel tempo, smettendo a " + res.chosen + " anni"), h("p.sub", "Linea blu: scenario mediano. Fasce: meta' e 80% degli scenari. Tratteggio rosso: 1 scenario su 10 va peggio. Importi in moneta di oggi."));
    out.appendChild(c2);
    c2.appendChild(T.fanChart(c2, res.bands, { retire: res.chosen }));
    c2.appendChild(h("div.small.muted", "Successo smettendo a " + res.chosen + " anni: " + T.fmt.pct(res.successChosen) + (F.strategy === "guardrail" ? ". Con i guardrail, nel 10% degli scenari peggiori la spesa scende fino al " + T.fmt.pct(1 - res.worstCut) + " del previsto." : ".")));
    out.appendChild(h("p.small.muted", res.sims + " scenari ricampionando a blocchi di " + F.blockLen + " anni le sequenze storiche reali (" + res.profile + "). E' una stima, non una consulenza finanziaria."));
  };
  draw();

  /* parametri */
  const set = (k, v) => { F[k] = v; A.fire.key = ""; A.save(); clearTimeout(A._ft); A._ft = setTimeout(draw, 500); };
  const pct = (label, k, hint, step) => T.numField(label + " (%)", F[k] == null ? "" : +(F[k] * 100).toFixed(2), v => set(k, v == null ? 0 : v / 100), { step: step || 0.1, hint });
  const box = h("div.card", h("h2", "I tuoi numeri"));
  const acc = (title, open, ...kids) => h("details.acc", { open: open ? "" : null }, h("summary", title), h("div.acc-in", kids));
  const y0 = new Date().getFullYear();
  box.appendChild(acc("Situazione di oggi", !F.birthYear,
    T.numField("Anno di nascita", F.birthYear, v => set("birthYear", v), { min: 1930, max: y0 - 16, step: 1 }),
    T.numField("Patrimonio investito", F.investable, v => set("investable", v || 0), { hint: "Azioni, ETF, fondi. Puoi includere il 3a se e' investito." }),
    T.numField("Liquidita' e risparmi", F.cash, v => set("cash", v || 0), { hint: "Conti, depositi, fondo emergenze." }),
    pct("Quota in azioni", "equityShare", "Il resto rende come la parte prudente.", 5),
    T.selectField("Mercato di riferimento", F.market, Object.entries(T.MARKET_PROFILES).map(([k, p]) => [k, p.label]), v => set("market", v)),
    pct("Rendimento parte prudente", "safeReturn", "Obbligazioni o conto deposito, al lordo dell'inflazione."),
    pct("Inflazione", "inflation")));
  const spendBox = h("div");
  const fillSpend = () => {
    T.clear(spendBox);
    const pic = T.picture(S);
    spendBox.appendChild(h("div.lbl", "Spesa mensile in FIRE"));
    spendBox.appendChild(T.seg([["auto", "Come oggi (" + T.fmt.k(pic.now.total) + ")"], ["manuale", "Scelgo io"]], F.spendMode, v => { set("spendMode", v); fillSpend(); }));
    if (F.spendMode !== "auto") spendBox.appendChild(T.numField("Spesa al mese in moneta di oggi", F.spendFire, v => set("spendFire", v || 0)));
    spendBox.appendChild(h("div", { style: { blockSize: "12px" } }));
    spendBox.appendChild(h("div.lbl", "Risparmio mensile fino al FIRE"));
    spendBox.appendChild(T.seg([["auto", "Reddito meno spese"], ["manuale", "Scelgo io"]], F.savingMode, v => { set("savingMode", v); fillSpend(); }));
    if (F.savingMode !== "auto") spendBox.appendChild(T.numField("Risparmio investito al mese", F.monthlySaving, v => set("monthlySaving", v || 0)));
    spendBox.appendChild(pct("Crescita annua del risparmio, oltre l'inflazione", "savingGrowth"));
  };
  fillSpend();
  box.appendChild(acc("Spesa e risparmio", false, spendBox));
  const listEd = (arr, fields, addLabel, blank) => {
    const wrap = h("div");
    const fill = () => {
      T.clear(wrap);
      arr.forEach((it, i) => wrap.appendChild(h("div.grid2", { style: { alignItems: "end", borderBlockEnd: "1px solid var(--line)", paddingBlock: "8px" } },
        fields.map(([k, label, type]) => type === "text" ? T.textField(label, it[k], v => { it[k] = v; set("pensions", F.pensions); }) : T.numField(label, it[k], v => { it[k] = v || 0; set("pensions", F.pensions); })),
        h("button.btn.danger", { type: "button", onclick: () => { arr.splice(i, 1); set("pensions", F.pensions); fill(); } }, "Rimuovi"))));
      wrap.appendChild(h("button.btn", { type: "button", onclick: () => { arr.push(Object.assign({}, blank)); fill(); } }, addLabel));
    };
    fill(); return wrap;
  };
  box.appendChild(acc("Pensioni e capitali futuri", false,
    h("p.small.muted", "Rendite (pensione statale, cassa pensione) in moneta di oggi, dall'eta' indicata."),
    listEd(F.pensions, [["name", "Nome", "text"], ["age", "Dall'eta'"], ["monthly", "Al mese"]], "Aggiungi una rendita", { name: "Pensione", age: 65, monthly: 0 }),
    h("p.small.muted", { style: { marginBlockStart: "14px" } }, "Capitali che arrivano in un colpo (per esempio 2\u00b0 pilastro o 3a ritirati), al netto delle imposte."),
    listEd(F.lumps, [["name", "Nome", "text"], ["age", "A eta'"], ["amount", "Importo"]], "Aggiungi un capitale", { name: "Capitale", age: 60, amount: 0 })));
  box.appendChild(acc("Prelievo e prudenza", false,
    pct("Tasso di prelievo per il numero FIRE", "withdrawalRate", "3,5% e' prudente per orizzonti lunghi."),
    h("div.lbl", "Strategia di prelievo"),
    T.seg([["fisso", "Fisso"], ["guardrail", "Con guardrail"]], F.strategy, v => set("strategy", v)),
    h("p.small.muted", "Fisso: ogni anno prelevi la stessa spesa reale. Guardrail: se i mercati scendono molto tagli la spesa del " + T.fmt.pct(F.step) + ", se salgono molto la aumenti; mai sotto la soglia minima."),
    pct("Banda dei guardrail", "band", "", 5), pct("Taglio o aumento", "step", "", 5), pct("Spesa minima", "floor", "Quota della spesa prevista sotto cui non scendi.", 5),
    pct("Imposte medie sui prelievi", "taxRate"),
    T.numField("Il patrimonio deve durare fino a (eta')", F.endAge, v => set("endAge", v || 95), { step: 1 }),
    pct("Probabilita' di successo richiesta", "confidence", "", 1),
    T.numField("Numero di scenari", F.sims, v => set("sims", T.clamp(v || 2000, 200, 5000)), { step: 100, hint: "Di piu' = piu' preciso ma piu' lento." })));
  main.appendChild(box);
};
})();
