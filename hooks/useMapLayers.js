import { useState, useEffect, useMemo } from "react";
import { fetchBisimZones, fetchPrStations, fetchBikePrStations } from "../Services/api";
import { describeLayerError } from "../utils/layerStatus";

// HARİTA KATMANLARI.
//
// HomeScreen'den ayrıldı: seçili moda göre hangi katmanın yükleneceği saf
// bir kural ve haritaya, kameraya, navigasyona hiç bağlı değil. Ayrı
// durunca test edilebiliyor.

// BİSİM katmanı İKİ geometri taşır: bonus bölgeleri ve hizmet alanı. Boş
// hâli de aynı biçimde olmalı — `[]` bırakan bir temizlik hizmet alanını
// haritada asılı bırakıyordu.
export const BISIM_BOS = { bolgeler: [], hizmetAgi: [] };

// Saf kural: (profil, bisiklet modu, araba modu) → hangi katman, hangi adla.
//
// `ad` yalnız etiket değil, hata metninin kendisi: kullanıcı "istasyon yok"
// ile "sunucuya ulaşılamıyor" arasındaki farkı ancak katmanın adıyla
// görüyor.
export function katmanPlani(profile, bikeType, carMode) {
  if (profile === "bicycle") {
    return bikeType === "RENT"
      ? { hedef: "bisim", tumu: null, ad: "BİSİM bölgeleri" }
      : { hedef: "bisikletPark", tumu: null, ad: "Bisiklet park noktaları" };
  }
  if (profile === "car") {
    // Otopark katmanı arabanın İKİ ALT MODUNDA DA açılır, kümesi değişir:
    // P+R'de rotanın gerçekten kullandığı otoparklar, düz sürüşte
    // envanterin tamamı. Düz sürüşte rota hiçbir yere park etmiyor —
    // otopark orada yalnız "varınca nereye bırakabilirim" bilgisi.
    const prMi = carMode === "park_and_ride";
    return {
      hedef: "otopark",
      tumu: !prMi,
      ad: prMi ? "Park + Devam otoparkları" : "Otoparklar",
    };
  }
  return { hedef: null, tumu: null, ad: null };
}

const VARSAYILAN_SERVISLER = { fetchBisimZones, fetchPrStations, fetchBikePrStations };

export function useMapLayers(profile, bikeType, carMode, servisler = VARSAYILAN_SERVISLER) {
  const [bisim, setBisim] = useState(BISIM_BOS);
  const [parkingStations, setParkingStations] = useState([]);
  const [prStations, setPrStations] = useState([]);
  // Katmanlar eskiden `.catch(() => {})` ile yükleniyordu: hata yutulur,
  // liste boş kalırdı ve kullanıcı sebebi hiç göremezdi.
  const [layerError, setLayerError] = useState(null);

  // Plan kimliği efektin bağımlılığı: bisiklet modunu değiştirmek araba
  // katmanını yeniden çekmesin diye.
  const plan = useMemo(
    () => katmanPlani(profile, bikeType, carMode),
    [profile, bikeType, carMode]
  );

  useEffect(() => {
    setLayerError(null);
    if (plan.hedef !== "bisim") setBisim(BISIM_BOS);
    if (plan.hedef !== "bisikletPark") setParkingStations([]);
    if (plan.hedef !== "otopark") setPrStations([]);
    if (!plan.hedef) return;

    let gecerli = true;
    const yukleyiciler = {
      bisim: [() => servisler.fetchBisimZones(), setBisim, BISIM_BOS],
      bisikletPark: [() => servisler.fetchBikePrStations(), setParkingStations, []],
      otopark: [() => servisler.fetchPrStations({ tumu: plan.tumu }), setPrStations, []],
    };
    const [yukle, yaz, bosDeger] = yukleyiciler[plan.hedef];

    // Başarıda listeyi yaz ve uyarıyı temizle; hatada listeyi boşalt ve
    // NEDENİ göster. `gecerli` bayrağı: mod hızlı değiştirildiğinde geç
    // gelen yanıt yeni katmanın üstüne yazmasın.
    yukle()
      .then((liste) => {
        if (!gecerli) return;
        yaz(liste);
        setLayerError(null);
      })
      .catch((err) => {
        if (!gecerli) return;
        yaz(bosDeger);
        setLayerError(describeLayerError(plan.ad, err));
        console.warn(`Katman hatası (${plan.ad}):`, err?.message ?? err);
      });

    return () => { gecerli = false; };
  }, [plan.hedef, plan.tumu]);

  return {
    bisim,
    parkingStations,
    prStations,
    layerError,
    clearLayerError: () => setLayerError(null),
  };
}
