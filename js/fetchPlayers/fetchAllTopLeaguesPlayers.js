const fs = require('fs');
const axios = require('axios');

async function getCategoryMembers(category) {
  const apiUrl = 'https://en.wikipedia.org/w/api.php';
  let members = [];
  let cmcontinue = null;
  const params = {
    action: 'query',
    list: 'categorymembers',
    cmtitle: category,
    cmnamespace: 0,
    cmtype: 'page',
    cmlimit: 'max',
    format: 'json',
    origin: '*'
  };

  do {
    if (cmcontinue) {
      params.cmcontinue = cmcontinue;
    } else {
      delete params.cmcontinue;
    }
    try {
      const { data } = await axios.get(apiUrl, { params });
      if (data.query && data.query.categorymembers) {
        members = members.concat(data.query.categorymembers);
      }
      cmcontinue = data.continue ? data.continue.cmcontinue : null;
    } catch (error) {
      console.error(`Error fetching category ${category}:`, error);
      break;
    }
  } while (cmcontinue);

  return members;
}

async function getAllPlayers() {
  const categories = [
    'Category:Serie_A_players',
    'Category:Premier_League_players',
    'Category:La_Liga_players',
    'Category:Bundesliga_players',
    'Category:Ligue_1_players'
  ];

  let allPlayers = [];
  for (const cat of categories) {
    const members = await getCategoryMembers(cat);
    // Uniamo i risultati mantenendo pageid e title per identificare univocamente la pagina
    allPlayers = allPlayers.concat(members);
    // Breve delay per non sovraccaricare l'API
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  // Rimuoviamo duplicati usando il pageid come chiave univoca
  const uniquePlayers = {};
  allPlayers.forEach(player => {
    uniquePlayers[player.pageid] = player;
  });
  return Object.values(uniquePlayers);
}

async function main() {
  const players = await getAllPlayers();
  fs.writeFileSync('all_top_5_leagues_players.json', JSON.stringify(players, null, 2));
  console.log(`Saved ${players.length} unique players in all_top_5_leagues_players.json`);
}

main().catch(err => console.error(err));
