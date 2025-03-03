const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { URL } = require("url");
const { chromium } = require("playwright");

// Scarica l'immagine dall'URL e la salva nel percorso filePath
async function downloadImage(imageUrl, filePath) {
  try {
    const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
    fs.writeFileSync(filePath, response.data);
    console.log(`Downloaded image to: ${filePath}`);
  } catch (error) {
    console.error(`Error downloading image from ${imageUrl}: ${error.message}`);
  }
}

// Questa funzione accetta il pop-up dei cookies se presente e restituisce la URL della prima immagine da Google Images
async function getFirstGoogleImageUrl(page, team) {
  const query = encodeURIComponent(`${team} football logo`);
  const searchUrl = `https://www.google.com/search?tbm=isch&q=${query}`;
  console.log(`Navigating to ${searchUrl}`);
  await page.goto(searchUrl, { waitUntil: "networkidle" });

  // Gestione del pop-up dei cookies (l'ID "W0wltc" è utilizzato spesso da Google)
  const cookieButton = await page.$('button#W0wltc');
  if (cookieButton) {
    console.log("Cookie popup found, clicking...");
    await cookieButton.click();
    await page.waitForTimeout(1000);
  }

  // Attende il caricamento degli elementi (in modalità non headless)
  await page.waitForTimeout(2000);

  // Trova tutti gli elementi immagine (usando il selettore adottato nello script Python)
  const imageElements = await page.$$('div[data-attrid="images universal"]');
  if (imageElements.length === 0) {
    console.warn(`No image elements found for team ${team}`);
    return null;
  }

  // Seleziona il primo elemento e cliccalo per ottenere la vista ingrandita
  const firstImageElement = imageElements[0];
  try {
    await firstImageElement.click();
  } catch (e) {
    console.error("Error clicking image element:", e);
    return null;
  }

  // Attende l'immagine in vista completa usando lo stesso selettore usato nello script Python
  try {
    await page.waitForSelector("img.sFlh5c.FyHeAf.iPVvYb[jsaction]", { timeout: 5000 });
  } catch (e) {
    console.warn(`Timeout waiting for full view image tag for team ${team}`);
    return null;
  }

  const imgTag = await page.$("img.sFlh5c.FyHeAf.iPVvYb[jsaction]");
  if (!imgTag) {
    console.warn(`Failed to find full view image tag for team ${team}`);
    return null;
  }

  // Recupera la URL dell'immagine (usando src)
  const imgUrl = await imgTag.getAttribute("src");
  return imgUrl;
}

async function main() {
  // Legge detailed_players.json e ne estrae i team (sia clubs che internationals), considerandoli univoci
  const inputFile = path.join(__dirname, "../fetchPlayers/detailed_players.json");
  let players = [];
  try {
    players = JSON.parse(fs.readFileSync(inputFile, "utf8"));
  } catch (err) {
    console.error(`Error reading ${inputFile}:`, err);
    return;
  }

  const teamsSet = new Set();

  players.forEach((player) => {
    if (Array.isArray(player.clubs)) {
      player.clubs.forEach((club) => {
        if (club.team && club.team.trim() && club.team !== "Team") {
          teamsSet.add(club.team.trim());
        }
      });
    }
    if (Array.isArray(player.internationals)) {
      player.internationals.forEach((intl) => {
        if (intl.team && intl.team.trim() && intl.team !== "Team") {
          teamsSet.add(intl.team.trim());
        }
      });
    }
  });

  const teams = Array.from(teamsSet);
  const totalTeams = teams.length;
  console.log(`Found ${totalTeams} unique teams.`);

  // Crea la cartella di destinazione per i loghi se non esiste (in js/fetchLogos/Logos)
  const outputFolder = path.join(__dirname, "Logos");
  if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder, { recursive: true });
  }

  // Avvia il browser in modalità non headless per visualizzare il processo
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  let count = 1;
  // Per ogni team, cerca il logo e scarica la prima immagine trovata, se non già presente
  for (const team of teams) {
    console.log(`Processing team ${count}/${totalTeams}: ${team}`);
    // I file sono salvati con il nome esatto del team; dato che possono essere in png, svg, jpeg o jpg,
    // definiamo un array di possibili estensioni e proviamo ad accedere al file locale.
    const extensions = [".png", ".svg", ".jpeg", ".jpg"];
    let fileFound = false;
    let filePath = "";
    for (const ext of extensions) {
      filePath = path.join(outputFolder, team + ext);
      if (fs.existsSync(filePath)) {
        console.log(`Logo already exists for team "${team}" as ${team + ext}`);
        fileFound = true;
        break;
      }
    }
    if (fileFound) {
      count++;
      continue;
    }

    // Se il logo non è già presente, effettua la ricerca su Google Images
    try {
      const imgUrl = await getFirstGoogleImageUrl(page, team);
      if (!imgUrl) {
        console.warn(`No image found for team: ${team}`);
        count++;
        continue;
      }

      // Determina l'estensione dal percorso dell'immagine (default .png se non trovata)
      let ext = path.extname(new URL(imgUrl).pathname);
      if (!ext || ext.length > 5) {
        ext = ".png";
      }
      // Imposta il percorso completo per salvare il logo, usando il nome del team senza modifiche
      filePath = path.join(outputFolder, team + ext);

      await downloadImage(imgUrl, filePath);
      await page.waitForTimeout(2000); // Pausa tra una ricerca e l'altra
    } catch (err) {
      console.error(`Error processing team ${team}: ${err.message}`);
    }
    count++;
  }

  await browser.close();
  console.log("Finished downloading logos.");
}

main();
