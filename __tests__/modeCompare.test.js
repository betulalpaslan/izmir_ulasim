import {
  KARSILASTIRMA_MODLARI, OLCUTLER, modSatiri, enIyileriIsaretle, karsilastirmaMatrisi,
} from "../utils/modeCompare";

// routeScoring testlerindeki üreticinin aynısı: distance verildiği için
// polyline çözümlemesine gerek kalmıyor.
const bacak = (mode, duration, distance, shortName = null) => ({
  mode, duration, distance,
  from: { name: `${mode} başlangıç` },
  to: { name: `${mode} bitiş` },
  ...(shortName ? { route: { shortName } } : {}),
});
const yanit = (...guzergahlar) => ({
  itineraries: guzergahlar.map((legs) => ({
    duration: legs.reduce((s, l) => s + l.duration, 0), legs,
  })),
});

const transitYolculugu = () => [
  bacak("WALK", 300, 350),
  bacak("BUS", 1200, 6000, "121"),
  bacak("WALK", 240, 280),
];
const mod = (id) => KARSILASTIRMA_MODLARI.find((m) => m.id === id);

describe("OLCUTLER", () => {
  // Bu ölçüt bilerek çıkarıldı: maliyeti her mod için aynı bütünlükte
  // hesaplayamıyoruz (arabanın yakıtı/otoparkı yok). Geri eklenirse
  // araba yine her yolculukta "en ucuz" çıkar.
  it("ücreti rozet ölçütü olarak İÇERMEZ", () => {
    expect(OLCUTLER.map((o) => o.id)).not.toContain("ucret");
    expect(OLCUTLER.map((o) => o.id)).toEqual(["sure", "yuruyus", "aktarma"]);
  });
});

describe("modSatiri", () => {
  it("güzergâh yoksa çalışmadı olarak işaretler ve sebep verir", () => {
    const s = modSatiri(mod("transit"), { itineraries: [] });
    expect(s.calisti).toBe(false);
    expect(s.sebep).toBeTruthy();
    expect(s.sureSn).toBeNull();
  });

  it("ağ hatasını sebep olarak taşır", () => {
    const s = modSatiri(mod("transit"), { error: "Sunucuya ulaşılamadı." });
    expect(s.calisti).toBe(false);
    expect(s.sebep).toBe("Sunucuya ulaşılamadı.");
  });

  it("çalışan mod için ölçütleri doldurur", () => {
    const s = modSatiri(mod("transit"), yanit(transitYolculugu()));
    expect(s.calisti).toBe(true);
    expect(s.sureSn).toBeGreaterThan(0);
    expect(s.aktarma).toBe(0);
    expect(typeof s.ucret).toBe("number");
  });

  // Bilinmeyen maliyet sıfır değildir: 0 ₺ yazmak arabayı "bedava"
  // gösterip matrisin tam da düzeltmek istediği hatayı üretiyordu.
  it("araba için ücreti boş bırakır, 0 yazmaz", () => {
    const s = modSatiri(mod("car"), yanit([bacak("CAR", 900, 12000)]));
    expect(s.calisti).toBe(true);
    expect(s.ucret).toBeNull();
    expect(s.ucretDurum).toBe("yok");
  });
});

describe("enIyileriIsaretle", () => {
  const satir = (id, sureSn, yuruyusM, aktarma) =>
    ({ id, ad: id, calisti: true, sureSn, yuruyusM, aktarma, ucret: 35 });

  it("her ölçütte en küçüğü işaretler", () => {
    const [a, b] = enIyileriIsaretle([satir("a", 600, 900, 2), satir("b", 1200, 100, 0)]);
    expect(a.enIyiOlcutler).toEqual(["sure"]);
    expect(b.enIyiOlcutler).toEqual(expect.arrayContaining(["yuruyus", "aktarma"]));
  });

  it("ayırt etmeyen ölçütü hiç işaretlemez", () => {
    const m = enIyileriIsaretle([satir("a", 600, 500, 1), satir("b", 1200, 500, 1)]);
    expect(m.every((s) => !s.enIyiOlcutler.includes("yuruyus"))).toBe(true);
    expect(m.every((s) => !s.enIyiOlcutler.includes("aktarma"))).toBe(true);
  });

  // Beraberlik ancak ölçüt AYIRT EDİYORSA anlamlı: iki satır en küçükte
  // eşitse ikisi de rozet alır, ama üçüncü satır da aynı değerdeyse ölçüt
  // hiç kimseyi ayırmıyor demektir ve rozet verilmez (üstteki teste bak).
  it("en küçükte eşitlenen satırların ikisini de işaretler", () => {
    const m = enIyileriIsaretle([
      satir("a", 600, 100, 0), satir("b", 600, 900, 3), satir("c", 1500, 400, 1),
    ]);
    expect(m[0].enIyiOlcutler).toContain("sure");
    expect(m[1].enIyiOlcutler).toContain("sure");
    expect(m[2].enIyiOlcutler).not.toContain("sure");
  });

  it("çalışmayan satıra rozet vermez", () => {
    const m = enIyileriIsaretle([satir("a", 600, 100, 0),
      { id: "b", calisti: false, sureSn: null, yuruyusM: null, aktarma: null }]);
    expect(m[1].enIyiOlcutler).toEqual([]);
  });
});

describe("karsilastirmaMatrisi", () => {
  it("her mod için satır üretir ve çalışanları öne alır", () => {
    const matris = karsilastirmaMatrisi({ transit: yanit(transitYolculugu()) });
    expect(matris).toHaveLength(KARSILASTIRMA_MODLARI.length);
    expect(matris[0].id).toBe("transit");
    expect(matris[0].calisti).toBe(true);
    expect(matris.slice(1).every((s) => !s.calisti)).toBe(true);
  });
});
