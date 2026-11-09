---
applyTo: "ponte/**"
---
# Ponte (Cloudflare Worker personale)

- Il ponte è l'unico punto che parla con servizi esterni: Enable Banking (Revolut), Workers KV (famiglia) e Interactive Brokers (Flex Web Service). L'app parla solo con il ponte.
- **Sola lettura.** Nessun percorso per pagamenti, ordini o prelievi. I percorsi sono a elenco chiuso (`switch` su `url.pathname`). Tutto il resto risponde 404.
- **Sicurezza.**
  - Ogni POST richiede l'origine in `ALLOWED_ORIGIN` e `Authorization: Bearer APP_TOKEN`, confrontato in tempo costante.
  - I segreti (`EB_PRIVATE_KEY`, `APP_TOKEN`, `IBKR_TOKEN`) non tornano mai nelle risposte, neanche negli errori.
  - Gli input si validano (UUID, date, codici).
- **Variabili.** `EB_APP_ID`, `EB_PRIVATE_KEY`, `APP_TOKEN`, `ALLOWED_ORIGIN`, `REDIRECT_URL`. Facoltative: binding KV `FAMIGLIA`, `IBKR_TOKEN`, `IBKR_QUERY_ID`. Documentale in testa al file e nelle guide.
- **Compatibilità.** Marco aggiorna il ponte incollando il file nell'editor di Cloudflare. Una versione nuova del ponte deve funzionare con l'app precedente e viceversa. L'app riconosce un ponte vecchio dalla risposta 404 `not_found` e lo spiega.
- **Versione.** A ogni modifica aggiorna `VERSION`, i test in `tests/ponte.mjs` e la versione citata nei messaggi dell'app e nelle guide.
- **Limiti esterni.**
  - Interactive Brokers: al massimo 1 richiesta al secondo e 10 al minuto per token.
  - Revolut (PSD2): circa 4 accessi al giorno senza l'utente presente.
  - KV gratuito: 1000 scritture al giorno.
- Il file è un ES module (`export default { fetch }`). `ponte/package.json` dichiara `"type": "module"` solo per Node nei test.
