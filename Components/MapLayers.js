// Harita üstündeki tüm işaretçi ve güzergâh katmanları.
// HomeScreen yalnızca hangi katmanın görüneceğine karar verir; çizim burada yapılır.
import { View, Text, StyleSheet } from "react-native";
import { Callout, Marker, Polyline } from "react-native-maps";
import AppIcon from "./AppIcon";

// Doluluk oranına göre otopark rengi: yeşil < %50, turuncu < %80, kırmızı üstü
export function prMarkerColor(st) {
  if (!st.capacity || st.capacity === 0) return "#6b7280";
  const occupied = st.occupied ?? (st.capacity - (st.free ?? 0));
  const ratio = occupied / st.capacity;
  if (ratio < 0.5) return "#4ade80";
  if (ratio < 0.8) return "#f97316";
  return "#f87171";
}

export function parkingOccupancyText(st) {
  if (st.free != null && st.capacity) return `${st.free} boş / ${st.capacity} toplam`;
  if (st.capacity) return `Kapasite: ${st.capacity}`;
  return "Doluluk bilgisi yok";
}

export function BisimMarkers({ stations }) {
  return stations.map((st) => (
    <Marker
      key={`bisim-${st.id}`}
      coordinate={{ latitude: st.lat, longitude: st.lon }}
      anchor={{ x: 0.5, y: 0.5 }}
      title={st.name}
      description={st.capacity ? `Kapasite: ${st.capacity}` : "BİSİM istasyonu"}
      tracksViewChanges={false}
    >
      <View style={s.bisimMarker}>
        <AppIcon name="bike" size={13} color="#4ade80" />
      </View>
    </Marker>
  ));
}

export function BikeParkingMarkers({ stations }) {
  return stations.map((st) => (
    <Marker
      key={`park-${st.id}`}
      coordinate={{ latitude: st.lat, longitude: st.lon }}
      anchor={{ x: 0.5, y: 0.5 }}
      title={st.name || undefined}
      description={parkingOccupancyText(st)}
      tracksViewChanges={false}
    >
      <View style={s.parkingMarker}>
        <AppIcon name="bike" size={13} color="#f87171" />
      </View>
      <Callout tooltip>
        <View style={s.parkingCallout}>
          <Text style={s.parkingCalloutTitle}>{st.name || "Bisiklet parkı"}</Text>
          <Text style={s.parkingCalloutMeta}>{parkingOccupancyText(st)}</Text>
        </View>
      </Callout>
    </Marker>
  ));
}

export function OsmParkingMarkers({ spots }) {
  return spots.map((st) => (
    <Marker
      key={`osm-p-${st.id}`}
      coordinate={{ latitude: st.lat, longitude: st.lon }}
      anchor={{ x: 0.5, y: 0.5 }}
      title={st.name || "Otopark"}
      description={[
        st.type === "multi-storey" ? "Kapalı otopark" : st.type === "underground" ? "Yeraltı otopark" : "Açık otopark",
        st.capacity ? `${st.capacity} araçlık` : null,
        st.fee ? "Ücretli" : st.fee === false ? "Ücretsiz" : null,
      ].filter(Boolean).join(" · ")}
      tracksViewChanges={false}
    >
      <View style={[s.osmPMarker, st.type === "underground" && s.osmPMarkerUnderground]}>
        <Text style={s.osmPLabel}>P</Text>
      </View>
    </Marker>
  ));
}

export function ParkAndRideMarkers({ stations }) {
  return stations.map((st) => {
    const color = prMarkerColor(st);
    return (
      <Marker
        key={`pr-${st.id}`}
        coordinate={{ latitude: st.lat, longitude: st.lon }}
        anchor={{ x: 0.5, y: 0.5 }}
        title={st.name}
        description={st.capacity > 0 ? `${st.free} boş / ${st.capacity} toplam` : "Otopark"}
        tracksViewChanges={false}
      >
        <View style={[s.prMarker, { borderColor: color }]}>
          <Text style={[s.prMarkerLabel, { color }]}>P</Text>
        </View>
        <Callout tooltip>
          <View style={s.parkingCallout}>
            <Text style={s.parkingCalloutTitle}>{st.name || "Otopark"}</Text>
            <Text style={s.parkingCalloutMeta}>{parkingOccupancyText(st)}</Text>
            {(st.nearMetro || st.nearTram || st.nearTrain) && (
              <View style={s.parkingCalloutTags}>
                {st.nearMetro && <Text style={s.parkingCalloutTag}>🚇 Metro</Text>}
                {st.nearTram  && <Text style={s.parkingCalloutTag}>🚋 Tramvay</Text>}
                {st.nearTrain && <Text style={s.parkingCalloutTag}>🚆 Tren</Text>}
              </View>
            )}
            {st.isPaid != null && (
              <Text style={[s.parkingCalloutMeta, { marginTop: 3 }]}>
                {st.isPaid ? "💳 Ücretli" : "✅ Ücretsiz"}
              </Text>
            )}
          </View>
        </Callout>
      </Marker>
    );
  });
}

// Seçili rotanın park noktası (araç/bisiklet bırakılan yer)
export function ActiveParkingMarker({ point }) {
  if (!point) return null;
  return (
    <Marker
      coordinate={{ latitude: point.lat, longitude: point.lon }}
      anchor={{ x: 0.5, y: 0.5 }}
      title={point.name}
      tracksViewChanges={false}
    >
      <View style={s.activeParkMarker}>
        <Text style={s.activeParkLabel}>P</Text>
      </View>
    </Marker>
  );
}

const legMidpoint = (coords) =>
  !coords || coords.length < 2 ? null : coords[Math.floor(coords.length / 2)];

// Yürüyüş bacağı harita üzerinde kendi rengiyle çizilir: MODE_STYLE.WALK rengi
// karanlık temadaki çipler için açık tonda, harita hep açık tema olduğundan
// orada yeterince okunmuyordu.
const WALK_MAP_COLOR = "#1f2937";
// Yuvarlak uçla birleşince kesik çizgi yerine belirgin noktalar üretir
const WALK_DASH = [2, 12];
// Bu uzunluğun altındaki yürüyüşlere ikon konmaz — çizgiyi kalabalıklaştırır
const WALK_BADGE_MIN_METERS = 250;

const isWalk = (leg) => leg.mode === "WALK";

// Güzergâh çizimi: beyaz kaplama + renkli çizgi + bacak ortasında mod ikonu
export function RouteOverlay({ route }) {
  if (!route) return null;
  const visibleLegs = route.legs.filter((l) => l.coords.length > 1);

  return (
    <>
      {visibleLegs.map((leg, i) => (
        <Polyline
          key={`casing-${i}`}
          coordinates={leg.coords}
          strokeColor="#ffffff"
          strokeWidth={isWalk(leg) ? 9 : 7}
          lineDashPattern={isWalk(leg) ? WALK_DASH : undefined}
          lineCap="round"
        />
      ))}
      {visibleLegs.map((leg, i) => (
        <Polyline
          key={`line-${i}`}
          coordinates={leg.coords}
          strokeColor={isWalk(leg) ? WALK_MAP_COLOR : leg.color}
          strokeWidth={isWalk(leg) ? 5 : 4}
          lineDashPattern={isWalk(leg) ? WALK_DASH : undefined}
          lineCap="round"
        />
      ))}
      {visibleLegs.map((leg, i) => {
        // Kısa yürüyüşler dışında her bacak ortasına mod rozeti
        if (isWalk(leg) && (leg.distanceMeters ?? 0) < WALK_BADGE_MIN_METERS) return null;
        const mid = legMidpoint(leg.coords);
        if (!mid) return null;
        const color = isWalk(leg) ? WALK_MAP_COLOR : leg.color;
        return (
          <Marker key={`marker-${i}`} coordinate={mid} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <View style={[s.routeIconBadge, { borderColor: color }]}>
              <AppIcon name={leg.icon} size={15} color={color} strokeWidth={2.5} />
            </View>
          </Marker>
        );
      })}
    </>
  );
}

// Navigasyon sırasında kullanıcının tek konum imleci.
// Bu imleç görünürken haritanın kendi mavi noktası kapatılmalıdır; ikisi birden
// açıkken rotaya oturtulmuş konum ile ham GPS iki ayrı nokta olarak görünür.
// Yön bilgisi Marker.rotation ile verilir: çocuk görünüm yeniden çizilmediği için
// tracksViewChanges kapalı kalabilir.
export function UserPuck({ point, heading = 0, offRoute = false }) {
  if (!point) return null;
  // Rota dışındayken renk değişir: konum artık rotaya oturtulmuş değil, ham GPS
  const color = offRoute ? "#f59e0b" : "#2563eb";
  return (
    <Marker
      // tracksViewChanges kapalıyken Android imleci ilk hâliyle bitmap'e alır;
      // rota dışına çıkınca renk değişsin diye imleç yeniden kurulur.
      key={offRoute ? "puck-offroute" : "puck-onroute"}
      coordinate={point}
      anchor={{ x: 0.5, y: 0.5 }}
      flat
      rotation={heading}
      tracksViewChanges={false}
      zIndex={99}
    >
      <View style={s.puckWrap}>
        <View style={[s.puckHalo, { backgroundColor: color + "26" }]} />
        <View style={[s.puckCore, { backgroundColor: color }]}>
          <AppIcon name="navigation" size={13} color="#ffffff" strokeWidth={2.5} />
        </View>
      </View>
    </Marker>
  );
}

const s = StyleSheet.create({
  bisimMarker: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 1.5,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#0f1117", borderColor: "#4ade80",
  },
  parkingMarker: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 1.5,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#0f1117", borderColor: "#f87171",
  },
  prMarker: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 1.5,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#0f1117",
  },
  prMarkerLabel: { fontSize: 10, fontWeight: "800" },
  parkingCallout: {
    minWidth: 150, maxWidth: 220,
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8,
    backgroundColor: "#0f1117", borderWidth: 1, borderColor: "#334155",
  },
  parkingCalloutTitle: { color: "#f8fafc", fontSize: 12, fontWeight: "800" },
  parkingCalloutMeta: { color: "#cbd5e1", fontSize: 11, fontWeight: "700", marginTop: 4 },
  parkingCalloutTags: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 5 },
  parkingCalloutTag: {
    fontSize: 10, fontWeight: "700", color: "#60a5fa", backgroundColor: "#60a5fa18",
    paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4,
  },
  activeParkMarker: {
    width: 28, height: 28, borderRadius: 14, borderWidth: 2.5,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#1e293b", borderColor: "#f59e0b",
  },
  activeParkLabel: { fontSize: 12, fontWeight: "900", color: "#f59e0b" },
  osmPMarker: {
    width: 20, height: 20, borderRadius: 4, borderWidth: 1.5,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#0f1117", borderColor: "#94a3b8",
  },
  osmPMarkerUnderground: { borderColor: "#a78bfa" },
  osmPLabel: { fontSize: 9, fontWeight: "800", color: "#94a3b8" },
  routeIconBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "#ffffff", borderWidth: 2,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { height: 1 },
    elevation: 4,
  },
  puckWrap: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  puckHalo: { ...StyleSheet.absoluteFillObject, borderRadius: 22 },
  puckCore: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 3, borderColor: "#ffffff",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 3, shadowOffset: { height: 1 },
    elevation: 5,
  },
});
