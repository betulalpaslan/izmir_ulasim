import { useState, useRef, useEffect, useMemo } from "react";
import { StyleSheet, View, Text, TouchableOpacity, Keyboard } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import {
  searchAddress, fetchBisimStations, fetchBicycleParkingStations,
  fetchPrStations, fetchBikePrStations, fetchOsmParkingSpots,
} from "../Services/api";
import SearchPanel from "../Components/SearchPanel";
import RoutePanel from "../Components/RoutePanel";
import NavigationOverlay from "../Components/NavigationOverlay";
import AppIcon from "../Components/AppIcon";
import {
  BisimMarkers, BikeParkingMarkers, OsmParkingMarkers,
  ParkAndRideMarkers, ActiveParkingMarker, RouteOverlay, UserPuck,
} from "../Components/MapLayers";
import { useTheme } from "../utils/ThemeContext";
import { useSettings } from "../hooks/useSettings";
import { useLocationService } from "../hooks/useLocationService";
import { useRouteSearch } from "../hooks/useRouteSearch";
import { useNavigationMode } from "../hooks/useNavigationMode";

const IZMIR_REGION = { latitude: 38.428, longitude: 27.16, latitudeDelta: 0.08, longitudeDelta: 0.08 };
const MAP_PADDING = { top: 120, right: 60, bottom: 300, left: 60 };

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
  const [savedPlacesOpen, setSavedPlacesOpen] = useState(false);

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
  const { routes, loading, error, fetchRoute, clearRoute } = useRouteSearch(fareBase, farePerBoarding);
  const [selectedRouteIdx, setSelectedRouteIdx] = useState(0);

  // ── Navigasyon ──────────────────────────────────────────────
  // navRouteIdx: navigasyon başlatıldığında dondurulan rota. Kart seçimi
  // (selectedRouteIdx) navigasyon sırasında değişemez, dolayısıyla ayrı tutulur.
  const [navActive, setNavActive] = useState(false);
  const [navRouteIdx, setNavRouteIdx] = useState(0);
  // Takip kamerası açık mı: kullanıcı haritayı sürükleyince kapanır ki
  // ileriye/geriye bakabilsin, "Ortala" ile geri açılır.
  const [navFollow, setNavFollow] = useState(true);

  const { userLocation, heading, permission } = useLocationService({ watch: navActive });

  const displayRoute = routes[selectedRouteIdx] ?? null;
  const navRoute = navActive ? routes[navRouteIdx] ?? null : null;
  const mapRoute = navRoute ?? routes[selectedRouteIdx >= 0 ? selectedRouteIdx : 0] ?? null;

  const { progress, offRoute } = useNavigationMode(navRoute, userLocation, navActive);

  // Kamera yönü: pusula her küçük harekette değiştiği için 5 dereceye yuvarlanır,
  // aksi hâlde animateCamera saniyede onlarca kez tetiklenir.
  const cameraHeading = useMemo(
    () => (heading == null ? 0 : Math.round(heading / 5) * 5),
    [heading]
  );

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

  // Navigasyon sırasında ekran kapanmasın
  useEffect(() => {
    if (!navActive) return;
    activateKeepAwakeAsync("navigation").catch(() => {});
    return () => { deactivateKeepAwake("navigation").catch(() => {}); };
  }, [navActive]);

  // Navigasyonda gösterilen konum: rotaya oturtulmuş nokta, rota dışındayken ham GPS
  const navPoint = navActive ? (offRoute ? userLocation : progress?.snapped ?? userLocation) : null;

  // Takip kamerası: kullanıcıyı ortada tutar, gidiş yönüne döner.
  // navFollow kapalıyken haritaya dokunulmaz — kullanıcı serbestçe gezinir.
  useEffect(() => {
    if (!navActive || !navFollow || !navPoint) return;
    mapRef.current?.animateCamera(
      { center: navPoint, heading: cameraHeading, pitch: 45, zoom: 17 },
      { duration: 700 }
    );
  }, [navActive, navFollow, navPoint, cameraHeading]);

  const recenterNavigation = () => {
    setNavFollow(true);
    if (!navPoint) return;
    mapRef.current?.animateCamera(
      { center: navPoint, heading: cameraHeading, pitch: 45, zoom: 17 },
      { duration: 500 }
    );
  };

  const fitToRoute = (route) => {
    const allCoords = route.legs.flatMap((l) => l.coords);
    if (allCoords.length > 1) {
      mapRef.current?.fitToCoordinates(allCoords, { edgePadding: MAP_PADDING, animated: true });
    }
  };

  const doFetchRoute = (from, to, prof, fromName = "", toName = "", bType = bikeType, cMode = carMode) => {
    setPanelCollapsed(false);
    return fetchRoute(from, to, prof, fromName, toName, bType, cMode).then((result) => {
      if (result?.[0] && !navActive) fitToRoute(result[0]);
      return result;
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
        mapRef.current?.fitToCoordinates([coord, destination], { edgePadding: MAP_PADDING, animated: true });
      } else {
        mapRef.current?.animateToRegion({ ...coord, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 500);
      }
    } else {
      setDestination(coord); setDestText(name);
      if (origin) {
        doFetchRoute(origin, coord, profile, originText, name);
        mapRef.current?.fitToCoordinates([origin, coord], { edgePadding: MAP_PADDING, animated: true });
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

  const saveCurrentAsPlace = (placeId) => {
    const coord = activeInput === "origin" ? origin : destination;
    const name = activeInput === "origin" ? originText : destText;
    if (coord && name) savePlace(placeId, coord, name);
  };

  const handleMapPress = (e) => {
    if (navActive) return;
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
    stopNavigation();
    clearRoute();
    setPanelCollapsed(false);
    setOrigin(null); setDestination(null);
    setOriginText(""); setDestText("");
    setSuggestions([]); setActiveInput(null);
    mapRef.current?.animateToRegion(IZMIR_REGION, 500);
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

  const startNavigation = () => {
    if (!displayRoute) return;
    setNavRouteIdx(selectedRouteIdx >= 0 ? selectedRouteIdx : 0);
    setNavActive(true);
    setNavFollow(true);
    setSuggestions([]);
    setActiveInput(null);
    Keyboard.dismiss();
  };

  const stopNavigation = () => {
    setNavActive(false);
    setNavFollow(true);
    if (mapRoute) fitToRoute(mapRoute);
  };

  // Rota dışına çıkıldığında: mevcut konumdan varışa yeni rota kur ve onu takip et
  const handleRecalculate = () => {
    if (!userLocation || !destination) return;
    setOrigin(userLocation);
    setOriginText("Mevcut konumum");
    doFetchRoute(userLocation, destination, profile, "Mevcut konumum", destText).then((result) => {
      if (result?.[0]) setNavRouteIdx(0);
      else setNavActive(false);
    });
  };

  const getPanelSummary = () => {
    if (loading) return "Rota aranıyor...";
    if (error) return "Rota bulunamadı";
    if (displayRoute) {
      return `${Math.round(displayRoute.totalDuration / 60)} dk · ${displayRoute.totalDistance} km · ${displayRoute.walkDistance} km yürüyüş · ${displayRoute.transfers} aktarma`;
    }
    if (!origin) return "Başlangıç seçin";
    if (!destination) return "Varış seçin";
    return "Rota hazır";
  };

  return (
    <View style={[s.container, { backgroundColor: theme.bg }]}>
      <MapView
        ref={mapRef}
        style={s.map}
        initialRegion={IZMIR_REGION}
        onPress={handleMapPress}
        onPanDrag={() => { if (navActive) setNavFollow(false); }}
        // Navigasyonda haritanın kendi mavi noktası kapatılır: konum tek imleçle
        // (UserPuck) gösterilir, aksi hâlde ham GPS ile rotaya oturtulmuş nokta
        // iki ayrı işaret olarak yan yana görünür.
        showsUserLocation={!navActive}
        showsMyLocationButton={false}
        userInterfaceStyle="light"
      >
        {origin && <Marker coordinate={origin} pinColor="#4ade80" title="Başlangıç" />}
        {destination && <Marker coordinate={destination} pinColor="#f87171" title="Varış" />}

        <BisimMarkers stations={bisimStations} />
        <BikeParkingMarkers stations={parkingStations} />
        <OsmParkingMarkers spots={osmParking} />
        <ParkAndRideMarkers stations={prStations} />
        <ActiveParkingMarker point={mapRoute?.parkingPoint} />
        <RouteOverlay route={mapRoute} />

        {navActive && <UserPuck point={navPoint} heading={cameraHeading} offRoute={offRoute} />}
      </MapView>

      {!navActive && userLocation && !origin && (
        <TouchableOpacity
          style={[s.locateFab, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={handleLocateMe}
          activeOpacity={0.85}
        >
          <AppIcon name="locate" size={22} color={theme.text} />
        </TouchableOpacity>
      )}

      {/* Navigasyonda "Ortala": takip kapalıyken vurgulanır ve etiket alır */}
      {navActive && (
        <TouchableOpacity
          style={[
            s.recenterFab,
            {
              backgroundColor: navFollow ? theme.surface : theme.active,
              borderColor: navFollow ? theme.border : theme.active,
            },
          ]}
          onPress={recenterNavigation}
          activeOpacity={0.85}
        >
          <AppIcon name="locate" size={20} color={navFollow ? theme.muted : "#0f1117"} />
          {!navFollow && <Text style={s.recenterText}>Ortala</Text>}
        </TouchableOpacity>
      )}

      {navActive ? (
        <NavigationOverlay
          progress={progress}
          offRoute={offRoute}
          waitingForFix={permission === "granted" && !userLocation}
          onRecalculate={handleRecalculate}
          onStop={stopNavigation}
        />
      ) : (
        <>
          <SearchPanel
            profiles={profiles}
            profile={profile}
            onSelectProfile={changeProfile}
            bikeType={bikeType}
            onSelectBikeType={setBikeTypeOption}
            carMode={carMode}
            onToggleCarMode={toggleCarMode}
            originText={originText}
            destText={destText}
            onChangeText={handleSearch}
            onFocusField={(field) => { setActiveInput(field); setSuggestions([]); }}
            onSwap={handleSwap}
            onLocateMe={handleLocateMe}
            hasUserLocation={!!userLocation}
            suggestions={suggestions}
            onSelectSuggestion={selectSuggestion}
            savedPlaces={savedPlaces}
            savedPlacesOpen={savedPlacesOpen}
            onToggleSavedPlaces={() => setSavedPlacesOpen((v) => !v)}
            onUsePlace={usePlace}
            onSavePlace={saveCurrentAsPlace}
          />

          <View style={[s.bottomPanel, panelCollapsed && s.bottomPanelCollapsed, { backgroundColor: theme.surface }]}>
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

                {displayRoute && (
                  <TouchableOpacity
                    style={[s.navBtn, { backgroundColor: theme.active }]}
                    onPress={startNavigation}
                    activeOpacity={0.85}
                    disabled={permission === "denied"}
                  >
                    <View style={s.navBtnContent}>
                      <AppIcon name="navigation" size={16} color="#0f1117" />
                      <Text style={s.navBtnText}>
                        {permission === "denied" ? "Konum izni gerekli" : "Navigasyonu Başlat"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}

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
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  locateFab: {
    position: "absolute", right: 16, bottom: 270,
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 1, alignItems: "center", justifyContent: "center", zIndex: 5,
    shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 6, shadowOffset: { height: 2 },
    elevation: 6,
  },
  recenterFab: {
    position: "absolute", right: 16, bottom: 210,
    flexDirection: "row", alignItems: "center", gap: 6,
    minHeight: 48, borderRadius: 24, borderWidth: 1,
    paddingHorizontal: 14, justifyContent: "center", zIndex: 25,
    shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 6, shadowOffset: { height: 2 },
    elevation: 6,
  },
  recenterText: { fontSize: 13, fontWeight: "800", color: "#0f1117" },
  bottomPanel: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 18, borderTopRightRadius: 18,
    padding: 12, paddingBottom: 16, maxHeight: "54%",
    shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { height: -2 },
    elevation: 10,
  },
  bottomPanelCollapsed: { paddingTop: 8, paddingBottom: 10, maxHeight: 76 },
  panelToggle: { marginBottom: 8 },
  panelToggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  panelSummary: { flex: 1, fontSize: 12, fontWeight: "800" },
  handle: { width: 32, height: 3, borderRadius: 2, alignSelf: "center", marginBottom: 10 },
  navBtn: { marginTop: 8, borderRadius: 10, paddingVertical: 11, alignItems: "center" },
  navBtnContent: { flexDirection: "row", alignItems: "center", gap: 7 },
  navBtnText: { fontSize: 13, fontWeight: "900", color: "#0f1117" },
  resetBtn: { marginTop: 8, borderWidth: 1, borderRadius: 9, paddingVertical: 7, alignItems: "center" },
  resetContent: { flexDirection: "row", alignItems: "center", gap: 6 },
  resetText: { fontSize: 12, fontWeight: "700" },
});
