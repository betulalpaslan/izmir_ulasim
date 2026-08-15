import {
  resolveProfileKey, calcCarbonGrams, calcJourneyFare,
  rankItineraries, selectCandidates, buildRouteResult, candidateKey,
} from "../utils/routeScoring";

// OTP'nin döndürdüğü biçime yakın sahte güzergâh üretici.
// distance verildiği için polyline çözümlemesine gerek kalmaz.
const bacak = (mode, duration, distance, shortName = null) => ({
  mode,
  duration,
  distance,
  from: { name: `${mode} başlangıç` },
  to: { name: `${mode} bitiş` },
  ...(shortName ? { route: { shortName } } : {}),
});

const guzergah = (duration, legs) => ({ duration, legs });

describe("resolveProfileKey", () => {
  it("bisiklet alt modlarını ayrı anahtarlara çevirir", () => {
    expect(resolveProfileKey("bicycle", "RENT")).toBe("bicycle_rent");
    expect(resolveProfileKey("bicycle", "PARK")).toBe("bicycle_park");
    expect(resolveProfileKey("bicycle", null)).toBe("bicycle");
  });

  it("diğer profilleri olduğu gibi bırakır", () => {
    expect(resolveProfileKey("transit")).toBe("transit");
    expect(resolveProfileKey("park_and_ride")).toBe("park_and_ride");
  });

  it("profil verilmezse transit varsayar", () => {
    expect(resolveProfileKey(undefined)).toBe("transit");
    expect(resolveProfileKey(null)).toBe("transit");
  });
});

describe("calcJourneyFare", () => {
  it("İzmirim Kart'ta aktarmalar tek ücrete dahildir", () => {
    expect(calcJourneyFare(3, 35, false)).toBe(35);
    expect(calcJourneyFare(1, 35, false)).toBe(35);
  });

  it("kredi kartında her biniş ayrı ücretlendirilir", () => {
    expect(calcJourneyFare(3, 39, true)).toBe(117);
    expect(calcJourneyFare(1, 39, true)).toBe(39);
  });

  it("toplu taşıma kullanılmayan rotada ücret yoktur", () => {
    expect(calcJourneyFare(0, 35, false)).toBe(0);
    expect(calcJourneyFare(0, 39, true)).toBe(0);
  });

  it("indirimli tarifeleri de aynı kuralla uygular", () => {
    expect(calcJourneyFare(2, 17.5, false)).toBe(17.5); // Genç kart
    expect(calcJourneyFare(2, 17.5, true)).toBe(35);
  });
});

describe("calcCarbonGrams", () => {
  it("araba için km başına 150 g hesaplar", () => {
    expect(calcCarbonGrams([bacak("CAR", 600, 10000)])).toBeCloseTo(1500, 5);
  });

  it("yürüyüş ve bisiklet sıfır emisyondur", () => {
    expect(calcCarbonGrams([bacak("WALK", 600, 2000), bacak("BICYCLE", 600, 5000)])).toBe(0);
  });

  it("karışık rotada bacakları toplar", () => {
    // 10 km araba (1500 g) + 5 km tramvay (150 g)
    const toplam = calcCarbonGrams([bacak("CAR", 600, 10000), bacak("TRAM", 300, 5000)]);
    expect(toplam).toBeCloseTo(1650, 5);
  });

  it("bilinmeyen modu sıfır sayar", () => {
    expect(calcCarbonGrams([bacak("SCOOTER", 300, 3000)])).toBe(0);
  });
});

describe("rankItineraries", () => {
  it("eşit sürede az yürüyenli rotayı öne alır", () => {
    const cokYuruyus = guzergah(1800, [bacak("WALK", 900, 1200), bacak("BUS", 900, 5000, "169")]);
    const azYuruyus  = guzergah(1800, [bacak("WALK", 300, 300),  bacak("BUS", 1500, 5000, "12")]);

    const siralama = rankItineraries([cokYuruyus, azYuruyus], "transit");
    expect(siralama[0].itin).toBe(azYuruyus);
  });

  it("aktarma cezasını uygular", () => {
    const aktarmali = guzergah(1500, [
      bacak("WALK", 200, 200), bacak("BUS", 600, 4000, "169"),
      bacak("WALK", 100, 100), bacak("BUS", 600, 3000, "12"),
    ]);
    const aktarmasiz = guzergah(1700, [bacak("WALK", 200, 200), bacak("RAIL", 1500, 7000, "M1")]);

    // Aktarmasız rota 200 sn daha uzun ama 10 puanlık aktarma cezası bunu telafi eder
    const siralama = rankItineraries([aktarmali, aktarmasiz], "transit");
    expect(siralama[0].itin).toBe(aktarmasiz);
  });

  it("transit profilinde 2 km üstü tek yürüyüş bacağını eler", () => {
    const uzunYuruyus = guzergah(1500, [bacak("WALK", 1500, 2500), bacak("BUS", 600, 4000, "169")]);
    const normal      = guzergah(1800, [bacak("WALK", 300, 400),   bacak("BUS", 1500, 6000, "12")]);

    const siralama = rankItineraries([uzunYuruyus, normal], "transit");
    expect(siralama).toHaveLength(1);
    expect(siralama[0].itin).toBe(normal);
  });

  it("hepsi elenirse yine de en iyi rotayı döner (boş ekran gösterilmez)", () => {
    const uzunYuruyus = guzergah(1500, [bacak("WALK", 1500, 2500), bacak("BUS", 600, 4000, "169")]);
    const siralama = rankItineraries([uzunYuruyus], "transit");
    expect(siralama).toHaveLength(1);
  });

  it("aynı rota kümesini profile göre farklı değerlendirir", () => {
    // 800 m yürüyüş: transit eşiğinin (2000) altında, bisiklet eşiğinin (600) üstünde
    const yuruyusluRota = guzergah(1200, [bacak("WALK", 600, 800), bacak("BICYCLE", 600, 3000)]);
    const kisaYuruyus   = guzergah(1400, [bacak("WALK", 200, 200), bacak("BICYCLE", 1200, 4000)]);

    expect(rankItineraries([yuruyusluRota, kisaYuruyus], "transit")).toHaveLength(2);
    // Bisiklet profilinde uzun yürüyüşlü olan elenir
    const bisiklet = rankItineraries([yuruyusluRota, kisaYuruyus], "bicycle");
    expect(bisiklet).toHaveLength(1);
    expect(bisiklet[0].itin).toBe(kisaYuruyus);
  });

  it("yürüyüş ve aktarma bilgisini hesaplayıp taşır", () => {
    const rota = guzergah(1800, [
      bacak("WALK", 300, 400), bacak("BUS", 600, 4000, "169"),
      bacak("WALK", 120, 150), bacak("TRAM", 600, 3000, "T1"),
    ]);
    const [sonuc] = rankItineraries([rota], "transit");
    expect(sonuc.walk.total).toBe(550);
    expect(sonuc.walk.maxLeg).toBe(400);
    expect(sonuc.walk.transfers).toBe(1);
    expect(sonuc.walk.duration).toBe(1800);
  });
});

describe("candidateKey", () => {
  it("aynı süre, yürüyüş ve hatlara sahip rotalar için aynı anahtarı üretir", () => {
    const a = guzergah(1800, [bacak("WALK", 300, 300), bacak("BUS", 1500, 5000, "169")]);
    const b = guzergah(1800, [bacak("WALK", 300, 300), bacak("BUS", 1500, 5200, "169")]);
    const walk = { duration: 1800, total: 300 };
    expect(candidateKey(a, walk)).toBe(candidateKey(b, walk));
  });

  it("farklı hat kullanan rotaları ayırır", () => {
    const a = guzergah(1800, [bacak("BUS", 1800, 5000, "169")]);
    const b = guzergah(1800, [bacak("BUS", 1800, 5000, "12")]);
    const walk = { duration: 1800, total: 0 };
    expect(candidateKey(a, walk)).not.toBe(candidateKey(b, walk));
  });
});

describe("selectCandidates", () => {
  it("birebir aynı rotaları tek karta indirir", () => {
    const rota = guzergah(1800, [bacak("WALK", 300, 300), bacak("BUS", 1500, 5000, "169")]);
    const kopya = guzergah(1800, [bacak("WALK", 300, 300), bacak("BUS", 1500, 5000, "169")]);

    const adaylar = selectCandidates(rankItineraries([rota, kopya], "transit"), "transit");
    expect(adaylar).toHaveLength(1);
    expect(adaylar[0].tag).toBe("Önerilen");
  });

  it("farklı rotalara farklı etiketler dağıtır", () => {
    const hizli    = guzergah(1200, [bacak("WALK", 300, 900), bacak("BUS", 900, 6000, "169")]);
    const azAktarma = guzergah(2400, [bacak("WALK", 400, 500), bacak("RAIL", 2000, 9000, "M1")]);

    const adaylar = selectCandidates(rankItineraries([hizli, azAktarma], "transit"), "transit");
    const etiketler = adaylar.map((a) => a.tag);
    expect(etiketler).toContain("Önerilen");
    expect(etiketler.length).toBeGreaterThan(1);
  });

  it("profil başına kart sayısı sınırını aşmaz", () => {
    // 8 farklı hat → transit için en fazla 5 kart
    const cokRota = Array.from({ length: 8 }, (_, i) =>
      guzergah(1200 + i * 60, [bacak("WALK", 200, 200 + i * 10), bacak("BUS", 1000, 5000, `H${i}`)])
    );
    const adaylar = selectCandidates(rankItineraries(cokRota, "transit"), "transit");
    expect(adaylar.length).toBeLessThanOrEqual(5);
  });

  it("araba profilinde en fazla 2 kart gösterir", () => {
    const cokRota = Array.from({ length: 5 }, (_, i) =>
      guzergah(900 + i * 60, [bacak("CAR", 900 + i * 60, 8000 + i * 500)])
    );
    const adaylar = selectCandidates(rankItineraries(cokRota, "car"), "car");
    expect(adaylar.length).toBeLessThanOrEqual(2);
  });

  it("her adaya karbon değeri ekler", () => {
    const rota = guzergah(900, [bacak("CAR", 900, 10000)]);
    const [aday] = selectCandidates(rankItineraries([rota], "car"), "car");
    expect(aday.carbon).toBeCloseTo(1500, 5);
  });
});

describe("buildRouteResult", () => {
  const rota = guzergah(1800, [
    bacak("WALK", 300, 400),
    bacak("BUS", 600, 4000, "169"),
    bacak("WALK", 120, 150),
    bacak("TRAM", 780, 3000, "T1"),
  ]);

  const aday = () => {
    const [siralanan] = rankItineraries([rota], "transit");
    return { ...siralanan, carbon: calcCarbonGrams(rota.legs), tag: "Önerilen", tagColor: "#60a5fa" };
  };

  it("aktarma sayısını transit bacak sayısından bir eksik verir", () => {
    const sonuc = buildRouteResult(aday(), 35, false, "transit");
    expect(sonuc.transfers).toBe(1);
  });

  it("İzmirim Kart ile tek ücret, kredi kartı ile biniş başına ücret uygular", () => {
    expect(buildRouteResult(aday(), 35, false, "transit").cost).toBe(35);
    expect(buildRouteResult(aday(), 39, true, "transit").cost).toBe(78); // 2 biniş
  });

  it("her bacağa arayüz için renk, ikon ve etiket ekler", () => {
    const sonuc = buildRouteResult(aday(), 35, false, "transit");
    expect(sonuc.legs[1].label).toBe("Otobüs");
    expect(sonuc.legs[1].routeName).toBe("169");
    expect(sonuc.legs[3].label).toBe("Tramvay");
    expect(sonuc.legs[0].icon).toBe("walk");
  });

  it("toplam süreyi bacaklardan toplar", () => {
    expect(buildRouteResult(aday(), 35, false, "transit").totalDuration).toBe(1800);
  });

  it("eşik aşılmadığında yürüyüş uyarısı vermez", () => {
    expect(buildRouteResult(aday(), 35, false, "transit").walkWarning).toBeNull();
  });

  it("uzun yürüyüş bacağında uyarı üretir", () => {
    const uzun = guzergah(2400, [bacak("WALK", 1800, 2500), bacak("BUS", 600, 4000, "169")]);
    const [siralanan] = rankItineraries([uzun], "transit");
    const sonuc = buildRouteResult(
      { ...siralanan, carbon: 0, tag: "Önerilen", tagColor: "#60a5fa" },
      35, false, "transit"
    );
    expect(sonuc.walkWarning).toContain("2.5 km");
  });

  it("park noktasını araç bacağının varışından çıkarır", () => {
    const parkli = guzergah(1800, [
      { ...bacak("CAR", 600, 8000), to: { name: "Bornova Otoparkı", lat: 38.46, lon: 27.21 } },
      bacak("WALK", 200, 250),
      bacak("RAIL", 1000, 6000, "M1"),
    ]);
    const [siralanan] = rankItineraries([parkli], "park_and_ride");
    const sonuc = buildRouteResult(
      { ...siralanan, carbon: 0, tag: "Önerilen", tagColor: "#60a5fa" },
      35, false, "park_and_ride"
    );
    expect(sonuc.parkingPoint).toEqual({ lat: 38.46, lon: 27.21, name: "Bornova Otoparkı" });
  });

  it("araç bacağı son bacaksa park noktası üretmez", () => {
    const direkt = guzergah(900, [
      { ...bacak("CAR", 900, 9000), to: { name: "Varış", lat: 38.46, lon: 27.21 } },
    ]);
    const [siralanan] = rankItineraries([direkt], "car");
    const sonuc = buildRouteResult(
      { ...siralanan, carbon: 0, tag: "Önerilen", tagColor: "#60a5fa" },
      35, false, "car"
    );
    expect(sonuc.parkingPoint).toBeNull();
  });
});
