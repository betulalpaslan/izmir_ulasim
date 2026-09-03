// İkon sözlüğünün iki tüketicisi var ve ayrışırlarsa kimse fark etmez:
// web'de ikon sessizce yedeğe (harita iğnesi) düşer, mobilde de öyle. Bu
// dosya tam olarak o sessiz ayrışmayı yakalar — zaten bir kez yaşandı:
// web Iconify'ın streamline setini, mobil lucide'ı basıyordu.
const fs = require("fs");
const path = require("path");

const KOK = path.join(__dirname, "..");
const oku = (...p) => fs.readFileSync(path.join(KOK, ...p), "utf8");

// utils/icons.js saf bir tablo; `export`u atınca klasik script gibi okunur.
// (İçe aktarmak yerine böyle okunuyor: bu dosya lucide/react-native'e
//  dokunmadan çalışsın, test ikon paketinin kurulumuna bağlı olmasın.)
const { ICON_SET, ICON_FALLBACK, ICON_STROKE } = new Function(
  oku("utils", "icons.js").replace(/^export\s+const\s/gm, "const ") +
  "\nreturn { ICON_SET, ICON_FALLBACK, ICON_STROKE };"
)();

// AppIcon'daki eşleme metinden okunuyor: JSX'i çalıştırmadan anahtarları görmek yeter.
function appIconAnahtarlari() {
  const kaynak = oku("Components", "AppIcon.js");
  const bas = kaynak.indexOf("const ICONS = {");
  const son = kaynak.indexOf("\n};", bas);
  expect(bas).toBeGreaterThan(-1);
  return kaynak
    .slice(bas, son)
    .split("\n")
    .map((satir) => satir.match(/^\s{2}([A-Za-z]+):\s/))
    .filter(Boolean)
    .map((m) => m[1]);
}

describe("ikon sözlüğü", () => {
  it("mobil eşlemesi ICON_SET ile birebir aynı anahtarları taşır", () => {
    expect(appIconAnahtarlari().sort()).toEqual(Object.keys(ICON_SET).sort());
  });

  it("yedek ikon sözlükte tanımlı", () => {
    expect(ICON_SET[ICON_FALLBACK]).toBeDefined();
  });

  it("web'e derlenen dosya her anahtarı içerir ve güncel", () => {
    const uretilen = oku("web", "lucideIcons.js");
    const sahte = {};
    new Function("window", uretilen)(sahte);
    // Eksik anahtar = web'de sessizce iğneye düşen ikon.
    expect(Object.keys(sahte.LucideIkon.GOVDE).sort()).toEqual(Object.keys(ICON_SET).sort());
    expect(sahte.LucideIkon.YEDEK).toBe(ICON_FALLBACK);
    expect(sahte.LucideIkon.KALINLIK).toBe(ICON_STROKE);
    // Boş gövde = ayrıştırma bozulmuş.
    for (const [ad, govde] of Object.entries(sahte.LucideIkon.GOVDE)) {
      expect(`${ad}: ${govde}`).toMatch(/<(path|circle|rect|line|polyline|polygon|ellipse)\b/);
    }
  });

  it("web arayüzü Iconify'a geri dönmemiş", () => {
    const web = oku("web", "index.html");
    // Ne custom element kaldı ne de CDN. (Yorumlarda "streamline" geçiyor:
    // neden bırakıldığını anlatıyorlar, aranan şey kullanım.)
    expect(web).not.toMatch(/<iconify-icon/);
    expect(web).not.toMatch(/icon="streamline/);
    expect(web).not.toMatch(/cdn\.jsdelivr\.net\/npm\/iconify/);
    expect(web).toMatch(/<script src="lucideIcons\.js"><\/script>/);
  });

  // Aşağıdakiler tek tek yazılmış ikon ADLARINI denetler. Ad yanlışsa hiçbir
  // yerde hata çıkmaz: iki taraf da sessizce yedeğe düşer, kullanıcı yalnız
  // "yanlış ikon" görür. Eski Streamline adları (bicycle-1, bus-2 …) tam da
  // böyle geride kalabilirdi.
  const bilinmeyenler = (metin, kalip) =>
    [...metin.matchAll(kalip)].map((m) => m[1]).filter((ad) => !(ad in ICON_SET));

  it("web'deki ikon adlarının hepsi sözlükte var", () => {
    const web = oku("web", "index.html");
    expect(bilinmeyenler(web, /data-ikon="([^"]+)"/g)).toEqual([]);
    expect(bilinmeyenler(web, /ikon\("([^"]+)"\)/g)).toEqual([]);
    expect(bilinmeyenler(web, /setStatus\((?:[^()]|\([^()]*\))*,\s*"([^"]+)"\s*\)/g)).toEqual([]);
  });

  it("mobildeki ikon adlarının hepsi sözlükte var", () => {
    for (const dosya of ["Components", "Screens"]) {
      for (const ad of fs.readdirSync(path.join(KOK, dosya))) {
        if (!ad.endsWith(".js")) continue;
        const kaynak = oku(dosya, ad);
        const bulunan = [
          ...bilinmeyenler(kaynak, /<AppIcon\s[^>]*name="([^"]+)"/g),
          ...bilinmeyenler(kaynak, /icon:\s*"([^"]+)"/g),
        ];
        expect({ dosya: `${dosya}/${ad}`, bilinmeyen: bulunan })
          .toEqual({ dosya: `${dosya}/${ad}`, bilinmeyen: [] });
      }
    }
  });

  it("MODE_STYLE'ın ikonları sözlükte var — iki arayüz mod ikonunu oradan okuyor", () => {
    const puanlama = oku("utils", "routeScoring.js");
    const govde = puanlama.slice(puanlama.indexOf("MODE_STYLE = {"), puanlama.indexOf("NON_TRANSIT_MODES"));
    expect(bilinmeyenler(govde, /icon:\s*"([^"]+)"/g)).toEqual([]);
  });
});
