import { useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchRoute as apiFetchRoute, fetchBisimRealtimeStations } from "../Services/routeService";
import { haversineMeters } from "../utils/geo";
import {
  resolveProfileKey, rankItineraries, selectCandidates, buildRouteResult,
} from "../utils/routeScoring";

// Neden BİSİM rotası oluşturulamadığını gerçek zamanlı veriyle teşhis eder
async function diagnoseBisimError(from) {
  const NEARBY_M = 600; // 600m yarıçap
  try {
    const stations = await fetchBisimRealtimeStations();
    const nearby = stations.filter(
      (st) => haversineMeters(from, { latitude: st.lat, longitude: st.lon }) <= NEARBY_M
    );
    if (nearby.length === 0) {
      return "Başlangıç noktanıza yakın BİSİM istasyonu yok. Farklı bir konum deneyin.";
    }
    return "Bu güzergah için BİSİM rotası oluşturulamadı. Bisikletsiz bir rota seçebilirsiniz.";
  } catch {
    return "BİSİM bilgisine ulaşılamadı. Bağlantınızı kontrol edip tekrar deneyin.";
  }
}

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
          setError(await diagnoseBisimError(from));
          return null;
        }
      }

      const ranked = rankItineraries(validItineraries, profileKey);
      const candidates = selectCandidates(ranked, profileKey);
      const routeResults = candidates.map((c) => buildRouteResult(c, fareBase, farePerBoarding, profileKey));

      setRoutes(routeResults);
      await saveToHistory(routeResults[0], fromName, toName, prof);

      return routeResults;
    } catch {
      setError("Sunucuya bağlanılamadı.");
      return null;
    } finally {
      setLoading(false);
    }
  };

  const clearRoute = () => { setRoutes([]); setError(null); };

  return { routes, loading, error, fetchRoute, clearRoute };
}
