import { apiGet } from "./apiClient";

const API_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://izmirbackend-production.up.railway.app";

// Adres araması artık backend üzerinden. Photon/Nominatim çağrıları,
// tekrar eleme ve sonuç sıralaması orada (services/GeocodingService.js).
// Buraya taşınmasının sebebi yalnızca tutarlılık değildi — burada üç kusur
// vardı ve üçü de backend'e taşınırken düzeltildi:
//   • "lang=tr" gönderiliyordu; Photon bunu desteklemez ve 400 döner, yani
//     Photon HİÇ çalışmıyor, her arama sessizce Nominatim'e düşüyordu
//   • Türkçe yazılan sorgu ("güzel") Photon'un ASCII indeksinde karşılık
//     bulmuyordu — sorgu artık ASCII'ye çevriliyor
//   • aynı yerin station/tram_stop/building kayıtları listeyi dolduruyordu

// En kısa sorgu 2 harf: "ko" yazınca Konak çıkmalı. Eskiden 3 harf şarttı ve
// kısa yer adları hiç aranamıyordu.
const MIN_UZUNLUK = 2;

// Her tuşta istek atmamak için bekleme. 400 ms fazlaydı: kullanıcı yazmayı
// bırakıp sonucu beklerken listeyi geç görüyordu.
const BEKLEME_MS = 250;

let searchTimer = null;
let sonIstekNo = 0;

export function searchAddress(text, callback) {
  clearTimeout(searchTimer);

  const sorgu = String(text || "").trim();
  if (sorgu.length < MIN_UZUNLUK) {
    callback([]);
    return;
  }

  searchTimer = setTimeout(async () => {
    // Yavaş bir istek, sonradan başlayan hızlı bir isteğin sonucunu ezmemeli:
    // kullanıcı "konak" yazmışken ekranda "kon" sonuçları kalırdı.
    const istekNo = ++sonIstekNo;
    try {
      const data = await apiGet(`${API_URL}/geocode?q=${encodeURIComponent(sorgu)}`, { timeoutMs: 8000 });
      if (istekNo !== sonIstekNo) return;
      callback(data.results || []);
    } catch (err) {
      if (istekNo !== sonIstekNo) return;
      // Arama çalışmasa bile kullanıcı haritaya dokunarak nokta seçebilir;
      // bu yüzden hata kullanıcıya bir uyarı olarak değil, boş liste olarak
      // yansır — ama sebebi log'a yazılır.
      console.warn("Adres araması başarısız:", err?.message ?? err);
      callback([]);
    }
  }, BEKLEME_MS);
}
