import { fetchTeamLogoFromWikipedia } from "./logoswiki.mjs";
import { searchPlayers, normalizeString } from "./playerSearch.mjs";

let players = [];
let detailedData = [];
let selectedPlayer = null;  // Giocatore scelto per il round

function formatTeamName(name, imageSearch=false) {
  let formatted = name;
  // Rimuove "men's national association football team" ovunque (case insensitive)
  formatted = formatted.replace(/men's national association football team/gi, '');
  // Sostituisce "national under-XX association football team" con "under-XX"
  if (imageSearch) {
    if (name.toLowerCase().includes("czech republic")) {
      formatted = "Czechia"
    }
    formatted = formatted.replace(/national under-([0-9]+) football team/gi, '');
    formatted = formatted.replace(/national under-([0-9]+) association football team/gi, '');
    formatted = formatted.replace(/national under-23 soccer team/gi, '');
  } else {
    formatted = formatted.replace(/national under-([0-9]+) association football team/gi, 'under-$1');
    formatted = formatted.replace(/national under-([0-9]+) football team/gi, 'under-$1');
    formatted = formatted.replace(/national under-23 soccer team/gi, 'under-$1');
  }
  // Rimuove eventuale residuo "national association football team"
  formatted = formatted.replace(/national association football team/gi, '');

  // Rimuove "men's national football team"
  formatted = formatted.replace(/men's national football team/gi, '');

  formatted = formatted.replace(/men's national soccer team/gi, ' ');

  return formatted.trim();
}


// Carica players.json e detailed_players.json
function loadData() {
  Promise.all([
    fetch("js/players.json").then(response => response.json()),
    fetch("js/detailed_players.json").then(response => response.json())
  ])
    .then(([playersData, detailedPlayersData]) => {
      players = playersData;
      detailedData = detailedPlayersData;
      startRound();
    })
    .catch(err => console.error("Errore nel caricamento dei dati:", err));
}

// Avvia un nuovo round selezionando un giocatore casuale e mostrando i trasferimenti
function startRound() {
  // Resetta feedback e la ricerca
  const feedbackElem = document.getElementById("feedback");
  const searchInput = document.getElementById("playerSearchInput");
  const clubContainer = document.getElementById("transfersContainer");
  const nationalContainer = document.getElementById("nationalTransfersContainer");

  if (!feedbackElem || !searchInput || !clubContainer || !nationalContainer) {
    console.error("Errore: uno o più elementi non sono presenti nel DOM");
    return;
  }

  feedbackElem.textContent = "";
  searchInput.value = "";
  document.getElementById("playerList").innerHTML = "";
  clubContainer.innerHTML = "";
  nationalContainer.innerHTML = "";
  document.getElementById("nextRoundButton").style.display = "none";

  // Seleziona un giocatore casuale
  selectedPlayer = players[Math.floor(Math.random() * players.length)];
  console.log("Giocatore scelto:", selectedPlayer.name);

  // Recupera tutte le membership in detailed_players.json con lo stesso qid
  const memberships = detailedData.filter(item => item.qid === selectedPlayer.qid);
  if (memberships.length === 0) {
    console.error("Nessuna membership trovata per il giocatore:", selectedPlayer);
    clubContainer.innerHTML =
      "<p>Nessun dato disponibile per questo giocatore.</p>";
    nationalContainer.innerHTML = "";
    return;
  }
  memberships.sort((a, b) => new Date(a.start) - new Date(b.start));

  // Modifica dei filtri: controlla sia m.team che m.teamName per la parola "national" o "nazionale"
  const clubMemberships = memberships.filter(m => {
    const teamField = m.team || "";
    const teamNameField = m.teamName || "";
    return !( /national/i.test(teamField) || /national?/i.test(teamNameField) );
  });
  const nationalMemberships = memberships.filter(m => {
    const teamField = m.team || "";
    const teamNameField = m.teamName || "";
    return /national/i.test(teamField) || /national?/i.test(teamNameField);
  });

  // Renderizza le membership in due box distinti
  renderTransfers(clubMemberships, clubContainer);
  renderTransfers(nationalMemberships, nationalContainer);

  feedbackElem.textContent = "Cerca il giocatore da indovinare...";
}

// Renderizza le membership all'interno del container fornito.
// Se il container è per le nazionali, esegue un controllo ulteriore per gli under.
function renderTransfers(memberships, container) {
  container.innerHTML = "";

  memberships.forEach((m, index) => {
    const teamDiv = document.createElement("div");
    teamDiv.className = "transfer-item";

    // Crea l'elemento per il nome del team, formattato correttamente
    const teamNameDiv = document.createElement("div");
    const rawName = m.teamName || m.team.split("/").pop();
    teamNameDiv.textContent = formatTeamName(rawName);
    teamDiv.appendChild(teamNameDiv);

    // Aggiunge un'immagine con placeholder di default
    const logo = document.createElement("img");
    logo.alt = formatTeamName(rawName);
    logo.src = "default_logo.png";
    teamDiv.appendChild(logo);

    // Se il container è destinato alle nazionali e il nome contiene un pattern "under-"
    if (
      container.id === "nationalTransfersContainer" &&
      m.teamName &&
      /under-\s*\d+/i.test(m.teamName)
    ) {
      // Estrae il nome della nazione maggiore, per esempio "Italy" da "Italy under-21"
      const majorNation = formatTeamName(m.teamName, true);
      // Cerca nella global detailedData (che contiene tutte le membership)
      // una membership di tipo "national" che contenga il majorNation nel teamName
      const majorNationalMembership = detailedData.find(item =>
        item.membershipType === "national" &&
        item.teamName &&
        item.teamName.toLowerCase().includes(majorNation.toLowerCase())
      );
      if (majorNationalMembership) {
        // Usa il team della nazionale maggiore per richiedere il logo
        fetchTeamLogoFromWikipedia(majorNationalMembership.team)
          .then(url => {
            logo.src = url;
          })
          .catch(err => {
            console.error("Errore recuperando il logo della nazionale maggiore:", err);
          });
      } else {
        // Se non si trova corrispondenza, usa comunque il team corrente (under) come fallback
        fetchTeamLogoFromWikipedia(m.team)
          .then(url => {
            logo.src = url;
          })
          .catch(err => {
            console.error("Errore recuperando il logo della nazionale under:", err);
          });
      }
    } else {
      // Ramo per i club (o per nazionali con nome non under)
      // Se il nome del team contiene una lettera "B" o "C" isolata (anche con punto),
      // proviamo a cercare in detailed_players il team corrispondente senza quella lettera.
      const clubPattern = /^(.*)\s([BC])\.?$/;
      const match = rawName.match(clubPattern);
      if (match) {
        const baseName = match[1].trim();
        // Cerca un record in detailed_players con teamName che, formattato, corrisponde al baseName.
        const baseRecord = detailed_players.find(item =>
          item.teamName &&
          formatTeamName(item.teamName).toLowerCase() === baseName.toLowerCase()
        );
        if (baseRecord) {
          console.log(`Match per team "${rawName}": usando il team base "${baseName}" per il logo.`);
          fetchTeamLogoFromWikipedia(baseRecord.team)
            .then(url => {
              logo.src = url;
            })
            .catch(err => {
              console.error("Errore recuperando il logo dal record base:", err);
            });
        } else {
          // Nessun record trovato: usa il team corrente come fallback
          fetchTeamLogoFromWikipedia(m.team)
            .then(url => {
              logo.src = url;
            })
            .catch(err => {
              console.error("Errore recuperando il logo:", err);
            });
        }
      } else {
        // Nessun pattern "B" o "C" isolato nel nome, usa il team corrente
        fetchTeamLogoFromWikipedia(m.team)
          .then(url => {
            logo.src = url;
          })
          .catch(err => {
            console.error("Errore recuperando il logo:", err);
          });
      }
    }

    const yearLabel = document.createElement("div");
    yearLabel.textContent = new Date(m.start).getFullYear();
    teamDiv.appendChild(yearLabel);

    container.appendChild(teamDiv);

    // Se non è l'ultimo elemento, aggiunge una freccia
    if (index < memberships.length - 1) {
      const arrow = document.createElement("span");
      arrow.className = "transfer-arrow";
      arrow.innerHTML = "&rarr;";
      container.appendChild(arrow);
    }
  });
}


// Aggiorna la lista dei suggerimenti in base all'input di ricerca
function updatePlayerList(filteredPlayers) {
  const suggestionContainer = document.getElementById("playerList");
  suggestionContainer.innerHTML = "";
  filteredPlayers.forEach(player => {
    const playerItem = document.createElement("div");
    playerItem.className = "player-item";
    playerItem.textContent = player.name;
    // Al click, inserisce il nome nell'input e verifica la risposta
    playerItem.addEventListener("click", () => {
      document.getElementById("playerSearchInput").value = player.name;
      checkAnswer(player);
    });
    suggestionContainer.appendChild(playerItem);
  });
}

// Verifica se il giocatore selezionato corrisponde a quello da indovinare
function checkAnswer(selectedCandidate) {
  const feedback = document.getElementById("feedback");
  if (selectedCandidate.qid === selectedPlayer.qid) {
    feedback.textContent = "Corretto! Bravo!";
    document.getElementById("nextRoundButton").style.display = "block";
  } else {
    feedback.textContent = "Sbagliato! Riprova.";
  }
}

// Tutto il codice che accede al DOM verrà eseguito dopo il caricamento completo
document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("playerSearchInput");
  const nextRoundButton = document.getElementById("nextRoundButton");

  if (!searchInput) {
    console.error("Elemento #playerSearchInput non trovato nel DOM");
    return;
  }
  if (!nextRoundButton) {
    console.error("Elemento #nextRoundButton non trovato nel DOM");
    return;
  }

  // Listener per la ricerca
  searchInput.addEventListener("input", (event) => {
    const query = event.target.value;
    const filteredPlayers = searchPlayers(players, query);
    updatePlayerList(filteredPlayers);
  });

  nextRoundButton.addEventListener("click", startRound);

  loadData();
});
