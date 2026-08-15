import {
  haversineMeters, pathLengthMeters, projectOnSegment,
  bearingDegrees, formatDistance, formatDuration,
} from "../utils/geo";

// 1 derece enlem ≈ 111.195 m — hesapları bu bilinen değere göre doğruluyoruz.
const DEG_LAT_M = 111194.9;

describe("haversineMeters", () => {
  it("aynı nokta için sıfır döner", () => {
    expect(haversineMeters({ latitude: 38.42, longitude: 27.14 }, { latitude: 38.42, longitude: 27.14 })).toBe(0);
  });

  it("1 derece enlem farkını ~111 km hesaplar", () => {
    const d = haversineMeters({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 });
    expect(d).toBeGreaterThan(DEG_LAT_M - 5);
    expect(d).toBeLessThan(DEG_LAT_M + 5);
  });

  it("boylam farkı enleme göre daralır (İzmir enleminde ~0.784 katsayı)", () => {
    const d = haversineMeters({ latitude: 38.4, longitude: 27.1 }, { latitude: 38.4, longitude: 27.11 });
    const beklenen = DEG_LAT_M * 0.01 * Math.cos((38.4 * Math.PI) / 180);
    expect(Math.abs(d - beklenen)).toBeLessThan(5);
  });

  it("Konak - Alsancak arasını makul bir aralıkta verir", () => {
    const konak = { latitude: 38.4189, longitude: 27.1287 };
    const alsancak = { latitude: 38.4372, longitude: 27.1447 };
    const d = haversineMeters(konak, alsancak);
    expect(d).toBeGreaterThan(2300);
    expect(d).toBeLessThan(2600);
  });
});

describe("pathLengthMeters", () => {
  it("ardışık noktaların mesafelerini toplar", () => {
    const yol = [
      { latitude: 38.400, longitude: 27.1 },
      { latitude: 38.401, longitude: 27.1 },
      { latitude: 38.402, longitude: 27.1 },
    ];
    expect(Math.abs(pathLengthMeters(yol) - DEG_LAT_M * 0.002)).toBeLessThan(5);
  });

  it("tek noktalı veya boş yol için sıfır döner", () => {
    expect(pathLengthMeters([])).toBe(0);
    expect(pathLengthMeters([{ latitude: 38.4, longitude: 27.1 }])).toBe(0);
  });
});

describe("projectOnSegment", () => {
  // Sabit enlemde, doğu-batı uzanan bir segment
  const a = { latitude: 38.4, longitude: 27.1 };
  const b = { latitude: 38.4, longitude: 27.2 };

  it("segmentin ortasına dik düşen noktayı t≈0.5 ile bulur", () => {
    const p = { latitude: 38.41, longitude: 27.15 };
    const sonuc = projectOnSegment(p, a, b);
    expect(sonuc.t).toBeCloseTo(0.5, 2);
    // Dik uzaklık 0.01 derece enlem kadar olmalı
    expect(Math.abs(sonuc.distance - DEG_LAT_M * 0.01)).toBeLessThan(10);
  });

  it("segmentin ötesindeki noktayı uç noktaya kırpar (t=1)", () => {
    const sonuc = projectOnSegment({ latitude: 38.4, longitude: 27.3 }, a, b);
    expect(sonuc.t).toBe(1);
    expect(sonuc.point.longitude).toBeCloseTo(27.2, 5);
  });

  it("segmentin gerisindeki noktayı başlangıca kırpar (t=0)", () => {
    const sonuc = projectOnSegment({ latitude: 38.4, longitude: 27.0 }, a, b);
    expect(sonuc.t).toBe(0);
    expect(sonuc.point.longitude).toBeCloseTo(27.1, 5);
  });

  it("sıfır uzunluklu segmentte çökmez", () => {
    const sonuc = projectOnSegment({ latitude: 38.41, longitude: 27.1 }, a, a);
    expect(sonuc.t).toBe(0);
    expect(Number.isFinite(sonuc.distance)).toBe(true);
  });
});

describe("bearingDegrees", () => {
  it("kuzeye bakan yön 0 derecedir", () => {
    expect(bearingDegrees({ latitude: 38.4, longitude: 27.1 }, { latitude: 38.5, longitude: 27.1 })).toBeCloseTo(0, 1);
  });

  it("doğuya bakan yön ~90 derecedir", () => {
    const yon = bearingDegrees({ latitude: 38.4, longitude: 27.1 }, { latitude: 38.4, longitude: 27.2 });
    expect(yon).toBeGreaterThan(89);
    expect(yon).toBeLessThan(91);
  });
});

describe("formatDistance", () => {
  it("1 km altını metre olarak, 10'a yuvarlayarak yazar", () => {
    expect(formatDistance(852)).toBe("850 m");
    expect(formatDistance(0)).toBe("0 m");
  });

  it("1 km ve üstünü virgüllü km olarak yazar", () => {
    expect(formatDistance(1234)).toBe("1,2 km");
    expect(formatDistance(12000)).toBe("12,0 km");
  });

  it("999 m'yi '1000 m' değil '1,0 km' gösterir", () => {
    expect(formatDistance(999)).toBe("1,0 km");
  });

  it("geçersiz girdide tire döner", () => {
    expect(formatDistance(NaN)).toBe("—");
    expect(formatDistance(-5)).toBe("—");
    expect(formatDistance(Infinity)).toBe("—");
  });
});

describe("formatDuration", () => {
  it("bir dakikanın altını saniye olarak yazar", () => {
    expect(formatDuration(45)).toBe("45 sn");
  });

  it("bir saatin altını dakika olarak yazar", () => {
    expect(formatDuration(720)).toBe("12 dk");
  });

  it("bir saatin üstünü saat + dakika olarak yazar", () => {
    expect(formatDuration(3900)).toBe("1 sa 5 dk");
  });

  it("geçersiz girdide tire döner", () => {
    expect(formatDuration(NaN)).toBe("—");
    expect(formatDuration(-10)).toBe("—");
  });
});
