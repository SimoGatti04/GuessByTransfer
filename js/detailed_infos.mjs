import fetch from "node-fetch";
import fs from "fs";

// Leggiamo il file players.json
const players = JSON.parse(fs.readFileSync("players.json"));

// Costruiamo la clausola VALUES per i giocatori usando il loro QID
const valuesClause = players.map(p => `wd:${p.qid}`).join(" ");

const sparqlDetailedQuery = `PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
PREFIX wd: <http://www.wikidata.org/entity/>

SELECT ?player ?qid ?playerLabel ?team ?teamLabel ?membershipType ?start ?end ?appearances ?goals ?loan WHERE {
  VALUES ?player { ${valuesClause} }
  
  {
    # Membership di tipo club
    ?player p:P54 ?ms.
    ?ms ps:P54 ?team.
    FILTER NOT EXISTS {
      ?team wdt:P31 wd:Q6979593.
      ?team wdt:P2094 wd:Q31930761.
    }
    BIND("club" AS ?membershipType)
    
    ?ms pq:P580 ?start.
    OPTIONAL { ?ms pq:P582 ?end. }
    OPTIONAL { ?ms pq:P1350 ?appearances. }
    OPTIONAL { ?ms pq:P1351 ?goals. }
    OPTIONAL { ?ms pq:EXLOAN ?loan. }
  }
  UNION
  {
    # Membership di tipo nazionale 
    ?player p:P54 ?msNat.
    ?msNat ps:P54 ?team.
    ?team wdt:P31 wd:Q6979593.
    ?team wdt:P2094 wd:Q31930761.
    BIND("national" AS ?membershipType)
    
    ?msNat pq:P580 ?start.
    OPTIONAL { ?msNat pq:P582 ?end. }
    OPTIONAL { ?msNat pq:P1350 ?appearances. }
    OPTIONAL { ?msNat pq:P1351 ?goals. }
    OPTIONAL { ?msNat pq:EXLOAN ?loan. }
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
  BIND(STRAFTER(STR(?player), "entity/") AS ?qid)
}
ORDER BY ?playerLabel ?membershipType ?start
`;

const endpointUrlDetailed = "https://query.wikidata.org/sparql";

fetch(endpointUrlDetailed, {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    "Accept": "application/sparql-results+json",
    "User-Agent": "Mozilla/5.0 (compatible; Node.js script)"
  },
  body: "query=" + encodeURIComponent(sparqlDetailedQuery)
})
  .then(response => {
    if (!response.ok) {
      throw new Error("HTTP error " + response.status);
    }
    return response.json();
  })
  .then(data => {
    // Mappiamo i risultati includendo anche "playerName" e "teamName"
    const results = data.results.bindings.map(item => ({
      player: item.player.value,
      qid: item.qid.value,
      playerName: item.playerLabel.value,
      team: item.team.value,
      teamName: item.teamLabel ? item.teamLabel.value : null,
      membershipType: item.membershipType.value,
      start: item.start.value,
      end: item.end ? item.end.value : null,
      appearances: item.appearances ? item.appearances.value : null,
      goals: item.goals ? item.goals.value : null,
      loan: item.loan ? item.loan.value : null
    }));
    console.log("Dati dettagliati per i giocatori:");
    console.log(JSON.stringify(results, null, 2));
    fs.writeFileSync("detailed_players.json", JSON.stringify(results, null, 2));
    console.log("Saved detailed players data in detailed_players.json");
  })
  .catch(err => {
    console.error("Errore nel recupero dei dati dettagliati da Wikidata:", err);
  });
