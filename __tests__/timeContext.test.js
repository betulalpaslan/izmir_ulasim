import { getTimeContext } from "../utils/timeContext";

// 2026-09-07 pazartesi, 2026-09-05 cumartesi.
const pazartesi = (saat) => new Date(2026, 8, 7, saat, 0, 0);
const cumartesi = (saat) => new Date(2026, 8, 5, saat, 0, 0);

test("hafta içi yoğun saatler", () => {
  for (const saat of [7, 8, 9, 17, 18, 19]) {
    expect(getTimeContext(pazartesi(saat))).toMatch(/Yoğun saat/);
  }
});

test("hafta içi gündüz", () => {
  expect(getTimeContext(pazartesi(12))).toMatch(/Gündüz/);
});

test("hafta içi gece", () => {
  expect(getTimeContext(pazartesi(2))).toMatch(/Gece saati/);
  expect(getTimeContext(pazartesi(23))).toMatch(/Gece saati/);
});

test("hafta sonu gündüz ve gece", () => {
  expect(getTimeContext(cumartesi(10))).toMatch(/bisiklet/);
  expect(getTimeContext(cumartesi(2))).toMatch(/seferler seyrek/);
});

test("arada kalan saatler boş metin döner", () => {
  // 20:00-22:59 hafta içi: ne yoğun, ne gündüz, ne gece.
  expect(getTimeContext(pazartesi(21))).toBe("");
});

test("argümansız çağrı da bir metin üretir", () => {
  expect(typeof getTimeContext()).toBe("string");
});
