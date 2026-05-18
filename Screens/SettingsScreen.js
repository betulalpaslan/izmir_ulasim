import { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, SafeAreaView, StatusBar, Switch,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import AppIcon from "../Components/AppIcon";
import { useTheme } from "../utils/ThemeContext";

// İzmir A Tarifesi — İzmirim Kart (90 dk aktarma dahil) ve Kredi Kartı (her binişte ayrı)
const PASSENGERS = [
  { id: "tam",        icon: "user",      name: "Tam",              desc: "İzmirim Kart · 90 dk aktarma dahil", fare: "35,00 ₺", base: 35,   perBoarding: false },
  { id: "genc",       icon: "student",   name: "Genç",             desc: "7-25 yaş · 90 dk aktarma dahil",     fare: "17,50 ₺", base: 17.5, perBoarding: false },
  { id: "ogretmen",   icon: "work",      name: "Öğretmen",         desc: "İzmirim Kart · 90 dk aktarma dahil", fare: "23,50 ₺", base: 23.5, perBoarding: false },
  { id: "yas60",      icon: "userCog",   name: "60 Yaş",           desc: "İzmirim Kart · 90 dk aktarma dahil", fare: "29,00 ₺", base: 29,   perBoarding: false },
  { id: "kredikarti", icon: "userCircle",name: "Kredi / Banka Kartı", desc: "Her binişte ayrı ücret · aktarma hakkı yok", fare: "39,00 ₺", base: 39, perBoarding: true },
];

const VEHICLES = [
  { id: "bicycle", icon: "bike", name: "Bisikletim var", color: "#4ade80", hint: "Bisiklet rotaları açılır" },
  { id: "car",     icon: "car", name: "Arabam var",     color: "#f97316", hint: "Araba ve Park+Taşı rotaları açılır" },
];

function buildProfiles(hasVehicle) {
  const profiles = ["transit"];
  if (hasVehicle?.bicycle) profiles.unshift("bicycle");
  if (hasVehicle?.car)     profiles.splice(profiles.length - 1, 0, "car");
  return profiles;
}

export default function SettingsScreen({ navigation }) {
  const { theme, mode, setThemeMode } = useTheme();
  const [prefs, setPrefs] = useState(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const raw = await AsyncStorage.getItem("userPrefs");
          if (raw) setPrefs(JSON.parse(raw));
        } catch {}
      })();
    }, [])
  );

  const savePrefs = async (newPrefs) => {
    await AsyncStorage.setItem("userPrefs", JSON.stringify(newPrefs));
    setPrefs(newPrefs);
  };

  const setPassengerType = (id) => {
    if (!prefs) return;
    const info = PASSENGERS.find((p) => p.id === id);
    savePrefs({
      ...prefs,
      passengerType: id,
      fareBase: info.base,
      farePerBoarding: info.perBoarding,
    });
  };

  const toggleVehicle = (vehicleId) => {
    if (!prefs) return;
    const current = prefs.hasVehicle || {};
    const newHasVehicle = { ...current, [vehicleId]: !current[vehicleId] };
    savePrefs({
      ...prefs,
      hasVehicle: newHasVehicle,
      visibleProfiles: buildProfiles(newHasVehicle),
    });
  };

  const resetApp = () => {
    Alert.alert(
      "Uygulamayı Sıfırla",
      "Tüm ayarlar, kayıtlı yerler ve geçmiş silinecek. Emin misiniz?",
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Sıfırla",
          style: "destructive",
          onPress: async () => {
            await AsyncStorage.multiRemove(["userPrefs", "savedPlaces", "routeHistory", "themeMode"]);
            navigation.getParent()?.reset({ index: 0, routes: [{ name: "Onboarding" }] });
          },
        },
      ]
    );
  };

  if (!prefs) {
    return (
      <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />
        <View style={s.loadingBox}>
          <Text style={[s.loadingText, { color: theme.muted }]}>Yükleniyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <Text style={[s.headerTitle, { color: theme.text }]}>Ayarlar</Text>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

        <Text style={[s.sectionTitle, { color: theme.text }]}>Görünüm</Text>
        <Text style={[s.sectionHint, { color: theme.muted }]}>Uygulama temasını değiştirin</Text>
        <View style={[s.toggleCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[s.optionIconBox, { borderColor: theme.border, backgroundColor: theme.input }]}>
            <AppIcon name={mode === "dark" ? "settings" : "sun"} size={22} color={theme.active} />
          </View>
          <View style={s.optionInfo}>
            <Text style={[s.optionName, { color: theme.text }]}>Koyu Tema</Text>
            <Text style={[s.optionDesc, { color: theme.muted }]}>Light / dark mod</Text>
          </View>
          <Switch
            value={mode === "dark"}
            onValueChange={(enabled) => setThemeMode(enabled ? "dark" : "light")}
            trackColor={{ false: theme.border, true: theme.active + "60" }}
            thumbColor={mode === "dark" ? theme.active : theme.muted}
          />
        </View>

        <Text style={[s.sectionTitle, { color: theme.text, marginTop: 24 }]}>Yolcu Tipi</Text>
        <Text style={[s.sectionHint, { color: theme.muted }]}>Bilet ücreti hesaplamasını etkiler</Text>
        {PASSENGERS.map((p) => {
          const sel = prefs.passengerType === p.id;
          return (
            <TouchableOpacity
              key={p.id}
              style={[s.optionCard, { backgroundColor: theme.surface, borderColor: theme.border }, sel && s.optionCardActive]}
              onPress={() => setPassengerType(p.id)}
              activeOpacity={0.75}
            >
              <View style={[s.optionIconBox, { borderColor: theme.border, backgroundColor: theme.input }, sel && s.optionIconBoxActive]}>
                <AppIcon name={p.icon} size={22} color={sel ? theme.active : theme.muted} />
              </View>
              <View style={s.optionInfo}>
                <Text style={[s.optionName, { color: theme.text }, sel && { color: theme.active }]}>{p.name}</Text>
                <Text style={[s.optionDesc, { color: theme.muted }]}>{p.desc} — <Text style={{ color: theme.text }}>{p.fare}</Text></Text>
              </View>
              <View style={[s.radio, { borderColor: theme.border }, sel && { borderColor: theme.active }]}>
                {sel && <View style={[s.radioDot, { backgroundColor: theme.active }]} />}
              </View>
            </TouchableOpacity>
          );
        })}

        <Text style={[s.sectionTitle, { color: theme.text, marginTop: 24 }]}>Araçlarım</Text>
        <Text style={[s.sectionHint, { color: theme.muted }]}>Sahip olduğunuz araçlara göre rota seçenekleri eklenir</Text>
        {VEHICLES.map((v) => {
          const enabled = prefs.hasVehicle?.[v.id] === true;
          return (
            <View key={v.id} style={[s.toggleCard, { backgroundColor: theme.surface, borderColor: theme.border }, enabled && { borderColor: v.color + "40" }]}>
              <View style={[s.optionIconBox, { borderColor: theme.border, backgroundColor: theme.input }, enabled && { borderColor: v.color + "30", backgroundColor: v.color + "10" }]}>
                <AppIcon name={v.icon} size={22} color={enabled ? v.color : theme.muted} />
              </View>
              <View style={s.optionInfo}>
                <Text style={[s.optionName, { color: theme.text }, enabled && { color: v.color }]}>{v.name}</Text>
                <Text style={[s.optionDesc, { color: theme.muted }]}>{v.hint}</Text>
              </View>
              <Switch
                value={enabled}
                onValueChange={() => toggleVehicle(v.id)}
                trackColor={{ false: theme.border, true: v.color + "60" }}
                thumbColor={enabled ? v.color : theme.muted}
              />
            </View>
          );
        })}

        <View style={[s.divider, { backgroundColor: theme.border }]} />

        <TouchableOpacity style={s.dangerBtn} onPress={resetApp} activeOpacity={0.8}>
          <View style={s.dangerTitleRow}>
            <AppIcon name="trash" size={17} color="#f87171" />
            <Text style={s.dangerText}>Uygulamayı Sıfırla</Text>
          </View>
          <Text style={s.dangerDesc}>Tüm ayarlar ve favoriler silinir, kurulum başa döner</Text>
        </TouchableOpacity>

        <View style={[s.aboutBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[s.aboutName, { color: theme.text }]}>İzmir Ulaşım</Text>
          <Text style={[s.aboutVersion, { color: theme.muted }]}>Versiyon 1.0.0</Text>
          <Text style={[s.aboutLine, { color: theme.muted }]}>İzmir için çoklu modal ulaşım planlayıcısı</Text>
          <View style={s.aboutTags}>
            <View style={[s.aboutTag, { backgroundColor: theme.input, borderColor: theme.border }]}>
              <AppIcon name="map" size={13} color={theme.muted} />
              <Text style={[s.aboutTagText, { color: theme.muted }]}>OpenStreetMap</Text>
            </View>
            <View style={[s.aboutTag, { backgroundColor: theme.input, borderColor: theme.border }]}>
              <AppIcon name="bus" size={13} color={theme.muted} />
              <Text style={[s.aboutTagText, { color: theme.muted }]}>OpenTripPlanner</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f1117" },
  header: {
    paddingHorizontal: 24, paddingTop: 16, paddingBottom: 20,
    borderBottomWidth: 1, borderBottomColor: "#2a2f3d",
  },
  headerTitle: { color: "#e8eaf0", fontSize: 24, fontWeight: "800" },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 60 },
  loadingBox: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { color: "#7a8299", fontSize: 16 },

  sectionTitle: { color: "#e8eaf0", fontSize: 16, fontWeight: "800", marginBottom: 4 },
  sectionHint: { color: "#7a8299", fontSize: 12, marginBottom: 14 },

  optionCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "#181c25", borderWidth: 1, borderColor: "#2a2f3d",
    borderRadius: 14, padding: 14, marginBottom: 10,
  },
  optionCardActive: { borderColor: "#60a5fa40", backgroundColor: "#60a5fa06" },
  optionIconBox: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: "#0f1117", borderWidth: 1, borderColor: "#2a2f3d",
    alignItems: "center", justifyContent: "center",
  },
  optionIconBoxActive: { borderColor: "#60a5fa40", backgroundColor: "#60a5fa10" },
  optionInfo: { flex: 1 },
  optionName: { color: "#e8eaf0", fontSize: 15, fontWeight: "700" },
  optionDesc: { color: "#7a8299", fontSize: 12, marginTop: 2 },
  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: "#2a2f3d",
    alignItems: "center", justifyContent: "center",
  },
  radioActive: { borderColor: "#60a5fa" },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#60a5fa" },

  toggleCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "#181c25", borderWidth: 1, borderColor: "#2a2f3d",
    borderRadius: 14, padding: 14, marginBottom: 10,
  },

  divider: { height: 1, backgroundColor: "#2a2f3d", marginVertical: 24 },

  dangerBtn: {
    backgroundColor: "#f871711a", borderWidth: 1, borderColor: "#f8717130",
    borderRadius: 14, padding: 16, alignItems: "center", marginBottom: 16,
  },
  dangerTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dangerText: { color: "#f87171", fontSize: 15, fontWeight: "700" },
  dangerDesc: { color: "#f8717170", fontSize: 12, marginTop: 6, textAlign: "center" },

  aboutBox: {
    backgroundColor: "#181c25", borderWidth: 1, borderColor: "#2a2f3d",
    borderRadius: 14, padding: 20, alignItems: "center", gap: 6,
  },
  aboutName: { color: "#e8eaf0", fontSize: 18, fontWeight: "800" },
  aboutVersion: { color: "#7a8299", fontSize: 12 },
  aboutLine: { color: "#7a8299", fontSize: 13, textAlign: "center" },
  aboutTags: { flexDirection: "row", gap: 8, marginTop: 8 },
  aboutTag: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#0f1117", borderWidth: 1, borderColor: "#2a2f3d",
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  aboutTagText: { color: "#7a8299", fontSize: 12 },
});
