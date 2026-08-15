// Canlı navigasyon ilerleme hesabı.
// Saf fonksiyonlardır: rota + konum girer, ilerleme çıkar. Cihaz API'si kullanmaz.

import { haversineMeters, projectOnSegment } from "./geo";

// Kullanıcının rotadan bu kadar uzaklaşması "rota dışı" sayılır (metre).
// GPS şehir içinde 20-30 m sapabildiği için eşik geniş tutuldu.
export const OFF_ROUTE_METERS = 60;

// Rota dışı uyarısı vermeden önce beklenen ardışık ölçüm sayısı —
// tek bir hatalı GPS okumasının yanlış alarm üretmesini engeller.
export const OFF_ROUTE_STREAK = 3;

// Varışa bu mesafe kalınca yolculuk tamamlanmış sayılır (metre).
export const ARRIVAL_METERS = 30;

const clamp01 = (v) => Math.max(0, Math.min(1, v));

// Rotanın tüm bacaklarını tek bir nokta dizisine indirger ve
// her nokta için kümülatif mesafeyi önceden hesaplar.
// Her konum güncellemesinde yeniden kurulmaması için useMemo ile önbelleklenmelidir.
export function buildRouteIndex(route) {
  const points = [];
  const legs = [];

  for (let legIndex = 0; legIndex < (route?.legs?.length ?? 0); legIndex++) {
    const leg = route.legs[legIndex];
    const startIdx = points.length === 0 ? 0 : points.length - 1;

    for (const coord of leg.coords ?? []) {
      const prev = points[points.length - 1];
      // Bacak sınırında tekrarlanan noktayı atla
      if (prev && prev.latitude === coord.latitude && prev.longitude === coord.longitude) continue;
      points.push({ latitude: coord.latitude, longitude: coord.longitude, legIndex });
    }

    legs.push({
      index: legIndex,
      mode: leg.mode,
      label: leg.label,
      icon: leg.icon,
      color: leg.color,
      routeName: leg.routeName,
      from: leg.from,
      to: leg.to,
      duration: leg.duration ?? 0,
      startIdx,
      endIdx: Math.max(startIdx, points.length - 1),
    });
  }

  const cumulative = [0];
  for (let i = 1; i < points.length; i++) {
    cumulative[i] = cumulative[i - 1] + haversineMeters(points[i - 1], points[i]);
  }

  const totalDistance = cumulative[cumulative.length - 1] ?? 0;

  for (const leg of legs) {
    leg.startDistance = cumulative[leg.startIdx] ?? 0;
    leg.distance = (cumulative[leg.endIdx] ?? 0) - leg.startDistance;
  }

  return { points, cumulative, legs, totalDistance };
}

// Konumu rotanın en yakın noktasına oturtur.
// fromIndex: bu segmentten geriye dönülmez — döngüsel güzergâhlarda geri sıçramayı önler.
export function snapToRoute(location, routeIndex, fromIndex = 0) {
  const { points, cumulative } = routeIndex;
  if (!location || points.length === 0) return null;
  if (points.length === 1) {
    return {
      segmentIndex: 0,
      distance: haversineMeters(location, points[0]),
      snapped: points[0],
      legIndex: points[0].legIndex,
      traveledMeters: 0,
    };
  }

  let best = null;
  for (let i = Math.max(0, Math.min(fromIndex, points.length - 2)); i < points.length - 1; i++) {
    const { point, t, distance } = projectOnSegment(location, points[i], points[i + 1]);
    if (best === null || distance < best.distance) {
      const segmentLength = cumulative[i + 1] - cumulative[i];
      best = {
        segmentIndex: i,
        distance,
        snapped: point,
        // t=1'de sıradaki bacağa geçmiş sayılması için sonraki noktanın bacağı kullanılır
        legIndex: t >= 1 ? points[i + 1].legIndex : points[i].legIndex,
        traveledMeters: cumulative[i] + segmentLength * t,
      };
    }
  }
  return best;
}

// Kalan süre: içinde bulunulan bacağın kalan kısmı + sonraki bacakların tamamı.
// Mesafeyi tek bir ortalama hızla çarpmaktan daha doğrudur, çünkü
// yürüyüş ve metro bacaklarının hızları çok farklıdır.
function remainingSeconds(legs, legIndex, traveledMeters) {
  let seconds = 0;
  for (let i = legIndex; i < legs.length; i++) {
    const leg = legs[i];
    if (i > legIndex || leg.distance <= 0) {
      seconds += leg.duration;
      continue;
    }
    const ratio = clamp01((traveledMeters - leg.startDistance) / leg.distance);
    seconds += leg.duration * (1 - ratio);
  }
  return seconds;
}

// Navigasyon ekranının ihtiyaç duyduğu her şeyi tek seferde hesaplar.
export function navigationProgress(routeIndex, location, fromIndex = 0) {
  const snap = snapToRoute(location, routeIndex, fromIndex);
  if (!snap) return null;

  const { legs, totalDistance } = routeIndex;
  const currentLeg = legs[snap.legIndex] ?? legs[legs.length - 1] ?? null;
  const nextLeg = currentLeg ? legs[currentLeg.index + 1] ?? null : null;

  const remainingMeters = Math.max(0, totalDistance - snap.traveledMeters);
  const legEndDistance = currentLeg ? currentLeg.startDistance + currentLeg.distance : totalDistance;

  return {
    segmentIndex: snap.segmentIndex,
    snapped: snap.snapped,
    distanceFromRoute: snap.distance,
    offRoute: snap.distance > OFF_ROUTE_METERS,
    traveledMeters: snap.traveledMeters,
    remainingMeters,
    remainingSeconds: remainingSeconds(legs, currentLeg?.index ?? 0, snap.traveledMeters),
    progressRatio: totalDistance > 0 ? clamp01(snap.traveledMeters / totalDistance) : 0,
    arrived: remainingMeters <= ARRIVAL_METERS,
    currentLeg,
    nextLeg,
    distanceToLegEnd: Math.max(0, legEndDistance - snap.traveledMeters),
  };
}
