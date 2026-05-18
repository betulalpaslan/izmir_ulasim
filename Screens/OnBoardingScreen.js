import { useState } from "react";
import {
  StyleSheet, View, Text, TouchableOpacity, SafeAreaView, StatusBar,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AppIcon from "../Components/AppIcon";
import { useTheme } from "../utils/ThemeContext";

const T = {
  bg: "#0f1117", surface: "#181c25", border: "#2a2f3d",
  text: "#e8eaf0", muted: "#7a8299",
  bike: "#4ade80", car: "#f97316", transit: "#60a5fa",
};

const VEHICLES = [
  { id: "bicycle", icon: "bike", name: "Bisikletim var", desc: "Kendi bisikletinizi kullanabilirsiniz", accent: "#4ade80" },
  { id: "car",     icon: "car", name: "Arabam var",     desc: "Park et + devam et seçeneği açılır",    accent: "#f97316" },
  { id: "none",    icon: "bus", name: "Sadece toplu taşıma", desc: "Yürü + otobüs / metro / tramvay", accent: "#60a5fa" },
];

const PASSENGERS = [
  { id: "student", icon: "student", name: "Öğrenci",       desc: "İndirimli ücret", multiplier: 0.7, fare: "17.50 ₺" },
  { id: "adult",   icon: "user", name: "Yetişkin (tam)", desc: "Standart ücret",  multiplier: 1.0, fare: "25.00 ₺" },
  { id: "senior",  icon: "userCog", name: "65 yaş üstü",   desc: "Ücretsiz / indirimli", multiplier: 0.0, fare: "Ücretsiz" },
];

export default function OnboardingScreen({ navigation }) {
  const { theme } = useTheme();
  const [step, setStep] = useState(0);
  const [vehicles, setVehicles] = useState(new Set());
  const [passenger, setPassenger] = useState("adult");

  const toggleVehicle = (id) => {
    setVehicles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const finish = async () => {
    const info = PASSENGERS.find((p) => p.id === passenger);
    const profiles = ["transit"];
    if (vehicles.has("bicycle")) profiles.unshift("bicycle");
    if (vehicles.has("car")) profiles.splice(1, 0, "car");

    const prefs = {
      hasVehicle: { bicycle: vehicles.has("bicycle"), car: vehicles.has("car") },
      passengerType: passenger,
      fareMultiplier: info.multiplier,
      visibleProfiles: profiles,
      onboardingDone: true,
    };
    await AsyncStorage.setItem("userPrefs", JSON.stringify(prefs));
    navigation.replace("Main");
  };

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />
      <View style={s.header}>
        <Text style={[s.headerTitle, { color: theme.muted }]}>İZMİR ULAŞIM</Text>
        <Text style={[s.headerStep, { color: theme.muted }]}>{step + 1} / 2</Text>
      </View>

      <View style={s.dots}>
        <View style={[s.dot, { backgroundColor: theme.border }, step === 0 && s.dotActive]} />
        <View style={[s.dot, { backgroundColor: theme.border }, step === 1 && s.dotActive]} />
      </View>

      <View style={s.body}>
        {step === 0 ? (
          <>
            <Text style={[s.title, { color: theme.text }]}>Nasıl ulaşıyorsunuz?</Text>
            <Text style={[s.subtitle, { color: theme.muted }]}>Birden fazla seçebilirsiniz</Text>
            {VEHICLES.map((v) => {
              const sel = vehicles.has(v.id);
              return (
                <TouchableOpacity key={v.id}
                  style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }, sel && { borderColor: v.accent, backgroundColor: v.accent + "12" }]}
                  onPress={() => toggleVehicle(v.id)}>
                  <View style={s.cardIconBox}>
                    <AppIcon name={v.icon} size={23} color={sel ? v.accent : theme.muted} />
                  </View>
                  <View style={s.cardText}>
                    <Text style={[s.cardName, { color: theme.text }, sel && { color: v.accent }]}>{v.name}</Text>
                    <Text style={[s.cardDesc, { color: theme.muted }]}>{v.desc}</Text>
                  </View>
                  <View style={[s.check, { borderColor: theme.border }, sel && { borderColor: v.accent, backgroundColor: v.accent }]}>
                    {sel && <AppIcon name="check" size={13} color="#fff" strokeWidth={3} />}
                  </View>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={[s.btn, { backgroundColor: T.transit }]} onPress={() => setStep(1)}>
              <Text style={s.btnText}>Devam</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={[s.title, { color: theme.text }]}>Yolcu tipi</Text>
            <Text style={[s.subtitle, { color: theme.muted }]}>Ücret hesaplaması için</Text>
            {PASSENGERS.map((p) => {
              const sel = passenger === p.id;
              return (
                <TouchableOpacity key={p.id}
                  style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }, sel && { borderColor: T.transit, backgroundColor: T.transit + "12" }]}
                  onPress={() => setPassenger(p.id)}>
                  <View style={s.cardIconBox}>
                    <AppIcon name={p.icon} size={23} color={sel ? T.transit : theme.muted} />
                  </View>
                  <View style={s.cardText}>
                    <Text style={[s.cardName, { color: theme.text }, sel && { color: T.transit }]}>{p.name}</Text>
                    <Text style={[s.cardDesc, { color: theme.muted }]}>{p.desc} — {p.fare}</Text>
                  </View>
                  <View style={[s.check, { borderColor: theme.border }, sel && { borderColor: T.transit, backgroundColor: T.transit }]}>
                    {sel && <AppIcon name="check" size={13} color="#fff" strokeWidth={3} />}
                  </View>
                </TouchableOpacity>
              );
            })}
            <View style={s.navRow}>
              <TouchableOpacity style={[s.backBtn, { borderColor: theme.border }]} onPress={() => setStep(0)}>
                <Text style={[s.backText, { color: theme.muted }]}>Geri</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: T.bike }]} onPress={finish}>
                <Text style={[s.btnText, { color: "#0a1a0e" }]}>Başlayalım →</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      <TouchableOpacity style={s.skip} onPress={finish}>
        <Text style={[s.skipText, { color: theme.muted }]}>Atla, varsayılan ayarlarla devam et</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  header: {
    flexDirection: "row", justifyContent: "space-between",
    paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8,
  },
  headerTitle: { color: T.muted, fontSize: 12, fontWeight: "700", letterSpacing: 2 },
  headerStep: { color: T.muted, fontSize: 12, fontWeight: "600" },
  dots: { flexDirection: "row", gap: 6, paddingHorizontal: 24, paddingVertical: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: T.border },
  dotActive: { width: 24, borderRadius: 4, backgroundColor: T.transit },
  body: { flex: 1, paddingHorizontal: 24 },
  title: { fontSize: 22, fontWeight: "800", color: T.text, marginBottom: 6 },
  subtitle: { fontSize: 14, color: T.muted, marginBottom: 20 },
  card: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: T.surface, borderWidth: 1, borderColor: T.border,
    borderRadius: 14, padding: 16, marginBottom: 10,
  },
  cardIconBox: {
    width: 28, height: 28,
    alignItems: "center", justifyContent: "center",
  },
  cardText: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: "700", color: T.text },
  cardDesc: { fontSize: 12, color: T.muted, marginTop: 2 },
  check: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5, borderColor: T.border,
    alignItems: "center", justifyContent: "center",
  },
  btn: { paddingVertical: 16, borderRadius: 12, alignItems: "center", marginTop: 20 },
  btnText: { fontSize: 15, fontWeight: "800", color: "#0a1020", letterSpacing: 0.5 },
  navRow: { flexDirection: "row", gap: 10, marginTop: 20 },
  backBtn: {
    paddingVertical: 16, paddingHorizontal: 24, borderRadius: 12,
    borderWidth: 1, borderColor: T.border, justifyContent: "center",
  },
  backText: { color: T.muted, fontSize: 14, fontWeight: "700" },
  skip: { paddingVertical: 16, alignItems: "center" },
  skipText: { color: T.muted, fontSize: 13, textDecorationLine: "underline" },
});
