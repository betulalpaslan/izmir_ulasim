import { apiGet } from "./apiClient";

const API_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://izmirbackend-production.up.railway.app";


const MIN_UZUNLUK = 2;

// Her tuşta istek atmamak için bekleme. 400 ms fazlaydı: kullanıcı yazmayı
// bırakıp sonucu beklerken listeyi geç görüyordu.
const BEKLEME_MS = 250;

let searchTimer = null;
let sonIstekNo = 0;


export function aramayiIptalEt() {
  clearTimeout(searchTimer);
  searchTimer = null;
  sonIstekNo++;
}

export function searchAddress(text, callback) {
  aramayiIptalEt();

  const sorgu = String(text || "").trim();
  if (sorgu.length < MIN_UZUNLUK) {
    callback([]);
    return;
  }

  searchTimer = setTimeout(async () => {
   
    const istekNo = ++sonIstekNo;
    try {
      const data = await apiGet(`${API_URL}/geocode?q=${encodeURIComponent(sorgu)}`, { timeoutMs: 8000 });
      if (istekNo !== sonIstekNo) return;
      callback(data.results || []);
    } catch (err) {
      if (istekNo !== sonIstekNo) return;
      console.warn("Adres araması başarısız:", err?.message ?? err);
      callback([]);
    }
  }, BEKLEME_MS);
}
