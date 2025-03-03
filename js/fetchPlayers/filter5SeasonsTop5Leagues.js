const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');
const parseYearRange = require('./parseYearRange');
const { getSeasonPairs, checkTeamInSeason } = require('./teamParticipationChecker');

/*
  Funzione per il parsing dell'infobox che estrae club career e international career.
*/
function parseInfobox(html) {
  const $ = cheerio.load(html);
  const clubs = [];
  const internationals = [];
  let currentSection = null;

  $('table.infobox tr').each((i, tr) => {
    const $tr = $(tr);
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
        const $teamLink = $($tds[0]).find('a').first();
        let teamText = $($tds[0]).text().trim();
        let teamPage = null;
        if ($teamLink.length) {
          teamPage = $teamLink.attr('href');
        }
        const onLoan = teamText.includes('→') || teamText.toLowerCase().includes('loan');
        teamText = teamText.replace('→', '').replace(/\(loan\)/i, '').trim();
        const appsText = $($tds[1]).text().trim();
        const goalsText = $($tds[2]).text().trim();
        clubs.push({
          startYear: yearText,
          team: teamText,
          teamPage,
          onLoan,
          apps: appsText,
          goals: goalsText
        });
      }
    } else if (currentSection === 'international') {
      const $th = $tr.find('th.infobox-label');
      const $tds = $tr.find('td');
      if ($th.length && $tds.length >= 3) {
        const yearText = $th.text().trim();
        const $teamLink = $($tds[0]).find('a').first();
        let teamText = $($tds[0]).text().trim();
        let teamPage = null;
        if ($teamLink.length) {
          teamPage = $teamLink.attr('href');
        }
        internationals.push({
          startYear: yearText,
          team: teamText,
          teamPage,
          apps: $($tds[1]).text().trim(),
          goals: $($tds[2]).text().trim()
        });
      }
    }
  });
  return { clubs, internationals };
}

// Recupera la pagina Wikipedia per un giocatore dato il pageid tramite l'API parse.
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
    if (data && data.parse && data.parse.text) {
      return data.parse.text['*'];
    }
    return null;
  } catch (error) {
    console.error(`Error fetching page for pageid ${pageid}:`, error);
    return null;
  }
}

// Restituisce true se il giocatore ha almeno una voce in international career "senior"
// (ossia esclude le voci che contengono "U" o "Under") e con almeno una presenza > 0.
function hasSeniorNationalAppearance(internationals) {
  return internationals.some(entry => {
    const team = entry.team.toLowerCase();
    if (team.match(/u\d+/) || team.includes('under')) {
      return false;
    }
    const apps = parseInt(entry.apps.replace(/\D/g, ''), 10) || 0;
    return apps > 0;
  });
}

/*
  Il giocatore è qualificato se:
  - Ha accumulato almeno 5 stagioni nei top 5 campionati (verificate asincronamente)
    oppure almeno una voce con startYear >= 2022 (tra quelle top).
  - E ha almeno una voce di international career "senior".

  Per ogni voce della club career, vengono generate le coppie di stagione con getSeasonPairs.
  A ciascuna coppia viene applicato il controllo (checkTeamInSeason).
*/
async function qualifiesDetailedPlayer({ clubs, internationals }) {
  let count = 0;
  let hasRecentClub = false;
  for (const entry of clubs) {
    const yearData = parseYearRange(entry.startYear);
    if (!yearData) continue;
    const seasonPairs = getSeasonPairs(entry.startYear);
    for (const season of seasonPairs) {
      const inTop5 = await checkTeamInSeason(entry.team, season);
      if (inTop5) {
        count++;
        if (yearData.start >= 2022) {
          hasRecentClub = true;
        }
        // Una volta confermata la presenza per una stagione, passiamo alla successiva
      }
    }
  }
  console.log("Stagioni top5 verificate:", count);
  return ((count >= 5) || hasRecentClub) && hasSeniorNationalAppearance(internationals);
}

// Funzione principale: legge il file top_5_leagues_after_2010.json, elabora ogni giocatore,
// applica il filtro e salva il risultato in detailed_players.json.
async function main() {
  const inputData = fs.readFileSync('top_5_leagues_after_2010.json', 'utf-8');
  const players = JSON.parse(inputData);
  const detailedPlayers = [];

  console.log(`Elaborazione di ${players.length} giocatori...`);

  for (const player of players) {
    console.log(`Processo ${player.title} (pageid: ${player.pageid})...`);
    const html = await getPlayerInfoboxByPageId(player.pageid);
    if (!html) {
      console.warn(`Pagina non trovata per ${player.title} (pageid: ${player.pageid}).`);
      continue;
    }
    const { clubs, internationals } = parseInfobox(html);
    if (await qualifiesDetailedPlayer({ clubs, internationals })) {
      detailedPlayers.push({
        title: player.title,
        pageid: player.pageid,
        clubs,
        internationals
      });
      console.log(`${player.title} qualificato.`);
    } else {
      console.log(`${player.title} NON qualificato.`);
    }
    // Delay breve per rispetto dell'API
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  fs.writeFileSync('detailed_players.json', JSON.stringify(detailedPlayers, null, 2));
  console.log(`Salvati ${detailedPlayers.length} giocatori in detailed_players.json`);
}

main().catch(err => console.error(err));
