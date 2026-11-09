---
applyTo: "src/js/**"
---
# Codice dell'app (src/js)

**Moduli e build**
- Sono file IIFE che aggiungono funzioni a `T` (logica) o a `T.A` (interfaccia).
- L'ordine conta: le costanti di un modulo possono usare solo i moduli precedenti in `ORDER` di `build.py`.
- Un modulo nuovo va aggiunto a `ORDER`, nella posizione giusta.

**Testi**
- Ogni testo visibile passa da `T.tr()`.
- I testi con valori usano i segnaposto: `T.tr("Dal {a} al {b}", { a, b })`.
- Se la stessa parola italiana ha significati diversi, usa una chiave con contesto: `"Altro~menu"`, `" anni~eta"`. La parte dopo `~` non si vede in italiano.
- Le costanti a livello di modulo restano in italiano: traducile al momento del disegno (`T.tr(nome)`), perché la lingua può cambiare dopo il caricamento.
- Aggiungi sempre EN e DE in `03-dict.js`, inserendole nei due blocchi `"en"` e `"de"`. Il tedesco è standard, con il "du".
- Verifica con `node tests/traduzioni-mancanti.js`.

**Interfaccia**
- Usa `T.h()` per il DOM e `T.s()` per l'SVG.
- Nei dettagli si va dal basso con `T.sheet(titolo, corpo, azioni)`. Si chiude con `T.closeSheet()`.
- Tutto ciò che si vede deve essere toccabile e aprire un dettaglio: colonne, fette, righe, grafici. Il punto toccabile ha la classe `hit` (nei grafici) oppure `li tap` (negli elenchi).
- `A.render()` ridisegna e mantiene lo scorrimento. `A.go(view, sub)` cambia schermata e si usa solo per navigare.
- Mentre l'utente scrive o un foglio è aperto, non ridisegnare per eventi di sfondo (vedi `A.softRender()` e la gestione del resize in `30-main.js`). È un bug già visto: la tastiera del telefono si chiudeva.

**Dati**
- Lo stato è uno solo, `A.S`. Si salva con `A.save()` (posticipato) o `T.save(st, true)` (subito).
- Dopo una modifica che cambia i conti, usa `A.changed()`, che svuota la cache del FIRE e ridisegna.
- I campi nuovi vanno in `T.newState()` o `T.FIRE_DEFAULTS`, i dati vecchi si convertono in `T.migrate()`.
- Se il campo va condiviso in famiglia, aggiornalo anche in `13-family.js` (`T.famShared`, `T.famMerge`, `T.famApply`).

**Date e importi**
- Le date sono stringhe locali `YYYY-MM-DD`. Usa `T.today()`, `T.addDays()`, `T.daysBetween()`, `T.weekStart()` (la settimana parte da lunedì).
- Gli importi delle spese sono negativi in `t.amt`. `T.spendRows()` li restituisce positivi.
