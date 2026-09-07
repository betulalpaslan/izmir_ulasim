import { themes, getTheme, temaSec } from "../utils/theme";

// Sıra: KAYITLI TERCİH → CİHAZ AYARI → koyu.
describe("temaSec", () => {
  test("kayıtlı tercih cihaz ayarını yener", () => {
    expect(temaSec("light", "dark")).toBe("light");
    expect(temaSec("dark", "light")).toBe("dark");
  });

  test("tercih yoksa cihaz ayarı geçerli", () => {
    expect(temaSec(null, "light")).toBe("light");
    expect(temaSec(undefined, "dark")).toBe("dark");
  });

  test("ikisi de yoksa koyu", () => {
    expect(temaSec(null, null)).toBe("dark");
    expect(temaSec(null, undefined)).toBe("dark");
  });

  test("tanınmayan değerler yok sayılır", () => {
    expect(temaSec("mavi", "light")).toBe("light");
    expect(temaSec("mavi", "sepya")).toBe("dark");
  });
});

describe("palet", () => {
  // Ekranlar artık rengi yalnız token üzerinden alıyor; bir tokenin
  // yalnız tek temada tanımlı olması sessiz bir `undefined` demek.
  test("iki tema aynı tokenleri taşıyor", () => {
    expect(Object.keys(themes.light).sort()).toEqual(Object.keys(themes.dark).sort());
  });

  test("hiçbir token boş değil", () => {
    for (const [ad, palet] of Object.entries(themes)) {
      for (const [token, deger] of Object.entries(palet)) {
        expect(`${ad}.${token}=${deger}`).not.toMatch(/=(undefined|null|)$/);
      }
    }
  });

  test("tanınmayan mod koyuya düşer", () => {
    expect(getTheme("sepya")).toBe(themes.dark);
    expect(getTheme(undefined)).toBe(themes.dark);
  });
});
