# İzmir Ulaşım

İzmir için çok modlu ulaşım navigasyon uygulaması. Toplu taşıma, bisiklet ve araç
güzergâhlarını tek arayüzde birleştirir; BİSİM bisiklet paylaşım sistemi ve
İZELMAN/İZUM otopark verileriyle gerçek zamanlı çalışır.

React Native (Expo) · OpenTripPlanner 2.8.1 · Node.js/Express

---

## Özellikler

| | |
|---|---|
| **6 ulaşım profili** | Toplu taşıma · Kendi bisikletim · BİSİM kirala · Bisiklet park + transit · Araba · Park & Ride |
| **Canlı navigasyon** | Konum takibi, takip kamerası, adım adım yönlendirme, rota dışı algılama ve yeniden hesaplama |
| **Akıllı rota sıralama** | Süre, yürüyüş mesafesi ve aktarma sayısını profil bazlı ağırlıklarla puanlar; Önerilen / En Hızlı / Az Aktarma / Çevreci olarak etiketler |
| **Gerçek ücret hesabı** | İzmirim Kart'ın 90 dakikalık aktarma hakkı ile kredi kartı tarifesi ayrı modellenir; 5 yolcu tipi |
| **Karbon tahmini** | Mod başına g/km katsayılarıyla yolculuk emisyonu |
| **Harita katmanları** | BİSİM istasyonları, bisiklet parkları, kapalı/yeraltı otoparklar, doluluk oranına göre renklenen P+R noktaları |
| **Adres arama** | Photon + Nominatim paralel sorgu, 400 ms debounce, yakın sonuçların tekilleştirilmesi |
| **Kişiselleştirme** | Kayıtlı adresler (Ev/İş/Okul/Alışveriş), son 20 rota geçmişi, açık/koyu tema, saat bağlamına göre ipuçları |

---

## Kurulum

```bash
npm install
cp .env.example .env      # anahtarları doldurun
npm start                 # Expo geliştirme sunucusu
```

| Komut | Ne yapar |
|-------|----------|
| `npm start` | Expo geliştirme sunucusu |
| `npm run android` | Android emülatör/cihaz |
| `npm run ios` | iOS simülatör/cihaz |
| `npm test` | Jest test paketi |
| `npm run test:watch` | Testleri izleme modunda çalıştırır |

### Ortam değişkenleri

Gizli değerler koda gömülmez; [.env.example](.env.example) şablonundan `.env` üretilir
ve [app.config.js](app.config.js) bunları derleme sırasında Expo yapılandırmasına enjekte eder.

| Değişken | Açıklama |
|----------|----------|
| `GOOGLE_MAPS_API_KEY` | Android'de `react-native-maps` için gerekli. Google Cloud'da **paket adı + SHA-1** ve yalnızca "Maps SDK for Android" ile kısıtlanmalıdır. |
| `EXPO_PUBLIC_API_URL` | Backend adresi. Boşsa Railway'deki dağıtım kullanılır. |

---

## Mimari

```
Uygulama (Expo)                    Backend (Railway)
┌──────────────────────┐          ┌─────────────────────────┐
│ Screens/  Components/│          │ Express :3000           │
│ hooks/    utils/     │──REST───▶│  ├─ /get-route          │
│ Services/            │          │  ├─ /bisim/gbfs/*       │
└──────────┬───────────┘          │  └─ /parking/feed       │
           │                      │         │ GraphQL       │
           │ Photon / Nominatim   │  OpenTripPlanner :8080  │
           └─ (doğrudan geocoding)│  (İzmir GTFS + graph)   │
                                  └─────────────────────────┘
```

Uygulama yalnızca REST konuşur; OTP'nin GraphQL katmanı backend'in içinde kalır.
Backend, BİSİM verisini **GBFS 2.3** feed'ine, otopark verisini OTP'nin **PARK_API**
biçimine çevirir; OTP bu feed'leri dakikada bir çekerek graph'ını canlı doluluk
bilgisiyle günceller. P+R ve bisiklet-park güzergâhları bu sayede mümkün olur.

### Katmanlar

| Dizin | Sorumluluk |
|-------|-----------|
| `Screens/` | Ekranlar — durum yönetimi ve orkestrasyon |
| `Components/` | Sunum bileşenleri: arama paneli, rota kartları, harita katmanları, navigasyon paneli |
| `hooks/` | Yan etkiler: rota arama, konum takibi, navigasyon ilerlemesi, ayarlar |
| `Services/` | Ağ çağrıları: backend, Overpass, geocoding |
| `utils/` | **Saf mantık** — rota puanlama, navigasyon matematiği, geometri, tema |
| `__tests__/` | Jest testleri |

İş mantığı bilinçli olarak React'ten ayrı tutulur: puanlama, ücret ve navigasyon
hesapları `utils/` altındaki saf fonksiyonlarda yaşar, bu yüzden cihaz veya ağ
olmadan doğrudan test edilebilir.

### Rota puanlama

OTP en fazla 8 güzergâh döndürür; uygulama bunları yeniden puanlar
([utils/routeScoring.js](utils/routeScoring.js)):

```
skor = süre(dk) × 1
     + toplam_yürüyüş(km) × ağırlık
     + aktarma_sayısı × ceza
     + eşiği_aşan_yürüyüş(km) × ceza
```

Ağırlıklar profile göre değişir — bisikletli kullanıcı için 600 m'lik bir yürüyüş
bacağı çok, toplu taşıma kullanıcısı için 2 km'ye kadar kabul edilebilir. Eşiği aşan
tüm güzergâhlar elenir; hepsi elenirse en iyi puanlı olan yine de gösterilir
(kullanıcı boş ekran görmez).

### Navigasyon

[utils/navigation.js](utils/navigation.js) konumu rotaya oturtur (nokta-segment izdüşümü),
kalan mesafeyi ve süreyi hesaplar. Kalan süre **bacak bacak** hesaplanır — yürüyüş ile
metronun hızı çok farklı olduğundan mesafeye orantılı tahmin yanıltıcı olur.
Rotadan 60 m sapma rota dışı sayılır, ancak tek bir hatalı GPS okuması alarm vermesin
diye 3 ardışık ölçüm beklenir.

---

## Testler

```bash
npm test
```

75 test, dört paket: geometri ve biçimlendirme, navigasyon ilerlemesi, rota
puanlama/ücret/karbon, polyline çözümleme. Testler saf mantığa odaklanır; ağ, harita
ve depolama katmanları kapsam dışıdır.

Manuel test senaryoları için: [STD_İzmir_Ulasim.md](STD_İzmir_Ulasim.md) (Yazılım Test Belgesi,
17 işlevsel özellik grubu için kara kutu senaryoları).

---

## Veri kaynakları

| Kaynak | Kullanım |
|--------|----------|
| İzmir GTFS | OTP graph'ı — hat, durak ve sefer verisi |
| İZULAŞ BİSİM API | Bisiklet paylaşım istasyonları ve doluluk (GBFS'e çevrilir) |
| İZELMAN / İZUM API | Otopark kapasitesi ve doluluk (PARK_API'ye çevrilir) |
| OpenStreetMap (Overpass) | Bisiklet parkları, kapalı/yeraltı otoparklar |
| Photon / Nominatim | Adres arama ve otomatik tamamlama |

Tüm kaynaklar herkese açık ve kimlik doğrulaması gerektirmez.
