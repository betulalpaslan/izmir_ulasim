import { act, create } from "react-test-renderer";
import { useNavigationMode } from "../hooks/useNavigationMode";
import { OFF_ROUTE_METERS, OFF_ROUTE_STREAK } from "../utils/navigation";

// Hook'un kendi mantığı — rota dışı SERİSİ ve arama penceresinin
// ilerletilmesi — sahte bir konum dizisiyle sürülebiliyor: GPS, harita ve
// izin akışı gerekmiyor.

const LON = 27.1;
const DEG_LAT_M = 111194.9;
const nokta = (lat, lon = LON) => ({ latitude: lat, longitude: lon });
const dizi = (bas, adet) =>
  Array.from({ length: adet }, (_, i) => nokta(Number((bas + i * 0.001).toFixed(6))));

// Sabit boylamda kuzeye giden düz rota — beklenen mesafeler elle doğrulanabilir.
const ROTA = {
  legs: [
    { mode: "WALK", duration: 300, label: "Yürüyüş", icon: "walk", color: "#7a8299",
      from: "Ev", to: "Durak", coords: dizi(38.400, 6) },
    { mode: "BUS", duration: 600, label: "Otobüs", icon: "bus", color: "#f97316",
      routeName: "169", from: "Durak", to: "Okul", coords: dizi(38.405, 11) },
  ],
};

// Rotadan uzaklaşmak için boylamı kaydırıyoruz: 60 m eşiğinin iyice ötesi.
const SAPMA_DERECE = (OFF_ROUTE_METERS * 4) / (DEG_LAT_M * Math.cos(38.4 * Math.PI / 180));

function surucu(props) {
  let son = null;
  let agac = null;
  function Probe({ route, location, active }) {
    son = useNavigationMode(route, location, active);
    return null;
  }
  act(() => { agac = create(<Probe {...props} />); });
  return {
    guncelle: (yeni) => { act(() => { agac.update(<Probe {...{ ...props, ...yeni }} />); }); },
    get durum() { return son; },
  };
}

test("navigasyon kapalıyken ilerleme üretilmiyor", () => {
  const s = surucu({ route: ROTA, location: nokta(38.401), active: false });
  expect(s.durum.progress).toBeNull();
  expect(s.durum.offRoute).toBe(false);
});

test("rota üzerindeki konum ilerleme veriyor", () => {
  const s = surucu({ route: ROTA, location: nokta(38.4025), active: true });
  expect(s.durum.progress).not.toBeNull();
  expect(s.durum.offRoute).toBe(false);
});

test("tek bir sapma rota dışı SAYILMIYOR", () => {
  // Eşik anlık GPS gürültüsüne değil, üst üste sapmaya bakıyor.
  const s = surucu({ route: ROTA, location: nokta(38.402), active: true });
  s.guncelle({ location: nokta(38.4021, LON + SAPMA_DERECE) });
  expect(s.durum.progress.offRoute).toBe(true);
  expect(s.durum.offRoute).toBe(false);
});

test("üst üste sapma eşiği aşınca rota dışı", () => {
  const s = surucu({ route: ROTA, location: nokta(38.402), active: true });
  for (let i = 0; i < OFF_ROUTE_STREAK; i++) {
    s.guncelle({ location: nokta(38.402 + i * 0.0001, LON + SAPMA_DERECE) });
  }
  expect(s.durum.offRoute).toBe(true);
});

test("rotaya dönünce seri sıfırlanıyor", () => {
  const s = surucu({ route: ROTA, location: nokta(38.402), active: true });
  for (let i = 0; i < OFF_ROUTE_STREAK; i++) {
    s.guncelle({ location: nokta(38.402 + i * 0.0001, LON + SAPMA_DERECE) });
  }
  expect(s.durum.offRoute).toBe(true);
  s.guncelle({ location: nokta(38.4035) });
  expect(s.durum.offRoute).toBe(false);
});

test("arama penceresi yalnız ileri gidiyor", () => {
  const s = surucu({ route: ROTA, location: nokta(38.401), active: true });
  s.guncelle({ location: nokta(38.409) });
  const ileriIdx = s.durum.progress.segmentIndex;
  expect(ileriIdx).toBeGreaterThan(0);

  // Birkaç metre geri kayan bir GPS okuması pencereyi geri almamalı;
  // aksi hâlde rota kendi üstünden geçtiğinde ilerleme geri sıçrıyordu.
  s.guncelle({ location: nokta(38.4085) });
  expect(s.durum.progress.segmentIndex).toBeGreaterThanOrEqual(ileriIdx);
});

test("navigasyon kapanınca durum sıfırlanıyor", () => {
  const s = surucu({ route: ROTA, location: nokta(38.404), active: true });
  expect(s.durum.progress).not.toBeNull();
  s.guncelle({ active: false });
  expect(s.durum.progress).toBeNull();
  expect(s.durum.offRoute).toBe(false);
});

test("rota değişince ilerleme YENİ rotaya göre kuruluyor", () => {
  const s = surucu({ route: ROTA, location: nokta(38.404), active: true });
  expect(s.durum.progress.segmentIndex).toBeGreaterThan(0);

  s.guncelle({ route: { legs: [{ ...ROTA.legs[0], coords: dizi(38.500, 5) }] } });
  // Pencere ve sapma serisi sıfırlandı: eski rotanın ilerlemesi taşınmıyor.
  expect(s.durum.progress.segmentIndex).toBe(0);
  expect(s.durum.progress.snapped.latitude).toBeCloseTo(38.5, 3);
  expect(s.durum.offRoute).toBe(false);
});

test("rota yokken çökmüyor", () => {
  const s = surucu({ route: null, location: nokta(38.404), active: true });
  expect(s.durum.progress).toBeNull();
});
