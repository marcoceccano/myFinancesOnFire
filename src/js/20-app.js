/* myFinances on FIRE · applicazione: stato, navigazione, Home */
"use strict";
(function () {
const h = T.h;
const A = T.A = { S: null, view: "home", sub: null, ui: { months: null, vac: false, cat: null, q: "", page: 0, flow: "spesa", week: null }, fire: { key: "", res: null, busy: false } };

A.save = () => T.save(A.S);
A.changed = () => { A.fire.key = ""; A.save(); A.render(); };
A.money = v => T.fmt.money(v);
A.moneyK = v => Math.abs(v) >= 1e6 ? T.fmt.k(v) + " " + T.fmt.cur : T.fmt.money(v);
A.cat = id => A.S.categories.find(c => c.id === id) || { id, name: T.tr("Senza categoria"), color: T.OTHER_COLOR };

/* navigazione con il tasto indietro di Android */
A.go = (view, sub, replace) => {
  A.view = view; A.sub = sub || null; A._toTop = true;
  try { const st = { v: view, s: A.sub }; if (replace) history.replaceState(st, ""); else history.pushState(st, ""); } catch (e) { }
  A.render(); window.scrollTo && window.scrollTo(0, 0);
};
window.addEventListener && window.addEventListener("popstate", e => {
  if (!T.$("sheet").hidden) { T.closeSheet(); try { history.pushState({ v: A.view, s: A.sub }, ""); } catch (x) { } return; }
  const st = e.state || { v: "home" }; A.view = st.v || "home"; A.sub = st.s || null; A._toTop = true; A.render();
});

A.renderBar = () => {
  const b = T.$("btnSync"); if (!b || !A.S) return;
  b.hidden = !A.S.profile.onboarded || !T.bankConnected(A.S);
  b.classList.toggle("spin", !!A._syncing);
  b.disabled = !!A._syncing;
};
A.render = () => {
  const S = A.S, main = T.$("view");
  /* ridisegnare la stessa schermata non deve riportarti in cima: si tiene la posizione */
  const y = !A._toTop && typeof window.scrollY === "number" ? window.scrollY : 0; A._toTop = false;
  T.clear(main);
  T.fmt.cur = S.profile.currency || "CHF";
  const onb = !S.profile.onboarded;
  T.$("tabs").hidden = onb;
  T.setLang(S.profile.lang || "it", S.profile.currency);
  const TABS = { home: "Home", spese: "Spese", budget: "Budget", fire: "FIRE", altro: "Altro~menu" };
  document.querySelectorAll("#tabs button").forEach(b => { b.classList.toggle("on", b.dataset.tab === A.view); const sp = b.querySelector && b.querySelector("span"); if (sp) sp.textContent = T.tr(TABS[b.dataset.tab]); });
  T.$("tabs").setAttribute("aria-label", T.tr("Sezioni"));
  T.$("btnImport").setAttribute("aria-label", T.tr("Importa un estratto conto"));
  if (T.$("btnSync")) T.$("btnSync").setAttribute("aria-label", T.tr("Aggiorna da Revolut"));
  const cov = T.coverage(S);
  T.$("title").textContent = onb ? T.APP.name : ({ home: T.APP.name, spese: T.tr("Spese"), budget: "Budget", fire: T.tr("Obiettivo FIRE"), altro: T.tr("Altro~menu"), portafoglio: T.tr("Portafoglio") })[A.view];
  T.$("subtitle").textContent = onb ? T.tr("Configurazione iniziale") : S.profile.demo ? T.tr("Dati di esempio · ") + (cov ? T.tr("fino al ") + T.fmt.date(cov.to) : "") : T.bankConnected(S) ? (A._syncing ? T.tr("Aggiornamento da Revolut...") : T.tr("Revolut aggiornato ") + A.relTime(S.bank.lastSync)) : cov ? T.tr("Dati fino al ") + T.fmt.date(cov.to) : T.tr("Nessun movimento importato");
  T.$("btnImport").hidden = onb;
  A.renderBar();
  if (onb) return A.renderOnboarding(main);
  const fn = { home: A.renderHome, spese: A.renderSpese, budget: A.renderBudget, fire: A.renderFire, altro: A.renderAltro, portafoglio: m => { A.view = "fire"; A.ui.fireTab = "portafoglio"; A.renderBar(); A.renderFire(m); } }[A.view] || A.renderHome;
  fn(main);
  if (y > 0 && window.scrollTo) window.scrollTo(0, y);
};

/* ---------- risultati FIRE, calcolati in differita e messi in cache ---------- */
A.fireKey = (extra) => JSON.stringify([Object.assign({}, A.S.fire, { retireAge: null }), T.investableNow(A.S), A.S.fixed, A.S.categories.map(c => c.budget), A.S.budget, A.S.profile.incomeMonthly, A.S.txs.length, extra || ""]);
/* la curva (tutte le eta') si calcola in differita una volta; il dettaglio per l'eta' scelta al volo */
A.fireResult = cb => {
  const key = A.fireKey();
  if (A.fire.key === key && A.fire.base) return A.fireView();
  if (!A.fire.busy) {
    A.fire.busy = true;
    setTimeout(() => {
      try { const ctx = T.firePrepare(A.S); A.fire.base = T.fireSummary(ctx, T.fireCurve(ctx)); A.fire.ctx = ctx; A.fire.at = {}; A.fire.key = key; }
      catch (e) { console.error(e); A.fire.base = null; }
      A.fire.busy = false; cb && cb();
    }, 30);
  }
  return null;
};
A.fireView = age => {
  const b = A.fire.base, F = A.S.fire;
  let ra = age != null ? age : F.retireAge;
  const auto = ra == null || ra === "";
  if (auto) ra = b.target;
  ra = T.clamp(Math.round(+ra), b.age, b.maxR);
  const at = A.fire.at[ra] || (A.fire.at[ra] = T.fireAt(A.fire.ctx, ra));
  return Object.assign({}, b, at, { auto, year: new Date().getFullYear() + ra - b.age });
};

/* ---------- settimana giorno per giorno (Home, Spese) ---------- */
A.dayData = ws => {
  const days = T.weekDays(A.S, ws), tot = {};
  for (const d of days) for (const k in d.cats) tot[k] = (tot[k] || 0) + d.cats[k];
  const top = Object.entries(tot).sort((a, b) => b[1] - a[1]).slice(0, 4).map(x => x[0]);
  let other = false;
  for (const d of days) {
    d.parts = top.map(id => ({ v: d.cats[id] || 0, c: A.cat(id).color, n: A.cat(id).name }));
    const o = T.sum(Object.entries(d.cats).filter(([k]) => !top.includes(k)).map(x => x[1]));
    if (o > 0) other = true;
    d.parts.push({ v: o, c: T.OTHER_COLOR, n: T.tr("Altre") });
    d.parts.push({ v: d.vac, c: "vac", n: T.tr("vacanza") });
    d.label = T.fmt.dayLong(d.d); d.short = T.fmt.wdShort(d.d);
  }
  return { days, top, other, vac: T.sum(days.map(d => d.vac)), spent: T.sum(days.map(d => d.total)) };
};
A.dayChartBlock = (host, ws, onDay) => {
  const dd = A.dayData(ws), cap = T.picture(A.S).weeklyCap / 7;
  host.appendChild(T.dayChart(host, dd.days, { cap, onClick: onDay }));
  host.appendChild(h("div.legend", dd.top.map(id => h("span", h("i.dot", { style: { background: A.cat(id).color } }), A.cat(id).name)), dd.other ? h("span", h("i.dot", { style: { background: T.OTHER_COLOR } }), T.tr("Altre")) : null,
    dd.vac > 0 ? h("span", h("i.dot.vacdot"), T.tr("Vacanza, budget a parte")) : null,
    h("span", h("i.dash"), T.tr("Tetto: {v} al giorno", { v: A.money(cap) }))));
  return dd;
};
/* pannello di un giorno: totale contro il tetto, categorie, movimenti */
A.daySheet = (day, back) => {
  const S = A.S, cap = T.picture(S).weeklyCap / 7, diff = day.total - cap;
  const body = h("div");
  body.appendChild(h("div.row.between", { style: { alignItems: "flex-end" } },
    h("div", h("div.big", A.money(day.total)), h("div.small.muted", T.tr("spese di tutti i giorni"))),
    h("div", { style: { textAlign: "end" } }, h("div.mid" + (diff > 0 ? ".bad" : ".ok"), (diff > 0 ? "+" : "") + A.money(Math.abs(diff))), h("div.small.muted", T.tr(diff > 0 ? "sopra il tetto di {v}" : "sotto il tetto di {v}", { v: A.money(cap) })))));
  const cats = Object.entries(day.cats).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]);
  if (cats.length) {
    body.appendChild(h("h4", T.tr("Per categoria")));
    const list = h("div.list");
    for (const [id, v] of cats) {
      const c = A.cat(id);
      list.appendChild(h("div.li", h("i.dot", { style: { background: c.color } }),
        h("div.grow", h("div.row.between", h("span.t", c.name), h("b", A.money(v))), T.progress(v, day.total, c.color), h("div.d", T.tr("{p} del giorno", { p: T.fmt.pct(v / Math.max(1e-9, day.total)) })))));
    }
    body.appendChild(list);
  }
  if (day.vac > 0) body.appendChild(h("div.note", { style: { marginBlockStart: "10px" } }, T.tr("In vacanza: ") + A.money(day.vac) + T.tr(" nel budget vacanze")));
  body.appendChild(h("h4", T.tr("Movimenti")));
  const lst = h("div.list");
  for (const r of day.rows.slice().sort((a, b) => b.v - a.v)) lst.appendChild(A.txRow(r.t));
  if (!day.rows.length) lst.appendChild(h("div.empty", T.tr("Nessuna spesa in questo giorno")));
  body.appendChild(lst);
  T.sheet(day.label, body, [back ? h("button.btn", { type: "button", onclick: back }, T.tr("Indietro")) : null, h("button.btn.primary", { type: "button", onclick: () => T.closeSheet() }, T.tr("Chiudi"))].filter(Boolean));
};

/* ---------- HOME ---------- */
A.renderHome = main => {
  const S = A.S, pic = T.picture(S), cov = T.coverage(S);
  if (!cov) {
    main.appendChild(h("div.card", h("h2", T.tr("Primo passo")), h("p", T.tr("Importa l'estratto conto della carta che usi per le spese di tutti i giorni (per esempio l'export Revolut). L'app lo legge sul telefono e lo divide in categorie.")),
      h("button.btn.primary.block", { type: "button", onclick: () => A.importFlow() }, T.icon("import"), T.tr("Importa un estratto conto"))));
  } else {
    const thisWeek = T.weekStart(T.today());
    const hasThis = S.txs.some(t => t.flow === "spesa" && t.d >= thisWeek);
    const ws = A.ui.week || (hasThis ? thisWeek : T.weekStart(cov.to));
    const w = T.week(S, ws), cap = w.cap, left = cap - w.spent;
    const isCurrent = ws === thisWeek, past = ws < thisWeek;
    const daysLeft = isCurrent ? 7 - T.daysBetween(ws, T.today()) : 0;
    const col = w.spent > cap ? "var(--bad)" : w.spent > cap * 0.85 ? "var(--warn)" : "var(--ok)";
    const nav = h("div.row.between",
      h("button.btn.ghost", { type: "button", "aria-label": T.tr("Settimana precedente"), onclick: () => { A.ui.week = T.addDays(ws, -7); A.render(); } }, "\u2039"),
      h("div", { style: { textAlign: "center" } }, h("div", { style: { fontWeight: 650 } }, isCurrent ? T.tr("Questa settimana") : past && !hasThis && ws === T.weekStart(cov.to) ? T.tr("Ultima settimana con dati") : T.tr("Settimana")), h("div.small.muted", T.fmt.dateShort(ws) + " - " + T.fmt.dateShort(w.end))),
      h("button.btn.ghost", { type: "button", "aria-label": T.tr("Settimana successiva"), disabled: ws >= thisWeek, onclick: () => { A.ui.week = T.addDays(ws, 7); A.render(); } }, "\u203a"));
    const lines = [h("div.big", A.money(w.spent)), h("div.muted", T.tr("spesi su ") + A.money(cap))];
    if (left >= 0) lines.push(h("div.mid.ok", T.tr("Restano ") + A.money(left)), isCurrent && daysLeft > 0 ? h("div.small.muted", T.tr("per ") + daysLeft + (daysLeft === 1 ? T.tr(" giorno") : T.tr(" giorni")) + ": " + A.money(left / daysLeft) + T.tr(" al giorno")) : null);
    else lines.push(h("div.mid.bad", T.tr("Sforato di ") + A.money(-left)), h("div.small.muted", T.tr("la prossima settimana parte da ") + A.money(Math.max(0, cap + left))));
    if (w.vac > 0) lines.push(h("div.small", { style: { color: "var(--accent)", fontWeight: 600 } }, T.tr("In vacanza: ") + A.money(w.vac) + T.tr(" nel budget vacanze")));
    const card = h("div.card", h("h2", T.tr("Budget settimanale")), nav, h("div.ring-wrap", { style: { marginBlockStart: "8px" } }, T.ring(cap ? w.spent / cap : 0, cap ? T.fmt.pct(w.spent / cap) : "-", T.tr("del tetto"), col), h("div", lines)));
    if (cov.to < T.addDays(T.today(), -6) && !T.bankConnected(S)) card.appendChild(h("div.note.warn", { style: { marginBlockStart: "10px" } }, T.tr("Ultimo movimento importato il ") + T.fmt.date(cov.to) + T.tr(". Importa l'estratto per aggiornare la settimana."), " ", h("button.btn.ghost", { type: "button", onclick: () => A.importFlow() }, T.tr("Importa"))));
    main.appendChild(card);
    /* giorno per giorno, stessa settimana del riquadro sopra */
    const c2 = h("div.card#dayCard", h("h2", isCurrent ? T.tr("Questa settimana, giorno per giorno") : T.tr("Giorno per giorno")), h("p.sub", T.tr("Tocca un giorno per vedere dove hai speso. La linea tratteggiata e' il tetto giornaliero.")));
    main.appendChild(c2);
    A.dayChartBlock(c2, ws, d => A.daySheet(d));
    /* mese */
    const mk = cov.to.slice(0, 7), agg = T.aggregate(S, { months: new Set([mk]) });
    const monthDays = new Date(+mk.slice(0, 4), +mk.slice(5, 7), 0).getDate();
    const elapsed = mk === T.today().slice(0, 7) ? +T.today().slice(8) : +cov.to.slice(8);
    const budgetM = pic.plan.variable;
    main.appendChild(h("div.card", h("h2", T.fmt.month(mk)),
      h("div.row.between", h("span", T.tr("Spese di tutti i giorni")), h("b", A.money(agg.total) + " / " + A.money(budgetM))),
      T.progress(agg.total, budgetM, agg.total > budgetM ? "var(--bad)" : "var(--brand2)", budgetM * elapsed / monthDays),
      (() => { const target = budgetM * elapsed / monthDays, diff = agg.total - target;
        return h("div.small.muted", { style: { marginBlockStart: "6px" } }, T.tr("La tacca indica dove dovresti essere oggi, giorno {d} su {n}: ", { d: elapsed, n: monthDays }), h("b", { style: { color: "var(--ink)" } }, A.money(target)), " (",
          h("span", { style: { color: diff > 0 ? "var(--bad)" : "var(--ok)", fontWeight: 700 } }, diff > 0 ? T.tr("{v} di troppo", { v: A.money(diff) }) : T.tr("{v} ancora disponibili", { v: A.money(-diff) })), ")."); })(),
      h("div.kpis", { style: { marginBlockStart: "12px" } }, T.kpi(T.tr("Costi fissi"), A.money(pic.now.fixed), T.tr("al mese")), T.kpi(T.tr("Tasso di risparmio"), pic.rateNow == null ? "-" : T.fmt.pct(pic.rateNow), pic.income ? T.tr("su ") + A.money(pic.income) + T.tr(" netti") : T.tr("inserisci il reddito")))));
  }
  /* portafoglio (Interactive Brokers) */
  A.pfHomeCard(main);
  /* FIRE: tutta la scheda porta al simulatore */
  const goFire = () => A.go("fire");
  const fc = h("div.card.tapcard#fireCard", { role: "button", tabindex: "0", "aria-label": T.tr("Apri il simulatore"), onclick: goFire, onkeydown: e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); goFire(); } } },
    h("div.row.between", h("h2", { style: { margin: 0 } }, T.tr("Obiettivo FIRE")), h("span.chev", { "aria-hidden": "true" }, "\u203a")));
  main.appendChild(fc);
  const res = A.fireResult(() => { if (A.view === "home") A.render(); });
  if (!S.fire.birthYear) fc.appendChild(h("p.muted", T.tr("Inserisci eta' e patrimonio per vedere quando potresti raggiungere l'indipendenza finanziaria.")));
  else if (res) {
    const z = T.fireZone(res.successChosen);
    fc.appendChild(h("div.fire-mini", T.gauge(res.successChosen, z.name, { mini: true }),
      h("div", h("div.small.muted", res.auto ? T.tr("Eta' stimata per smettere") : T.tr("Smetti a")),
        h("div.big", T.tr("{a} anni", { a: res.chosen })),
        h("div.small.muted", T.tr("nel {y}", { y: res.year })),
        h("div.small", { style: { marginBlockStart: "6px", fontWeight: 600 } }, T.tr("{p} del numero FIRE", { p: T.fmt.pct(res.progress) })))));
    fc.appendChild(h("div.small.muted", { style: { marginBlockStart: "4px" } }, T.tr("Probabilita' che il patrimonio basti fino a {e} anni.", { e: res.endAge })));
  } else fc.appendChild(h("div.row", h("span.spinner"), h("span.muted", T.tr("Calcolo in corso..."))));
  fc.appendChild(h("button.btn.block", { type: "button", style: { marginBlockStart: "10px" }, onclick: e => { e.stopPropagation(); goFire(); } }, T.tr("Apri il simulatore")));
  /* promemoria */
  const tips = [];
  const B = S.bank, left = T.bankDaysLeft(S);
  if (T.bankConnected(S) && T.bankExpired(S)) tips.push(h("div.li.tap", { onclick: () => A.startConnect() }, h("div.grow", h("div.t", T.tr("Ricollega Revolut")), h("div.d", T.tr("Il consenso e' scaduto il ") + T.fmt.date(B.validUntil.slice(0, 10)) + T.tr(": i movimenti non arrivano piu' da soli."))), h("span.pill.warn", T.tr("Scaduto"))));
  else if (T.bankConnected(S) && left != null && left < 14) tips.push(h("div.li.tap", { onclick: () => A.startConnect() }, h("div.grow", h("div.t", T.tr("Rinnova il collegamento Revolut")), h("div.d", T.tr("Scade tra ") + left + T.tr(" giorni, il ") + T.fmt.date(B.validUntil.slice(0, 10)) + T.tr(". Bastano due tocchi nell'app Revolut."))), h("span.pill.warn", T.tr("Presto"))));
  else if (T.bankConnected(S) && B.lastError) tips.push(h("div.li.tap", { onclick: () => A.go("altro", "collega") }, h("div.grow", h("div.t", T.tr("Aggiornamento Revolut non riuscito")), h("div.d", B.lastError))));
  else if (!T.bankConnected(S) && B.url) tips.push(h("div.li.tap", { onclick: () => A.go("altro", "collega") }, h("div.grow", h("div.t", T.tr("Completa il collegamento Revolut")), h("div.d", T.tr("Manca il consenso nell'app Revolut")))));
  { const P = S.portfolio; if (P && P.tokenUntil) { const dl = T.daysBetween(T.today(), P.tokenUntil); if (dl <= 14) tips.push(h("div.li.tap", { onclick: () => A.go("altro", "ibkr") }, h("div.grow", h("div.t", dl < 0 ? T.tr("Il token di Interactive Brokers e' scaduto") : T.tr("Il token di Interactive Brokers scade tra {n} giorni", { n: dl })), h("div.d", T.tr("Generane uno nuovo e aggiornalo nel ponte (IBKR_TOKEN)"))))); } }
  if (S.family && S.family.gone) tips.push(h("div.li.tap", { onclick: () => A.go("altro", "famiglia") }, h("div.grow", h("div.t", T.tr("La famiglia non e' piu' raggiungibile")), h("div.d", T.tr("Chiedi un QR nuovo oppure esci dalla famiglia")))));
  if (S.txs.length && (!S.meta.lastBackup || T.daysBetween(S.meta.lastBackup.slice(0, 10), T.today()) > 30)) tips.push(h("div.li.tap", { onclick: () => A.exportBackup() }, h("div.grow", h("div.t", T.tr("Fai un backup")), h("div.d", S.meta.lastBackup ? T.tr("Ultimo il ") + T.fmt.date(S.meta.lastBackup.slice(0, 10)) : T.tr("Non ne hai ancora fatto uno. I dati sono solo su questo telefono."))), h("span.pill.warn", T.tr("Consigliato"))));
  if (!pic.income) tips.push(h("div.li.tap", { onclick: () => A.go("altro", "profilo") }, h("div.grow", h("div.t", T.tr("Inserisci il reddito netto mensile")), h("div.d", T.tr("Serve per il tasso di risparmio e per il FIRE")))));
  if (!S.fixed.length) tips.push(h("div.li.tap", { onclick: () => A.go("altro", "fissi") }, h("div.grow", h("div.t", T.tr("Aggiungi i costi fissi")), h("div.d", T.tr("Affitto, cassa malati, leasing, bollette")))));
  if (tips.length) main.appendChild(h("div.card", h("h2", T.tr("Da fare")), h("div.list", tips)));
};
})();
