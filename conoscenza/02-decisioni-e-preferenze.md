# Decisioni e preferenze

## Chi usa l'app

- **Marco e sua moglie**, in Svizzera (Ticino), con base in CHF. Sono due telefoni **Android**.
- L'obiettivo è il **FIRE** (indipendenza finanziaria) il prima possibile. Dopo il FIRE potrebbero trasferirsi in Italia.
- Marco usa l'app ogni giorno per il budget e ogni tanto per il FIRE e il portafoglio. La moglie entra con la famiglia: spese e budget li condividono.
- Banche e strumenti:
  - **Revolut** (Revolut Bank UAB, IBAN lituano) per le spese di tutti i giorni;
  - **UBS** per i costi fissi (letti dal PDF "Pagamenti registrati");
  - **Interactive Brokers** per gli investimenti;
  - un 3a e le azioni del datore di lavoro (vesting).

## Principi del prodotto

1. **I dati restano sul telefono.** Non c'è un server dell'app. L'unico server è il **ponte personale** dell'utente su Cloudflare, in sola lettura verso le banche. La copia della famiglia è cifrata sul telefono.
2. **App e dati separati.** Il codice è pubblicabile in qualsiasi momento. Un nuovo utente parte dalla configurazione guidata o dai dati di esempio.
3. **Zero dipendenze, offline, veloce.** Un solo file HTML con JS e CSS dentro, più il service worker.
4. **Tutto si tocca.** Ogni colonna, fetta, riga o grafico apre un dettaglio, di solito un foglio dal basso, da cui si va più a fondo (mese, categoria, movimento) e si torna "Indietro". Toccare non deve mai riportare in cima alla schermata.
5. **Meno ma utile.** Marco toglie i grafici che non gli dicono niente: ha tolto "ultime 8 settimane" e "giorni della settimana" da Spese. Meglio pochi grafici con un messaggio chiaro, verde se va bene e rosso se va male.
6. **Parole semplici.**
   - Testi in italiano corrente, frasi brevi, nessun gergo.
   - Gli errori spiegano cosa fare (per esempio "Il token è scaduto: generane uno nuovo e aggiornalo nel ponte come IBKR_TOKEN").
   - Niente trattini lunghi.

## Scelte di interfaccia (con il motivo)

| Scelta | Motivo |
|---|---|
| Stile **Bosco** (crema, verde bosco, ocra, terracotta, Rubik) | Marco trovava l'aspetto precedente "da app fatta con l'AI" (blu, carattere di sistema). L'ha scelto tra 4 proposte: Quotidiano finanziario, Svizzero, Bosco, Notte. |
| Home: budget settimanale, poi la settimana giorno per giorno (colonne per categoria, tetto tratteggiato), poi il mese con la tacca di "dove dovresti essere oggi" (cifra e differenza), poi portafoglio e FIRE | Prima di tutto il controllo quotidiano. FIRE e portafoglio sono un riassunto da toccare. |
| Spese di vacanza **a righe**, con un budget annuo a parte | Le vacanze non devono sforare il tetto della settimana. |
| Spese: periodo in testa (da inizio anno, da inizio mese, mese precedente, personalizzato) e interruttore **costi fissi** | Richiesta esplicita di Marco. I costi fissi sono distribuiti giorno per giorno. |
| FIRE: soglia **90%**, zone (sotto 50% non regge, 50-75% da rivedere, 75-85% ragionevole, 85-95% solido, da 95% molto probabile) | Stesso modello del simulatore HTML. "Il 100% non è l'obiettivo: la fascia sana è 85-95%." |
| FIRE: cursore dell'età, 4 riquadri (prima età al 90% con 80% e 95%, arrivo mediano, spesa media in pensione, capitale residuo), grafici toccabili collegati al cursore | Richiesta esplicita, con lo screenshot del simulatore HTML. |
| Portafoglio **dentro la voce FIRE** (selettore Simulatore / Portafoglio) | Richiesta esplicita (1.8). |
| Grafico del portafoglio come quello di Interactive Brokers (Valore / Rendimento, orizzonti da 1G a Tutto, TWR) | Richiesta esplicita con lo screenshot del portale di Interactive Brokers. |
| Famiglia: FIRE e reddito li gestisce chi crea la famiglia, il resto lo modificano tutti | Scelta di Marco. |

## Regole di calcolo concordate

- **Tetto settimanale** = budget mensile delle spese variabili × 12 / 52. **Tetto giornaliero** = × 12 / 365.
- **Costi fissi** = voci del PDF UBS e voci inserite a mano, con frequenza mensile, bimestrale, trimestrale, semestrale o annuale e un eventuale nuovo importo "dal". Il **3a è risparmio**, non un costo.
- **Medie mensili** = totale / (giorni coperti / 30,44).
- **FIRE.** I parametri predefiniti sono in `T.FIRE_DEFAULTS`. Il numero FIRE è la spesa annua divisa per il tasso di prelievo. I dettagli del modello sono in PROGETTO.md.
- **Portafoglio.**
  - Gli importi sono nella valuta base del conto, convertiti nella valuta dell'app con il cambio del profilo se diversa.
  - Il rendimento è TWR, con versamenti e prelievi presi dalle CashTransaction "Deposits/Withdrawals".

## Lingue

- La base è l'**italiano**. Ci sono **inglese** e **tedesco** standard (con il "du"), con il formato dei numeri svizzero (`de-CH`, apostrofo per le migliaia) quando la valuta è CHF.
- Cambiando lingua, i nomi creati dall'app (categorie, costi fissi predefiniti, ecc.) si traducono, ma solo se l'utente non li ha modificati.

## Come Marco lavora

- **Scrive in italiano.** Vuole proposte concrete e poi le conferma, a volte rispondendo solo "vai".
- **Prova sul telefono** e manda screenshot quando qualcosa non va.
- **Fuori dal codice** (GitHub, Cloudflare, Interactive Brokers, Enable Banking) vuole istruzioni numerate, clic per clic, che cosa incollare e dove.
- **Versioni chiare.** Ogni versione deve avere un numero visibile in Altro e un nome di pacchetto o tag che lo contiene, per non confondersi.
- **Nei messaggi** che scrive per altri non usa trattini lunghi e chiude con "thanks". Non riguarda l'app, ma è il suo stile.
