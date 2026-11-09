---
name: app-nativa
description: Avvia il passaggio da PWA ad app nativa seguendo la roadmap del progetto, a tappe e senza rompere la versione web.
agent: agent
---
Obiettivo: trasformare **myFinances on FIRE** in un'app installabile dagli store, seguendo [conoscenza/06-app-nativa.md](../../conoscenza/06-app-nativa.md).

Regole per questo lavoro:
- La PWA su GitHub Pages deve continuare a funzionare a ogni passo, e anche il telefono di Debora che la usa.
- Lavora a tappe piccole. Per ognuna: proposta, conferma di Marco, modifica, test (`node tests/tutti.js`), commit.
- Nessuna dipendenza nell'app web (`src/`). Gli strumenti per l'app nativa (per esempio Capacitor) stanno in una cartella separata, ad esempio `app/`, con il loro `package.json`.
- I dati di chi passa dalla PWA all'app non si devono perdere: prevedi il passaggio con backup e ripristino, oppure con la famiglia (QR).
- Collegamento Revolut: l'indirizzo di ritorno di Enable Banking (REDIRECT_URL) cambia con l'app nativa. Pianifica il cambio con un App Link verificato (assetlinks.json) e le guide aggiornate.
- Dai a Marco i passi fuori dal codice (account Google Play, firma, Android Studio) in italiano, numerati, clic per clic.

Primo passo: presenta le opzioni del documento con i pro e i contro aggiornati, conferma la raccomandazione o spiega perché la cambieresti, ed elenca le domande per Marco. Non modificare file finché non risponde.
