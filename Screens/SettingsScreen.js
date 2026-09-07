import { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, SafeAreaView, StatusBar, Switch,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import AppIcon from "../Components/AppIcon";
import { KAYITLI_YERLER_ANAHTARI } from "../utils/savedPlaces";
import { useTheme, TEMA_ANAHTARI } from "../utils/ThemeContext";
import { BILET_TARIFESI, BISIM_TARIFESI, ucretYazi } from "../utils/routeScoring";
import { tercihGovdesi, tercihleriOku, TERCIH_ANAHTARI } from "../utils/prefs";

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
}));

// BİSİM tarifesi bir AYAR değil, bilgi: kullanıcı seçmiyor, sürüş süresine
// göre hesaplanıyor. Rota kartındaki ücretin neden bilet fiyatından yüksek
// çıktığı burada karşılığını buluyor.
const BISIM_SATIRLARI = [
  { l: `İlk ${BISIM_TARIFESI.acilisDakika} dakika`, v: `${ucretYazi(BISIM_TARIFESI.acilisUcreti)} ₺` },
  { l: "Sonraki her dakika", v: `${ucretYazi(BISIM_TARIFESI.dakikaUcreti)} ₺` },
  { l: "1 saat sürüş", v: `${ucretYazi(BISIM_TARIFESI.acilisUcreti + (60 - BISIM_TARIFESI.acilisDakika) * BISIM_TARIFESI.dakikaUcreti)} ₺` },
];

// `color` bir renk değil, tema anahtarı — bkz. utils/theme.js.
const VEHICLES = [
  { id: "bicycle", icon: "bike", name: "Bisikletim var", color: "accentBike", hint: "Bisiklet rotaları açılır" },
  { id: "car",     icon: "car", name: "Arabam var",     color: "accentCar", hint: "Araba ve Park+Taşı rotaları açılır" },
];

export default function SettingsScreen({ navigation }) {
  const { theme, mode, setThemeMode } = useTheme();
  const [prefs, setPrefs] = useState(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const raw = await AsyncStorage.getItem(TERCIH_ANAHTARI);
          if (raw) setPrefs(tercihleriOku(raw));
        } catch {}
      })();
    }, [])
  );

  // Yazma başarısızsa ekranı da güncellemiyoruz: aksi halde ayar değişmiş
  // gibi görünüp uygulama yeniden açıldığında eskiye dönüyordu.
  const savePrefs = async (secim) => {
    const newPrefs = tercihGovdesi({ ...prefs, ...secim });
    try {
      await AsyncStorage.setItem(TERCIH_ANAHTARI, JSON.stringify(newPrefs));
    } catch {
      Alert.alert("Kaydedilemedi", "Ayar cihaza yazılamadı. Depolama alanınız dolu olabilir.");
      return;
    }
    setPrefs(newPrefs);
  };

  const setPassengerType = (id) => {
    if (!prefs) return;
    savePrefs({ passengerType: id });
  };

  const toggleVehicle = (vehicleId) => {
    if (!prefs) return;
    savePrefs({
      hasVehicle: { ...prefs.hasVehicle, [vehicleId]: !prefs.hasVehicle?.[vehicleId] },
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
            await AsyncStorage.multiRemove([
              TERCIH_ANAHTARI, KAYITLI_YERLER_ANAHTARI, "routeHistory", TEMA_ANAHTARI,
            ]);
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
              style={[s.optionCard, { backgroundColor: theme.surface, borderColor: theme.border }, sel && { borderColor: theme.active + "40", backgroundColor: theme.active + "0a" }]}
              onPress={() => setPassengerType(p.id)}
              activeOpacity={0.75}
            >
              <View style={[s.optionIconBox, { borderColor: theme.border, backgroundColor: theme.input }, sel && { borderColor: theme.active + "40", backgroundColor: theme.active + "10" }]}>
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
          const accent = theme[v.color];
          return (
            <View key={v.id} style={[s.toggleCard, { backgroundColor: theme.surface, borderColor: theme.border }, enabled && { borderColor: accent + "40" }]}>
              <View style={[s.optionIconBox, { borderColor: theme.border, backgroundColor: theme.input }, enabled && { borderColor: accent + "30", backgroundColor: accent + "10" }]}>
                <AppIcon name={v.icon} size={22} color={enabled ? accent : theme.muted} />
              </View>
              <View style={s.optionInfo}>
                <Text style={[s.optionName, { color: theme.text }, enabled && { color: accent }]}>{v.name}</Text>
                <Text style={[s.optionDesc, { color: theme.muted }]}>{v.hint}</Text>
              </View>
              <Switch
                value={enabled}
                onValueChange={() => toggleVehicle(v.id)}
                trackColor={{ false: theme.border, true: accent + "60" }}
                thumbColor={enabled ? accent : theme.muted}
              />
            </View>
          );
        })}

        <View style={[s.divider, { backgroundColor: theme.border }]} />

        <TouchableOpacity
          style={[s.dangerBtn, { backgroundColor: theme.danger + "1a", borderColor: theme.danger + "30" }]}
          onPress={resetApp}
          activeOpacity={0.8}
        >
          <View style={s.dangerTitleRow}>
            <AppIcon name="trash" size={17} color={theme.danger} />
            <Text style={[s.dangerText, { color: theme.danger }]}>Uygulamayı Sıfırla</Text>
          </View>
          <Text style={[s.dangerDesc, { color: theme.danger + "b0" }]}>Tüm ayarlar ve favoriler silinir, kurulum başa döner</Text>
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
  // RENK BURADA YOK: zemin, metin ve kenarlık temadan inline geliyor.
  // Stile ikinci bir renk yazmak onu ölü koda çeviriyor — stil dizisinde
  // sağdaki eleman kazandığı için sabit renk temayı eziyordu.
  container: { flex: 1 },
  header: {
    paddingHorizontal: 24, paddingTop: 16, paddingBottom: 20,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 24, fontWeight: "800" },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 60 },
  loadingBox: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { fontSize: 16 },

  sectionTitle: { fontSize: 16, fontWeight: "800", marginBottom: 4 },
  sectionHint: { fontSize: 12, marginBottom: 14 },

  optionCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10,
  },
  optionIconBox: {
    width: 44, height: 44, borderRadius: 12,
    borderWidth: 1, alignItems: "center", justifyContent: "center",
  },
  optionInfo: { flex: 1 },
  optionName: { fontSize: 15, fontWeight: "700" },
  optionDesc: { fontSize: 12, marginTop: 2 },
  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, alignItems: "center", justifyContent: "center",
  },
  radioDot: { width: 10, height: 10, borderRadius: 5 },

  fareCard: {
    borderWidth: 1, borderRadius: 14, padding: 16, gap: 10,
  },
  fareRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  fareLabel: { fontSize: 13 },
  fareValue: { fontSize: 15, fontWeight: "800" },
  fareNote: { fontSize: 11, lineHeight: 16, marginTop: 4 },

  toggleCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10,
  },

  divider: { height: 1, marginVertical: 24 },

  dangerBtn: {
    borderWidth: 1, borderRadius: 14, padding: 16,
    alignItems: "center", marginBottom: 16,
  },
  dangerTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dangerText: { fontSize: 15, fontWeight: "700" },
  dangerDesc: { fontSize: 12, marginTop: 6, textAlign: "center" },

  aboutBox: {
    borderWidth: 1, borderRadius: 14, padding: 20, alignItems: "center", gap: 6,
  },
  aboutName: { fontSize: 18, fontWeight: "800" },
  aboutVersion: { fontSize: 12 },
  aboutLine: { fontSize: 13, textAlign: "center" },
  aboutTags: { flexDirection: "row", gap: 8, marginTop: 8 },
  aboutTag: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  aboutTagText: { fontSize: 12 },
});
