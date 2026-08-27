import { searchAddress } from "../Services/geocodingService";

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
