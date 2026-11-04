/* myFinances on FIRE · schermata FIRE */
"use strict";
(function () {
const h = T.h, A = T.A;

A.renderFire = main => {
  const S = A.S, F = S.fire;
  const out = h("div"); main.appendChild(out);
  const yearNow = new Date().getFullYear();
  let pick = null;   /* eta' letta sul grafico del patrimonio */
  /* parte che cambia con l'eta' scelta: indicatore, riquadri, grafici */
  const dyn = h("div");
  const drawDyn = res => {
    T.clear(dyn);
    const z = T.fireZone(res.successChosen), conf = res.conf;
    /* probabilita' di riuscita */
    const g = h("div.card#gaugeCard", h("h2", T.tr("Probabilita' di riuscita")),
      h("p.sub", T.tr("Ritiro a {a} anni. Il capitale deve durare fino al {y}, quando avrai {e} anni.", { a: res.chosen, y: yearNow + res.endAge - res.age, e: res.endAge })),
      h("div", { style: { display: "flex", justifyContent: "center" } }, T.gauge(res.successChosen, z.name)),
      h("div.zones", T.FIRE_ZONES.map((x, i) => h("span.zone.z" + (i + 1) + (x === z ? ".on" : ""), T.tr(x.name)))),
      h("p.zone-text", h("b", T.tr(z.name) + ". "), T.tr(z.text)));
    if (z !== T.FIRE_ZONES[4]) g.appendChild(h("p.small.muted", T.tr("Il 100% non e' l'obiettivo: la fascia sana e' fra l'85% e il 95%.")));
    dyn.appendChild(g);
    /* quattro riquadri */
    const ageYear = a => a == null ? T.tr("oltre i {a}", { a: res.maxR }) : T.tr("{a} anni ({y})", { a, y: yearNow + a - res.age });
    const fa = res.firstAt;
    dyn.appendChild(h("div.kpis.tiles#fireTiles",
      T.kpi(T.tr("Prima eta' con almeno il {p}", { p: T.fmt.pct(conf) }), ageYear(fa.conf), T.tr("all'80% gia' a {a}, al 95% a {b}", { a: fa[80] != null ? fa[80] : "-", b: fa[95] != null ? fa[95] : "-" })),
      T.kpi(T.tr("Arrivo mediano"), fa[50] != null ? String(yearNow + fa[50] - res.age) : "-", fa[50] != null ? T.tr("a {a} anni, nella meta' degli scenari", { a: fa[50] }) : ""),
      T.kpi(T.tr("Spesa media in pensione"), A.money(res.spendRetired), F.strategy === "guardrail" ? T.tr("al mese, mediana, con guardrail e rendite") : T.tr("al mese, mediana, con le rendite")),
      T.kpi(T.tr("Capitale residuo"), A.moneyK(res.residual), T.tr("mediana a {a} anni, in moneta di oggi", { a: res.endAge }))));
    dyn.appendChild(h("div", { style: { blockSize: "12px" } }));
    /* probabilita' per eta': tocca per scegliere l'eta' */
    const c1 = h("div.card#probCard", h("h2", T.tr("Probabilita' per eta' di ritiro")), h("p.sub", T.tr("Tocca il grafico per scegliere l'eta': il cursore si sposta. Quota di scenari in cui il patrimonio basta fino a {e} anni.", { e: res.endAge })));
    dyn.appendChild(c1);
    c1.appendChild(T.lineChart(c1, res.ages, res.prob, { thr: conf, thrLabel: T.fmt.pct(conf), mark: res.fireAge != null && Math.round(res.fireAge) !== res.chosen ? Math.round(res.fireAge * 10) / 10 : null, markLabel: res.fireAge != null ? T.tr("stima {n}", { n: T.fmt.n1(res.fireAge) }) : "",
      sel: res.chosen, selLabel: T.tr("{a} anni", { a: res.chosen }) + " \u00b7 " + T.fmt.pct(res.successChosen), onClick: a => setAge(a) }));
    /* patrimonio nel tempo: tocca per leggere i valori */
    const c2 = h("div.card#fanCard", h("h2", T.tr("Patrimonio nel tempo, smettendo a ") + res.chosen + T.tr(" anni~eta")), h("p.sub", T.tr("Tocca il grafico per leggere i valori a una certa eta'. Linea verde: scenario mediano. Fasce: meta' e 80% degli scenari. Tratteggio rosso: 1 scenario su 10 va peggio. Importi in moneta di oggi.")));
    dyn.appendChild(c2);
    const fanBox = h("div"), read = h("div.readout");
    c2.appendChild(fanBox); c2.appendChild(read);
    const showPick = a => {
      pick = a; T.clear(fanBox); fanBox.appendChild(T.fanChart(c2, res.bands, { retire: res.chosen, pick: a, onPick: showPick }));
      const b = res.bands.find(x => x.age === a) || res.bands[0];
      T.clear(read); T.add(read, [h("b", T.tr("A {a} anni ({y})", { a: b.age, y: yearNow + b.age - res.age })),
        h("div.readout-row", h("span", h("i.dot", { style: { background: "var(--brand2)" } }), T.tr("mediana {v}", { v: A.money(b.p50) })),
          h("span", h("i.dot", { style: { background: "var(--bad)" } }), T.tr("1 su 10 sotto {v}", { v: A.money(b.p10) })),
          h("span", h("i.dot", { style: { background: "var(--fan2)" } }), T.tr("1 su 10 sopra {v}", { v: A.money(b.p90) })))]);
    };
    showPick(pick != null && pick >= res.age && pick <= res.endAge ? pick : res.chosen);
    c2.appendChild(h("div.small.muted", { style: { marginBlockStart: "8px" } }, T.tr("Successo smettendo a ") + res.chosen + T.tr(" anni: ") + T.fmt.pct(res.successChosen) + (F.strategy === "guardrail" ? T.tr(". Con i guardrail, nel 10% degli scenari peggiori la spesa scende fino al ") + T.fmt.pct(1 - res.worstCut) + T.tr(" del previsto.") : ".")));
    /* dove sei */
    dyn.appendChild(h("div.card", h("h2", T.tr("Dove sei")),
      h("div.ring-wrap", T.ring(res.progress, T.fmt.pct(res.progress), T.tr("del numero FIRE"), "var(--brand2)"),
        h("div", h("div.small.muted", T.tr("Numero FIRE")), h("div.big", A.money(res.fireNumber)), h("div.small.muted", T.tr("spesa annua / ") + T.fmt.pct1(F.withdrawalRate)))),
      h("div.kpis", { style: { marginBlockStart: "12px" } },
        T.kpi(T.tr("Patrimonio oggi"), A.money(res.W0), T.tr("investito + liquidita'")),
        T.kpi(T.tr("Spesa in FIRE"), A.money(res.spend), F.spendMode === "auto" ? T.tr("al mese, come oggi") : T.tr("al mese, scelta da te")),
        T.kpi(T.tr("Risparmio"), A.money(res.saving), F.savingMode === "auto" ? T.tr("al mese, reddito meno spese") : T.tr("al mese, scelto da te")),
        T.kpi(T.tr("Eta' stimata"), res.fireAge != null ? T.fmt.n1(res.fireAge) + T.tr(" anni") : T.tr("oltre i {a}", { a: res.maxR }), T.tr("con ") + T.fmt.pct(conf) + T.tr(" di probabilita'")))));
    dyn.appendChild(h("p.small.muted", res.sims + T.tr(" scenari ricampionando a blocchi di ") + F.blockLen + T.tr(" anni le sequenze storiche reali (") + T.tr(res.profile) + T.tr("). E' una stima, non una consulenza finanziaria.")));
  };
  /* cursore dell'eta' di ritiro */
  let slider = null, ageLbl = null, yearLbl = null, workLbl = null, remind = null, resetBox = null, dynT = null;
  const fillAgeTexts = (res, a) => {
    ageLbl.textContent = T.tr("{a} anni", { a }); yearLbl.textContent = T.tr("nel {y}", { y: yearNow + a - res.age });
    const n = a - res.age;
    workLbl.textContent = n <= 0 ? T.tr("Smetti quest'anno: da subito vivi del patrimonio.") : n === 1 ? T.tr("Ancora 1 anno di lavoro e di versamenti.") : T.tr("Ancora {n} anni di lavoro e di versamenti.", { n });
    T.clear(remind);
    const items = [];
    for (const p of F.pensions || []) if (+p.monthly > 0) items.push([+p.age, T.tr("{n} parte a {a} anni ({v} al mese)", { n: p.name || T.tr("Rendita"), a: p.age, v: A.money(+p.monthly) })]);
    for (const l of F.lumps || []) if (+l.amount) items.push([+l.age, T.tr("{n} arriva a {a} anni ({v})", { n: l.name || T.tr("Capitale"), a: l.age, v: A.money(+l.amount) })]);
    items.sort((x, y) => x[0] - y[0]).forEach(([ag, t]) => remind.appendChild(h("li", { class: ag <= a ? "past" : "" }, t)));
    T.clear(resetBox);
    if (F.retireAge != null && F.retireAge !== "") resetBox.appendChild(h("button.btn", { type: "button", onclick: () => { F.retireAge = null; A.save(); draw(); } }, T.tr("Torna all'eta' stimata ({a})", { a: A.fire.base.target })));
    else resetBox.appendChild(h("div.small.muted", T.tr("E' l'eta' stimata con il {p} di probabilita'. Sposta il cursore per provarne un'altra.", { p: T.fmt.pct(res.conf) })));
  };
  const setAge = a => { F.retireAge = a; A.save(); draw(); };
  const draw = () => {
    T.clear(out);
    if (!F.birthYear) { out.appendChild(h("div.note.warn", T.tr("Inserisci almeno l'anno di nascita e il patrimonio investito qui sotto."))); return; }
    const res = A.fireResult(() => { if (A.view === "fire") draw(); });
    if (!res) { out.appendChild(h("div.card", h("div.row", h("span.spinner"), h("span.muted", T.tr("Simulazione di ") + (F.sims || 2000) + T.tr(" scenari..."))))); return; }
    ageLbl = h("div.big"); yearLbl = h("div.small.muted"); workLbl = h("p", { style: { margin: "8px 0 4px", fontWeight: 600 } }); remind = h("ul.remind"); resetBox = h("div", { style: { marginBlockStart: "8px" } });
    slider = h("input.range#retireAge", { type: "range", min: res.age, max: res.maxR, step: 1, value: res.chosen, "aria-label": T.tr("Eta' in cui smetti di lavorare") });
    const onMove = () => {
      const a = +slider.value;
      F.retireAge = a; fillAgeTexts(res, a);
      clearTimeout(dynT); dynT = setTimeout(() => drawDyn(A.fireView(a)), 120);
    };
    slider.addEventListener("input", onMove);
    slider.addEventListener("change", () => { onMove(); A.save(); });
    out.appendChild(h("div.card#retireCard", h("h2", T.tr("Quando smetto di lavorare")),
      h("div.row.between", { style: { alignItems: "flex-end" } }, h("div", ageLbl, yearLbl), h("div.small.muted", { style: { textAlign: "end" } }, T.tr("oggi hai {a} anni", { a: res.age }))),
      slider, h("div.row.between.small.muted", h("span", String(res.age)), h("span", String(res.maxR))),
      workLbl, remind, resetBox));
    fillAgeTexts(res, res.chosen);
    out.appendChild(dyn);
    drawDyn(res);
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
  /* nella famiglia i numeri del FIRE li gestisce chi l'ha creata: gli altri li vedono */
  if (A.isMember()) {
    const fsx = h("fieldset.plain", { disabled: true });
    while (box.children.length > 1) fsx.appendChild(box.children[1]);
    box.appendChild(h("div.note", { style: { marginBlockEnd: "8px" } }, T.tr("I numeri del FIRE li gestisce {n}: qui li vedi ma non li cambi. Il cursore dell'eta' resta libero per le tue prove.", { n: A.masterName() })));
    box.appendChild(fsx);
  }
  main.appendChild(box);
};
})();
