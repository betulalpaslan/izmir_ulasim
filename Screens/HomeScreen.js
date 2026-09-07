import { useState, useRef, useEffect, useMemo } from "react";
import { StyleSheet, View, Text, TouchableOpacity, Keyboard, Alert } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { searchAddress, aramayiIptalEt } from "../Services/api";
import SearchPanel from "../Components/SearchPanel";
import RoutePanel from "../Components/RoutePanel";
import NavigationOverlay from "../Components/NavigationOverlay";
import AppIcon from "../Components/AppIcon";
import {
  BisimMarkers, BikeParkingMarkers,
  ParkAndRideMarkers, ActiveParkingMarker, RouteOverlay, UserPuck,
} from "../Components/MapLayers";
import { useTheme } from "../utils/ThemeContext";
import { getTimeContext } from "../utils/timeContext";
import { useSettings } from "../hooks/useSettings";
import { useLocationService } from "../hooks/useLocationService";
import { useRouteSearch } from "../hooks/useRouteSearch";
import { useNavigationMode } from "../hooks/useNavigationMode";
import { useMapLayers } from "../hooks/useMapLayers";
import { useRouteTargets } from "../hooks/useRouteTargets";

const IZMIR_REGION = { latitude: 38.428, longitude: 27.16, latitudeDelta: 0.08, longitudeDelta: 0.08 };
const MAP_PADDING = { top: 120, right: 60, bottom: 300, left: 60 };

export default function HomeScreen() {
  const { theme } = useTheme();
  const mapRef = useRef(null);

  // Başlangıç / varış ve arama alanları — hepsi tek hook'ta, bkz.
  // hooks/useRouteTargets.js.
  const {
    origin, destination, originText, destText,
    suggestions, setSuggestions, activeInput, setActiveInput,
    hedefAlani, noktaSec, metinYaz, takasla, aramayiKapat: listeyiKapat, temizle,
  } = useRouteTargets();

  // Listeyi boşaltmak tek başına yetmiyordu: 250 ms önce yola çıkmış bir cevap
  // dönüp listeyi kendiliğinden yeniden açıyor, seçilmiş noktanın üstüne öneri
  // kutusu biniyordu. Kapatmak artık iptal etmeyi de kapsıyor.
  const aramayiKapat = () => { aramayiIptalEt(); listeyiKapat(); };

  // Ekran gidince bekleyen arama da gitsin; sekme değiştikten sonra bir istek
  // daha yola çıkıyordu.
  useEffect(() => {
    return () => { aramayiIptalEt(); };
  }, []);
  const [savedPlacesOpen, setSavedPlacesOpen] = useState(false);

  const [profile, setProfile] = useState("transit");
  // Bisiklet profilinin varsayılanı "kendi bisikletim + aktarma". null bir
  // seçenek yok: eski üçüncü mod (baştan sona sürüş) kaldırıldı, bkz.
  // Components/SearchPanel.js BIKE_OPTIONS.
  const [bikeType, setBikeType] = useState("PARK");
  const [carMode, setCarMode] = useState(null);
  const [panelCollapsed, setPanelCollapsed] = useState(false);

  // Harita katmanları ve yüklenemediklerinde gösterilen sebep — bkz.
  // hooks/useMapLayers.js.
  const { bisim, parkingStations, prStations, layerError, clearLayerError } =
    useMapLayers(profile, bikeType, carMode);

  // Saat ipucu her aramada tazeleniyor. Bir kez hesaplanıp donuyordu:
  // uygulama arka planda kalıp saatler sonra açıldığında "yoğun saat"
  // uyarısı hâlâ ekranda duruyordu.
  const [timeTip, setTimeTip] = useState(getTimeContext);

  const { fareBase, farePerBoarding, profiles, savedPlaces, savePlace } = useSettings();
  const { routes, loading, error, notice, modBos, fetchRoute, clearRoute } = useRouteSearch(fareBase, farePerBoarding);
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

  useEffect(() => { setSelectedRouteIdx(0); }, [routes]);

  // Düz arabada eskiden AYRI bir OSM katmanı vardı (/parking/osm). Kaldırıldı:
  // o uç Overpass'a bağlı ve ölçüldüğünde 502 dönüyordu ("veri hiçbir
  // kaynaktan alınamadı"), yani katman sessizce boştu — kullanıcı araba
  // seçtiğinde hiçbir otopark görmüyordu. Yerine yukarıdaki İZELMAN envanteri
  // geçti: 82 otopark, 13'ünde canlı doluluk, ve web ile aynı kaynak.
  //
  // Overpass geri gelirse iki kaynak BİRLEŞTİRİLEBİLİR — OSM'de İZELMAN'da
  // olmayan yeraltı/kapalı otoparklar var. `fetchOsmParkingSpots` ve
  // `OsmParkingMarkers` o gün için serviste duruyor.

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

  // Seçilen mod bu yolculukta işini göremediğinde sunulan çıkış: düz toplu
  // taşımaya geç ve aynı yolculuğu yeniden ara. Profil GERÇEKTEN değişir —
  // kullanıcı transit sonucuna baktığını sekmeden de görür; sessizce başka
  // modun sonucunu göstermek vaadi bozardı.
  const handleAlternative = () => {
    if (!origin || !destination) return;
    setProfile("transit");
    doFetchRoute(origin, destination, "transit", originText, destText);
  };

  const doFetchRoute = (from, to, prof, fromName = "", toName = "", bType = bikeType, cMode = carMode) => {
    setPanelCollapsed(false);
    setTimeTip(getTimeContext());
    return fetchRoute(from, to, prof, fromName, toName, bType, cMode).then((result) => {
      if (result?.[0] && !navActive) fitToRoute(result[0]);
      return result;
    });
  };

  // İki uç da dolduğunda aramayı başlatan ortak yol. `noktaSec` çifti
  // döndürüyorsa yolculuk hazır demektir.
  const fetchIfReady = (cift) => {
    if (cift) doFetchRoute(cift.origin, cift.destination, profile, cift.originText, cift.destText);
    return cift;
  };

  const handleSearch = (text, field) => {
    metinYaz(field, text);
    setActiveInput(field);
    searchAddress(text, setSuggestions);
  };

  // Kutu değiştirmek de bir iptaldir. Yalnız listeyi boşaltmak yetmiyordu:
  // Başlangıç için yola çıkmış cevap dönüp Varış kutusunun altında açılıyor,
  // kullanıcı dokununca Başlangıç için aradığı yer VARIŞ olarak yazılıyordu —
  // selectSuggestion o anki activeInput'e bakar.
  const handleFocusField = (field) => {
    aramayiIptalEt();
    setActiveInput(field);
    setSuggestions([]);
  };

  const selectSuggestion = (item) => {
    const coord = { latitude: parseFloat(item.lat), longitude: parseFloat(item.lon) };
    const name = item.display_name.split(",")[0];
    const cift = fetchIfReady(noktaSec(activeInput === "origin" ? "origin" : "dest", coord, name));

    if (cift) {
      mapRef.current?.fitToCoordinates([cift.origin, cift.destination], { edgePadding: MAP_PADDING, animated: true });
    } else {
      mapRef.current?.animateToRegion({ ...coord, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 500);
    }
    aramayiKapat(); Keyboard.dismiss();
  };

  const usePlace = (place) => {
    if (!place.address) return;
    const { coord, name } = place.address;
    fetchIfReady(noktaSec(hedefAlani(), coord, name));
    aramayiKapat(); Keyboard.dismiss();
    mapRef.current?.animateToRegion({ ...coord, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 500);
  };

  // Kaydetme sessizce başarısız olabiliyordu: ekran kayıtlı gösteriyor,
  // uygulama yeniden açıldığında yer kayboluyordu.
  const saveCurrentAsPlace = async (placeId) => {
    const coord = activeInput === "origin" ? origin : destination;
    const name = activeInput === "origin" ? originText : destText;
    if (!coord || !name) return;
    if (!(await savePlace(placeId, coord, name))) {
      Alert.alert("Kaydedilemedi", "Yer cihaza yazılamadı. Depolama alanınız dolu olabilir.");
    }
  };

  // Haritaya dokunmak yalnız BOŞ ucu doldurur; iki uç da doluysa dokunuş
  // yok sayılır (aksi hâlde kullanıcı rotayı kazara siliyordu).
  const handleMapPress = (e) => {
    if (navActive || (origin && destination)) return;
    const coord = e.nativeEvent.coordinate;
    const label = `${coord.latitude.toFixed(4)}, ${coord.longitude.toFixed(4)}`;
    aramayiIptalEt();
    setSuggestions([]);
    fetchIfReady(noktaSec(origin ? "dest" : "origin", coord, label));
  };

  const handleLocateMe = () => {
    if (!userLocation) return;
    const cift = noktaSec("origin", userLocation, "Mevcut konumum");
    mapRef.current?.animateToRegion({ ...userLocation, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 500);
    fetchIfReady(cift);
  };

  const handleReset = () => {
    stopNavigation();
    clearRoute();
    setPanelCollapsed(false);
    aramayiIptalEt();
    temizle();
    mapRef.current?.animateToRegion(IZMIR_REGION, 500);
  };

  const handleSwap = () => {
    fetchIfReady(takasla());
  };

  const changeProfile = (p) => {
    setProfile(p); setBikeType(null); setCarMode(null);
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
    aramayiKapat();
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
    // Varış zaten dolu, dolayısıyla çift her zaman hazır dönüyor.
    const cift = noktaSec("origin", userLocation, "Mevcut konumum");
    doFetchRoute(cift.origin, cift.destination, profile, cift.originText, cift.destText).then((result) => {
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
        {origin && <Marker coordinate={origin} pinColor={theme.accentBike} title="Başlangıç" />}
        {destination && <Marker coordinate={destination} pinColor={theme.danger} title="Varış" />}

        <BisimMarkers stations={bisim.bolgeler} hizmetAlani={bisim.hizmetAlani} />
        {/* "Park + Taşıma" ile "Kendi Bisikletim" farklı kaynaklardan beslenir;
            ayırt edilebilmeleri için ayrı renkle çizilirler. */}
        <BikeParkingMarkers stations={parkingStations} variant={bikeType === "PARK" ? "pr" : "own"} />
        <ParkAndRideMarkers stations={prStations} />
        <ActiveParkingMarker point={mapRoute?.parkingPoint} />
        <RouteOverlay route={mapRoute} />

        {navActive && <UserPuck point={navPoint} heading={cameraHeading} offRoute={offRoute} />}
      </MapView>

      {/* Sessizce boş kalan katman yerine görünür sebep. Dokununca kapanır. */}
      {!navActive && layerError && (
        <TouchableOpacity
          style={[s.layerWarning, { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow }]}
          onPress={clearLayerError}
          activeOpacity={0.85}
        >
          <AppIcon name="alert" size={16} color={theme.accentCar} />
          <Text style={[s.layerWarningText, { color: theme.text }]} numberOfLines={2}>
            {layerError}
          </Text>
        </TouchableOpacity>
      )}

      {!navActive && userLocation && !origin && (
        <TouchableOpacity
          style={[s.locateFab, { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow }]}
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
              shadowColor: theme.shadow,
            },
          ]}
          onPress={recenterNavigation}
          activeOpacity={0.85}
        >
          <AppIcon name="locate" size={20} color={navFollow ? theme.muted : "#ffffff"} />
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
            onFocusField={handleFocusField}
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

          <View style={[s.bottomPanel, panelCollapsed && s.bottomPanelCollapsed, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}>
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
                  notice={notice}
                  modBos={modBos}
                  onAlternative={handleAlternative}
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
                      <AppIcon name="navigation" size={16} color="#ffffff" />
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
    shadowOpacity: 0.4, shadowRadius: 6, shadowOffset: { height: 2 },
    elevation: 6,
  },
  recenterFab: {
    position: "absolute", right: 16, bottom: 210,
    flexDirection: "row", alignItems: "center", gap: 6,
    minHeight: 48, borderRadius: 24, borderWidth: 1,
    paddingHorizontal: 14, justifyContent: "center", zIndex: 25,
    shadowOpacity: 0.4, shadowRadius: 6, shadowOffset: { height: 2 },
    elevation: 6,
  },
  // Vurgu renginin ÜSTÜNDEKİ yazı: zemin temadan değil vurgudan
  // geliyor, o yüzden sabit.
  recenterText: { fontSize: 13, fontWeight: "800", color: "#ffffff" },
  bottomPanel: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 18, borderTopRightRadius: 18,
    padding: 12, paddingBottom: 16, maxHeight: "54%",
    shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { height: -2 },
    elevation: 10,
  },
  bottomPanelCollapsed: { paddingTop: 8, paddingBottom: 10, maxHeight: 76 },
  panelToggle: { marginBottom: 8 },
  panelToggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  panelSummary: { flex: 1, fontSize: 12, fontWeight: "800" },
  handle: { width: 32, height: 3, borderRadius: 2, alignSelf: "center", marginBottom: 10 },
  navBtn: { marginTop: 8, borderRadius: 10, paddingVertical: 11, alignItems: "center" },
  navBtnContent: { flexDirection: "row", alignItems: "center", gap: 7 },
  navBtnText: { fontSize: 13, fontWeight: "900", color: "#ffffff" },
  resetBtn: { marginTop: 8, borderWidth: 1, borderRadius: 9, paddingVertical: 7, alignItems: "center" },
  resetContent: { flexDirection: "row", alignItems: "center", gap: 6 },
  resetText: { fontSize: 12, fontWeight: "700" },
  layerWarning: {
    position: "absolute", left: 16, right: 16, top: 130,
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12, zIndex: 30,
    shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { height: 2 },
    elevation: 8,
  },
  layerWarningText: { flex: 1, fontSize: 12, fontWeight: "700" },
});
