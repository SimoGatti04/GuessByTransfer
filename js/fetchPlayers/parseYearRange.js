function parseYearRange(yearStr) {
  // Rimuovi spazi e caratteri non stampabili
  const str = yearStr.trim();

  // Caso 1: Formato singolo anno, es. "2013"
  if (/^\d{4}$/.test(str)) {
    const year = parseInt(str, 10);
    return { start: year, end: year, duration: 1 };
  }

  // Caso 2: Formato intervallo, es. "2010-2013" o "2010–2013" (trattino lungo o breve)
  if (/^\d{4}\s*[-–]\s*\d{4}$/.test(str)) {
    // Usa una regex che riconosca sia il trattino '-' che il trattino lungo '–'
    const parts = str.split(/[-–]/);
    const start = parseInt(parts[0].trim(), 10);
    const end = parseInt(parts[1].trim(), 10);
    return { start, end, duration: end - start + 1 };
  }

  // Caso 3: Inizio solo, es. "2010-" o "2010–"
  if (/^\d{4}\s*[-–]\s*$/.test(str)) {
    const start = parseInt(str.slice(0, 4), 10);
    // Qui non conosciamo la fine, potremmo considerare la durata come indefinita,
    // oppure, se lo scopo è solo il controllo per il filtraggio, occorre usare il valore 'start'.
    return { start, end: null, duration: null };
  }

  // Se non riconosciamo il formato, ritorna null
  return null;
}

module.exports = parseYearRange;
