/* DOM minimo per eseguire l'app in Node e simulare i tocchi (solo test) */
"use strict";
let errors = [];
class Node_ { constructor() { this.childNodes = []; this.parentNode = null; this.listeners = {}; }
  get children() { return this.childNodes.filter(c => c instanceof Element_); }
  get firstChild() { return this.childNodes[0] || null; }
  appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this.childNodes.push(c); return c; }
  append(...cs) { cs.forEach(c => this.appendChild(typeof c === "string" ? new Text_(c) : c)); }
  removeChild(c) { const i = this.childNodes.indexOf(c); if (i > -1) this.childNodes.splice(i, 1); c.parentNode = null; return c; }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); }
  removeEventListener(t, f) { this.listeners[t] = (this.listeners[t] || []).filter(x => x !== f); }
  dispatch(t, extra) { const ev = Object.assign({ type: t, target: this, preventDefault() { }, stopPropagation() { } }, extra || {}); for (const f of (this.listeners[t] || []).slice()) { try { const r = f(ev); if (r && r.catch) r.catch(e => { errors.push(t + ": " + e.stack); }); } catch (e) { errors.push(t + ": " + e.stack); } } }
  get textContent() { return this.childNodes.map(c => c.textContent).join(""); }
  set textContent(v) { this.childNodes = []; if (v !== "" && v != null) this.appendChild(new Text_(String(v))); }
}
class Text_ extends Node_ { constructor(s) { super(); this.data = s; this.nodeType = 3; } get textContent() { return this.data; } set textContent(v) { this.data = v; } }
class Element_ extends Node_ {
  constructor(tag, ns) { super(); this.nodeType = 1; this.tagName = tag.toUpperCase(); this.ns = ns; this.attributes = {}; this.style = { setProperty() { } }; this.dataset = {}; this.hidden = false; this.disabled = false; this._value = ""; this.checked = false; this.id = "";
    const self = this; this.classList = { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); }, toggle(c, f) { if (f === undefined) f = !this._s.has(c); if (f) this._s.add(c); else this._s.delete(c); return f; } }; }
  get className() { return [...this.classList._s].join(" "); }
  set className(v) { this.classList._s = new Set(String(v).split(" ").filter(Boolean)); }
  get value() { return this._value; } set value(v) { this._value = String(v); }
  setAttribute(k, v) { this.attributes[k] = String(v); if (k === "id") this.id = v; if (k === "class") this.className = v; if (k === "hidden") this.hidden = true; if (k === "disabled") this.disabled = true; }
  getAttribute(k) { return this.attributes[k] ?? null; }
  removeAttribute(k) { delete this.attributes[k]; }
  get clientWidth() { return 360; }
  focus() { } click() { if (this.tagName === "INPUT" && this.attributes.type === "file") { global.__filePicked && global.__filePicked(this); return; } if (!this.disabled) this.dispatch("click"); }
  matches(sel) { return sel.split(",").some(s => matchOne(this, s.trim())); }
  querySelectorAll(sel) { const out = []; const walk = n => { for (const c of n.children) { if (c.matches(sel)) out.push(c); walk(c); } }; walk(this); return out; }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}
function matchOne(el, s) {
  const parts = s.split(/\s+/); const last = parts.pop();
  if (!simple(el, last)) return false;
  if (!parts.length) return true;
  let p = el.parentNode; const anc = parts.join(" ");
  while (p && p instanceof Element_) { if (matchOne(p, anc)) return true; p = p.parentNode; }
  return false;
}
function simple(el, s) {
  if (s === "*") return true;
  const m = s.match(/^([a-z0-9]*)((?:[.#][\w-]+)*)$/i); if (!m) throw new Error("selettore non gestito: " + s);
  if (m[1] && el.tagName !== m[1].toUpperCase()) return false;
  for (const x of (m[2] || "").match(/[.#][\w-]+/g) || []) { if (x[0] === "." && !el.classList.contains(x.slice(1))) return false; if (x[0] === "#" && el.id !== x.slice(1)) return false; }
  return true;
}
const body = new Element_("body");
const document = { body, documentElement: body,
  createElement: t => new Element_(t), createElementNS: (ns, t) => new Element_(t, ns), createTextNode: s => new Text_(s),
  getElementById: id => { const f = n => { for (const c of n.children) { if (c.id === id) return c; const r = f(c); if (r) return r; } return null; }; return f(body); },
  querySelectorAll: sel => body.querySelectorAll(sel), querySelector: sel => body.querySelector(sel),
  addEventListener: (t, f) => body.addEventListener(t, f) };
/* costruisce il guscio statico dall'HTML dell'app */
function buildShell(html) {
  const ids = ["title", "subtitle", "btnSync", "btnImport", "view", "sheet", "sheetBody", "toast", "filePick"];
  const tabs = new Element_("nav"); tabs.id = "tabs"; body.appendChild(tabs);
  for (const t of ["home", "spese", "budget", "fire", "altro"]) { const b = new Element_("button"); b.dataset.tab = t; tabs.appendChild(b); }
  for (const id of ids) { const e = new Element_(id === "filePick" ? "input" : "div"); e.id = id; if (id === "filePick") e.attributes.type = "file"; if (id === "sheet" || id === "btnSync") e.hidden = true; (id === "sheetBody" ? document.getElementById("sheet") : body).appendChild(e); }
}
module.exports = { document, Element_, buildShell, errors, all: () => body.querySelectorAll("*") };
