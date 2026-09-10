import {
  prMarkerColor, parkingOccupancyText, yakindakiParklar, guzergahtakiParklar,
  BISIKLET_PARK_YARICAP_M,
} from "../Components/MapLayers";

// İki saf fonksiyon: harita, react-native-maps, render gerekmiyor.
const GRI = "#6b7280", YESIL = "#22c55e", TURUNCU = "#f97316", KIRMIZI = "#f87171";

describe("prMarkerColor", () => {
  test("doluluk bilinmiyorsa gri — kırmızı DEĞİL", () => {
    // 82 otoparkın yalnız 14'ünde sensör var. `occupied ?? (capacity - free)`
    // ifadesi bilinmeyeni "tamamen dolu" sayıp hepsini kırmızı gösteriyordu.
    expect(prMarkerColor({ capacity: 100 })).toBe(GRI);
    expect(prMarkerColor({ capacity: 100, occupied: null, free: null })).toBe(GRI);
  });

  test("kapasite yoksa gri", () => {
    expect(prMarkerColor({})).toBe(GRI);
    expect(prMarkerColor({ capacity: 0, occupied: 0 })).toBe(GRI);
  });

  test("doluluk oranı üç kademeye ayrılıyor", () => {
    expect(prMarkerColor({ capacity: 100, occupied: 10 })).toBe(YESIL);
    expect(prMarkerColor({ capacity: 100, occupied: 49 })).toBe(YESIL);
    expect(prMarkerColor({ capacity: 100, occupied: 50 })).toBe(TURUNCU);
    expect(prMarkerColor({ capacity: 100, occupied: 79 })).toBe(TURUNCU);
    expect(prMarkerColor({ capacity: 100, occupied: 80 })).toBe(KIRMIZI);
    expect(prMarkerColor({ capacity: 100, occupied: 100 })).toBe(KIRMIZI);
  });

  test("yalnız boş sayısı biliniyorsa dolu sayısı çıkarılıyor", () => {
    expect(prMarkerColor({ capacity: 100, free: 90 })).toBe(YESIL);
    expect(prMarkerColor({ capacity: 100, free: 5 })).toBe(KIRMIZI);
    expect(prMarkerColor({ capacity: 100, free: 0 })).toBe(KIRMIZI);
  });
});

describe("parkingOccupancyText", () => {
  // Üç ayrı durum, üç ayrı cümle: free=0 "yer yok" demek, free=null
  // "bilmiyoruz" demek. İkisini karıştırmak yanlış bilgi verir.
  test("free = 0 → dolu", () => {
    expect(parkingOccupancyText({ free: 0, capacity: 40 })).toMatch(/^Dolu/);
  });

  test("free > 0 → sayı", () => {
    expect(parkingOccupancyText({ free: 12, capacity: 40 })).toBe("12 boş / 40 toplam");
  });

  test("free = null → yalnız kapasite", () => {
    expect(parkingOccupancyText({ capacity: 40 })).toBe("Kapasite: 40 · anlık doluluk yok");
    expect(parkingOccupancyText({ free: null, capacity: 40 })).toMatch(/anlık doluluk yok/);
  });

  test("hiçbir bilgi yoksa açıkça söylüyor", () => {
    expect(parkingOccupancyText({})).toBe("Doluluk bilgisi yok");
    expect(parkingOccupancyText({ free: 0 })).toBe("Doluluk bilgisi yok");
  });

  test("kırmızı pin ile 'Dolu' metni birlikte çıkıyor", () => {
    // Metin ve renk aynı kaynağı izlemeli: kırmızı bir pin "dolu" diyorsa
    // metin de "Dolu" demeli.
    const dolu = { free: 0, capacity: 40 };
    expect(prMarkerColor(dolu)).toBe(KIRMIZI);
    expect(parkingOccupancyText(dolu)).toMatch(/^Dolu/);

    const bilinmeyen = { capacity: 40 };
    expect(prMarkerColor(bilinmeyen)).toBe(GRI);
    expect(parkingOccupancyText(bilinmeyen)).not.toMatch(/^Dolu/);
  });
});

describe("yakindakiParklar", () => {
  // Konak çevresi; ~111 m = 0.001 derece enlem.
  const KONAK = { latitude: 38.4189, longitude: 27.1287 };
  const yakin = { id: "y", lat: 38.4207, lon: 27.1287 };   // ~200 m
  const uzak  = { id: "u", lat: 38.4639, lon: 27.2168 };   // Bornova, ~9 km

  test("varış yoksa hiç pin çıkmıyor", () => {
    // Şehrin tamamını pinlemek haritayı okunmaz hâle getiriyordu.
    expect(yakindakiParklar([yakin, uzak], null)).toEqual([]);
  });

  test("yalnız varış çevresindekiler kalıyor", () => {
    expect(yakindakiParklar([yakin, uzak], KONAK)).toEqual([yakin]);
  });

  test("yarıçap sınırı dahil", () => {
    const sinirda = { id: "s", lat: 38.4189 + BISIKLET_PARK_YARICAP_M / 111320, lon: 27.1287 };
    expect(yakindakiParklar([sinirda], KONAK)).toHaveLength(1);
    expect(yakindakiParklar([sinirda], KONAK, 100)).toHaveLength(0);
  });

  test("boş liste ve tanımsız girdi patlamıyor", () => {
    expect(yakindakiParklar([], KONAK)).toEqual([]);
    expect(yakindakiParklar(undefined, KONAK)).toEqual([]);
  });
});

describe("guzergahtakiParklar", () => {
  // Konak'tan kuzeye düz bir hat: 38.4189 → 38.4389, sabit boylam.
  const rota = {
    legs: [{ coords: [
      { latitude: 38.4189, longitude: 27.1287 },
      { latitude: 38.4289, longitude: 27.1287 },
      { latitude: 38.4389, longitude: 27.1287 },
    ] }],
  };
  const koridorda = { id: "k", lat: 38.4289, lon: 27.1297 };  // hatta ~87 m
  const uzakta    = { id: "u", lat: 38.4289, lon: 27.1387 };  // hatta ~870 m
  const otesinde  = { id: "o", lat: 38.4600, lon: 27.1287 };  // hattın kuzey ucundan sonra

  test("rota yoksa hiç pin çıkmıyor", () => {
    expect(guzergahtakiParklar([koridorda], null)).toEqual([]);
    expect(guzergahtakiParklar([koridorda], { legs: [] })).toEqual([]);
  });

  test("yalnız koridora düşenler kalıyor", () => {
    expect(guzergahtakiParklar([koridorda, uzakta], rota)).toEqual([koridorda]);
  });

  test("rotanın ötesindeki nokta koridorda sayılmıyor", () => {
    // Sınır kutusu elemesi burada devreye giriyor: hat boyunca değil, ucunun
    // ilerisinde kalan park içeri alınmamalı.
    expect(guzergahtakiParklar([otesinde], rota)).toEqual([]);
  });

  test("koridor genişliği ayarlanabiliyor", () => {
    expect(guzergahtakiParklar([uzakta], rota, 1000)).toEqual([uzakta]);
  });

  test("bacaklar birleştiriliyor", () => {
    const ikiBacak = { legs: [
      { coords: rota.legs[0].coords.slice(0, 2) },
      { coords: rota.legs[0].coords.slice(1) },
    ] };
    expect(guzergahtakiParklar([koridorda], ikiBacak)).toEqual([koridorda]);
  });
});
