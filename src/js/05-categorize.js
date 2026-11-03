/* myFinances on FIRE · categorie e regole predefinite (generiche, senza dati personali) */
"use strict";
(function () {
T.DEFAULT_CATEGORIES = [
  { id: "alimentari",   name: "Alimentari",               color: "#5E9E3E", essential: true  },
  { id: "ristoranti",   name: "Ristoranti e bar",         color: "#E0A800", essential: false },
  { id: "shopping",     name: "Shopping e abbigliamento", color: "#D64545", essential: false },
  { id: "casa",         name: "Casa e utenze",            color: "#1F5F8B", essential: true  },
  { id: "trasporti",    name: "Auto e trasporti",         color: "#5B9BD5", essential: true  },
  { id: "salute",       name: "Salute e farmacia",        color: "#2E9C9A", essential: true  },
  { id: "persona",      name: "Cura della persona",       color: "#C46BAE", essential: false },
  { id: "sport",        name: "Sport e hobby",            color: "#8E6CBF", essential: false },
  { id: "animali",      name: "Animali",                  color: "#A0782C", essential: true  },
  { id: "digitale",     name: "Abbonamenti e digitale",   color: "#4F6BD8", essential: false },
  { id: "svago",        name: "Divertimento e cultura",   color: "#B5651D", essential: false },
  { id: "regali",       name: "Regali e persone",         color: "#E07B91", essential: false },
  { id: "assicurazioni",name: "Assicurazioni",            color: "#3B5A7A", essential: true  },
  { id: "burocrazia",   name: "Tasse e burocrazia",       color: "#6B7A8F", essential: true  },
  { id: "contante",     name: "Contante",                 color: "#7F8C8D", essential: false },
  { id: "donazioni",    name: "Donazioni",                color: "#58A55C", essential: false },
  { id: "viaggi",       name: "Viaggi e vacanze",         color: "#F0A868", essential: false, vacation: true },
  { id: "altro",        name: "Altro",                    color: "#95A0B3", essential: false }
];
T.PALETTE = ["#5E9E3E","#E0A800","#D64545","#1F5F8B","#5B9BD5","#2E9C9A","#C46BAE","#8E6CBF","#A0782C","#4F6BD8","#B5651D","#E07B91","#3B5A7A","#6B7A8F","#7F8C8D","#58A55C","#F0A868","#95A0B3","#2F7D32","#9C27B0"];

/* Movimenti che non sono spese: trasferimenti, investimenti, cambi valuta */
T.EXCLUDE_KINDS = { ricarica: "Ricarica o giroconto", cambio: "Cambio valuta", investimento: "Investimento o risparmio", carta: "Pagamento carta di credito", interno: "Trasferimento tra conti", altro: "Escluso per scelta" };
T.DEFAULT_FLOW_RULES = [
  { re: /^(to |a |da |from )?robo|robo.?portfolio|robo.?advisor/i, kind: "investimento" },
  { re: /fondi monetari|flexible cash|money market|geldmarkt|savings vault|salvadanaio|^to pocket|^from pocket|^pocket/i, kind: "investimento" },
  { re: /interactive brokers|ibkr|trading ?212|degiro|swissquote|finpension|viac|frankly|selma|true wealth|postfinance e-trading|saxo bank|yuh invest/i, kind: "investimento" },
  { re: /^conversione in|^exchanged? to|^cambio |^umgetauscht|^change en/i, kind: "cambio" },
  { re: /^ricarica|^top.?up|^aufladung|^recharge/i, kind: "ricarica" },
  { re: /swisscard|cembra|viseca|cornercard|american express|amex|postfinance card/i, kind: "carta" }
];
T.BANK_CAT_FLOW = { "cambio valuta": "cambio", "exchange": "cambio", "ricarica": "ricarica", "top-up": "ricarica", "topup": "ricarica" };

/* Regole di categoria generiche: catene diffuse in Svizzera e in Europa */
T.DEFAULT_RULES = [
  ["digitale",   "amazon prime|netflix|spotify|disney\\+|disney plus|apple\\.com|icloud|google one|google storage|youtube|microsoft 365|dropbox|chatgpt|openai|adobe|playstation|xbox|nintendo|audible|kindle unlimited|dazn|sky |now tv|swisscom|sunrise|salt mobile|wingo|yallo|iliad|tim |vodafone|wind tre"],
  ["viaggi",     "booking\\.com|airbnb|expedia|trip\\.com|agoda|hotels\\.com|ryanair|easyjet|wizz|swiss intern|lufthansa|klm|air france|ita airways|edelweiss|emirates|qatar|hostel|hotel|resort|getyourguide|klook|tripadvisor"],
  ["alimentari", "coop|migros|lidl|aldi|denner|volg|spar|manor food|globus delicatessa|carrefour|esselunga|conad|eurospin|bennet|tigros|iper|penny|md discount|despar|crai|pam |u2 |rewe|edeka|kaufland|panific|macelleria|forno|alimentari|frutta|supermerc"],
  ["ristoranti", "ristor|pizz|trattoria|osteria|bar |caff|cafe|café|bistro|sushi|kebab|burger|mcdonald|starbucks|gelat|pasticc|pub |birr|grill|lounge|tea room|confiserie|brezel|7-eleven|k kiosk|kiosk"],
  ["trasporti",  "esso|shell|agip|eni |tamoil|socar|avia|bp |q8|migrol|coop pronto|carburant|benzina|autostrad|vignette|parcheggio|parking|easypark|parkingpay|sbb|ffs|cff|trenitalia|italo|tpl|autopostale|postauto|taxi|uber|bolt|car wash|autolavaggio|officina|garage|pneumatic"],
  ["salute",     "farmacia|apotheke|pharmacie|amavita|sun store|benu|topwell|dottor|medic|dentist|ottic|optik|fielmann|clinic|ospedale|spital|laborator"],
  ["persona",    "parrucch|barber|coiffeur|estetic|nail|beauty|douglas|sephora|marionnaud|profumeria|massag|spa "],
  ["shopping",   "amazon|zalando|galaxus|digitec|temu|shein|aliexpress|ebay|h&m|zara|uniqlo|mango|nike|adidas|decathlon|ochsner|manor|globus|jelmoli|ikea|interdiscount|mediamarkt|fust|tezenis|calzedonia|intimissimi|ovs|upim|primark|bershka|pull&bear|stradivarius|pandora|tally weijl|c&a|snipes|foot locker|flying tiger|action|obi |hornbach|jumbo|bauhaus|do it|landi"],
  ["casa",       "ail |aziende industriali|ewz|ekz|romande energie|enel|a2a|hera|iren|acqua|elettric|gas |ferramenta|brico|leroy merlin|conforama|maisons du monde|mobili|arred"],
  ["animali",    "veterinar|tierarzt|fressnapf|qualipet|zooplus|arcaplanet|maxi zoo|pet |animali|toelett"],
  ["sport",      "golf|palestra|fitness|gym|piscina|hallenbad|tennis|padel|sci |ski|sportxx|athleticum|bike|cicl"],
  ["svago",      "cinema|kino|teatro|theater|concert|ticketcorner|ticketmaster|ticketone|eventim|museo|museum|zoo |escape|bowling|lido|beach club|parco"],
  ["assicurazioni","assicuraz|versicherung|assurance|axa|zurich|helvetia|mobiliar|allianz|generali|baloise|vaudoise|smile\\.direct"],
  ["burocrazia", "comune di|gemeinde|commune|cancelleria|steuer|imposte|tasse|ufficio|consolato|passaport|evisa|visa on arrival|immigration|posta|poste italiane"],
  ["donazioni",  "donaz|spende|unicef|wwf|caritas|croce rossa|red cross|msf|emergency"],
  ["shopping",   "paga in 3|klarna|scalapay|afterpay|bestsecret|calzatur|abbigliam|gioiell|jewel|bijou|profumeria|zalando lounge|vinted|subito\\.it"],
  ["trasporti",  "grab|lyft|free ?now|cabify|stazione di servizio|tankstelle|station service|quick service|carburanti|telepass|autogrill"],
  ["viaggi",     "airasia|lastminute|volotea|vueling|airport|aeroport|flughafen|duty free|travel|viaggi|evisa"],
  ["digitale",   "canone|plan fee|premium plan|piano premium|metal plan|subscription|abbonamento"],
  ["salute",     "unobravo|psicolog|terapi|fisioterap|osteopat"],
  ["persona",    "tigot|acqua e sapone|rossmann|dm drogerie|mueller|müller"],
  ["casa",       "viridea|garden|giardin|vivaio"],
  ["svago",      "experiences|beach|splash|acquapark|parco divertimenti"],
  ["ristoranti", "restaurant|restaurante|brasserie|taverna|enoteca|vineria|cicchett|aperitiv"],
  ["regali",     "^(to|a|an|à|pagamento a|bonifico a) [a-zà-ü]+ [a-zà-ü]+"]
].map(([cat, rx]) => ({ cat, re: new RegExp(rx, "i") }));

/* Classifica un movimento. Ordine: scelta manuale, regole utente, flussi esclusi, categorie banca, regole generiche */
T.classify = (tx, st) => {
  if (tx.manual) return { flow: tx.flow, cat: tx.cat, kind: tx.kind || null };
  const d = tx.desc || "", nm = T.normMerchant(d), rc = String(tx.rcat || "").toLowerCase();
  for (const r of st.rules || []) {
    const hit = nm === r.m || (!r.exact && r.m.length >= 5 && (" " + nm + " ").includes(" " + r.m + " "));
    if (hit) return { flow: r.flow || "spesa", cat: r.flow === "escluso" || r.flow === "entrata" ? null : r.cat, kind: r.kind || null };
  }
  if (T.BANK_CAT_FLOW[rc]) return { flow: "escluso", cat: null, kind: T.BANK_CAT_FLOW[rc] };
  for (const r of T.DEFAULT_FLOW_RULES) if (r.re.test(d)) return { flow: "escluso", cat: null, kind: r.kind };
  if (/prelievo|atm|cash withdrawal|bargeld|retrait/.test(rc)) return { flow: "spesa", cat: has(st, "contante"), kind: null };
  if (tx.amt > 0 && !/rimborso|refund|rückerstattung|rembourse/.test(rc) && !/^(esercente|card payment|merchant)$/.test(rc)) return { flow: "entrata", cat: null, kind: null };
  const dl = d.toLowerCase();
  for (const r of T.DEFAULT_RULES) if (r.re.test(" " + dl + " ") || r.re.test(dl)) return { flow: "spesa", cat: has(st, r.cat), kind: null };
  return { flow: "spesa", cat: has(st, "altro"), kind: null };
};
function has(st, id) { const cs = st.categories || T.DEFAULT_CATEGORIES; return cs.some(c => c.id === id) ? id : (cs.find(c => c.id === "altro") || cs[cs.length - 1]).id; }

T.isVacation = (tx, st) => {
  if (tx.vac === true || tx.vac === false) return tx.vac;
  const cat = (st.categories || []).find(c => c.id === tx.cat);
  if (cat && cat.vacation) return true;
  return (st.vacations || []).some(v => tx.d >= v.from && tx.d <= (v.to || "9999-12-31"));
};

/* Riapplica le regole a tutti i movimenti (le scelte manuali restano) */
T.reclassifyAll = st => {
  for (const tx of st.txs) { if (tx.manual) continue; const r = T.classify(tx, st); tx.flow = r.flow; tx.cat = r.cat; tx.kind = r.kind; }
};
/* Regola utente da una correzione: tutti i movimenti con lo stesso esercente */
T.addUserRule = (st, desc, flow, cat, kind) => {
  const m = T.normMerchant(desc); if (!m) return null;
  st.rules = (st.rules || []).filter(r => r.m !== m);
  const rule = { m, exact: false, flow, cat: flow === "spesa" ? cat : null, kind: kind || null, src: "utente" };
  st.rules.unshift(rule);
  return rule;
};
})();
