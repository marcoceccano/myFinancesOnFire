# Famiglia: condividere l'app con un altro telefono

Con la famiglia due telefoni (per esempio tu e tua moglie) vedono e usano gli stessi dati:

- **Spese, categorie, regole, budget, costi fissi e vacanze:** li modificate tutti e due, e le modifiche arrivano sull'altro telefono.
- **FIRE e reddito:** li gestisce chi crea la famiglia. Gli altri li vedono e possono solo spostare il cursore dell'età per fare prove.
- **Revolut:** il collegamento passa con la famiglia. I movimenti li scarica un telefono alla volta e arrivano anche sull'altro. Il consenso lo rinnova chi l'ha dato.

I dati passano dal tuo ponte Cloudflare già cifrati sul telefono (AES-GCM a 256 bit). La chiave è solo nei telefoni della famiglia e nel QR: né Cloudflare né altri possono leggere la copia.

## 1. Prepara il ponte (una volta sola, circa 5 minuti)

Ti serve il ponte già funzionante (vedi `GUIDA-COLLEGAMENTO-REVOLUT.md`).

**a) Crea lo spazio di archivio**

1. Entra in [dash.cloudflare.com](https://dash.cloudflare.com).
2. Nel menu a sinistra apri **Storage & databases**, poi **Workers KV**.
3. Scegli **Create instance**, chiamalo `myfinances-famiglia` e conferma con **Create**.

**b) Collegalo al ponte**

1. Apri **Workers & Pages** e scegli il tuo Worker (il ponte).
2. Vai su **Settings**, poi **Bindings**, poi **Add**.
3. Scegli **KV namespace**.
4. Come *Variable name* scrivi esattamente `FAMIGLIA` (maiuscolo).
5. Come *KV namespace* scegli `myfinances-famiglia`.
6. Conferma con **Deploy**.

**c) Aggiorna il codice del ponte**

1. Nella pagina del Worker scegli **Edit code**.
2. Cancella tutto il codice e incolla il contenuto di `ponte/worker.js` di questa versione (versione 1.1.0 del ponte).
3. Conferma con **Deploy**.

Le variabili e i segreti che avevi già (EB_APP_ID, EB_PRIVATE_KEY, APP_TOKEN, ALLOWED_ORIGIN, REDIRECT_URL) restano come sono.

**d) Controlla**

Nell'app apri **Altro**, poi **Collegamento automatico Revolut**, poi **Verifica il ponte**. Deve comparire la riga "Spazio per la famiglia pronto".

## 2. Crea la famiglia (sul tuo telefono)

1. **Altro**, poi **Famiglia**.
2. Scrivi il tuo nome e tocca **Crea la famiglia**.
3. Tocca **Mostra il QR per aggiungere un telefono**.

## 3. Aggiungi il secondo telefono (Android)

1. Sul secondo telefono apri la **fotocamera** e inquadra il QR sul tuo schermo.
2. Tocca il collegamento che compare: si apre il browser con l'app e un invito.
3. Scrivi il nome di chi usa quel telefono e tocca **Entra nella famiglia**. In pochi secondi compaiono i dati.
4. Dal menu del browser (i tre puntini) scegli **Installa app** o **Aggiungi a schermata Home**.

Installa l'app dallo **stesso browser** che si è aperto con il QR: i dati restano lì. Su Android di solito è Chrome. Se si apre un altro browser, copia il collegamento, aprilo in Chrome e ripeti il punto 3.

## Sicurezza

- Mostra il QR **solo di persona**. Non fare screenshot e non mandarlo in chat: chi ha il QR vede tutte le vostre finanze.
- Se perdi un telefono, o il QR finisce in mani sbagliate: **Altro**, poi **Famiglia**, poi **Cambia la chiave**. Gli altri telefoni smettono di ricevere i dati finché non inquadrano il nuovo QR.
- Il backup non contiene la chiave della famiglia.

## Uscire o sciogliere

- **Chi è entrato** con il QR può uscire (**Esci dalla famiglia**). Sul suo telefono resta una copia dei dati, senza il collegamento Revolut.
- **Chi ha creato** la famiglia può scioglierla (**Sciogli la famiglia**). La copia sul ponte viene cancellata e ogni telefono tiene i dati che ha.
- Anche **Ricomincia da zero** scioglie la famiglia (se l'hai creata tu) oppure ti fa uscire (se ci sei entrato).

## Domande frequenti

**Se modifichiamo la stessa cosa insieme?**
Le modifiche a voci diverse si uniscono sempre. Se cambiate la stessa voce (per esempio il budget dei ristoranti) quasi nello stesso momento, vince l'ultima modifica arrivata.

**Quanto costa?**
Niente. Il piano gratuito di Cloudflare basta ampiamente per una famiglia.

**L'app si allinea anche a schermo spento?**
No. Si allinea quando la apri, alcuni secondi dopo ogni modifica e ogni 3 minuti mentre è aperta.
