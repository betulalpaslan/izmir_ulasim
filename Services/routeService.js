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
// NOT: BİSİM 2025-08'de sabit istasyonları kaldırdı; sistem bölge tabanlı.
// Bu uç artık BÖLGE döndürür, istasyon değil: bisiklet hizmet alanı içinde
// her yere bırakılabilir, bu bölgelere bırakılırsa bonus kazanılır.
// Dolayısıyla "doluluk" diye bir alan yok — olmadığı için de uydurulmuyor.
// Alanlar: { id, ad, ilce, lat, lon, yaricapM, guven }
// İki geometri birden döner ve ikisi ayrı soruya cevap verir:
//   bolgeler    → bırakınca bonus kazandıran alanlar
//   hizmetAlani → bisikletin bırakılabileceği alanın kendisi (dışına
//                 bırakılamaz). Dockless modelin bütün anlamı bu; alan
//                 çizilmeden kullanıcı yalnız 11 daire görüyor ve bisikleti
//                 başka bir yere bırakabileceğini bilmiyordu.
// Alan YAKLAŞIKTIR (bisiklet yolu ağından türetilmiş tamponlu kabuk), bu
// yüzden ekranda öyle etiketlenmeli — bkz. BisimMarkers.
export async function fetchBisimZones() {
  const data = await apiGet(`${API_URL}/bisim/stations`, { timeoutMs: 10000 });
  return { bolgeler: data.bolgeler || [], hizmetAlani: data.hizmetAlani || null };
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

// Bisikletim + Aktarma katmanı: OTP'nin bisiklet parkı için GERÇEKTEN
// değerlendirdiği yerler. İki kaynaktan gelirler:
//   • OSM'nin amenity=bicycle_parking düğümleri (87 nokta, sahil ağırlıklı)
//   • backend'in /parking/bike-feed'i — raylı sistem istasyonları
// İkincisi 2026-08'de eklendi: OSM'de metro istasyonlarında bisiklet parkı
// yoktu ve OTP bisikleti istasyonun kilometrelerce beriside bırakıp kalan
// yolu otobüsle kapatıyordu (bkz. ParkingService.bisikletParkYerleri).
// Katman böylece rotanın kullanabileceği noktaların tamamını gösterir.
export async function fetchBikePrStations() {
  const data = await apiGet(`${API_URL}/parking/otp-lots?vehicle=bicycle`);
  return data.stations || [];
}
