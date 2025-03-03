import { searchPlayers, normalizeString } from "./playerSearch.mjs";

let detailedData = [];
let selectedPlayer = null;  // Giocatore scelto per il round
let attempts = 0; // contatore tentativi per il giocatore

// Carica i dati dal detailed_players.json
function loadData() {
  fetch("js/fetchPlayers/detailed_players.json")
    .then(response => response.json())
    .then(data => {
      detailedData = data;
      startRound();
    })
    .catch(err => console.error("Errore nel caricamento dei dati:", err));
}

// Avvia un nuovo round selezionando un giocatore casuale e mostrando i trasferimenti
function startRound() {
  const feedbackElem = document.getElementById("feedback");
  const searchInput = document.getElementById("playerSearchInput");
  const clubContainer = document.getElementById("transfersContainer");
  const nationalContainer = document.getElementById("nationalTransfersContainer");
  const hintElem = document.getElementById("playerNameHint");

  if (!feedbackElem || !searchInput || !clubContainer || !nationalContainer || !hintElem) {
    console.error("Errore: uno o più elementi non sono presenti nel DOM");
    return;
  }

  feedbackElem.textContent = "";
  searchInput.value = "";
  // Svuota il contenitore dei suggerimenti
  document.getElementById("playerList").innerHTML = "";
  // Nascondi il pannello dei suggerimenti
  const suggestionPanel = document.getElementById("suggestionPanel");
  if (suggestionPanel) {
    suggestionPanel.style.display = "none";
  }

  clubContainer.innerHTML = "";
  nationalContainer.innerHTML = "";
  hintElem.textContent = "";
  document.getElementById("nextRoundButton").style.display = "none";

  attempts = 0;
  selectedPlayer = detailedData[Math.floor(Math.random() * detailedData.length)];
  console.log("Giocatore scelto:", selectedPlayer.title);

  // Filtra eventuali record totali
  const clubMemberships = (selectedPlayer.clubs || []).filter(m => {
    return !(m.team.trim() === "" && m.startYear.trim().toLowerCase() === "total");
  });
  const nationalMemberships = (selectedPlayer.internationals || []).filter(m => {
    return !(m.team.trim() === "" && m.startYear.trim().toLowerCase() === "total");
  });

  renderTransfers(clubMemberships, clubContainer);
  renderTransfers(nationalMemberships, nationalContainer);

  feedbackElem.textContent = "Cerca il giocatore da indovinare...";
}

// Renderizza le membership (club o nazionali) nel container fornito
function renderTransfers(memberships, container) {
  container.innerHTML = "";
  memberships.forEach((m, index) => {
    if (m.team.trim() === "" && m.startYear.trim().toLowerCase() === "total") return;
    const teamDiv = document.createElement("div");
    teamDiv.className = "transfer-item";
    const teamNameDiv = document.createElement("div");
    teamNameDiv.textContent = m.team;
    teamDiv.appendChild(teamNameDiv);
    const logo = document.createElement("img");
    logo.alt = m.team;
    const extensions = [".png", ".svg", ".jpeg", ".jpg"];
    let currentExt = 0;
    const setLogoSrc = () => {
      logo.src = `js/fetchLogos/Logos/${m.team}${extensions[currentExt]}`;
    };
    logo.onerror = () => {
      currentExt++;
      if (currentExt < extensions.length) {
        setLogoSrc();
      } else {
        console.error(`Nessun logo trovato per ${m.team} con estensioni ${extensions.join(", ")}`);
      }
    };
    setLogoSrc();
    teamDiv.appendChild(logo);
    const yearLabel = document.createElement("div");
    yearLabel.textContent = m.startYear || (m.start ? new Date(m.start).getFullYear() : "");
    teamDiv.appendChild(yearLabel);
    container.appendChild(teamDiv);
    if (index < memberships.length - 1) {
      const arrow = document.createElement("span");
      arrow.className = "transfer-arrow";
      arrow.innerHTML = "&rarr;";
      container.appendChild(arrow);
    }
  });
}

// Mostra i suggerimenti nel riquadro a tendina sotto l'input
function updatePlayerList(filteredPlayers) {
  const suggestionContainer = document.getElementById("playerList");
  const suggestionPanel = document.getElementById("suggestionPanel");
  suggestionContainer.innerHTML = "";

  if(filteredPlayers.length === 0) {
    suggestionPanel.style.display = "none";
    return;
  }

  filteredPlayers.forEach(player => {
    const playerItem = document.createElement("div");
    playerItem.className = "player-item";
    playerItem.textContent = player.title;
    playerItem.addEventListener("click", () => {
      document.getElementById("playerSearchInput").value = player.title;
      checkAnswer(player);
      suggestionPanel.style.display = "none";
    });
    suggestionContainer.appendChild(playerItem);
  });
  suggestionPanel.style.display = "block";
}

// Aggiorna l'indizio (hint) in base ai tentativi falliti
function updateHint() {
  const hintElem = document.getElementById("playerNameHint");
  const nameParts = selectedPlayer.title.split(" ");
  if (attempts === 1) {
    hintElem.textContent = nameParts[0].charAt(0) + " ...";
  } else if (attempts === 2) {
    if (nameParts.length > 1) {
      hintElem.textContent = nameParts[0].charAt(0) + " " + nameParts[1].charAt(0) + " ...";
    } else {
      hintElem.textContent = selectedPlayer.title;
    }
  } else if (attempts >= 3) {
    hintElem.textContent = selectedPlayer.title;
  }
}

// Verifica se il giocatore selezionato è corretto
function checkAnswer(selectedCandidate) {
  const feedback = document.getElementById("feedback");
  if (selectedCandidate.pageid === selectedPlayer.pageid) {
    feedback.textContent = "Corretto! Bravo!";
    document.getElementById("playerNameHint").textContent = selectedPlayer.title;
    document.getElementById("nextRoundButton").style.display = "block";
  } else {
    attempts++;
    updateHint();
    if (attempts < 3) {
      feedback.textContent = "Sbagliato! Riprova.";
    } else {
      feedback.textContent = "Nessun tentativo rimasto. La risposta era: " + selectedPlayer.title;
      document.getElementById("nextRoundButton").style.display = "block";
    }
  }
}

// Listener per skip e surrender
function skipAttempt() {
  attempts++;
  updateHint();
  const feedback = document.getElementById("feedback");
  if (attempts < 3) {
    feedback.textContent = "Skip! Riprova.";
  } else {
    feedback.textContent = "Nessun tentativo rimasto. La risposta era: " + selectedPlayer.title;
    document.getElementById("nextRoundButton").style.display = "block";
  }
}

function surrender() {
  attempts = 3;
  updateHint();
  const feedback = document.getElementById("feedback");
  feedback.textContent = "Hai rinunciato. La risposta era: " + selectedPlayer.title;
  document.getElementById("nextRoundButton").style.display = "block";
}

// Imposta i listener al DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("playerSearchInput");
  const nextRoundButton = document.getElementById("nextRoundButton");
  const skipButton = document.getElementById("skipButton");
  const surrenderButton = document.getElementById("surrenderButton");

  if (!searchInput) {
    console.error("Elemento #playerSearchInput non trovato nel DOM");
    return;
  }
  if (!nextRoundButton) {
    console.error("Elemento #nextRoundButton non trovato nel DOM");
    return;
  }
  if (!skipButton) {
    console.error("Elemento #skipButton non trovato nel DOM");
    return;
  }
  if (!surrenderButton) {
    console.error("Elemento #surrenderButton non trovato nel DOM");
    return;
  }

  // Listener per l'input di ricerca: aggiorna il riquadro a tendina con i suggerimenti
  searchInput.addEventListener("input", (event) => {
    const query = event.target.value;
    const filteredPlayers = searchPlayers(detailedData, query);
    updatePlayerList(filteredPlayers);
  });

  nextRoundButton.addEventListener("click", startRound);
  skipButton.addEventListener("click", skipAttempt);
  surrenderButton.addEventListener("click", surrender);

  loadData();
});
