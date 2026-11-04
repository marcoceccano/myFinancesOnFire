/* myFinances on FIRE · schermata Spese e modifica dei movimenti */
"use strict";
(function () {
const h = T.h, A = T.A;

/* ---------- periodo, costi fissi e dettagli ---------- */
T.monthEnd = mk => T.iso(new Date(+mk.slice(0, 4), +mk.slice(5, 7), 0));
/* costo mensile di una voce fissa in un certo mese (tiene conto del nuovo importo "dal") */
T.fixedMonthlyAt = (f, mk) => f.next && f.next.amount != null && f.next.from && mk >= String(f.next.from).slice(0, 7) ? (+f.next.amount || 0) / (T.FREQ[f.freq] || 1) : T.monthlyOf(f);
/* costi fissi maturati in un intervallo: ogni mese pesa per i giorni compresi (un mese intero = importo mensile pieno) */
T.fixedInRange = (st, from, to) => {
  const out = { total: 0, items: [] };
  if (!from || !to || from > to) return out;
  for (const f of (st.fixed || []).filter(x => x.kind !== "risparmio")) {
    let v = 0, d = from;
    while (d <= to) {
      const mk = d.slice(0, 7), end = T.monthEnd(mk), last = end < to ? end : to;
      v += T.fixedMonthlyAt(f, mk) * (T.daysBetween(d, last) + 1) / +end.slice(8);
      d = T.addDays(end, 1);
    }
    if (v > 0) { out.items.push({ f, v }); out.total += v; }
  }
  out.items.sort((a, b) => b.v - a.v);
  return out;
};
T.FIXED_COLOR = "#7C8C82";
/* periodo scelto in testa alla schermata Spese */
A.period = () => {
  const ui = A.ui, td = T.today(), m = td.slice(0, 7);
  const p = ui.period || "anno";
  if (p === "mese") return { key: p, from: m + "-01", to: td };
  if (p === "prec") { const d = T.parseIso(m + "-01"); d.setMonth(d.getMonth() - 1); const pm = T.iso(d).slice(0, 7); return { key: p, from: pm + "-01", to: T.monthEnd(pm) }; }
  if (p === "custom") { let a = ui.from || T.addDays(td, -89), b = ui.to || td; if (a > b) [a, b] = [b, a]; return { key: p, from: a, to: b }; }
  return { key: "anno", from: td.slice(0, 4) + "-01-01", to: td };
};
/* intervalli del grafico: giorni (fino a 5 settimane), settimane (fino a 4 mesi), mesi */
A.buckets = (from, to) => {
  const span = T.daysBetween(from, to) + 1, out = [];
  if (span <= 35) { for (let d = from; d <= to; d = T.addDays(d, 1)) out.push({ from: d, to: d, l: String(+d.slice(8)), title: T.fmt.dayLong(d) }); return { gran: "giorno", list: out }; }
  if (span <= 120) { for (let s = T.weekStart(from); s <= to; s = T.addDays(s, 7)) { const a = s < from ? from : s, e = T.addDays(s, 6), b = e > to ? to : e; out.push({ from: a, to: b, l: T.fmt.dateShort(a), title: T.tr("Settimana dal ") + T.fmt.date(a) }); } return { gran: "settimana", list: out }; }
  for (let mk = from.slice(0, 7); mk <= to.slice(0, 7);) { const a = mk + "-01" < from ? from : mk + "-01", e = T.monthEnd(mk), b = e > to ? to : e; out.push({ from: a, to: b, l: T.fmt.monthShort(mk), title: T.fmt.month(mk) }); const d = T.parseIso(mk + "-01"); d.setMonth(d.getMonth() + 1); mk = T.iso(d).slice(0, 7); }
  return { gran: "mese", list: out };
};
const dateIn = (label, value, onSet) => { const inp = h("input", { type: "date", value, "aria-label": label }); inp.addEventListener("change", () => { if (inp.value) onSet(inp.value); }); return h("div.field", h("label", label), inp); };

A.renderSpese = main => {
  const S = A.S, ui = A.ui, cov = T.coverage(S);
  if (!cov) { main.appendChild(h("div.card.empty", h("p", T.tr("Nessuna spesa ancora.")), h("button.btn.primary", { type: "button", onclick: () => A.importFlow() }, T.tr("Importa un estratto conto")))); return; }
  const per = A.period(), td = T.today();
  const from = per.from, to = per.to;
  /* giorni con dati: dal primo all'ultimo movimento importato (se i dati sono indietro di qualche giorno si ferma li') */
  const dFrom = from < cov.from ? cov.from : from;
  let dTo = to > td ? td : to;
  const stale = cov.to < dTo && T.daysBetween(cov.to, dTo) > 3;
  if (stale) dTo = cov.to;
  const days = dFrom <= dTo ? T.daysBetween(dFrom, dTo) + 1 : 0;
  const withFixed = !!ui.withFixed;

  /* testa: periodo, costi fissi, vacanze */
  const pseg = T.seg([["anno", T.tr("Da inizio anno")], ["mese", T.tr("Da inizio mese")], ["prec", T.tr("Mese precedente")], ["custom", T.tr("Personalizzato")]], per.key, v => { ui.period = v; ui.page = 0; A.render(); });
  pseg.classList.add("g2");
  const head = h("div.card#periodCard", pseg,
    per.key === "custom" ? h("div.grid2", { style: { marginBlockStart: "10px" } }, dateIn(T.tr("Dal"), from, v => { ui.from = v; ui.page = 0; A.render(); }), dateIn(T.tr("Al"), to, v => { ui.to = v; ui.page = 0; A.render(); })) : null,
    h("div.small.muted", { style: { marginBlock: "8px 10px" } }, T.tr("Dal {a} al {b}", { a: T.fmt.date(from), b: T.fmt.date(to) }) + " \u00b7 " + days + (days === 1 ? T.tr(" giorno") : T.tr(" giorni"))),
    T.seg([["var", T.tr("Solo spese variabili")], ["fissi", T.tr("Con i costi fissi")]], withFixed ? "fissi" : "var", v => { ui.withFixed = v === "fissi"; A.render(); }),
    h("label.row", { style: { gap: "8px", marginBlockStart: "8px" } }, h("input", { type: "checkbox", checked: ui.vac, onchange: e => { ui.vac = e.target.checked; A.render(); } }), T.tr("Includi le vacanze")),
    stale ? h("div.note.warn", { style: { marginBlockStart: "8px" } }, T.tr("Ultimo movimento il {d}: aggiorna Revolut o importa l'estratto per completare il periodo.", { d: T.fmt.date(cov.to) })) : null);
  main.appendChild(head);
  if (!days) { main.appendChild(h("div.card.empty", h("p", T.tr("Nessun dato in questo periodo.")))); return; }

  const agg = T.aggregate(S, { from: dFrom, to: dTo, vac: ui.vac });
  const fx = withFixed ? T.fixedInRange(S, dFrom, dTo) : { total: 0, items: [] };
  const total = agg.total + fx.total, mFactor = days / T.DAYS_PER_MONTH;
  main.appendChild(h("div.kpis.k4",
    T.kpi(T.tr("Totale"), A.money(total), withFixed ? T.tr("di cui {v} fissi", { v: A.money(fx.total) }) : T.tr("spese variabili")),
    T.kpi(T.tr("Al mese"), A.money(total / mFactor), T.tr("media")),
    T.kpi(T.tr("Al giorno"), A.money(total / days), days + T.tr(" giorni")),
    T.kpi(T.tr("Movimenti"), String(agg.n), withFixed ? T.tr("piu' {n} costi fissi", { n: fx.items.length }) : T.tr("spese"))));
  main.appendChild(h("div", { style: { blockSize: "12px" } }));

  /* andamento nel periodo: giorni, settimane o mesi secondo la durata */
  const bk = A.buckets(dFrom, dTo), idx = {};
  bk.list.forEach((b, i) => { for (let d = b.from; d <= b.to; d = T.addDays(d, 1)) idx[d] = i; });
  const sums = bk.list.map(() => ({}));
  for (const r of T.spendRows(S)) { const i = idx[r.d]; if (i == null || (!ui.vac && r.vac)) continue; sums[i][r.cat] = (sums[i][r.cat] || 0) + r.v; }
  const top = Object.entries(agg.cats).sort((a, b) => b[1] - a[1]).slice(0, 5).map(x => x[0]);
  const pic = T.picture(S), fixM = withFixed ? T.fixedMonthly(S).cost : 0;
  const factor = bk.gran === "mese" ? 1 : bk.gran === "settimana" ? 12 / 52 : 12 / 365;
  const ref = (pic.plan.variable + fixM) * factor;
  const TITLE = { giorno: T.tr("Giorno per giorno"), settimana: T.tr("Settimana per settimana"), mese: T.tr("Mese per mese") };
  const c1 = h("div.card#trendCard", h("h2", TITLE[bk.gran]), h("p.sub", T.tr("Tocca una colonna per vedere il dettaglio. La linea e' il budget") + (withFixed ? T.tr(", costi fissi compresi") : "") + "."));
  main.appendChild(c1);
  const items = bk.list.map((b, i) => {
    const sc = sums[i], parts = [];
    if (withFixed) parts.push({ v: T.fixedInRange(S, b.from, b.to).total, c: T.FIXED_COLOR, n: T.tr("Costi fissi") });
    top.forEach(id => parts.push({ v: sc[id] || 0, c: A.cat(id).color, n: A.cat(id).name }));
    parts.push({ v: T.sum(Object.entries(sc).filter(([k]) => !top.includes(k)).map(x => x[1])), c: T.OTHER_COLOR, n: T.tr("Altre") });
    return { l: b.l, title: b.title, b, parts };
  });
  c1.appendChild(T.columns(c1, items, { ref, refLabel: "budget", h: 210, onClick: it => A.spendSheet({ title: it.b.title, from: it.b.from, to: it.b.to, withFixed }) }));
  c1.appendChild(h("div.legend", withFixed ? h("span", h("i.dot", { style: { background: T.FIXED_COLOR } }), T.tr("Costi fissi")) : null, top.map(id => h("span", h("i.dot", { style: { background: A.cat(id).color } }), A.cat(id).name)), h("span", h("i.dot", { style: { background: T.OTHER_COLOR } }), T.tr("Altre"))));

  /* per categoria: ciambella ed elenco, tocca per il dettaglio */
  const cats = Object.entries(agg.cats).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]);
  const openCat = id => A.spendSheet({ title: A.cat(id).name, from: dFrom, to: dTo, cat: id });
  const openFixed = () => A.fixedSheet(dFrom, dTo);
  const c2 = h("div.card#catCard", h("h2", T.tr("Per categoria")), h("p.sub", T.tr("Al mese, confrontato con il budget. Tocca una categoria o una fetta per vedere il dettaglio.")));
  const slices = cats.map(([id, v]) => ({ v, c: A.cat(id).color, n: A.cat(id).name, onClick: () => openCat(id) }));
  if (withFixed && fx.total > 0) slices.unshift({ v: fx.total, c: T.FIXED_COLOR, n: T.tr("Costi fissi"), onClick: openFixed });
  c2.appendChild(h("div", { style: { display: "flex", justifyContent: "center" } }, T.donut(slices, A.money(total), "totale")));
  const list = h("div.list");
  if (withFixed && fx.total > 0) list.appendChild(h("div.li.tap", { onclick: openFixed }, h("i.dot", { style: { background: T.FIXED_COLOR } }),
    h("div.grow", h("div.row.between", h("span.t", T.tr("Costi fissi")), h("span.a", A.money(fx.total / mFactor))), h("div.d", fx.items.slice(0, 3).map(i => i.f.name).join(", ") + (fx.items.length > 3 ? T.tr(" e altre {n}", { n: fx.items.length - 3 }) : ""))), h("span.muted", "\u203a")));
  for (const [id, v] of cats) {
    const c = A.cat(id), pm = v / mFactor, b = +c.budget || 0;
    list.appendChild(h("div.li.tap", { onclick: () => openCat(id) }, h("i.dot", { style: { background: c.color } }),
      h("div.grow", h("div.row.between", h("span.t", c.name), h("span.a", A.money(pm))), T.progress(pm, Math.max(b, pm), pm > b && b ? "var(--bad)" : c.color, b || null), h("div.d", b ? (pm > b ? "+" + A.money(pm - b) + T.tr(" sopra il budget") : A.money(b - pm) + T.tr(" sotto il budget")) + " (" + A.money(b) + ")" : T.tr("nessun budget"))),
      h("span.muted", "\u203a")));
  }
  c2.appendChild(list); main.appendChild(c2);

  /* esercenti */
  const merch = Object.entries(agg.merch).sort((a, b) => b[1].v - a[1].v).slice(0, 10);
  if (merch.length) main.appendChild(h("div.card", h("h2", T.tr("Dove spendi di piu'")), h("div.list", merch.map(([n, x]) => h("div.li.tap", { onclick: () => A.spendSheet({ title: n, from: dFrom, to: dTo, merch: n }) },
    h("div.grow", h("div.t", n), h("div.d", x.n + T.tr(" movimenti, ") + A.money(x.v / x.n) + T.tr(" in media"))), h("div.a", A.money(x.v)))))));

  /* movimenti del periodo */
  const c4 = h("div.card", h("h2", T.tr("Movimenti")));
  const q = h("input", { type: "search", placeholder: T.tr("Cerca esercente o nota"), value: ui.q, "aria-label": T.tr("Cerca") });
  q.addEventListener("change", () => { ui.q = q.value; ui.page = 0; A.render(); });
  c4.appendChild(T.seg([["spesa", T.tr("Spese")], ["escluso", T.tr("Esclusi")], ["entrata", T.tr("Entrate")]], ui.flow, v => { ui.flow = v; ui.page = 0; A.render(); }));
  c4.appendChild(h("div", { style: { blockSize: "8px" } })); c4.appendChild(q);
  const rows = S.txs.filter(t => t.flow === ui.flow && t.d >= dFrom && t.d <= dTo && (ui.vac || ui.flow !== "spesa" || !T.isVacation(t, S)) && (!ui.q || (t.desc + " " + (t.note || "")).toLowerCase().includes(ui.q.toLowerCase()))).slice().reverse();
  const PG = 40, pages = Math.max(1, Math.ceil(rows.length / PG)); ui.page = Math.min(ui.page, pages - 1);
  const lst = h("div.list");
  for (const t of rows.slice(ui.page * PG, ui.page * PG + PG)) lst.appendChild(A.txRow(t));
  if (!rows.length) lst.appendChild(h("div.empty", T.tr("Nessun movimento")));
  c4.appendChild(h("div.small.muted", { style: { marginBlock: "8px 0" } }, rows.length + T.tr(" movimenti, ") + A.money(-T.sum(rows.map(r => r.amt)))));
  c4.appendChild(lst);
  if (pages > 1) c4.appendChild(h("div.row.between", h("button.btn", { type: "button", disabled: ui.page === 0, onclick: () => { ui.page--; A.render(); } }, T.tr("Precedenti")), h("span.small.muted", T.tr("pagina ") + (ui.page + 1) + T.tr(" di ") + pages), h("button.btn", { type: "button", disabled: ui.page >= pages - 1, onclick: () => { ui.page++; A.render(); } }, T.tr("Successivi"))));
  main.appendChild(c4);
};

/* dettaglio di una parte delle spese (colonna, categoria, esercente): si apre dal basso */
A.spendSheet = o => {
  const S = A.S, ui = A.ui;
  const rows = T.spendRows(S).filter(r => r.d >= o.from && r.d <= o.to && (ui.vac || !r.vac) && (!o.cat || r.cat === o.cat) && (!o.merch || (r.t.note || r.t.desc) === o.merch)).sort((a, b) => a.d < b.d ? 1 : a.d > b.d ? -1 : b.v - a.v);
  const fx = o.withFixed && !o.cat && !o.merch ? T.fixedInRange(S, o.from, o.to) : null;
  const tot = T.sum(rows.map(r => r.v)) + (fx ? fx.total : 0);
  const days = T.daysBetween(o.from, o.to) + 1, mF = days / T.DAYS_PER_MONTH;
  const self = () => A.spendSheet(o);
  const body = h("div");
  body.appendChild(h("div.row.between", { style: { alignItems: "flex-end" } }, h("div", h("div.big", A.money(tot)), h("div.small.muted", (o.from === o.to ? T.fmt.date(o.from) : T.tr("Dal {a} al {b}", { a: T.fmt.date(o.from), b: T.fmt.date(o.to) })) + " \u00b7 " + rows.length + T.tr(" movimenti"))),
    days >= 28 ? h("div", { style: { textAlign: "end" } }, h("div.mid", A.money(tot / mF)), h("div.small.muted", T.tr("al mese"))) : null));
  if (o.cat) { const b = +A.cat(o.cat).budget || 0, pm = tot / mF; if (b && days >= 28) body.appendChild(h("div", { style: { marginBlockStart: "8px" } }, T.progress(pm, Math.max(b, pm), pm > b ? "var(--bad)" : A.cat(o.cat).color, b), h("div.small.muted", pm > b ? "+" + A.money(pm - b) + T.tr(" al mese sopra il budget") + " (" + A.money(b) + ")" : A.money(b - pm) + T.tr(" al mese sotto il budget") + " (" + A.money(b) + ")"))); }
  /* andamento della parte scelta */
  if ((o.cat || o.merch) && days > 1) {
    const bk = A.buckets(o.from, o.to), idx = {}; bk.list.forEach((b, i) => { for (let d = b.from; d <= b.to; d = T.addDays(d, 1)) idx[d] = i; });
    const vals = bk.list.map(() => 0); for (const r of rows) if (idx[r.d] != null) vals[idx[r.d]] += r.v;
    const col = o.cat ? A.cat(o.cat).color : "var(--brand2)", box = h("div");
    body.appendChild(box);
    box.appendChild(T.columns(box, bk.list.map((b, i) => ({ l: b.l, title: b.title, parts: [{ v: vals[i], c: col }] })), { h: 150 }));
  }
  /* categorie (dettaglio di una colonna) */
  if (!o.cat && !o.merch) {
    const by = {}; for (const r of rows) by[r.cat] = (by[r.cat] || 0) + r.v;
    const list = h("div.list");
    if (fx && fx.total > 0) list.appendChild(h("div.li.tap", { onclick: () => A.fixedSheet(o.from, o.to, self) }, h("i.dot", { style: { background: T.FIXED_COLOR } }), h("div.grow", h("div.row.between", h("span.t", T.tr("Costi fissi")), h("b", A.money(fx.total))), T.progress(fx.total, tot, T.FIXED_COLOR)), h("span.muted", "\u203a")));
    Object.entries(by).sort((a, b) => b[1] - a[1]).forEach(([id, v]) => list.appendChild(h("div.li.tap", { onclick: () => A.spendSheet({ title: A.cat(id).name, from: o.from, to: o.to, cat: id, back: self }) },
      h("i.dot", { style: { background: A.cat(id).color } }), h("div.grow", h("div.row.between", h("span.t", A.cat(id).name), h("b", A.money(v))), T.progress(v, tot, A.cat(id).color), h("div.d", T.tr("{p} del totale", { p: T.fmt.pct(v / Math.max(1e-9, tot)) }))), h("span.muted", "\u203a"))));
    if (list.children.length) { body.appendChild(h("h4", T.tr("Per categoria"))); body.appendChild(list); }
  }
  /* esercenti principali di una categoria */
  if (o.cat) {
    const m = {}; for (const r of rows) { const k = r.t.note || r.t.desc; m[k] = m[k] || { v: 0, n: 0 }; m[k].v += r.v; m[k].n++; }
    const tops = Object.entries(m).sort((a, b) => b[1].v - a[1].v).slice(0, 5);
    if (tops.length > 1) { body.appendChild(h("h4", T.tr("Dove"))); body.appendChild(h("div.list", tops.map(([n, x]) => h("div.li.tap", { onclick: () => A.spendSheet({ title: n, from: o.from, to: o.to, merch: n, back: self }) }, h("div.grow", h("div.t", n), h("div.d", x.n + T.tr(" movimenti"))), h("div.a", A.money(x.v)))))); }
  }
  /* movimenti */
  body.appendChild(h("h4", T.tr("Movimenti")));
  const lst = h("div.list"), MAX = 80;
  rows.slice(0, MAX).forEach(r => lst.appendChild(A.txRow(r.t)));
  if (!rows.length) lst.appendChild(h("div.empty", T.tr("Nessuna spesa in questo periodo")));
  body.appendChild(lst);
  if (rows.length > MAX) body.appendChild(h("p.small.muted", T.tr("E altri {n} movimenti: usa la ricerca nella schermata Spese.", { n: rows.length - MAX })));
  T.sheet(o.title, body, [o.back ? h("button.btn", { type: "button", onclick: o.back }, T.tr("Indietro")) : null, h("button.btn.primary", { type: "button", onclick: () => T.closeSheet() }, T.tr("Chiudi"))].filter(Boolean));
};
/* dettaglio dei costi fissi del periodo */
A.fixedSheet = (from, to, back) => {
  const S = A.S, fx = T.fixedInRange(S, from, to), body = h("div");
  body.appendChild(h("div", h("div.big", A.money(fx.total)), h("div.small.muted", T.tr("Dal {a} al {b}", { a: T.fmt.date(from), b: T.fmt.date(to) }))));
  body.appendChild(h("p.small.muted", T.tr("I costi fissi sono distribuiti giorno per giorno: un mese intero conta l'importo mensile pieno, un pezzo di mese la sua parte.")));
  const FREQ = { mensile: T.tr("al mese"), bimestrale: T.tr("ogni 2 mesi"), trimestrale: T.tr("ogni 3 mesi"), semestrale: T.tr("ogni 6 mesi"), annuale: T.tr("all'anno") };
  body.appendChild(h("div.list", fx.items.map(({ f, v }) => h("div.li", h("div.grow", h("div.t", f.name), h("div.d", A.money(+f.amount || 0) + " " + (FREQ[f.freq] || "") + (f.freq !== "mensile" ? " \u00b7 " + A.money(T.monthlyOf(f)) + T.tr(" al mese") : ""))), h("div.a", A.money(v))))));
  if (!fx.items.length) body.appendChild(h("div.empty", T.tr("Nessun costo fisso inserito")));
  T.sheet(T.tr("Costi fissi"), body, [back ? h("button.btn", { type: "button", onclick: back }, T.tr("Indietro")) : null,
    h("button.btn", { type: "button", onclick: () => { T.closeSheet(); A.go("altro", "fissi"); } }, T.tr("Modifica")), h("button.btn.primary", { type: "button", onclick: () => T.closeSheet() }, T.tr("Chiudi"))].filter(Boolean));
};

/* riga di un movimento: tocca per modificarlo */
A.txRow = t => {
  const S = A.S, c = A.cat(t.cat), vac = T.isVacation(t, S);
  return h("div.li.tap", { onclick: () => A.editTx(t) }, h("i.dot", { style: { background: t.flow === "spesa" ? c.color : "var(--line)" } }),
      h("div.grow", h("div.t", t.note || t.desc), h("div.d", T.fmt.date(t.d) + " \u00b7 " + (t.flow === "spesa" ? c.name : t.flow === "escluso" ? T.tr(T.EXCLUDE_KINDS[t.kind] || "Escluso") : T.tr("Entrata")) + (vac && t.flow === "spesa" ? T.tr(" \u00b7 vacanza") : "") + (t.pending ? T.tr(" \u00b7 in sospeso") : "") + (t.cur !== S.profile.currency ? " \u00b7 " + T.fmt.n2(Math.abs(t.amtLoc)) + " " + t.cur : ""))),
      h("div.a" + (t.amt > 0 ? ".ok" : ""), (t.amt > 0 ? "+" : "") + T.fmt.n2(t.amt)));
};

/* modifica di un movimento: categoria, tipo, vacanza, nota; opzione T.tr("vale per tutti") */
A.editTx = t => {
  const S = A.S, st = { flow: t.flow, cat: t.cat || "altro", kind: t.kind || "interno", vac: t.vac === true ? "si" : t.vac === false ? "no" : "auto", note: t.note || "", all: true };
  const merchant = T.normMerchant(t.desc);
  const same = S.txs.filter(x => T.normMerchant(x.desc) === merchant).length;
  const catSel = T.selectField(T.tr("Categoria"), st.cat, S.categories.map(c => [c.id, c.name]), v => st.cat = v);
  const kindSel = T.selectField(T.tr("Tipo di movimento escluso"), st.kind, Object.entries(T.EXCLUDE_KINDS), v => st.kind = v);
  const sync = () => { catSel.hidden = st.flow !== "spesa"; kindSel.hidden = st.flow !== "escluso"; };
  const body = h("div",
    h("div.note", h("b", t.desc), h("div", T.fmt.date(t.d) + " \u00b7 " + T.fmt.n2(t.amt) + " " + S.profile.currency + (t.cur !== S.profile.currency ? " (" + T.fmt.n2(t.amtLoc) + " " + t.cur + ")" : "") + (t.rcat ? " \u00b7 " + t.rcat : ""))),
    h("div", { style: { blockSize: "12px" } }),
    h("div.lbl", T.tr("Che cos'e'")),
    T.seg([["spesa", T.tr("Spesa")], ["escluso", T.tr("Non e' una spesa")], ["entrata", T.tr("Entrata")]], st.flow, v => { st.flow = v; sync(); }),
    h("div", { style: { blockSize: "12px" } }), catSel, kindSel,
    h("div.lbl", T.tr("Vacanza")),
    T.seg([["auto", T.tr("Automatico")], ["si", T.tr("Si'")], ["no", "No"]], st.vac, v => st.vac = v),
    h("div", { style: { blockSize: "12px" } }),
    T.textField(T.tr("Nota o nome da mostrare (facoltativo)"), st.note, v => st.note = v),
    same > 1 || merchant ? h("label.row", { style: { gap: "10px" } }, h("input", { type: "checkbox", checked: true, onchange: e => st.all = e.target.checked }), h("span", T.tr("Vale anche per gli altri movimenti di \u00ab") + t.desc + T.tr("\u00bb e per quelli futuri") + (same > 1 ? " (" + same + T.tr(" in tutto)") : ""))) : null);
  sync();
  T.sheet(T.tr("Modifica movimento"), body, [
    h("button.btn", { type: "button", onclick: () => T.closeSheet() }, T.tr("Annulla")),
    h("button.btn.primary", { type: "button", onclick: () => {
      t.note = st.note.trim() || undefined;
      t.vac = st.vac === "si" ? true : st.vac === "no" ? false : undefined;
      const flow = st.flow, cat = flow === "spesa" ? st.cat : null, kind = flow === "escluso" ? st.kind : null;
      if (st.all) { T.addUserRule(S, t.desc, flow, cat, kind); t.manual = false; T.reclassifyAll(S); }
      else { t.manual = true; t.flow = flow; t.cat = cat; t.kind = kind; }
      T.closeSheet(); T.toast(st.all ? T.tr("Regola salvata: vale anche per i prossimi import") : T.tr("Movimento aggiornato")); A.changed();
    } }, T.tr("Salva"))]);
};
})();
