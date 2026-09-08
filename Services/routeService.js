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
      // KAÇ GÜZERGÂH İSTENDİĞİ, kaç kart gösterileceği DEĞİL. Aradaki fark
      // ölçüldü: gelen liste birkaç kez süzülüyor (backend aynı hattın başka
      // kalkışını teker, arayüz mod vaadini görmeyeni eler), yani 8 istemek
      // 8 seçenek değil çoğu zaman 1 kart demekti.
      //
      // Pzt 08:00, 7 rota × 5 mod ölçümü — 8 yerine 25 istendiğinde:
      //   sahil-bati   BİSİM         3 → 4 kart   (bisikletli güzergâh 3 → 6)
      //   sahil-bati   toplu taşıma  3 → 4 kart
      //   kuzey-merkez BİSİM         1 → 2 kart
      //   çevre-merkez bisikletim    eleme sonrası 7 → 9 güzergâh
      // Hiçbir satır GERİLEMEDİ. Bedeli yok: aynı ölçümde ortanca yanıt
      // süresi 463 ms → 497 ms, yani gürültü sınırında (OTP tek sorguda
      // zaten aynı aramayı yapıyor, `first` çıktının kaçının döndüğü).
      //
      // Kart sayısını asıl bağlayan yer burası değil, routeScoring'deki
      // MAX_ROUTES (toplu taşımada 5).
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
