const TRANSIT_MODES = ["BUS", "RAIL", "SUBWAY", "TRAM"];   // vapur yok — bkz. routeScoring
const BISIKLET_MODLARI = ["BICYCLE", "BICYCLE_RENTAL"];

const YER_DEGIL = new Set(["from", "to", "unknown", "Başlangıç", "Varış", "BİSİM bisikleti"]);

function yer(ad) {
  const t = String(ad ?? "").trim();
  return !t || YER_DEGIL.has(t) ? null : t;
}

const dk = (leg) => `${Math.max(1, Math.round((leg.duration || 0) / 60))} dk`;

// Uçlar dışarıdan verilir: OTP'nin uç etiketleri "Başlangıç"/"Varış" olduğu
// için gerçek yer adını yalnız arayüz biliyor. Uç adı yalnız ilk bacağın
// kalkışına ve son bacağın varışına düşer.
function legUclari(leg, legs = null, index = -1, uclar = {}) {
  const liste = Array.isArray(legs) ? legs : [];
  const i = index >= 0 ? index : liste.indexOf(leg);
  const sonMu = i >= 0 ? i === liste.length - 1 : false;
  return {
    nereden: yer(leg.from) || (i === 0 ? yer(uclar.baslangic) : null),
    nereye: yer(leg.to) || (sonMu ? yer(uclar.varis) : null),
  };
}

// Adım metni + çözülmüş uçlar. Arayüz "şuradan şuraya" satırını kendi
// uydurmasın diye nereden/nereye de dönüyor.
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

// Kartın tek satırlık özeti: her transit bacağının binilen ve inilen durağı.
// Aynı durakta aktarmada ad iki kez çıkmasın diye ardışık tekrar süzülür.
// Transit yoksa boş döner — söylenecek tek şey uçlar olurdu, onlar zaten
// arama kutularında yazıyor.
export function guzergahZinciri(legs) {
  const liste = Array.isArray(legs) ? legs : [];
  const noktalar = [];
  for (const l of liste) {
    if (!TRANSIT_MODES.includes(l.mode)) continue;
    noktalar.push(yer(l.from) || "Durak", yer(l.to) || "Son durak");
  }
  return noktalar.filter((ad, i) => ad !== noktalar[i - 1]);
}
