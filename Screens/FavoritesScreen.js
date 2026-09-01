import { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert, SafeAreaView, StatusBar,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import AppIcon from "../Components/AppIcon";
import { useTheme } from "../utils/ThemeContext";

const SAVED_PLACES_DEFAULT = [
  { id: "home",   icon: "home", label: "Ev",          address: null },
  { id: "school", icon: "student", label: "Okul",        address: null },
  { id: "work",   icon: "work", label: "İş",          address: null },
  { id: "shop",   icon: "shop", label: "Alışveriş",   address: null },
];

const MODE_LABELS = {
  bicycle: "Bisiklet",
  car:     "Araba",
  transit: "Toplu taşıma",
};

export default function FavoritesScreen() {
  const { theme } = useTheme();
  const [savedPlaces, setSavedPlaces] = useState(SAVED_PLACES_DEFAULT);
  const [recentRoutes, setRecentRoutes] = useState([]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      const placesRaw = await AsyncStorage.getItem("savedPlaces");
      if (placesRaw) setSavedPlaces(JSON.parse(placesRaw));
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
          const updated = savedPlaces.map((p) =>
            p.id === placeId ? { ...p, address: null } : p
          );
          setSavedPlaces(updated);
          await AsyncStorage.setItem("savedPlaces", JSON.stringify(updated));
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
          <View style={s.badge}>
            <Text style={s.badgeText}>{savedCount}</Text>
          </View>
        )}
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

        <Text style={[s.sectionTitle, { color: theme.text }]}>Kayıtlı Yerler</Text>
        <Text style={[s.sectionHint, { color: theme.muted }]}>
          Harita ekranında arama yaparken bir yeri bulup uzun basarak kaydedin
        </Text>

        {savedPlaces.map((place) => (
          <View key={place.id} style={[s.placeCard, { backgroundColor: theme.surface, borderColor: theme.border }, place.address && s.placeCardFilled]}>
            <View style={[s.placeIconBox, { backgroundColor: theme.input, borderColor: theme.border }, place.address && s.placeIconBoxFilled]}>
              <AppIcon name={place.icon} size={22} color={place.address ? "#22c55e" : theme.muted} />
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
              <TouchableOpacity style={s.clearBtn} onPress={() => clearPlace(place.id)}>
                <AppIcon name="x" size={14} color="#f87171" strokeWidth={2.6} />
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
            <TouchableOpacity onPress={clearHistory} style={s.clearHistoryBtn}>
              <Text style={s.clearHistoryText}>Temizle</Text>
            </TouchableOpacity>
          )}
        </View>

        {recentRoutes.length > 0 ? (
          recentRoutes.map((r, i) => (
            <View key={i} style={[s.historyCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={s.historyLine}>
                <View style={s.historyDotGreen} />
                <Text style={[s.historyPlace, { color: theme.text }]} numberOfLines={1}>{r.originName}</Text>
              </View>
              <View style={[s.historyConnector, { backgroundColor: theme.border }]} />
              <View style={s.historyLine}>
                <View style={s.historyDotRed} />
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
  container: { flex: 1, backgroundColor: "#14111f" },
  header: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 24, paddingTop: 16, paddingBottom: 20,
    borderBottomWidth: 1, borderBottomColor: "#322a4a",
  },
  headerTitle: { color: "#ece9f7", fontSize: 24, fontWeight: "800" },
  badge: {
    backgroundColor: "#8b5cf620", borderWidth: 1, borderColor: "#8b5cf650",
    borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2,
  },
  badgeText: { color: "#8b5cf6", fontSize: 12, fontWeight: "800" },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 50 },
  sectionHeaderRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
    marginTop: 28, marginBottom: 0,
  },
  sectionTitle: { color: "#ece9f7", fontSize: 16, fontWeight: "800", marginBottom: 4 },
  sectionHint: { color: "#9b93b8", fontSize: 12, marginBottom: 14 },
  clearHistoryBtn: {
    paddingVertical: 4, paddingHorizontal: 10,
    backgroundColor: "#f871711a", borderWidth: 1, borderColor: "#f8717140",
    borderRadius: 8, marginTop: 2,
  },
  clearHistoryText: { color: "#f87171", fontSize: 12, fontWeight: "700" },

  placeCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "#1e1a2e", borderWidth: 1, borderColor: "#322a4a",
    borderRadius: 14, padding: 14, marginBottom: 10,
  },
  placeCardFilled: { borderColor: "#322a4a" },
  placeIconBox: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: "#14111f", borderWidth: 1, borderColor: "#322a4a",
    alignItems: "center", justifyContent: "center",
  },
  placeIconBoxFilled: { borderColor: "#22c55e30", backgroundColor: "#22c55e08" },
  placeInfo: { flex: 1 },
  placeLabel: { color: "#ece9f7", fontSize: 15, fontWeight: "700" },
  placeAddr: { color: "#9b93b8", fontSize: 12, marginTop: 2 },
  placeEmpty: { color: "#4a4166", fontSize: 12, marginTop: 2, fontStyle: "italic" },
  clearBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "#f8717115", borderWidth: 1, borderColor: "#f8717130",
    alignItems: "center", justifyContent: "center",
  },
  emptyDot: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1, borderColor: "#322a4a", borderStyle: "dashed",
  },

  historyCard: {
    backgroundColor: "#1e1a2e", borderWidth: 1, borderColor: "#322a4a",
    borderRadius: 14, padding: 14, marginBottom: 10,
  },
  historyLine: { flexDirection: "row", alignItems: "center", gap: 10 },
  historyDotGreen: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#22c55e" },
  historyDotRed: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#f87171" },
  historyConnector: { width: 1, height: 10, backgroundColor: "#322a4a", marginLeft: 3.5, marginVertical: 3 },
  historyPlace: { color: "#ece9f7", fontSize: 13, fontWeight: "600", flex: 1 },
  historyMeta: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#322a4a" },
  historyMetaText: { color: "#9b93b8", fontSize: 11 },

  emptyHistory: { alignItems: "center", paddingVertical: 40, gap: 10 },
  emptyIconBox: {
    width: 58, height: 58, borderRadius: 18,
    backgroundColor: "#1e1a2e", borderWidth: 1, borderColor: "#322a4a",
    alignItems: "center", justifyContent: "center",
  },
  emptyTitle: { color: "#9b93b8", fontSize: 16, fontWeight: "700" },
  emptySubtext: { color: "#4a4166", fontSize: 13, textAlign: "center", lineHeight: 20 },
});
