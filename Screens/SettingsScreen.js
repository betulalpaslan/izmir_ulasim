import { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, SafeAreaView, StatusBar, Switch,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import AppIcon from "../Components/AppIcon";
import { useTheme } from "../utils/ThemeContext";
import { BILET_TARIFESI, BISIM_TARIFESI, ucretYazi } from "../utils/routeScoring";

// İzmir A Tarifesi. RAKAMLAR BURADA DEĞİL: tarife utils/routeScoring.js'te
// tek yerde duruyor, bu ekran yalnız ikon eşlemesini ekliyor. Rakamı
// kopyalamak zaten bir kere ters tepmişti — onboarding ekranı "Yetişkin
// 25,00 ₺" derken ayarlar aynı bilete 35,00 ₺ diyordu.
const YOLCU_IKONU = {
  tam: "user", genc: "student", ogretmen: "work",
  yas60: "userCog", kredikarti: "userCircle",
};
const PASSENGERS = BILET_TARIFESI.map((b) => ({
  id: b.id,
  icon: YOLCU_IKONU[b.id] || "user",
  name: b.ad,
  desc: b.aciklama,
  fare: `${ucretYazi(b.base)} ₺`,
  base: b.base,
  perBoarding: b.perBoarding,
}));

// BİSİM tarifesi bir AYAR değil, bilgi: kullanıcı seçmiyor, sürüş süresine
// göre hesaplanıyor. Rota kartındaki ücretin neden bilet fiyatından yüksek
// çıktığı burada karşılığını buluyor.
const BISIM_SATIRLARI = [
  { l: `İlk ${BISIM_TARIFESI.acilisDakika} dakika`, v: `${ucretYazi(BISIM_TARIFESI.acilisUcreti)} ₺` },
  { l: "Sonraki her dakika", v: `${ucretYazi(BISIM_TARIFESI.dakikaUcreti)} ₺` },
  { l: "1 saat sürüş", v: `${ucretYazi(BISIM_TARIFESI.acilisUcreti + (60 - BISIM_TARIFESI.acilisDakika) * BISIM_TARIFESI.dakikaUcreti)} ₺` },
];

const VEHICLES = [
  { id: "bicycle", icon: "bike", name: "Bisikletim var", color: "#22c55e", hint: "Bisiklet rotaları açılır" },
  { id: "car",     icon: "car", name: "Arabam var",     color: "#f97316", hint: "Araba ve Park+Taşı rotaları açılır" },
];

// Onboarding eskiden student/adult/senior yazıyordu, bu ekran tam/genc/…
// bekliyor. Eşleştirmeyen kimlik hiçbir kartı seçili göstermiyordu — eski
// kurulumlar boş bir yolcu tipi listesiyle karşılaşmasın diye çevriliyor.
const ESKI_YOLCU_TIPI = { student: "genc", adult: "tam", senior: "yas60" };

function eskiYolcuTipiniCevir(prefs) {
  const yeni = ESKI_YOLCU_TIPI[prefs?.passengerType];
  if (!yeni) return prefs;
  const tarife = PASSENGERS.find((p) => p.id === yeni);
  return { ...prefs, passengerType: yeni, fareBase: tarife.base, farePerBoarding: tarife.perBoarding };
}

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
          if (raw) setPrefs(eskiYolcuTipiniCevir(JSON.parse(raw)));
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

        <Text style={[s.sectionTitle, { color: theme.text, marginTop: 24 }]}>BİSİM Tarifesi</Text>
        <Text style={[s.sectionHint, { color: theme.muted }]}>Standart bisiklet · rota kartındaki ücrete eklenir</Text>
        <View style={[s.fareCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {BISIM_SATIRLARI.map((r) => (
            <View key={r.l} style={s.fareRow}>
              <Text style={[s.fareLabel, { color: theme.muted }]}>{r.l}</Text>
              <Text style={[s.fareValue, { color: theme.text }]}>{r.v}</Text>
            </View>
          ))}
          <Text style={[s.fareNote, { color: theme.muted }]}>
            Kiralamada kredi kartından {ucretYazi(BISIM_TARIFESI.provizyon)} ₺ ön provizyon bloke edilir.
            İade edildiği için rota ücretine dahil değildir.
          </Text>
        </View>

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
  container: { flex: 1, backgroundColor: "#14111f" },
  header: {
    paddingHorizontal: 24, paddingTop: 16, paddingBottom: 20,
    borderBottomWidth: 1, borderBottomColor: "#322a4a",
  },
  headerTitle: { color: "#ece9f7", fontSize: 24, fontWeight: "800" },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 60 },
  loadingBox: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { color: "#9b93b8", fontSize: 16 },

  sectionTitle: { color: "#ece9f7", fontSize: 16, fontWeight: "800", marginBottom: 4 },
  sectionHint: { color: "#9b93b8", fontSize: 12, marginBottom: 14 },

  optionCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "#1e1a2e", borderWidth: 1, borderColor: "#322a4a",
    borderRadius: 14, padding: 14, marginBottom: 10,
  },
  optionCardActive: { borderColor: "#8b5cf640", backgroundColor: "#8b5cf606" },
  optionIconBox: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: "#14111f", borderWidth: 1, borderColor: "#322a4a",
    alignItems: "center", justifyContent: "center",
  },
  optionIconBoxActive: { borderColor: "#8b5cf640", backgroundColor: "#8b5cf610" },
  optionInfo: { flex: 1 },
  optionName: { color: "#ece9f7", fontSize: 15, fontWeight: "700" },
  optionDesc: { color: "#9b93b8", fontSize: 12, marginTop: 2 },
  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: "#322a4a",
    alignItems: "center", justifyContent: "center",
  },
  radioActive: { borderColor: "#8b5cf6" },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#8b5cf6" },

  fareCard: {
    borderWidth: 1, borderRadius: 14, padding: 16, gap: 10,
  },
  fareRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  fareLabel: { fontSize: 13 },
  fareValue: { fontSize: 15, fontWeight: "800" },
  fareNote: { fontSize: 11, lineHeight: 16, marginTop: 4 },

  toggleCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "#1e1a2e", borderWidth: 1, borderColor: "#322a4a",
    borderRadius: 14, padding: 14, marginBottom: 10,
  },

  divider: { height: 1, backgroundColor: "#322a4a", marginVertical: 24 },

  dangerBtn: {
    backgroundColor: "#f871711a", borderWidth: 1, borderColor: "#f8717130",
    borderRadius: 14, padding: 16, alignItems: "center", marginBottom: 16,
  },
  dangerTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dangerText: { color: "#f87171", fontSize: 15, fontWeight: "700" },
  dangerDesc: { color: "#f8717170", fontSize: 12, marginTop: 6, textAlign: "center" },

  aboutBox: {
    backgroundColor: "#1e1a2e", borderWidth: 1, borderColor: "#322a4a",
    borderRadius: 14, padding: 20, alignItems: "center", gap: 6,
  },
  aboutName: { color: "#ece9f7", fontSize: 18, fontWeight: "800" },
  aboutVersion: { color: "#9b93b8", fontSize: 12 },
  aboutLine: { color: "#9b93b8", fontSize: 13, textAlign: "center" },
  aboutTags: { flexDirection: "row", gap: 8, marginTop: 8 },
  aboutTag: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#14111f", borderWidth: 1, borderColor: "#322a4a",
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  aboutTagText: { color: "#9b93b8", fontSize: 12 },
});
