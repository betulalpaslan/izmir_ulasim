import { useState } from "react";
import {
  StyleSheet, View, Text, TouchableOpacity, SafeAreaView, StatusBar,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AppIcon from "../Components/AppIcon";
import { useTheme } from "../utils/ThemeContext";
import { BILET_TARIFESI, VARSAYILAN_BILET, ucretYazi } from "../utils/routeScoring";
import { tercihGovdesi, TERCIH_ANAHTARI } from "../utils/prefs";

const VEHICLES = [
  { id: "bicycle", icon: "bike", name: "Bisikletim var", desc: "Kendi bisikletinizi kullanabilirsiniz", accent: "accentBike" },
  { id: "car",     icon: "car", name: "Arabam var",     desc: "Park et + devam et seçeneği açılır",    accent: "accentCar" },
  { id: "none",    icon: "bus", name: "Sadece toplu taşıma", desc: "Yürü + otobüs / metro / tramvay", accent: "accentTransit" },
];

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

export default function OnboardingScreen({ navigation }) {
  const { theme } = useTheme();
  const [step, setStep] = useState(0);
  const [vehicles, setVehicles] = useState(new Set());
  const [passenger, setPassenger] = useState(VARSAYILAN_BILET);

  const toggleVehicle = (id) => {
    setVehicles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const finish = async () => {
    const prefs = tercihGovdesi({
      hasVehicle: { bicycle: vehicles.has("bicycle"), car: vehicles.has("car") },
      passengerType: passenger,
    });
    try {
      await AsyncStorage.setItem(TERCIH_ANAHTARI, JSON.stringify(prefs));
    } catch {
    }
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
        <View style={[s.dot, { backgroundColor: theme.border }, step === 0 && [s.dotActive, { backgroundColor: theme.active }]]} />
        <View style={[s.dot, { backgroundColor: theme.border }, step === 1 && [s.dotActive, { backgroundColor: theme.active }]]} />
      </View>

      <View style={s.body}>
        {step === 0 ? (
          <>
            <Text style={[s.title, { color: theme.text }]}>Nasıl ulaşıyorsunuz?</Text>
            <Text style={[s.subtitle, { color: theme.muted }]}>Birden fazla seçebilirsiniz</Text>
            {VEHICLES.map((v) => {
              const sel = vehicles.has(v.id);
              const accent = theme[v.accent];
              return (
                <TouchableOpacity key={v.id}
                  style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }, sel && { borderColor: accent, backgroundColor: accent + "12" }]}
                  onPress={() => toggleVehicle(v.id)}>
                  <View style={s.cardIconBox}>
                    <AppIcon name={v.icon} size={23} color={sel ? accent : theme.muted} />
                  </View>
                  <View style={s.cardText}>
                    <Text style={[s.cardName, { color: theme.text }, sel && { color: accent }]}>{v.name}</Text>
                    <Text style={[s.cardDesc, { color: theme.muted }]}>{v.desc}</Text>
                  </View>
                  <View style={[s.check, { borderColor: theme.border }, sel && { borderColor: accent, backgroundColor: accent }]}>
                    {sel && <AppIcon name="check" size={13} color="#fff" strokeWidth={3} />}
                  </View>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={[s.btn, { backgroundColor: theme.active }]} onPress={() => setStep(1)}>
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
                  style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }, sel && { borderColor: theme.active, backgroundColor: theme.active + "12" }]}
                  onPress={() => setPassenger(p.id)}>
                  <View style={s.cardIconBox}>
                    <AppIcon name={p.icon} size={23} color={sel ? theme.active : theme.muted} />
                  </View>
                  <View style={s.cardText}>
                    <Text style={[s.cardName, { color: theme.text }, sel && { color: theme.active }]}>{p.name}</Text>
                    <Text style={[s.cardDesc, { color: theme.muted }]} numberOfLines={2}>
                      {p.desc} — <Text style={{ color: theme.text }}>{p.fare}</Text>
                    </Text>
                  </View>
                  <View style={[s.check, { borderColor: theme.border }, sel && { borderColor: theme.active, backgroundColor: theme.active }]}>
                    {sel && <AppIcon name="check" size={13} color="#fff" strokeWidth={3} />}
                  </View>
                </TouchableOpacity>
              );
            })}
            <View style={s.navRow}>
              <TouchableOpacity style={[s.backBtn, { borderColor: theme.border }]} onPress={() => setStep(0)}>
                <Text style={[s.backText, { color: theme.muted }]}>Geri</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { flex: 1, backgroundColor: theme.accentBike }]} onPress={finish}>
                <Text style={s.btnText}>Başlayalım →</Text>
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
  container: { flex: 1 },
  header: {
    flexDirection: "row", justifyContent: "space-between",
    paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8,
  },
  headerTitle: { fontSize: 12, fontWeight: "700", letterSpacing: 2 },
  headerStep: { fontSize: 12, fontWeight: "600" },
  dots: { flexDirection: "row", gap: 6, paddingHorizontal: 24, paddingVertical: 12 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { width: 24, borderRadius: 4 },
  body: { flex: 1, paddingHorizontal: 24 },
  title: { fontSize: 22, fontWeight: "800", marginBottom: 6 },
  subtitle: { fontSize: 14, marginBottom: 20 },
  card: {
    flexDirection: "row", alignItems: "center", gap: 14,
    borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 10,
  },
  cardIconBox: {
    width: 28, height: 28,
    alignItems: "center", justifyContent: "center",
  },
  cardText: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: "700" },
  cardDesc: { fontSize: 12, marginTop: 2 },
  check: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5, alignItems: "center", justifyContent: "center",
  },
  btn: { paddingVertical: 16, borderRadius: 12, alignItems: "center", marginTop: 20 },

  btnText: { fontSize: 15, fontWeight: "800", color: "#ffffff", letterSpacing: 0.5 },
  navRow: { flexDirection: "row", gap: 10, marginTop: 20 },
  backBtn: {
    paddingVertical: 16, paddingHorizontal: 24, borderRadius: 12,
    borderWidth: 1, justifyContent: "center",
  },
  backText: { fontSize: 14, fontWeight: "700" },
  skip: { paddingVertical: 16, alignItems: "center" },
  skipText: { fontSize: 13, textDecorationLine: "underline" },
});
