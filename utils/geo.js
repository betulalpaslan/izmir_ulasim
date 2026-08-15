// Coğrafi mesafe ve izdüşüm yardımcıları.
// Tüm fonksiyonlar saftır — harita/cihaz bağımlılığı yoktur, doğrudan test edilebilir.

const EARTH_RADIUS_M = 6371000;
const DEG_TO_RAD = Math.PI / 180;

export function haversineMeters(p1, p2) {
  const dLat = (p2.latitude - p1.latitude) * DEG_TO_RAD;
  const dLon = (p2.longitude - p1.longitude) * DEG_TO_RAD;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(p1.latitude * DEG_TO_RAD) *
      Math.cos(p2.latitude * DEG_TO_RAD) *
      Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Bir koordinat dizisinin toplam uzunluğu (metre).
export function pathLengthMeters(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += haversineMeters(points[i - 1], points[i]);
  return total;
}

// Küçük ölçeklerde (birkaç km) yeterli doğrulukta düzlemsel izdüşüm için
// enlem/boylamı yerel metre düzlemine çevirir.
function toLocalMeters(point, originLat) {
  return {
    x: point.longitude * DEG_TO_RAD * EARTH_RADIUS_M * Math.cos(originLat * DEG_TO_RAD),
    y: point.latitude * DEG_TO_RAD * EARTH_RADIUS_M,
  };
}

// p noktasının a-b doğru parçası üzerindeki en yakın noktası.
// t: 0 = a, 1 = b. distance metre cinsindendir.
export function projectOnSegment(p, a, b) {
  const originLat = a.latitude;
  const pm = toLocalMeters(p, originLat);
  const am = toLocalMeters(a, originLat);
  const bm = toLocalMeters(b, originLat);

  const dx = bm.x - am.x;
  const dy = bm.y - am.y;
  const lengthSq = dx * dx + dy * dy;

  // Sıfır uzunluklu parça: a'nın kendisine düşer.
  const t = lengthSq === 0
    ? 0
    : Math.max(0, Math.min(1, ((pm.x - am.x) * dx + (pm.y - am.y) * dy) / lengthSq));

  const point = {
    latitude: a.latitude + (b.latitude - a.latitude) * t,
    longitude: a.longitude + (b.longitude - a.longitude) * t,
  };
  return { point, t, distance: haversineMeters(p, point) };
}

// İki nokta arasındaki pusula yönü (0-360, kuzeyden saat yönünde).
export function bearingDegrees(from, to) {
  const lat1 = from.latitude * DEG_TO_RAD;
  const lat2 = to.latitude * DEG_TO_RAD;
  const dLon = (to.longitude - from.longitude) * DEG_TO_RAD;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (Math.atan2(y, x) / DEG_TO_RAD + 360) % 360;
}

// Mesafeyi kullanıcıya gösterilecek biçime çevirir: 850 m / 1,2 km
export function formatDistance(meters) {
  if (!Number.isFinite(meters) || meters < 0) return "—";
  // Önce yuvarla: 999 m "1000 m" değil "1,0 km" olarak gösterilmeli
  const rounded = Math.round(meters / 10) * 10;
  if (rounded < 1000) return `${rounded} m`;
  return `${(meters / 1000).toFixed(1).replace(".", ",")} km`;
}

// Süreyi gösterilecek biçime çevirir: 45 sn / 12 dk / 1 sa 5 dk
export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  if (seconds < 60) return `${Math.round(seconds)} sn`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} dk`;
  return `${Math.floor(minutes / 60)} sa ${minutes % 60} dk`;
}
