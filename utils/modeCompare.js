// KARAR MATRİSİ.
//
// Uygulama tek seferde tek modun sonucunu gösteriyor: kullanıcı BİSİM'i
// seçiyor, kartları görüyor, sonra arabayı seçip baştan arıyor ve ikisini
// kafasında tutmaya çalışıyor. Karşılaştırma bu yükü ekrana alıyor —
// aynı yolculuk, tüm modlar, aynı ölçütler yan yana.
//
// Buradaki hiçbir şey ağ bilmiyor: girdisi her modun HAM yanıtı, çıktısı
// satırlar. Çağıran taraf (mobil hook ya da web) sorguları paralel atar.
// Sıralama ve puanlama routeScoring'den geliyor, yani matris ile kart
// listesi aynı modeli kullanıyor — biri diğerinden farklı bir "en iyi"
// gösteremez.
import {
  rankItineraries, selectCandidates, buildRouteResult, modBosSebebi,
} from "./routeScoring.js";

// Karşılaştırmaya giren modlar ve istek gövdeleri. `id` aynı zamanda
// profileKey: routeScoring'in ağırlık tabloları bu anahtarla çalışıyor.
// `ucret` alanı: "tam" = modellenen her kalem hesaplanıyor, "eksik" = bir
// kısmı hesaplanıyor, "yok" = hiç hesaplanmıyor.
//
// Bu ayrım matrisin dürüstlüğü için ŞART. Araba için yakıt, amortisman ve
// otopark ücreti modellenmiyor; alan 0 ₺ olarak dolduğunda araba hem "en
// hızlı" hem "en ucuz" rozetini alıyordu (ölçüldü: üç yolculuğun üçünde).
// Tek mod ekranında görünmeyen bu boşluk, yan yana koyunca kararı
// doğrudan yanlış yöne çeviriyor. Bilinmeyen maliyet 0 değildir.
export const KARSILASTIRMA_MODLARI = [
  { id: "transit",       ad: "Toplu taşıma",     ucret: "tam",   istek: { profile: "transit" } },
  { id: "bicycle_rent",  ad: "BİSİM",            ucret: "tam",   istek: { profile: "bicycle", bikeType: "RENT" } },
  { id: "bicycle_park",  ad: "Kişisel bisiklet", ucret: "tam",   istek: { profile: "bicycle", bikeType: "PARK" } },
  { id: "car",           ad: "Araba",            ucret: "yok",   istek: { profile: "car" } },
  // Bilet hesaplanıyor; otopark ücreti ve yakıt hesaplanmıyor.
  { id: "park_and_ride", ad: "Park + Devam",     ucret: "eksik", istek: { profile: "park_and_ride" } },
];

// Rozet verilen ölçütler. Hepsi "küçük olan iyi" — yön karışmasın diye
// tek yönlü tutuldu; bir ölçüt eklenirse yönü de burada tanımlanmalı.
//
// ÜCRET BİLEREK YOK. Satırda bilgi olarak gösteriliyor ama "en ucuz" rozeti
// verilmiyor, çünkü maliyeti her mod için aynı bütünlükte hesaplayamıyoruz:
// arabanın yakıtı ve otoparkı hiç modellenmiyor, Park + Devam'ın bileti
// hesaplanıp otoparkı hesaplanmıyor. Yarısı hesaplanmış bir kalem üzerinden
// "en ucuz" demek, karar matrisinin tam da düzeltmesi gereken hatayı
// üretirdi (ölçüldü: araba üç yolculuğun üçünde de 0 ₺ ile "en ucuz"
// çıkıyordu). Maliyet modeli tamamlanırsa ölçüt buraya eklenir.
export const OLCUTLER = [
  { id: "sure",     ad: "Süre",     al: (s) => s.sureSn },
  { id: "yuruyus",  ad: "Yürüyüş",  al: (s) => s.yuruyusM },
  { id: "aktarma",  ad: "Aktarma",  al: (s) => s.aktarma },
];

// Bir modun ham yanıtını tek bir karar satırına indirger.
//
// Boş mod da satır üretir ve bu bilerek: karar matrisinde "bu mod bu
// yolculuğu yapamıyor" da bir bilgidir, hatta bazen en değerlisidir.
// Sebep `modBosSebebi`'den geliyor, yani kart listesindekiyle aynı cümle.
export function modSatiri(mod, data, fareBase = 35, farePerBoarding = false) {
  const bos = { id: mod.id, ad: mod.ad, calisti: false, sureSn: null,
                yuruyusM: null, aktarma: null, ucret: null, kart: null };

  if (!data || data.error) {
    return { ...bos, sebep: data?.error || "Sonuç alınamadı." };
  }
  const itineraries = data.itineraries || [];
  if (itineraries.length === 0) return { ...bos, sebep: "Güzergâh bulunamadı." };

  const ranked = rankItineraries(itineraries, mod.id);
  if (ranked.length === 0) {
    const sebep = modBosSebebi(itineraries, mod.id);
    return { ...bos, sebep: sebep.mesaj || "Bu mod bu yolculuğa uygun değil.",
             kod: sebep.kod, alternatifSn: sebep.alternatifSn };
  }

  // Matriste modu temsil eden kart, o modun ÖNERDİĞİ karttır — "en hızlı"
  // değil. Kullanıcı modu seçtiğinde ilk göreceği kart bu; matris başka bir
  // kart gösterirse iki ekran birbirini yalanlar.
  const [onerilen] = selectCandidates(ranked, mod.id);
  const kart = buildRouteResult(onerilen, fareBase, farePerBoarding, mod.id);

  return {
    id: mod.id, ad: mod.ad, calisti: true,
    sureSn:   kart.totalDuration,
    yuruyusM: kart.walkMeters,
    aktarma:  kart.transfers,
    // Hiç modellenmiyorsa sayı yazmak yerine boş bırakılır: 0 ₺ "bedava"
    // diye okunur ve matristeki en yanıltıcı hücre olur.
    ucret:      mod.ucret === "yok" ? null : kart.cost,
    ucretDurum: mod.ucret,
    yuruyusZorunlu: kart.yuruyusZorunlu,
    kart,
  };
}

// Her ölçütte en iyi satırı işaretler.
//
// Ayırt etmeyen ölçüt işaretlenmez: tüm modlarda ücret aynıysa "en ucuz"
// rozeti bilgi taşımaz, sadece gürültü olur. Aynı kural kart etiketlerinde
// de var (routeScoring: ADAY_OLCULERI).
export function enIyileriIsaretle(satirlar) {
  const enIyi = {};
  for (const olcut of OLCUTLER) {
    const degerler = satirlar.filter((s) => s.calisti).map(olcut.al)
      .filter((v) => typeof v === "number" && Number.isFinite(v));
    if (degerler.length < 2) continue;
    const min = Math.min(...degerler);
    if (min === Math.max(...degerler)) continue;
    enIyi[olcut.id] = min;
  }
  return satirlar.map((s) => ({
    ...s,
    enIyiOlcutler: !s.calisti ? [] :
      OLCUTLER.filter((o) => enIyi[o.id] != null && o.al(s) === enIyi[o.id]).map((o) => o.id),
  }));
}

// Tam matris: satırları üret, en iyileri işaretle, çalışanları öne al.
// Sıralama ölçüte göre değil "çalışıyor mu"ya göre: boş modlar listenin
// dibinde kalsın ki göz önce yapılabilir seçenekleri görsün.
export function karsilastirmaMatrisi(yanitlar, fareBase = 35, farePerBoarding = false) {
  const satirlar = KARSILASTIRMA_MODLARI.map((mod) =>
    modSatiri(mod, yanitlar[mod.id], fareBase, farePerBoarding));
  const isaretli = enIyileriIsaretle(satirlar);
  return [...isaretli].sort((a, b) => Number(b.calisti) - Number(a.calisti));
}
