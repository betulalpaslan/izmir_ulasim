// OTP'den gelen ham güzergâhları puanlar, sıralar, etiketler ve arayüzün
// beklediği rota nesnesine dönüştürür.
// Tamamen saf fonksiyonlardır — React veya ağ bağımlılığı yoktur.

import { decodePolyline } from "./polyline";
import { haversineMeters } from "./geo";

export const MODE_STYLE = {
  WALK:           { color: "#7a8299", icon: "walk",  label: "Yürüyüş" },
  BUS:            { color: "#f97316", icon: "bus",   label: "Otobüs" },
  // RAIL = İZBAN banliyö hattı, SUBWAY = İzmir Metrosu. Aynı ikonu paylaşırlar,
  // bu yüzden renkleri ayrı tutulur; aksi hâlde kart şeridinde ayırt edilemezler.
  RAIL:           { color: "#4f46e5", icon: "train", label: "Banliyö" },
  SUBWAY:         { color: "#60a5fa", icon: "train", label: "Metro" },
  TRAM:           { color: "#a78bfa", icon: "tram",  label: "Tramvay" },
  FERRY:          { color: "#38bdf8", icon: "ship",  label: "Vapur" },
  BICYCLE:        { color: "#4ade80", icon: "bike",  label: "Bisiklet" },
  BICYCLE_RENTAL: { color: "#4ade80", icon: "bike",  label: "BİSİM" },
  CAR:            { color: "#f97316", icon: "car",   label: "Araba" },
};

export const NON_TRANSIT_MODES = ["WALK", "BICYCLE", "BICYCLE_RENTAL", "CAR"];

export const CARBON_G_PER_KM = {
  CAR: 150, BUS: 80, RAIL: 41, SUBWAY: 41, TRAM: 30, FERRY: 60,
  WALK: 0, BICYCLE: 0, BICYCLE_RENTAL: 0,
};

// Skor katsayıları — her mod kendi önceliğini yansıtır
export const SCORING = {
  // Toplu taşıma: aktarma çok maliyetli (bekleme + yürüyüş), yürüyüş da ağır
  transit:       { durationMin: 1, walkKm: 7,  transferPts: 10, overTargetKm: 45 },
  // Kendi bisiklet: süre birincil, kısa yürüyüşler (bisiklet iterken) tolere edilir
  bicycle:       { durationMin: 1, walkKm: 2,  transferPts:  3, overTargetKm: 15 },
  // BİSİM kiralama: istasyona yürüyüş önemli, transit aktarması da sayılır
  bicycle_rent:  { durationMin: 1, walkKm: 5,  transferPts:  5, overTargetKm: 25 },
  // Bisiklet park + transit: park sonrası yürüyüş kritik, aktarma da ağır
  bicycle_park:  { durationMin: 1, walkKm: 8,  transferPts:  8, overTargetKm: 40 },
  // Araba: sadece süre, yürüyüş yok
  car:           { durationMin: 1, walkKm: 0,  transferPts:  0, overTargetKm:  0 },
  // Park & Ride: yürüyüş orta ağırlık, aktarma önemli
  park_and_ride: { durationMin: 1, walkKm: 6,  transferPts:  8, overTargetKm: 35 },
};

// Tek bir yürüyüş bacağı için kabul edilen maksimum mesafe (metre)
export const WALK_LEG_TARGET = {
  transit:       2000,
  bicycle:        600, // bisiklet varken uzun yürüyüş anlamsız
  bicycle_rent:  1000,
  bicycle_park:  1500,
  car:           Infinity,
  park_and_ride: 1500,
};

export function resolveProfileKey(profile, bikeType) {
  if (profile === "bicycle") {
    if (bikeType === "RENT") return "bicycle_rent";
    if (bikeType === "PARK") return "bicycle_park";
    return "bicycle";
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

export function rankItineraries(itineraries, profileKey) {
  const w = SCORING[profileKey] || SCORING.transit;
  const maxWalk = WALK_LEG_TARGET[profileKey] ?? 2000;

  const scored = itineraries
    .map((itin) => {
      const walkDistances = itin.legs
        .filter((l) => l.mode === "WALK")
        .map(calcLegDistanceMeters);
      const transitLegs = itin.legs.filter((l) => !NON_TRANSIT_MODES.includes(l.mode));
      const total = walkDistances.reduce((s, d) => s + d, 0);
      const maxLeg = walkDistances.length ? Math.max(...walkDistances) : 0;
      const overTarget = Math.max(0, maxLeg - maxWalk);
      const duration = itin.duration || itin.legs.reduce((s, l) => s + (l.duration || 0), 0);
      const transfers = Math.max(0, transitLegs.length - 1);
      const score =
        (duration / 60) * w.durationMin +
        (total / 1000) * w.walkKm +
        transfers * w.transferPts +
        (overTarget / 1000) * w.overTargetKm;
      return { itin, walk: { total, maxLeg, overTarget, transfers, duration }, score };
    })
    .sort((a, b) => a.score - b.score);

  const filtered = scored.filter((r) => r.walk.maxLeg <= maxWalk);
  return filtered.length > 0 ? filtered : scored.slice(0, 1);
}

// Her mod için gösterilecek aday etiketleri ve seçim mantığı
export const CANDIDATE_DEFS = {
  transit: [
    { tag: "Önerilen",   tagColor: "#60a5fa", pick: (rs) => rs[0] },
    { tag: "Az Aktarma", tagColor: "#a78bfa", pick: (rs) => [...rs].sort((a, b) => a.walk.transfers - b.walk.transfers)[0] },
    { tag: "Çevreci",    tagColor: "#34d399", pick: (rs) => [...rs].sort((a, b) => a.carbon - b.carbon)[0] },
    { tag: "En Hızlı",   tagColor: "#f59e0b", pick: (rs) => [...rs].sort((a, b) => a.walk.duration - b.walk.duration)[0] },
  ],
  // Kendi bisiklet: doğrudan rota, aktarma yok; süre ve öneri yeterli
  bicycle: [
    { tag: "Önerilen",   tagColor: "#60a5fa", pick: (rs) => rs[0] },
    { tag: "En Hızlı",   tagColor: "#f59e0b", pick: (rs) => [...rs].sort((a, b) => a.walk.duration - b.walk.duration)[0] },
  ],
  // BİSİM kiralama: tüm rotalar zaten BICYCLE_RENTAL içeriyor (fetchRoute'ta filtreli)
  bicycle_rent: [
    { tag: "Önerilen",   tagColor: "#4ade80", pick: (rs) => rs[0] },
    { tag: "En Hızlı",   tagColor: "#f59e0b", pick: (rs) => [...rs].sort((a, b) => a.walk.duration - b.walk.duration)[0] },
  ],
  // Bisiklet park + transit: aktarma sayısı kritik (park sonrası transit bağlantısı)
  bicycle_park: [
    { tag: "Önerilen",   tagColor: "#60a5fa", pick: (rs) => rs[0] },
    { tag: "Az Aktarma", tagColor: "#a78bfa", pick: (rs) => [...rs].sort((a, b) => a.walk.transfers - b.walk.transfers)[0] },
    { tag: "En Hızlı",   tagColor: "#f59e0b", pick: (rs) => [...rs].sort((a, b) => a.walk.duration - b.walk.duration)[0] },
  ],
  // Araba: genellikle 1-2 rota gelir, sadece öneri + hız
  car: [
    { tag: "Önerilen",   tagColor: "#60a5fa", pick: (rs) => rs[0] },
    { tag: "En Hızlı",   tagColor: "#f59e0b", pick: (rs) => [...rs].sort((a, b) => a.walk.duration - b.walk.duration)[0] },
  ],
  // Park & Ride: aktarma + çevreci seçenek anlamlı (araba yerine transit)
  park_and_ride: [
    { tag: "Önerilen",   tagColor: "#60a5fa", pick: (rs) => rs[0] },
    { tag: "Az Aktarma", tagColor: "#a78bfa", pick: (rs) => [...rs].sort((a, b) => a.walk.transfers - b.walk.transfers)[0] },
    { tag: "En Hızlı",   tagColor: "#f59e0b", pick: (rs) => [...rs].sort((a, b) => a.walk.duration - b.walk.duration)[0] },
    { tag: "Çevreci",    tagColor: "#34d399", pick: (rs) => [...rs].sort((a, b) => a.carbon - b.carbon)[0] },
  ],
};

// Kaç benzersiz rota kartı gösterileceği — etiketli adaylar + ekstra seçenekler
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
  const withCarbon = ranked.map((r) => ({ ...r, carbon: calcCarbonGrams(r.itin.legs) }));
  const defs = CANDIDATE_DEFS[profileKey] || CANDIDATE_DEFS.transit;
  const maxRoutes = MAX_ROUTES[profileKey] ?? 5;

  const result = [];
  const seen = new Set();

  // 1. Etiketli adaylar (Önerilen, Az Aktarma, vb.)
  for (const { tag, tagColor, pick } of defs) {
    const candidate = pick(withCarbon);
    if (!candidate) continue;
    const key = candidateKey(candidate.itin, candidate.walk);
    if (!seen.has(key)) {
      seen.add(key);
      result.push({ ...candidate, tag, tagColor });
    }
  }

  // 2. Kalan slotları sıralı rotalarla doldur (gri etiket + hat adı)
  for (const candidate of withCarbon) {
    if (result.length >= maxRoutes) break;
    const key = candidateKey(candidate.itin, candidate.walk);
    if (!seen.has(key)) {
      seen.add(key);
      result.push({ ...candidate, tag: routeScenarioLabel(candidate.itin), tagColor: "#64748b" });
    }
  }

  return result;
}

// Yolculuk ücreti.
// Kredi/banka kartı: 90 dk aktarma hakkı yok → her biniş ayrı ücret
// İzmirim Kart: 90 dk içinde aktarmalar dahil → yolculuk başı sabit ücret
export function calcJourneyFare(transitLegCount, fareBase, farePerBoarding) {
  if (transitLegCount === 0) return 0;
  return farePerBoarding ? transitLegCount * fareBase : fareBase;
}

export function buildRouteResult(candidate, fareBase, farePerBoarding, profileKey) {
  const { itin, walk, tag, tagColor, carbon } = candidate;

  // Park noktası: ardından transit/yürüyüş gelen vehicle leg'in varışı
  const PARKING_MODES = ["CAR", "BICYCLE", "BICYCLE_RENTAL"];
  const parkingLegIdx = itin.legs.findIndex(
    (l, i) =>
      PARKING_MODES.includes(l.mode) &&
      l.to?.lat != null &&
      l.to?.lon != null &&
      i < itin.legs.length - 1
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
      // Mesafe OTP'nin kendi değerinden gelir; yoksa çizim noktalarından hesaplanır.
      // Toplam mesafe, yürüyüş payı ve bacak listesindeki "x km" aynı kaynağı kullanır.
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
  const maxWalk = WALK_LEG_TARGET[profileKey] ?? 2000;
  const walkWarning =
    walk.maxLeg > maxWalk
      ? `Bu rotada tek seferde ${(walk.maxLeg / 1000).toFixed(1)} km yürüyüş var.`
      : null;

  return {
    legs,
    totalDuration,
    transfers: Math.max(0, transitLegs.length - 1),
    totalDistance: (totalDistance / 1000).toFixed(1),
    walkDistance: (walkDistance / 1000).toFixed(1),
    walkWarning,
    cost: Math.round(calcJourneyFare(transitLegs.length, fareBase, farePerBoarding)),
    tag,
    tagColor,
    carbonGrams: Math.round(carbon),
    parkingPoint,
  };
}
