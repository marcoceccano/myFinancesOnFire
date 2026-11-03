/* myFinances on FIRE · lingue: italiano (testo di base), inglese, tedesco */
"use strict";
(function () {
T.LANGS = [["it", "Italiano"], ["en", "English"], ["de", "Deutsch"]];
T.LANG = "it";
T.MONTHS = {
  it: ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"],
  en: ["January","February","March","April","May","June","July","August","September","October","November","December"],
  de: ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"]
};
T.WEEKDAYS = {
  it: ["Luned\u00ec","Marted\u00ec","Mercoled\u00ec","Gioved\u00ec","Venerd\u00ec","Sabato","Domenica"],
  en: ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],
  de: ["Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Sonntag"]
};
T.monthNames = () => T.MONTHS[T.LANG] || T.MONTHS.it;
T.weekdays = () => T.WEEKDAYS[T.LANG] || T.WEEKDAYS.it;
T._miss = null;   /* nei test: insieme dei testi senza traduzione */
/* traduce un testo italiano; "~contesto" distingue chiavi uguali con significati diversi */
T.tr = (s, vars) => {
  if (typeof s !== "string" || !s) return s;
  let out;
  if (T.LANG === "it") out = s.indexOf("~") > 0 ? s.split("~")[0] : s;
  else {
    const d = T.DICT[T.LANG]; out = d ? d[s] : undefined;
    if (out === undefined) { out = s.indexOf("~") > 0 ? s.split("~")[0] : s; if (T._miss && /[a-zA-Z\u00c0-\u00ff]{3}/.test(s)) T._miss.add(s); }
  }
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => vars[k] != null ? vars[k] : m);
  return out;
};
T.detectLang = () => {
  try { for (const l of (navigator.languages || [navigator.language || ""])) { const c = String(l).slice(0, 2).toLowerCase(); if (T.LANGS.some(x => x[0] === c)) return c; } } catch (e) { }
  return "en";
};
T.setLang = (lang, currency) => {
  T.LANG = T.LANGS.some(x => x[0] === lang) ? lang : "it";
  const cur = currency || T.fmt.cur || "CHF";
  T.fmt.locale = cur === "CHF" ? T.LANG + "-CH" : ({ it: "it-IT", de: "de-DE", en: "en-GB" })[T.LANG];
  try { document.documentElement.lang = T.LANG; } catch (e) { }
};
/* cambia lingua anche ai nomi creati dall'app (categorie, costi fissi, ...) se non li hai rinominati */
T.relabel = (st, from, to) => {
  if (!st || from === to) return;
  const keys = Object.keys(T.DICT.en), back = {};
  for (const k of keys) { const v = from === "it" ? k.split("~")[0] : T.DICT[from] && T.DICT[from][k]; if (v && !(v in back)) back[v] = k; }
  const conv = s => { if (typeof s !== "string" || !(s in back)) return s; const k = back[s]; return to === "it" ? k.split("~")[0] : (T.DICT[to] && T.DICT[to][k]) || s; };
  (st.categories || []).forEach(c => c.name = conv(c.name));
  (st.fixed || []).forEach(f => f.name = conv(f.name));
  ((st.fire && st.fire.pensions) || []).forEach(p => p.name = conv(p.name));
  ((st.fire && st.fire.lumps) || []).forEach(p => p.name = conv(p.name));
  (st.vacations || []).forEach(v => v.label = conv(v.label));
};
})();
