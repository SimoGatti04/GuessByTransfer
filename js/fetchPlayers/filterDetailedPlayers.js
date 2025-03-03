const fs = require("fs");
const path = require("path");

// Percorso del file di input e output
const inputFile = path.join(__dirname, "details_5_years_top_leagues.json");
const outputFile = path.join(__dirname, "detailed_players.json");

// Legge il file di input
const players = JSON.parse(fs.readFileSync(inputFile, "utf-8"));

// Regex per identificare le nazionali minori (con "under", "U-" o simili)
const minorNationalRegex = /\b(?:under\b|u-?\s*\d+)/i;

const filteredPlayers = players
  .map(player => {
    // Filtra i record dei club: rimuove quelli in cui startYear è "Years"
    if (Array.isArray(player.clubs)) {
      player.clubs = player.clubs.filter(club => club.startYear !== "Years");
    }
    // Filtra i record delle nazionali, rimuovendo quelli relativi alle categorie minori
    if (Array.isArray(player.internationals)) {
      player.internationals = player.internationals.filter(record => {
        return !minorNationalRegex.test(record.team);
      });
    }
    return player;
  })
  // Mantiene solo i calciatori con almeno una presenza in nazionale maggiore
  .filter(player => player.internationals && player.internationals.length > 0);

// Scrive il risultato nel file di output
fs.writeFileSync(outputFile, JSON.stringify(filteredPlayers, null, 2), "utf-8");

console.log(`Filtrati ${filteredPlayers.length} giocatori in ${outputFile}`);
