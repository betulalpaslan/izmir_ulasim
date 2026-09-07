import { act, create } from "react-test-renderer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSettings, ALL_PROFILES } from "../hooks/useSettings";
import { tercihGovdesi } from "../utils/prefs";
import { KAYITLI_YERLER_VARSAYILAN } from "../utils/savedPlaces";

// useSettings diskten okuyup ekranın kullandığı değerleri üretiyor —
// bulgu 01 tam olarak buradaydı: onboarding'in yazdığı gövdeyle ücret
// okunuyor, ama alan adları tutmadığı için herkes varsayılanı görüyordu.
// Disk AsyncStorage sahtesiyle, odak etkisi normal bir efektle taklit
// ediliyor; harita, navigasyon veya ağ gerekmiyor.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect) => require("react").useEffect(effect, []),
}));

function Probe({ al }) {
  al(useSettings());
  return null;
}

async function ayarlar() {
  let son = null;
  await act(async () => {
    create(<Probe al={(v) => { son = v; }} />);
  });
  return son;
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("useSettings — ücret", () => {
  test("kayıt yokken tam bilet varsayılanı", async () => {
    const { fareBase, farePerBoarding } = await ayarlar();
    expect(fareBase).toBe(35);
    expect(farePerBoarding).toBe(false);
  });

  // NÖBETÇİ: onboarding'de "Genç Kart" seçen kullanıcı 17,50 ₺ görmeli.
  // Bu test kırmızıya dönerse ya alan adı ya tarife ayrışmış demektir.
  test("onboarding'in yazdığı gövde seçilen bileti verir", async () => {
    await AsyncStorage.setItem(
      "userPrefs",
      JSON.stringify(tercihGovdesi({ passengerType: "genc" }))
    );
    const { fareBase, farePerBoarding } = await ayarlar();
    expect(fareBase).toBe(17.5);
    expect(farePerBoarding).toBe(false);
  });

  test("kredi kartı seçiminde her biniş ayrı ücret", async () => {
    await AsyncStorage.setItem(
      "userPrefs",
      JSON.stringify(tercihGovdesi({ passengerType: "kredikarti" }))
    );
    const { fareBase, farePerBoarding } = await ayarlar();
    expect(fareBase).toBe(39);
    expect(farePerBoarding).toBe(true);
  });

  test("eski kimlik yazan kurulumlar da doğru ücreti okur", async () => {
    await AsyncStorage.setItem(
      "userPrefs",
      JSON.stringify({ passengerType: "student", fareMultiplier: 0.7, onboardingDone: true })
    );
    expect((await ayarlar()).fareBase).toBe(17.5);
  });

  test("bozuk kayıt varsayılanı bozmaz", async () => {
    await AsyncStorage.setItem("userPrefs", "{bozuk");
    expect((await ayarlar()).fareBase).toBe(35);
  });
});

describe("useSettings — profiller", () => {
  test("kayıt yokken hepsi görünür", async () => {
    expect((await ayarlar()).profiles).toEqual(ALL_PROFILES);
  });

  test("araçsız kullanıcıda yalnız transit kalır", async () => {
    await AsyncStorage.setItem("userPrefs", JSON.stringify(tercihGovdesi({})));
    const { profiles } = await ayarlar();
    expect(profiles.map((p) => p.id)).toEqual(["transit"]);
  });

  test("bisiklet + araba seçimi sırayı korur", async () => {
    await AsyncStorage.setItem(
      "userPrefs",
      JSON.stringify(tercihGovdesi({ hasVehicle: { bicycle: true, car: true } }))
    );
    const { profiles } = await ayarlar();
    expect(profiles.map((p) => p.id)).toEqual(["bicycle", "car", "transit"]);
  });

  test("tanınmayan profil listesi ekranı boş bırakmaz", async () => {
    // Süzülünce hiçbir şey kalmıyor; araç kaydı da yok, dolayısıyla
    // herkesin sahip olduğu tek profile düşülüyor.
    await AsyncStorage.setItem("userPrefs", JSON.stringify({ visibleProfiles: ["ucak"] }));
    expect((await ayarlar()).profiles.map((p) => p.id)).toEqual(["transit"]);
  });

  test("profil listesi hiçbir durumda boş dönmüyor", async () => {
    for (const govde of [{}, { visibleProfiles: [] }, { visibleProfiles: null }, { hasVehicle: null }]) {
      await AsyncStorage.setItem("userPrefs", JSON.stringify(govde));
      expect((await ayarlar()).profiles.length).toBeGreaterThan(0);
    }
  });
});

describe("useSettings — kayıtlı yerler", () => {
  test("kayıt yokken varsayılan liste", async () => {
    expect((await ayarlar()).savedPlaces).toEqual(KAYITLI_YERLER_VARSAYILAN);
  });

  test("kaydedilmiş adres okunur", async () => {
    await AsyncStorage.setItem("savedPlaces", JSON.stringify([
      { id: "home", icon: "home", label: "Ev", address: { coord: { latitude: 38.4, longitude: 27.1 }, name: "Konak" } },
    ]));
    const { savedPlaces } = await ayarlar();
    expect(savedPlaces.find((p) => p.id === "home").address.name).toBe("Konak");
    // Kayıtta olmayan yerler tanımdan tamamlanıyor.
    expect(savedPlaces).toHaveLength(KAYITLI_YERLER_VARSAYILAN.length);
  });

  test("savePlace diske yazar ve listeyi günceller", async () => {
    const { savePlace } = await ayarlar();
    let sonuc;
    await act(async () => {
      sonuc = await savePlace("work", { latitude: 38.46, longitude: 27.21 }, "Bornova");
    });
    expect(sonuc).toBe(true);
    const yazilan = JSON.parse(await AsyncStorage.getItem("savedPlaces"));
    expect(yazilan.find((p) => p.id === "work").address.name).toBe("Bornova");
  });

  test("disk yazamazsa savePlace false döner ve ekran değişmez", async () => {
    const { savePlace } = await ayarlar();
    const orijinal = AsyncStorage.setItem;
    AsyncStorage.setItem = jest.fn().mockRejectedValue(new Error("disk dolu"));
    let sonuc;
    await act(async () => {
      sonuc = await savePlace("work", { latitude: 38.46, longitude: 27.21 }, "Bornova");
    });
    AsyncStorage.setItem = orijinal;
    expect(sonuc).toBe(false);
    expect(await AsyncStorage.getItem("savedPlaces")).toBeNull();
  });
});
