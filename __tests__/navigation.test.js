import {
  buildRouteIndex, snapToRoute, navigationProgress,
  OFF_ROUTE_METERS, ARRIVAL_METERS,
} from "../utils/navigation";

const DEG_LAT_M = 111194.9;

// Sabit boylamda kuzeye giden düz bir rota — mesafeler enlem farkından
// doğrudan hesaplanabildiği için beklenen değerler elle doğrulanabilir.
const LON = 27.1;
const nokta = (lat) => ({ latitude: lat, longitude: LON });
const dizi = (baslangic, adet) =>
  Array.from({ length: adet }, (_, i) => nokta(Number((baslangic + i * 0.001).toFixed(6))));

// Yürüyüş (333 m / 300 sn) → Otobüs (1112 m / 600 sn) → Yürüyüş (222 m / 240 sn)
const ORNEK_ROTA = {
  legs: [
    { mode: "WALK", duration: 300, label: "Yürüyüş", icon: "walk", color: "#7a8299",
      from: "Ev", to: "Konak Durağı", coords: dizi(38.400, 4) },
    { mode: "BUS", duration: 600, label: "Otobüs", icon: "bus", color: "#f97316",
      routeName: "169", from: "Konak Durağı", to: "Bornova Durağı", coords: dizi(38.403, 11) },
    { mode: "WALK", duration: 240, label: "Yürüyüş", icon: "walk", color: "#7a8299",
      from: "Bornova Durağı", to: "Okul", coords: dizi(38.413, 3) },
  ],
};

const TOPLAM_MESAFE = DEG_LAT_M * 0.015; // 38.400 → 38.415
const TOPLAM_SURE = 1140;

describe("buildRouteIndex", () => {
  const index = buildRouteIndex(ORNEK_ROTA);

  it("bacak sınırındaki tekrar eden noktayı atlar", () => {
    // 4 + 11 + 3 = 18 ham nokta; iki sınırda birer tekrar → 16
    expect(index.points.length).toBe(16);
  });

  it("toplam mesafeyi doğru hesaplar", () => {
    expect(Math.abs(index.totalDistance - TOPLAM_MESAFE)).toBeLessThan(10);
  });

  it("her bacağın başlangıç mesafesini ve uzunluğunu çıkarır", () => {
    const [yuruyus, otobus, sonYuruyus] = index.legs;
    expect(yuruyus.startDistance).toBe(0);
    expect(Math.abs(yuruyus.distance - DEG_LAT_M * 0.003)).toBeLessThan(5);
    expect(Math.abs(otobus.startDistance - DEG_LAT_M * 0.003)).toBeLessThan(5);
    expect(Math.abs(otobus.distance - DEG_LAT_M * 0.010)).toBeLessThan(5);
    expect(Math.abs(sonYuruyus.distance - DEG_LAT_M * 0.002)).toBeLessThan(5);
  });

  it("noktaları ait oldukları bacakla etiketler", () => {
    expect(index.points[0].legIndex).toBe(0);
    expect(index.points[8].legIndex).toBe(1);
    expect(index.points[15].legIndex).toBe(2);
  });

  it("bacağın mod ve hat bilgisini korur", () => {
    expect(index.legs[1].mode).toBe("BUS");
    expect(index.legs[1].routeName).toBe("169");
  });
});

describe("snapToRoute", () => {
  const index = buildRouteIndex(ORNEK_ROTA);

  it("rota üzerindeki konumu sıfıra yakın sapmayla oturtur", () => {
    const snap = snapToRoute(nokta(38.4015), index);
    expect(snap.distance).toBeLessThan(1);
    expect(Math.abs(snap.traveledMeters - DEG_LAT_M * 0.0015)).toBeLessThan(5);
  });

  it("rotadan uzaktaki konumun sapmasını ölçer", () => {
    // 0.002 derece boylam ≈ 174 m
    const snap = snapToRoute({ latitude: 38.4015, longitude: LON + 0.002 }, index);
    expect(snap.distance).toBeGreaterThan(160);
    expect(snap.distance).toBeLessThan(190);
  });

  it("fromIndex'ten geriye sıçramaz (dairesel güzergâh koruması)", () => {
    // Konum rotanın başında ama kullanıcı 8. segmente kadar ilerlemiş durumda
    const snap = snapToRoute(nokta(38.4005), index, 8);
    expect(snap.segmentIndex).toBeGreaterThanOrEqual(8);
  });

  it("konum yoksa null döner", () => {
    expect(snapToRoute(null, index)).toBeNull();
  });
});

describe("navigationProgress", () => {
  const index = buildRouteIndex(ORNEK_ROTA);

  it("rotanın başında kalan süre toplam süreye eşittir", () => {
    const p = navigationProgress(index, nokta(38.400));
    expect(p.remainingSeconds).toBeCloseTo(TOPLAM_SURE, 0);
    expect(Math.abs(p.remainingMeters - TOPLAM_MESAFE)).toBeLessThan(10);
    expect(p.progressRatio).toBeCloseTo(0, 3);
    expect(p.currentLeg.index).toBe(0);
  });

  it("kalan süreyi bacak bacak hesaplar, mesafeye orantılı değil", () => {
    // İlk yürüyüş bacağının tam ortası: yürüyüşün yarısı (150 sn) + otobüs (600) + yürüyüş (240)
    const p = navigationProgress(index, nokta(38.4015));
    expect(Math.abs(p.remainingSeconds - 990)).toBeLessThan(10);

    // Mesafeye orantılı hesap 1026 sn verirdi — aradaki fark bilinçli
    const mesafeyeOrantili = TOPLAM_SURE * (1 - p.traveledMeters / TOPLAM_MESAFE);
    expect(Math.abs(p.remainingSeconds - mesafeyeOrantili)).toBeGreaterThan(20);
  });

  it("ilerleme oranını rotanın yarısında ~0.5 verir", () => {
    const p = navigationProgress(index, nokta(38.4075));
    expect(p.progressRatio).toBeCloseTo(0.5, 1);
  });

  it("içinde bulunulan ve sonraki bacağı doğru bildirir", () => {
    const p = navigationProgress(index, nokta(38.408));
    expect(p.currentLeg.mode).toBe("BUS");
    expect(p.nextLeg.mode).toBe("WALK");
    expect(p.nextLeg.index).toBe(2);
  });

  it("son bacakta sonraki bacak yoktur", () => {
    const p = navigationProgress(index, nokta(38.414));
    expect(p.currentLeg.index).toBe(2);
    expect(p.nextLeg).toBeNull();
  });

  it("GPS gürültüsü kadar sapmayı rota dışı saymaz", () => {
    // ~26 m sapma: eşiğin (60 m) altında
    const p = navigationProgress(index, { latitude: 38.4015, longitude: LON + 0.0003 });
    expect(p.distanceFromRoute).toBeLessThan(OFF_ROUTE_METERS);
    expect(p.offRoute).toBe(false);
  });

  it("gerçek sapmayı rota dışı olarak işaretler", () => {
    // ~174 m sapma
    const p = navigationProgress(index, { latitude: 38.4015, longitude: LON + 0.002 });
    expect(p.offRoute).toBe(true);
  });

  it("varış noktasına ulaşınca arrived olur", () => {
    const p = navigationProgress(index, nokta(38.415));
    expect(p.remainingMeters).toBeLessThan(ARRIVAL_METERS);
    expect(p.arrived).toBe(true);
  });

  it("varışa 100 m kala henüz arrived değildir", () => {
    const p = navigationProgress(index, nokta(38.4141));
    expect(p.remainingMeters).toBeGreaterThan(ARRIVAL_METERS);
    expect(p.arrived).toBe(false);
  });

  it("içinde bulunulan bacağın sonuna kalan mesafeyi verir", () => {
    // İlk yürüyüşün ortası: bacağın sonuna ~167 m kalmalı
    const p = navigationProgress(index, nokta(38.4015));
    expect(Math.abs(p.distanceToLegEnd - DEG_LAT_M * 0.0015)).toBeLessThan(10);
  });
});
