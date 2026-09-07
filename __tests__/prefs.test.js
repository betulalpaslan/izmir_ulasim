import {
  tercihGovdesi, tercihleriOku, profilleriKur,
  PROFIL_SIRASI, ESKI_YOLCU_TIPI,
} from "../utils/prefs";
import { BILET_TARIFESI, calcJourneyFare } from "../utils/routeScoring";

// SÖZLEŞME TESTLERİ.
//
// Buradaki asıl derdimiz mantık değil, İSİM. Onboarding bir zamanlar
// `fareMultiplier` yazıyordu, okuyan taraf `fareBase` arıyordu ve arada
// hiçbir hata çıkmıyordu: kullanıcı "Öğrenci" seçiyor, kartta 35 ₺
// görüyordu. Aşağıdakiler o sessiz ayrışmayı gürültülü hale getiriyor.

const SOZLESME_ALANLARI = [
  "hasVehicle", "passengerType", "fareBase",
  "farePerBoarding", "visibleProfiles", "onboardingDone",
];

describe("tercihGovdesi — yazan taraf", () => {
  test("gövde tam olarak sözleşmedeki alanları taşır", () => {
    const govde = tercihGovdesi({ passengerType: "genc" });
    expect(Object.keys(govde).sort()).toEqual([...SOZLESME_ALANLARI].sort());
  });

  test("ücret alanları tarifeden türetilir, çağıran rakam vermez", () => {
    // fareMultiplier gibi tüketilmeyen bir alan sızmamalı.
    const govde = tercihGovdesi({ passengerType: "genc", fareMultiplier: 0.7 });
    expect(govde).not.toHaveProperty("fareMultiplier");
    expect(govde.fareBase).toBe(17.5);
    expect(govde.farePerBoarding).toBe(false);
  });

  test("kredi kartı her binişte ayrı ücretlendirilir", () => {
    const govde = tercihGovdesi({ passengerType: "kredikarti" });
    expect(govde.fareBase).toBe(39);
    expect(govde.farePerBoarding).toBe(true);
  });

  test("tanınmayan yolcu tipi tam bilete düşer", () => {
    expect(tercihGovdesi({ passengerType: "yok-boyle-bir-sey" }).passengerType).toBe("tam");
    expect(tercihGovdesi().passengerType).toBe("tam");
  });

  test("hasVehicle her zaman iki boolean taşır", () => {
    expect(tercihGovdesi({ hasVehicle: { bicycle: true } }).hasVehicle)
      .toEqual({ bicycle: true, car: false });
    expect(tercihGovdesi().hasVehicle).toEqual({ bicycle: false, car: false });
  });
});

describe("profilleriKur", () => {
  test("transit araç sahipliğinden bağımsız olarak hep açık", () => {
    expect(profilleriKur(null)).toEqual(["transit"]);
    expect(profilleriKur({ bicycle: false, car: false })).toEqual(["transit"]);
  });

  test("araçlar sabit sırayla ekleniyor", () => {
    // İki ekran iki ayrı sıra üretiyordu: yalnız arabası olan kullanıcıda
    // onboarding ["transit","car"], ayarlar ["car","transit"] yazıyordu.
    expect(profilleriKur({ car: true })).toEqual(["car", "transit"]);
    expect(profilleriKur({ bicycle: true })).toEqual(["bicycle", "transit"]);
    expect(profilleriKur({ bicycle: true, car: true })).toEqual(PROFIL_SIRASI);
  });
});

describe("tercihleriOku — okuyan taraf", () => {
  // ASIL NÖBETÇİ: onboarding'in yazdığı gövde, okuyan tarafta seçilen
  // biletin ücretini vermeli. Tarifedeki her bilet için.
  test.each(BILET_TARIFESI.map((b) => [b.id, b.base, b.perBoarding]))(
    "%s seçildiğinde okunan ücret %s ₺",
    (id, base, perBoarding) => {
      const yazilan = JSON.stringify(tercihGovdesi({ passengerType: id }));
      const okunan = tercihleriOku(yazilan);
      expect(okunan.passengerType).toBe(id);
      expect(okunan.fareBase).toBe(base);
      expect(okunan.farePerBoarding).toBe(perBoarding);
    }
  );

  test("öğrenci seçen kullanıcı tam bilet ücreti görmez", () => {
    const okunan = tercihleriOku(JSON.stringify(tercihGovdesi({ passengerType: "genc" })));
    expect(calcJourneyFare(1, okunan.fareBase, okunan.farePerBoarding)).toBe(17.5);
    expect(calcJourneyFare(2, okunan.fareBase, okunan.farePerBoarding)).toBe(17.5);
  });

  test("kayıt yoksa varsayılan tam bilet ve kurulum yapılmamış sayılır", () => {
    for (const bos of [null, undefined, "", "{bozuk json", "[]", 42]) {
      const okunan = tercihleriOku(bos);
      expect(okunan.passengerType).toBe("tam");
      expect(okunan.fareBase).toBe(35);
      expect(okunan.onboardingDone).toBe(false);
    }
  });

  test("onboardingDone yalnız true iken true", () => {
    expect(tercihleriOku('{"onboardingDone":true}').onboardingDone).toBe(true);
    expect(tercihleriOku('{"onboardingDone":"evet"}').onboardingDone).toBe(false);
    expect(tercihleriOku("{}").onboardingDone).toBe(false);
  });

  test("eski kimlikler tarifedeki karşılıklarına çevrilir", () => {
    // Eşleşmeyen kimlik ayarlar ekranında hiçbir kartı seçili
    // göstermiyordu — kullanıcıya ayarları silinmiş gibi görünüyordu.
    const beklenen = { student: 17.5, adult: 35, senior: 29 };
    for (const [eski, yeni] of Object.entries(ESKI_YOLCU_TIPI)) {
      const okunan = tercihleriOku({ passengerType: eski, onboardingDone: true });
      expect(okunan.passengerType).toBe(yeni);
      expect(okunan.fareBase).toBe(beklenen[eski]);
    }
  });

  test("eski gövdedeki fareMultiplier ücreti etkilemez", () => {
    const eski = { passengerType: "student", fareMultiplier: 0.7, onboardingDone: true };
    expect(tercihleriOku(eski).fareBase).toBe(17.5);
  });

  test("tarifede olmayan kimlikte kayıtlı rakam korunur", () => {
    const okunan = tercihleriOku({ passengerType: "ozel", fareBase: 12, farePerBoarding: true });
    expect(okunan.fareBase).toBe(12);
    expect(okunan.farePerBoarding).toBe(true);
  });

  test("kaydedilmiş profil listesi korunur, çöp girdiler süzülür", () => {
    expect(tercihleriOku({ visibleProfiles: ["car", "transit"] }).visibleProfiles)
      .toEqual(["car", "transit"]);
    expect(tercihleriOku({ visibleProfiles: ["ucak", "transit"] }).visibleProfiles)
      .toEqual(["transit"]);
    // Tamamen geçersizse hasVehicle'dan türetilene düşülür.
    expect(tercihleriOku({ visibleProfiles: ["ucak"], hasVehicle: { bicycle: true } }).visibleProfiles)
      .toEqual(["bicycle", "transit"]);
  });

  test("okuma çıktısı yeniden yazılabilir — gövde dolaşımda büyümüyor", () => {
    const bir = tercihleriOku(JSON.stringify(tercihGovdesi({ passengerType: "ogretmen", hasVehicle: { car: true } })));
    const iki = tercihleriOku(JSON.stringify(tercihGovdesi(bir)));
    expect(iki).toEqual(bir);
  });
});
