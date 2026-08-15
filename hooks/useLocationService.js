import { useState, useEffect, useRef } from "react";
import * as Location from "expo-location";

// watch=false: açılışta tek seferlik konum (haritayı ortalama, "Konumum" butonu).
// watch=true:  navigasyon için sürekli takip — yüksek doğruluk, pusula yönü dahil.
export function useLocationService({ watch = false } = {}) {
  const [userLocation, setUserLocation] = useState(null);
  const [heading, setHeading] = useState(null);
  const [speed, setSpeed] = useState(0);
  const [permission, setPermission] = useState("pending"); // pending | granted | denied

  const positionSub = useRef(null);
  const headingSub = useRef(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (status !== "granted") {
          setPermission("denied");
          return;
        }
        setPermission("granted");

        const loc = await Location.getCurrentPositionAsync({});
        if (cancelled) return;
        setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      } catch {
        if (!cancelled) setPermission("denied");
      }
    })();

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!watch || permission !== "granted") return;

    let cancelled = false;

    (async () => {
      try {
        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 2000,
            distanceInterval: 5,
          },
          (loc) => {
            if (cancelled) return;
            setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
            setSpeed(loc.coords.speed ?? 0);
            // GPS yönü yalnızca hareket hâlinde anlamlıdır (-1 = geçersiz)
            if (typeof loc.coords.heading === "number" && loc.coords.heading >= 0) {
              setHeading(loc.coords.heading);
            }
          }
        );
        if (cancelled) sub.remove(); else positionSub.current = sub;
      } catch {}

      // Pusula: yavaş yürürken GPS yönü güvenilmez olduğundan manyetometre tercih edilir.
      // Sensörü olmayan cihazlarda sessizce atlanır.
      try {
        const sub = await Location.watchHeadingAsync((h) => {
          if (cancelled) return;
          const value = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
          if (typeof value === "number" && value >= 0) setHeading(value);
        });
        if (cancelled) sub.remove(); else headingSub.current = sub;
      } catch {}
    })();

    return () => {
      cancelled = true;
      positionSub.current?.remove();
      headingSub.current?.remove();
      positionSub.current = null;
      headingSub.current = null;
    };
  }, [watch, permission]);

  return { userLocation, heading, speed, permission };
}
