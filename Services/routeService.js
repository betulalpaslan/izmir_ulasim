import { apiGet, apiPost } from "./apiClient";

const API_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://izmirbackend-production.up.railway.app";

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

// OSM'den kapalı ve yeraltı otoparkları + isimli açık otoparklar.
// Overpass sorgusu backend'e taşındı: cache, üç mirror ve disk yedeği orada.
// Ayrıca Overpass'ın hız sınırı IP başınadır — buradan çekilirken sınır her
// kullanıcının cihazına ayrı uygulanıyordu ve kalabalık saatte rastgele
// kullanıcılar boş katman görüyordu.
export async function fetchOsmParkingSpots() {
  const data = await apiGet(`${API_URL}/parking/osm`);
  return data.spots || [];
}

// OSM bisiklet parkları — yukarıdakiyle aynı gerekçe.
export async function fetchBicycleParkingStations() {
  const data = await apiGet(`${API_URL}/parking/bike-racks`);
  return data.stations || [];
}

// Araba P+R: zengin doluluk + yakın durak bilgisiyle
export async function fetchPrStations() {
  const data = await apiGet(`${API_URL}/parking/stations`);
  return data.stations || [];
}

// Bisiklet PARK+TAŞIMA: OTP'nin bisiklet parkı için gerçekten değerlendirdiği
// yerler — 2026-08 ölçümünde 87 gerçek OSM bisiklet parkı. Bir süre burada
// İZELMAN'ın 6 araba otoparkı da görünüyordu (router-config aynı feed'i
// BICYCLE_PARK_API olarak da besliyordu); o updater kaldırıldı.
export async function fetchBikePrStations() {
  const data = await apiGet(`${API_URL}/parking/otp-lots?vehicle=bicycle`);
  return data.stations || [];
}
