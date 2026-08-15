import { useState, useEffect, useMemo, useRef } from "react";
import { buildRouteIndex, navigationProgress, OFF_ROUTE_STREAK } from "../utils/navigation";

// Canlı konumu seçili rotayla eşleştirip navigasyon ilerlemesini üretir.
// Konum takibinin kendisi useLocationService'in işidir; bu hook yalnızca yorumlar.
export function useNavigationMode(route, location, active) {
  const routeIndex = useMemo(() => (route ? buildRouteIndex(route) : null), [route]);

  const [progress, setProgress] = useState(null);
  const [offRoute, setOffRoute] = useState(false);

  // Rota üzerinde ilerledikçe arama penceresinin başlangıcı — geri sıçramayı önler
  const fromIndex = useRef(0);
  const offRouteStreak = useRef(0);

  useEffect(() => {
    fromIndex.current = 0;
    offRouteStreak.current = 0;
    setProgress(null);
    setOffRoute(false);
  }, [routeIndex, active]);

  useEffect(() => {
    if (!active || !routeIndex || !location) return;

    const next = navigationProgress(routeIndex, location, fromIndex.current);
    if (!next) return;

    // Rota dışındayken pencereyi ilerletme: sapma anındaki yanlış eşleşme kalıcı olmasın
    if (!next.offRoute) fromIndex.current = next.segmentIndex;

    offRouteStreak.current = next.offRoute ? offRouteStreak.current + 1 : 0;
    setOffRoute(offRouteStreak.current >= OFF_ROUTE_STREAK);
    setProgress(next);
  }, [active, routeIndex, location]);

  return { progress, offRoute };
}
