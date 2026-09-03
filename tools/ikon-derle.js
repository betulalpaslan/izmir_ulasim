#!/usr/bin/env node
// utils/icons.js'teki ikonların ÇİZİM VERİSİNİ web için gömülü bir dosyaya
// derler: web/lucideIcons.js.
//
// Neden gömüyoruz da CDN'den çekmiyoruz: web eskiden Iconify'ı jsdelivr'dan
// yüklüyordu, yani (a) ikonlar mobilinkinden başka bir setti, (b) ağ olmadan
// arayüz ikonsuz açılıyordu, (c) set uzakta sürüm atladığında iki taraf
// sessizce ayrışabiliyordu. Veri artık mobilin KULLANDIĞI lucide paketinden,
// yani package.json'daki sürümden okunuyor: iki arayüz aynı geometriyi çizer.
//
// ÜRETİLEN DOSYA elle düzenlenmez. Yeniden üretmek: npm run ikon
const fs = require("fs");
const path = require("path");

const KOK = path.join(__dirname, "..");
const KAYNAK = path.join(KOK, "utils", "icons.js");
const LUCIDE = path.join(KOK, "node_modules", "lucide-react-native", "dist", "esm", "icons");
const HEDEF = path.join(KOK, "web", "lucideIcons.js");

for (const [ad, yol] of [["utils/icons.js", KAYNAK], ["lucide-react-native", LUCIDE]]) {
  if (!fs.existsSync(yol)) {
    console.error(`${ad} bulunamadı: ${yol}`);
    if (yol === LUCIDE) console.error("Önce: npm install");
    process.exit(1);
  }
}

// icons.js saf bir tablo; `export` sözcüğünü atınca klasik script gibi okunur.
const tabloKaynak = fs.readFileSync(KAYNAK, "utf8").replace(/^export\s+const\s/gm, "const ");
const { ICON_SET, ICON_FALLBACK, ICON_STROKE } = new Function(
  `${tabloKaynak}\nreturn { ICON_SET, ICON_FALLBACK, ICON_STROKE };`
)();

const lucideSurumu = require(path.join(KOK, "node_modules", "lucide-react-native", "package.json")).version;

// lucide'ın ikon modülü: createLucideIcon("Ad", [ ...düğümler ]) — düğüm
// dizisi düz bir değişmez (literal), ayrıştırmak için son "]);" yeter.
function cizimVerisi(lucideAdi) {
  const dosya = path.join(LUCIDE, `${lucideAdi}.mjs`);
  if (!fs.existsSync(dosya)) return null;
  const metin = fs.readFileSync(dosya, "utf8");
  const bas = metin.indexOf("[", metin.indexOf("createLucideIcon("));
  const son = metin.lastIndexOf("]);");
  if (bas < 0 || son < 0) return null;
  return new Function(`return ${metin.slice(bas, son + 1)};`)();
}

const kebap = (k) => k.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

function govde(dugumler) {
  return dugumler
    .map(([etiket, ozellikler]) => {
      const nitelikler = Object.entries(ozellikler)
        .filter(([k]) => k !== "key")           // React'in liste anahtarı, SVG'de karşılığı yok
        .map(([k, v]) => `${kebap(k)}="${v}"`)
        .join(" ");
      return `<${etiket} ${nitelikler}/>`;
    })
    .join("");
}

const govdeler = {};
const eksik = [];
for (const [anahtar, lucideAdi] of Object.entries(ICON_SET)) {
  const veri = cizimVerisi(lucideAdi);
  if (!veri) { eksik.push(`${anahtar} → ${lucideAdi}`); continue; }
  govdeler[anahtar] = govde(veri);
}

if (eksik.length) {
  console.error("lucide'da karşılığı olmayan ikon(lar):\n  " + eksik.join("\n  "));
  console.error("Ad lucide sürümleri arasında değişmiş olabilir; utils/icons.js'i güncelle.");
  process.exit(1);
}

const cikti = `/* OTOMATİK ÜRETİLDİ — elle düzenleme.
   Kaynak: utils/icons.js + lucide-react-native ${lucideSurumu}
   Yeniden üretmek: npm run ikon
   Mobil uygulama aynı tablodan besleniyor (Components/AppIcon.js). */
(function (global) {
"use strict";
const GOVDE = ${JSON.stringify(govdeler, null, 0).replace(/","/g, '",\n  "').replace(/^\{/, "{\n  ").replace(/\}$/, "\n}")};
const YEDEK = ${JSON.stringify(ICON_FALLBACK)};
const KALINLIK = ${ICON_STROKE};

/* Boyut CSS'ten gelir: ikon 1em × 1em çizilir, yani ikonu saran kuralın
   font-size'ı onu da büyütür. Iconify web bileşeni de böyle davranıyordu,
   mevcut .leg-icon / .profile-tab .icon kuralları olduğu gibi çalışsın diye
   aynı davranış korundu. Renk currentColor: rota bacağının rengi ikona
   geçer — mobilde AppIcon'a verilen \`color\` ile aynı davranış. */
function svg(ad, sinif) {
  const govde = GOVDE[ad] || GOVDE[YEDEK];
  return '<svg class="ikon' + (sinif ? " " + sinif : "") + '" viewBox="0 0 24 24" ' +
    'fill="none" stroke="currentColor" stroke-width="${ICON_STROKE}" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + govde + '</svg>';
}

/* Statik işaretlemede <i data-ikon="bus"></i> yazılır, açılışta burada SVG'ye
   dönüşür. Dinamik üretilen parçalar svg()'yi doğrudan çağırır. */
function ciz(kok) {
  (kok || document).querySelectorAll("[data-ikon]").forEach((el) => {
    el.outerHTML = svg(el.getAttribute("data-ikon"), el.getAttribute("class") || "");
  });
}

global.LucideIkon = { GOVDE: GOVDE, svg: svg, ciz: ciz, YEDEK: YEDEK, KALINLIK: KALINLIK };
})(typeof window !== "undefined" ? window : globalThis);
`;

fs.writeFileSync(HEDEF, cikti, "utf8");

// Üretilen dosya gerçekten çalışıyor mu — sessiz bozuk çıktı üretmeyelim.
const sahte = {};
new Function("window", "document", cikti)(sahte, undefined);
const sayi = Object.keys(sahte.LucideIkon.GOVDE).length;
console.log(`  → ${HEDEF}`);
console.log(`derlendi: ${sayi} ikon (lucide ${lucideSurumu}), ${Math.round(cikti.length / 1024)} KB`);
