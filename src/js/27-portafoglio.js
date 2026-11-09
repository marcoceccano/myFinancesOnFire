/* myFinances on FIRE · schermata Portafoglio (Interactive Brokers), riquadro in Home, configurazione e legame con il FIRE */
"use strict";
(function () {
const h = T.h, A = T.A;
const PALETTE = ["#2F5D46", "#C4623F", "#D99A2B", "#8DB596", "#7A4E6D", "#4F7C8A", "#B5739D", "#9C7A4D", "#5C6B8A"];
/* importi del portafoglio nella valuta dell'app (o in quella del conto se manca il cambio) */
A.pm = v => { const S = A.S, r = T.pfRate(S); return r ? A.money(v * r) : T.fmt.n0(v) + " " + S.portfolio.base; };
A.pmK = v => { const S = A.S, r = T.pfRate(S); return r ? T.fmt.k(v * r) + " " + T.fmt.cur : T.fmt.k(v) + " " + S.portfolio.base; };
const sign = v => (v > 0 ? "+" : v < 0 ? "\u2212" : "") ;
const pctTxt = v => sign(v) + (Math.abs(v) < 0.01 ? T.fmt.n2(Math.abs(v) * 100) + "%" : T.fmt.pct1(Math.abs(v)));
const typeName = k => T.tr(T.PF_TYPES[k] || T.PF_TYPES.OTHER);
const groupName = (by, g) => by === "tipo" ? typeName(g.k) : g.k === "__cash" ? T.tr("Liquidita'") : by === "valuta" ? g.k : (g.items[0] && g.items[0].sym) || g.k;

/* aggiornamento: manuale o automatico (al massimo ogni 12 ore, i report sono di fine giornata) */
A.pfSync = async silent => {
  const S = A.S;
  if (A._pfBusy) return; A._pfBusy = true; if (!silent) A.render();
  try {
    const rep = await T.ibkrSync(S);
    A.fire.key = ""; await T.save(S, true);
    if (!silent) T.toast(T.tr("Portafoglio aggiornato: dati al {d}", { d: T.fmt.date(rep.date) }));
    if (A.inFamily && A.inFamily()) A.famSoon(300);
  } catch (e) {
    S.portfolio = S.portfolio || T.pfDefaults(); S.portfolio.lastError = e.message; S.portfolio.lastTry = new Date().toISOString(); A.save();
    if (!silent) T.sheet(T.tr("Interactive Brokers"), h("p", e.message), [h("button.btn.primary", { type: "button", onclick: () => T.closeSheet() }, "Ok")]);
  } finally { A._pfBusy = false; if (A.view === "fire" || A.view === "portafoglio" || A.view === "home" || (A.view === "altro" && A.sub === "ibkr")) A.render(); }
};
A.pfAutoSync = () => {
  const S = A.S, P = S && S.portfolio;
  if (!P || !P.auto || A._pfBusy || !S.bank || !S.bank.url || !S.bank.token) return;
  const last = Math.max(P.lastSync ? Date.parse(P.lastSync) : 0, P.lastTry ? Date.parse(P.lastTry) : 0);
  if (last && Date.now() - last < 12 * 3600e3) return;
  if (!P.lastSync && !P.date) return;   /* prima volta: solo dal pulsante */
  A.pfSync(true);
};

/* collega al FIRE: il patrimonio investito diventa "altri investimenti + Interactive Brokers" */
A.pfLinkFlow = () => {
  const S = A.S, F = S.fire, nav = T.pfNavApp(S), cur = +F.investable || 0;
  const done = other => { F.investableOther = Math.max(0, Math.round(other)); F.ibkrLink = true; T.pfSyncFire(S); A.fire.key = ""; A.save(); T.closeSheet(); T.toast(T.tr("Il FIRE usa ora il valore di Interactive Brokers")); A.render(); };
  if (!cur) return done(0);
  T.sheet(T.tr("Collega al FIRE"), h("div",
    h("p", T.tr("Nel FIRE avevi inserito un patrimonio investito di {a}. Interactive Brokers vale oggi {b}.", { a: A.money(cur), b: A.money(nav) })),
    h("p", h("b", T.tr("Quel valore comprende gia' Interactive Brokers?"))),
    h("p.small.muted", T.tr("Da ora in poi il FIRE somma da solo il valore aggiornato di Interactive Brokers agli altri investimenti (per esempio azioni del datore di lavoro, 3a investito)."))),
    [h("button.btn", { type: "button", onclick: () => done(cur) }, T.tr("No, va aggiunto")),
     h("button.btn.primary", { type: "button", onclick: () => done(cur - nav) }, T.tr("Si', e' gia' compreso"))]);
};
A.pfUnlink = () => { const F = A.S.fire; F.investable = Math.round(T.investableNow(A.S)); F.ibkrLink = false; A.fire.key = ""; A.save(); T.toast(T.tr("Il FIRE usa di nuovo il valore inserito a mano")); A.render(); };

/* il portafoglio sta dentro la voce FIRE */
A.openPf = () => { A.ui.fireTab = "portafoglio"; A.go("fire"); };

/* ---------- riquadro in Home ---------- */
A.pfHomeCard = main => {
  const S = A.S, P = S.portfolio; if (!T.pfHas(S)) return;
  const se = T.pfSeries(P, "1M"), go = () => A.openPf();
  const card = h("div.card.tapcard#pfCard", { role: "button", tabindex: "0", "aria-label": T.tr("Apri il portafoglio"), onclick: go, onkeydown: e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } } },
    h("div.row.between", h("h2", { style: { margin: 0 } }, T.tr("Portafoglio")), h("span.chev", { "aria-hidden": "true" }, "\u203a")),
    h("div.row.between", { style: { alignItems: "flex-end", marginBlockStart: "6px" } },
      h("div", h("div.big", A.pm(P.nav)), h("div.small.muted", T.tr("Interactive Brokers, dati al {d}", { d: T.fmt.date(P.date) }))),
      se.pts.length > 1 ? h("div", { style: { textAlign: "end" } }, h("div.mid" + (se.ret >= 0 ? ".ok" : ".bad"), pctTxt(se.ret)), h("div.small.muted", T.tr("in 1 mese"))) : null));
  if (P.lastError) card.appendChild(h("div.small.bad", { style: { marginBlockStart: "6px" } }, P.lastError));
  main.appendChild(card);
};

/* ---------- grafico Valore / Rendimento con gli orizzonti ---------- */
A.pfPerfCard = main => {
  const S = A.S, P = S.portfolio, ui = A.ui;
  const mode = ui.pfMode || "valore", hz = ui.pfHz || "1A";
  const se = T.pfSeries(P, hz), up = (mode === "rend" ? se.ret : se.abs) >= 0;
  const hzName = T.tr((T.PF_HORIZONS.find(x => x[0] === hz) || T.PF_HORIZONS[6])[1]);
  const acc = (P.accounts || []).filter(Boolean).map(a => a.length > 4 ? "\u2022\u2022\u2022" + a.slice(-4) : a).join(", ");
  const card = h("div.card#pfPerf");
  card.appendChild(h("div.row.between", { style: { alignItems: "flex-start", gap: "10px" } },
    h("div", h("div.small.muted", "Interactive Brokers" + (acc ? " \u00b7 " + acc : "")), h("div.big", A.pm(P.nav)), h("div.small.muted", T.tr("dati al {d} \u00b7 aggiornato {t}", { d: T.fmt.date(P.date), t: A.relTime(P.lastSync) }))),
    h("div.seg.mini", { role: "group" }, [["valore", T.tr("Valore")], ["rend", T.tr("Rendimento")]].map(([k, l]) => h("button", { type: "button", class: k === mode ? "on" : "", "aria-pressed": k === mode ? "true" : "false", onclick: () => { ui.pfMode = k; A.render(); } }, l)))));
  if (se.pts.length > 1) {
    const big = mode === "rend" ? pctTxt(se.ret) : sign(se.abs) + A.pm(Math.abs(se.abs));
    const small = mode === "rend" ? sign(se.abs) + A.pm(Math.abs(se.abs)) + T.tr(" di valore") : pctTxt(se.abs / (se.pts[0].v || 1));
    card.appendChild(h("div.pf-ret", h("span.arrow" + (up ? ".ok" : ".bad"), { "aria-hidden": "true" }, up ? "\u2191" : "\u2193"),
      h("div", h("div.small.muted", (mode === "rend" ? T.tr("Rendimento") : T.tr("Variazione del valore")) + " (" + hzName + ")"), h("div.mid" + (up ? ".ok" : ".bad"), big, h("span.small.muted", { style: { fontWeight: 400, marginInlineStart: "8px" } }, small)))));
  }
  const box = h("div"), read = h("div.readout");
  const draw = pick => {
    T.clear(box); box.appendChild(T.perfChart(card, se.pts, { mode, pick, onPick: draw, label: T.tr("Portafoglio nel tempo") }));
    T.clear(read); if (!se.pts.length) return;
    const p = pick || se.pts[se.pts.length - 1];
    T.add(read, [h("b", T.fmt.date(p.d)), " \u00b7 " + A.pm(p.v) + " \u00b7 ", h("span", { class: p.r >= 0 ? "ok" : "bad" }, pctTxt(p.r)), T.tr(" dal {d}", { d: T.fmt.date(se.from) })]);
  };
  card.appendChild(box); card.appendChild(read); draw(null);
  card.appendChild(h("div.chips.hz", { role: "group", "aria-label": T.tr("Orizzonte") }, T.PF_HORIZONS.map(([k, l]) => h("button.chip" + (k === hz ? ".on" : ""), { type: "button", onclick: () => { ui.pfHz = k; A.render(); } }, T.tr(l)))));
  /* quanto storico c'e': aiuta a capire se la Flex Query manda tutti i giorni */
  if (se.n) card.appendChild(h("p.small.muted#pfHist", { style: { margin: "8px 0 0" } }, se.n === 1
    ? T.tr("Storico: 1 giorno ({d}).", { d: T.fmt.date(se.first) })
    : T.tr("Storico: {n} giorni, dal {a} al {b}.", { n: se.n, a: T.fmt.date(se.first), b: T.fmt.date(se.last) })));
  if (se.n && se.n < 5) card.appendChild(h("div.note#pfHistHint", { style: { marginBlockStart: "8px" } },
    T.tr("Il report di Interactive Brokers contiene pochi giorni. Nella Flex Query imposta Period su Last 365 Calendar Days e includi la sezione Net Asset Value (NAV) in Base, poi premi Aggiorna. Lo storico cresce comunque da solo a ogni aggiornamento.")));
  card.appendChild(h("p.small.muted", { style: { margin: "8px 0 0" } }, se.twr
    ? T.tr("Il rendimento e' ponderato nel tempo (TWR): versamenti e prelievi non contano come guadagni o perdite.")
    : T.tr("Il rendimento e' calcolato sul valore del conto: se nel periodo hai versato o prelevato, aggiungi Deposits & Withdrawals alla Flex Query per toglierli.")));
  main.appendChild(card);
};

/* ---------- schermata ---------- */
A.renderPortafoglio = (main, embedded) => {
  const S = A.S, P = S.portfolio;
  if (!embedded) main.appendChild(h("button.btn.ghost", { type: "button", onclick: () => history.length > 1 ? history.back() : A.go("home") }, T.tr("\u2039 Indietro")));
  if (!T.pfHas(S)) {
    main.appendChild(h("div.card", h("h2", T.tr("Portafoglio")), h("p", T.tr("Collega Interactive Brokers per vedere qui posizioni, ripartizione, andamento e dividendi, e per aggiornare da solo il patrimonio del FIRE.")),
      h("button.btn.primary.block", { type: "button", onclick: () => A.go("altro", "ibkr") }, T.tr("Configura Interactive Brokers"))));
    return;
  }
  const rate = T.pfRate(S), td = T.today();
  /* valore e rendimento nel tempo */
  A.pfPerfCard(main);
  /* numeri chiave */
  const pnl = T.sum(P.positions.map(p => p.pnl)), cost = T.sum(P.positions.map(p => p.cost));
  const div12 = T.sum(T.pfDivMonths(P, td).map(m => m.v));
  const top = h("div.card#pfValue",
    h("div.kpis.k4", h("div.kpi", h("div.l", T.tr("Guadagno non realizzato")), h("div.v" + (pnl >= 0 ? ".ok" : ".bad"), sign(pnl) + A.pm(Math.abs(pnl))), h("div.s", cost ? pctTxt(pnl / cost) + T.tr(" sul costo") : "")),
      h("div.kpi", h("div.l", T.tr("Liquidita'")), h("div.v", A.pm(P.cash)), h("div.s", T.fmt.pct1(P.cash / (P.nav || 1)) + T.tr(" del portafoglio"))),
      h("div.kpi", h("div.l", T.tr("Dividendi")), h("div.v", A.pm(div12)), h("div.s", T.tr("netti, ultimi 12 mesi"))),
      h("div.kpi", h("div.l", T.tr("Posizioni")), h("div.v", String(P.positions.length)), h("div.s", T.tr("titoli aperti")))),
    h("div.row.wrap", { style: { marginBlockStart: "10px" } }, h("button.btn", { type: "button", disabled: !!A._pfBusy, onclick: () => A.pfSync(false) }, A._pfBusy ? T.tr("Aggiornamento...") : T.tr("Aggiorna"))));
  if (!rate) top.appendChild(h("div.note.warn", { style: { marginBlockStart: "8px" } }, T.tr("Manca il cambio {c} in Profilo e reddito: gli importi sono in {c}.", { c: P.base })));
  if (P.lastError) top.appendChild(h("div.note.warn", { style: { marginBlockStart: "8px" } }, P.lastError));
  main.appendChild(top);

  /* ripartizione */
  const by = A.ui.pfBy || "titolo";
  const groups = T.pfGroups(S, by), tot = T.sum(groups.map(g => g.v)) || 1;
  const shown = groups.slice(0, 8), rest = groups.slice(8);
  if (rest.length) shown.push({ k: "__altri", v: T.sum(rest.map(g => g.v)), items: rest.flatMap(g => g.items), rest });
  const col = i => PALETTE[i % PALETTE.length];
  const openGroup = g => {
    if (g.k === "__cash") return A.groupSheet(T.tr("Liquidita'"), [], P.cash);
    if (by === "titolo" && g.k !== "__altri" && g.items.length === 1) return A.posSheet(g.items[0]);
    return A.groupSheet(g.k === "__altri" ? T.tr("Altri") : groupName(by, g), g.items, g.cash ? P.cash : 0);
  };
  const c1 = h("div.card#pfAlloc", h("h2", T.tr("Ripartizione")),
    T.seg([["titolo", T.tr("Per titolo")], ["tipo", T.tr("Per tipo")], ["valuta", T.tr("Per valuta")]], by, v => { A.ui.pfBy = v; A.render(); }));
  c1.appendChild(h("div", { style: { display: "flex", justifyContent: "center", marginBlockStart: "10px" } },
    T.donut(shown.map((g, i) => ({ v: g.v, c: g.k === "__cash" || g.k === "CASH" ? T.FIXED_COLOR : col(i), n: g.k === "__altri" ? T.tr("Altri") : groupName(by, g), onClick: () => openGroup(g) })), A.pmK(P.nav), T.tr("totale"))));
  const list = h("div.list");
  shown.forEach((g, i) => list.appendChild(h("div.li.tap", { onclick: () => openGroup(g) }, h("i.dot", { style: { background: g.k === "__cash" || g.k === "CASH" ? T.FIXED_COLOR : col(i) } }),
    h("div.grow", h("div.row.between", h("span.t", g.k === "__altri" ? T.tr("Altri") : groupName(by, g)), h("b", T.fmt.pct1(g.v / tot))), T.progress(g.v, tot, g.k === "__cash" || g.k === "CASH" ? T.FIXED_COLOR : col(i)),
      h("div.d", A.pm(g.v) + (by === "titolo" && g.items[0] && g.k !== "__altri" ? " \u00b7 " + g.items[0].desc : by !== "titolo" ? " \u00b7 " + g.items.length + (g.items.length === 1 ? T.tr(" posizione") : T.tr(" posizioni")) : ""))))));
  c1.appendChild(list);
  main.appendChild(c1);

  /* posizioni */
  const c3 = h("div.card#pfPos", h("h2", T.tr("Posizioni")));
  const pl = h("div.list");
  for (const p of P.positions) {
    const pp = p.cost ? p.pnl / p.cost : null;
    pl.appendChild(h("div.li.tap", { onclick: () => A.posSheet(p) },
      h("div.grow", h("div.t", p.sym + " \u00b7 " + p.desc), h("div.d", T.fmt.n2(p.qty).replace(/[.,]00$/, "") + " \u00d7 " + T.fmt.n2(p.price) + " " + p.cur + " \u00b7 " + T.fmt.pct1(p.value / (P.nav || 1)))),
      h("div", { style: { textAlign: "end" } }, h("div.a", A.pm(p.value)), pp != null ? h("div.small" + (pp >= 0 ? ".ok" : ".bad"), pctTxt(pp)) : null)));
  }
  if (!P.positions.length) pl.appendChild(h("div.empty", T.tr("Nessuna posizione aperta")));
  c3.appendChild(pl); main.appendChild(c3);

  /* dividendi */
  if ((P.divs || []).length) {
    const months = T.pfDivMonths(P, td), y12 = T.sum(months.map(m => m.v));
    const c4 = h("div.card#pfDiv", h("h2", T.tr("Dividendi")), h("p.sub", T.tr("Netti, dopo le ritenute alla fonte. Ultimi 12 mesi: {v}.", { v: A.pm(y12) })));
    c4.appendChild(T.columns(c4, months.map(m => ({ l: T.fmt.monthShort(m.mk), title: T.fmt.month(m.mk), parts: [{ v: m.v, c: "var(--accent)" }] })), { h: 150 }));
    const bySym = {}; for (const d of P.divs) if (d.d >= T.addDays(td, -365)) bySym[d.sym || "?"] = (bySym[d.sym || "?"] || 0) + d.amt;
    c4.appendChild(h("div.list", Object.entries(bySym).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => h("div.li", h("div.grow", h("div.t", k)), h("div.a", A.pm(v))))));
    main.appendChild(c4);
  }

  /* nel FIRE */
  const F = S.fire, member = A.isMember && A.isMember();
  const c5 = h("div.card#pfFire", h("h2", T.tr("Nel FIRE")));
  if (F.ibkrLink) {
    c5.appendChild(h("p", T.tr("Il patrimonio investito del FIRE si aggiorna da solo: {o} di altri investimenti + {i} di Interactive Brokers = {t}.", { o: A.money(+F.investableOther || 0), i: A.money(T.pfNavApp(S)), t: A.money(T.investableNow(S)) })));
    if (!member) c5.appendChild(h("button.btn", { type: "button", onclick: () => A.pfUnlink() }, T.tr("Scollega dal FIRE")));
  } else {
    c5.appendChild(h("p", T.tr("Il FIRE usa ancora il patrimonio inserito a mano ({v}).", { v: A.money(+F.investable || 0) })));
    if (!member) c5.appendChild(h("button.btn.primary", { type: "button", onclick: () => A.pfLinkFlow() }, T.tr("Collega al FIRE")));
  }
  if (member) c5.appendChild(h("p.small.muted", T.tr("Il FIRE lo gestisce {n}.", { n: A.masterName() })));
  const eq = T.sum(P.positions.filter(p => p.type === "ETF" || p.type === "STK" || p.type === "FUND").map(p => p.value)) / (P.nav || 1);
  c5.appendChild(h("p.small.muted", T.tr("Azioni, ETF e fondi sono il {p} del conto (nel FIRE la quota in azioni e' {q}). Gli ETF obbligazionari contano qui come ETF.", { p: T.fmt.pct(eq), q: T.fmt.pct(+F.equityShare || 0) })));
  main.appendChild(c5);
};

/* foglio di una posizione */
A.posSheet = p => {
  const S = A.S, P = S.portfolio, pp = p.cost ? p.pnl / p.cost : null;
  const row = (l, v) => h("div.row.between", { style: { paddingBlock: "6px", borderBlockEnd: "1px solid var(--line)" } }, h("span.muted", l), h("b", v));
  T.sheet(p.sym, h("div",
    h("p.muted", p.desc),
    h("div.big", A.pm(p.value)), h("div.small.muted", T.fmt.pct1(p.value / (P.nav || 1)) + T.tr(" del portafoglio")),
    h("div", { style: { marginBlockStart: "12px" } },
      row(T.tr("Quantita'"), T.fmt.n2(p.qty).replace(/[.,]00$/, "")),
      row(T.tr("Prezzo"), T.fmt.n2(p.price) + " " + p.cur),
      row(T.tr("Valore in {c}", { c: p.cur }), T.fmt.n0(p.valueLoc) + " " + p.cur),
      p.cost ? row(T.tr("Costo di acquisto"), A.pm(p.cost)) : null,
      p.cost ? row(T.tr("Guadagno non realizzato"), h("span", { class: p.pnl >= 0 ? "ok" : "bad" }, sign(p.pnl) + A.pm(Math.abs(p.pnl)) + (pp != null ? " (" + pctTxt(pp) + ")" : ""))) : null,
      row(T.tr("Tipo"), typeName(p.type)),
      p.isin ? row("ISIN", p.isin) : null,
      p.exch ? row(T.tr("Borsa"), p.exch) : null)),
    [h("button.btn.primary", { type: "button", onclick: () => T.closeSheet() }, T.tr("Chiudi"))]);
};
/* foglio di un gruppo (tipo, valuta, altri) */
A.groupSheet = (title, items, cash) => {
  const tot = T.sum(items.map(p => p.value)) + (cash || 0);
  const body = h("div", h("div.big", A.pm(tot)));
  const list = h("div.list");
  items.slice().sort((a, b) => b.value - a.value).forEach(p => list.appendChild(h("div.li.tap", { onclick: () => A.posSheet(p) }, h("div.grow", h("div.t", p.sym + " \u00b7 " + p.desc), h("div.d", T.fmt.pct1(p.value / (tot || 1)))), h("div.a", A.pm(p.value)))));
  if (cash) list.appendChild(h("div.li", h("div.grow", h("div.t", T.tr("Liquidita'"))), h("div.a", A.pm(cash))));
  body.appendChild(list);
  T.sheet(title, body, [h("button.btn.primary", { type: "button", onclick: () => T.closeSheet() }, T.tr("Chiudi"))]);
};

/* ---------- Altro > Interactive Brokers ---------- */
A.renderIbkr = card => {
  const S = A.S, P = S.portfolio, B = S.bank, member = A.isMember && A.isMember();
  card.appendChild(h("h2", T.tr("Interactive Brokers")));
  card.appendChild(h("p.sub", T.tr("Posizioni, liquidita', valore nel tempo e dividendi dal report Flex di Interactive Brokers, in sola lettura. Il token resta nel tuo ponte. La guida completa e' nel file GUIDA-INTERACTIVE-BROKERS.md.")));
  if (T.pfHas(S)) card.appendChild(h("div.note" + (P.lastError ? ".warn" : ""), h("b", T.tr("Collegato")), h("div", T.tr("Dati al {d}, aggiornato {t}", { d: T.fmt.date(P.date), t: A.relTime(P.lastSync) })), P.lastError ? h("div.bad", P.lastError) : null));
  else if (P && P.lastError) card.appendChild(h("div.note.warn", P.lastError));
  if (!B.url || !B.token) { card.appendChild(h("div.note.warn", T.tr("Serve il ponte: configuralo prima in Collegamento automatico."))); return; }
  if (!member) {
    const steps = [
      [T.tr("1 \u00b7 Crea la Flex Query"), [T.tr("In Interactive Brokers: Performance & Reports, poi Flex Queries, poi + accanto a Activity Flex Query."),
        T.tr("Sezioni: Account Information, Open Positions (opzione Summary), Cash Report, Net Asset Value (NAV) in Base, Cash Transactions (Dividends, Withholding Tax, Payment In Lieu Of Dividends, Deposits & Withdrawals). In ciascuna scegli Select All."),
        T.tr("Formato XML, periodo Last 365 Calendar Days. Salva e annota il numero (Query ID).")]],
      [T.tr("2 \u00b7 Attiva il Flex Web Service"), [T.tr("Flex Queries, poi Flex Web Service Configuration: attivalo, scegli la scadenza piu' lunga, lascia vuoto il campo IP e genera il token."),
        T.tr("Il token scade: segna qui sotto la data, l'app ti avvisa 14 giorni prima.")]],
      [T.tr("3 \u00b7 Inseriscili nel ponte"), [T.tr("In Cloudflare, Worker del ponte, Settings, Variables and Secrets: IBKR_TOKEN (Secret) con il token e IBKR_QUERY_ID (Text) con il numero."),
        T.tr("Incolla il nuovo ponte/worker.js (versione 1.2.0) e premi Deploy.")]]];
    for (const [t, lines] of steps) card.appendChild(h("details.acc", { open: T.pfHas(S) ? null : "" }, h("summary", t), h("div.acc-in", lines.map(l => h("p.small", l)))));
    const tu = h("input", { type: "date", value: (P && P.tokenUntil) || "", "aria-label": T.tr("Il token scade il") });
    tu.addEventListener("change", () => { S.portfolio = S.portfolio || T.pfDefaults(); S.portfolio.tokenUntil = tu.value || null; A.save(); });
    card.appendChild(h("div.field", { style: { marginBlockStart: "12px" } }, h("label", T.tr("Il token scade il")), tu));
  }
  card.appendChild(h("div.row.wrap", { style: { marginBlockStart: "8px" } },
    h("button.btn.primary", { type: "button", disabled: !!A._pfBusy, onclick: async () => { S.portfolio = S.portfolio || T.pfDefaults(); await A.pfSync(false); } }, A._pfBusy ? T.tr("Scarico il report...") : T.pfHas(S) ? T.tr("Aggiorna ora") : T.tr("Scarica il portafoglio")),
    T.pfHas(S) ? h("button.btn", { type: "button", onclick: () => A.openPf() }, T.tr("Apri il portafoglio")) : null));
  if (A._pfBusy) card.appendChild(h("p.small.muted", T.tr("Interactive Brokers prepara il report: di solito servono da 5 a 20 secondi.")));
  if (P) {
    card.appendChild(h("label.row", { style: { marginBlock: "12px 4px" } }, h("input", { type: "checkbox", checked: P.auto !== false, onchange: e => { P.auto = e.target.checked; A.save(); } }), T.tr("Aggiorna da solo all'apertura (al massimo ogni 12 ore)")));
    if (!member && T.pfHas(S)) card.appendChild(h("button.btn.danger", { type: "button", style: { marginBlockStart: "8px" }, onclick: async () => {
      if (!(await T.confirm(T.tr("Togliere il portafoglio?"), T.tr("Posizioni e storico vengono cancellati dall'app. Il FIRE torna al valore inserito a mano. Il token resta nel ponte finche' non lo togli tu."), T.tr("Togli"), true))) return;
      if (S.fire.ibkrLink) { S.fire.investable = Math.round(T.investableNow(S)); S.fire.ibkrLink = false; }
      S.portfolio = null; A.fire.key = ""; A.save(); A.render();
    } }, T.tr("Togli il portafoglio")));
  }
};
})();
