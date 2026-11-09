# Backlog e questioni aperte

## Questioni aperte (da chiedere a Marco)

1. **Reddito netto mensile.**
   - Nell'app era impostato con la media 2026 del foglio Stipendio dell'Excel. Quella media comprende bonus e azioni ed è più alta di un mese normale: per il 2025 e il 2024 il netto medio mensile era più basso.
   - Così tasso di risparmio, risparmio del FIRE ed età FIRE risultano ottimisti.
   - Proposte fatte: il netto di un mese normale (prudente) oppure il netto annuo / 12 dell'ultimo anno intero. Se la moglie ha un reddito, si somma.
   - **Marco non ha ancora scelto.** Una possibile funzione: separare "netto fisso al mese" e "bonus e azioni all'anno".
2. **Consenso Revolut.** Non è confermato che il collegamento automatico scarichi davvero i movimenti (passo 3 nell'app). Chiedere.
3. **Interactive Brokers.**
   - Non è confermato che Flex Query, token e ponte 1.2.0 siano configurati, né che il primo report reale venga letto bene.
   - Al primo uso confronta valore, posizioni e TWR con il portale (il loro "Performance TWR" parte dall'apertura del conto, il nostro dal primo giorno salvato).
   - Ricordarsi di "Deposits & Withdrawals" nella Flex Query.
4. **Ponte.** È stato aggiornato alla 1.2.0? Si controlla in Altro > Collegamento automatico > Verifica il ponte: deve comparire la riga "Interactive Brokers configurato".

## Idee e richieste non ancora fatte

**Dall'Excel "Life Planning"** (la richiesta iniziale, non ancora portata nell'app):
- progressione dello **stipendio** negli anni e **peso delle tasse** sul lordo;
- **net worth** nel tempo (patrimonio totale: conti, 3a, 2° pilastro, Interactive Brokers, azioni del datore di lavoro);
- **vesting delle azioni** del datore di lavoro, nel patrimonio e nel FIRE;
- **spese per anno** (progressione), oltre al periodo libero già presente.

**FIRE** (dal simulatore HTML v15, non tutto è nell'app):
- spesa **base e flessibile** (75/25) con i guardrail;
- **riserva di liquidità** di 2 anni;
- **acquisto della casa** a una certa data;
- orizzonte legato all'età della moglie (fino ai suoi 100 anni);
- capitale residuo minimo desiderato;
- rendite con indicizzazione parziale, imposte sulle sole plusvalenze, ritiro del 2° pilastro a età variabile;
- dopo il FIRE in Italia: spese in EUR, fiscalità diversa.

**App:**
- notifiche: budget settimanale superato, token o consenso in scadenza (con l'app nativa);
- blocco con impronta (con l'app nativa);
- "Condividi" un estratto dall'app della banca verso myFinances (Web Share Target o nativo);
- altre banche europee con Enable Banking (il ponte è già generico; serve la scelta della banca nell'app);
- francese per la Svizzera romanda (nuovo blocco nel dizionario);
- budget per persona dentro la famiglia (chi ha speso cosa), se richiesto;
- export CSV o Excel delle spese per il commercialista o per l'Excel personale;
- aggiornamento del ponte con `wrangler deploy` invece del copia e incolla.

## Debito tecnico

- `03-dict.js` è un unico file grande (circa 950 voci per lingua). Si potrebbe dividere per lingua, mantenendo lo stesso formato.
- Alcune schermate (`24-altro.js`, `27-portafoglio.js`) sono lunghe: dividerle per sottoschermata quando servirà toccarle.
- I test girano su un DOM finto. Un controllo nel browser vero (per esempio Playwright, solo come strumento di sviluppo e fuori da `src/`) darebbe più sicurezza su layout e grafici. Va proposto a Marco prima di aggiungere dipendenze.
- Pulizia privacy alla prossima versione:
  - `03-dict.js` contiene ancora la traduzione di un costo fisso con il nome del paese di Marco ("Affitto casa Pura"). Va tolta: la traduzione dei nomi scelti dall'utente non serve.
  - I test delle versioni fino alla 1.8 avevano un IBAN di un destinatario quasi reale. Nel pacchetto per Copilot è stato sostituito con uno inventato (`CH00...`).
  - Se quei test erano già su GitHub, resta nella cronologia del repository. Si può lasciare (è l'IBAN di un'agenzia, non di Marco) oppure ripulire la cronologia, ma solo con il consenso di Marco.
