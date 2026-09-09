import { Text } from "react-native";
import { act, create } from "react-test-renderer";
import RoutePanel from "../Components/RoutePanel";

// Tema tek ihtiyaç; gerçek sağlayıcı AsyncStorage'a gidiyor ve bu testin
// konusu değil.
jest.mock("../utils/ThemeContext", () => ({
  useTheme: () => ({
    theme: { text: "#000", muted: "#666", border: "#ccc", input: "#fff", active: "#00f" },
  }),
}));

// buildRouteResult'ın ürettiği biçim.
const bacak = (mode, from, to, extra = {}) => ({
  mode, from, to,
  duration: 600,
  distanceMeters: 3000,
  color: "#888",
  icon: "bus",
  label: mode,
  routeName: null,
  coords: [],
  ...extra,
});

const rota = (over = {}) => ({
  kimlik: "r1",
  tag: "Önerilen",
  tagColor: "#60a5fa",
  etiketler: ["Önerilen"],
  totalDuration: 1920,
  totalDistance: "13.1",
  walkDistance: "0.8",
  transfers: 1,
  cost: 35,
  ucretDetay: { bilet: 35, bisim: 0, bisimDakika: 0, provizyon: 0 },
  walkWarning: null,
  yuruyusZorunlu: false,
  legs: [
    bacak("WALK", "Başlangıç", "Konak", { icon: "walk", label: "Yürüyüş" }),
    bacak("SUBWAY", "Konak", "Halkapınar", { routeName: "M1", icon: "train", label: "Metro" }),
    bacak("RAIL", "Halkapınar", "Karşıyaka", { icon: "train", label: "Banliyö" }),
    bacak("WALK", "Karşıyaka", "Varış", { icon: "walk", label: "Yürüyüş" }),
  ],
  ...over,
});

function ciz(props = {}) {
  let agac;
  act(() => {
    agac = create(
      <RoutePanel
        routes={[]}
        selectedIdx={-1}
        onSelect={() => {}}
        onReset={() => {}}
        {...props}
      />
    );
  });
  return agac;
}

const metinler = (agac) =>
  agac.root.findAllByType(Text).map((t) => {
    const c = t.props.children;
    return Array.isArray(c) ? c.flat().map((x) => String(x ?? "")).join("") : String(c ?? "");
  });

const tumMetin = (agac) => metinler(agac).join(" | ");

describe("durum ekranları", () => {
  test("yüklenirken arama mesajı", () => {
    expect(tumMetin(ciz({ loading: true }))).toContain("Rota aranıyor");
  });

  test("hata metni gösterilir", () => {
    expect(tumMetin(ciz({ error: "Rota bulunamadı." }))).toContain("Rota bulunamadı.");
  });

  // Alternatif ölçülmüş bir süre; yoksa teklif hiç çıkmaz, uydurulmaz.
  test("ölçülmüş alternatif varsa çıkış teklifi çıkar", () => {
    const t = tumMetin(ciz({
      error: "BİSİM'li güzergâh kurulamadı.",
      modBos: { kod: "x", alternatifSn: 1950 },
      onAlternative: () => {},
    }));
    expect(t).toContain("Toplu taşıma: 33 dk");
  });

  test("alternatif süresi yoksa teklif gösterilmez", () => {
    const t = tumMetin(ciz({
      error: "BİSİM'li güzergâh kurulamadı.",
      modBos: { kod: "x", alternatifSn: null },
      onAlternative: () => {},
    }));
    expect(t).not.toContain("Toplu taşıma:");
  });

  test("başlangıç seçilmemişse yönlendirme yazar", () => {
    expect(tumMetin(ciz({}))).toContain("Başlangıç noktası yazın");
  });
});

describe("kart", () => {
  test("etiket, süre ve meta satırı", () => {
    const t = tumMetin(ciz({ routes: [rota()] }));
    expect(t).toContain("Önerilen");
    expect(t).toContain("32 dk");
    expect(t).toContain("13.1 km · 0.8 km yürüyüş · 1 aktarma");
  });

  test("ikincil etiketler ayrı rozette", () => {
    const t = tumMetin(ciz({ routes: [rota({ etiketler: ["Önerilen", "En Hızlı"] })] }));
    expect(t).toContain("En Hızlı");
  });

  // Zincir kapalı kartta görünür — "nereden nereye" sorusunun cevabı.
  test("durak zinciri kapalı kartta görünür", () => {
    const t = tumMetin(ciz({ routes: [rota()] }));
    expect(t).toContain("Konak");
    expect(t).toContain("Halkapınar");
    expect(t).toContain("Karşıyaka");
  });

  test("transitsiz güzergâhta zincir çizilmez", () => {
    const bisikletli = rota({
      legs: [bacak("BICYCLE", "Başlangıç", "Varış", { icon: "bike", label: "Bisiklet" })],
    });
    const t = tumMetin(ciz({ routes: [bisikletli] }));
    expect(t).not.toContain("Durak");
  });

  // Karbon etiketi ve gram satırı kaldırıldı (kaynaksız katsayı).
  test("karbon satırı yok", () => {
    const t = tumMetin(ciz({ routes: [rota()], selectedIdx: 0 }));
    expect(t).not.toContain("CO₂");
    expect(t).not.toContain("emisyon");
  });

  test("ücretsiz güzergâhta tutar yerine 'Ücretsiz' yazar", () => {
    expect(tumMetin(ciz({ routes: [rota({ cost: 0 })] }))).toContain("Ücretsiz");
  });
});

describe("açık kart — adım listesi", () => {
  const acik = (over) => ciz({ routes: [rota(over)], selectedIdx: 0 });

  test("adımlar 'şuradan şuraya' okunur ve uç adları geçer", () => {
    const t = tumMetin(acik({}));
    expect(t).toContain("Konak → Halkapınar");
    expect(t).toContain("Halkapınar → Karşıyaka");
  });

  test("uçlar verilince ilk ve son adım gerçek adı yazar", () => {
    let agac;
    act(() => {
      agac = create(
        <RoutePanel
          routes={[rota()]}
          selectedIdx={0}
          onSelect={() => {}}
          onReset={() => {}}
          originName="Konak Meydanı"
          destName="Karşıyaka İskele"
        />
      );
    });
    const t = tumMetin(agac);
    expect(t).toContain("Konak Meydanı → Konak");
    expect(t).toContain("Karşıyaka → Karşıyaka İskele");
  });

  // Uç adı çözülemeyen bacakta yarım ok yerine eylem cümlesi yazılır.
  test("uç adı yoksa eylem cümlesine düşer", () => {
    const t = tumMetin(acik({
      legs: [
        bacak("WALK", "Başlangıç", "x", { icon: "walk", label: "Yürüyüş" }),
        bacak("BICYCLE_RENTAL", "x", "Varış", { icon: "bike", label: "BİSİM" }),
      ],
    }));
    expect(t).toContain("Bisikletle varışa git");
  });

  test("adımlar numaralı", () => {
    const t = tumMetin(acik({}));
    expect(t).toContain("1. Yürüyüş");
    expect(t).toContain("2. Metro · M1");
  });

  // Araya yürüyüş girmeyen iki transit = aynı durakta araç değiştirme.
  test("ardışık iki transit arasına aktarma şeridi koyar", () => {
    expect(tumMetin(acik({}))).toContain("Aktarma · Halkapınar");
  });

  test("yürüyüşle ayrılan transitlerde aktarma şeridi yok", () => {
    const t = tumMetin(acik({
      legs: [
        bacak("BUS", "A", "B", { routeName: "121" }),
        bacak("WALK", "B", "C", { icon: "walk", label: "Yürüyüş" }),
        bacak("BUS", "C", "D", { routeName: "253" }),
      ],
    }));
    expect(t).not.toContain("Aktarma ·");
  });

  // BİSİM bilete dahil değil; tek toplam rakam "neden bu kadar"ı yanıtlamıyordu.
  test("BİSİM varsa ücret dökümü çıkar", () => {
    const t = tumMetin(acik({
      cost: 97.5,
      ucretDetay: { bilet: 35, bisim: 62.5, bisimDakika: 40, provizyon: 47.5 },
    }));
    expect(t).toContain("Toplu taşıma bileti");
    expect(t).toContain("BİSİM · 40 dk");
    expect(t).toContain("ön provizyon");
  });

  test("BİSİM yoksa ücret dökümü çıkmaz", () => {
    expect(tumMetin(acik({}))).not.toContain("Toplu taşıma bileti");
  });

  test("zorunlu yürüyüş uyarısı gösterilir", () => {
    const t = tumMetin(acik({ walkWarning: "Bu yolculukta tek seferde en az 24 dk yürümek gerekiyor." }));
    expect(t).toContain("en az 24 dk yürümek");
  });
});

describe("kart seçimi", () => {
  test("kapalı kart açılır, açık kart kapanır", () => {
    const secilen = [];
    const props = { routes: [rota()], onSelect: (i) => secilen.push(i), onReset: () => {} };

    let kapali;
    act(() => { kapali = create(<RoutePanel {...props} selectedIdx={-1} />); });
    act(() => { kapali.root.findAllByType(require("react-native").TouchableOpacity)[0].props.onPress(); });
    expect(secilen).toEqual([0]);

    let acik;
    act(() => { acik = create(<RoutePanel {...props} selectedIdx={0} />); });
    act(() => { acik.root.findAllByType(require("react-native").TouchableOpacity)[0].props.onPress(); });
    expect(secilen).toEqual([0, -1]);
  });
});

describe("ücret dökümü — bilet adedi", () => {
  const acikKart = (over) =>
    ciz({ routes: [rota(over)], selectedIdx: 0 });

  test("90 dk aşılınca kaç bilet ödendiği yazılır", () => {
    const t = tumMetin(acikKart({
      cost: 35,
      ucretDetay: { bilet: 35, biletAdedi: 2, biletBirim: 17.5, biletSebebi: "sure-asimi",
                    bisim: 0, bisimDakika: 0, provizyon: 0 },
    }));
    expect(t).toContain("2 × 17,50 ₺");
    expect(t).toContain("90 dakikalık aktarma hakkı");
    expect(t).not.toContain("ön provizyon");
  });

  test("kredi kartında sebep biniş başına ücrettir", () => {
    const t = tumMetin(acikKart({
      cost: 195,
      ucretDetay: { bilet: 195, biletAdedi: 5, biletBirim: 39, biletSebebi: "binis-basi",
                    bisim: 0, bisimDakika: 0, provizyon: 0 },
    }));
    expect(t).toContain("5 × 39 ₺");
    expect(t).toContain("her biniş ayrı ücretlenir");
  });

  test("tek bilette döküm kutusu açılmaz", () => {
    const t = tumMetin(acikKart({
      ucretDetay: { bilet: 17.5, biletAdedi: 1, biletBirim: 17.5, biletSebebi: null,
                    bisim: 0, bisimDakika: 0, provizyon: 0 },
    }));
    expect(t).not.toContain("Toplu taşıma bileti");
  });
});

describe("sıralama çipleri", () => {
  const Touchable = require("react-native").TouchableOpacity;
  const liste = [
    rota({ kimlik: "r0", totalDuration: 2400, transfers: 0, walkMeters: 1500 }),
    rota({ kimlik: "r1", totalDuration: 1500, transfers: 3, walkMeters: 1200 }),
    rota({ kimlik: "r2", totalDuration: 1800, transfers: 2, walkMeters: 400 }),
  ];

  test("dört tercih de görünür", () => {
    const t = tumMetin(ciz({ routes: liste, selectedIdx: 0 }));
    ["Önerilen", "En Hızlı", "Az Aktarma", "Az Yürüyüş"].forEach((etiket) =>
      expect(t).toContain(etiket)
    );
  });

  test("tek rotada çip satırı çıkmaz", () => {
    const agac = ciz({ routes: [rota()], selectedIdx: -1 });
    expect(tumMetin(agac)).not.toContain("Az Yürüyüş");
  });

  test("çipe basınca o ölçünün en iyisi orijinal indeksle seçilir", () => {
    const secilen = [];
    let agac;
    act(() => {
      agac = create(
        <RoutePanel routes={liste} selectedIdx={0} onSelect={(i) => secilen.push(i)} onReset={() => {}} />
      );
    });
    const cipler = agac.root.findAllByType(Touchable).slice(0, 4);

    act(() => { cipler[1].props.onPress(); });   // En Hızlı → 1. rota
    act(() => { cipler[3].props.onPress(); });   // Az Yürüyüş → 2. rota
    expect(secilen).toEqual([1, 2]);
  });

  test("seçilen tercihe göre kartların sırası değişir", () => {
    let agac;
    act(() => {
      agac = create(
        <RoutePanel routes={liste} selectedIdx={0} onSelect={() => {}} onReset={() => {}} />
      );
    });
    const sureler = () =>
      metinler(agac).filter((m) => m.endsWith(" dk") && !m.includes("·"));

    expect(sureler()[0]).toBe("40 dk");          // Önerilen: liste sırası
    act(() => { agac.root.findAllByType(Touchable)[1].props.onPress(); });
    expect(sureler()[0]).toBe("25 dk");          // En Hızlı başa geçti
  });
});

describe("kapalı kart yüksekliği", () => {
  const uzunRota = rota({
    legs: [
      bacak("WALK", "Başlangıç", "Bornova Metro", { icon: "walk", label: "Yürüyüş" }),
      bacak("BUS", "Bornova Metro", "Bölge istasyonu", { routeName: "368" }),
      bacak("BUS", "Bölge istasyonu", "Bölge", { routeName: "800" }),
      bacak("SUBWAY", "Bölge", "Fahrettin Altay", { routeName: "M1" }),
      bacak("BUS", "Fahrettin Altay", "Sığacık Yol Ayrımı", { routeName: "675" }),
      bacak("BUS", "Sığacık Yol Ayrımı", "Sığacık Pazarı", { routeName: "640" }),
    ],
  });

  test("kapalı kartta zincir kısaltılır", () => {
    const t = tumMetin(ciz({ routes: [uzunRota], selectedIdx: -1 }));
    expect(t).toContain("+3 durak");
    expect(t).not.toContain("Sığacık Pazarı");
  });

  test("kart açılınca zincirin tamamı görünür", () => {
    const t = tumMetin(ciz({ routes: [uzunRota], selectedIdx: 0 }));
    expect(t).toContain("Sığacık Pazarı");
    expect(t).not.toContain("durak");
  });
});
