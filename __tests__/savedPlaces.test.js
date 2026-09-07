import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  KAYITLI_YERLER_VARSAYILAN, KAYITLI_YERLER_ANAHTARI,
  kayitliYerleriBirlestir, kayitliYerleriOku, kayitliYerleriYaz, yeriAyarla,
} from "../utils/savedPlaces";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const ADRES = { coord: { latitude: 38.42, longitude: 27.13 }, name: "Konak" };

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("kayitliYerleriBirlestir", () => {
  test("liste tanımdan gelir, kayıttan yalnız adres taşınır", () => {
    const birlesik = kayitliYerleriBirlestir([{ id: "home", address: ADRES }]);
    expect(birlesik).toHaveLength(KAYITLI_YERLER_VARSAYILAN.length);
    expect(birlesik.find((p) => p.id === "home").address).toEqual(ADRES);
    expect(birlesik.find((p) => p.id === "work").address).toBeNull();
  });

  test("kayıttaki etiket ve ikon tanımı ezmiyor", () => {
    // Listeye beşinci bir yer eklendiğinde eski kurulumlarda da görünsün
    // diye tanım esas alınıyor.
    const birlesik = kayitliYerleriBirlestir([
      { id: "home", icon: "eski-ikon", label: "Eski Ev", address: ADRES },
    ]);
    const ev = birlesik.find((p) => p.id === "home");
    expect(ev.label).toBe("Ev");
    expect(ev.icon).toBe("home");
  });

  test("bozuk kayıt varsayılana düşer", () => {
    for (const bozuk of [null, undefined, {}, "liste değil"]) {
      expect(kayitliYerleriBirlestir(bozuk)).toEqual(KAYITLI_YERLER_VARSAYILAN);
    }
    expect(kayitliYerleriBirlestir([null, { id: "home" }])).toEqual(KAYITLI_YERLER_VARSAYILAN);
  });
});

describe("yeriAyarla", () => {
  test("yalnız hedef yeri değiştirir", () => {
    const sonuc = yeriAyarla(KAYITLI_YERLER_VARSAYILAN, "work", ADRES);
    expect(sonuc.find((p) => p.id === "work").address).toEqual(ADRES);
    expect(sonuc.filter((p) => p.address)).toHaveLength(1);
    // Girdi listesi değişmemeli.
    expect(KAYITLI_YERLER_VARSAYILAN.every((p) => p.address === null)).toBe(true);
  });

  test("null adres yeri temizler", () => {
    const dolu = yeriAyarla(KAYITLI_YERLER_VARSAYILAN, "work", ADRES);
    expect(yeriAyarla(dolu, "work", null).find((p) => p.id === "work").address).toBeNull();
  });
});

describe("disk", () => {
  test("yazılan liste aynen okunur", async () => {
    expect(await kayitliYerleriYaz(yeriAyarla(KAYITLI_YERLER_VARSAYILAN, "shop", ADRES))).toBe(true);
    const okunan = await kayitliYerleriOku();
    expect(okunan.find((p) => p.id === "shop").address).toEqual(ADRES);
  });

  test("kayıt yokken varsayılan liste", async () => {
    expect(await kayitliYerleriOku()).toEqual(KAYITLI_YERLER_VARSAYILAN);
  });

  test("bozuk JSON okumayı düşürmez", async () => {
    await AsyncStorage.setItem(KAYITLI_YERLER_ANAHTARI, "{bozuk");
    expect(await kayitliYerleriOku()).toEqual(KAYITLI_YERLER_VARSAYILAN);
  });

  test("yazma hatası false döner, sessizce yutulmaz", async () => {
    const orijinal = AsyncStorage.setItem;
    AsyncStorage.setItem = jest.fn().mockRejectedValue(new Error("disk dolu"));
    expect(await kayitliYerleriYaz(KAYITLI_YERLER_VARSAYILAN)).toBe(false);
    AsyncStorage.setItem = orijinal;
  });
});
