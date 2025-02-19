import fetch from "node-fetch";
import fs from "fs";

const sparqlQuerySerieA = `PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

SELECT ?player ?qid ?playerLabel (SUM(?duration) AS ?totalYears) (MAX(?start) AS ?latestStart)
WHERE {
  {
    # Pre-seleziona i giocatori con almeno una membership in una nazionale, 
    # che sia instance of Q6979593 e abbia P2094 = Q31930761
    SELECT DISTINCT ?player WHERE {
      ?player p:P54 ?msNat.
      ?msNat ps:P54 ?nat.
      ?nat wdt:P31 wd:Q6979593.
      ?nat wdt:P2094 wd:Q31930761.
    }
  }
  
  # Per ciascun giocatore pre-selezionato, esaminiamo le membership in club
  # appartenenti ai Top 5 campionati europei
  ?player p:P54 ?ms.
  ?ms ps:P54 ?club.
  ?club wdt:P118 ?league.
  FILTER(?league IN (wd:Q15804, wd:Q134380, wd:Q193452, wd:Q189004, wd:Q124609))
  
  # Richiediamo la data di inizio della membership
  ?ms pq:P580 ?start.
  FILTER (?start >= "2010-01-01T00:00:00Z"^^xsd:dateTime)
  
  OPTIONAL { ?ms pq:P582 ?end. }
  # Se non c'è data di fine, assumiamo una data fittizia per calcolare la durata
  BIND(COALESCE(?end, "2025-02-10T00:00:00Z"^^xsd:dateTime) AS ?endBound)
  
  # Calcola una durata approssimativa in anni (la differenza degli anni)
  BIND((YEAR(?endBound) - YEAR(?start)) AS ?duration)
  
  SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
  
  # Estrae il QID dal valore IRI del giocatore
  BIND(STRAFTER(STR(?player), "entity/") AS ?qid)
}
GROUP BY ?player ?qid ?playerLabel
HAVING (SUM(?duration) >= 5 || MAX(?start) > "2023-01-01T00:00:00Z"^^xsd:dateTime)
ORDER BY ?playerLabel
`;

const endpointUrlSerieA = "https://query.wikidata.org/sparql?query=" + encodeURIComponent(sparqlQuerySerieA);

fetch(endpointUrlSerieA, {
  headers: {
    "Accept": "application/sparql-results+json",
    "User-Agent": "Mozilla/5.0 (compatible; Node.js script)"
  }
})
  .then(response => {
    if (!response.ok) {
      throw new Error("HTTP error " + response.status);
    }
    return response.json();
  })
  .then(data => {
    // Mappiamo i risultati includendo il campo "name" per il giocatore (dalla label)
    const players = data.results.bindings.map(item => ({
      qid: item.qid.value,
      name: item.playerLabel.value
    }));
    fs.writeFileSync("players.json", JSON.stringify(players, null, 2));
    console.log("Saved players data in players.json");
  })
  .catch(err => {
    console.error("Errore nel recupero dei dati da Wikidata:", err);
  });
