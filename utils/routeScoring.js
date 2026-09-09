import { decodePolyline } from "./polyline.js";
import { haversineMeters } from "./geo.js";
export const MODE_STYLE = {
  WALK:           { color: "#8b8aa8", icon: "walk",  label: "Yürüyüş" },
  BUS:            { color: "#8b5cf6", icon: "bus",   label: "Otobüs" },
  RAIL:           { color: "#ec4899", icon: "train", label: "Banliyö" },
  SUBWAY:         { color: "#22a6f0", icon: "train", label: "Metro" },
  TRAM:           { color: "#f59e0b", icon: "tram",  label: "Tramvay" },
  BICYCLE:        { color: "#22c55e", icon: "bike",  label: "Bisiklet" },
  // BİSİM kendi bisikletinden ayrı bir ton: kart şeridinde hangisinin
  // kiralık olduğu renkten okunsun.
  BICYCLE_RENTAL: { color: "#10b981", icon: "bike",  label: "BİSİM" },
  CAR:            { color: "#fb7a3c", icon: "car",   label: "Araba" },
};

export const NON_TRANSIT_MODES = ["WALK", "BICYCLE", "BICYCLE_RENTAL", "CAR"];

export const CARBON_G_PER_KM = {
  CAR: 150, BUS: 80, RAIL: 41, SUBWAY: 41, TRAM: 30,
  WALK: 0, BICYCLE: 0, BICYCLE_RENTAL: 0,
};
export const SCORING = {
  
  transit:       { durationMin: 1, walkKm: 7,  transferPts: 10, overTargetKm: 45, uzunBacakPts: 15 },

  bicycle:       { durationMin: 1, walkKm: 2,  transferPts:  3, overTargetKm: 15, bikeKm: 1, uzunBacakPts: 15 },

  bicycle_rent:  { durationMin: 1, walkKm: 5,  transferPts:  5, overTargetKm: 25, bikeKm: 1, uzunBacakPts: 15 },
  // Bisiklet park + transit: park sonrası yürüyüş kritik, aktarma da ağır.
  bicycle_park:  { durationMin: 1, walkKm: 8,  transferPts:  8, overTargetKm: 40, bikeKm: 1, uzunBacakPts: 15 },
  // Araba: sadece süre, yürüyüş yok
  car:           { durationMin: 1, walkKm: 0,  transferPts:  0, overTargetKm:  0, uzunBacakPts: 0 },
  // Park & Ride: yürüyüş orta ağırlık, aktarma önemli
  park_and_ride: { durationMin: 1, walkKm: 6,  transferPts:  8, overTargetKm: 35, uzunBacakPts: 15 },
};

export const BISIKLET_ASGARI_PAY = 0.15;
export const BISIM_ASGARI_PAY = BISIKLET_ASGARI_PAY;
export const BISIKLET_AZAMI_KAYIP_SN = 15 * 60;
export const PR_TRANSIT_ASGARI_ORAN = 0.3;

export const MOD_AMACI = {
  bicycle_rent: {
    aciklama: "BİSİM seçildi — sürüş yolculuğun anlamlı bir payı olmalı",
    gorur: (o) =>
      o.bikeMeters >= (BIKE_LEG_MIN.bicycle_rent ?? 0) &&
      o.bikeSaniye >= o.duration * BISIKLET_ASGARI_PAY,
  },
  bicycle_park: {
    aciklama: "Bisikletim + aktarma seçildi — bisiklet yolculuğu aşırı uzatmamalı",
    gorur: (o) =>
      o.bikeMeters >= (BIKE_LEG_MIN.bicycle_park ?? 0) &&
      (o.bisikletsizEnIyiSn == null ||
        o.duration <= o.bisikletsizEnIyiSn + BISIKLET_AZAMI_KAYIP_SN),
  },
  bicycle: {
    aciklama: "Sadece bisiklet seçildi — bisikletsiz güzergâh bu modda anlamsız",
    gorur: (o) => o.bikeMeters > 0,
  },
  // Ölçüt "araba ne kadar uzun" değil, yolculuğu kim taşıyor. Eşik 0.3:
  // transit≥2km olan 30 güzergâhın transit/araç oranında 0.17–0.38 arası boş,
  // 0.3 o boşluğun ortası. Eski `carMeters >= 2000` tabanı gerçek P+R'leri
  // eliyordu, kaldırıldı.
  park_and_ride: {
    aciklama: "Park & Ride seçildi — yolculuğu transit taşımalı, araba erişim aracı olmalı",
    gorur: (o) =>
      o.transitMeters >= 2000 &&
      o.transitMeters >= o.carMeters * PR_TRANSIT_ASGARI_ORAN,
  },
};

// ─── Öneri sınırı ──────────────────────────────────────────────────────
// "Önerilen" kart, listedeki en hızlıdan bu orandan fazla yavaş olamaz.
// Gerekçe: cezalar süreyle orantılı değil, birikince çok daha yavaş bir
// güzergâh zirveye çıkabiliyor (ölçüldü: 12.7 dk fark, 21 puanla kaybetti).
// Bu sınır katsayıları düzeltmez, hasarı sınırlar.
export const ONERI_TOLERANSI = {
  transit:       1.20,
  // Araba yolculuğunun amacı hız; sapmaya en az tolerans burada.
  park_and_ride: 1.15,
  bicycle_park:  1.20,
  // Bisiklet modlarında "biraz daha uzun ama daha çok bisiklet" makul bir
  // tercih olabilir; tolerans biraz geniş.
  bicycle:       1.25,
  bicycle_rent:  1.25,
  car:           1.10,
};

export const YURUYUS_BACAK_TAVANI_SN = 20 * 60;

export const MUTLAK_YURUYUS_TAVANI = 5000;

export const BIKE_LEG_MIN = {
  bicycle_rent: 500,   
  bicycle_park: 800,   
};

// Tek bir yürüyüş bacağı için kabul edilen maksimum mesafe (metre)
export const WALK_LEG_TARGET = {
  transit:       2000,
  bicycle:        600, 
  bicycle_rent:  1200,
  bicycle_park:  1500,
  car:           Infinity,
  park_and_ride: 1500,
};

export function resolveProfileKey(profile, bikeType) {
  if (profile === "bicycle") {
    if (bikeType === "RENT") return "bicycle_rent";
    return "bicycle_park";
  }
  return profile ?? "transit";
}

export function calcLegDistanceMeters(leg) {
  if (typeof leg.distance === "number" && leg.distance > 0) return leg.distance;
  const pts = leg.legGeometry?.points ? decodePolyline(leg.legGeometry.points) : [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += haversineMeters(pts[i - 1], pts[i]);
  return total;
}

export function calcCarbonGrams(legs) {
  return legs.reduce((sum, leg) => {
    const gPerKm = CARBON_G_PER_KM[leg.mode] ?? 0;
    return sum + gPerKm * (calcLegDistanceMeters(leg) / 1000);
  }, 0);
}

function puanla(itineraries, profileKey) {
  const w = SCORING[profileKey] || SCORING.transit;
  const maxWalk = WALK_LEG_TARGET[profileKey] ?? 2000;
  const minBike = BIKE_LEG_MIN[profileKey] ?? 0;

  return itineraries
    .map((itin) => {
      const walkLegs = itin.legs.filter((l) => l.mode === "WALK");
      const walkDistances = walkLegs.map(calcLegDistanceMeters);
      const maxWalkSec = walkLegs.length
        ? Math.max(...walkLegs.map((l) => l.duration || 0)) : 0;
      const transitLegs = itin.legs.filter((l) => !NON_TRANSIT_MODES.includes(l.mode));
      const total = walkDistances.reduce((s, d) => s + d, 0);
      const maxLeg = walkDistances.length ? Math.max(...walkDistances) : 0;
      const overTarget = Math.max(0, maxLeg - maxWalk);
      const duration = itin.duration || itin.legs.reduce((s, l) => s + (l.duration || 0), 0);
      const transfers = Math.max(0, transitLegs.length - 1);
      // Bisikletle katedilen mesafe — yalnız ödül tanımlı profillerde hesaplanır.
      const bisikletBacaklari = itin.legs
        .filter((l) => l.mode === "BICYCLE" || l.mode === "BICYCLE_RENTAL");
      const bikeMeters = bisikletBacaklari.reduce((s, l) => s + calcLegDistanceMeters(l), 0);
      // Süre de gerekiyor: BİSİM'in "zahmete değer mi" ölçütü orandır ve
      // oran mesafeyle değil süreyle kurulur (bkz. BISIM_ASGARI_PAY).
      const bikeSaniye = bisikletBacaklari.reduce((s, l) => s + (l.duration || 0), 0);
      const carMeters = itin.legs
        .filter((l) => l.mode === "CAR")
        .reduce((s, l) => s + calcLegDistanceMeters(l), 0);
      const transitMeters = transitLegs.reduce((s, l) => s + calcLegDistanceMeters(l), 0);

      // Bisiklet burada bir erişim aracı ve o işi görmeyecek kadar kısa.
      const bisikletAnlamsiz =
        minBike > 0 && transitLegs.length > 0 && bikeMeters > 0 && bikeMeters < minBike;

      const amac = MOD_AMACI[profileKey];
      const bisikletsizEnIyiSn = itin.bisikletsizEnIyiSn ?? null;
      const duzTransitEnIyiSn = itin.duzTransitEnIyiSn ?? bisikletsizEnIyiSn;
      const amacaUygun = amac
        ? amac.gorur({ bikeMeters, bikeSaniye, carMeters, transitMeters, duration, bisikletsizEnIyiSn })
        : true;
      const yuruyusSacma = maxWalkSec > YURUYUS_BACAK_TAVANI_SN;
      const tavanOrani = maxWalkSec / YURUYUS_BACAK_TAVANI_SN;
      const score =
        (duration / 60) * w.durationMin +
        (total / 1000) * w.walkKm +
        transfers * w.transferPts +
        (overTarget / 1000) * w.overTargetKm +
        tavanOrani * tavanOrani * (w.uzunBacakPts ?? 0) +
        (bikeMeters / 1000) * (w.bikeKm ?? 0);
      return {
        itin,
        walk: {
          total, maxLeg, maxWalkSec, overTarget, transfers, duration,
          bikeMeters, bikeSaniye, carMeters, transitMeters,
          bisikletAnlamsiz, amacaUygun, yuruyusSacma, duzTransitEnIyiSn,
        },
        score,
      };
    })
    .sort((a, b) => a.score - b.score);
}

export function rankItineraries(itineraries, profileKey) {
  const scored = puanla(itineraries, profileKey);

  const amaciGoren = scored.filter((r) => r.walk.amacaUygun && !r.walk.bisikletAnlamsiz);

  // KATMAN 1 — tavana da uyanlar. Varsa yalnız bunlar gösterilir; bu,
  // değişiklikten önceki davranışın birebir aynısıdır.
  const tavanaUyan = amaciGoren.filter((r) => !r.walk.yuruyusSacma);
  if (tavanaUyan.length > 0) {
    return oneriSinirinaUydur(ayniHattiTekilleştir(tavanaUyan), profileKey);
  }

  if (amaciGoren.length > 0) {
    return ayniHattiTekilleştir(amaciGoren).map((r) => ({ ...r, yuruyusZorunlu: true }));
  }

  // Mod amacı hiçbir adayı geçirmedi. Son çare kartı YOK — arayüz sebebini
  // yazar ve diğer modlar bir dokunuş uzakta (bkz. modBosSebebi).
  return [];
}

export function modBosSebebi(itineraries, profileKey) {
  const bos = { kod: "bilinmiyor", mesaj: null, alternatifSn: null };
  if (!itineraries?.length) return bos;

  const scored = puanla(itineraries, profileKey);
  const alternatifSn = scored[0].walk.duzTransitEnIyiSn ?? null;
  const dk = (sn) => (sn / 60).toFixed(1).replace(".0", "");
  const km = (m) => (m / 1000).toFixed(1);

  if (profileKey === "park_and_ride") {
    const ilk = itineraries[0].legs[0]?.from;
    const son = itineraries[0].legs[itineraries[0].legs.length - 1]?.to;
    const kusUcusu =
      ilk?.lat != null && son?.lat != null
        ? haversineMeters(
            { latitude: ilk.lat, longitude: ilk.lon },
            { latitude: son.lat, longitude: son.lon }
          )
        : null;
    if (kusUcusu != null && Number.isFinite(kusUcusu) && kusUcusu < 2000) {
      return {
        kod: "kisa-mesafe",
        mesaj: `Bu mesafe için Park & Ride anlamlı değil — yolculuk zaten ${km(kusUcusu)} km.`,
        alternatifSn,
      };
    }

    const enIyi = scored.reduce((a, b) =>
      b.walk.transitMeters > a.walk.transitMeters ? b : a);
    return {
      kod: "arac-domine",
      mesaj: `Araç ${km(enIyi.walk.carMeters)} km, toplu taşıma ${km(enIyi.walk.transitMeters)} km — ` +
             "bu bir araba yolculuğu, park + aktarma değil.",
      alternatifSn,
    };
  }

  if (profileKey === "bicycle_park") {
    const esik = BIKE_LEG_MIN.bicycle_park ?? 0;
    const enUzunBisiklet = Math.max(...scored.map((r) => r.walk.bikeMeters));
    if (enUzunBisiklet < esik) {
      return {
        kod: "bisiklet-kisa",
        mesaj: `En uzun bisiklet bacağı ${Math.round(enUzunBisiklet)} m (eşik ${esik} m) — ` +
               "bu kadar kısa bir sürüş için bisikleti çıkarmaya değmez.",
        alternatifSn,
      };
    }

    const taban = scored[0].walk.duzTransitEnIyiSn;
    if (taban != null) {
      const kazanc = taban - Math.min(...scored.map((r) => r.walk.duration));
      if (kazanc < -BISIKLET_AZAMI_KAYIP_SN) {
        return { kod: "bisiklet-yavas",
                 mesaj: `Bisiklet bu yolculuğu ${dk(-kazanc)} dk uzatıyor ` +
                        `(kabul sınırı ${dk(BISIKLET_AZAMI_KAYIP_SN)} dk).`, alternatifSn };
      }
      return { ...bos, kod: "bisiklet-katkisiz", alternatifSn };
    }
    return { ...bos, kod: "bisiklet-katkisiz", alternatifSn };
  }

  if (profileKey === "bicycle_rent") {
    const esik = BIKE_LEG_MIN.bicycle_rent ?? 0;
    const enUzun = Math.max(...scored.map((r) => r.walk.bikeMeters));
    if (enUzun < esik) {
      return {
        kod: "bisim-kisa",
        mesaj: `En uzun BİSİM bacağı ${Math.round(enUzun)} m (eşik ${esik} m) — ` +
               "bu kadar kısa bir sürüş için bisiklet almaya değmez.",
        alternatifSn,
      };
    }
    const enIyiPay = Math.max(...scored.map((r) =>
      r.walk.duration ? r.walk.bikeSaniye / r.walk.duration : 0));
    return {
      kod: "bisim-payi-dusuk",
      mesaj: `BİSİM sürüşü yolculuğun yalnız %${Math.round(enIyiPay * 100)}'i ` +
             `(eşik %${Math.round(BISIKLET_ASGARI_PAY * 100)}) — o kadar yoldan sonra ` +
             "bisiklet aramaya değmiyor.",
      alternatifSn,
    };
  }

  return { ...bos, alternatifSn };
}

function hatImzasi(itin) {
  const transitBacaklar = itin.legs.filter((l) => l.route);
  if (transitBacaklar.length === 0) return null;   // tekilleştirmeye konu değil
  return transitBacaklar
    .map((l) => {
      const hat = l.route.shortName || l.route.longName || "";
      const durak = l.from?.stop?.gtfsId || l.from?.name || "";
      return `${l.mode}:${hat}@${durak}`;
    })
    .join(">");
}

export function ayniHattiTekilleştir(ranked) {
  const gorulen = new Set();
  return ranked.filter((r) => {
    const k = hatImzasi(r.itin);
    if (k === null) return true;                   
    if (gorulen.has(k)) return false;
    gorulen.add(k);
    return true;
  });
}

export function oneriSinirinaUydur(ranked, profileKey) {
  const tol = ONERI_TOLERANSI[profileKey];
  if (!tol || ranked.length < 2) return ranked;

  const sureler = ranked.map((r) => r.walk.duration);
  const enHizli = Math.min(...sureler);
  if (sureler[0] <= enHizli * tol) return ranked;

  const uygunIndeks = ranked.findIndex((r) => r.walk.duration <= enHizli * tol);
  if (uygunIndeks <= 0) return ranked;
  const yeni = ranked.slice();
  const [secilen] = yeni.splice(uygunIndeks, 1);
  yeni.unshift(secilen);
  return yeni;
}

export const ADAY_OLCULERI = [
  { tag: "Önerilen",   tagColor: "#60a5fa", olcu: null },   // sıralamanın birincisi
  { tag: "En Hızlı",   tagColor: "#f59e0b", olcu: (c) => c.walk.duration },
  { tag: "Az Aktarma", tagColor: "#a78bfa", olcu: (c) => c.walk.transfers },
  { tag: "Az Yürüyüş", tagColor: "#34d399", olcu: (c) => c.walk.total },
];


export const CANDIDATE_DEFS = Object.fromEntries(
  ["transit", "bicycle", "bicycle_rent", "bicycle_park", "car", "park_and_ride"]
    .map((k) => [k, ADAY_OLCULERI])
);

export const MAX_ROUTES = {
  transit:       5,
  bicycle:       3,
  bicycle_rent:  4,
  bicycle_park:  4,
  car:           2,
  park_and_ride: 4,
};

// Ekstra rotalar için kısa etiket: transit hattı adları yoksa doğrudan mod
export function routeScenarioLabel(itin) {
  const names = itin.legs
    .filter((l) => !NON_TRANSIT_MODES.includes(l.mode) && l.route?.shortName)
    .map((l) => l.route.shortName);
  if (names.length > 0) {
    const unique = [...new Set(names)].slice(0, 2);
    const text = unique.join("+");
    return text.length > 9 ? text.slice(0, 8) + "…" : text;
  }
  const directLeg = itin.legs.find((l) => ["BICYCLE", "BICYCLE_RENTAL", "CAR"].includes(l.mode));
  return directLeg ? (MODE_STYLE[directLeg.mode]?.label ?? directLeg.mode) : "Rota";
}

// Dedup key: süre + yürüyüş + kullanılan transit hatlar — farklı hatlar ayrı kart olur
export function candidateKey(itin, walk) {
  const lines = itin.legs
    .filter((l) => !NON_TRANSIT_MODES.includes(l.mode))
    .map((l) => l.route?.shortName || "")
    .join(",");
  return `${Math.round(walk.duration)}_${Math.round(walk.total)}_${lines}`;
}

export function selectCandidates(ranked, profileKey) {

  // Buradan bir `carbon` alanı iliştiriliyordu; tek tüketicisi "Çevreci"
  // etiketiydi ve o kaldırıldı (bkz. ADAY_OLCULERI). Hesap her aramada, her
  // aday için koşup kimsenin okumadığı bir sayı üretiyordu.
  // `calcCarbonGrams` TANIM olarak duruyor — kaynaklı katsayı gelirse etiket
  // ve bu satır birlikte geri gelir.
  const maxRoutes = MAX_ROUTES[profileKey] ?? 5;

  const defs = ADAY_OLCULERI.filter(({ olcu }) => {
    if (!olcu) return true;                      
    const degerler = ranked.map(olcu);
    return Math.min(...degerler) !== Math.max(...degerler);
  });

  const result = [];
  const seen = new Map();          // candidateKey → kart

  for (const { tag, tagColor, olcu } of defs) {
    const candidate = olcu
      ? [...ranked].sort((a, b) => olcu(a) - olcu(b))[0]
      : ranked[0];
    if (!candidate) continue;
    const key = candidateKey(candidate.itin, candidate.walk);
    const mevcut = seen.get(key);
    if (mevcut) {
      if (!mevcut.etiketler.includes(tag)) mevcut.etiketler.push(tag);
      continue;
    }
    const kart = { ...candidate, tag, tagColor, etiketler: [tag] };
    seen.set(key, kart);
    result.push(kart);
  }

  // 2. Kalan slotları sıralı rotalarla doldur (gri etiket + hat adı)
  for (const candidate of ranked) {
    if (result.length >= maxRoutes) break;
    const key = candidateKey(candidate.itin, candidate.walk);
    if (seen.has(key)) continue;
    const etiket = routeScenarioLabel(candidate.itin);
    const kart = { ...candidate, tag: etiket, tagColor: "#64748b", etiketler: [etiket] };
    seen.set(key, kart);
    result.push(kart);
  }

  return result;
}

export const BILET_TARIFESI = [
  { id: "tam",        ad: "Tam",                 base: 35,   perBoarding: false, aciklama: "İzmirim Kart · 90 dk aktarma dahil" },
  { id: "genc",       ad: "Genç Kart (Öğrenci)", base: 17.5, perBoarding: false, aciklama: "7-25 yaş · 90 dk aktarma dahil" },
  { id: "ogretmen",   ad: "Öğretmen Kartı",      base: 23.5, perBoarding: false, aciklama: "İzmirim Kart · 90 dk aktarma dahil" },
  { id: "yas60",      ad: "60 Yaş Kartı",        base: 29,   perBoarding: false, aciklama: "İzmirim Kart · 90 dk aktarma dahil" },
  { id: "kredikarti", ad: "Kredi / Banka Kartı", base: 39,   perBoarding: true,  aciklama: "Her binişte ayrı ücret · aktarma hakkı yok" },
];

export const VARSAYILAN_BILET = "tam";

export function biletTarifesi(id) {
  return BILET_TARIFESI.find((b) => b.id === id) || BILET_TARIFESI[0];
}

export const BISIM_TARIFESI = {
  acilisDakika: 5,
  acilisUcreti: 10,
  dakikaUcreti: 1.5,
  provizyon: 47.5,
};

export function calcBisimFare(saniye) {
  if (!saniye || saniye <= 0) return 0;
  const dk = Math.ceil(saniye / 60);
  const { acilisDakika, acilisUcreti, dakikaUcreti } = BISIM_TARIFESI;
  if (dk <= acilisDakika) return acilisUcreti;
  return acilisUcreti + (dk - acilisDakika) * dakikaUcreti;
}

export function kurusYuvarla(tutar) {
  return Math.round(tutar * 100) / 100;
}

export function ucretYazi(tutar) {
  const v = kurusYuvarla(tutar);
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(".", ",");
}

// İzmirim Kart'ın aktarma hakkı ilk binişten 90 dk sonra düşer; sonraki biniş
// yeni bir bilettir. Bu sınır olmadan 3 saatlik bir yolculuk da tek bilet
// görünüyordu.
export const AKTARMA_PENCERESI_SN = 90 * 60;

// Binişlerin ilk binişe göre saniyesi. OTP sorgusu bacak saatlerini
// döndürmüyor, o yüzden bacak süreleri toplanır: duraktaki bekleme sayılmaz,
// hesap kullanıcı lehine (daha ucuz) yanılır.
export function binisSaniyeleri(legs) {
  const transit = legs.filter((l) => !NON_TRANSIT_MODES.includes(l.mode));
  if (transit.length > 0 && transit.every((l) => l.startTime != null)) {
    return transit.map((l) => (l.startTime - transit[0].startTime) / 1000);
  }
  const zamanlar = [];
  let gecen = 0;
  for (const leg of legs) {
    if (!NON_TRANSIT_MODES.includes(leg.mode)) zamanlar.push(gecen);
    gecen += leg.duration || 0;
  }
  return zamanlar;
}

// Pencere dolunca yeni bilet başlar ve pencere o binişten yeniden işler.
export function biletAdedi(binisler) {
  if (!binisler?.length) return 1;
  let adet = 1;
  let pencereBasi = binisler[0];
  for (const t of binisler.slice(1)) {
    if (t - pencereBasi > AKTARMA_PENCERESI_SN) {
      adet += 1;
      pencereBasi = t;
    }
  }
  return adet;
}

// binisler verilmezse tek bilet varsayılır — eski çağrılar (web) bozulmasın.
export function calcJourneyFare(transitLegCount, fareBase, farePerBoarding, binisler = null) {
  if (transitLegCount === 0) return 0;
  if (farePerBoarding) return transitLegCount * fareBase;
  return kurusYuvarla(biletAdedi(binisler) * fareBase);
}

export function buildRouteResult(candidate, fareBase, farePerBoarding, profileKey) {
  const { itin, walk, tag, tagColor, etiketler, yuruyusZorunlu } = candidate;
  const PARKING_MODES = ["CAR", "BICYCLE", "BICYCLE_RENTAL"];
  const parkingLegIdx = itin.legs.findIndex(
    (l, i) =>
      PARKING_MODES.includes(l.mode) &&
      l.to?.lat != null &&
      l.to?.lon != null &&
      i < itin.legs.length - 1 &&
      !itin.legs.slice(i + 1).some((sonraki) => PARKING_MODES.includes(sonraki.mode))
  );
  const parkingPoint =
    parkingLegIdx !== -1
      ? {
          lat: itin.legs[parkingLegIdx].to.lat,
          lon: itin.legs[parkingLegIdx].to.lon,
          name: itin.legs[parkingLegIdx].to.name || "Otopark",
        }
      : null;

  const legs = itin.legs.map((leg) => {
    const style = MODE_STYLE[leg.mode] || MODE_STYLE.WALK;
    return {
      mode: leg.mode,
      from: leg.from?.name || "Başlangıç",
      to: leg.to?.name || "Varış",
      duration: leg.duration || 0,
      color: style.color,
      icon: style.icon,
      label: style.label,
      routeName: leg.route?.shortName || null,
      distanceMeters: calcLegDistanceMeters(leg),
      coords: leg.legGeometry?.points ? decodePolyline(leg.legGeometry.points) : [],
    };
  });

  const totalDuration = legs.reduce((s, l) => s + l.duration, 0);
  const totalDistance = legs.reduce((s, l) => s + l.distanceMeters, 0);
  const walkDistance = legs
    .filter((l) => l.mode === "WALK")
    .reduce((s, l) => s + l.distanceMeters, 0);

  const transitLegs = legs.filter((l) => !NON_TRANSIT_MODES.includes(l.mode));

  const bisimSaniye = legs
    .filter((l) => l.mode === "BICYCLE_RENTAL")
    .reduce((s, l) => s + l.duration, 0);
  const bisimUcreti  = calcBisimFare(bisimSaniye);
  const binisler     = binisSaniyeleri(itin.legs);
  const biletUcreti  = calcJourneyFare(transitLegs.length, fareBase, farePerBoarding, binisler);
  // Kredi kartında aktarma hakkı yok: her biniş ayrı bilet.
  const biletSayisi  = transitLegs.length === 0
    ? 0
    : farePerBoarding ? transitLegs.length : biletAdedi(binisler);
  const biletSebebi  = biletSayisi > 1 ? (farePerBoarding ? "binis-basi" : "sure-asimi") : null;

  const maxWalk = WALK_LEG_TARGET[profileKey] ?? 2000;
  const walkWarning = yuruyusZorunlu
    ? `Bu yolculukta tek seferde en az ${Math.round(walk.maxWalkSec / 60)} dk yürümek ` +
      "gerekiyor — daha az yürüten güzergâh yok."
    : walk.maxLeg > maxWalk
      ? `Bu rotada tek seferde ${(walk.maxLeg / 1000).toFixed(1)} km yürüyüş var.`
      : null;

  return {
    kimlik: candidateKey(itin, walk),
    legs,
    totalDuration,
    transfers: Math.max(0, transitLegs.length - 1),
    totalDistance: (totalDistance / 1000).toFixed(1),
    walkDistance: (walkDistance / 1000).toFixed(1),
    walkMeters: Math.round(walkDistance),
    walkWarning,
    yuruyusZorunlu: !!yuruyusZorunlu,
    cost: kurusYuvarla(biletUcreti + bisimUcreti),
    ucretDetay: {
      bilet: kurusYuvarla(biletUcreti),
      biletAdedi: biletSayisi,
      biletBirim: kurusYuvarla(fareBase),
      biletSebebi,
      bisim: kurusYuvarla(bisimUcreti),
      bisimDakika: bisimSaniye > 0 ? Math.ceil(bisimSaniye / 60) : 0,
      provizyon: bisimSaniye > 0 ? BISIM_TARIFESI.provizyon : 0,
    },
    tag,
    tagColor,
    etiketler: etiketler || [tag],
    parkingPoint,
  };
}

// Rota listesi sıralama tercihleri — web arayüzündeki pref-btn'lerin karşılığı.
// Ölçüler buildRouteResult çıktısı üzerinden okunur.
export const SIRALAMA_TERCIHLERI = [
  { id: "recommended",    label: "Önerilen",   icon: "star",     olcu: null },
  { id: "fastest",        label: "En Hızlı",   icon: "fast",     olcu: (r) => r.totalDuration },
  { id: "leastTransfers", label: "Az Aktarma", icon: "transfer", olcu: (r) => r.transfers },
  { id: "leastWalking",   label: "Az Yürüyüş", icon: "walk",     olcu: (r) => r.walkMeters },
];

// Kartların yerini değiştirir ama seçimi bozmaz: harita orijinal indekse bakıyor.
export function siralamayaGore(routes, tercihId) {
  const olcu = SIRALAMA_TERCIHLERI.find((t) => t.id === tercihId)?.olcu;
  const liste = routes.map((r, i) => ({ rota: r, idx: i }));
  return olcu ? liste.sort((a, b) => olcu(a.rota) - olcu(b.rota)) : liste;
}
