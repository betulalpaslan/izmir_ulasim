const API_URL = "https://izmirbackend-production.up.railway.app";
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const IZMIR_BBOX = "38.2,26.8,38.6,27.5";

export async function fetchRoute(from, to, profile, bikeType = null) {
  const res = await fetch(`${API_URL}/get-route`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      from: { lat: from.latitude, lon: from.longitude },
      to:   { lat: to.latitude,   lon: to.longitude },
      profile,
      bikeType: bikeType || undefined,
      numItineraries: 8,
    }),
  });
  return res.json();
}

async function overpassQuery(query) {
  const res = await fetch(`${OVERPASS_URL}?data=${encodeURIComponent(query)}`);
  const data = await res.json();
  return data.elements || [];
}

export async function fetchBisimStations() {
  const elements = await overpassQuery(
    `[out:json];node[amenity=bicycle_rental](${IZMIR_BBOX});out;`
  );
  return elements.map((e) => ({
    id:       e.id,
    name:     e.tags?.name || `BİSİM ${e.tags?.ref || e.id}`,
    lat:      e.lat,
    lon:      e.lon,
    capacity: parseInt(e.tags?.capacity) || null,
  }));
}

// OSM'den kapalı ve yeraltı otoparkları + isimli açık otoparklar
export async function fetchOsmParkingSpots() {
  const query = `
    [out:json][timeout:10];
    (
      node[amenity=parking][parking~"multi-storey|underground"](${IZMIR_BBOX});
      way[amenity=parking][parking~"multi-storey|underground"](${IZMIR_BBOX});
      node[amenity=parking][parking=surface][name](${IZMIR_BBOX});
      way[amenity=parking][parking=surface][name](${IZMIR_BBOX});
    );
    out center;
  `;
  const elements = await overpassQuery(query);
  return elements
    .map((e) => ({
      id:       e.id,
      name:     e.tags?.name || null,
      lat:      e.lat ?? e.center?.lat,
      lon:      e.lon ?? e.center?.lon,
      type:     e.tags?.parking || "surface",
      fee:      e.tags?.fee === "yes" ? true : e.tags?.fee === "no" ? false : null,
      capacity: parseInt(e.tags?.capacity) || null,
    }))
    .filter((s) => s.lat != null && s.lon != null);
}

// Gerçek zamanlı BİSİM doluluk verisi (backend GBFS önbelleği)
export async function fetchBisimRealtimeStations() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${API_URL}/bisim/stations`, { signal: controller.signal });
    const data = await res.json();
    return data.stations || [];
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchBicycleParkingStations() {
  const elements = await overpassQuery(
    `[out:json];node[amenity=bicycle_parking](${IZMIR_BBOX});out;`
  );
  return elements.map((e) => ({
    id:       e.id,
    lat:      e.lat,
    lon:      e.lon,
    capacity: parseInt(e.tags?.capacity) || null,
  }));
}

// Araba P+R: zengin doluluk + yakın durak bilgisiyle
export async function fetchPrStations() {
  const res = await fetch(`${API_URL}/parking/stations`);
  const data = await res.json();
  return data.stations || [];
}

// Bisiklet PARK: OTP'nin kullandığı bike_and_ride etiketli lotlar
export async function fetchBikePrStations() {
  const res = await fetch(`${API_URL}/parking/otp-lots?tag=bike_and_ride`);
  const data = await res.json();
  return data.stations || [];
}
