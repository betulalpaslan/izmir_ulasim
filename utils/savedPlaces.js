// KAYITLI YERLER — tek tanım, tek yazan.
//
// Liste iki dosyada kopyalanmıştı (useSettings ve FavoritesScreen) ve iki
// dosya aynı AsyncStorage anahtarına ayrı ayrı yazıyordu: harita ekranı
// kaydediyor, favoriler siliyordu. Beşinci bir yer eklendiğinde biri
// güncellenip diğeri unutulsa iki ekran farklı liste gösterecekti.
import AsyncStorage from "@react-native-async-storage/async-storage";

export const KAYITLI_YERLER_ANAHTARI = "savedPlaces";

export const KAYITLI_YERLER_VARSAYILAN = [
  { id: "home",   icon: "home",    label: "Ev",         address: null },
  { id: "school", icon: "student", label: "Okul",       address: null },
  { id: "work",   icon: "work",    label: "İş",         address: null },
  { id: "shop",   icon: "shop",    label: "Alışveriş",  address: null },
];

// Kaydedilmiş liste eski bir sürümden geliyor olabilir: tanımdaki yerler
// esas alınıp yalnız adresler kayıttan taşınıyor. Böylece listeye eklenen
// yeni bir yer eski kurulumlarda da görünüyor.
export function kayitliYerleriBirlestir(kayit) {
  if (!Array.isArray(kayit)) return KAYITLI_YERLER_VARSAYILAN;
  return KAYITLI_YERLER_VARSAYILAN.map((yer) => {
    const eski = kayit.find((k) => k?.id === yer.id);
    return eski?.address ? { ...yer, address: eski.address } : yer;
  });
}

export async function kayitliYerleriOku() {
  try {
    const raw = await AsyncStorage.getItem(KAYITLI_YERLER_ANAHTARI);
    return kayitliYerleriBirlestir(raw ? JSON.parse(raw) : null);
  } catch {
    return KAYITLI_YERLER_VARSAYILAN;
  }
}

// Diske yazan tek yer. Yazma başarısızsa `false` dönüyor — çağıran ekranı
// güncellemesin diye: kaydedilmemiş bir adres ekranda kayıtlı görünüp
// uygulama yeniden açıldığında kayboluyordu.
export async function kayitliYerleriYaz(liste) {
  try {
    await AsyncStorage.setItem(KAYITLI_YERLER_ANAHTARI, JSON.stringify(liste));
    return true;
  } catch {
    return false;
  }
}

// `address` null ise yer temizlenir.
export function yeriAyarla(liste, placeId, address) {
  return liste.map((p) => (p.id === placeId ? { ...p, address } : p));
}
