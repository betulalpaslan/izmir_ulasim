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
// Mod seçimi bir vaattir: "BİSİM + Aktarma" seçen kullanıcıya BİSİM'siz,
// "Bisikletim + Aktarma" seçene bisikletsiz güzergâh gösterilmez. Vaat
// tutulamıyorsa sebebi yazılır — başka bir modun sonucunu o modmuş gibi
// göstermek yerine.
const MOD_BOS_MESAJI = {
  bicycle_rent:
    "Bu yolculuk için BİSİM'li bir güzergâh kurulamadı — başlangıç ya da varış " +
    "hizmet alanının dışında kalıyor, ya da bisiklet yolculuğa anlamlı bir katkı " +
    "sağlamıyor olabilir. Hizmet alanı haritada görünmeye devam ediyor.",
  bicycle_park:
    "Bu yolculuk için bisikletli bir güzergâh kurulamadı — bisiklet yolculuğa " +
    "anlamlı bir katkı sağlamıyor. Toplu taşıma seçeneğine bakabilirsiniz.",
  park_and_ride:
    "Bu yolculuk için Park + Devam güzergâhı kurulamadı — araç ya da toplu taşıma " +
    "tarafı anlamlı bir mesafe tutmuyor.",
};

// Yürüyüş tavanı (tek bacakta 20 dk) her güzergâhı elediğinde gösterilir.
// Boş liste ile "sunucuya ulaşılamadı" ayırt edilemiyordu; kullanıcı sebebi
// bilmeden aynı aramayı tekrarlıyordu.
const YURUYUS_TAVANI_MSG =
  "Bu yolculuk için bulunan güzergâhların hepsinde tek seferde 20 dakikadan " +
  "uzun yürüyüş var. Başka bir mod deneyebilir ya da başlangıç/varış noktasını " +
  "bir durağa yakın seçebilirsiniz.";

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
  // Hata değil, açıklama: sonuç geçerli ama kullanıcının seçtiği moddan
  // farklı bir şey gösteriliyor. Sessizce yapmak yanıltıcı olurdu.
  const [notice, setNotice] = useState(null);

  const fetchRoute = async (from, to, prof, fromName = "", toName = "", bikeType = null, carMode = null) => {
    setLoading(true);
    setError(null);
    setNotice(null);
    setRoutes([]);

    const effectiveProf = prof === "car" && carMode === "park_and_ride" ? "park_and_ride" : prof;
    const secilenKey = resolveProfileKey(effectiveProf, bikeType);

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

      const profileKey = secilenKey;

      // Mod saflığı: bisiklet modlarında ARAÇSIZ güzergâh gösterilmez.
      // BİSİM'de kiralık bisiklet, kendi bisikletinde bisiklet bacağı şart.
      // (Backend'in eski "bisikletsiz yedek" sorgusu tam da bu yüzden
      // kaldırıldı — bkz. services/OtpService.js.)
      const ARANAN = {
        bicycle_rent: (l) => l.mode === "BICYCLE_RENTAL",
        bicycle_park: (l) => l.mode === "BICYCLE" || l.mode === "BICYCLE_RENTAL",
      };
      let validItineraries = itineraries;
      const aranan = ARANAN[profileKey];
      if (aranan) {
        validItineraries = itineraries.filter((itin) => itin.legs.some(aranan));
        if (validItineraries.length === 0) {
          const modlar = [...new Set(itineraries.flatMap((i) => i.legs.map((l) => l.mode)))];
          console.warn(`${profileKey}: OTP rota döndü ama araç yok. Modlar:`, modlar);
          setError(MOD_BOS_MESAJI[profileKey]);
          return null;
        }
      }

      const ranked = rankItineraries(validItineraries, profileKey);
      // rankItineraries yürüyüş tavanını AŞAN her güzergâhı eler ve geriye
      // hiçbir şey kalmayabilir — bu bir hata değil, kuralın çalışmasıdır.
      // Sebebi söylenmezse kullanıcı boş ekranı bağlantı sorunu sanıyor.
      // rankItineraries iki gerekçeyle boş dönebilir: yürüyüş tavanı, ya da
      // modun amacına uyan aday kalmaması. İkisi kullanıcı için farklı
      // şeyler; aynı mesajı vermek yanıltıcı olurdu.
      if (ranked.length === 0) {
        setError(MOD_BOS_MESAJI[profileKey] || YURUYUS_TAVANI_MSG);
        return null;
      }
      const candidates = selectCandidates(ranked, profileKey, fareBase, farePerBoarding);
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

  const clearRoute = () => { setRoutes([]); setError(null); setNotice(null); };

  return { routes, loading, error, notice, fetchRoute, clearRoute };
}
