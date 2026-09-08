import { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert, SafeAreaView, StatusBar,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import AppIcon from "../Components/AppIcon";
import { useTheme } from "../utils/ThemeContext";
import {
  KAYITLI_YERLER_VARSAYILAN, kayitliYerleriOku, kayitliYerleriYaz, yeriAyarla,
} from "../utils/savedPlaces";

// Kartın kimliği içeriğinden geliyor, sıradan değil: liste sıralanabilir
// hale geldiğinde `key={i}` açık kartı yanlış rotanın üstünde bırakırdı.
function gecmisAnahtari(r, i) {
  return [r.originName, r.destName, r.mode, r.date].filter(Boolean).join("|") || String(i);
}

const MODE_LABELS = {
  bicycle: "Bisiklet",
  car:     "Araba",
  transit: "Toplu taşıma",
};

export default function FavoritesScreen() {
  const { theme } = useTheme();
  const [savedPlaces, setSavedPlaces] = useState(KAYITLI_YERLER_VARSAYILAN);
  const [recentRoutes, setRecentRoutes] = useState([]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    setSavedPlaces(await kayitliYerleriOku());
    try {
      const historyRaw = await AsyncStorage.getItem("routeHistory");
      if (historyRaw) setRecentRoutes(JSON.parse(historyRaw).slice(0, 8));
    } catch {}
  };

  const clearPlace = (placeId) => {
    Alert.alert("Yeri Sil", "Bu kayıtlı yer silinsin mi?", [
      { text: "İptal", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          const updated = yeriAyarla(savedPlaces, placeId, null);
          if (!(await kayitliYerleriYaz(updated))) {
            Alert.alert("Silinemedi", "Değişiklik cihaza yazılamadı.");
            return;
          }
          setSavedPlaces(updated);
        },
      },
    ]);
  };

  const clearHistory = () => {
    Alert.alert("Geçmişi Temizle", "Tüm rota geçmişi silinecek.", [
      { text: "İptal", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.removeItem("routeHistory");
          setRecentRoutes([]);
        },
      },
    ]);
  };

  const savedCount = savedPlaces.filter((p) => p.address).length;

  return (
    <SafeAreaView style={[s.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />
      <View style={[s.header, { borderBottomColor: theme.border }]}>
        <Text style={[s.headerTitle, { color: theme.text }]}>Favorilerim</Text>
        {savedCount > 0 && (
          <View style={[s.badge, { backgroundColor: theme.active + "20", borderColor: theme.active + "50" }]}>
            <Text style={[s.badgeText, { color: theme.active }]}>{savedCount}</Text>
          </View>
        )}
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

        <Text style={[s.sectionTitle, { color: theme.text }]}>Kayıtlı Yerler</Text>
        <Text style={[s.sectionHint, { color: theme.muted }]}>
          Harita ekranında arama yaparken bir yeri bulup uzun basarak kaydedin
        </Text>

        {savedPlaces.map((place) => (
          <View key={place.id} style={[s.placeCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[s.placeIconBox, { backgroundColor: theme.input, borderColor: theme.border }, place.address && { borderColor: theme.accentBike + "30", backgroundColor: theme.accentBike + "08" }]}>
              <AppIcon name={place.icon} size={22} color={place.address ? theme.accentBike : theme.muted} />
            </View>
            <View style={s.placeInfo}>
              <Text style={[s.placeLabel, { color: theme.text }]}>{place.label}</Text>
              {place.address ? (
                <Text style={[s.placeAddr, { color: theme.muted }]} numberOfLines={2}>{place.address.name}</Text>
              ) : (
                <Text style={[s.placeEmpty, { color: theme.subtle }]}>Henüz kaydedilmedi</Text>
              )}
            </View>
            {place.address ? (
              <TouchableOpacity
                style={[s.clearBtn, { backgroundColor: theme.danger + "15", borderColor: theme.danger + "30" }]}
                onPress={() => clearPlace(place.id)}
              >
                <AppIcon name="x" size={14} color={theme.danger} strokeWidth={2.6} />
              </TouchableOpacity>
            ) : (
              <View style={[s.emptyDot, { borderColor: theme.border }]} />
            )}
          </View>
        ))}

        <View style={s.sectionHeaderRow}>
          <View>
            <Text style={[s.sectionTitle, { color: theme.text }]}>Son Rotalar</Text>
            <Text style={[s.sectionHint, { color: theme.muted }]}>En son aradığınız güzergahlar</Text>
          </View>
          {recentRoutes.length > 0 && (
            <TouchableOpacity
              onPress={clearHistory}
              style={[s.clearHistoryBtn, { backgroundColor: theme.danger + "1a", borderColor: theme.danger + "40" }]}
            >
              <Text style={[s.clearHistoryText, { color: theme.danger }]}>Temizle</Text>
            </TouchableOpacity>
          )}
        </View>

        {recentRoutes.length > 0 ? (
          recentRoutes.map((r, i) => (
            <View key={gecmisAnahtari(r, i)} style={[s.historyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={s.historyLine}>
                <View style={[s.historyDot, { backgroundColor: theme.accentBike }]} />
                <Text style={[s.historyPlace, { color: theme.text }]} numberOfLines={1}>{r.originName}</Text>
              </View>
              <View style={[s.historyConnector, { backgroundColor: theme.border }]} />
              <View style={s.historyLine}>
                <View style={[s.historyDot, { backgroundColor: theme.danger }]} />
                <Text style={[s.historyPlace, { color: theme.text }]} numberOfLines={1}>{r.destName}</Text>
              </View>
              <View style={[s.historyMeta, { borderTopColor: theme.border }]}>
                <Text style={[s.historyMetaText, { color: theme.muted }]}>
                  {r.duration} dk · {MODE_LABELS[r.mode] || r.mode} · {r.date}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <View style={s.emptyHistory}>
            <View style={[s.emptyIconBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <AppIcon name="map" size={38} color={theme.subtle} />
            </View>
            <Text style={[s.emptyTitle, { color: theme.muted }]}>Henüz rota geçmişi yok</Text>
            <Text style={[s.emptySubtext, { color: theme.subtle }]}>
              Harita ekranından rota aradığınızda burada görünecek
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({

  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 24, paddingTop: 16, paddingBottom: 20,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 24, fontWeight: "800" },
  badge: {
    borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  badgeText: { fontSize: 12, fontWeight: "800" },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 50 },
  sectionHeaderRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
    marginTop: 28, marginBottom: 0,
  },
  sectionTitle: { fontSize: 16, fontWeight: "800", marginBottom: 4 },
  sectionHint: { fontSize: 12, marginBottom: 14 },
  clearHistoryBtn: {
    paddingVertical: 4, paddingHorizontal: 10,
    borderWidth: 1, borderRadius: 8, marginTop: 2,
  },
  clearHistoryText: { fontSize: 12, fontWeight: "700" },

  placeCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10,
  },
  placeIconBox: {
    width: 44, height: 44, borderRadius: 12,
    borderWidth: 1, alignItems: "center", justifyContent: "center",
  },
  placeInfo: { flex: 1 },
  placeLabel: { fontSize: 15, fontWeight: "700" },
  placeAddr: { fontSize: 12, marginTop: 2 },
  placeEmpty: { fontSize: 12, marginTop: 2, fontStyle: "italic" },
  clearBtn: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1, alignItems: "center", justifyContent: "center",
  },
  emptyDot: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1, borderStyle: "dashed",
  },

  historyCard: {
    borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10,
  },
  historyLine: { flexDirection: "row", alignItems: "center", gap: 10 },
  historyDot: { width: 8, height: 8, borderRadius: 4 },
  historyConnector: { width: 1, height: 10, marginLeft: 3.5, marginVertical: 3 },
  historyPlace: { fontSize: 13, fontWeight: "600", flex: 1 },
  historyMeta: { marginTop: 8, paddingTop: 8, borderTopWidth: 1 },
  historyMetaText: { fontSize: 11 },

  emptyHistory: { alignItems: "center", paddingVertical: 40, gap: 10 },
  emptyIconBox: {
    width: 58, height: 58, borderRadius: 18,
    borderWidth: 1, alignItems: "center", justifyContent: "center",
  },
  emptyTitle: { fontSize: 16, fontWeight: "700" },
  emptySubtext: { fontSize: 13, textAlign: "center", lineHeight: 20 },
});
