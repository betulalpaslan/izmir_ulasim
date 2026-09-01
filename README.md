# İzmir Ulaşım

İzmir için çok modlu ulaşım navigasyon uygulaması. Toplu taşıma, bisiklet ve araç
güzergâhlarını tek arayüzde birleştirir; BİSİM bisiklet paylaşım sistemi ve
İZELMAN/İZUM otopark verileriyle gerçek zamanlı çalışır.

React Native (Expo) · OpenTripPlanner 2.8.1 · Node.js/Express

<!-- EKRAN GÖRÜNTÜLERİ
     docs/ekran-goruntuleri/ altına üç PNG koyup aşağıdaki tabloyu yorumdan
     çıkarın. Önerilen üçlü: (1) rota sonuç kartları, (2) harita üzerinde
     çizili çok modlu güzergâh, (3) BİSİM hizmet alanı katmanı.

| Rota seçenekleri | Harita | BİSİM katmanı |
|---|---|---|
| <img src="docs/ekran-goruntuleri/rotalar.png" width="240"> | <img src="docs/ekran-goruntuleri/harita.png" width="240"> | <img src="docs/ekran-goruntuleri/bisim.png" width="240"> |
-->

---

## Özellikler

| | |
|---|---|
| **5 ulaşım profili** | Toplu taşıma · BİSİM + aktarma · Bisikletim + aktarma · Araba · Park & Ride |
| **Canlı navigasyon** | Konum takibi, takip kamerası, adım adım yönlendirme, rota dışı algılama ve yeniden hesaplama |
| **Akıllı rota sıralama** | Süre, yürüyüş mesafesi ve aktarma sayısını profil bazlı ağırlıklarla puanlar; Önerilen / En Hızlı / Az Aktarma / Çevreci olarak etiketler |
| **Gerçek ücret hesabı** | İzmirim Kart'ın 90 dakikalık aktarma hakkı ile kredi kartı tarifesi ayrı modellenir; 5 bilet türü, üstüne BİSİM'in dakikalık kiralama tarifesi |
| **Karbon tahmini** | Mod başına g/km katsayılarıyla yolculuk emisyonu |
| **Harita katmanları** | BİSİM istasyonları, bisiklet parkları, kapalı/yeraltı otoparklar, doluluk oranına göre renklenen P+R noktaları |
| **Adres arama** | Photon + Nominatim paralel sorgu, 400 ms debounce, yakın sonuçların tekilleştirilmesi |
| **Kişiselleştirme** | Kayıtlı adresler (Ev/İş/Okul/Alışveriş), son 20 rota geçmişi, açık/koyu tema, saat bağlamına göre ipuçları |

Aynı puanlama ve ücret mantığını kullanan bir web arayüzü de var: [web/index.html](web/index.html).
Mobil ile ortak saf mantık `web/routeScoring.bundle.js` olarak paketlenir, yani iki
istemci aynı sıralamayı ve aynı tarifeyi gösterir.

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
| `utils/` | **Saf mantık** — rota puanlama, ücret, navigasyon matematiği, geometri, tema |
| `__tests__/` | Jest testleri |

İş mantığı bilinçli olarak React'ten ayrı tutulur: puanlama, ücret ve navigasyon
hesapları `utils/` altındaki saf fonksiyonlarda yaşar, bu yüzden cihaz veya ağ
olmadan doğrudan test edilebilir.

### Rota puanlama

OTP en fazla 8 güzergâh döndürür; uygulama bunları yeniden puanlar
([utils/routeScoring.js](utils/routeScoring.js)):

```
skor = süre(dk) × 1
     + toplam_yürüyüş(km)        × walkKm
     + aktarma_sayısı            × transferPts
     + hedefi_aşan_yürüyüş(km)   × overTargetKm
     + (en_uzun_bacak / tavan)²  × uzunBacakPts
```

Ağırlıklar profile göre değişir — bisikletli kullanıcı için 600 m'lik bir yürüyüş
bacağı çok, toplu taşıma kullanıcısı için 2 km'ye kadar kabul edilebilir.

Son terim toplam yürüyüşü değil **tek bir bacağı** ölçer ve karesel artar. Doğrusal
ceza tavanın hemen altındaki alanı korumuyordu: 19 dakikalık bir yürüyüş bacağı,
birkaç dakikalık süre avantajıyla listenin başına geçebiliyordu.

### Eleme: tercih ile vaat aynı şey değil

Bir güzergâhın elenmesinin iki ayrı sebebi var ve ikisi farklı davranır:

| | Kural | Aşılırsa |
|---|---|---|
| **Yürüyüş tavanı** | Tek bacakta 20 dakikadan uzun yürüyüş yok | Bu bir *tercihtir*, esner. Tavana uyan güzergâh varken uymayan gösterilmez; hiçbiri uymuyorsa en az yürüten adaylar `yuruyusZorunlu` işaretiyle gösterilir ve her iki istemci de bunu kullanıcıya yazar. |
| **Mod amacı** | Seçilen mod yolculuğun anlamlı bir payını taşımalı | Bu bir *vaattir*, esnemez. Hiçbir güzergâh seçilen modun işini yapmıyorsa liste **bilerek boş kalır** — "BİSİM" denip içinde BİSİM olmayan bir kart göstermek yanlış olurdu. |

Boş liste tek başına çıkmaz sokak olduğu için sebebi ölçülmüş sayıyla söylenir
("Bisiklet bu yolculuğu 21.4 dk uzatıyor") ve düz toplu taşıma alternatifi tek
dokunuşluk çıkış olarak sunulur. O alternatifin süresi backend'in zaten çalıştırdığı
sorgudan gelir; sorgu başarısızsa alan boş bırakılır, tahmin üretilmez.

### Ücret

İki ayrı kalem hesaplanır ve karta ayrı ayrı yazılır:

| | |
|---|---|
| **Toplu taşıma bileti** | Tam 35,00 ₺ · Genç Kart 17,50 ₺ · Öğretmen 23,50 ₺ · 60 Yaş 29,00 ₺ · Kredi/Banka Kartı 39,00 ₺ |
| **BİSİM kiralama** | İlk 5 dakika 10,00 ₺, sonraki her dakika 1,50 ₺ (1 saat = 92,50 ₺) |

İzmirim Kart'ta 90 dakika içindeki aktarmalar tek ücrete dahildir; kredi/banka
kartında aktarma hakkı yoktur, her biniş ayrı ücretlenir. Bu fark
`farePerBoarding` ile modellenir.

Kiralamada bloke edilen **47,50 ₺ ön provizyon toplama dahil edilmez** — tahsilat
değil, iade edilen bir blokedir; toplama eklemek kısa bir sürüşü kat kat pahalı
gösterirdi. Ayrı bir not olarak taşınır.

Tarife tek yerde tanımlıdır (`BILET_TARIFESI`, `BISIM_TARIFESI`) ve mobil ekranlar,
web arayüzü ve testler aynı kaynaktan okur.

### Navigasyon

[utils/navigation.js](utils/navigation.js) konumu rotaya oturtur (nokta-segment izdüşümü),
kalan mesafeyi ve süreyi hesaplar. Kalan süre **bacak bacak** hesaplanır — yürüyüş ile
metronun hızı çok farklı olduğundan mesafeye orantılı tahmin yanıltıcı olur.
Rotadan 60 m sapma rota dışı sayılır, ancak tek bir hatalı GPS okuması alarm vermesin
diye 3 ardışık ölçüm beklenir.

---

## Ölçülmüş kararlar

Bu projedeki ayar değerleri tahminle değil, senaryo matrisi (7 rota × 6 mod)
üzerinde ölçülerek konuldu. Öne çıkan dördü:

**GTFS'te `bikes_allowed` alanı ters girilmişti.** Bisikletin metroya, tramvaya ve
İZBAN'a bindirilebildiği güzergâhlar OTP'den hiç çıkmıyordu; feed otobüsleri
"bisiklet alınır" diye işaretliyor, bisiklet alan üç sistemi sessiz bırakıyordu.
Feed bir yama betiğiyle düzeltiliyor ve yama her feed tazelemesinde, graph yeniden
kurulmadan önce tekrar uygulanmalı.

**BİSİM istasyonlu değil, serbest bırakmalı bir sistem.** 11 bonus bölgesini GBFS'e
*istasyon* olarak yayınlamak OTP'ye docked bir sistem tarif ediyordu; Konak İskele →
Alsancak Garı'nda bisiklet en yakın istasyona bırakılıp kalan 1,3 km yürünüyordu.
`free_bike_status` + `return_constraint: free_floating` ile aynı yolculuk kapıya
kadar sürülüyor — 19 dakika, kapanış yürüyüşü yok.

**Park & Ride eşiği kalibre edildi.** "Transit ≥ araç" kuralı verinin ortasından
geçiyor ve gerçek P+R güzergâhlarını eliyordu (Narlıdere → Çiğli 200 metreyle
reddediliyordu). Transit ≥ 2 km olan 30 güzergâhın transit/araç oranı sıralandığında
0,17 ile 0,38 arasında boşluk var; eşik o boşluğun ortasına (0,3) kondu. Boş sonuç
veren senaryo 5'ten 4'e indi, çalışan senaryolarda hiçbir hızlı kart kaybolmadı.

**Düz bisiklet modu ölçümle kaldırıldı.** Baştan sona sürüş, Narlıdere → Çiğli'de
tek kart üretiyordu: 137 dakika, 33,5 km kesintisiz. Ayrıca `direct` bacaklar
aktarmalı adayları listeden dışarı itiyordu. Her iki bisiklet modunda da bisiklet
artık *erişim aracıdır*, yolculuğun kendisi değil.

---

## Testler

```bash
npm test
```

**140 test, altı paket:** geometri ve biçimlendirme, polyline çözümleme, navigasyon
ilerlemesi, geocoding servisi, API istemcisi, rota puanlama/eleme/ücret/karbon.
Testler saf mantığa odaklanır; ağ, harita ve depolama katmanları kapsam dışıdır.

Yukarıdaki ölçülmüş kararların çoğu teste bağlanmıştır — örneğin BİSİM tarifesinin
"1 saat 92,50 ₺" değeri, açılış bloğunun ilk 5 dakikayı kapsadığını doğrulayan bir
testtir; blok üstüne 60 dakika sayılsaydı 100,00 ₺ çıkardı.

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
