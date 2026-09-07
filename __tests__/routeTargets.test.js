import {
  BOS_HEDEFLER, hedefAlani, noktaYaz, hedefleriTakasla,
} from "../hooks/useRouteTargets";

const KONAK = { latitude: 38.418, longitude: 27.128 };
const BORNOVA = { latitude: 38.462, longitude: 27.216 };

describe("hedefAlani", () => {
  test("odaklanılmış alan varsa o kazanır", () => {
    expect(hedefAlani("origin", KONAK)).toBe("origin");
    expect(hedefAlani("dest", null)).toBe("dest");
  });

  test("odak yoksa boş uç doldurulur", () => {
    expect(hedefAlani(null, null)).toBe("origin");
    expect(hedefAlani(null, KONAK)).toBe("dest");
  });
});

describe("noktaYaz", () => {
  test("tek uç dolduğunda yolculuk hazır değil", () => {
    const { hedefler, hazir } = noktaYaz(BOS_HEDEFLER, "origin", KONAK, "Konak");
    expect(hazir).toBe(false);
    expect(hedefler).toMatchObject({ origin: KONAK, originText: "Konak", destination: null });
  });

  test("ikinci uç dolduğunda hazır", () => {
    const bir = noktaYaz(BOS_HEDEFLER, "origin", KONAK, "Konak").hedefler;
    const { hedefler, hazir } = noktaYaz(bir, "dest", BORNOVA, "Bornova");
    expect(hazir).toBe(true);
    expect(hedefler).toEqual({
      origin: KONAK, originText: "Konak",
      destination: BORNOVA, destText: "Bornova",
    });
  });

  test("girdi gövdesi değişmiyor", () => {
    noktaYaz(BOS_HEDEFLER, "origin", KONAK, "Konak");
    expect(BOS_HEDEFLER.origin).toBeNull();
  });

  test("dolu bir ucu yeniden yazmak yolculuğu hazır bırakır", () => {
    const dolu = { origin: KONAK, originText: "Konak", destination: BORNOVA, destText: "Bornova" };
    const { hazir, hedefler } = noktaYaz(dolu, "origin", BORNOVA, "Bornova 2");
    expect(hazir).toBe(true);
    expect(hedefler.originText).toBe("Bornova 2");
  });
});

describe("hedefleriTakasla", () => {
  test("koordinat ve metin birlikte yer değiştirir", () => {
    const dolu = { origin: KONAK, originText: "Konak", destination: BORNOVA, destText: "Bornova" };
    expect(hedefleriTakasla(dolu)).toEqual({
      origin: BORNOVA, originText: "Bornova",
      destination: KONAK, destText: "Konak",
    });
  });

  test("tek uç doluyken takas ucu karşıya taşır", () => {
    const yarim = { ...BOS_HEDEFLER, origin: KONAK, originText: "Konak" };
    expect(hedefleriTakasla(yarim)).toEqual({
      origin: null, originText: "",
      destination: KONAK, destText: "Konak",
    });
  });

  test("iki kez takas başa döner", () => {
    const dolu = { origin: KONAK, originText: "Konak", destination: BORNOVA, destText: "Bornova" };
    expect(hedefleriTakasla(hedefleriTakasla(dolu))).toEqual(dolu);
  });
});
