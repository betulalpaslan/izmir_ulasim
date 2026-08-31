import {
  resolveProfileKey, calcCarbonGrams, calcJourneyFare,
  rankItineraries, selectCandidates, buildRouteResult, candidateKey, BIKE_LEG_MIN,
  oneriSinirinaUydur, ayniHattiTekilleştir, ONERI_TOLERANSI, ADAY_OLCULERI,
} from "../utils/routeScoring";

// OTP'nin döndürdüğü biçime yakın sahte güzergâh üretici.
// distance verildiği için polyline çözümlemesine gerek kalmaz.
const bacak = (mode, duration, distance, shortName = null) => ({
  mode,
  duration,
  distance,
  from: { name: `${mode} başlangıç` },
  to: { name: `${mode} bitiş` },
  ...(shortName ? { route: { shortName } } : {}),
});

const guzergah = (duration, legs) => ({ duration, legs });

describe("resolveProfileKey", () => {
  it("bisiklet alt modlarını ayrı anahtarlara çevirir", () => {
    expect(resolveProfileKey("bicycle", "RENT")).toBe("bicycle_rent");
    expect(resolveProfileKey("bicycle", "PARK")).toBe("bicycle_park");
    // Tek başına bisiklet modu kaldırıldı; bikeType yoksa "bisikletim +
    // aktarma"ya düşülür — backend'in buildModesInput'u da öyle yapıyor.
    expect(resolveProfileKey("bicycle", null)).toBe("bicycle_park");
  });

  it("diğer profilleri olduğu gibi bırakır", () => {
    expect(resolveProfileKey("transit")).toBe("transit");
    expect(resolveProfileKey("park_and_ride")).toBe("park_and_ride");
  });

  it("profil verilmezse transit varsayar", () => {
    expect(resolveProfileKey(undefined)).toBe("transit");
    expect(resolveProfileKey(null)).toBe("transit");
  });
});

describe("calcJourneyFare", () => {
  it("İzmirim Kart'ta aktarmalar tek ücrete dahildir", () => {
    expect(calcJourneyFare(3, 35, false)).toBe(35);
    expect(calcJourneyFare(1, 35, false)).toBe(35);
  });

  it("kredi kartında her biniş ayrı ücretlendirilir", () => {
    expect(calcJourneyFare(3, 39, true)).toBe(117);
    expect(calcJourneyFare(1, 39, true)).toBe(39);
  });

  it("toplu taşıma kullanılmayan rotada ücret yoktur", () => {
    expect(calcJourneyFare(0, 35, false)).toBe(0);
    expect(calcJourneyFare(0, 39, true)).toBe(0);
  });

  it("indirimli tarifeleri de aynı kuralla uygular", () => {
    expect(calcJourneyFare(2, 17.5, false)).toBe(17.5); // Genç kart
    expect(calcJourneyFare(2, 17.5, true)).toBe(35);
  });
});

describe("calcCarbonGrams", () => {
  it("araba için km başına 150 g hesaplar", () => {
    expect(calcCarbonGrams([bacak("CAR", 600, 10000)])).toBeCloseTo(1500, 5);
  });

  it("yürüyüş ve bisiklet sıfır emisyondur", () => {
    expect(calcCarbonGrams([bacak("WALK", 600, 2000), bacak("BICYCLE", 600, 5000)])).toBe(0);
  });

  it("karışık rotada bacakları toplar", () => {
    // 10 km araba (1500 g) + 5 km tramvay (150 g)
    const toplam = calcCarbonGrams([bacak("CAR", 600, 10000), bacak("TRAM", 300, 5000)]);
    expect(toplam).toBeCloseTo(1650, 5);
  });

  it("bilinmeyen modu sıfır sayar", () => {
    expect(calcCarbonGrams([bacak("SCOOTER", 300, 3000)])).toBe(0);
  });
});

describe("rankItineraries", () => {
  it("eşit sürede az yürüyenli rotayı öne alır", () => {
    const cokYuruyus = guzergah(1800, [bacak("WALK", 900, 1200), bacak("BUS", 900, 5000, "169")]);
    const azYuruyus  = guzergah(1800, [bacak("WALK", 300, 300),  bacak("BUS", 1500, 5000, "12")]);

    const siralama = rankItineraries([cokYuruyus, azYuruyus], "transit");
    expect(siralama[0].itin).toBe(azYuruyus);
  });

  it("aktarma cezasını uygular", () => {
    const aktarmali = guzergah(1500, [
      bacak("WALK", 200, 200), bacak("BUS", 600, 4000, "169"),
      bacak("WALK", 100, 100), bacak("BUS", 600, 3000, "12"),
    ]);
    const aktarmasiz = guzergah(1700, [bacak("WALK", 200, 200), bacak("RAIL", 1500, 7000, "M1")]);

    // Aktarmasız rota 200 sn daha uzun ama 10 puanlık aktarma cezası bunu telafi eder
    const siralama = rankItineraries([aktarmali, aktarmasiz], "transit");
    expect(siralama[0].itin).toBe(aktarmasiz);
  });

  // Yürüyüş HEDEFİ (WALK_LEG_TARGET) elemez, cezalandırır. Sert eşik uçlarda
  // saçmalıyordu: Konak→Karşıyaka'da 1250 m'lik bacak 1200 m sınırına
  // 50 METRE takılıp kullanıcının tam istediği BİSİM+tren güzergâhını siliyordu.
  //
  // Süre tavanıyla karıştırılmamalı: hedef mesafe cinsindendir ve yalnız
  // sıralamayı etkiler; tavan süre cinsindendir ve eler (aşağıdaki test).
  it("hedefi aşan yürüyüş elenmez ama cezalanıp geriye düşer", () => {
    // 1550 m / 19.2 dk — bicycle_park hedefinin (1500 m) üstünde, 20 dk
    // tavanının altında. Bisiklet bacağı BIKE_LEG_MIN'i (800 m) geçmeli,
    // yoksa güzergâh "modun işini görmüyor" diye elenir.
    // Bisiklet payı ikisinde de %15'in üstünde tutuldu (BISIKLET_ASGARI_PAY);
    // yoksa bu test yürüyüş cezasını değil, oran kuralını ölçerdi.
    const uzunYuruyus = guzergah(2750, [
      bacak("BICYCLE", 500, 2000), bacak("WALK", 1150, 1550), bacak("BUS", 1100, 6000, "169"),
    ]);
    const normal = guzergah(3000, [
      bacak("BICYCLE", 500, 2000), bacak("WALK", 300, 400), bacak("BUS", 2200, 9000, "12"),
    ]);

    const siralama = rankItineraries([uzunYuruyus, normal], "bicycle_park");
    expect(siralama).toHaveLength(2);
    expect(siralama[0].itin).toBe(normal);
    // Ceza gerçekten uygulanmış olmalı — yoksa kısa olan yalnız süreyle kazanırdı.
    expect(siralama[1].walk.overTarget).toBeGreaterThan(0);
  });

  // Tek bir yürüyüş bacağı 20 dakikayı aşarsa güzergâh HİÇBİR MODDA
  // gösterilmez. Ölçüm — Narlıdere → Çiğli, Pzt 08:00: düz toplu taşımada
  // önerilen kartın ilk bacağı 19 dk, BİSİM modunda 28 dk'ydı; ikisi de eski
  // 5000 m'lik mesafe tavanının altında olduğu için geçiyordu.
  it("20 dakikayı aşan tek yürüyüş bacağı elenir", () => {
    const uzun   = guzergah(1900, [bacak("WALK", 1300, 1700), bacak("BUS", 600, 4000, "169")]);
    const normal = guzergah(2100, [bacak("WALK", 300, 400),   bacak("BUS", 1800, 6000, "12")]);

    const siralama = rankItineraries([uzun, normal], "transit");
    expect(siralama).toHaveLength(1);
    expect(siralama[0].itin).toBe(normal);
  });

  // Sınır dahil kabul: tam 20 dakika geçer, 20 dakika + 1 sn geçmez.
  it("tavan sınırı dahildir", () => {
    const tamTavan = guzergah(1800, [bacak("WALK", 1200, 1500), bacak("BUS", 600, 4000, "169")]);
    const birSaniyeFazla = guzergah(1801, [bacak("WALK", 1201, 1500), bacak("BUS", 600, 4000, "169")]);

    expect(rankItineraries([tamTavan], "transit")).toHaveLength(1);
    expect(rankItineraries([birSaniyeFazla], "transit")).toHaveLength(0);
  });

  // Ölçüm — Asmaaltı → Nergiz civarı: 60 dakikalık yolculuğun sonunda
  // 4 dk / 972 m BİSİM. Mesafe eşiğini (500 m) geçiyordu; itiraz "4 dakika
  // az" değil "o kadar yoldan sonra 4 dakika" olduğu için ölçüt ORAN.
  it("yolculuğun %15'inden kısa bisiklet bacağı elenir", () => {
    const kisaPay = guzergah(3600, [
      bacak("BUS", 1500, 9000, "480"), bacak("WALK", 180, 200),
      bacak("BICYCLE_RENTAL", 240, 972),                    // 240/3600 = %6.7
    ]);
    const yeterliPay = guzergah(3600, [
      bacak("BUS", 1500, 9000, "480"), bacak("WALK", 180, 200),
      bacak("BICYCLE_RENTAL", 900, 3600),                   // 900/3600 = %25
    ]);
    const siralama = rankItineraries([kisaPay, yeterliPay], "bicycle_rent");
    expect(siralama).toHaveLength(1);
    expect(siralama[0].itin).toBe(yeterliPay);
  });

  // KENDİ BİSİKLETİNDE ölçüt oran değil KAZANÇ: bisikletin zaten yanındadır,
  // aranacak araç ve iade edilecek kiralama yok; tek soru daha erken
  // vardırıp vardırmadığı. Taban çizgisi backend'den güzergâha iliştirilmiş
  // gelir (itin.bisikletsizEnIyiSn — services/OtpService.js).
  //
  // Ölçüm — Narlıdere → Çiğli: 72 dk bisikletli, 81 dk bisikletsiz. Bisiklet
  // payı yalnız %8 ama 9 DAKİKA kazandırıyor; oran kuralı bunu eliyor ve mod
  // saflığından beri yedeği de olmadığı için kullanıcı boş ekran görüyordu.
  const bisikletli = (sureSn, tabanSn) => ({
    ...guzergah(sureSn, [
      bacak("BICYCLE", 360, 1245), bacak("WALK", 180, 200),
      bacak("SUBWAY", 1680, 13000, "M1"), bacak("BUS", sureSn - 2220, 8700, "660"),
    ]),
    bisikletsizEnIyiSn: tabanSn,
  });

  it("bisiklet yeterince kazandırıyorsa payı düşük olsa da kalır", () => {
    expect(rankItineraries([bisikletli(4320, 4860)], "bicycle_park")).toHaveLength(1);
  });

  // Asıl derdimiz: 282 m'lik bisiklet bacağı yolculuğu 6.2 dakika UZATIYORDU
  // (Konak → Bornova). Kazanç negatif olduğu için elenir.
  it("bisiklet yolculuğu uzatıyorsa elenir", () => {
    expect(rankItineraries([bisikletli(3018, 2646)], "bicycle_park")).toHaveLength(0);
  });

  it("kazanç eşiğin altındaysa elenir", () => {
    // 1.5 dakika kazanç — eşik 3 dakika. Ölçümde 0.8 ve 1.4 dakikalık
    // kazançlar vardı ve bisikleti çıkarmayı haklı çıkarmıyorlar.
    expect(rankItineraries([bisikletli(4530, 4620)], "bicycle_park")).toHaveLength(0);
  });

  // Eşik tam 3 dakikada geçer. Ölçümde iki senaryo (Konak → Karşıyaka ve
  // Karşıyaka → Bornova) tam +3.1 dakikayla burada duruyor.
  it("tam eşik kadar kazanç yeterlidir", () => {
    expect(rankItineraries([bisikletli(4440, 4620)], "bicycle_park")).toHaveLength(1);
  });

  // Taban sorgusu düşmüş olabilir. Bilinmeyen bir sayı yüzünden kullanıcıyı
  // boş ekranda bırakmak yanlış olur: eleme AÇIK FAİL eder.
  it("taban çizgisi bilinmiyorsa eleme yapılmaz", () => {
    const tabansiz = guzergah(4320, [
      bacak("BICYCLE", 360, 1245), bacak("WALK", 180, 200),
      bacak("SUBWAY", 1680, 13000, "M1"), bacak("BUS", 2100, 8700, "660"),
    ]);
    expect(rankItineraries([tabansiz], "bicycle_park")).toHaveLength(1);
  });

  // MOD SAFLIĞI. Eskiden burada "boş ekran gösterme" diye en iyi aday tek
  // başına döndürülüyordu ve bu, kuralı sessizce geçersiz kılıyordu:
  // "BİSİM + Aktarma" seçen kullanıcı elenmiş 4 dakikalık BİSİM güzergâhını
  // yine görüyordu, üstelik alternatifsiz. Mod seçimi bir vaattir;
  // tutulamıyorsa doğru yanıt sebebini söylemektir (useRouteSearch).
  it("mod amacına uymayan tek aday gösterilmez — son çare kartı yok", () => {
    const kisaBisiklet = guzergah(1500, [
      bacak("BICYCLE", 120, 300), bacak("WALK", 180, 200), bacak("BUS", 1200, 6000, "169"),
    ]);
    expect(rankItineraries([kisaBisiklet], "bicycle_park")).toHaveLength(0);
  });

  // Amacı OLMAYAN modlarda (düz transit, araba) eski davranış korunur:
  // orada eleme yalnız yürüyüş tavanından gelir ve gösterilecek en iyi
  // aday hâlâ o modun işini görüyordur.
  it("amacı olmayan modlarda son çare kartı korunur", () => {
    const tekAday = guzergah(1800, [bacak("WALK", 300, 400), bacak("BUS", 1500, 6000, "12")]);
    expect(rankItineraries([tekAday], "transit")).toHaveLength(1);
  });

  // Yürüyüş tavanının İSTİSNASI YOKTUR. Eskiden son çare olarak "hiç yoktan
  // iyidir" diye tavanı aşan güzergâh da gösterilebiliyordu; 20 dakika sert
  // bir kural olduğu için artık doğru yanıt boş listedir ve çağıran bunu
  // kullanıcıya sebebiyle söyler (hooks/useRouteSearch.js).
  it("tek aday tavanı aşıyorsa boş liste döner — istisna yok", () => {
    const uzunYuruyus = guzergah(1900, [bacak("WALK", 1300, 1700), bacak("BUS", 600, 4000, "169")]);
    expect(rankItineraries([uzunYuruyus], "transit")).toHaveLength(0);
  });

  it("aynı rota kümesini profile göre farklı sıralar", () => {
    // 800 m yürüyüş: transit hedefinin (2000) altında, bisiklet hedefinin (600) üstünde
    const yuruyusluRota = guzergah(1200, [bacak("WALK", 600, 800), bacak("BICYCLE", 600, 3000)]);
    const kisaYuruyus   = guzergah(1400, [bacak("WALK", 200, 200), bacak("BICYCLE", 1200, 4000)]);

    // Transit profilinde bisiklet cezası yok ama yürüyüş ağır (walkKm 7):
    // 600 m'lik yürüyüş farkı 4.2 puan, süre farkı ise yalnız 3.3 dk.
    const transit = rankItineraries([yuruyusluRota, kisaYuruyus], "transit");
    expect(transit).toHaveLength(2);
    expect(transit[0].itin).toBe(kisaYuruyus);

    // Bisiklet profilinde ikisi de KALIR — sert eleme yalnız mod amacına ait,
    // yürüyüş hedefi artık ceza. İkisinde de bisiklet var, ikisi de geçer.
    const bisiklet = rankItineraries([yuruyusluRota, kisaYuruyus], "bicycle");
    expect(bisiklet).toHaveLength(2);
  });

  // bikeKm cezasının kendisi: pedal çevirmek de zahmettir.
  // Ölçüm (Konak → Karşıyaka): ceza yokken 63.3 dk'lık saf sürüş,
  // 55.1 dk'lık BİSİM+tren güzergâhını 1.7 puanla geçiyordu — çünkü
  // yürüyüşe ceza yazılıp bisiklete yazılmıyordu.
  it("eşit sürede daha çok pedal çeviren güzergâh geride kalır", () => {
    const azBisiklet = guzergah(1800, [bacak("WALK", 300, 400), bacak("BICYCLE", 1500, 3000)]);
    const cokBisiklet = guzergah(1800, [bacak("WALK", 300, 400), bacak("BICYCLE", 1500, 12000)]);

    const r = rankItineraries([cokBisiklet, azBisiklet], "bicycle_rent");
    expect(r[0].itin).toBe(azBisiklet);
    // 9 km fark × bikeKm(1) = 9 puanlık ceza farkı
    expect(r[1].score - r[0].score).toBeCloseTo(9, 1);
  });

  it("yürüyüş ve aktarma bilgisini hesaplayıp taşır", () => {
    const rota = guzergah(1800, [
      bacak("WALK", 300, 400), bacak("BUS", 600, 4000, "169"),
      bacak("WALK", 120, 150), bacak("TRAM", 600, 3000, "T1"),
    ]);
    const [sonuc] = rankItineraries([rota], "transit");
    expect(sonuc.walk.total).toBe(550);
    expect(sonuc.walk.maxLeg).toBe(400);
    expect(sonuc.walk.transfers).toBe(1);
    expect(sonuc.walk.duration).toBe(1800);
  });
});

describe("candidateKey", () => {
  it("aynı süre, yürüyüş ve hatlara sahip rotalar için aynı anahtarı üretir", () => {
    const a = guzergah(1800, [bacak("WALK", 300, 300), bacak("BUS", 1500, 5000, "169")]);
    const b = guzergah(1800, [bacak("WALK", 300, 300), bacak("BUS", 1500, 5200, "169")]);
    const walk = { duration: 1800, total: 300 };
    expect(candidateKey(a, walk)).toBe(candidateKey(b, walk));
  });

  it("farklı hat kullanan rotaları ayırır", () => {
    const a = guzergah(1800, [bacak("BUS", 1800, 5000, "169")]);
    const b = guzergah(1800, [bacak("BUS", 1800, 5000, "12")]);
    const walk = { duration: 1800, total: 0 };
    expect(candidateKey(a, walk)).not.toBe(candidateKey(b, walk));
  });
});

describe("selectCandidates", () => {
  it("birebir aynı rotaları tek karta indirir", () => {
    const rota = guzergah(1800, [bacak("WALK", 300, 300), bacak("BUS", 1500, 5000, "169")]);
    const kopya = guzergah(1800, [bacak("WALK", 300, 300), bacak("BUS", 1500, 5000, "169")]);

    const adaylar = selectCandidates(rankItineraries([rota, kopya], "transit"), "transit");
    expect(adaylar).toHaveLength(1);
    expect(adaylar[0].tag).toBe("Önerilen");
  });

  it("farklı rotalara farklı etiketler dağıtır", () => {
    const hizli    = guzergah(1200, [bacak("WALK", 300, 900), bacak("BUS", 900, 6000, "169")]);
    const azAktarma = guzergah(2400, [bacak("WALK", 400, 500), bacak("RAIL", 2000, 9000, "M1")]);

    const adaylar = selectCandidates(rankItineraries([hizli, azAktarma], "transit"), "transit");
    const etiketler = adaylar.map((a) => a.tag);
    expect(etiketler).toContain("Önerilen");
    expect(etiketler.length).toBeGreaterThan(1);
  });

  it("profil başına kart sayısı sınırını aşmaz", () => {
    // 8 farklı hat → transit için en fazla 5 kart
    const cokRota = Array.from({ length: 8 }, (_, i) =>
      guzergah(1200 + i * 60, [bacak("WALK", 200, 200 + i * 10), bacak("BUS", 1000, 5000, `H${i}`)])
    );
    const adaylar = selectCandidates(rankItineraries(cokRota, "transit"), "transit");
    expect(adaylar.length).toBeLessThanOrEqual(5);
  });

  it("araba profilinde en fazla 2 kart gösterir", () => {
    const cokRota = Array.from({ length: 5 }, (_, i) =>
      guzergah(900 + i * 60, [bacak("CAR", 900 + i * 60, 8000 + i * 500)])
    );
    const adaylar = selectCandidates(rankItineraries(cokRota, "car"), "car");
    expect(adaylar.length).toBeLessThanOrEqual(2);
  });

  it("her adaya karbon değeri ekler", () => {
    const rota = guzergah(900, [bacak("CAR", 900, 10000)]);
    const [aday] = selectCandidates(rankItineraries([rota], "car"), "car");
    expect(aday.carbon).toBeCloseTo(1500, 5);
  });
});

describe("buildRouteResult", () => {
  const rota = guzergah(1800, [
    bacak("WALK", 300, 400),
    bacak("BUS", 600, 4000, "169"),
    bacak("WALK", 120, 150),
    bacak("TRAM", 780, 3000, "T1"),
  ]);

  const aday = () => {
    const [siralanan] = rankItineraries([rota], "transit");
    return { ...siralanan, carbon: calcCarbonGrams(rota.legs), tag: "Önerilen", tagColor: "#60a5fa" };
  };

  it("aktarma sayısını transit bacak sayısından bir eksik verir", () => {
    const sonuc = buildRouteResult(aday(), 35, false, "transit");
    expect(sonuc.transfers).toBe(1);
  });

  it("İzmirim Kart ile tek ücret, kredi kartı ile biniş başına ücret uygular", () => {
    expect(buildRouteResult(aday(), 35, false, "transit").cost).toBe(35);
    expect(buildRouteResult(aday(), 39, true, "transit").cost).toBe(78); // 2 biniş
  });

  it("her bacağa arayüz için renk, ikon ve etiket ekler", () => {
    const sonuc = buildRouteResult(aday(), 35, false, "transit");
    expect(sonuc.legs[1].label).toBe("Otobüs");
    expect(sonuc.legs[1].routeName).toBe("169");
    expect(sonuc.legs[3].label).toBe("Tramvay");
    expect(sonuc.legs[0].icon).toBe("walk");
  });

  it("toplam süreyi bacaklardan toplar", () => {
    expect(buildRouteResult(aday(), 35, false, "transit").totalDuration).toBe(1800);
  });

  it("toplam mesafeyi tüm bacaklardan, yürüyüşü yalnız yürüme bacaklarından toplar", () => {
    const sonuc = buildRouteResult(aday(), 35, false, "transit");
    // 400 + 4000 + 150 + 3000 = 7550 m, bunun 550 m'si yürüyüş
    expect(sonuc.totalDistance).toBe("7.5");
    expect(sonuc.walkDistance).toBe("0.6");
  });

  it("her bacağa metre cinsinden mesafe ekler", () => {
    const sonuc = buildRouteResult(aday(), 35, false, "transit");
    expect(sonuc.legs.map((l) => l.distanceMeters)).toEqual([400, 4000, 150, 3000]);
  });

  it("İZBAN bacağını banliyö olarak etiketler, metrodan ayırır", () => {
    const izban = guzergah(1200, [bacak("RAIL", 600, 9000, "İZBAN"), bacak("SUBWAY", 600, 5000, "M1")]);
    const [siralanan] = rankItineraries([izban], "transit");
    const sonuc = buildRouteResult(
      { ...siralanan, carbon: 0, tag: "Önerilen", tagColor: "#60a5fa" },
      35, false, "transit"
    );
    expect(sonuc.legs[0].label).toBe("Banliyö");
    expect(sonuc.legs[1].label).toBe("Metro");
    expect(sonuc.legs[0].color).not.toBe(sonuc.legs[1].color);
  });

  it("eşik aşılmadığında yürüyüş uyarısı vermez", () => {
    expect(buildRouteResult(aday(), 35, false, "transit").walkWarning).toBeNull();
  });

  it("uzun yürüyüş bacağında uyarı üretir", () => {
    // Hedefin (bicycle_park: 1500 m) üstünde ama 20 dk tavanının altında:
    // uyarı gösterilir, güzergâh elenmez.
    const uzun = guzergah(2650, [
      bacak("BICYCLE", 400, 2000), bacak("WALK", 1150, 2500), bacak("BUS", 1100, 6000, "169"),
    ]);
    const [siralanan] = rankItineraries([uzun], "bicycle_park");
    const sonuc = buildRouteResult(
      { ...siralanan, carbon: 0, tag: "Önerilen", tagColor: "#60a5fa" },
      35, false, "bicycle_park"
    );
    expect(sonuc.walkWarning).toContain("2.5 km");
  });

  // Bisiklet metroya bindirilebiliyor: öyle bir güzergâhta bisiklet bacağı
  // transitten SONRA yeniden başlar, yani hiçbir yere park edilmemiştir.
  // Kontrol olmadan haritaya uğranmayacak bir park pini konuyordu.
  it("bisiklet transitten sonra devam ediyorsa park noktası yoktur", () => {
    const tasinan = guzergah(2400, [
      { ...bacak("BICYCLE", 400, 2000), to: { name: "Konak", lat: 38.41, lon: 27.12 } },
      bacak("SUBWAY", 1200, 9000, "M1"),
      bacak("BICYCLE", 800, 3500),
    ]);
    const [siralanan] = rankItineraries([tasinan], "bicycle_park");
    const sonuc = buildRouteResult(
      { ...siralanan, carbon: 0, tag: "Önerilen", tagColor: "#60a5fa" },
      35, false, "bicycle_park"
    );
    expect(sonuc.parkingPoint).toBeNull();
  });

  it("park noktasını araç bacağının varışından çıkarır", () => {
    const parkli = guzergah(1800, [
      { ...bacak("CAR", 600, 8000), to: { name: "Bornova Otoparkı", lat: 38.46, lon: 27.21 } },
      bacak("WALK", 200, 250),
      bacak("RAIL", 1000, 6000, "M1"),
    ]);
    const [siralanan] = rankItineraries([parkli], "park_and_ride");
    const sonuc = buildRouteResult(
      { ...siralanan, carbon: 0, tag: "Önerilen", tagColor: "#60a5fa" },
      35, false, "park_and_ride"
    );
    expect(sonuc.parkingPoint).toEqual({ lat: 38.46, lon: 27.21, name: "Bornova Otoparkı" });
  });

  it("araç bacağı son bacaksa park noktası üretmez", () => {
    const direkt = guzergah(900, [
      { ...bacak("CAR", 900, 9000), to: { name: "Varış", lat: 38.46, lon: 27.21 } },
    ]);
    const [siralanan] = rankItineraries([direkt], "car");
    const sonuc = buildRouteResult(
      { ...siralanan, carbon: 0, tag: "Önerilen", tagColor: "#60a5fa" },
      35, false, "car"
    );
    expect(sonuc.parkingPoint).toBeNull();
  });
});

// ─── Anlamsız bisiklet bacağı ──────────────────────────────────────────
// Ölçüm (Konak → Bornova, Pzt 08:00): 282 m'lik bisiklet bacağı yolculuğu
// 6.2 DAKİKA uzatıyordu (50.3 dk yerine yürüyüşle 44.1 dk). Bisiklet burada
// bir erişim aracı ve o işi görmüyor; kilit açma/kilitleme külfeti sürüşün
// kendisinden uzun.
describe("bisiklet bacağı çok kısaysa", () => {
  const kisa = { legs: [bacak("BICYCLE", 200, 282), bacak("WALK", 120, 150), bacak("SUBWAY", 900, 6000)] };
  const uzun = { legs: [bacak("BICYCLE", 900, 4041), bacak("WALK", 120, 150), bacak("RAIL", 900, 6000)] };

  test("transit içeren güzergâhta elenir", () => {
    const r = rankItineraries([kisa, uzun], "bicycle_park");
    expect(r).toHaveLength(1);
    expect(r[0].walk.bikeMeters).toBe(4041);
  });

  test("eşik altındaki tek aday transit varsa elenir ve liste boş kalır", () => {
    // Mod saflığı: bisiklet modunda "aslında bisikletsiz" bir kart
    // gösterilmez. Sebebi kullanıcıya arayüzde yazılır.
    expect(rankItineraries([kisa], "bicycle_park")).toHaveLength(0);
  });

  // Transit yoksa bisiklet yolculuğun kendisidir; 300 m öteye gitmek meşru.
  test("transit yoksa kısa bisiklet elenmez", () => {
    // 282 m'lik bir bisiklet bacağı, transit varken "erişim aracı olarak
    // işe yaramıyor" demektir. Transit yoksa bisiklet yolculuğun KENDİSİDİR
    // ve kısa olması meşrudur. BIKE_LEG_MIN yine de geçilmeli, o yüzden
    // bacak eşiğin üstünde tutuldu.
    const sadeceBisiklet = { legs: [bacak("BICYCLE", 200, 900)] };
    const r = rankItineraries([sadeceBisiklet], "bicycle_park");
    expect(r).toHaveLength(1);
    expect(r[0].walk.bisikletAnlamsiz).toBe(false);
  });

  // Eşik yalnız bisikletin ERİŞİM aracı olduğu profillerde tanımlı.
  test("eşik yalnız karma profillerde tanımlı", () => {
    expect(BIKE_LEG_MIN.bicycle_park).toBe(800);
    expect(BIKE_LEG_MIN.bicycle_rent).toBe(500);
    expect(BIKE_LEG_MIN.bicycle).toBeUndefined();
    expect(BIKE_LEG_MIN.transit).toBeUndefined();
  });
});

// ─── Mod amacı: sert eleme yalnız buraya ait ────────────────────────────
// Ölçüm: "Sadece bisiklet" modunda 8 güzergâhın 7'sinde HİÇ bisiklet yoktu —
// düz transit rotalarıydı, yani mod kullanıcıya yalan söylüyordu.
describe("MOD_AMACI", () => {
  const bisikletli = { legs: [bacak("BICYCLE", 900, 4000), bacak("RAIL", 900, 6000)] };
  const bisikletsiz = { legs: [bacak("WALK", 300, 400), bacak("RAIL", 900, 6000)] };

  test("BİSİM modunda bisikletsiz güzergâh elenir", () => {
    const r = rankItineraries([bisikletsiz, bisikletli], "bicycle_rent");
    expect(r).toHaveLength(1);
    expect(r[0].walk.bikeMeters).toBe(4000);
  });

  test("düz transit modunda mod amacı uygulanmaz", () => {
    expect(rankItineraries([bisikletsiz, bisikletli], "transit")).toHaveLength(2);
  });

  test("Park & Ride: araç 13 km / transit 0.3 km olan güzergâh elenir", () => {
    // Ölçüm: korfez-karsi senaryosunda araç 13309 m, transit 276 m çıkmıştı.
    const sahteParkRide = { legs: [bacak("CAR", 900, 13309), bacak("BUS", 120, 276)] };
    const gercekParkRide = { legs: [bacak("CAR", 400, 5000), bacak("RAIL", 900, 9000)] };
    const r = rankItineraries([sahteParkRide, gercekParkRide], "park_and_ride");
    expect(r).toHaveLength(1);
    expect(r[0].itin).toBe(gercekParkRide);
  });

  test("hiçbiri amaca uymazsa boş liste döner", () => {
    // "BİSİM + Aktarma" seçen kullanıcıya BİSİM'siz kart gösterilmez.
    expect(rankItineraries([bisikletsiz], "bicycle_rent")).toHaveLength(0);
  });
});

// ─── Öneri sınırı ───────────────────────────────────────────────────────
// Ölçüm (Bostanlı → Konak, DÜZ TOPLU TAŞIMA — bisikletle ilgisi yok):
//   58.6 dk  WALK>BUS>WALK               skor 62.9  ← Önerilen olmuştu
//   45.9 dk  WALK>RAIL>WALK>SUBWAY>WALK  skor 66.9
// 12.7 dakika daha hızlı güzergâh, 1.5 km yürüyüş + 1 aktarma için yazılan
// 21 puanla geriye düşüyordu. Cezalar süreyle orantılı olmadığı için
// yeterince birikince her modda olabilir; bu sınır hasarı bağlar.
describe("öneri sınırı", () => {
  const kayit = (dakika) => ({
    itin: { legs: [] },
    walk: { duration: dakika * 60 },
    score: 0,
  });

  test("çok yavaş olan baştan alınır, sınırı sağlayan öne geçer", () => {
    // 58.6 / 45.9 = 1.28 > transit toleransı 1.20
    const liste = [kayit(58.6), kayit(53.0), kayit(45.9)];
    const r = oneriSinirinaUydur(liste, "transit");
    expect(r[0].walk.duration / 60).toBeCloseTo(53.0, 1);
    // Liste yeniden dizilmez, yalnız baş değişir.
    expect(r).toHaveLength(3);
  });

  test("sınır zaten sağlanıyorsa liste dokunulmadan döner", () => {
    const liste = [kayit(46), kayit(50)];
    expect(oneriSinirinaUydur(liste, "transit")).toBe(liste);
  });

  test("toleransı olmayan profilde dokunulmaz", () => {
    const liste = [kayit(90), kayit(30)];
    expect(oneriSinirinaUydur(liste, "bilinmeyen")).toBe(liste);
  });

  test("her modun kendi toleransı var", () => {
    // Araba yolculuğunun amacı hız; sapmaya en az tolerans orada.
    expect(ONERI_TOLERANSI.park_and_ride).toBeLessThan(ONERI_TOLERANSI.bicycle_rent);
  });
});

// ─── Aynı hattın ardışık kalkışları ────────────────────────────────────
// Ölçüm (Konak → Bornova): dönen 10 güzergâhın 10'u da M1'di, yalnız
// kalkışlar farklıydı (08:06, 08:07, 08:16 …). Kullanıcı aynı kartı on kez
// görüyordu.
describe("aynı hattı tekilleştirme", () => {
  const hatli = (mode, shortName) => ({ ...bacak(mode, 900, 6000), route: { shortName } });
  const k = (legs) => ({ itin: { legs }, walk: {}, score: 0 });

  test("aynı hattın ardışık kalkışları teke iner", () => {
    const liste = [
      k([bacak("WALK", 200, 250), hatli("SUBWAY", "M1"), bacak("WALK", 200, 250)]),
      k([bacak("WALK", 200, 250), hatli("SUBWAY", "M1"), bacak("WALK", 200, 250)]),
      k([bacak("WALK", 200, 250), hatli("SUBWAY", "M1"), bacak("WALK", 200, 250)]),
    ];
    expect(ayniHattiTekilleştir(liste)).toHaveLength(1);
  });

  test("farklı hatlar korunur", () => {
    const liste = [
      k([hatli("SUBWAY", "M1")]),
      k([hatli("BUS", "121")]),
      k([hatli("SUBWAY", "M1"), hatli("RAIL", "İZBAN")]),
    ];
    expect(ayniHattiTekilleştir(liste)).toHaveLength(3);
  });

  test("en iyi puanlı olan tutulur (liste sıralı gelir)", () => {
    const ilk = k([hatli("SUBWAY", "M1")]);
    const sonra = k([hatli("SUBWAY", "M1")]);
    expect(ayniHattiTekilleştir([ilk, sonra])[0]).toBe(ilk);
  });
});

// ─── Aday etiketleri ───────────────────────────────────────────────────
describe("aday etiketleri", () => {
  const hatli = (mode, dur, dist, kisa) => ({ ...bacak(mode, dur, dist), route: { shortName: kisa } });

  // Aktarmasız + hızlı olan; aktarmalı + yavaş olan
  const hizli   = { legs: [bacak("WALK", 200, 250), hatli("SUBWAY", 1200, 9000, "M1")] };
  const aktarma = { legs: [bacak("WALK", 200, 250), hatli("BUS", 900, 5000, "121"),
                           bacak("WALK", 120, 150), hatli("BUS", 900, 5000, "285")] };

  test("aynı güzergâh birden çok üstünlüğe sahipse etiket düşmez, eklenir", () => {
    // Ölçüm: eskiden "En Hızlı" 60 mod-senaryonun yalnız 6'sında görünüyordu;
    // Önerilen'le aynı güzergâhı seçtiğinde tamamen atılıyordu.
    const k = selectCandidates(rankItineraries([hizli, aktarma], "transit"), "transit", 17, true);
    expect(k[0].etiketler).toContain("Önerilen");
    expect(k[0].etiketler).toContain("En Hızlı");
  });

  test("ölçüsü değişmeyen etiket hiç gösterilmez", () => {
    // Düz tarife (İzmirim Kart, 90 dk aktarma dahil): her güzergâh aynı
    // ücrete gelir, dolayısıyla "En Ucuz" bilgi taşımaz.
    const duzTarife = selectCandidates(rankItineraries([hizli, aktarma], "transit"), "transit", 17, false);
    expect(duzTarife.flatMap((c) => c.etiketler)).not.toContain("En Ucuz");

    // Kredi kartı: her biniş ayrı ücret → aktarmasız olan ucuzdur.
    const binisBasi = selectCandidates(rankItineraries([hizli, aktarma], "transit"), "transit", 17, true);
    expect(binisBasi.flatMap((c) => c.etiketler)).toContain("En Ucuz");
  });

  test("etiket vaadini tutar: En Hızlı gerçekten en hızlıdır", () => {
    const k = selectCandidates(rankItineraries([aktarma, hizli], "transit"), "transit", 17, true);
    const enHizliKart = k.find((c) => c.etiketler.includes("En Hızlı"));
    const gercekEnHizli = Math.min(...k.map((c) => c.walk.duration));
    expect(enHizliKart.walk.duration).toBe(gercekEnHizli);
  });

  test("tek güzergâhta yalnız Önerilen kalır", () => {
    const k = selectCandidates(rankItineraries([hizli], "transit"), "transit", 17, true);
    expect(k).toHaveLength(1);
    expect(k[0].etiketler).toEqual(["Önerilen"]);
  });

  test("etiket listesi tektir — moda göre elle tutulan tablo yok", () => {
    // Elle tutulan tablo hata kaynağıydı: "Çevreci" bisiklet modlarında
    // unutulmuştu, oysa orada en ayırt edici etiket oydu (4/4, 6/7).
    expect(ADAY_OLCULERI.map((x) => x.tag)).toEqual(
      ["Önerilen", "En Hızlı", "Az Aktarma", "En Ucuz", "Çevreci"]
    );
    expect(ADAY_OLCULERI[0].olcu).toBeNull();
  });
});
