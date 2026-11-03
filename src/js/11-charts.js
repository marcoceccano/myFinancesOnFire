/* myFinances on FIRE · grafici SVG leggeri, disegnati sul telefono */
"use strict";
(function () {
const W = el => Math.max(260, Math.min(720, (el && el.clientWidth) || 340));
const svgBox = (w, h, label) => { label = T.tr(label); const s = T.s("svg", { viewBox: `0 0 ${w} ${h}`, class: "chart", role: "img", "aria-label": label, width: "100%", height: h }); T.s("title", {}, s).textContent = label; return s; };
const txt = (svg, x, y, s, a) => { const t = T.s("text", Object.assign({ x, y }, a || {}), svg); t.textContent = T.tr(String(s)); return t; };
const nice = raw => { const p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-9)))), f = raw / p; return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p; };
T.nice = nice;

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
  const bw = iw / Math.max(1, items.length), gap = Math.min(10, bw * 0.25);
  items.forEach((it, i) => {
    let y = Tp + ih; const x = L + i * bw + gap / 2;
    for (const p of it.parts || [{ v: it.v, c: it.c }]) {
      if (p.v <= 0) continue; const hh = p.v / top * ih; y -= hh;
      const r = T.s("rect", { x, y, width: Math.max(2, bw - gap), height: hh, fill: p.c || "var(--brand2)", rx: 2 }, s);
      const tt = T.s("title", {}, r); tt.textContent = (it.title || it.l) + (p.n ? " · " + T.tr(p.n) : "") + ": " + T.fmt.money(p.v);
    }
    if (it.l) txt(s, x + (bw - gap) / 2, h - 7, it.l, { "text-anchor": "middle" });
    if (opt.onClick) { const hit = T.s("rect", { x: L + i * bw, y: Tp, width: bw, height: ih, fill: "transparent", style: "cursor:pointer" }, s); hit.addEventListener("click", () => opt.onClick(it, i)); }
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
  if (opt.thr != null) { T.s("line", { x1: L, x2: w - R, y1: Y(opt.thr), y2: Y(opt.thr), stroke: "var(--bad)", "stroke-dasharray": "5 4" }, s); txt(s, w - R, Y(opt.thr) - 5, opt.thrLabel || "", { "text-anchor": "end", style: "fill:var(--bad)" }); }
  T.s("polyline", { points: xs.map((x, i) => X(x).toFixed(1) + "," + Y(ys[i]).toFixed(1)).join(" "), fill: "none", stroke: "var(--brand2)", "stroke-width": 2.5 }, s);
  if (opt.mark != null) { T.s("line", { x1: X(opt.mark), x2: X(opt.mark), y1: Tp, y2: Tp + ih, stroke: "var(--ok)", "stroke-width": 2 }, s); txt(s, X(opt.mark) + 4, Tp + 12, opt.markLabel || "", { style: "fill:var(--ok);font-weight:650" }); }
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
  area("p10", "p90", "rgba(46,117,182,.16)"); area("p25", "p75", "rgba(46,117,182,.30)");
  const inTop = bands.filter(b => b.p50 <= top);
  T.s("polyline", { points: inTop.map(b => X(b.age) + "," + Y(b.p50)).join(" "), fill: "none", stroke: "var(--brand2)", "stroke-width": 2.5 }, s);
  if (inTop.length < bands.length) { const last = inTop[inTop.length - 1] || bands[0]; txt(s, X(last.age) - 4, Tp + 26, T.tr("↑ continua a salire"), { "text-anchor": "end", style: "fill:var(--brand2);font-size:11px" }); }
  T.s("polyline", { points: bands.map(b => X(b.age) + "," + Y(b.p10)).join(" "), fill: "none", stroke: "var(--bad)", "stroke-width": 1.4, "stroke-dasharray": "4 3" }, s);
  const stepX = Math.max(1, Math.round((a1 - a0) / 7));
  for (let a = a0; a <= a1; a += stepX) txt(s, X(a), h - 8, String(a), { "text-anchor": "middle" });
  if (opt.retire) { T.s("line", { x1: X(opt.retire), x2: X(opt.retire), y1: Tp, y2: Tp + ih, stroke: "var(--ok)", "stroke-width": 2 }, s); txt(s, X(opt.retire) + 4, Tp + 12, T.tr("FIRE a ") + opt.retire, { style: "fill:var(--ok);font-weight:650" }); }
  return s;
};
})();
