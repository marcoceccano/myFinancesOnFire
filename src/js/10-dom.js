/* myFinances on FIRE · piccoli strumenti per l'interfaccia (senza librerie) */
"use strict";
(function () {
const NS = "http://www.w3.org/2000/svg";
/* h("div.card#id", {attr}, figli...) */
T.h = (sel, attrs, ...kids) => {
  const m = sel.match(/^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i) || [];
  const el = document.createElement(m[1] || "div");
  (m[2] || "").replace(/([.#])([\w-]+)/g, (x, t, v) => { if (t === ".") el.classList.add(v); else el.id = v; return x; });
  if (attrs && (typeof attrs !== "object" || attrs.nodeType || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
  for (const k in attrs || {}) {
    const v = attrs[k]; if (v == null || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "class") String(v).split(" ").filter(Boolean).forEach(c => el.classList.add(c));
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k === "value") el.value = v;
    else if (k === "checked") el.checked = !!v;
    else if (k === "text") el.textContent = v;
    else if (k === "data") Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  T.add(el, kids);
  return el;
};
T.add = (el, kids) => { for (const k of kids.flat(3)) { if (k == null || k === false) continue; el.appendChild(typeof k === "object" ? k : document.createTextNode(String(k))); } return el; };
T.s = (tag, attrs, parent) => { const el = document.createElementNS(NS, tag); for (const k in attrs || {}) if (attrs[k] != null) el.setAttribute(k, attrs[k]); if (parent) parent.appendChild(el); return el; };
T.clear = el => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
T.$ = id => document.getElementById(id);

let toastT = null;
T.toast = msg => { const t = T.$("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2800); };

/* foglio dal basso (dialogo) */
let onClose = null;
T.sheet = (title, body, actions, closeCb) => {
  const sh = T.$("sheet"), b = T.$("sheetBody");
  T.clear(b); T.add(b, [T.h("h3", title), body]);
  if (actions && actions.length) b.appendChild(T.h("div.sheet-actions", actions));
  sh.hidden = false; onClose = closeCb || null;
  const first = b.querySelector("input,select,button"); if (first && first.focus) setTimeout(() => first.focus(), 30);
};
T.closeSheet = () => { const sh = T.$("sheet"); if (sh.hidden) return; sh.hidden = true; T.clear(T.$("sheetBody")); const f = onClose; onClose = null; if (f) f(); };
T.confirm = (title, text, okLabel, danger) => new Promise(res => {
  let done = false; const fin = v => { if (done) return; done = true; T.closeSheet(); res(v); };
  T.sheet(title, T.h("p.muted", text), [T.h("button.btn", { type: "button", onclick: () => fin(false) }, "Annulla"), T.h("button.btn" + (danger ? ".danger" : ".primary"), { type: "button", onclick: () => fin(true) }, okLabel || "Conferma")], () => fin(false));
});

/* campi di modulo */
T.numField = (label, value, onInput, opt) => {
  opt = opt || {};
  const inp = T.h("input", { type: "number", inputmode: "decimal", value: value == null ? "" : value, step: opt.step || "any", min: opt.min, max: opt.max, placeholder: opt.ph || "", "aria-label": label });
  inp.addEventListener("input", () => onInput(inp.value === "" ? null : +inp.value));
  return T.h("div.field", T.h("label", label), inp, opt.hint ? T.h("div.hint", opt.hint) : null);
};
T.textField = (label, value, onInput, opt) => {
  opt = opt || {};
  const inp = T.h("input", { type: opt.type || "text", value: value || "", placeholder: opt.ph || "", "aria-label": label });
  inp.addEventListener("input", () => onInput(inp.value));
  return T.h("div.field", T.h("label", label), inp, opt.hint ? T.h("div.hint", opt.hint) : null);
};
T.selectField = (label, value, options, onChange, opt) => {
  opt = opt || {};
  const sel = T.h("select", { "aria-label": label }, options.map(o => T.h("option", { value: o[0] }, o[1])));
  sel.value = value; sel.addEventListener("change", () => onChange(sel.value));
  return T.h("div.field", T.h("label", label), sel, opt.hint ? T.h("div.hint", opt.hint) : null);
};
T.seg = (options, value, onChange) => {
  const wrap = T.h("div.seg", { role: "group" });
  options.forEach(([v, l]) => wrap.appendChild(T.h("button", { type: "button", class: v === value ? "on" : "", "aria-pressed": v === value ? "true" : "false", onclick: () => { [...wrap.children].forEach(b => { b.classList.remove("on"); b.setAttribute("aria-pressed", "false"); }); const me = [...wrap.children][options.findIndex(o => o[0] === v)]; me.classList.add("on"); me.setAttribute("aria-pressed", "true"); onChange(v); } }, l)));
  return wrap;
};
T.kpi = (label, value, sub, cls) => T.h("div.kpi", T.h("div.l", label), T.h("div.v" + (cls ? "." + cls : ""), value), sub ? T.h("div.s", sub) : null);
T.progress = (value, max, color, tick) => {
  const pct = max > 0 ? T.clamp(value / max, 0, 1) : 0;
  const track = T.h("div.bar-track", T.h("div.bar-fill", { style: { inlineSize: (pct * 100).toFixed(1) + "%", background: color || "var(--brand2)" } }));
  if (tick != null && max > 0) track.appendChild(T.h("div.tick", { style: { insetInlineStart: (T.clamp(tick / max, 0, 1) * 100).toFixed(1) + "%" } }));
  return track;
};
T.icon = name => {
  const P = {
    home: "M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
    spese: "M4 20V10m6 10V4m6 16v-8m4 8H2",
    budget: "M12 3a9 9 0 1 0 9 9h-9z M14 3.3A9 9 0 0 1 20.7 10H14z",
    fire: "M12 2c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3-.5-3 0-6 1-8.5z",
    altro: "M4 6h16M4 12h16M4 18h16",
    import: "M12 3v12m0 0-5-5m5 5 5-5M4 21h16",
    back: "M15 5l-7 7 7 7",
    edit: "M4 20h4L19 9l-4-4L4 16z"
  };
  const svg = T.s("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" });
  T.s("path", { d: P[name] || P.altro }, svg); return svg;
};
T.download = (name, text, type) => {
  const blob = new Blob([text], { type: type || "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
};
T.pickFile = accept => new Promise(res => {
  const inp = T.$("filePick"); inp.value = ""; if (accept) inp.setAttribute("accept", accept);
  const h = () => { inp.removeEventListener("change", h); const f = inp.files && inp.files[0]; if (!f) return res(null); f.arrayBuffer().then(buf => res({ name: f.name, buf })); };
  inp.addEventListener("change", h); inp.click();
});
})();
