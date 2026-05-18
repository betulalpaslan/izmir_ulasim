async function fetchPhoton(text) {
  const url =
    `https://photon.komoot.io/api/?` +
    `q=${encodeURIComponent(text)}&limit=4&lang=tr` +
    `&lat=38.42&lon=27.14&bbox=26.5,38.2,27.5,38.7`;
  const res = await fetch(url, { headers: { "User-Agent": "IzmirUlasimApp/1.0" } });
  const data = await res.json();
  return (data.features || []).map((f, i) => {
    const p = f.properties;
    const nameParts = [p.name, p.street, p.housenumber].filter(Boolean);
    const detailParts = [p.district || p.county, p.city || p.state].filter(Boolean);
    return {
      place_id: `ph_${p.osm_id || i}`,
      lat: String(f.geometry.coordinates[1]),
      lon: String(f.geometry.coordinates[0]),
      display_name: [...nameParts, ...detailParts].join(", "),
    };
  });
}

async function fetchNominatim(text) {
  const url =
    `https://nominatim.openstreetmap.org/search?` +
    `q=${encodeURIComponent(text)}&format=json&limit=4` +
    `&viewbox=26.5,38.2,27.5,38.7&accept-language=tr`;
  const res = await fetch(url, { headers: { "User-Agent": "IzmirUlasimApp/1.0" } });
  const data = await res.json();
  return data.map((item) => ({
    place_id: `nm_${item.place_id}`,
    lat: item.lat,
    lon: item.lon,
    display_name: item.display_name,
  }));
}

function deduplicateResults(results) {
  const seen = [];
  return results.filter((r) => {
    const lat = parseFloat(r.lat);
    const lon = parseFloat(r.lon);
    const tooClose = seen.some(
      (s) => Math.abs(s.lat - lat) < 0.002 && Math.abs(s.lon - lon) < 0.002
    );
    if (!tooClose) seen.push({ lat, lon });
    return !tooClose;
  });
}

let searchTimer = null;
export function searchAddress(text, callback) {
  clearTimeout(searchTimer);
  if (text.length < 3) { callback([]); return; }
  searchTimer = setTimeout(async () => {
    try {
      const [photon, nominatim] = await Promise.all([
        fetchPhoton(text).catch(() => []),
        fetchNominatim(text).catch(() => []),
      ]);
      callback(deduplicateResults([...photon, ...nominatim]).slice(0, 6));
    } catch { callback([]); }
  }, 400);
}
