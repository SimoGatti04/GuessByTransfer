/**
 * Restituisce una stringa normalizzata (rimuove accenti e caratteri speciali)
 * usando la normalizzazione Unicode e rimuovendo i diacritici.
 */
export function normalizeString(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/**
 * Cerca tra un array di giocatori (ogni giocatore ha una proprietà "name")
 * e restituisce quelli il cui nome (normalizzato) contiene la query normalizzata.
 *
 * @param {Array} players - Array di oggetti giocatore, ad es. [{ name: "José", ...}, { name: "Lukáš", ...}]
 * @param {string} query - La stringa di ricerca inserita dall'utente.
 * @returns {Array} - Array di giocatori che corrispondono alla query.
 */
export function searchPlayers(players, query) {
  const normalizedQuery = normalizeString(query);
  return players.filter(player => normalizeString(player.name).includes(normalizedQuery));
}
