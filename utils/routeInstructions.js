// Bacak metinleri. Kullanıcı burada bir VERİ SATIRI değil, YAPILACAK İŞ
// okumalı: "Alsancak Gar → Çiğli İtfaiye" değil, "912 hattına Alsancak
// Gar'dan bin · Çiğli İtfaiye'de in".
//
// Yer adları OTP'den geldiği gibi cümleye konamıyor. Üç tuzak var, üçü de
// ekranda görüldü:
//   • "from" / "to" — sorguya koyduğumuz etiketlerdi ve kartta
//     "from → Asmaaltı" diye çıkıyordu. Etiketler backend'de "Başlangıç" /
//     "Varış" olarak düzeltildi, ama ikisi de bir YER ADI değil; cümleye
//     konursa "Varış noktasına yürü" gibi boş bir metin çıkar.
//   • "unknown" — OTP'nin adsız düğüm karşılığı
//   • "BİSİM bisikleti" — serbest kiralık aracın adı; yer değil, araç
//
// Bacak tek başına yeterli bağlam taşımıyor, bu yüzden fonksiyon TÜM
// listeyi görüyor: bir yürüyüşün anlamı ardından geleni, bisikletin park
// edilip edilmediği ise transitten SONRA bisikletin devam edip etmediğini
// bilmeyi gerektiriyor.

const TRANSIT_MODES = ["BUS", "RAIL", "SUBWAY", "TRAM"];   // vapur yok — bkz. routeScoring
const BISIKLET_MODLARI = ["BICYCLE", "BICYCLE_RENTAL"];

const YER_DEGIL = new Set(["from", "to", "unknown", "Başlangıç", "Varış", "BİSİM bisikleti"]);

function yer(ad) {
  const t = String(ad ?? "").trim();
  return !t || YER_DEGIL.has(t) ? null : t;
}

const dk = (leg) => `${Math.max(1, Math.round((leg.duration || 0) / 60))} dk`;

export function getLegInstruction(leg, legs = null, index = -1) {
  const liste = Array.isArray(legs) ? legs : [];
  const i = index >= 0 ? index : liste.indexOf(leg);
  const sonraki = i >= 0 ? liste[i + 1] : undefined;
  const sonMu = i >= 0 ? i === liste.length - 1 : false;

  const nereye = yer(leg.to);
  const nereden = yer(leg.from);

  if (leg.mode === "WALK") {
    if (sonraki && TRANSIT_MODES.includes(sonraki.mode)) {
      return { title: nereye ? `${nereye} durağına yürü` : "Durağa yürü", detail: `${dk(leg)} yürüyüş` };
    }
    if (sonraki && sonraki.mode === "BICYCLE_RENTAL") {
      return { title: "Bisikletin yanına yürü", detail: `${dk(leg)} yürüyüş` };
    }
    if (sonMu || !sonraki) {
      return { title: nereye ? `${nereye} noktasına yürü` : "Varışa yürü", detail: `${dk(leg)} yürüyüş · son adım` };
    }
    return { title: nereye ? `${nereye} noktasına yürü` : "Yürü", detail: `${dk(leg)} yürüyüş` };
  }

  if (TRANSIT_MODES.includes(leg.mode)) {
    // Hat numarası olmayan servisler var: İZBAN seferlerinin GTFS'te
    // short_name'i yok ve "Araca ... bin" diye çıkıyordu. O durumda modun
    // adı ("Banliyö", "Metro", "Tramvay") çok daha bilgilendirici.
    const hat = leg.routeName
      ? `${leg.routeName} hattına`
      : leg.label ? `${leg.label} hattına` : "Araca";
    const bin = nereden ? `${hat} ${nereden} durağından bin` : `${hat} bin`;
    const inis = nereye ? `${nereye} durağında in` : "Son durakta in";
    // Bisiklet bu araca BİNİYOR mu? Cevap ancak listeye bakınca verilebilir:
    // bisiklet bacağı transitten SONRA da devam ediyorsa bisiklet yanındadır.
    // Kullanıcının bilmesi gereken tam olarak bu — bırakacak mı, alacak mı.
    const oncedenBisiklet = liste.slice(0, i).some((l) => BISIKLET_MODLARI.includes(l.mode));
    const sonradanBisiklet = liste.slice(i + 1).some((l) => BISIKLET_MODLARI.includes(l.mode));
    const bisikletYanimda = oncedenBisiklet && sonradanBisiklet;
    return { title: bin, detail: bisikletYanimda ? `${inis} · bisikletin yanında` : inis };
  }

  if (leg.mode === "BICYCLE_RENTAL") {
    if (sonMu || !sonraki) {
      return { title: "Bisikletle varışa git", detail: `${dk(leg)} sürüş · hizmet alanı içinde bırak` };
    }
    if (TRANSIT_MODES.includes(sonraki.mode)) {
      return {
        title: nereye ? `Bisikletle ${nereye} durağına git` : "Bisikletle durağa git",
        detail: `${dk(leg)} sürüş · bisikleti burada bırak`,
      };
    }
    return { title: "Bisikletle devam et", detail: `${dk(leg)} sürüş` };
  }

  if (leg.mode === "BICYCLE") {
    if (sonMu || !sonraki) {
      return { title: "Bisikletle varışa git", detail: `${dk(leg)} sürüş · son adım` };
    }
    if (TRANSIT_MODES.includes(sonraki.mode)) {
      // Bisikleti park mı edecek, yanına mı alacak? Sonrasında yine bisiklet
      // bacağı varsa yanına alıyordur (metro, tramvay ve İZBAN'a bisiklet
      // binebiliyor — bkz. izmir_backend/docs/API.md).
      const yanindaGotururuyor = liste.slice(i + 1).some((l) => BISIKLET_MODLARI.includes(l.mode));
      return {
        title: nereye ? `Bisikletle ${nereye} istasyonuna git` : "Bisikletle istasyona git",
        detail: yanindaGotururuyor
          ? `${dk(leg)} sürüş · bisikleti yanına al`
          : `${dk(leg)} sürüş · bisikleti burada kilitle`,
      };
    }
    return { title: nereye ? `Bisikletle ${nereye} noktasına git` : "Bisikletle devam et", detail: `${dk(leg)} sürüş` };
  }

  if (leg.mode === "CAR") {
    return {
      title: nereye ? `${nereye} otoparkına sür` : "Otoparka sür",
      detail: `${dk(leg)} sürüş · aracı burada bırak`,
    };
  }

  return { title: nereye ? `${nereye} noktasına devam et` : "Devam et", detail: dk(leg) };
}
