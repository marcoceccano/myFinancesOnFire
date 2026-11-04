/* myFinances on FIRE · grafici SVG leggeri, disegnati sul telefono */
"use strict";
(function () {
const W = el => Math.max(260, Math.min(720, (el && el.clientWidth) || 340));
const svgBox = (w, h, label) => { label = T.tr(label); const s = T.s("svg", { viewBox: `0 0 ${w} ${h}`, class: "chart", role: "img", "aria-label": label, width: "100%", height: h }); T.s("title", {}, s).textContent = label; return s; };
const txt = (svg, x, y, s, a) => { const t = T.s("text", Object.assign({ x, y }, a || {}), svg); t.textContent = T.tr(String(s)); return t; };
const nice = raw => { const p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-9)))), f = raw / p; return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p; };
T.nice = nice;
/* tratteggio obliquo per le spese di vacanza (budget a parte): c = "vac" */
let pid = 0;
const vacFill = svg => {
  if (!svg._vac) {
    const id = "vac" + (++pid), defs = T.s("defs", {}, svg);
    const p = T.s("pattern", { id, width: 6, height: 6, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, defs);
    T.s("rect", { x: 0, y: 0, width: 6, height: 6, fill: "var(--accent)", "fill-opacity": 0.35 }, p);
    T.s("rect", { x: 0, y: 0, width: 3, height: 6, fill: "var(--accent)" }, p);
    svg._vac = "url(#" + id + ")";
  }
  return svg._vac;
};
const paint = (svg, c) => c === "vac" ? vacFill(svg) : c;

/* anello di avanzamento */
T.ring = (pct, main, sub, color) => {
  const s = svgBox(132, 132, main + " " + (sub || "")), r = 54, c = 2 * Math.PI * r, p = T.clamp(pct, 0, 1);
  T.s("circle", { cx: 66, cy: 66, r, fill: "none", stroke: "var(--soft)", "stroke-width": 14 }, s);
  T.s("circle", { cx: 66, cy: 66, r, fill: "none", stroke: color || "var(--brand2)", "stroke-width": 14, "stroke-linecap": "round", "stroke-dasharray": `${(c * p).toFixed(1)} ${c.toFixed(1)}`, transform: "rotate(-90 66 66)" }, s);
  txt(s, 66, 66, main, { "text-anchor": "middle", class: "lbl-strong", style: "font-size:20px" });
  if (sub) txt(s, 66, 86, sub, { "text-anchor": "middle", style: "font-size:11px" });
  return s;
};

/* colonne (anche impilate) con linea di riferimento */
T.columns = (host, items, opt) => {
  opt = opt || {};
  const w = W(host), h = opt.h || 200, L = 44, R = 8, Tp = 12, B = 24, iw = w - L - R, ih = h - Tp - B;
  const s = svgBox(w, h, opt.label || T.tr("grafico a colonne"));
  const max = Math.max(opt.ref || 0, ...items.map(it => T.sum((it.parts || [{ v: it.v }]).map(p => Math.max(0, p.v)))), 1);
  const step = nice(max / 4), top = Math.ceil(max / step) * step;
  for (let v = 0; v <= top + 1e-9; v += step) { const y = Tp + ih - v / top * ih; T.s("line", { x1: L, x2: w - R, y1: y, y2: y, stroke: "var(--line)" }, s); txt(s, L - 6, y + 4, T.fmt.k(v), { "text-anchor": "end" }); }
  const bw = iw / Math.max(1, items.length), gap = Math.min(10, bw * 0.25), every = Math.max(1, Math.ceil(items.length / (opt.maxLabels || 8)));
  items.forEach((it, i) => {
    let y = Tp + ih; const x = L + i * bw + gap / 2;
    for (const p of it.parts || [{ v: it.v, c: it.c }]) {
      if (p.v <= 0) continue; const hh = p.v / top * ih; y -= hh;
      const r = T.s("rect", { x, y, width: Math.max(2, bw - gap), height: hh, fill: paint(s, p.c || "var(--brand2)"), rx: 2 }, s);
      const tt = T.s("title", {}, r); tt.textContent = (it.title || it.l) + (p.n ? " · " + T.tr(p.n) : "") + ": " + T.fmt.money(p.v);
    }
    if (it.l && i % every === 0) txt(s, x + (bw - gap) / 2, h - 7, it.l, { "text-anchor": "middle" });
    if (opt.onClick) { const hit = T.s("rect", { x: L + i * bw, y: Tp, width: bw, height: ih, fill: "transparent", style: "cursor:pointer", class: "hit" }, s); hit.addEventListener("click", () => opt.onClick(it, i)); }
  });
  if (opt.ref) { const y = Tp + ih - opt.ref / top * ih; T.s("line", { x1: L, x2: w - R, y1: y, y2: y, stroke: "var(--bad)", "stroke-dasharray": "5 4", "stroke-width": 1.6 }, s); txt(s, w - R, y - 4, opt.refLabel || "", { "text-anchor": "end", style: "fill:var(--bad);font-size:11px" }); }
  return s;
};

/* ciambella */
T.donut = (items, center, sub) => {
  const s = svgBox(180, 180, "composizione"), tot = T.sum(items.map(i => Math.max(0, i.v))) || 1;
  let a = -Math.PI / 2; const R = 80, r = 52;
  for (const it of items) {
    if (it.v <= 0) continue;
    const da = it.v / tot * Math.PI * 2, a2 = a + da - (items.length > 1 ? 0.012 : 0);
    const p = (ang, rad) => [90 + rad * Math.cos(ang), 90 + rad * Math.sin(ang)];
    const large = da > Math.PI ? 1 : 0, [x1, y1] = p(a, R), [x2, y2] = p(a2, R), [x3, y3] = p(a2, r), [x4, y4] = p(a, r);
    const path = da >= Math.PI * 2 - 0.02 ? `M90 10 A80 80 0 1 1 89.9 10 L89.9 38 A52 52 0 1 0 90 38Z` : `M${x1} ${y1} A${R} ${R} 0 ${large} 1 ${x2} ${y2} L${x3} ${y3} A${r} ${r} 0 ${large} 0 ${x4} ${y4}Z`;
    const el = T.s("path", { d: path, fill: it.c }, s); T.s("title", {}, el).textContent = it.n + ": " + T.fmt.money(it.v) + " (" + T.fmt.pct(it.v / tot) + ")";
    if (it.onClick) { el.style.cursor = "pointer"; el.addEventListener("click", it.onClick); }
    a += da;
  }
  txt(s, 90, 90, center, { "text-anchor": "middle", class: "lbl-strong", style: "font-size:17px" });
  if (sub) txt(s, 90, 108, sub, { "text-anchor": "middle" });
  return s;
};

/* linea con soglia (probabilita' per eta') */
T.lineChart = (host, xs, ys, opt) => {
  opt = opt || {};
  const w = W(host), h = opt.h || 210, L = 40, R = 10, Tp = 12, B = 26, iw = w - L - R, ih = h - Tp - B;
  const s = svgBox(w, h, opt.label || "grafico");
  const x0 = xs[0], x1 = xs[xs.length - 1], X = x => L + (x - x0) / Math.max(1, x1 - x0) * iw, Y = v => Tp + ih - v * ih;
  for (const v of [0, 0.25, 0.5, 0.75, 1]) { T.s("line", { x1: L, x2: w - R, y1: Y(v), y2: Y(v), stroke: "var(--line)" }, s); txt(s, L - 6, Y(v) + 4, T.fmt.pct(v), { "text-anchor": "end" }); }
  const stepX = Math.max(1, Math.round((x1 - x0) / 7));
  for (let x = x0; x <= x1; x += stepX) txt(s, X(x), h - 8, String(x), { "text-anchor": "middle" });
  if (opt.thr != null) { T.s("line", { x1: L, x2: w - R, y1: Y(opt.thr), y2: Y(opt.thr), stroke: "var(--muted)", "stroke-dasharray": "5 4" }, s); txt(s, w - R, Y(opt.thr) + 13, opt.thrLabel || "", { "text-anchor": "end", style: "fill:var(--muted)" }); }
  T.s("polyline", { points: xs.map((x, i) => X(x).toFixed(1) + "," + Y(ys[i]).toFixed(1)).join(" "), fill: "none", stroke: "var(--accent2)", "stroke-width": 2.5, "stroke-linejoin": "round" }, s);
  if (opt.mark != null) { T.s("line", { x1: X(opt.mark), x2: X(opt.mark), y1: Tp, y2: Tp + ih, stroke: "var(--muted)", "stroke-width": 1.2, "stroke-dasharray": "3 3" }, s); txt(s, X(opt.mark) + 4, Tp + ih * 0.55, opt.markLabel || "", { style: "fill:var(--muted);font-size:11px" }); }
  if (opt.sel != null && xs.includes(opt.sel)) {
    const i = xs.indexOf(opt.sel), xx = X(opt.sel), right = xx > L + iw * 0.7;
    T.s("line", { x1: xx, x2: xx, y1: Tp, y2: Tp + ih, stroke: "var(--brand)", "stroke-width": 2 }, s);
    T.s("circle", { cx: xx, cy: Y(ys[i]), r: 5.5, fill: "var(--brand)", stroke: "var(--card)", "stroke-width": 2 }, s);
    /* a destra della scelta la curva e' alta: etichetta in basso; a sinistra e' bassa: etichetta in alto */
    txt(s, xx + (right ? -6 : 6), right ? Tp + 12 : Tp + ih - 10, opt.selLabel || "", { "text-anchor": right ? "end" : "start", style: "fill:var(--brand);font-weight:700;font-size:12px" });
  }
  if (opt.onClick) {
    const hit = T.s("rect", { x: L, y: Tp, width: iw, height: ih, fill: "transparent", style: "cursor:pointer", class: "hit" }, s);
    hit.addEventListener("click", e => { const r = s.getBoundingClientRect(), vx = (e.clientX - r.left) / Math.max(1, r.width) * w; opt.onClick(Math.round(T.clamp(x0 + (vx - L) / iw * (x1 - x0), x0, x1))); });
  }
  return s;
};

/* ventaglio del patrimonio (percentili) */
T.fanChart = (host, bands, opt) => {
  opt = opt || {};
  const w = W(host), h = opt.h || 230, L = 48, R = 10, Tp = 12, B = 26, iw = w - L - R, ih = h - Tp - B;
  const s = svgBox(w, h, T.tr("patrimonio nel tempo"));
  /* scala sulla mediana: le code alte crescono troppo e schiaccerebbero il grafico */
  const focus = bands.filter(b => !opt.retire || b.age <= opt.retire + 15);
  const max = Math.max(...focus.map(b => b.p75), 1) * 1.1, step = nice(max / 4), top = Math.ceil(max / step) * step;
  const a0 = bands[0].age, a1 = bands[bands.length - 1].age;
  const X = a => L + (a - a0) / Math.max(1, a1 - a0) * iw, Y = v => Tp + ih - Math.min(v, top) / top * ih;
  for (let v = 0; v <= top + 1e-9; v += step) { T.s("line", { x1: L, x2: w - R, y1: Y(v), y2: Y(v), stroke: "var(--line)" }, s); txt(s, L - 6, Y(v) + 4, T.fmt.k(v), { "text-anchor": "end" }); }
  const area = (lo, hi, fill) => T.s("path", { d: "M" + bands.map(b => X(b.age) + "," + Y(b[hi])).join(" L") + " L" + bands.slice().reverse().map(b => X(b.age) + "," + Y(b[lo])).join(" L") + "Z", fill, stroke: "none" }, s);
  area("p10", "p90", "var(--fan1)"); area("p25", "p75", "var(--fan2)");
  const inTop = bands.filter(b => b.p50 <= top);
  T.s("polyline", { points: inTop.map(b => X(b.age) + "," + Y(b.p50)).join(" "), fill: "none", stroke: "var(--brand2)", "stroke-width": 2.5 }, s);
  if (inTop.length < bands.length) { const last = inTop[inTop.length - 1] || bands[0]; txt(s, X(last.age) - 4, Tp + 26, T.tr("↑ continua a salire"), { "text-anchor": "end", style: "fill:var(--brand2);font-size:11px" }); }
  T.s("polyline", { points: bands.map(b => X(b.age) + "," + Y(b.p10)).join(" "), fill: "none", stroke: "var(--bad)", "stroke-width": 1.4, "stroke-dasharray": "4 3" }, s);
  const stepX = Math.max(1, Math.round((a1 - a0) / 7));
  for (let a = a0; a <= a1; a += stepX) txt(s, X(a), h - 8, String(a), { "text-anchor": "middle" });
  if (opt.retire) { T.s("line", { x1: X(opt.retire), x2: X(opt.retire), y1: Tp, y2: Tp + ih, stroke: "var(--brand)", "stroke-width": 2 }, s); txt(s, X(opt.retire) + 4, Tp + 12, T.tr("FIRE a ") + opt.retire, { style: "fill:var(--brand);font-weight:650" }); }
  if (opt.pick != null) {
    const b = bands.find(x => x.age === opt.pick);
    if (b) { T.s("line", { x1: X(b.age), x2: X(b.age), y1: Tp, y2: Tp + ih, stroke: "var(--ink)", "stroke-width": 1.2, "stroke-dasharray": "3 3" }, s);
      T.s("circle", { cx: X(b.age), cy: Y(b.p50), r: 4.5, fill: "var(--brand2)", stroke: "var(--card)", "stroke-width": 2 }, s);
      T.s("circle", { cx: X(b.age), cy: Y(b.p10), r: 4, fill: "var(--bad)", stroke: "var(--card)", "stroke-width": 2 }, s); }
  }
  if (opt.onPick) {
    const hit = T.s("rect", { x: L, y: Tp, width: iw, height: ih, fill: "transparent", style: "cursor:pointer", class: "hit" }, s);
    hit.addEventListener("click", e => { const r = s.getBoundingClientRect(), vx = (e.clientX - r.left) / Math.max(1, r.width) * w; opt.onPick(Math.round(T.clamp(a0 + (vx - L) / iw * (a1 - a0), a0, a1))); });
  }
  return s;
};
/* semicerchio della probabilita' di riuscita, con le 5 zone */
T.gauge = (p, label, opt) => {
  opt = opt || {};
  const mini = !!opt.mini, s = svgBox(210, mini ? 112 : 124, T.tr("Probabilita' di riuscita") + " " + T.fmt.pct(p) + ", " + T.tr(label));
  if (mini) s.setAttribute("height", opt.h || 96); else s.setAttribute("height", opt.h || 124);
  s.style.maxInlineSize = mini ? "190px" : "260px";
  const cx = 105, cy = 100, R = 82, sw = mini ? 18 : 16;
  const pt = (a, r) => [cx - r * Math.cos(Math.PI * a), cy - r * Math.sin(Math.PI * a)];
  let a0 = 0;
  for (const z of T.FIRE_ZONES) {
    const a1 = Math.min(1, z.to), [x0, y0] = pt(a0 + 0.004, R), [x1, y1] = pt(a1 - 0.004, R);
    T.s("path", { d: `M${x0.toFixed(1)} ${y0.toFixed(1)} A${R} ${R} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`, fill: "none", stroke: z.c, "stroke-width": sw, opacity: p >= a0 && p < z.to ? 1 : 0.55 }, s);
    a0 = a1;
  }
  const pp = T.clamp(p, 0, 1), [nx0, ny0] = pt(pp, R - sw / 2 - 14), [nx1, ny1] = pt(pp, R + sw / 2 + 2);
  T.s("line", { x1: nx0.toFixed(1), y1: ny0.toFixed(1), x2: nx1.toFixed(1), y2: ny1.toFixed(1), stroke: "var(--ink)", "stroke-width": 4, "stroke-linecap": "round" }, s);
  const [dx, dy] = pt(pp, R);
  T.s("circle", { cx: dx.toFixed(1), cy: dy.toFixed(1), r: 5, fill: "var(--card)", stroke: "var(--ink)", "stroke-width": 2.5 }, s);
  txt(s, cx, cy - (mini ? 18 : 26), T.fmt.pct(p), { "text-anchor": "middle", class: "lbl-strong", style: "font-size:" + (mini ? 30 : 30) + "px" });
  txt(s, cx, cy - (mini ? 0 : 6), label, { "text-anchor": "middle", style: "font-size:" + (mini ? 13 : 12) + "px;font-weight:700;fill:var(--muted)" });
  if (!mini) { txt(s, cx - R, cy + 18, "0%", { "text-anchor": "middle" }); txt(s, cx + R, cy + 18, "100%", { "text-anchor": "middle" }); }
  return s;
};

/* settimana giorno per giorno: colonne impilate per categoria, tetto giornaliero tratteggiato */
T.dayChart = (host, days, opt) => {
  opt = opt || {};
  const w = W(host), h = opt.h || 190, L = 6, R = 6, Tp = 18, B = 24, iw = w - L - R, ih = h - Tp - B;
  const s = svgBox(w, h, opt.label || T.tr("Spese della settimana giorno per giorno"));
  const tot = d => T.sum(d.parts.map(p => Math.max(0, p.v)));
  const max = Math.max(opt.cap || 0, ...days.map(tot), 1) * 1.12;
  const Y = v => Tp + ih - v / max * ih, bw = iw / 7, cw = Math.min(42, bw * 0.62);
  T.s("line", { x1: L, x2: w - R, y1: Tp + ih, y2: Tp + ih, stroke: "var(--line)" }, s);
  days.forEach((d, i) => {
    const x = L + i * bw + (bw - cw) / 2;
    if (opt.sel === i) T.s("rect", { x: x - 4, y: Tp - 14, width: cw + 8, height: ih + 16, rx: 8, fill: "var(--soft)" }, s);
    if (d.future) T.s("rect", { x, y: Y(opt.cap || max * 0.5), width: cw, height: Tp + ih - Y(opt.cap || max * 0.5), rx: 6, fill: "none", stroke: "var(--line)", "stroke-dasharray": "3 3" }, s);
    else {
      let y = Tp + ih; const n = d.parts.filter(p => p.v > 0).length; let j = 0;
      for (const p of d.parts) {
        if (p.v <= 0) continue; j++;
        const hh = Math.max(1.5, p.v / max * ih); y -= hh;
        const r = T.s("rect", { x, y, width: cw, height: hh, fill: paint(s, p.c), rx: j === n ? 5 : 0 }, s);
        T.s("title", {}, r).textContent = d.label + " · " + p.n + ": " + T.fmt.money(p.v);
        if (j === n && hh > 6) T.s("rect", { x, y: y + hh - Math.min(hh, 6), width: cw, height: Math.min(hh, 6), fill: paint(s, p.c) }, s);
      }
      if (tot(d) > 0) txt(s, x + cw / 2, y - 5, T.fmt.n0(tot(d)), { "text-anchor": "middle", style: "font-size:11px;font-weight:700;fill:var(--ink)" });
      else txt(s, x + cw / 2, Tp + ih - 5, "0", { "text-anchor": "middle", style: "font-size:11px;fill:var(--muted)" });
    }
    txt(s, x + cw / 2, h - 7, d.short, { "text-anchor": "middle", style: d.today ? "font-size:12px;font-weight:700;fill:var(--brand)" : "font-size:12px" });
    if (opt.onClick && !d.future) { const hit = T.s("rect", { x: L + i * bw, y: 0, width: bw, height: h, fill: "transparent", style: "cursor:pointer", class: "hit", "data-day": i }, s); hit.addEventListener("click", () => opt.onClick(d, i)); }
  });
  /* il valore del tetto e' nella legenda sotto il grafico, cosi' non copre le colonne */
  if (opt.cap) { const y = Y(opt.cap); T.s("line", { x1: L, x2: w - R, y1: y, y2: y, stroke: "var(--accent2)", "stroke-dasharray": "5 4", "stroke-width": 1.5 }, s); }
  return s;
};
})();
