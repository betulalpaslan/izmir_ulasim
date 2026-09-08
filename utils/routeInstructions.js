const TRANSIT_MODES = ["BUS", "RAIL", "SUBWAY", "TRAM"];   // vapur yok — bkz. routeScoring
const BISIKLET_MODLARI = ["BICYCLE", "BICYCLE_RENTAL"];

const YER_DEGIL = new Set(["from", "to", "unknown", "Başlangıç", "Varış", "BİSİM bisikleti"]);

function yer(ad) {
  const t = String(ad ?? "").trim();
  return !t || YER_DEGIL.has(t) ? null : t;
}

const dk = (leg) => `${Math.max(1, Math.round((leg.duration || 0) / 60))} dk`;

// Yolculuğun UÇLARI dışarıdan verilir. Sebep: OTP'ye gönderilen uç etiketleri
// "Başlangıç"/"Varış" (bkz. backend OtpService.js planConnection) ve `yer()`
// onları yer adı saymıyor — haklı olarak, çünkü yer adı değiller. Sonuç, son
// adımın "Varışa yürü" demesiydi: kullanıcının aradığı "Karşıyaka İskele"
// ekranda hiç geçmiyordu. Uçları bilen tek katman arayüz (kullanıcının
// yazdığı/seçtiği ad orada), o yüzden buraya parametreyle iner.
// Bacağın İKİ UCU, adlarıyla. Ayrı durmasının sebebi: arayüzler adımı iki
// ayrı biçimde gösteriyor — biri eylem cümlesi ("Poligon durağına yürü"),
// öbürü akış satırı ("Konak Meydanı → Poligon"). İkisi de aynı ad çözümüne
// dayanmalı, yoksa aynı bacak iki yerde iki başka yer adıyla görünür.
export function legUclari(leg, legs = null, index = -1, uclar = {}) {
  const liste = Array.isArray(legs) ? legs : [];
  const i = index >= 0 ? index : liste.indexOf(leg);
  // Uç adı yalnız İLK bacağın kalkışına ve SON bacağın varışına düşer;
  // aradaki bacakların uçları gerçek durak adlarıdır, onlara dokunulmaz.
  const sonMu = i >= 0 ? i === liste.length - 1 : false;
  return {
    nereden: yer(leg.from) || (i === 0 ? yer(uclar.baslangic) : null),
    nereye: yer(leg.to) || (sonMu ? yer(uclar.varis) : null),
  };
}

// Adım metni + çözülmüş uçlar. `nereden`/`nereye` dönmesi bilerek: arayüz
// "şuradan şuraya" satırını kendi uydurmasın, uç adlarını buradan alsın.
export function getLegInstruction(leg, legs = null, index = -1, uclar = {}) {
  const uc = legUclari(leg, legs, index, uclar);
  return { ...adimMetni(leg, legs, index, uc), ...uc };
}

function adimMetni(leg, legs, index, uc) {
  const liste = Array.isArray(legs) ? legs : [];
  const i = index >= 0 ? index : liste.indexOf(leg);
  const sonraki = i >= 0 ? liste[i + 1] : undefined;
  const sonMu = i >= 0 ? i === liste.length - 1 : false;
  const { nereden, nereye } = uc;

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
    const hat = leg.routeName
      ? `${leg.routeName} hattına`
      : leg.label ? `${leg.label} hattına` : "Araca";
    const bin = nereden ? `${hat} ${nereden} durağından bin` : `${hat} bin`;
    const inis = nereye ? `${nereye} durağında in` : "Son durakta in";
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

// ─── Kartın tek satırlık güzergâh özeti ────────────────────────────────
// Kullanıcı bildirimi: "yolculuk görünüyor ama nereden nereye gidileceği
// anlaşılmıyor". Kapalı kartta yalnız süre, mesafe ve mod ikonları vardı;
// hangi duraktan binilip nerede inileceği ancak kart AÇILINCA görülüyordu.
//
// Zincir, yolculuğun kırılma noktalarını verir: binilen durak, aktarma
// durakları ve inilen durak.
//
// Transit yoksa (saf bisiklet/araba/yürüyüş) zincir BOŞTUR — uçları
// tekrarlamaz. Kırılma noktası olmayan bir yolculukta söylenecek tek şey
// zaten uçlardır ve onları listenin başlığı söylüyor; aynı iki adı bir de
// kartın içine yazmak bilgi eklemiyor, satır ekliyordu.
export function guzergahZinciri(legs) {
  const liste = Array.isArray(legs) ? legs : [];
  const transit = liste.filter((l) => TRANSIT_MODES.includes(l.mode));
  if (transit.length === 0) return [];

  const noktalar = [];
  transit.forEach((l, i) => {
    noktalar.push(yer(l.from) || "Durak");
    if (i === transit.length - 1) noktalar.push(yer(l.to) || "Son durak");
  });
  // Aynı durakta aktarmada iniş ve biniş adı aynıdır; iki kez yazmak
  // zincirde olmayan bir adım varmış izlenimi veriyor.
  return noktalar.filter((ad, i) => ad !== noktalar[i - 1]);
}
