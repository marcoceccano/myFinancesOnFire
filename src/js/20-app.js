/* myFinances on FIRE · applicazione: stato, navigazione, Home */
"use strict";
(function () {
const h = T.h;
const A = T.A = { S: null, view: "home", sub: null, ui: { months: null, vac: false, cat: null, q: "", page: 0, flow: "spesa", week: null }, fire: { key: "", res: null, busy: false } };

A.save = () => T.save(A.S);
A.changed = () => { A.fire.key = ""; A.save(); A.render(); };
A.money = v => T.fmt.money(v);
A.cat = id => A.S.categories.find(c => c.id === id) || { id, name: "Senza categoria", color: "#95A0B3" };

/* navigazione con il tasto indietro di Android */
A.go = (view, sub, replace) => {
  A.view = view; A.sub = sub || null;
  try { const st = { v: view, s: A.sub }; if (replace) history.replaceState(st, ""); else history.pushState(st, ""); } catch (e) { }
  A.render(); window.scrollTo && window.scrollTo(0, 0);
};
window.addEventListener && window.addEventListener("popstate", e => {
  if (!T.$("sheet").hidden) { T.closeSheet(); try { history.pushState({ v: A.view, s: A.sub }, ""); } catch (x) { } return; }
  const st = e.state || { v: "home" }; A.view = st.v || "home"; A.sub = st.s || null; A.render();
});

A.renderBar = () => {
  const b = T.$("btnSync"); if (!b || !A.S) return;
  b.hidden = !A.S.profile.onboarded || !T.bankConnected(A.S);
  b.classList.toggle("spin", !!A._syncing);
  b.disabled = !!A._syncing;
};
A.render = () => {
  const S = A.S, main = T.$("view");
  T.clear(main);
  T.fmt.cur = S.profile.currency || "CHF";
  const onb = !S.profile.onboarded;
  T.$("tabs").hidden = onb;
  document.querySelectorAll("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === A.view));
  const cov = T.coverage(S);
  T.$("title").textContent = onb ? T.APP.name : ({ home: T.APP.name, spese: "Spese", budget: "Budget", fire: "Obiettivo FIRE", altro: "Altro" })[A.view];
  T.$("subtitle").textContent = onb ? "Configurazione iniziale" : S.profile.demo ? "Dati di esempio · " + (cov ? "fino al " + T.fmt.date(cov.to) : "") : T.bankConnected(S) ? (A._syncing ? "Aggiornamento da Revolut..." : "Revolut aggiornato " + A.relTime(S.bank.lastSync)) : cov ? "Dati fino al " + T.fmt.date(cov.to) : "Nessun movimento importato";
  T.$("btnImport").hidden = onb;
  A.renderBar();
  if (onb) return A.renderOnboarding(main);
  const fn = { home: A.renderHome, spese: A.renderSpese, budget: A.renderBudget, fire: A.renderFire, altro: A.renderAltro }[A.view] || A.renderHome;
  fn(main);
};

/* ---------- risultati FIRE, calcolati in differita e messi in cache ---------- */
A.fireKey = (extra) => JSON.stringify([A.S.fire, A.S.fixed, A.S.categories.map(c => c.budget), A.S.budget, A.S.profile.incomeMonthly, A.S.txs.length, extra || ""]);
A.fireResult = cb => {
  const key = A.fireKey();
  if (A.fire.key === key && A.fire.res) return A.fire.res;
  if (!A.fire.busy) {
    A.fire.busy = true;
    setTimeout(() => { try { A.fire.res = T.simulateFire(A.S); A.fire.key = key; } catch (e) { console.error(e); A.fire.res = null; } A.fire.busy = false; cb && cb(); }, 30);
  }
  return null;
};

/* ---------- HOME ---------- */
A.renderHome = main => {
  const S = A.S, pic = T.picture(S), cov = T.coverage(S);
  if (!cov) {
    main.appendChild(h("div.card", h("h2", "Primo passo"), h("p", "Importa l'estratto conto della carta che usi per le spese di tutti i giorni (per esempio l'export Revolut). L'app lo legge sul telefono e lo divide in categorie."),
      h("button.btn.primary.block", { type: "button", onclick: () => A.importFlow() }, T.icon("import"), "Importa un estratto conto")));
  } else {
    const thisWeek = T.weekStart(T.today());
    const hasThis = S.txs.some(t => t.flow === "spesa" && t.d >= thisWeek);
    const ws = A.ui.week || (hasThis ? thisWeek : T.weekStart(cov.to));
    const w = T.week(S, ws), cap = w.cap, left = cap - w.spent;
    const isCurrent = ws === thisWeek, past = ws < thisWeek;
    const daysLeft = isCurrent ? 7 - T.daysBetween(ws, T.today()) : 0;
    const col = w.spent > cap ? "var(--bad)" : w.spent > cap * 0.85 ? "var(--warn)" : "var(--ok)";
    const nav = h("div.row.between",
      h("button.btn.ghost", { type: "button", "aria-label": "Settimana precedente", onclick: () => { A.ui.week = T.addDays(ws, -7); A.render(); } }, "\u2039"),
      h("div", { style: { textAlign: "center" } }, h("div", { style: { fontWeight: 650 } }, isCurrent ? "Questa settimana" : past && !hasThis && ws === T.weekStart(cov.to) ? "Ultima settimana con dati" : "Settimana"), h("div.small.muted", T.fmt.dateShort(ws) + " - " + T.fmt.dateShort(w.end))),
      h("button.btn.ghost", { type: "button", "aria-label": "Settimana successiva", disabled: ws >= thisWeek, onclick: () => { A.ui.week = T.addDays(ws, 7); A.render(); } }, "\u203a"));
    const lines = [h("div.big", A.money(w.spent)), h("div.muted", "spesi su " + A.money(cap))];
    if (left >= 0) lines.push(h("div.mid.ok", "Restano " + A.money(left)), isCurrent && daysLeft > 0 ? h("div.small.muted", "per " + daysLeft + (daysLeft === 1 ? " giorno" : " giorni") + ": " + A.money(left / daysLeft) + " al giorno") : null);
    else lines.push(h("div.mid.bad", "Sforato di " + A.money(-left)), h("div.small.muted", "la prossima settimana parte da " + A.money(Math.max(0, cap + left))));
    if (w.vac > 0) lines.push(h("div.small", { style: { color: "var(--accent)", fontWeight: 600 } }, "In vacanza: " + A.money(w.vac) + " nel budget vacanze"));
    const card = h("div.card", h("h2", "Budget settimanale"), nav, h("div.ring-wrap", { style: { marginBlockStart: "8px" } }, T.ring(cap ? w.spent / cap : 0, cap ? T.fmt.pct(w.spent / cap) : "-", "del tetto", col), h("div", lines)));
    if (cov.to < T.addDays(T.today(), -6) && !T.bankConnected(S)) card.appendChild(h("div.note.warn", { style: { marginBlockStart: "10px" } }, "Ultimo movimento importato il " + T.fmt.date(cov.to) + ". Importa l'estratto per aggiornare la settimana.", " ", h("button.btn.ghost", { type: "button", onclick: () => A.importFlow() }, "Importa")));
    main.appendChild(card);
    const hist = T.weeksHistory(S, 8, T.weekStart(cov.to));
    const c2 = h("div.card", h("h2", "Ultime 8 settimane"), h("p.sub", "Spese di tutti i giorni contro il tetto settimanale (linea rossa). In arancione le spese di vacanza, che hanno un budget a parte."));
    main.appendChild(c2);
    c2.appendChild(T.columns(c2, hist.map(x => ({ l: T.fmt.dateShort(x.start), title: "Settimana dal " + T.fmt.date(x.start), parts: [{ v: x.spent, c: x.spent > x.cap ? "var(--bad)" : "var(--brand2)", n: "tutti i giorni" }, { v: x.vac, c: "var(--accent)", n: "vacanza" }] })), { ref: cap, refLabel: "tetto " + T.fmt.n0(cap), h: 180, onClick: it => { A.ui.week = hist[hist.findIndex(x => T.fmt.dateShort(x.start) === it.l)].start; A.render(); } }));
    /* mese */
    const mk = cov.to.slice(0, 7), agg = T.aggregate(S, { months: new Set([mk]) });
    const monthDays = new Date(+mk.slice(0, 4), +mk.slice(5, 7), 0).getDate();
    const elapsed = mk === T.today().slice(0, 7) ? +T.today().slice(8) : +cov.to.slice(8);
    const budgetM = pic.plan.variable;
    main.appendChild(h("div.card", h("h2", T.fmt.month(mk)),
      h("div.row.between", h("span", "Spese di tutti i giorni"), h("b", A.money(agg.total) + " / " + A.money(budgetM))),
      T.progress(agg.total, budgetM, agg.total > budgetM ? "var(--bad)" : "var(--brand2)", budgetM * elapsed / monthDays),
      h("div.small.muted", { style: { marginBlockStart: "6px" } }, "La tacca indica dove dovresti essere oggi (" + elapsed + " giorni su " + monthDays + ")."),
      h("div.kpis", { style: { marginBlockStart: "12px" } }, T.kpi("Costi fissi", A.money(pic.now.fixed), "al mese"), T.kpi("Tasso di risparmio", pic.rateNow == null ? "-" : T.fmt.pct(pic.rateNow), pic.income ? "su " + A.money(pic.income) + " netti" : "inserisci il reddito"))));
  }
  /* FIRE */
  const fc = h("div.card", h("h2", "Obiettivo FIRE"));
  main.appendChild(fc);
  const res = A.fireResult(() => { if (A.view === "home") A.render(); });
  if (!S.fire.birthYear) fc.appendChild(h("p.muted", "Inserisci eta' e patrimonio per vedere quando potresti raggiungere l'indipendenza finanziaria."));
  if (res) {
    fc.appendChild(h("div.ring-wrap", T.ring(res.progress, T.fmt.pct(res.progress), "del numero FIRE", "var(--ok)"),
      h("div", h("div.small.muted", "Eta' FIRE stimata"), h("div.big", res.fireAge != null ? T.fmt.n1(res.fireAge) + " anni" : "oltre i 70"), h("div.small.muted", "con " + T.fmt.pct(res.conf) + " di probabilita'"), h("div.small.muted", "Numero FIRE " + A.money(res.fireNumber)))));
  } else fc.appendChild(h("div.row", h("span.spinner"), h("span.muted", "Calcolo in corso...")));
  fc.appendChild(h("button.btn.block", { type: "button", style: { marginBlockStart: "10px" }, onclick: () => A.go("fire") }, "Apri il simulatore"));
  /* promemoria */
  const tips = [];
  const B = S.bank, left = T.bankDaysLeft(S);
  if (T.bankConnected(S) && T.bankExpired(S)) tips.push(h("div.li.tap", { onclick: () => A.startConnect() }, h("div.grow", h("div.t", "Ricollega Revolut"), h("div.d", "Il consenso e' scaduto il " + T.fmt.date(B.validUntil.slice(0, 10)) + ": i movimenti non arrivano piu' da soli.")), h("span.pill.warn", "Scaduto")));
  else if (T.bankConnected(S) && left != null && left < 14) tips.push(h("div.li.tap", { onclick: () => A.startConnect() }, h("div.grow", h("div.t", "Rinnova il collegamento Revolut"), h("div.d", "Scade tra " + left + " giorni, il " + T.fmt.date(B.validUntil.slice(0, 10)) + ". Bastano due tocchi nell'app Revolut.")), h("span.pill.warn", "Presto")));
  else if (T.bankConnected(S) && B.lastError) tips.push(h("div.li.tap", { onclick: () => A.go("altro", "collega") }, h("div.grow", h("div.t", "Aggiornamento Revolut non riuscito"), h("div.d", B.lastError))));
  else if (!T.bankConnected(S) && B.url) tips.push(h("div.li.tap", { onclick: () => A.go("altro", "collega") }, h("div.grow", h("div.t", "Completa il collegamento Revolut"), h("div.d", "Manca il consenso nell'app Revolut"))));
  if (S.txs.length && (!S.meta.lastBackup || T.daysBetween(S.meta.lastBackup.slice(0, 10), T.today()) > 30)) tips.push(h("div.li.tap", { onclick: () => A.exportBackup() }, h("div.grow", h("div.t", "Fai un backup"), h("div.d", S.meta.lastBackup ? "Ultimo il " + T.fmt.date(S.meta.lastBackup.slice(0, 10)) : "Non ne hai ancora fatto uno. I dati sono solo su questo telefono.")), h("span.pill.warn", "Consigliato")));
  if (!pic.income) tips.push(h("div.li.tap", { onclick: () => A.go("altro", "profilo") }, h("div.grow", h("div.t", "Inserisci il reddito netto mensile"), h("div.d", "Serve per il tasso di risparmio e per il FIRE"))));
  if (!S.fixed.length) tips.push(h("div.li.tap", { onclick: () => A.go("altro", "fissi") }, h("div.grow", h("div.t", "Aggiungi i costi fissi"), h("div.d", "Affitto, cassa malati, leasing, bollette"))));
  if (tips.length) main.appendChild(h("div.card", h("h2", "Da fare"), h("div.list", tips)));
};
})();
