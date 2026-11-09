# Storia del progetto

## Prima dell'app (settembre e ottobre 2026)

Marco teneva la pianificazione finanziaria in un file Excel ("Life Planning"), con fogli per stipendio, net worth, spese, auto e consumi di casa. Il lavoro è partito da lì:

- **Dashboard Excel.** Fogli nuovi collegati ai dati grezzi, che restano modificabili mese per mese:
  - progressione FIRE;
  - stipendio e peso delle tasse negli anni;
  - spese;
  - portafoglio con torte;
  - in seguito, il vesting delle azioni del datore di lavoro.
- **Simulatore "Monte Carlo FIRE.html".** Pagina singola, arrivata alla versione 15:
  - sequenze storiche ricampionate e guardrail;
  - spesa base e flessibile;
  - riserva di liquidità;
  - acquisto della casa;
  - orizzonte fino ai 100 anni della moglie.

  Il modello del FIRE dell'app viene da qui. Il modello di interfaccia per la schermata FIRE della 1.4 (cursore dell'età, indicatore a zone, 4 riquadri) è questa pagina.
- **Analisi delle spese.** Partita dall'export Revolut (gennaio-ottobre 2026), con la pagina "Dashboard spese 2026.html", i costi fissi letti dal PDF UBS e una proposta di budget: circa 740 CHF a settimana divisi in "cassetti".

Da qui l'idea: un'app sul telefono per il budget di ogni giorno che usi gli stessi dati e lo stesso simulatore.

## Versioni dell'app

| Versione | Data | Cosa |
|---|---|---|
| 1.0 "Traguardo" | 27.10.2026 | PWA da zero, senza dipendenze, dati solo sul telefono (IndexedDB). Contiene: budget settimanale; spese per mese, categoria ed esercente; budget con proposte; FIRE Monte Carlo; import Revolut (xlsx e csv), PDF UBS "Pagamenti registrati" e CSV generico; categorie e regole degli esercenti; configurazione guidata; dati di esempio; funzionamento offline. |
| 1.1 | fine ottobre | Nuovo nome **myFinances on FIRE** e nuova icona. Riprende i dati e i backup del vecchio nome ("traguardo"). |
| 1.2 | entro il 03.11 | **Revolut automatico**: Enable Banking (open banking, sola lettura) con un **ponte** personale su Cloudflare Workers. |
| 1.3 | 03.11 | **Inglese e tedesco**: dizionario con chiave il testo italiano; pagine privacy e termini in 3 lingue. |
| 1.3.1 | 03.11 | Correzione: sul telefono la tastiera si chiudeva da sola nei campi di testo (vedi trappole). |
| 1.4 | 04.11 | **Home** con la settimana giorno per giorno e il pannello di ogni giorno; le ultime 8 settimane spostate in Spese. **FIRE** come il simulatore HTML: cursore dell'età, indicatore a 5 zone, 4 riquadri, grafici da toccare. Soglia al 90%. **Stile Bosco** scelto tra 4 proposte, con il carattere Rubik incluso, il tema scuro e l'icona nuova. |
| 1.5 | 04.11 | **Famiglia**: QR, copia cifrata AES-GCM nel ponte (Workers KV), unione a tre vie, ruoli (FIRE e reddito li gestisce chi crea la famiglia). **Ricomincia da zero** al posto di "Cancella tutti i dati". Ponte 1.1.0. |
| 1.6 | 04.11 | Home: cifra a cui dovresti essere oggi e differenza (verde o rossa). **Spese**: periodo in testa (da inizio anno, da inizio mese, mese precedente, personalizzato), costi fissi sì o no, grafico che passa da giorni a settimane a mesi, dettagli dal basso su tutto. Tolti il grafico delle ultime 8 settimane e quello dei giorni della settimana. Correzione del salto in cima a ogni tocco. |
| 1.7 | 06.11 | **Interactive Brokers**: report Flex dal ponte (ponte 1.2.0). Riquadro in Home, schermata Portafoglio (valore, ripartizione a torta, posizioni, dividendi). Il patrimonio del FIRE si aggiorna da solo ("altri investimenti" più Interactive Brokers). |
| 1.8 | 06.11 | Il **portafoglio** è dentro la voce FIRE (selettore Simulatore / Portafoglio). Grafico **Valore / Rendimento %** con gli orizzonti 1G, 1S, 1M, 3M, 6M, da inizio anno, 1A e tutto. Rendimento **TWR**: versamenti e prelievi esclusi. |
| Passaggio a Copilot | 09.11 | Pacchetto con le istruzioni per GitHub Copilot, questa cartella di conoscenza, `tests/tutti.js`, `package.json` (solo comandi) e test che passano anche senza dati personali. Nessuna modifica all'app (sempre 1.8.0). |

## Come lavoravamo

- Ogni versione era uno zip con il nome della versione, per esempio "myFinances on FIRE v1.8.zip". Dentro c'erano la cartella del progetto e, a parte, il backup personale di Marco.
- Marco aggiornava GitHub dal sito, trascinando il contenuto della cartella `docs`, e Cloudflare incollando `ponte/worker.js` nell'editor.
- Con VS Code e git il flusso diventa: commit, push su `main`, e GitHub Pages pubblica `docs/`. Il ponte va ancora incollato a mano in Cloudflare (oppure si passa a `wrangler deploy`, vedi il backlog).
