import { localLogoMap } from "./localLogoMap.mjs"; // Supponendo che la mappa locale venga estratta in un file dedicato
// Funzioni di supporto per la normalizzazione e il calcolo di similarità
function cleanText(text) {
  return text.replace(/[-_&%]/g, "").toLowerCase();
}

function computeLevenshteinDistance(a, b) {
  const matrix = [];
  const alen = a.length;
  const blen = b.length;
  for (let i = 0; i <= alen; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= blen; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= alen; i++) {
    for (let j = 1; j <= blen; j++) {
      if (a.charAt(i - 1) === b.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + 1
        );
      }
    }
  }
  return matrix[alen][blen];
}

function getSimilarity(s1, s2) {
  s1 = s1.toLowerCase();
  s2 = s2.toLowerCase();
  const distance = computeLevenshteinDistance(s1, s2);
  const maxLen = Math.max(s1.length, s2.length);
  return maxLen === 0 ? 1 : 1 - distance / maxLen;
}

function cleanImageName(imgName) {
  const excludeWords = ["scudo", "escudo", "logo", "badge", "crest"];
  let withoutExtension = imgName.replace(/\.(png|svg|jpg|jpeg)$/i, "");
  let cleaned = withoutExtension.replace(/[.\-_&%]/g, "").toLowerCase();
  excludeWords.forEach(word => {
    cleaned = cleaned.replace(new RegExp(word, "gi"), "");
  });
  return cleaned;
}

function getAllWordCombinations(words) {
  const result = [];
  const n = words.length;
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

function isImageSimilarToTitle(wikiTitle, imageName, threshold = 0.8) {
  const candidate = cleanImageName(imageName);
  const titleWords = wikiTitle.split(/\s+/).filter(Boolean).map(word =>
    word.replace(/[.\-_&%]/g, "").toLowerCase()
  );
  const combinations = getAllWordCombinations(titleWords);
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
    // Se è presente un teamPage (che in detailed_players è il link relativo alla pagina Wikipedia),
    // lo usiamo per ricavare il titolo della pagina.
    let wikiTitle = null;
    if (teamIRI && teamIRI.startsWith("/wiki/")) {
      // Assumiamo che il titolo sia tutto ciò che segue "/wiki/"
      wikiTitle = decodeURIComponent(teamIRI.substring(6));
    } else {
      // In assenza di teamPage, usiamo teamIRI come QID, vecchia modalità (meno attesa)
      const qid = teamIRI.split("/").pop();
      console.log("TeamIRI non contiene '/wiki/'. Uso il QID:", qid);

      // Recupera il titolo della pagina Wikipedia tramite Wikidata (fallback)
      const wikidataUrl = `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`;
      const wikidataResponse = await fetch(wikidataUrl);
      const wikidataData = await wikidataResponse.json();
      const entity = wikidataData.entities[qid];
      if (!entity || !entity.sitelinks || !entity.sitelinks.enwiki) {
        console.log("Nessun sitelink enwiki per il team con QID:", qid);
        return "default_logo.png";
      }
      wikiTitle = entity.sitelinks.enwiki.title;
    }

    if (!wikiTitle) {
      console.log("Nessun titolo Wiki ottenuto per teamIRI:", teamIRI);
      return "default_logo.png";
    }

    // Normalizza il titolo per controllare la mappa dei loghi locali
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

    // 1. Prova a ottenere l'immagine principale con prop=pageimages
    const pageImageUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(wikiTitle)}&prop=pageimages&format=json&pithumbsize=500&origin=*`;
    const imageResponse = await fetch(pageImageUrl);
    const imageData = await imageResponse.json();
    const pages = imageData.query.pages;
    const pageId = Object.keys(pages)[0];
    let imageUrl = null;
    if (pages[pageId].thumbnail && pages[pageId].thumbnail.source) {
      imageUrl = pages[pageId].thumbnail.source;
      console.log("Immagine principale ottenuta:", imageUrl);
      if (excludeKeywords.some(keyword => imageUrl.toLowerCase().includes(keyword))) {
        console.log("L'immagine principale contiene una parola da escludere, la ignoro...");
        imageUrl = null;
      }
    }
    if (imageUrl) {
      return imageUrl;
    }
    // 2. Fallback: usa action=parse per recuperare l'intera lista delle immagini
    const parseUrl = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(wikiTitle)}&prop=images&format=json&origin=*`;
    const parseResponse = await fetch(parseUrl);
    const parseData = await parseResponse.json();
    if (!parseData.parse || !parseData.parse.images || parseData.parse.images.length === 0) {
      console.log("Nessuna immagine trovata nella pagina:", wikiTitle);
      return "default_logo.png";
    }
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
    fallbackCandidates.forEach(imageName => {
      let score = 0;
      const lowerImageName = imageName.toLowerCase();
      keywordPriorities.forEach(({ term, priority }) => {
        if (lowerImageName.includes(term.toLowerCase())) {
          score += priority;
        }
      });
      if (isImageSimilarToTitle(wikiTitle, imageName, 0.9)) {
        score += 5;
      }
      if (score > bestScore) {
        bestScore = score;
        bestImage = imageName;
      }
    });
    let selectedImageName = bestImage || fallbackCandidates[0];
    console.log(`Immagine selezionata con score ${bestScore}: ${selectedImageName}`);
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

