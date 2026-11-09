# Interactive Brokers: portafoglio automatico

Con questo collegamento l'app mostra il conto Interactive Brokers: valore, posizioni, ripartizione, andamento e dividendi. Il patrimonio del FIRE si aggiorna da solo.

**Come funziona**
- È solo lettura: l'app scarica un report, non può fare ordini né prelievi.
- Il token resta nel tuo ponte Cloudflare, non nell'app.
- I dati sono quelli di fine giornata: Interactive Brokers prepara i report dopo la chiusura.

Ti servono circa 10 minuti, una volta sola. Fallo dal computer.

## 1. Crea la Flex Query (in Interactive Brokers)

1. Entra nel portale di Interactive Brokers (Client Portal).
2. Apri **Performance & Reports**, poi **Flex Queries**.
3. Premi il **+** accanto a **Activity Flex Query**. Usa questa, non "Trade Confirmation".
4. **Query Name:** `myfinances`.
5. Aggiungi queste sezioni. In ognuna premi **Select All** sui campi e poi **Save**:
   - **Account Information**
   - **Open Positions**: nelle opzioni scegli **Summary**
   - **Cash Report**
   - **Net Asset Value (NAV) in Base**
   - **Cash Transactions**: nelle opzioni scegli **Dividends**, **Withholding Tax**, **Payment In Lieu Of Dividends** e **Deposits & Withdrawals**. Versamenti e prelievi servono per calcolare il rendimento senza contarli come guadagni o perdite.
6. In **Delivery Configuration**:
   - **Format:** **XML**
   - **Period:** **Last 365 Calendar Days**
7. Lascia il resto come è, premi **Continue** e poi **Create**.
8. Nell'elenco delle Flex Queries annota il **Query ID**, il numero accanto a `myfinances`.

## 2. Attiva il Flex Web Service e genera il token

1. Sempre in **Flex Queries**, apri **Flex Web Service Configuration** (l'icona dell'ingranaggio).
2. Spunta **Flex Web Service Status** e premi **Save**.
3. Imposta il token:
   - In **Should Expire After** scegli la durata più lunga disponibile.
   - Lascia **vuoto** il campo **Valid For IP Address**. Il ponte usa indirizzi che cambiano.
   - Premi **Generate New Token** e copia il token.
4. Annota la data di scadenza del token: l'app ti avviserà 14 giorni prima.

Generare un token nuovo disattiva quello vecchio. Quando lo rinnovi, aggiornalo anche nel ponte (punto 3).

## 3. Inseriscili nel ponte (Cloudflare)

1. Apri [dash.cloudflare.com](https://dash.cloudflare.com), poi **Workers & Pages**, e scegli il Worker del ponte.
2. Vai su **Settings**, poi **Variables and Secrets**, e premi **Add**. Aggiungi due variabili:
   - `IBKR_TOKEN`: tipo **Secret**, valore il token.
   - `IBKR_QUERY_ID`: tipo **Text**, valore il Query ID (solo numeri).
3. Premi **Deploy**.
4. Aggiorna il codice del ponte:
   - premi **Edit code**;
   - cancella tutto e incolla il contenuto di `ponte/worker.js` di questa versione (ponte 1.2.0);
   - premi **Deploy**.

Le altre variabili restano come sono.

## 4. Nell'app

1. Apri **Altro**, poi **Interactive Brokers**, e premi **Scarica il portafoglio**. Interactive Brokers prepara il report: di solito servono da 5 a 20 secondi.
2. Inserisci la data di scadenza del token nel campo **Il token scade il**.
3. Apri il portafoglio, poi **Nel FIRE**, e premi **Collega al FIRE**. L'app chiede se il patrimonio investito che avevi inserito comprende già Interactive Brokers:
   - **Sì:** l'app toglie il valore di Interactive Brokers e tiene il resto come "altri investimenti" (per esempio azioni del datore di lavoro e 3a investito).
   - **No:** il valore che avevi inserito diventa "altri investimenti" e Interactive Brokers si somma.

Da lì in poi:
- il portafoglio si aggiorna da solo all'apertura, al massimo ogni 12 ore;
- il FIRE usa altri investimenti più il valore aggiornato di Interactive Brokers;
- con la famiglia il portafoglio arriva anche sull'altro telefono.

## Problemi frequenti

| Messaggio | Cosa fare |
|---|---|
| Il token è scaduto / non è valido | Genera un token nuovo (punto 2) e aggiornalo nel ponte come `IBKR_TOKEN` (punto 3). |
| Il numero della Flex Query non è valido | Controlla `IBKR_QUERY_ID`: deve essere il numero di una **Activity** Flex Query. |
| Interactive Brokers sta ancora preparando il report | Normale soprattutto al mattino: riprova dopo qualche minuto. |
| Nel ponte mancano IBKR_TOKEN e IBKR_QUERY_ID | Ripeti il punto 3 e ricordati di premere Deploy. |
| Il ponte è di una versione precedente | Incolla il nuovo `ponte/worker.js` e premi Deploy. |
| Il token è limitato a un indirizzo IP | Genera un token nuovo lasciando vuoto il campo IP. |
| Manca il cambio USD (o un'altra valuta) | Il conto ha una valuta base diversa da quella dell'app: inserisci il cambio in **Altro**, poi **Profilo e reddito**. |

## Cosa vedi nell'app

- **Home:** il riquadro Portafoglio con il valore e il rendimento dell'ultimo mese. Toccalo per aprire il portafoglio, che sta nella voce **FIRE** (selettore Simulatore / Portafoglio in alto).
- **Grafico:** valore o rendimento % nel tempo, con gli orizzonti 1G, 1S, 1M, 3M, 6M, da inizio anno, 1A e tutto. Il rendimento è ponderato nel tempo (TWR), come in Interactive Brokers: versamenti e prelievi non contano.
- **Numeri chiave:** guadagno non realizzato, liquidità, dividendi degli ultimi 12 mesi e numero di posizioni.
- **Ripartizione:** a torta, per titolo, per tipo (ETF, azioni, liquidità...) o per valuta. Tocca una fetta per il dettaglio.
- **Posizioni:** quantità, prezzo, peso e guadagno. Tocca una posizione per costo, ISIN e borsa.
- **Dividendi:** netti dopo le ritenute, mese per mese negli ultimi 12 mesi.

Se l'andamento all'inizio mostra pochi giorni, nel report manca il valore giornaliero. Controlla che la sezione **Net Asset Value (NAV) in Base** sia inclusa. In ogni caso lo storico si costruisce da solo a ogni aggiornamento.
