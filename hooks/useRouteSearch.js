import { useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchRoute as apiFetchRoute } from "../Services/routeService";
import {
  resolveProfileKey, rankItineraries, selectCandidates, buildRouteResult,
} from "../utils/routeScoring";

// BİSİM'in gerçek zamanlı doluluk verisi 2025-07-23'ten beri yayınlanmıyor,
// bu yüzden backend GBFS feed'inde is_renting=false gönderilir ve OTP kiralama
// rotası üretmez. Bu bir bağlantı hatası değil, veri kaynağının kesilmesidir —
// kullanıcıya doğru sebep ve kullanılabilir alternatif gösterilir.
const BISIM_UNAVAILABLE_MSG =
  "BİSİM'in anlık bisiklet doluluğu şu anda yayınlanmıyor, bu yüzden kiralama " +
  "rotası oluşturulamıyor. İstasyonlar haritada görünmeye devam ediyor. " +
  "Dilerseniz \"Kendi Bisikletim\" seçeneğiyle devam edebilirsiniz.";

async function saveToHistory(best, fromName, toName, profile) {
  try {
    const raw = await AsyncStorage.getItem("routeHistory");
    const history = raw ? JSON.parse(raw) : [];
    history.unshift({
      originName: fromName || "Başlangıç",
      destName: toName || "Varış",
      duration: Math.round(best.totalDuration / 60),
      mode: profile,
      date: new Date().toLocaleDateString("tr-TR"),
    });
    await AsyncStorage.setItem("routeHistory", JSON.stringify(history.slice(0, 20)));
  } catch {}
}

export function useRouteSearch(fareBase = 35, farePerBoarding = false) {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchRoute = async (from, to, prof, fromName = "", toName = "", bikeType = null, carMode = null) => {
    setLoading(true);
    setError(null);
    setRoutes([]);

    const effectiveProf = prof === "car" && carMode === "park_and_ride" ? "park_and_ride" : prof;
    const profileKey = resolveProfileKey(effectiveProf, bikeType);

    try {
      const data = await apiFetchRoute(from, to, effectiveProf, effectiveProf === "bicycle" ? bikeType : null);
      if (data.error) { setError(data.error); return null; }

      const itineraries = data.itineraries || [];
      const routingErrors = data.routingErrors || [];

      if (itineraries.length === 0) {
        const otpMsg = routingErrors.map((e) => e.description || e.code).join("; ");
        setError(otpMsg || "Rota bulunamadı.");
        return null;
      }

      // BİSİM kiralama modunda yalnızca bisiklet kiralama bacağı olan rotalar gösterilir.
      let validItineraries = itineraries;
      if (profileKey === "bicycle_rent") {
        validItineraries = itineraries.filter((itin) =>
          itin.legs.some((l) => l.mode === "BICYCLE_RENTAL")
        );
        if (validItineraries.length === 0) {
          const modes = [...new Set(itineraries.flatMap((i) => i.legs.map((l) => l.mode)))];
          console.warn("BİSİM: OTP rota döndü ama BICYCLE_RENTAL yok. Modlar:", modes);
          setError(BISIM_UNAVAILABLE_MSG);
          return null;
        }
      }

      const ranked = rankItineraries(validItineraries, profileKey);
      const candidates = selectCandidates(ranked, profileKey);
      const routeResults = candidates.map((c) => buildRouteResult(c, fareBase, farePerBoarding, profileKey));

      setRoutes(routeResults);
      await saveToHistory(routeResults[0], fromName, toName, prof);

      return routeResults;
    } catch (err) {
      // ApiError ağ hatası / 502 / 404 ayrımını taşır; kullanıcıya "bağlanılamadı"
      // demek yerine gerçek sebebi göster. Başka bir hata türü gelirse genel metin.
      setError(err?.userMessage || "Sunucuya bağlanılamadı.");
      console.warn("Rota isteği başarısız:", err?.message ?? err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const clearRoute = () => { setRoutes([]); setError(null); };

  return { routes, loading, error, fetchRoute, clearRoute };
}
