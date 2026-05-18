import { Fragment, useState, useRef, useEffect } from "react";
import {
  StyleSheet, View, Text, TouchableOpacity,
  FlatList, Keyboard,
} from "react-native";
import MapView, { Callout, Marker, Polyline } from "react-native-maps";
import { searchAddress, fetchBisimStations, fetchBicycleParkingStations, fetchPrStations, fetchBikePrStations, fetchOsmParkingSpots } from "../Services/api";
import ProfileTabs from "../Components/ProfileTabs";
import SearchBar from "../Components/SearchBar";
import RoutePanel from "../Components/RoutePanel";
import AppIcon from "../Components/AppIcon";
import { useTheme } from "../utils/ThemeContext";
import { useSettings } from "../hooks/useSettings";
import { useLocationService } from "../hooks/useLocationService";
import { useRouteSearch } from "../hooks/useRouteSearch";


function prMarkerColor(st) {
  if (!st.capacity || st.capacity === 0) return "#6b7280";
  const occupied = st.occupied ?? (st.capacity - (st.free ?? 0));
  const ratio = occupied / st.capacity;
  if (ratio < 0.5) return "#4ade80";
  if (ratio < 0.8) return "#f97316";
  return "#f87171";
}

function parkingOccupancyText(st) {
  if (st.free != null && st.capacity) return `${st.free} boş / ${st.capacity} toplam`;
  if (st.capacity) return `Kapasite: ${st.capacity}`;
  return "Doluluk bilgisi yok";
}

function getTimeContext() {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();
  const isWeekend = day === 0 || day === 6;
  const isNight = hour < 6 || hour >= 23;
  const isRush = !isWeekend && ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19));
  const isPeak = !isWeekend && hour >= 10 && hour <= 16;
  if (isWeekend && hour >= 8 && hour <= 18) return "Hafta sonu - bisiklet veya vapur güzel bir seçim!";
  if (isWeekend) return "Hafta sonu gece - seferler seyrek, sürelere dikkat edin.";
  if (isRush) return "Yoğun saat - metro aktarmasız en hızlı seçenek olabilir.";
  if (isNight) return "Gece saati - bazı hatlar çalışmıyor olabilir.";
  if (isPeak) return "Gündüz - tüm hatlar aktif, iyi yolculuklar!";
  return "";
}

export default function HomeScreen() {
  const { theme } = useTheme();
  const mapRef = useRef(null);

  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [originText, setOriginText] = useState("");
  const [destText, setDestText] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [activeInput, setActiveInput] = useState(null);

  const [profile, setProfile] = useState("transit");
  const [bikeType, setBikeType] = useState(null);
  const [carMode, setCarMode] = useState(null);
  const [bisimStations, setBisimStations] = useState([]);
  const [parkingStations, setParkingStations] = useState([]);
  const [prStations, setPrStations] = useState([]);
  const [osmParking, setOsmParking] = useState([]);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [timeTip] = useState(() => getTimeContext());

  const { fareBase, farePerBoarding, profiles, savedPlaces, savePlace } = useSettings();
  const { userLocation } = useLocationService();
  const { routes, loading, error, fetchRoute, clearRoute } = useRouteSearch(fareBase, farePerBoarding);
  const [selectedRouteIdx, setSelectedRouteIdx] = useState(0);
  const displayRoute = routes[selectedRouteIdx] ?? null;
  const mapRoute = routes[selectedRouteIdx >= 0 ? selectedRouteIdx : 0] ?? null;

  useEffect(() => {
    setProfile((cur) => (profiles.find((p) => p.id === cur) ? cur : profiles[0].id));
  }, [profiles]);

  useEffect(() => {
    if (profile !== "bicycle") {
      setBisimStations([]);
      setParkingStations([]);
      return;
    }
    if (bikeType === "RENT") {
      fetchBisimStations().then(setBisimStations).catch(() => {});
      setParkingStations([]);
    } else if (bikeType === "PARK") {
      fetchBikePrStations().then(setParkingStations).catch(() => {});
      setBisimStations([]);
    } else {
      fetchBicycleParkingStations().then(setParkingStations).catch(() => {});
      setBisimStations([]);
    }
  }, [profile, bikeType]);

  useEffect(() => { setSelectedRouteIdx(0); }, [routes]);

  useEffect(() => {
    if (profile !== "car" || carMode !== "park_and_ride") { setPrStations([]); return; }
    fetchPrStations().then(setPrStations).catch(() => {});
  }, [profile, carMode]);

  useEffect(() => {
    if (profile !== "car" || carMode === "park_and_ride") { setOsmParking([]); return; }
    fetchOsmParkingSpots().then(setOsmParking).catch(() => {});
  }, [profile, carMode]);

  const doFetchRoute = (from, to, prof, fromName = "", toName = "", bType = bikeType, cMode = carMode) => {
    setPanelCollapsed(false);
    fetchRoute(from, to, prof, fromName, toName, bType, cMode).then((result) => {
      if (!result || !result[0]) return;
      const allCoords = result[0].legs.flatMap((l) => l.coords);
      if (allCoords.length > 1) {
        mapRef.current?.fitToCoordinates(allCoords, {
          edgePadding: { top: 120, right: 60, bottom: 300, left: 60 }, animated: true,
        });
      }
    });
  };

  const handleSearch = (text, field) => {
    if (field === "origin") setOriginText(text); else setDestText(text);
    setActiveInput(field);
    searchAddress(text, setSuggestions);
  };

  const selectSuggestion = (item) => {
    const coord = { latitude: parseFloat(item.lat), longitude: parseFloat(item.lon) };
    const name = item.display_name.split(",")[0];

    if (activeInput === "origin") {
      setOrigin(coord); setOriginText(name);
      if (destination) {
        doFetchRoute(coord, destination, profile, name, destText);
        mapRef.current?.fitToCoordinates([coord, destination], {
          edgePadding: { top: 120, right: 60, bottom: 300, left: 60 }, animated: true,
        });
      } else {
        mapRef.current?.animateToRegion({ ...coord, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 500);
      }
    } else {
      setDestination(coord); setDestText(name);
      if (origin) {
        doFetchRoute(origin, coord, profile, originText, name);
        mapRef.current?.fitToCoordinates([origin, coord], {
          edgePadding: { top: 120, right: 60, bottom: 300, left: 60 }, animated: true,
        });
      } else {
        mapRef.current?.animateToRegion({ ...coord, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 500);
      }
    }
    setSuggestions([]); setActiveInput(null); Keyboard.dismiss();
  };

  const usePlace = (place) => {
    if (!place.address) return;
    const { coord, name } = place.address;
    // Odaklanılmış alan yoksa: başlangıç boşsa oraya, doluysa varışa yaz
    const target = activeInput === "origin" ? "origin" : activeInput === "dest" ? "dest" : !origin ? "origin" : "dest";
    if (target === "origin") {
      setOrigin(coord); setOriginText(name);
      if (destination) doFetchRoute(coord, destination, profile, name, destText);
    } else {
      setDestination(coord); setDestText(name);
      if (origin) doFetchRoute(origin, coord, profile, originText, name);
    }
    setSuggestions([]); setActiveInput(null); Keyboard.dismiss();
    mapRef.current?.animateToRegion({ ...coord, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 500);
  };

  const handleMapPress = (e) => {
    const coord = e.nativeEvent.coordinate;
    const label = `${coord.latitude.toFixed(4)}, ${coord.longitude.toFixed(4)}`;
    if (!origin) {
      setOrigin(coord); setOriginText(label); setSuggestions([]);
    } else if (!destination) {
      setDestination(coord); setDestText(label); setSuggestions([]);
      doFetchRoute(origin, coord, profile, originText, label);
    }
  };

  const handleLocateMe = () => {
    if (!userLocation) return;
    setOrigin(userLocation);
    setOriginText("Mevcut konumum");
    mapRef.current?.animateToRegion({ ...userLocation, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 500);
    if (destination) doFetchRoute(userLocation, destination, profile, "Mevcut konumum", destText);
  };

  const handleReset = () => {
    clearRoute();
    setPanelCollapsed(false);
    setOrigin(null); setDestination(null);
    setOriginText(""); setDestText("");
    setSuggestions([]); setActiveInput(null);
    mapRef.current?.animateToRegion(
      { latitude: 38.428, longitude: 27.16, latitudeDelta: 0.08, longitudeDelta: 0.08 },
      500
    );
  };

  const handleSwap = () => {
    if (!origin && !destination) return;
    setOrigin(destination); setDestination(origin);
    setOriginText(destText); setDestText(originText);
    if (origin && destination) doFetchRoute(destination, origin, profile, destText, originText);
  };

  const changeProfile = (p) => {
    setProfile(p); setBikeType(null); setCarMode(null);
    setPrStations([]);
    if (origin && destination) doFetchRoute(origin, destination, p, originText, destText, null, null);
  };

  const setBikeTypeOption = (next) => {
    setBikeType(next);
    if (origin && destination) doFetchRoute(origin, destination, profile, originText, destText, next, carMode);
  };

  const toggleCarMode = () => {
    const next = carMode === "park_and_ride" ? null : "park_and_ride";
    setCarMode(next);
    if (origin && destination) doFetchRoute(origin, destination, profile, originText, destText, bikeType, next);
  };

  const getLegMarkerCoordinate = (coords) => {
    if (!coords || coords.length < 2) return null;
    return coords[Math.floor(coords.length / 2)];
  };

  const getPanelSummary = () => {
    if (loading) return "Rota aranıyor...";
    if (error) return "Rota bulunamadı";
    if (displayRoute) return `${Math.round(displayRoute.totalDuration / 60)} dk · ${displayRoute.walkDistance} km yürüyüş · ${displayRoute.transfers} aktarma`;
    if (!origin) return "Başlangıç seçin";
    if (!destination) return "Varış seçin";
    return "Rota hazır";
  };

  const [savedPlacesOpen, setSavedPlacesOpen] = useState(false);

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <MapView
        ref={mapRef}
        style={s.map}
        initialRegion={{ latitude: 38.428, longitude: 27.16, latitudeDelta: 0.08, longitudeDelta: 0.08 }}
        onPress={handleMapPress}
        showsUserLocation={true}
        showsMyLocationButton={false}
        userInterfaceStyle="light"
      >
        {origin && <Marker coordinate={origin} pinColor="#4ade80" title="Başlangıç" />}
        {destination && <Marker coordinate={destination} pinColor="#f87171" title="Varış" />}
        {bisimStations.map((st) => (
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
        ))}

        {parkingStations.map((st) => (
          <Marker
            key={`park-${st.id}`}
            coordinate={{ latitude: st.lat, longitude: st.lon }}
            anchor={{ x: 0.5, y: 0.5 }}
            title={st.name || undefined}
            description={
              st.free != null && st.capacity
                ? `${st.free} boş / ${st.capacity} toplam`
                : st.capacity
                ? `Kapasite: ${st.capacity}`
                : "Bisiklet parkı"
            }
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
        ))}

        {osmParking.map((st) => (
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
        ))}

        {prStations.map((st) => {
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
                </View>
              </Callout>
            </Marker>
          );
        })}

        {mapRoute?.parkingPoint && (
          <Marker
            coordinate={{ latitude: mapRoute.parkingPoint.lat, longitude: mapRoute.parkingPoint.lon }}
            anchor={{ x: 0.5, y: 0.5 }}
            title={mapRoute.parkingPoint.name}
            tracksViewChanges={false}
          >
            <View style={s.activeParkMarker}>
              <Text style={s.activeParkLabel}>P</Text>
            </View>
          </Marker>
        )}

        {mapRoute && (() => {
          const visibleLegs = mapRoute.legs.filter((l) => l.coords.length > 1);
          return (
            <>
              {/* 1. Beyaz kaplama — bacaklar arası görsel ayrım */}
              {visibleLegs.map((leg, i) => (
                <Polyline
                  key={`casing-${i}`}
                  coordinates={leg.coords}
                  strokeColor="#ffffff"
                  strokeWidth={leg.mode === "WALK" ? 4 : 7}
                  lineDashPattern={leg.mode === "WALK" ? [6, 6] : undefined}
                />
              ))}
              {/* 2. Renkli çizgiler */}
              {visibleLegs.map((leg, i) => (
                <Polyline
                  key={`line-${i}`}
                  coordinates={leg.coords}
                  strokeColor={leg.color}
                  strokeWidth={leg.mode === "WALK" ? 2 : 4}
                  lineDashPattern={leg.mode === "WALK" ? [6, 6] : undefined}
                />
              ))}
              {/* 3. Mod ikonları (yürüyüş bacaklarında gösterilmez) */}
              {visibleLegs.map((leg, i) => {
                if (leg.mode === "WALK") return null;
                const mid = getLegMarkerCoordinate(leg.coords);
                if (!mid) return null;
                return (
                  <Marker key={`marker-${i}`} coordinate={mid} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
                    <View style={[s.routeIconBadge, { borderColor: leg.color }]}>
                      <AppIcon name={leg.icon} size={15} color={leg.color} strokeWidth={2.5} />
                    </View>
                  </Marker>
                );
              })}
            </>
          );
        })()}
      </MapView>

      {userLocation && !origin && (
        <TouchableOpacity
          style={[s.locateFab, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={handleLocateMe}
          activeOpacity={0.85}
        >
          <AppIcon name="locate" size={22} color={theme.text} />
        </TouchableOpacity>
      )}

      <View style={[s.searchPanel, { backgroundColor: theme.surface }]}>
        <Text style={[s.appTitle, { color: theme.muted }]}>İZMİR ULAŞIM</Text>

        <ProfileTabs profiles={profiles} activeProfile={profile} onSelect={changeProfile} />

        {profile === "bicycle" && (
          <View style={s.subToggleRow}>
            {[
              { key: "RENT", icon: "bike",  label: "Kirala",          color: "#4ade80" },
              { key: null,   icon: "bike",  label: "Kendi Bisikletim", color: "#4ade80" },
              { key: "PARK", icon: "bus",   label: "Park + Taşıma",   color: "#4ade80" },
            ].map(({ key, icon, label, color }) => {
              const active = bikeType === key;
              return (
                <TouchableOpacity
                  key={String(key)}
                  style={[s.subToggleBtn, { backgroundColor: theme.input, borderColor: theme.border }, active && s.subToggleActive]}
                  onPress={() => !active && setBikeTypeOption(key)}
                  activeOpacity={0.8}
                >
                  <View style={s.subToggleContent}>
                    <AppIcon name={icon} size={12} color={active ? color : theme.muted} />
                    <Text style={[s.subToggleText, { color: active ? color : theme.muted }]}>{label}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {profile === "car" && (
          <View style={s.subToggleRow}>
            <TouchableOpacity
              style={[s.subToggleBtn, { backgroundColor: theme.input, borderColor: theme.border }, carMode !== "park_and_ride" && s.subToggleCarActive]}
              onPress={() => carMode === "park_and_ride" && toggleCarMode()}
              activeOpacity={0.8}
            >
              <View style={s.subToggleContent}>
                <AppIcon name="car" size={12} color={carMode !== "park_and_ride" ? "#f97316" : theme.muted} />
                <Text style={[s.subToggleText, { color: theme.muted }, carMode !== "park_and_ride" && { color: "#f97316" }]}>Direkt</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.subToggleBtn, { backgroundColor: theme.input, borderColor: theme.border }, carMode === "park_and_ride" && s.subToggleCarActive]}
              onPress={() => carMode !== "park_and_ride" && toggleCarMode()}
              activeOpacity={0.8}
            >
              <View style={s.subToggleContent}>
                <AppIcon name="bus" size={12} color={carMode === "park_and_ride" ? "#f97316" : theme.muted} />
                <Text style={[s.subToggleText, { color: theme.muted }, carMode === "park_and_ride" && { color: "#f97316" }]}>Park+Taşı</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        <View style={s.searchFields}>
          <SearchBar
            value={originText}
            onChangeText={(t) => handleSearch(t, "origin")}
            onFocus={() => { setActiveInput("origin"); setSuggestions([]); }}
            placeholder="Nereden?"
            dotColor="#4ade80"
            rightIcon={userLocation ? "locate" : null}
            onRightPress={handleLocateMe}
          />
          <TouchableOpacity
            style={[s.swapBtn, { backgroundColor: theme.panel, borderColor: theme.border }]}
            onPress={handleSwap}
            activeOpacity={0.8}
          >
            <Text style={[s.swapIcon, { color: theme.text }]}>⇄</Text>
          </TouchableOpacity>
          <SearchBar
            value={destText}
            onChangeText={(t) => handleSearch(t, "dest")}
            onFocus={() => { setActiveInput("dest"); setSuggestions([]); }}
            placeholder="Nereye?"
            dotColor="#f87171"
          />
        </View>

        {!suggestions.length && (
          <>
            {/* Kayıtlı adresler ince çizgi başlığı — her zaman görünür */}
            <TouchableOpacity
              style={s.savedDivider}
              onPress={() => setSavedPlacesOpen((v) => !v)}
              activeOpacity={0.7}
            >
              <View style={[s.savedLine, { backgroundColor: theme.border }]} />
              <Text style={[s.savedTitle, { color: theme.muted }]}>Kayıtlı Adresler</Text>
              <AppIcon name={savedPlacesOpen ? "chevronUp" : "chevronDown"} size={10} color={theme.muted} />
              <View style={[s.savedLine, { backgroundColor: theme.border }]} />
            </TouchableOpacity>

            {/* Chip listesi — sadece açıkken */}
            {savedPlacesOpen && (
              <View style={s.placesRow}>
                {savedPlaces.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[s.placeChip, { backgroundColor: theme.input, borderColor: theme.border }, p.address && s.placeChipFilled]}
                    onPress={() => { if (p.address) usePlace(p); }}
                    onLongPress={() => {
                      const coord = activeInput === "origin" ? origin : destination;
                      const name = activeInput === "origin" ? originText : destText;
                      if (coord && name) savePlace(p.id, coord, name);
                    }}
                    activeOpacity={0.75}
                  >
                    <AppIcon name={p.icon} size={16} color={p.address ? "#4ade80" : theme.muted} />
                    <View style={{ flex: 1 }}>
                      <Text style={[s.placeLabel, { color: theme.text }]}>{p.label}</Text>
                      {p.address ? (
                        <Text style={[s.placeAddr, { color: theme.muted }]} numberOfLines={1}>{p.address.name}</Text>
                      ) : (
                        <Text style={[s.placeEmpty, { color: theme.subtle }]}>Basılı tut = kaydet</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}

        {suggestions.length > 0 && (
          <FlatList
            data={suggestions}
            keyExtractor={(item) => item.place_id?.toString()}
            keyboardShouldPersistTaps="handled"
            style={[s.suggestList, { backgroundColor: theme.panel, borderColor: theme.border }]}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[s.suggestItem, { borderBottomColor: theme.border }]}
                onPress={() => selectSuggestion(item)}
              >
                <AppIcon name="mapPin" size={16} color={theme.muted} />
                <View style={s.suggestTextBox}>
                  <Text style={[s.suggestName, { color: theme.text }]} numberOfLines={1}>
                    {item.display_name.split(",")[0]}
                  </Text>
                  <Text style={[s.suggestDetail, { color: theme.muted }]} numberOfLines={1}>
                    {item.display_name.split(",").slice(1, 3).join(",")}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>

      <View style={[
        s.bottomPanel,
        panelCollapsed && s.bottomPanelCollapsed,
        { backgroundColor: theme.surface },
      ]}>
        <TouchableOpacity
          style={s.panelToggle}
          onPress={() => setPanelCollapsed((cur) => !cur)}
          activeOpacity={0.8}
        >
          <View style={[s.handle, { backgroundColor: theme.border }]} />
          <View style={s.panelToggleRow}>
            <Text style={[s.panelSummary, { color: theme.text }]} numberOfLines={1}>
              {getPanelSummary()}
            </Text>
            <AppIcon name={panelCollapsed ? "chevronUp" : "chevronDown"} size={18} color={theme.muted} />
          </View>
        </TouchableOpacity>

        {!panelCollapsed && (
          <>
            <RoutePanel
              routes={routes}
              selectedIdx={selectedRouteIdx}
              onSelect={setSelectedRouteIdx}
              loading={loading}
              error={error}
              timeTip={timeTip}
              origin={origin}
              destination={destination}
              onReset={handleReset}
              bikeType={bikeType}
            />
            {(origin || destination) && (
              <TouchableOpacity
                style={[s.resetBtn, { backgroundColor: theme.panel, borderColor: theme.border }]}
                onPress={handleReset}
                activeOpacity={0.8}
              >
                <View style={s.resetContent}>
                  <AppIcon name="reset" size={15} color={theme.muted} />
                  <Text style={[s.resetText, { color: theme.muted }]}>Temizle</Text>
                </View>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
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
  locateFab: {
    position: "absolute", right: 16, bottom: 270,
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 1, alignItems: "center", justifyContent: "center", zIndex: 5,
    shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 6, shadowOffset: { height: 2 },
    elevation: 6,
  },
  searchPanel: {
    position: "absolute", top: 0, left: 0, right: 0,
    paddingTop: 46, paddingHorizontal: 20, paddingBottom: 10,
    borderBottomLeftRadius: 20, borderBottomRightRadius: 20, zIndex: 10,
    shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { height: 3 },
    elevation: 8,
  },
  appTitle: { fontSize: 10, fontWeight: "700", letterSpacing: 2, marginBottom: 4 },
  searchFields: { position: "relative" },
  swapBtn: {
    position: "absolute", right: 10, top: "50%", marginTop: -14, zIndex: 5,
    borderWidth: 1, width: 28, height: 28, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
  },
  swapIcon: { fontSize: 13 },
  suggestList: { borderRadius: 12, maxHeight: 200, marginTop: 4, borderWidth: 1 },
  suggestItem: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 14, paddingVertical: 9, borderBottomWidth: 1,
  },
  suggestTextBox: { flex: 1 },
  suggestName: { fontSize: 13, fontWeight: "700" },
  suggestDetail: { fontSize: 11, marginTop: 2 },
  bottomPanel: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 18, borderTopRightRadius: 18,
    padding: 12, paddingBottom: 16, maxHeight: "54%",
    shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { height: -2 },
    elevation: 10,
  },
  bottomPanelCollapsed: { paddingTop: 8, paddingBottom: 10, maxHeight: 76 },
  panelToggle: { marginBottom: 8 },
  panelToggleRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10,
  },
  panelSummary: { flex: 1, fontSize: 12, fontWeight: "800" },
  handle: {
    width: 32, height: 3, borderRadius: 2,
    alignSelf: "center", marginBottom: 10,
  },
  resetBtn: {
    marginTop: 8, borderWidth: 1, borderRadius: 9,
    paddingVertical: 7, alignItems: "center",
  },
  resetContent: { flexDirection: "row", alignItems: "center", gap: 6 },
  resetText: { fontSize: 12, fontWeight: "700" },
  savedDivider: {
    flexDirection: "row", alignItems: "center",
    gap: 6, marginTop: 8, marginBottom: 2,
  },
  savedLine: { flex: 1, height: 1 },
  savedTitle: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  placesRow: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 4 },
  placeChip: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
    minWidth: "47%", flex: 1,
  },
  placeChipFilled: { borderColor: "#4ade8030" },
  placeLabel: { fontSize: 12, fontWeight: "700" },
  placeAddr: { fontSize: 10, marginTop: 1 },
  placeEmpty: { fontSize: 9, marginTop: 1, fontStyle: "italic" },
  subToggleRow: { flexDirection: "row", gap: 4, marginBottom: 6 },
  subToggleBtn: {
    flex: 1, paddingVertical: 5, borderRadius: 7,
    borderWidth: 1, alignItems: "center",
  },
  subToggleActive:    { borderColor: "#4ade8060", backgroundColor: "#4ade8012" },
  subToggleCarActive: { borderColor: "#f9731660", backgroundColor: "#f9731612" },
  subToggleContent: { flexDirection: "row", alignItems: "center", gap: 4 },
  subToggleText: { fontSize: 11, fontWeight: "700" },
});
