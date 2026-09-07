import { katmanPlani, BISIM_BOS } from "../hooks/useMapLayers";

// Hangi katmanın yükleneceği saf bir kural: harita, ağ, kamera yok.
describe("katmanPlani", () => {
  test("transit hiçbir katman açmaz", () => {
    expect(katmanPlani("transit", "PARK", null).hedef).toBeNull();
    expect(katmanPlani("transit", "RENT", "park_and_ride").hedef).toBeNull();
  });

  test("bisiklet — BİSİM ile kişisel bisiklet ayrı katman", () => {
    expect(katmanPlani("bicycle", "RENT", null)).toMatchObject({
      hedef: "bisim", ad: "BİSİM bölgeleri",
    });
    expect(katmanPlani("bicycle", "PARK", null)).toMatchObject({
      hedef: "bisikletPark", ad: "Bisiklet park noktaları",
    });
    // Bisiklet modu seçilmemişse de park noktaları gösterilir.
    expect(katmanPlani("bicycle", null, null).hedef).toBe("bisikletPark");
  });

  test("araba — otopark katmanı iki alt modda da açılır, kümesi değişir", () => {
    // P+R'de rotanın kullandığı otoparklar; düz sürüşte envanterin tamamı.
    expect(katmanPlani("car", null, "park_and_ride")).toMatchObject({
      hedef: "otopark", tumu: false, ad: "Park + Devam otoparkları",
    });
    expect(katmanPlani("car", null, null)).toMatchObject({
      hedef: "otopark", tumu: true, ad: "Otoparklar",
    });
  });

  test("araba modu bisiklet planını, bisiklet modu araba planını etkilemez", () => {
    // Efektin bağımlılığı plan kimliği: ilgisiz bir düğme katmanı yeniden
    // çektirmesin diye.
    expect(katmanPlani("bicycle", "RENT", "park_and_ride"))
      .toEqual(katmanPlani("bicycle", "RENT", null));
    expect(katmanPlani("car", "RENT", null)).toEqual(katmanPlani("car", "PARK", null));
  });

  test("her plan bir hata etiketi taşır", () => {
    // Kullanıcı "istasyon yok" ile "sunucuya ulaşılamıyor" farkını ancak
    // katmanın adıyla görüyor.
    for (const p of [["bicycle", "RENT", null], ["bicycle", "PARK", null], ["car", null, null]]) {
      expect(katmanPlani(...p).ad).toEqual(expect.any(String));
    }
  });
});

test("BİSİM boş hâli iki geometriyi de sıfırlar", () => {
  // `[]` bırakan bir temizlik hizmet alanını haritada asılı bırakıyordu.
  expect(BISIM_BOS).toEqual({ bolgeler: [], hizmetAlani: null });
});
