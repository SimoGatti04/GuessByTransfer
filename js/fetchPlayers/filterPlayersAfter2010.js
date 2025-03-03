const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');

function extractYear(yearStr) {
  const match = yearStr.match(/\d{4}/);
  if(match) {
    return parseInt(match[0], 10);
  }
  return null;
}

function parseInfobox(html) {
  const $ = cheerio.load(html);
  const clubs = [];
  let currentSection = null;
  $('table.infobox tr').each((i, tr) => {
    const $tr = $(tr);
    // Se esiste un <th> con classe infobox-header, aggiorna la sezione
    if ($tr.find('th.infobox-header').length) {
      const headerText = $tr.find('th.infobox-header').text().trim();
      if (headerText.includes('Senior career')) {
        currentSection = 'senior';
      } else if (headerText.includes('International career')) {
        currentSection = 'international';
      } else {
        currentSection = null;
      }
      return;
    }

    if (currentSection === 'senior') {
      const $th = $tr.find('th.infobox-label');
      const $tds = $tr.find('td');
      if ($th.length && $tds.length >= 3) {
        const yearText = $th.text().trim();
        let teamText = $($tds[0]).text().trim();
        const onLoan = teamText.includes('→') || teamText.toLowerCase().includes('loan');
        teamText = teamText.replace('→', '').replace(/\(loan\)/i, '').trim();
        const appsText = $($tds[1]).text().trim();
        const goalsText = $($tds[2]).text().trim();
        clubs.push({
          startYear: yearText,
          team: teamText,
          onLoan,
          apps: appsText,
          goals: goalsText
        });
      }
    }
  });
  return clubs;
}

async function getPlayerInfoboxByPageId(pageid) {
  const apiUrl = 'https://en.wikipedia.org/w/api.php';
  const params = {
    action: 'parse',
    pageid: pageid,
    format: 'json',
    prop: 'text',
    origin: '*'
  };
  try {
    const { data } = await axios.get(apiUrl, { params });
    return data.parse.text['*'];
  } catch (error) {
    console.error(`Error fetching page for pageid ${pageid}:`, error);
    return null;
  }
}

async function playerHasAfter2010Appearance(pageid) {
  const html = await getPlayerInfoboxByPageId(pageid);
  if (!html) return false;
  const clubs = parseInfobox(html);
  for (const club of clubs) {
    const year = extractYear(club.startYear);
    if (year && year >= 2010) {
      return true;
    }
  }
  return false;
}

async function main() {
  const playersRaw = fs.readFileSync('all_top_5_leagues_players.json', 'utf-8');
  const players = JSON.parse(playersRaw);
  const filteredPlayers = [];

  console.log(`Elaborazione di ${players.length} giocatori...`);
  // Per ogni giocatore eseguiamo il recupero e il parsing dell'infobox
  for (const player of players) {
    console.log(`Verifico ${player.title} (pageid: ${player.pageid})...`);
    const hasAppearance = await playerHasAfter2010Appearance(player.pageid);
    if (hasAppearance) {
      filteredPlayers.push(player);
    }
    // Delay breve per rispetto dell'API
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  fs.writeFileSync('top_5_leagues_after_2010.json', JSON.stringify(filteredPlayers, null, 2));
  console.log(`Salvati ${filteredPlayers.length} giocatori in top_5_leagues_after_2010.json`);
}

main().catch(err => console.error(err));
