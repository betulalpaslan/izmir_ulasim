// Ekranın üst paneli: profil sekmeleri, alt mod seçenekleri, adres alanları,
// kayıtlı adresler ve arama önerileri. Durum HomeScreen'de tutulur; burası yalnızca sunum.
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from "react-native";
import ProfileTabs from "./ProfileTabs";
import SearchBar from "./SearchBar";
import AppIcon from "./AppIcon";
import { useTheme } from "../utils/ThemeContext";

// Bisiklet profilinin iki modu. İkisi de AKTARMALIDIR: bisiklet burada
// yolculuğun kendisi değil, toplu taşımaya erişme aracıdır.
//
// Üçüncü bir seçenek ("Kendi Bisikletim" — baştan sona sürüş) vardı ve
// kaldırıldı. Ölçüldü: Narlıdere → Çiğli'de o mod tek bir kart üretiyordu,
// 137 dakikalık 33.5 km'lik kesintisiz sürüş. Doğru bir yanıttı ama kimsenin
// yapacağı bir yolculuk değildi; üstelik aktarmalı adayları listeden
// itiyordu. Baştan sona bisikletle gitmek isteyen kullanıcı için ayrı bir
// moda gerek yok.
// Etiketler web arayüzüyle BİREBİR aynı olmalı (izmir_ulasim/web/index.html,
// data-bike düğmeleri): aynı modun iki istemcide iki farklı adı olduğunda
// kullanıcı ikisini ayrı özellik sanıyor.
const BIKE_OPTIONS = [
  { key: "PARK", icon: "bike", label: "Kişisel Bisiklet" },
  { key: "RENT", icon: "bike", label: "BİSİM" },
];

export default function SearchPanel({
  profiles, profile, onSelectProfile,
  bikeType, onSelectBikeType,
  carMode, onToggleCarMode,
  originText, destText, onChangeText, onFocusField,
  onSwap, onLocateMe, hasUserLocation,
  suggestions, onSelectSuggestion,
  savedPlaces, savedPlacesOpen, onToggleSavedPlaces, onUsePlace, onSavePlace,
}) {
  const { theme } = useTheme();

  return (
    <View style={[s.panel, { backgroundColor: theme.surface }]}>
      <Text style={[s.appTitle, { color: theme.muted }]}>İZMİR ULAŞIM</Text>

      <ProfileTabs profiles={profiles} activeProfile={profile} onSelect={onSelectProfile} />

      {profile === "bicycle" && (
        <View style={s.subToggleRow}>
          {BIKE_OPTIONS.map(({ key, icon, label }) => {
            const active = bikeType === key;
            return (
              <TouchableOpacity
                key={String(key)}
                style={[s.subToggleBtn, { backgroundColor: theme.input, borderColor: theme.border }, active && s.subToggleActive]}
                onPress={() => !active && onSelectBikeType(key)}
                activeOpacity={0.8}
              >
                <View style={s.subToggleContent}>
                  <AppIcon name={icon} size={12} color={active ? "#4ade80" : theme.muted} />
                  <Text style={[s.subToggleText, { color: active ? "#4ade80" : theme.muted }]}>{label}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {profile === "car" && (
        <View style={s.subToggleRow}>
          {[
            { active: carMode !== "park_and_ride", icon: "car", label: "Direkt" },
            { active: carMode === "park_and_ride", icon: "bus", label: "Park+Taşı" },
          ].map(({ active, icon, label }) => (
            <TouchableOpacity
              key={label}
              style={[s.subToggleBtn, { backgroundColor: theme.input, borderColor: theme.border }, active && s.subToggleCarActive]}
              onPress={() => !active && onToggleCarMode()}
              activeOpacity={0.8}
            >
              <View style={s.subToggleContent}>
                <AppIcon name={icon} size={12} color={active ? "#f97316" : theme.muted} />
                <Text style={[s.subToggleText, { color: active ? "#f97316" : theme.muted }]}>{label}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={s.searchFields}>
        <SearchBar
          value={originText}
          onChangeText={(t) => onChangeText(t, "origin")}
          onFocus={() => onFocusField("origin")}
          placeholder="Nereden?"
          dotColor="#4ade80"
          rightIcon={hasUserLocation ? "locate" : null}
          onRightPress={onLocateMe}
        />
        <TouchableOpacity
          style={[s.swapBtn, { backgroundColor: theme.panel, borderColor: theme.border }]}
          onPress={onSwap}
          activeOpacity={0.8}
        >
          <Text style={[s.swapIcon, { color: theme.text }]}>⇄</Text>
        </TouchableOpacity>
        <SearchBar
          value={destText}
          onChangeText={(t) => onChangeText(t, "dest")}
          onFocus={() => onFocusField("dest")}
          placeholder="Nereye?"
          dotColor="#f87171"
        />
      </View>

      {suggestions.length === 0 ? (
        <>
          <TouchableOpacity style={s.savedDivider} onPress={onToggleSavedPlaces} activeOpacity={0.7}>
            <View style={[s.savedLine, { backgroundColor: theme.border }]} />
            <Text style={[s.savedTitle, { color: theme.muted }]}>Kayıtlı Adresler</Text>
            <AppIcon name={savedPlacesOpen ? "chevronUp" : "chevronDown"} size={10} color={theme.muted} />
            <View style={[s.savedLine, { backgroundColor: theme.border }]} />
          </TouchableOpacity>

          {savedPlacesOpen && (
            <View style={s.placesRow}>
              {savedPlaces.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[s.placeChip, { backgroundColor: theme.input, borderColor: theme.border }, p.address && s.placeChipFilled]}
                  onPress={() => { if (p.address) onUsePlace(p); }}
                  onLongPress={() => onSavePlace(p.id)}
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
      ) : (
        <FlatList
          data={suggestions}
          keyExtractor={(item) => item.place_id?.toString()}
          keyboardShouldPersistTaps="handled"
          style={[s.suggestList, { backgroundColor: theme.panel, borderColor: theme.border }]}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[s.suggestItem, { borderBottomColor: theme.border }]}
              onPress={() => onSelectSuggestion(item)}
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
  );
}

const s = StyleSheet.create({
  panel: {
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
  savedDivider: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, marginBottom: 2 },
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
  subToggleActive: { borderColor: "#4ade8060", backgroundColor: "#4ade8012" },
  subToggleCarActive: { borderColor: "#f9731660", backgroundColor: "#f9731612" },
  subToggleContent: { flexDirection: "row", alignItems: "center", gap: 4 },
  subToggleText: { fontSize: 11, fontWeight: "700" },
});
