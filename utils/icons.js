// TEK İKON SÖZLÜĞÜ — web ile mobil aynı çizimi gösterir.
//
// İki arayüz aynı ikonu iki ayrı setten basıyordu: web Iconify'ı CDN'den
// çekip `streamline-cyber-color`u kullanıyordu, mobil lucide-react-native'i.
// Ad tabloları da ayrıydı (web'de `modeIcons`, mobilde AppIcon'daki ICONS),
// dolayısıyla MODE_STYLE renkleri paylaşırken ikonu paylaşamıyordu — web
// dosyasının kendi yorumu da bunu "paylaşılamıyor" diye yazıyordu. Sonuç:
// emülatörde açılan uygulama, tarayıcıdakinden başka bir otobüs gösteriyordu.
//
// Yön lucide'dan yana seçildi: mobil tarafın seti zaten oydu, lisansı ISC ve
// tek renkli olduğu için ikon rengi `color` ile veriliyor — böylece rota
// bacağının rengi ikona da geçiyor. Ters yön (Streamline'ı mobile taşımak)
// CDN'e bağımlı, çok renkli ve React Native'de karşılığı olmayan bir web
// bileşeni demekti.
//
// Tek kaynak burası:
//   • mobil → Components/AppIcon.js aynı anahtarları lucide bileşenlerine bağlar
//   • web   → tools/ikon-derle.js bu tablodaki ikonların ÇİZİM VERİSİNİ lucide
//             paketinden okuyup web/lucideIcons.js'e gömer (CDN yok, sürüm
//             kayması yok: iki taraf da kurulu lucide sürümünün geometrisi)
//
// Değerler lucide ikon adıdır (kebab). Yeni anahtarda ikisini de güncelle;
// __tests__/icons.test.js iki tarafın ayrışmasını yakalar.
//
// `train`: lucide 1.x'te `Train` adı `TramFront`'un TAKMA ADI — mobilde
// `train` ile `tram` yıllardır aynı çizimdi, banliyö/metro tramvaydan yalnız
// renkle ayrılıyordu. Ayrı ikon `train-front`.
export const ICON_SET = {
  alert: "triangle-alert",
  bike: "bike",
  briefcase: "briefcase-business",
  bus: "bus",
  car: "car",
  check: "check",
  chevronDown: "chevron-down",
  chevronUp: "chevron-up",
  clock: "clock",
  error: "circle-x",
  fast: "gauge",
  help: "circle-question-mark",
  home: "house",
  hourglass: "hourglass",
  info: "info",
  leaf: "leaf",
  locate: "locate-fixed",
  map: "map",
  mapPin: "map-pin",
  navigation: "navigation",
  parking: "square-parking",
  pause: "pause",
  play: "play",
  refresh: "refresh-cw",
  reset: "rotate-ccw",
  search: "search",
  settings: "settings",
  ship: "ship",
  shop: "shopping-cart",
  star: "star",
  student: "graduation-cap",
  sun: "sun",
  swap: "arrow-up-down",
  target: "target",
  train: "train-front",
  tram: "tram-front",
  transfer: "repeat",
  trash: "trash-2",
  user: "user-round",
  userCircle: "circle-user-round",
  userCog: "user-round-cog",
  walk: "footprints",
  work: "briefcase-business",
  x: "x",
};

// Bilinmeyen ad geldiğinde çizilen ikon. İki taraf da bunu kullanır; web
// eskiden soru işaretine, mobil harita iğnesine düşüyordu.
export const ICON_FALLBACK = "mapPin";

// Çizgi kalınlığı da paylaşılır: web 2 (lucide varsayılanı), mobil 2.2 idi ve
// yan yana konduğunda ikonlar farklı ağırlıkta görünüyordu.
export const ICON_STROKE = 2.2;
