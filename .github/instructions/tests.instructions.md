---
applyTo: "tests/**"
---
# Test

- **Come girano.** I test usano Node puro, senza librerie. `dom-stub.js` è un DOM minimo: elementi, classi, selettori semplici, eventi con `dispatch`, `getBoundingClientRect` fisso a 360 px. Non c'è layout reale né CSS.
- **Come provano l'app.** Caricano `docs/index.html` già costruita. Quindi prima si esegue `python3 build.py` (lo fa `tests/tutti.js`).
- **Come si tocca un elemento.**
  - Pulsanti: `btn(root, "testo").click()`.
  - Righe: `li.dispatch("click")`.
  - Grafici: `rect.hit` con `dispatch("click", { clientX })`.
  - I testi sono quelli italiani.
- **Rete.**
  - La rete non esiste: Enable Banking, Interactive Brokers e KV sono simulati.
  - Il ponte vero (`ponte/worker.js`) si chiama direttamente con `worker.fetch(new Request(...), env)`.
- **Due telefoni.** `famiglia.js` crea due contesti `vm` separati, ognuno con la propria app e il proprio archivio.
- **Fixture.**
  - Sono sempre inventate (`tests/fixtures/`).
  - I dati reali non entrano mai nel repository: `npm run test:personale` usa il backup nella cartella accanto al repository; altrimenti le variabili d'ambiente `MFOF_BACKUP`, `MFOF_REVOLUT`, `MFOF_UBS`.
  - Ogni test deve passare anche senza dati reali.
- **Regole per una funzione nuova.**
  - Aggiungi almeno un controllo nel test dello schermo interessato.
  - Se ha testi nuovi, fai passare `lingue.js`: nessuna frase italiana deve restare nelle schermate in EN o DE.
- Un `FAIL` o un errore JavaScript (`stub.errors`) fa fallire il gruppo.
