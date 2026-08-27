import { apiGet, apiPost } from "./apiClient";

const API_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://izmirbackend-production.up.railway.app";
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const IZMIR_BBOX = "38.2,26.8,38.6,27.5";

// Rota isteği en uzun süren çağrı: OTP'nin plan sorgusu backend'de 15 sn
// timeout ile bekletiliyor, istemci ondan önce vazgeçmemeli.
const ROTA_TIMEOUT = 25000;

export async function fetchRoute(from, to, profile, bikeType = null) {
  return apiPost(
    `${API_URL}/get-route`,
    {
      from: { lat: from.latitude, lon: from.longitude },
      to:   { lat: to.latitude,   lon: to.longitude },
      profile,
      bikeType: bikeType || undefined,
      numItineraries: 8,
    },
    { timeoutMs: ROTA_TIMEOUT }
  );
}

async function overpassQuery(query) {
  const data = await apiGet(`${OVERPASS_URL}?data=${encodeURIComponent(query)}`);
  return data.elements || [];
}

// BİSİM istasyonları backend'den alınır. Doğrudan Overpass sorgusu
// `amenity=bicycle_rental` etiketli her noktayı döndürüyordu; bunların
// arasında özel kiralama dükkânları ve kaldırılmış istasyonlar da vardı.
// Backend operator=BİSİM süzgecini uygular ve kapasiteyi tamamlar.
//
// NOT: Bu uç anlık doluluk döndürmez — her istasyona bikes: null yazar.
// BİSİM'in gerçek zamanlı verisi 2025-07-23'ten beri yayınlanmıyor.
// (Eskiden ayrıca bir fetchBisimRealtimeStations vardı; aynı ucu çağırıyor,
// yalnızca timeout'u farklıydı. Artık timeout burada.)
export async function fetchBisimStations() {
  const data = await apiGet(`${API_URL}/bisim/stations`, { timeoutMs: 10000 });
  return data.stations || [];
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
  const data = await apiGet(`${API_URL}/parking/stations`);
  return data.stations || [];
}

// Bisiklet PARK+TAŞIMA: OTP'nin bisiklet parkı için gerçekten değerlendirdiği
// TÜM yerler (OSM bisiklet parkları + İZELMAN lotları). Daha önce yalnızca
// bike_and_ride etiketli 6 İZELMAN lotu gösteriliyordu; harita rotanın
// kullandığı yerlerin çok küçük bir kısmını yansıtıyordu.
export async function fetchBikePrStations() {
  const data = await apiGet(`${API_URL}/parking/otp-lots?vehicle=bicycle`);
  return data.stations || [];
}
