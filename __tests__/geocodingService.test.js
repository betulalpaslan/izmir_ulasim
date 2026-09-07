import { searchAddress, aramayiIptalEt } from "../Services/geocodingService";

const yanit = (results) => ({ ok: true, status: 200, json: async () => ({ results }) });

beforeEach(() => {
  jest.useFakeTimers();
  global.fetch = jest.fn(async () => yanit([{ place_id: "ph_1", display_name: "Konak, İzmir", lat: "38.4", lon: "27.1" }]));
});
afterEach(() => {
  jest.useRealTimers();
  global.fetch = undefined;
});

describe("searchAddress", () => {
  // "ko" yazınca Konak çıkmalı. Eskiden 3 harf şarttı ve kısa yer adları
  // hiç aranamıyordu.
  test("iki harf aranır", async () => {
    const cb = jest.fn();
    searchAddress("ko", cb);
    jest.runAllTimers();
    await Promise.resolve(); await Promise.resolve();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(decodeURIComponent(global.fetch.mock.calls[0][0])).toContain("/geocode?q=ko");
  });

  test("tek harfte ağa çıkılmaz ve liste temizlenir", () => {
    const cb = jest.fn();
    searchAddress("k", cb);
    jest.runAllTimers();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(cb).toHaveBeenCalledWith([]);
  });

  test("boşluk kırpılır", () => {
    const cb = jest.fn();
    searchAddress("  k  ", cb);
    jest.runAllTimers();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  // Her tuşta istek atılmamalı; kullanıcı yazmayı bırakınca tek istek gider.
  test("hızlı yazımda yalnızca son sorgu istek atar", async () => {
    const cb = jest.fn();
    searchAddress("ko", cb);
    jest.advanceTimersByTime(100);
    searchAddress("kon", cb);
    jest.advanceTimersByTime(100);
    searchAddress("kona", cb);
    jest.runAllTimers();
    await Promise.resolve(); await Promise.resolve();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(decodeURIComponent(global.fetch.mock.calls[0][0])).toContain("q=kona");
  });

  test("sonuçlar callback'e verilir", async () => {
    const cb = jest.fn();
    searchAddress("konak", cb);
    jest.runAllTimers();
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(cb).toHaveBeenCalledWith([expect.objectContaining({ display_name: "Konak, İzmir" })]);
  });

  test("hata durumunda boş liste, çökme yok", async () => {
    global.fetch = jest.fn(async () => { throw new TypeError("Network request failed"); });
    jest.spyOn(console, "warn").mockImplementation(() => {});
    const cb = jest.fn();
    searchAddress("konak", cb);
    jest.runAllTimers();
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(cb).toHaveBeenCalledWith([]);
    console.warn.mockRestore();
  });
});

// Cevabı elimizde tutan fetch: istek "uçuşta" kalır, biz çözene kadar dönmez.
function bekleyenFetch() {
  let cozumle;
  global.fetch = jest.fn(() => new Promise((r) => { cozumle = r; }));
  return (results) => cozumle(yanit(results));
}

const KONAK = { place_id: "ph_1", display_name: "Konak, İzmir", lat: "38.4", lon: "27.1" };

// Mikrogörevlerin akması için: apiGet içinde fetch -> res.json -> searchAddress
// zinciri birkaç tick sürüyor.
const akit = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

describe("aramayiIptalEt", () => {
  // Sayaç yalnız "benden sonra yeni arama başladı mı" diye bakıyordu. Kullanıcı
  // Başlangıç'a yazıp cevap gelmeden Varış kutusuna dokunduğunda yeni arama
  // olmadığı için eski cevap geçerli sayılıyor ve Varış'ın altında açılıyordu;
  // dokunulduğunda Başlangıç için aranan yer varışa yazılıyordu.
  test("iptal edilen aramanın cevabı callback'e ulaşmaz", async () => {
    const cevapla = bekleyenFetch();
    const cb = jest.fn();

    searchAddress("konak", cb);
    jest.advanceTimersByTime(250);   // istek yola çıktı
    await Promise.resolve();

    aramayiIptalEt();                // kullanıcı diğer kutuya geçti

    cevapla([KONAK]);
    await akit();

    expect(cb).not.toHaveBeenCalled();
  });

  // Aynı boşluk silme yönünde de vardı: "konak" yazılıp istek uçarken harfler
  // silinince liste boşaltılıyor, ama eski cevap dönüp onu yeniden dolduruyordu.
  test("sorgu iki harfin altına düşünce uçuştaki cevap listeyi doldurmaz", async () => {
    const cevapla = bekleyenFetch();
    const cb = jest.fn();

    searchAddress("konak", cb);
    jest.advanceTimersByTime(250);
    await Promise.resolve();

    searchAddress("k", cb);          // kullanıcı sildi
    expect(cb).toHaveBeenCalledWith([]);

    cevapla([KONAK]);
    await akit();

    expect(cb).toHaveBeenCalledTimes(1);   // yalnız boşaltma; Konak sonuçları gelmedi
  });

  // İptal sayacı ilerlettiği için bir sonraki aramanın kendini geçersiz
  // saymadığından emin ol.
  test("iptalden sonra yeni arama yine sonuç döndürür", async () => {
    aramayiIptalEt();
    const cb = jest.fn();
    searchAddress("konak", cb);
    jest.advanceTimersByTime(250);
    await akit();
    expect(cb).toHaveBeenCalledWith([expect.objectContaining({ display_name: "Konak, İzmir" })]);
  });
});
