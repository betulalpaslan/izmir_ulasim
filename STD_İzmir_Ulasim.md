# Yazılım Test Belgesi (STD)
## İzmir Ulaşım — Çok Modlu Toplu Taşıma Navigasyon Uygulaması

| Alan | Bilgi |
|------|-------|
| Belge Türü | Yazılım Test Belgesi (Software Test Document) |
| Proje Adı | İzmir Ulaşım |
| Sürüm | 1.0 |
| Tarih | 02.05.2026 |
| Hazırlayan | Betül Alpaslan |
| Platform | React Native (Expo) — Android / iOS |

---

## İçindekiler

1. Giriş
   - 1.1. Genel Bakış
   - 1.2. Test Yaklaşımı
2. Test Planı
   - 2.1. Test Edilecek Özellikler
   - 2.2. Test Edilmeyecek Özellikler
   - 2.3. Test Ortamı ve Araçları
3. Test Senaryoları
   - 3.1. Onboarding Akışı
   - 3.2. Toplu Taşıma ile Rota Planlama (Transit)
   - 3.3. Bisiklet ile Doğrudan Rota Planlama
   - 3.4. BİSİM Bisiklet Parkı + Transit (Bicycle PARK Modu)
   - 3.5. Araç ile Doğrudan Rota Planlama
   - 3.6. Park ve Yolculuk (Park & Ride)
   - 3.7. Adres Arama ve Otomatik Tamamlama
   - 3.8. Haritaya Tıklama ile Konum Seçimi
   - 3.9. Mevcut Konum ile Rota Planlama
   - 3.10. Kayıtlı Yerler (Favoriler) ile Rota Planlama
   - 3.11. Çoklu Rota Seçimi (Önerilen / Az Yürüyüş / Çevreci)
   - 3.12. Rota Simülasyonu
   - 3.13. Ücret Çarpanı (Pasaport Türü) Uygulaması
   - 3.14. Tema Değişimi (Karanlık / Aydınlık Mod)
   - 3.15. Rota Geçmişi Kaydı
4. Test Sonuç Raporu

---

## 1. Giriş

### 1.1. Genel Bakış

İzmir Ulaşım, İzmir Metropolitan Alanı'nda çok modlu toplu taşıma güzergâh planlaması sunan bir mobil uygulamadır. Uygulama; otobüs, metro, tramvay ve vapur gibi toplu taşıma araçlarına ek olarak BİSİM bisiklet paylaşım sistemi ve park-and-ride (park et-devam et) entegrasyonunu desteklemektedir.

Sistem, iki ana bileşenden oluşmaktadır:

- **Frontend:** React Native (Expo) tabanlı mobil uygulama (`d:\izmir_ulasim`)
- **Backend:** Node.js/Express API sunucusu (`d:\izmir_backend`) — OpenTripPlanner 2.8.1 (OTP) üzerinden güzergâh hesaplar; BİSİM GBFS beslemesi ve İZELMAN/İZUM otopark verilerini sağlar. Railway platformunda barındırılmaktadır: `https://izmirbackend-production.up.railway.app`

Bu belge; uygulamanın işlevsel gereksinimlerinin doğrulanması amacıyla tasarlanmış test senaryolarını, her senaryoya ilişkin giriş koşullarını, beklenen çıktıları ve geçme/kalma kriterlerini sistematik biçimde sunmaktadır.

### 1.2. Test Yaklaşımı

Test sürecinde **kara kutu (black-box)** test yöntemi esas alınmaktadır; dolayısıyla senaryolar uygulamanın kullanıcı arayüzü üzerinden yürütülmektedir. Birim testleri bu belgenin kapsamı dışındadır.

Benimsenen test türleri şunlardır:

| Test Türü | Açıklama |
|-----------|----------|
| **İşlevsel Test** | Her özelliğin tanımlanan gereksinimle uyumlu çalışıp çalışmadığını doğrular |
| **Entegrasyon Testi** | Ön yüz–arka uç, OTP ve harici API entegrasyonlarını kapsar |
| **Kullanıcı Senaryosu Testi** | Gerçek kullanım akışlarını simüle eden uçtan uca senaryoları içerir |
| **Sınır Değer Testi** | Boş girdi, ağ hatası ve konum erişim reddi gibi uç durumları kapsar |

---

## 2. Test Planı

### 2.1. Test Edilecek Özellikler

| No | Özellik Grubu | Kapsam |
|----|---------------|--------|
| F-01 | Onboarding | İlk açılış akışı, tercih kaydı |
| F-02 | Adres Arama | Photon/Nominatim jeokodlama, debounce, öneri listesi |
| F-03 | Harita Etkileşimi | Konum seçimi, işaretçi yerleştirme, güzergâh çizgisi |
| F-04 | Transit Rota | OTP toplu taşıma güzergâhı, aktarma bilgisi |
| F-05 | Bisiklet Rota | Doğrudan bisiklet güzergâhı |
| F-06 | BİSİM Park Modu | Bisiklet park + transit güzergâhı |
| F-07 | Araç Rota | Doğrudan araç güzergâhı |
| F-08 | Park & Ride | Araç park + transit güzergâhı |
| F-09 | Rota Sıralama | Önerilen / Az Yürüyüş / Çevreci sekmeleri |
| F-10 | Simülasyon | Güzergâh üzerinde konum animasyonu |
| F-11 | Favoriler | Kayıtlı yer ekleme, rotaya uygulama |
| F-12 | Ayarlar | Kart türü, profil görünürlüğü |
| F-13 | Tema | Karanlık/Aydınlık mod geçişi, kalıcılık |
| F-14 | Rota Geçmişi | Son 20 rota kaydı |
| F-15 | Zaman İpucu | Yoğun saat, gece, hafta sonu bildirim mesajları |
| F-16 | Karbon Hesabı | CO₂ emisyon tahmini gösterimi |
| F-17 | Ücret Hesabı | Kart türü çarpanına göre bilet ücreti |

### 2.2. Test Edilmeyecek Özellikler

Aşağıdaki bileşenler bu belgenin kapsamı dışındadır:

- OTP (OpenTripPlanner) çekirdek güzergâh hesaplama algoritmaları — üçüncü taraf bileşendir
- Photon ve Nominatim jeokodlama servisleri — harici bağımlılıktır
- İZULAŞ BİSİM ve İZELMAN/İZUM API'lerinin kendisi — harici veri kaynaklarıdır
- Expo/React Native çerçevesine özgü platform davranışları (derinlik navigasyon mekanizmaları vb.)
- CI/CD pipeline ve Docker dağıtım süreçleri

### 2.3. Test Ortamı ve Araçları

| Bileşen | Ayrıntı |
|---------|---------|
| Geliştirme Ortamı | Windows 11, Node.js, Expo CLI |
| Test Cihazı (Fiziksel) | Android akıllı telefon (API 29+) |
| Test Cihazı (Emülatör) | Android Studio AVD, Google Maps API etkin |
| Backend | Railway — `https://izmirbackend-production.up.railway.app` |
| API Test Aracı | cURL veya tarayıcı (backend REST uç noktaları için — `GET /parking/feed`, `GET /bisim/stations` vb.) |
| OTP İletişimi | Express backend, OTP'ye dahili olarak GraphQL sorgular gönderir; uygulama ve testler yalnızca REST uç noktalarıyla muhataptır |
| Konum Simülasyonu | Android emülatör Extended Controls → Location |
| Ağ Koşulu Testi | Android Developer Options → Ağ kısıtlama |

---

## 3. Test Senaryoları

---

### 3.1. Senaryo-1: Onboarding Akışı

#### 3.1.1. Amaç

Uygulamanın ilk yüklemesinde karşılama (onboarding) ekranının görüntülendiğini, kullanıcı tercihlerinin (kart türü(öğrenci,tam,65+) tema, profil) doğru biçimde kaydedildiğini ve sonraki açılışlarda onboarding ekranının atlanarak doğrudan ana ekrana yönlendirildiğini doğrulamak.

#### 3.1.2. Girişler

| Girdi | Değer |
|-------|-------|
| Uygulama Durumu | Temiz kurulum — `AsyncStorage` boş |
| Kullanıcı Eylemi 1 | Uygulamayı ilk kez başlatma |
| Kullanıcı Eylemi 2 | Onboarding adımlarını tamamlayarak "Başla" tuşuna basma |
| Kullanıcı Eylemi 3 | Uygulamayı kapatıp yeniden açma |

#### 3.1.3. Beklenen Sonuçlar & Geçme/Kalma Kriterleri

| Kriter No | Beklenen Davranış | Geçme Koşulu |
|-----------|-------------------|--------------|
| S1-K1 | İlk açılışta `OnboardingScreen` görüntülenir | Onboarding bileşeni render edilir |
| S1-K2 | Onboarding tamamlandıktan sonra ana ekran (Bottom Tab Navigator) açılır | `Main` rotasına yönlendirilir |
| S1-K3 | `AsyncStorage` içinde `userPrefs.onboardingDone: true` değeri kaydedilir | Storage okunduğunda değer mevcut olmalıdır |
| S1-K4 | Uygulamayı yeniden açtığında doğrudan `MainTabs` ekranı görüntülenir | `Onboarding` ekranı gösterilmez |

#### 3.1.4. Test Prosedürleri

1. Android emülatöründe uygulamanın uygulama verisi silinerek temizlenir.
2. Uygulama başlatılır; `OnboardingScreen`'in görüntülendiği gözlemlenir.
3. Onboarding adımları sırayla tamamlanır ve "Başla" tuşuna basılır.
4. Ana ekrana geçildiği doğrulanır.
5. Uygulama kapatılıp yeniden açılır.
6. `OnboardingScreen` yerine doğrudan `Harita` sekmesinin yüklendiği doğrulanır.

#### 3.1.5. Sonuç

| Kriter | Durum | Notlar |
|--------|-------|--------|
| S1-K1 | ☐ Geçti / ☐ Kaldı | |
| S1-K2 | ☐ Geçti / ☐ Kaldı | |
| S1-K3 | ☐ Geçti / ☐ Kaldı | |
| S1-K4 | ☐ Geçti / ☐ Kaldı | |

---

### 3.2. Senaryo-2: Toplu Taşıma ile Rota Planlama (Transit)

#### 3.2.1. Amaç

Kullanıcının başlangıç ve varış noktasını girerek "Transit" profilini seçtiğinde, uygulamanın OpenTripPlanner üzerinden geçerli bir toplu taşıma güzergâhı elde edip etmediğini; güzergâh bilgilerinin (süre, aktarma sayısı, yürüyüş mesafesi, ücret) doğru biçimde hesaplanıp kullanıcı arayüzünde gösterildiğini doğrulamak.

#### 3.2.2. Girişler

| Girdi | Değer |
|-------|-------|
| Başlangıç Noktası | Konak Meydanı, İzmir (38.4139, 27.1418) |
| Varış Noktası | Kültürpark, İzmir (38.4356, 27.1421) |
| Profil | Transit |
| Pasaport Türü | Yetişkin (çarpan: 1.0×) |

#### 3.2.3. Beklenen Sonuçlar & Geçme/Kalma Kriterleri

| Kriter No | Beklenen Davranış | Geçme Koşulu |
|-----------|-------------------|--------------|
| S2-K1 | Rota aranıyor durumunda `ActivityIndicator` gösterilir | Loading bileşeni görüntülenir |
| S2-K2 | En az bir güzergâh sonucu döner | `routes.length >= 1` |
| S2-K3 | Süre, aktarma, yürüyüş mesafesi ve ücret kartları görüntülenir | Dört özet kart ekranda görünür |
| S2-K4 | Güzergâh haritada poliçizgi (polyline) olarak çizilir | Renk kodlu segment(ler) haritada görünür |
| S2-K5 | Her bacak (leg) için mod ikonu ve süre bilgisi listelenir | Leg kartları `RoutePanel`'de sıralanır |
| S2-K6 | Ücret 25 ₺ × 1.0 = 25 ₺ olarak gösterilir | Ücret bilgisi doğrudur |

#### 3.2.4. Test Prosedürleri

1. Uygulama başlatılır; Harita sekmesi açılır.
2. Başlangıç arama kutusuna "Konak Meydanı" yazılır; önerilerden seçilir.
3. Varış arama kutusuna "Kültürpark" yazılır; önerilerden seçilir.
4. Profil sekmesinden "Transit" seçili olduğu teyit edilir.
5. Rota aranması beklenir (en fazla 15 saniye).
6. Sonuç panelinde özet kartlar ve leg listesi incelenir.
7. Haritada poliçizginin göründüğü doğrulanır.

#### 3.2.5. Sonuç

| Kriter | Durum | Notlar |
|--------|-------|--------|
| S2-K1 | ☐ Geçti / ☐ Kaldı | |
| S2-K2 | ☐ Geçti / ☐ Kaldı | |
| S2-K3 | ☐ Geçti / ☐ Kaldı | |
| S2-K4 | ☐ Geçti / ☐ Kaldı | |
| S2-K5 | ☐ Geçti / ☐ Kaldı | |
| S2-K6 | ☐ Geçti / ☐ Kaldı | |

---

### 3.3. Senaryo-3: Bisiklet ile Doğrudan Rota Planlama

#### 3.3.1. Amaç

"Bisiklet" profili seçildiğinde (alt seçenek olmaksızın doğrudan bisiklet), OTP'nin `BICYCLE` modunu kullandığını ve güzergâhın haritada yeşil poliçizgiyle gösterildiğini doğrulamak.

#### 3.3.2. Girişler

| Girdi | Değer |
|-------|-------|
| Başlangıç Noktası | Alsancak, İzmir (38.4425, 27.1434) |
| Varış Noktası | Karşıyaka İskelesi, İzmir (38.4596, 27.1106) |
| Profil | Bisiklet |
| Bisiklet Alt Modu | Yok (doğrudan bisiklet) |

#### 3.3.3. Beklenen Sonuçlar & Geçme/Kalma Kriterleri

| Kriter No | Beklenen Davranış | Geçme Koşulu |
|-----------|-------------------|--------------|
| S3-K1 | Sonuç panelinde aktarma sayısı 0 olarak görünür | `transfers = 0` |
| S3-K2 | Leg listesinde yalnızca "Bisiklet" modu bulunur | Tüm leg'ler `mode === "BICYCLE"` |
| S3-K3 | Poliçizgi `#4ade80` (yeşil) rengiyle çizilir | Haritada yeşil çizgi görünür |
| S3-K4 | Ücret 0 ₺ (Ücretsiz) olarak gösterilir | Ücret kartında "Ücretsiz" yazar |
| S3-K5 | Karbon emisyonu 0 g CO₂ veya gösterilmez | Karbon alanı boştur ya da 0 gösterir |

#### 3.3.4. Test Prosedürleri

1. Başlangıç ve varış noktaları girilir.
2. Profil sekmesinde "Bisiklet" seçilir; alt seçenek açılmaz.
3. Sonuç paneli yüklendikten sonra aktarma, ücret ve leg listesi incelenir.
4. Harita üzerinde poliçizgi rengi gözlemlenir.

#### 3.3.5. Sonuç

| Kriter | Durum | Notlar |
|--------|-------|--------|
| S3-K1 | ☐ Geçti / ☐ Kaldı | |
| S3-K2 | ☐ Geçti / ☐ Kaldı | |
| S3-K3 | ☐ Geçti / ☐ Kaldı | |
| S3-K4 | ☐ Geçti / ☐ Kaldı | |
| S3-K5 | ☐ Geçti / ☐ Kaldı | |

---

### 3.4. Senaryo-4: BİSİM Bisiklet Parkı + Transit (Bicycle PARK Modu)

#### 3.4.1. Amaç

Bisiklet profili altında "Park" alt modunun seçilmesi durumunda, uygulamanın OTP'ye `BICYCLE_PARKING` erişim modunu ilettiğini; güzergâhın bisikletle BİSİM istasyonuna, oradan transit ile hedefe ulaşım biçiminde planlandığını ve leg listesinde hem bisiklet hem de toplu taşıma bölümlerinin doğru görüntülendiğini doğrulamak.

#### 3.4.2. Girişler

| Girdi | Değer |
|-------|-------|
| Başlangıç Noktası | Bornova Merkez (38.4630, 27.2209) |
| Varış Noktası | Konak Meydanı (38.4139, 27.1418) |
| Profil | Bisiklet |
| Bisiklet Alt Modu | PARK (BİSİM istasyonuna bırak) |

#### 3.4.3. Beklenen Sonuçlar & Geçme/Kalma Kriterleri

| Kriter No | Beklenen Davranış | Geçme Koşulu |
|-----------|-------------------|--------------|
| S4-K1 | Leg listesinde en az bir `BICYCLE` veya `BICYCLE_RENTAL` bacağı bulunur | Bisiklet modu mevcut |
| S4-K2 | Leg listesinde en az bir toplu taşıma bacağı (BUS/RAIL/TRAM/SUBWAY) bulunur | Transit mod mevcut |
| S4-K3 | BİSİM entegrasyonu etkin; backend `/bisim/gbfs` beslemesi OTP tarafından okunuyor | Güzergâh sonucu dönüyor |
| S4-K4 | Güzergâh haritada bisiklet ve transit bölümleri farklı renklerle gösterilir | Çok renkli poliçizgi görünür |

#### 3.4.4. Test Prosedürleri

1. Başlangıç ve varış noktaları girilir.
2. "Bisiklet" profili seçilir; ardından "Park" alt modu aktif edilir.
3. Rota sonucu beklenir.
4. Leg listesinde bisiklet ve transit bacakların her ikisi de olduğu doğrulanır.
5. Haritada çok renkli poliçizgi gözlemlenir.

#### 3.4.5. Sonuç

| Kriter | Durum | Notlar |
|--------|-------|--------|
| S4-K1 | ☐ Geçti / ☐ Kaldı | |
| S4-K2 | ☐ Geçti / ☐ Kaldı | |
| S4-K3 | ☐ Geçti / ☐ Kaldı | |
| S4-K4 | ☐ Geçti / ☐ Kaldı | |

---

### 3.5. Senaryo-5: Araç ile Doğrudan Rota Planlama

#### 3.5.1. Amaç

"Araba" profili seçildiğinde (park-and-ride alt modu olmaksızın), OTP'nin `CAR` modunu kullandığını ve güzergâhın tek bir araç bacağından oluştuğunu doğrulamak.

#### 3.5.2. Girişler

| Girdi | Değer |
|-------|-------|
| Başlangıç Noktası | Gaziemir, İzmir (38.3211, 27.1322) |
| Varış Noktası | Alsancak Garı (38.4425, 27.1434) |
| Profil | Araba |
| Araba Alt Modu | Yok (doğrudan araç) |

#### 3.5.3. Beklenen Sonuçlar & Geçme/Kalma Kriterleri

| Kriter No | Beklenen Davranış | Geçme Koşulu |
|-----------|-------------------|--------------|
| S5-K1 | Leg listesinde yalnızca `CAR` modu bulunur | Toplu taşıma modu yok |
| S5-K2 | Aktarma sayısı 0 gösterilir | `transfers = 0` |
| S5-K3 | Ücret 0 ₺ (Ücretsiz) olarak gösterilir | Transit bacak olmadığı için ücret sıfır |
| S5-K4 | Karbon emisyonu tahmini hesaplanır ve gösterilir (CAR: 150 g/km) | Karbon alanı pozitif değer içerir |

#### 3.5.4. Test Prosedürleri

1. Başlangıç ve varış girilir.
2. Profil sekmesinden "Araba" seçilir; alt mod açılmaz.
3. Sonuç panelinde leg modu, aktarma ve ücret bilgileri incelenir.
4. Karbon emisyon alanı gözlemlenir.

#### 3.5.5. Sonuç

| Kriter | Durum | Notlar |
|--------|-------|--------|
| S5-K1 | ☐ Geçti / ☐ Kaldı | |
| S5-K2 | ☐ Geçti / ☐ Kaldı | |
| S5-K3 | ☐ Geçti / ☐ Kaldı | |
| S5-K4 | ☐ Geçti / ☐ Kaldı | |

---

### 3.6. Senaryo-6: Park ve Yolculuk (Park & Ride)

#### 3.6.1. Amaç

"Araba" profili altında "Park ve Yolculuk" alt modu etkinleştirildiğinde, uygulamanın OTP'ye `CAR_PARKING` erişim modunu ilettiğini; güzergâhın araçla bir P+R otoparkına, oradan transit ile hedefe ulaşım biçiminde planlandığını ve P+R otopark verisinin backend `/parking/feed` uç noktasından OTP'ye başarıyla beslendiğini doğrulamak.

#### 3.6.2. Girişler

| Girdi | Değer |
|-------|-------|
| Başlangıç Noktası | Gaziemir Otogar (38.3100, 27.1430) |
| Varış Noktası | Basmane Garı (38.4225, 27.1395) |
| Profil | Araba |
| Araba Alt Modu | Park ve Yolculuk |

#### 3.6.3. Beklenen Sonuçlar & Geçme/Kalma Kriterleri

| Kriter No | Beklenen Davranış | Geçme Koşulu |
|-----------|-------------------|--------------|
| S6-K1 | Leg listesinde bir `CAR` bacağı ve ardından en az bir transit bacak bulunur | Karma mod güzergâhı döner |
| S6-K2 | Backend `/parking/feed` uç noktası 200 HTTP yanıtı ve geçerli JSON döner | Otopark beslemesi erişilebilir |
| S6-K3 | Haritada araç ve transit bölümleri farklı renklerle gösterilir | Çok renkli poliçizgi görünür |
| S6-K4 | Ücret hesaplamasında toplu taşıma bacağı için 25 ₺ temel ücret yansıtılır | Ücret kartı boş değil |

#### 3.6.4. Test Prosedürleri

1. Tarayıcı veya cURL ile `GET https://izmirbackend-production.up.railway.app/parking/feed` çağrısı yapılarak REST uç noktasının 200 döndürdüğü ve JSON içerdiği teyit edilir (OTP bu veriyi dahili GraphQL katmanı aracılığıyla değil, doğrudan bu REST beslemesinden okur).
2. Uygulamada başlangıç ve varış girilir.
3. "Araba" profili → "Park ve Yolculuk" alt modu seçilir.
4. Rota sonucu beklenir; leg listesi incelenir.
5. Haritada rota segmentleri gözlemlenir.

#### 3.6.5. Sonuç

| Kriter | Durum | Notlar |
|--------|-------|--------|
| S6-K1 | ☐ Geçti / ☐ Kaldı | |
| S6-K2 | ☐ Geçti / ☐ Kaldı | |
| S6-K3 | ☐ Geçti / ☐ Kaldı | |
| S6-K4 | ☐ Geçti / ☐ Kaldı | |

---

### 3.7. Senaryo-7: Adres Arama ve Otomatik Tamamlama

#### 3.7.1. Amaç

Arama kutusuna en az üç karakter girildiğinde Photon API'sinin (yedek olarak Nominatim) devreye girdiğini, sonuçların debounce mekanizmasıyla filtrelendiğini ve açılan öneri listesinden bir öğenin seçilmesiyle ilgili koordinatın doğru biçimde atandığını doğrulamak.

#### 3.7.2. Girişler

| Girdi | Değer |
|-------|-------|
| Metin Girişi 1 | "Ko" (2 karakter — eşiğin altında) |
| Metin Girişi 2 | "Kon" (3 karakter — eşikte) |
| Metin Girişi 3 | "Konak" |
| Seçim | Listeden "Konak Meydanı, İzmir" öğesi |

#### 3.7.3. Beklenen Sonuçlar & Geçme/Kalma Kriterleri

| Kriter No | Beklenen Davranış | Geçme Koşulu |
|-----------|-------------------|--------------|
| S7-K1 | "Ko" girildiğinde öneri listesi gösterilmez | Liste boş kalır |
| S7-K2 | "Kon" girildiğinde API çağrısı yapılır ve sonuçlar listelenir | En az bir öneri görünür |
| S7-K3 | "Konak" için sonuç listesi ilgili coğrafi konumları içerir | İzmir konumları listelenir |
| S7-K4 | Öğe seçiminin ardından arama kutusu seçilen konum adıyla güncellenir | Arama metni kısaltılmış ad ile değişir |
| S7-K5 | Her iki konum seçildiğinde otomatik olarak rota araması başlatılır | `fetchRoute` çağrılır |

#### 3.7.4. Test Prosedürleri

1. Başlangıç kutusuna "Ko" yazılır; öneri listesi gözlemlenir.
2. "Kon" yazılır; önerilerin belirdiği beklenir.
3. "Konak" yazılır ve listeden bir sonuç seçilir.
4. Varış kutusuna farklı bir adres yazılarak seçilir.
5. Rota aramasının otomatik başladığı doğrulanır.

#### 3.7.5. Sonuç

| Kriter | Durum | Notlar |
|--------|-------|--------|
| S7-K1 | ☐ Geçti / ☐ Kaldı | |
| S7-K2 | ☐ Geçti / ☐ Kaldı | |
| S7-K3 | ☐ Geçti / ☐ Kaldı | |
| S7-K4 | ☐ Geçti / ☐ Kaldı | |
| S7-K5 | ☐ Geçti / ☐ Kaldı | |

---

### 3.8. Senaryo-8: Haritaya Tıklama ile Konum Seçimi

#### 3.8.1. Amaç

Kullanıcının haritaya dokunarak başlangıç ve varış noktası seçebildiğini; ilk dokunuşta başlangıç, ikinci dokunuşta varış noktasının ayarlandığını ve koordinatların enlem-boylam formatında arama kutusuna yansıdığını doğrulamak.

#### 3.8.2. Girişler

| Girdi | Değer |
|-------|-------|
| Harita Dokunuşu 1 | İzmir Körfezi kıyısı — herhangi bir nokta |
| Harita Dokunuşu 2 | Bornova yönünde — farklı bir nokta |

#### 3.8.3. Beklenen Sonuçlar & Geçme/Kalma Kriterleri

| Kriter No | Beklenen Davranış | Geçme Koşulu |
|-----------|-------------------|--------------|
| S8-K1 | İlk dokunuş, yeşil işaretçiyle başlangıç noktasını atar | Yeşil marker haritada görünür |
| S8-K2 | Başlangıç arama kutusunda `"38.XXXX, 27.XXXX"` formatında koordinat gösterilir | Metin formatı doğru |
| S8-K3 | İkinci dokunuş, kırmızı işaretçiyle varış noktasını atar | Kırmızı marker haritada görünür |
| S8-K4 | Her iki nokta belirlendikten sonra otomatik rota araması başlar | Loading göstergesi görünür |

#### 3.8.4. Test Prosedürleri

1. Tüm alanlar temizlenir (sıfırla tuşu).
2. Haritanın kıyı bölgesine dokunulur; yeşil marker ve koordinat metni gözlemlenir.
3. Haritanın farklı bir noktasına dokunulur; kırmızı marker ve rota araması gözlemlenir.

#### 3.8.5. Sonuç

| Kriter | Durum | Notlar |
|--------|-------|--------|
| S8-K1 | ☐ Geçti / ☐ Kaldı | |
| S8-K2 | ☐ Geçti / ☐ Kaldı | |
| S8-K3 | ☐ Geçti / ☐ Kaldı | |
| S8-K4 | ☐ Geçti / ☐ Kaldı | |

---

### 3.9. Senaryo-9: Mevcut Konum ile Rota Planlama

#### 3.9.1. Amaç

Kullanıcının konum servisi izni verdiğinde "Mevcut konumum" düğmesinin başlangıç noktasını cihazın GPS konumuyla doldurduğunu ve varış girildiğinde rotanın doğru başlangıç koordinatıyla planlandığını doğrulamak.

#### 3.9.2. Girişler

| Girdi | Değer |
|-------|-------|
| Cihaz Konumu | Emülatörde sanal konum: Konak (38.4139, 27.1418) |
| Konum İzni | Verilmiş (FINE_LOCATION) |
| Varış | Arama kutusundan "Buca Merkez" |

#### 3.9.3. Beklenen Sonuçlar & Geçme/Kalma Kriterleri

| Kriter No | Beklenen Davranış | Geçme Koşulu |
|-----------|-------------------|--------------|
| S9-K1 | "Mevcut konumum" FAB butonu, kullanıcı konumu alındığında görüntülenir | FAB görünür |
| S9-K2 | Düğmeye basıldığında başlangıç arama kutusuna "Mevcut konumum" yazar | Metin doğru |
| S9-K3 | Başlangıç koordinatı olarak GPS konumu kullanılır | `origin` state GPS değerini içerir |
| S9-K4 | Varış girildiğinde rota araması GPS konumundan planlanır | Rota başlangıcı emülatör konumuna yakın |

#### 3.9.4. Test Prosedürleri

1. Emülatörde Extended Controls → Location sekmesinden konum Konak olarak ayarlanır.
2. Uygulama açılır; haritanın GPS konumunu aldığı beklenir.
3. "Mevcut konumum" FAB tuşuna basılır.
4. Varış kutusuna "Buca Merkez" yazılıp seçilir.
5. Güzergâh başlangıcının Konak'a yakın olduğu doğrulanır.

#### 3.9.5. Sonuç

| Kriter | Durum | Notlar |
|--------|-------|--------|
| S9-K1 | ☐ Geçti / ☐ Kaldı | |
| S9-K2 | ☐ Geçti / ☐ Kaldı | |
| S9-K3 | ☐ Geçti / ☐ Kaldı | |
| S9-K4 | ☐ Geçti / ☐ Kaldı | |

---

### 3.10. Senaryo-10: Kayıtlı Yerler (Favoriler) ile Rota Planlama

#### 3.10.1. Amaç

Kullanıcının Ayarlar ekranında bir "Ev" veya "İş" adresi kaydettiğinde bu adresin Harita sekmesinde kısayol olarak listelendiğini ve seçilmesiyle rota aramasının otomatik başladığını doğrulamak.

#### 3.10.2. Girişler

| Girdi | Değer |
|-------|-------|
| Kayıtlı Yer | Ev: "Karşıyaka" (38.4596, 27.1106) — Ayarlar ekranından kaydedilmiş |
| Aktif Giriş Alanı | Varış kutusu aktif |
| Seçim | "Ev" kısayol tuşuna basma |

#### 3.10.3. Beklenen Sonuçlar & Geçme/Kalma Kriterleri

| Kriter No | Beklenen Davranış | Geçme Koşulu |
|-----------|-------------------|--------------|
| S10-K1 | Kayıtlı adres bulunan yer için kısayol kartı haritada gösterilir | "Ev" kartı görünür |
| S10-K2 | Kısayola basıldığında varış kutusuna "Karşıyaka" yazar | Metin doğru |
| S10-K3 | Başlangıç zaten belirlenmişse rota araması otomatik başlar | Loading göstergesi aktif |
| S10-K4 | Adres kaydı `AsyncStorage`'da kalıcıdır; uygulama yeniden açılınca kaybolmaz | Kayıt yeniden yükleme sonrası mevcut |

#### 3.10.4. Test Prosedürleri

1. Ayarlar ekranında "Ev" yerine "Karşıyaka" adresi girilip kaydedilir.
2. Harita sekmesine dönülür; varış kutusu tıklanarak aktif edilir.
3. "Ev" kısayol kartına basılır.
4. Varış kutusunun dolduğu ve (başlangıç seçiliyse) rotanın arandığı doğrulanır.
5. Uygulama kapatılıp açılır; kayıtlı adresin kaybolmadığı kontrol edilir.

#### 3.10.5. Sonuç

| Kriter | Durum | Notlar |
|--------|-------|--------|
| S10-K1 | ☐ Geçti / ☐ Kaldı | |
| S10-K2 | ☐ Geçti / ☐ Kaldı | |
| S10-K3 | ☐ Geçti / ☐ Kaldı | |
| S10-K4 | ☐ Geçti / ☐ Kaldı | |

---

### 3.11. Senaryo-11: Çoklu Rota Seçimi (Önerilen / Az Yürüyüş / Çevreci)

#### 3.11.1. Amaç

OTP'nin birden fazla güzergâh seçeneği döndürdüğü durumlarda uygulamanın bu seçenekleri puanlayıp "Önerilen", "Az Yürüyüş" ve "Çevreci" etiketleriyle sınıflandırdığını; aynı rotanın tekrarlı sekme olarak gösterilmediğini ve sekme değiştirildiğinde harita ile leg listesinin ilgili güzergâhla güncellendiğini doğrulamak.

#### 3.11.2. Girişler

| Girdi | Değer |
|-------|-------|
| Başlangıç | Bornova Metro İstasyonu (38.4637, 27.2195) |
| Varış | Üçyol Metro İstasyonu (38.3956, 27.0936) |
| Profil | Transit |
| Beklenen OTP Çıktısı | 3+ farklı güzergâh alternatifi |

#### 3.11.3. Beklenen Sonuçlar & Geçme/Kalma Kriterleri

| Kriter No | Beklenen Davranış | Geçme Koşulu |
|-----------|-------------------|--------------|
| S11-K1 | Birden fazla güzergâh varsa sekme satırı (`tabRow`) görüntülenir | Tab bileşeni görünür |
| S11-K2 | Sekmeler "Önerilen", "Az Yürüyüş", "Çevreci" etiketlerini içerir | Etiketler doğru |
| S11-K3 | Aynı güzergâh iki ayrı sekmede gösterilmez | Sekme sayısı ≤ 3, tekrarsız |
| S11-K4 | Sekme değiştirildiğinde özet kartlar seçili güzergâha göre güncellenir | Süre/aktarma/yürüyüş değerleri değişir |
| S11-K5 | Haritada polyline seçili sekmenin güzergâhını yansıtır | Harita sekme değişimiyle güncellenir |

#### 3.11.4. Test Prosedürleri

1. Bornova – Üçyol güzergâhı için Transit profiliyle rota aranır.
2. Sonuç panelinde sekme sayısı ve etiketler gözlemlenir.
3. Farklı sekmelere tıklanarak özet kart değerlerinin değiştiği doğrulanır.
4. Haritanın güncellenmesi izlenir.

#### 3.11.5. Sonuç

| Kriter | Durum | Notlar |
|--------|-------|--------|
| S11-K1 | ☐ Geçti / ☐ Kaldı | |
| S11-K2 | ☐ Geçti / ☐ Kaldı | |
| S11-K3 | ☐ Geçti / ☐ Kaldı | |
| S11-K4 | ☐ Geçti / ☐ Kaldı | |
| S11-K5 | ☐ Geçti / ☐ Kaldı | |

---

### 3.12. Senaryo-12: Rota Simülasyonu

#### 3.12.1. Amaç

Aktif bir güzergâh mevcutken "Simülasyonu Başlat" işlevinin, kullanıcı konumunu güzergâh koordinatları boyunca 900 ms aralıklarla hareket ettirdiğini; simülasyon sırasında haritada navigasyon ikonunun göründüğünü ve simülasyon tamamlandığında veya sıfırlandığında durduğunu doğrulamak.

#### 3.12.2. Girişler

| Girdi | Değer |
|-------|-------|
| Ön Koşul | Herhangi bir profilde geçerli bir rota gösterilmekte olmalı |
| Kullanıcı Eylemi 1 | "Simülasyonu Başlat" butonuna basma |
| Kullanıcı Eylemi 2 | Simülasyon devam ederken "Sıfırla" butonuna basma |

#### 3.12.3. Beklenen Sonuçlar & Geçme/Kalma Kriterleri

| Kriter No | Beklenen Davranış | Geçme Koşulu |
|-----------|-------------------|--------------|
| S12-K1 | Simülasyon başlatıldığında navigasyon ikonu (mavi nokta benzeri) haritada belirir | `simulationLocation` marker görünür |
| S12-K2 | İkon güzergâh üzerinde zaman içinde hareket eder (900 ms adım) | Konum değişimi gözlemlenir |
| S12-K3 | Güzergâh sonuna ulaşıldığında simülasyon otomatik durur | İkon kaybolur, simulating = false |
| S12-K4 | "Sıfırla" butonuna basıldığında simülasyon anında durur | İkon kaldırılır |

#### 3.12.4. Test Prosedürleri

1. Konak – Bornova arası Transit güzergâhı aranır.
2. Sonuç panelinde simülasyon başlatma tuşuna basılır.
3. Haritada navigasyon ikonunun hareket ettiği gözlemlenir.
4. "Sıfırla" tuşuna basılarak simülasyonun durması test edilir.
5. Simülasyon sona kadar beklenip otomatik durma doğrulanır.

#### 3.12.5. Sonuç

| Kriter | Durum | Notlar |
|--------|-------|--------|
| S12-K1 | ☐ Geçti / ☐ Kaldı | |
| S12-K2 | ☐ Geçti / ☐ Kaldı | |
| S12-K3 | ☐ Geçti / ☐ Kaldı | |
| S12-K4 | ☐ Geçti / ☐ Kaldı | |

---

### 3.13. Senaryo-13: Ücret Çarpanı (Pasaport Türü) Uygulaması

#### 3.13.1. Amaç

Ayarlar ekranında seçilen pasaport türünün ücret çarpanını değiştirdiğini ve bu değişikliğin aynı güzergâh için sonuç panelindeki ücret kartına doğru biçimde yansıdığını doğrulamak.

#### 3.13.2. Girişler

| Girdi | Değer |
|-------|-------|
| Pasaport 1 | Yetişkin — çarpan: 1.0 |
| Pasaport 2 | Öğrenci — çarpan: 0.7 |
| Pasaport 3 | Yaşlı/Senior — çarpan: 0.0 (Ücretsiz) |
| Temel Ücret | 25 ₺ (en az bir transit bacak içeren güzergâh) |

#### 3.13.3. Beklenen Sonuçlar & Geçme/Kalma Kriterleri

| Kriter No | Beklenen Davranış | Geçme Koşulu |
|-----------|-------------------|--------------|
| S13-K1 | Yetişkin seçildiğinde ücret 25 ₺ gösterilir | `cost = round(25 × 1.0) = 25` |
| S13-K2 | Öğrenci seçildiğinde ücret 18 ₺ gösterilir | `cost = round(25 × 0.7) = 18` |
| S13-K3 | Yaşlı/Senior seçildiğinde ücret "Ücretsiz" gösterilir | `cost = 0`, "Ücretsiz" yazar |

#### 3.13.4. Test Prosedürleri

1. Toplu taşıma içeren bir güzergâh aranır ve ücret notu alınır.
2. Ayarlar ekranına gidilip pasaport türü "Öğrenci" olarak değiştirilir.
3. Harita sekmesine dönülüp aynı güzergâh için ücretin 18 ₺ olduğu doğrulanır.
4. Pasaport "Yaşlı" olarak değiştirilerek ücretin "Ücretsiz" gösterildiği doğrulanır.

#### 3.13.5. Sonuç

| Kriter | Durum | Notlar |
|--------|-------|--------|
| S13-K1 | ☐ Geçti / ☐ Kaldı | |
| S13-K2 | ☐ Geçti / ☐ Kaldı | |
| S13-K3 | ☐ Geçti / ☐ Kaldı | |

---

### 3.14. Senaryo-14: Tema Değişimi (Karanlık / Aydınlık Mod)

#### 3.14.1. Amaç

Ayarlar ekranından karanlık (dark) veya aydınlık (light) mod seçildiğinde uygulamanın tüm ekranlarında renk şemasının değiştiğini ve tercihin uygulama yeniden başlatılsa bile `AsyncStorage` aracılığıyla korunduğunu doğrulamak.

#### 3.14.2. Girişler

| Girdi | Değer |
|-------|-------|
| Başlangıç Durumu | Sistem teması (light) |
| Eylem 1 | Ayarlar → Karanlık mod seçimi |
| Eylem 2 | Uygulamayı kapatıp yeniden açma |
| Eylem 3 | Ayarlar → Aydınlık mod seçimi |

#### 3.14.3. Beklenen Sonuçlar & Geçme/Kalma Kriterleri

| Kriter No | Beklenen Davranış | Geçme Koşulu |
|-----------|-------------------|--------------|
| S14-K1 | Karanlık mod seçildiğinde arka plan rengi koyu tona döner | `theme.bg` koyu renk |
| S14-K2 | Harita, arama paneli ve sekme çubuğu karanlık tema renklerini kullanır | Tüm bileşenler tutarlı |
| S14-K3 | Uygulama yeniden açıldığında karanlık mod korunur | AsyncStorage'dan yüklenir |
| S14-K4 | Aydınlık moda geçildiğinde renkler orijinal tonlara döner | `theme.bg` açık renk |

#### 3.14.4. Test Prosedürleri

1. Ayarlar ekranından karanlık mod aktif edilir.
2. Harita ve Favoriler sekmelerine geçilerek tema tutarlılığı incelenir.
3. Uygulama kapatılıp açılır; karanlık modun korunduğu doğrulanır.
4. Aydınlık moda geçilip renk değişimi gözlemlenir.

#### 3.14.5. Sonuç

| Kriter | Durum | Notlar |
|--------|-------|--------|
| S14-K1 | ☐ Geçti / ☐ Kaldı | |
| S14-K2 | ☐ Geçti / ☐ Kaldı | |
| S14-K3 | ☐ Geçti / ☐ Kaldı | |
| S14-K4 | ☐ Geçti / ☐ Kaldı | |

---

### 3.15. Senaryo-15: Rota Geçmişi Kaydı

#### 3.15.1. Amaç

Başarıyla planlanan her güzergâhın `AsyncStorage` içinde rota geçmişine eklendiğini, en fazla 20 kayıt tutulduğunu ve Favoriler ekranında bu geçmişin kullanıcıya gösterildiğini doğrulamak.

#### 3.15.2. Girişler

| Girdi | Değer |
|-------|-------|
| Eylem | Arka arkaya 3 farklı güzergâh başarıyla planlanması |
| Ön Koşul | `routeHistory` anahtarı `AsyncStorage`'da başlangıçta boş |

#### 3.15.3. Beklenen Sonuçlar & Geçme/Kalma Kriterleri

| Kriter No | Beklenen Davranış | Geçme Koşulu |
|-----------|-------------------|--------------|
| S15-K1 | Her başarılı rota planlamasının ardından geçmiş listesine bir kayıt eklenir | Kayıt sayısı her rota sonrasında artar |
| S15-K2 | Favoriler ekranında geçmiş listesi, tarih ve mod bilgisiyle gösterilir | Geçmiş öğeleri görünür |
| S15-K3 | 21. rota eklendiğinde en eski kayıt silinir; liste 20'de sınırlı kalır | `history.slice(0, 20)` uygulanır |
| S15-K4 | Geçmiş kayıtları uygulama yeniden başlatılsa bile korunur | AsyncStorage kalıcılığı sağlanmış |

#### 3.15.4. Test Prosedürleri

1. Uygulama ilk kez açılır (ya da geçmiş temizlenir).
2. Üç farklı güzergâh sırayla planlanır.
3. Favoriler sekmesine gidilip geçmiş listesinde üç kaydın göründüğü doğrulanır.
4. 21. güzergâh planlanarak liste uzunluğunun 20'yi aşmadığı kontrol edilir.
5. Uygulama kapatılıp açılır; geçmişin korunduğu doğrulanır.

#### 3.15.5. Sonuç

| Kriter | Durum | Notlar |
|--------|-------|--------|
| S15-K1 | ☐ Geçti / ☐ Kaldı | |
| S15-K2 | ☐ Geçti / ☐ Kaldı | |
| S15-K3 | ☐ Geçti / ☐ Kaldı | |
| S15-K4 | ☐ Geçti / ☐ Kaldı | |

---

## 4. Test Sonuç Raporu

| Alan | Bilgi |
|------|-------|
| Test Tarihi | |
| Test Eden | |
| Test Ortamı | Android Emülatör / Fiziksel Cihaz |
| Toplam Senaryo Sayısı | 15 |
| Toplam Kriter Sayısı | 57 |

### Özet Tablo

| Senaryo No | Senaryo Adı | Toplam Kriter | Geçen | Kalan | Sonuç |
|------------|-------------|---------------|-------|-------|-------|
| S-01 | Onboarding Akışı | 4 | | | ☐ Geçti / ☐ Kaldı |
| S-02 | Transit Rota Planlama | 6 | | | ☐ Geçti / ☐ Kaldı |
| S-03 | Bisiklet Rota | 5 | | | ☐ Geçti / ☐ Kaldı |
| S-04 | BİSİM Park + Transit | 4 | | | ☐ Geçti / ☐ Kaldı |
| S-05 | Araç Rota | 4 | | | ☐ Geçti / ☐ Kaldı |
| S-06 | Park & Ride | 4 | | | ☐ Geçti / ☐ Kaldı |
| S-07 | Adres Arama | 5 | | | ☐ Geçti / ☐ Kaldı |
| S-08 | Haritaya Tıklama | 4 | | | ☐ Geçti / ☐ Kaldı |
| S-09 | Mevcut Konum | 4 | | | ☐ Geçti / ☐ Kaldı |
| S-10 | Kayıtlı Yerler | 4 | | | ☐ Geçti / ☐ Kaldı |
| S-11 | Çoklu Rota Seçimi | 5 | | | ☐ Geçti / ☐ Kaldı |
| S-12 | Rota Simülasyonu | 4 | | | ☐ Geçti / ☐ Kaldı |
| S-13 | Ücret Çarpanı | 3 | | | ☐ Geçti / ☐ Kaldı |
| S-14 | Tema Değişimi | 4 | | | ☐ Geçti / ☐ Kaldı |
| S-15 | Rota Geçmişi | 4 | | | ☐ Geçti / ☐ Kaldı |
| **TOPLAM** | | **57** | | | |

### Genel Sonuç

| Başarı Oranı | Değerlendirme |
|--------------|---------------|
| %90–100 | Yayınlamaya hazır |
| %75–89 | Kritik olmayan düzeltmeler gerekli |
| %50–74 | Önemli kusurlar mevcut, yeniden test zorunlu |
| < %50 | Yayın için uygun değil |

### Tespit Edilen Kusurlar

| Kusur No | Senaryo | Açıklama | Önem Derecesi | Durum |
|----------|---------|----------|---------------|-------|
| — | — | — | — | — |

### Test Notları ve Gözlemler

> *(Test yürütüldükten sonra doldurulacak)*

---

*Bu belge, İzmir Ulaşım projesi kapsamında hazırlanmış olup uygulamanın v1.0 sürümünü kapsamaktadır.*
