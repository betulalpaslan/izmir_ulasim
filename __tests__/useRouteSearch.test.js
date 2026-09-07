import { act, create } from "react-test-renderer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouteSearch } from "../hooks/useRouteSearch";
import { fetchRoute as apiFetchRoute } from "../Services/routeService";

// Ağ tarafı tek bir sahteyle kesiliyor; geriye hook'un kendi kararları
// kalıyor: MOD SAFLIĞI filtresi ve hangi hata metninin seçildiği.
jest.mock("../Services/routeService", () => ({ fetchRoute: jest.fn() }));
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const KONAK = { latitude: 38.418, longitude: 27.128 };
const BORNOVA = { latitude: 38.462, longitude: 27.216 };

const bacak = (mode, duration, distance, shortName = null) => ({
  mode, duration, distance,
  from: { name: `${mode} başlangıç`, lat: 38.42, lon: 27.13 },
  to: { name: `${mode} bitiş`, lat: 38.46, lon: 27.21 },
  ...(shortName ? { route: { shortName } } : {}),
});
const guzergah = (duration, legs) => ({ duration, legs });

// Yürüyüş + bisiklet + otobüs: her modun filtresinden geçebilecek gövde.
const BISIM_ROTASI = guzergah(2400, [
  bacak("WALK", 200, 250),
  bacak("BICYCLE_RENTAL", 700, 2600),
  bacak("BUS", 1300, 8000, "169"),
  bacak("WALK", 200, 250),
]);
const KENDI_BISIKLETI = guzergah(2400, [
  bacak("WALK", 150, 180),
  bacak("BICYCLE", 750, 2800),
  bacak("RAIL", 1300, 9000, "İZBAN"),
  bacak("WALK", 200, 250),
]);
const BISIKLETSIZ = guzergah(2600, [
  bacak("WALK", 600, 750),
  bacak("BUS", 1700, 9000, "169"),
  bacak("WALK", 300, 380),
]);

function surucu() {
  let son = null;
  function Probe() {
    son = useRouteSearch(35, false);
    return null;
  }
  act(() => { create(<Probe />); });
  return {
    get durum() { return son; },
    ara: async (...args) => {
      let sonuc;
      await act(async () => { sonuc = await son.fetchRoute(...args); });
      return sonuc;
    },
  };
}

let uyari;
beforeEach(async () => {
  apiFetchRoute.mockReset();
  await AsyncStorage.clear();
  uyari = jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => uyari.mockRestore());

describe("mod saflığı — BİSİM filtresi", () => {
  test("BİSİM modunda kiralık bisikletsiz güzergâh gösterilmiyor", () => {
    // Mod seçimi bir vaat: "BİSİM + Aktarma" seçen kullanıcıya BİSİM'siz
    // güzergâh gösterilmez, sebebi yazılır.
    apiFetchRoute.mockResolvedValue({ itineraries: [BISIKLETSIZ, KENDI_BISIKLETI] });
    const s = surucu();
    return s.ara(KONAK, BORNOVA, "bicycle", "", "", "RENT").then((r) => {
      expect(r).toBeNull();
      expect(s.durum.routes).toEqual([]);
      expect(s.durum.error).toMatch(/BİSİM'li bir güzergâh kurulamadı/);
    });
  });

  test("BİSİM modunda kiralık bacaklı güzergâh geçiyor", async () => {
    apiFetchRoute.mockResolvedValue({ itineraries: [BISIM_ROTASI, BISIKLETSIZ] });
    const s = surucu();
    const r = await s.ara(KONAK, BORNOVA, "bicycle", "", "", "RENT");
    expect(r.length).toBeGreaterThan(0);
    expect(s.durum.error).toBeNull();
  });

  test("kendi bisikleti modu hem BICYCLE hem BICYCLE_RENTAL kabul ediyor", async () => {
    const s = surucu();
    for (const rota of [KENDI_BISIKLETI, BISIM_ROTASI]) {
      apiFetchRoute.mockResolvedValue({ itineraries: [rota] });
      expect(await s.ara(KONAK, BORNOVA, "bicycle", "", "", "PARK")).not.toBeNull();
    }
  });

  test("kendi bisikleti modunda bisikletsiz güzergâh eleniyor", async () => {
    apiFetchRoute.mockResolvedValue({ itineraries: [BISIKLETSIZ] });
    const s = surucu();
    expect(await s.ara(KONAK, BORNOVA, "bicycle", "", "", "PARK")).toBeNull();
    expect(s.durum.error).toMatch(/bisikletli bir güzergâh kurulamadı/);
  });

  test("transit modunda filtre uygulanmıyor", async () => {
    apiFetchRoute.mockResolvedValue({ itineraries: [BISIKLETSIZ] });
    const s = surucu();
    expect(await s.ara(KONAK, BORNOVA, "transit")).not.toBeNull();
  });
});

describe("hata metni seçimi", () => {
  test("sunucunun kendi hatası olduğu gibi gösteriliyor", async () => {
    apiFetchRoute.mockResolvedValue({ error: "OTP grafiği yükleniyor" });
    const s = surucu();
    expect(await s.ara(KONAK, BORNOVA, "transit")).toBeNull();
    expect(s.durum.error).toBe("OTP grafiği yükleniyor");
  });

  test("boş liste + routingErrors → OTP'nin sebebi", async () => {
    apiFetchRoute.mockResolvedValue({
      itineraries: [],
      routingErrors: [{ description: "Başlangıç noktasına yakın durak yok" }, { code: "NO_TRANSIT_CONNECTION" }],
    });
    const s = surucu();
    await s.ara(KONAK, BORNOVA, "transit");
    expect(s.durum.error).toBe("Başlangıç noktasına yakın durak yok; NO_TRANSIT_CONNECTION");
  });

  test("boş liste + sebep yok → genel metin", async () => {
    apiFetchRoute.mockResolvedValue({ itineraries: [] });
    const s = surucu();
    await s.ara(KONAK, BORNOVA, "transit");
    expect(s.durum.error).toBe("Rota bulunamadı.");
  });

  test("ApiError'ın kullanıcı metni tercih ediliyor", async () => {
    const hata = new Error("502 Bad Gateway");
    hata.userMessage = "Rota sunucusu şu an yanıt vermiyor.";
    apiFetchRoute.mockRejectedValue(hata);
    const s = surucu();
    expect(await s.ara(KONAK, BORNOVA, "transit")).toBeNull();
    expect(s.durum.error).toBe("Rota sunucusu şu an yanıt vermiyor.");
  });

  test("kullanıcı metni yoksa genel bağlantı hatası", async () => {
    apiFetchRoute.mockRejectedValue(new Error("network down"));
    const s = surucu();
    await s.ara(KONAK, BORNOVA, "transit");
    expect(s.durum.error).toBe("Sunucuya bağlanılamadı.");
  });
});

describe("durum yönetimi", () => {
  test("yeni arama önceki hatayı ve rotaları temizliyor", async () => {
    const s = surucu();
    apiFetchRoute.mockResolvedValue({ error: "ilk hata" });
    await s.ara(KONAK, BORNOVA, "transit");
    expect(s.durum.error).toBe("ilk hata");

    apiFetchRoute.mockResolvedValue({ itineraries: [BISIKLETSIZ] });
    await s.ara(KONAK, BORNOVA, "transit");
    expect(s.durum.error).toBeNull();
    expect(s.durum.routes.length).toBeGreaterThan(0);
  });

  test("clearRoute her şeyi sıfırlıyor", async () => {
    apiFetchRoute.mockResolvedValue({ itineraries: [BISIKLETSIZ] });
    const s = surucu();
    await s.ara(KONAK, BORNOVA, "transit");
    expect(s.durum.routes.length).toBeGreaterThan(0);

    act(() => { s.durum.clearRoute(); });
    expect(s.durum.routes).toEqual([]);
    expect(s.durum.error).toBeNull();
    expect(s.durum.notice).toBeNull();
    expect(s.durum.modBos).toBeNull();
  });

  test("arama bittiğinde loading kapanıyor — hata yolunda da", async () => {
    apiFetchRoute.mockRejectedValue(new Error("network down"));
    const s = surucu();
    await s.ara(KONAK, BORNOVA, "transit");
    expect(s.durum.loading).toBe(false);
  });

  test("başarılı arama geçmişe yazılıyor", async () => {
    apiFetchRoute.mockResolvedValue({ itineraries: [BISIKLETSIZ] });
    const s = surucu();
    await s.ara(KONAK, BORNOVA, "transit", "Konak", "Bornova");
    const gecmis = JSON.parse(await AsyncStorage.getItem("routeHistory"));
    expect(gecmis[0]).toMatchObject({ originName: "Konak", destName: "Bornova", mode: "transit" });
  });

  test("başarısız arama geçmişe yazılmıyor", async () => {
    apiFetchRoute.mockResolvedValue({ itineraries: [] });
    const s = surucu();
    await s.ara(KONAK, BORNOVA, "transit", "Konak", "Bornova");
    expect(await AsyncStorage.getItem("routeHistory")).toBeNull();
  });
});
