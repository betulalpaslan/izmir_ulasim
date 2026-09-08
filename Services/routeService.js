import { apiGet, apiPost } from "./apiClient";

const API_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://izmirbackend-production.up.railway.app";


const ROTA_TIMEOUT = 25000;

export async function fetchRoute(from, to, profile, bikeType = null) {
  return apiPost(
    `${API_URL}/get-route`,
    {
      from: { lat: from.latitude, lon: from.longitude },
      to:   { lat: to.latitude,   lon: to.longitude },
      profile,
      bikeType: bikeType || undefined,
      // İstenen güzergâh sayısı, gösterilecek kart sayısı değil: liste
      // backend'de ve arayüzde süzülüyor. 8 istemek çoğu modda 1 karta
      // düşüyordu; 25'te kart arttı, gecikme değişmedi (463→497 ms).
      numItineraries: 25,
    },
    { timeoutMs: ROTA_TIMEOUT }
  );
}

export async function fetchBisimZones() {
  const data = await apiGet(`${API_URL}/bisim/stations`, { timeoutMs: 10000 });
  return { bolgeler: data.bolgeler || [], hizmetAlani: data.hizmetAlani || null };
}

export async function fetchOsmParkingSpots() {
  const data = await apiGet(`${API_URL}/parking/osm`);
  return data.spots || [];
}

// OSM bisiklet parkları — yukarıdakiyle aynı gerekçe.
export async function fetchBicycleParkingStations() {
  const data = await apiGet(`${API_URL}/parking/bike-racks`);
  return data.stations || [];
}


export async function fetchPrStations({ tumu = false } = {}) {
  const data = await apiGet(`${API_URL}/parking/stations${tumu ? "?kapsam=tumu" : ""}`);
  return data.stations || [];
}

export async function fetchBikePrStations() {
  const data = await apiGet(`${API_URL}/parking/otp-lots?vehicle=bicycle`);
  return data.stations || [];
}
