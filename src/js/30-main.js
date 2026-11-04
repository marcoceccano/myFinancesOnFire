/* myFinances on FIRE · avvio, installazione e funzionamento offline */
"use strict";
(function () {
const A = T.A;
async function start() {
  const saved = await T.load();
  if (!saved) T.setLang(T.detectLang());
  A.S = saved || T.newState();
  T.setLang(A.S.profile.lang || "it", A.S.profile.currency);
  document.querySelectorAll("#tabs button").forEach(b => b.addEventListener("click", () => { A.ui.week = A.view === "home" ? A.ui.week : null; A.go(b.dataset.tab); }));
  T.$("btnImport").addEventListener("click", () => A.importFlow());
  T.$("btnSync").addEventListener("click", () => A.syncNow(false));
  /* stato salvato da un'altra finestra (per esempio il ritorno dal consenso Revolut): lo riprende */
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState !== "visible") return;
    try { const s = await T.load(); if (s && s.meta.lastSaved && (!A.S.meta.lastSaved || s.meta.lastSaved > A.S.meta.lastSaved)) { A.S = s; A.fire.key = ""; A.render(); } } catch (e) { }
    A.autoSync();
  });
  T.$("sheet").addEventListener("click", e => { if (e.target === T.$("sheet")) T.closeSheet(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") T.closeSheet(); });
  /* ridisegna solo se cambia la larghezza (rotazione, finestra): la tastiera del telefono cambia solo l'altezza
     e ridisegnare mentre scrivi chiuderebbe la tastiera */
  let rt = null, lastW = window.innerWidth;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      const w = window.innerWidth, ae = document.activeElement;
      if (w === lastW) return;
      lastW = w;
      if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName || "")) return;
      if (T.$("sheet").hidden) A.render();
    }, 200);
  });
  /* file condivisi verso l'app (Android "Condividi" o "Apri con") */
  if ("launchQueue" in window && window.launchQueue) window.launchQueue.setConsumer(async p => { for (const fh of p.files || []) { const f = await fh.getFile(); A.importFile({ name: f.name, buf: await f.arrayBuffer() }); } });
  A.go("home", null, true);
  /* ritorno dal consenso Revolut: ?code=...&state=... */
  let qs = null; try { qs = new URLSearchParams(location.search); } catch (e) { }
  if (qs && (qs.has("code") || qs.has("error"))) { try { history.replaceState(null, "", location.pathname); } catch (e) { } await A.finishConnect(qs); }
  else A.autoSync();
}
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); A.installPrompt = e; });
if ("serviceWorker" in navigator && /^https:$|^http:$/.test(location.protocol) && (location.protocol === "https:" || /^(localhost|127\.0\.0\.1)$/.test(location.hostname))) {
  navigator.serviceWorker.register("sw.js").then(reg => {
    reg.addEventListener("updatefound", () => { const nw = reg.installing; if (!nw) return; nw.addEventListener("statechange", () => { if (nw.state === "installed" && navigator.serviceWorker.controller) T.toast(T.tr("Nuova versione installata: riapri l'app per usarla")); }); });
  }).catch(() => { });
}
start().catch(e => { console.error(e); const v = T.$("view"); if (v) v.textContent = T.tr("Errore all'avvio: ") + (e.message || e); });
})();
