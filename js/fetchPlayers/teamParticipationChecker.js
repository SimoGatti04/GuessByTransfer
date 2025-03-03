const axios = require('axios');
const cheerio = require('cheerio');
const parseYearRange = require('./parseYearRange');

/*
  Data una stringa di startYear, ritorna un array di stagioni nel formato "YYYY–YY".
  Regole:
  - Se è un anno singolo, es. "2017" => ["2017–18"].
  - Se è un intervallo, es. "2010-2013" => ["2010–11", "2011–12", "2012–13"].
  - Se è del tipo "2010-" oppure "2010–", allora consideriamo come fine il 2025.

  Inoltre, se la stagione inizia nel 1999, la coppia viene formattata per intero ("1999-2000").
*/
function getSeasonPairs(yearStr) {
  const yearData = parseYearRange(yearStr);
  const pairs = [];
  if (!yearData) return pairs;
  if (yearData.start && yearData.end) {
    if (yearData.start === yearData.end) {
      let y = yearData.start;
      const season = (y === 1999)
        ? `${y}-${y + 1}`
        : `${y}–${String((y + 1) % 100).padStart(2, '0')}`;
      pairs.push(season);
    }
    for (let y = yearData.start; y < yearData.end; y++) {
      const season = (y === 1999)
        ? `${y}-${y + 1}`
        : `${y}–${String((y + 1) % 100).padStart(2, '0')}`;
      pairs.push(season);
    }
  } else if (yearData.start && yearData.end === null) {
    const finalYear = 2025;
    for (let y = yearData.start; y < finalYear; y++) {
      const season = (y === 1999)
        ? `${y}-${y + 1}`
        : `${y}–${String((y + 1) % 100).padStart(2, '0')}`;
      pairs.push(season);
    }
  }
  return pairs;
}

/*
  Data una season (es. "2012–13") e una chiave per la lega, restituisce
  il nome corretto della lega in base alla stagione.

  Per la Ligue:
    - se la stagione inizia dal 2002 in poi -> "Ligue_1"
    - altrimenti -> "French_Division_1"

  Per la Premier:
    - se la stagione inizia dal 2007 in poi -> "Premier_League"
    - se la stagione è dal 1992 in poi (ma <2007) -> "FA_Premier_League"
    - altrimenti -> "Football_League_First_Division"

  Le altre leghe (Bundesliga, Serie_A, La_Liga) non subiscono modifiche.
*/
function getLeagueUrl(season, leagueKey) {
  // Estrae l'anno iniziale dalla coppia: ad esempio "2012–13" -> 2012
  const startYear = parseInt(season.substring(0, 4), 10);
  if (leagueKey === "Bundesliga") return "Bundesliga";
  if (leagueKey === "Serie_A") return "Serie_A";
  if (leagueKey === "La_Liga") return "La_Liga";
  if (leagueKey === "Ligue") {
    return (startYear >= 2002) ? "Ligue_1" : "French_Division_1";
  }
  if (leagueKey === "Premier") {
    if (startYear >= 2007) return "Premier_League";
    else if (startYear >= 1992) return "FA_Premier_League";
    else return "Football_League_First_Division";
  }
  return "";
}

/*
  Estrae i nomi delle squadre dalla league table.
  Presuppone che la league table sia una <table> con classe "wikitable".
*/
function extractTeamNamesFromLeagueTable(html) {
  const $ = cheerio.load(html);
  const teams = [];
  // Per ogni riga della tabella cercare sia nelle celle <th> che in quelle <td>
  $('table.wikitable tr').each((i, row) => {
    // Proviamo prima con il <th> che in genere contiene il team
    let cell = $(row).find('th');
    if (cell.length === 0) {
      // Se non troviamo <th>, proviamo con <td>
      cell = $(row).find('td');
    }
    if (cell.length) {
      // Cerchiamo il primo <a> con href nella cella
      const anchor = cell.find('a[href]').first();
      if (anchor.length) {
        let teamName = anchor.text().trim();
        // Rimuove multipli spazi e newline
        teamName = teamName.replace(/\s+/g, ' ');
        if (teamName) {
          teams.push(teamName);
        }
      }
    }
  });
  return teams;
}



/*
  Data una season (es. "2012–13") e il nome del club,
  itera sulle 5 leghe (usando le chiavi: "Bundesliga", "Serie_A", "La_Liga", "Premier", "Ligue")
  e ritorna true se almeno in una pagina il club compare nella league table.

  Il controllo viene effettuato normalizzando i nomi (minuscolo e senza spazi)
  e verificando se uno include l'altro.
*/
async function checkTeamInSeason(team, season) {
  const leagueKeys = ["Bundesliga", "Serie_A", "La_Liga", "Premier", "Ligue"];
  const normalizedTeam = team.toLowerCase().replace(/\s+/g, '');
  for (const key of leagueKeys) {
    const leagueUrlPart = getLeagueUrl(season, key);
    const url = `https://en.wikipedia.org/wiki/${season}_${leagueUrlPart}`;
    try {
      const { data } = await axios.get(url);
      const extractedTeams = extractTeamNamesFromLeagueTable(data);
      const normalizedExtracted = extractedTeams.map(name => name.toLowerCase().replace(/\s+/g, ''));
      // Debug: stampa l'URL e le squadre normalizzate
      //console.log(`URL: ${url}`);
      //console.log(`Team in input (normalized): ${normalizedTeam}`);
      //console.log(`Extracted teams (normalized): ${normalizedExtracted.join(', ')}`);
      if (normalizedExtracted.some(extracted => extracted.includes(normalizedTeam) || normalizedTeam.includes(extracted))) {
        //console.log(`Team trovato in ${url}`);
        return true;
      }
    } catch (error) {
      console.error(`Errore nel recuperare ${url}: ${error.message}`);
    }
  }
  return false;
}

module.exports = { getSeasonPairs, checkTeamInSeason };
