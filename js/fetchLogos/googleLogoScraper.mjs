export async function fetchTeamLogoFromGoogle(team) {
  try {
    // Modifichiamo l'endpoint per puntare al nuovo path (ad es. "/scrape-image")
    const endpoint = `http://localhost:8002/scrape-image?q=${encodeURIComponent(team + " football logo svg")}`;
    const response = await fetch(endpoint);
    const data = await response.json();
    if (data.image_url) {
      console.log("Logo trovato:", data.image_url);
      return data.image_url;
    } else {
      console.warn("Nessun logo trovato per il team:", team);
      return "default_logo.png";
    }
  } catch (error) {
    console.error("Errore nello scraping del logo:", error);
    return "default_logo.png";
  }
}
