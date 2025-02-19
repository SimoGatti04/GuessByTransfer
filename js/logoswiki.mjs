// Funzione per pulire una stringa rimuovendo simboli come - _ & % e altri caratteri speciali
function cleanText(text) {
  return text.replace(/[-_&%]/g, "").toLowerCase();
}

// Mappa dei logo locali
const localLogoMap = {
  "hellas verona fc": "logos/Hellas_Verona.png",
  "denmark national football team": "logos/Denmark.png",
  "germany national football team": "logos/Germany.png",
  "stade malherbe caen": "logos/SM_Caen.png",
  "llaneros escuela de futbol": "logos/Llaneros.png",
  "a.c.c.d. mineros de guayana": "logos/Mineros_de_Guayana_logo.png",
  //"Real Madrid C": "logos/Real_Madrid.png",
  "real madrid castilla": "logos/Real_Madrid.png",
  "senegal national football team": "logos/Senegal.png",
  "as lodigiani": "logos/Lodigiani.png",
  "serbia national football team": "logos/Serbia.png",
  "liverpool f.c.": "logos/Liverpool.png",
  //"FC Barcelona C": "logos/Barcelona.png",
  "ghana national football team": "logos/Mali.png",
  "a.c. lumezzane": "logos/Lumezzane.png",
  "faenza calcio": "logos/Faenza.png",
  "lr vicenza": "logos/Vicenza.png",
  "mali national football team": "logos/Mali.jpeg",
  "kenya national football team": "logos/Kenya.png",
  "italy national under-21 football b team": "logos/RapprB.png",
  "america de cali": "logos/Cali.png",
  "ac pavia 1911 ssd": "logos/Pavia.png",
  "asd viareggio calcio": "logos/Viareggio.png",
  "xanthi f.c": "logos/xanthi.png",
  "square united": "logos/Square_UTD.jpeg",
  "saint lucia national football team": "logos/Saint_Lucia.png",
  "valencia cf mestalla": "logos/Valenciacf.png",
};


// Funzione per calcolare la distanza di Levenshtein tra due stringhe
function computeLevenshteinDistance(a, b) {
  const matrix = [];
  const alen = a.length;
  const blen = b.length;

  // Inizializza la matrice
  for (let i = 0; i <= alen; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= blen; j++) {
    matrix[0][j] = j;
  }

  // Calcola la distanza
  for (let i = 1; i <= alen; i++) {
    for (let j = 1; j <= blen; j++) {
      if (a.charAt(i - 1) === b.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // cancellazione
          matrix[i][j - 1] + 1,      // inserimento
          matrix[i - 1][j - 1] + 1   // sostituzione
        );
      }
    }
  }
  return matrix[alen][blen];
}

// Funzione che restituisce la similarità (tra 0 e 1) basata sulla distanza di Levenshtein.
function getSimilarity(s1, s2) {
  s1 = s1.toLowerCase();
  s2 = s2.toLowerCase();
  const distance = computeLevenshteinDistance(s1, s2);
  const maxLen = Math.max(s1.length, s2.length);
  return maxLen === 0 ? 1 : 1 - distance / maxLen;
}

// Funzione per pulire il nome del file dell'immagine:
// - Rimuove l'estensione (png, svg, jpg, jpeg)
// - Elimina simboli non appartenenti al nome (come . - _ % &)
function cleanImageName(imgName, wikiTitle) {
  // Le parole da rimuovere (tutte quelle definite in keywordPriorities tranne wikiTitle)
  const excludeWords = ["scudo", "escudo", "logo", "badge", "crest"];

  // Rimuovi l'estensione se presente
  let withoutExtension = imgName.replace(/\.(png|svg|jpg|jpeg)$/i, "");

  // Rimuovi simboli che non fanno parte del nome
  let cleaned = withoutExtension.replace(/[.\-_&%]/g, "").toLowerCase();

  // Rimuovi le parole indesiderate
  excludeWords.forEach(word => {
    cleaned = cleaned.replace(new RegExp(word, "gi"), "");
  });

  return cleaned;
}


// Funzione helper per generare tutte le combinazioni (non necessariamente contigue)
// delle parole date in un array, preservando l'ordine.
function getAllWordCombinations(words) {
  const result = [];
  const n = words.length;
  // Itera su tutti i sottoinsiemi non vuoti (da 1 a 2^n-1)
  for (let mask = 1; mask < (1 << n); mask++) {
    let combination = "";
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        combination += words[i];
      }
    }
    result.push(combination);
  }
  return result;
}

// Verifica se un nome immagine candidato è buono confrontandolo con le parole del wikiTitle.
// Il confronto avviene tramite string similarity, considerando tutte le combinazioni possibili
// (singole parole, coppie, ecc.) prese dal titolo. Se almeno una delle combinazioni raggiunge la soglia,
// la funzione ritorna true.
function isImageSimilarToTitle(wikiTitle, imageName, threshold = 0.8) {
  // Pulisci il nome dell'immagine
  const candidate = cleanImageName(imageName);
  // Ottieni le parole del wikiTitle, in lowercase
  const titleWords = wikiTitle.split(/\s+/).filter(Boolean).map(word => word.replace(/[.\-_&%]/g, "").toLowerCase());

  // Genera tutte le combinazioni possibili delle parole (ad es. per 3 parole saranno 7 combinazioni)
  const combinations = getAllWordCombinations(titleWords);

  // Controlla ogni combinazione: se la similarità è maggiore o uguale a threshold ritorna true
  for (const combo of combinations) {
    const sim = getSimilarity(combo, candidate);
    if (sim >= threshold) {
      return true;
    }
  }
  return false;
}

export async function fetchTeamLogoFromWikipedia(teamIRI) {
  try {
    // 1. Estrai il QID dall'IRI
    const qid = teamIRI.split("/").pop();

    // Recupera il titolo della pagina Wikipedia in inglese tramite Wikidata
    const wikidataUrl = `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`;
    const wikidataResponse = await fetch(wikidataUrl);
    const wikidataData = await wikidataResponse.json();
    const entity = wikidataData.entities[qid];

    if (!entity || !entity.sitelinks || !entity.sitelinks.enwiki) {
      console.log("Nessun sitelink enwiki per il team con QID:", qid);
      return "default_logo.png";
    }

    const wikiTitle = entity.sitelinks.enwiki.title;

    // Funzione di normalizzazione: rimuove le dieresi, accenti, ecc.
    function normalizeString(str) {
      return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }

    const normalizedWikiTitle = normalizeString(wikiTitle).toLowerCase();
    for (const key in localLogoMap) {
      const normalizedKey = normalizeString(key).toLowerCase();
      if (normalizedWikiTitle.includes(normalizedKey)) {
        console.log(`Caso particolare: utilizzo logo locale per ${wikiTitle}`);
        return localLogoMap[key];
      }
    }


    // Array delle parole da escludere
    const excludeKeywords = [
      "through_the_ages",
      "commons-",
      "common-",
      "kit",
      "old",
      "arena",
      "graph",
      "since",
      "wikinews-",
      "performance",
      "stadio",
      "camiseta"
    ];

    // 2. Usa l'API di Wikipedia con prop=pageimages per ottenere l'immagine principale
    const pageImageUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(wikiTitle)}&prop=pageimages&format=json&pithumbsize=500&origin=*`;
    const imageResponse = await fetch(pageImageUrl);
    const imageData = await imageResponse.json();

    const pages = imageData.query.pages;
    const pageId = Object.keys(pages)[0];

    let imageUrl = null;
    if (pages[pageId].thumbnail && pages[pageId].thumbnail.source) {
      imageUrl = pages[pageId].thumbnail.source;
      console.log("Immagine principale ottenuta:", imageUrl);

      // Verifica che l'immagine principale non contenga nessuna parola da escludere
      if (excludeKeywords.some(keyword => imageUrl.toLowerCase().includes(keyword))) {
        console.log("L'immagine principale contiene una parola da escludere, la ignoro...");
        imageUrl = null;
      }
    }

    // Se abbiamo un'immagine valida, la restituiamo
    if (imageUrl) {
      return imageUrl;
    }

    // Fallback: usa action=parse per recuperare la lista completa delle immagini dalla pagina Wikipedia
    const parseUrl = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(wikiTitle)}&prop=images&format=json&origin=*`;
    const parseResponse = await fetch(parseUrl);
    const parseData = await parseResponse.json();

    if (!parseData.parse || !parseData.parse.images || parseData.parse.images.length === 0) {
      console.log("Nessuna immagine trovata nella pagina:", wikiTitle);
      return "default_logo.png";
    }

    console.log("Link al JSON delle immagini della pagina:", parseUrl);
    console.log("Link alla pagina Wikipedia:", `https://en.wikipedia.org/wiki/${encodeURIComponent(wikiTitle)}`);

    // Filtra le immagini per essere sicuri che siano file immagine (estensioni png, svg, jpg, jpeg)
    // e che non contengano parole da escludere
    const allowedExtensions = /\.(png|svg|jpg|jpeg)$/i;
    const fallbackCandidates = parseData.parse.images.filter(img => {
      const lowerImg = img.toLowerCase();
      return allowedExtensions.test(img) &&
             !excludeKeywords.some(keyword => lowerImg.includes(keyword));
    });
    if (fallbackCandidates.length === 0) {
      console.log("Non ci sono immagini valide nella pagina:", wikiTitle);
      return "default_logo.png";
    }

    // Sistema iniziale di assegnazione di una priorità alle keyword
    const keywordPriorities = [
      { term: wikiTitle, priority: 4 },
      { term: "scudo", priority: 2 },
      { term: "escudo", priority: 2 },
      { term: "crest", priority: 2 },
      { term: "badge", priority: 2 },
      { term: "logo", priority: 2 },
      { term: "seal", priority: 2 },
    ];

    let bestImage = null;
    let bestScore = 0;

    // Valuta ogni candidato: somma del punteggio dato dalle keyword e bonus se il controllo di similarità riscontra match
    fallbackCandidates.forEach(imageName => {
      let score = 0;
      const lowerImageName = imageName.toLowerCase();
      keywordPriorities.forEach(({ term, priority }) => {
        if (lowerImageName.includes(term.toLowerCase())) {
          score += priority;
        }
      });
      // Aggiunge un bonus se la funzione di similarità (su file ripulito) riscontra una corrispondenza con le combinazioni delle parole
      if (isImageSimilarToTitle(wikiTitle, imageName, 0.9)) {
        score += 5;
      }
      if (score > bestScore) {
        bestScore = score;
        bestImage = imageName;
      }
    });

    let selectedImageName = bestImage;
    if (selectedImageName) {
      console.log(`Immagine selezionata con score ${bestScore}: ${selectedImageName}`);
    } else {
      console.log("Nessuna immagine ha soddisfatto le keyword; scelgo il primo candidato come fallback.");
      selectedImageName = fallbackCandidates[0];
    }

    // Aggiunge il prefisso "File:" se non presente
    if (!selectedImageName.startsWith("File:")) {
      selectedImageName = "File:" + selectedImageName;
    }

    const imageQueryUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(selectedImageName)}&prop=imageinfo&format=json&iiprop=url&origin=*`;
    const fallbackImageResponse = await fetch(imageQueryUrl);
    const fallbackImageData = await fallbackImageResponse.json();
    const fallbackPages = fallbackImageData.query.pages;
    const fallbackPageId = Object.keys(fallbackPages)[0];
    if (fallbackPages[fallbackPageId].imageinfo && fallbackPages[fallbackPageId].imageinfo.length > 0) {
      const finalImageUrl = fallbackPages[fallbackPageId].imageinfo[0].url;
           console.log("URL finale del logo dal fallback:", finalImageUrl);
      return finalImageUrl;
    }
  } catch (error) {
    console.error("Errore in fetchTeamLogoFromWikipedia:", error);
  }
  return "default_logo.png";
}

