import React from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import AppIcon from "./AppIcon";
import { useTheme } from "../utils/ThemeContext";
import { getLegInstruction } from "../utils/routeInstructions";
import { formatDistance } from "../utils/geo";

export default function RoutePanel({ routes, selectedIdx, onSelect, loading, error, timeTip, origin, destination, onReset, bikeType }) {
  const { theme } = useTheme();

  if (loading) {
    return (
      <View style={s.stateBox}>
        <View style={s.loadingRow}>
          <ActivityIndicator color={theme.active} />
          <Text style={[s.statusText, { color: theme.text }]}>Rota aranıyor...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={s.stateBox}>
        <Text style={s.errorText}>{error}</Text>
        <TouchableOpacity style={[s.actionBtn, { backgroundColor: theme.input, borderColor: theme.border }]} onPress={onReset}>
          <View style={s.actionContent}>
            <AppIcon name="refresh" size={15} color={theme.muted} />
            <Text style={[s.actionText, { color: theme.muted }]}>Tekrar dene</Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  if (!routes?.length) {
    return (
      <View style={s.stateBox}>
        <Text style={[s.statusText, { color: theme.text }]}>
          {!origin
            ? "Başlangıç noktası yazın veya haritaya dokunun"
            : !destination
            ? "Varış noktasını girin"
            : ""}
        </Text>
        {timeTip ? (
          <Text style={[s.timeTip, { color: theme.active, backgroundColor: theme.active + "12", borderColor: theme.active + "30" }]}>
            {timeTip}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} nestedScrollEnabled>
      {timeTip ? (
        <Text style={[s.timeTipTop, { color: theme.active, backgroundColor: theme.active + "12" }]}>
          {timeTip}
        </Text>
      ) : null}

      {routes.map((r, i) => {
        const expanded = selectedIdx === i;
        const co2 = r.carbonGrams;
        const carbonColor = co2 < 100 ? "#4ade80" : co2 < 300 ? "#f97316" : "#f87171";
        const bikeLegs = r.legs.filter((l) => l.mode === "BICYCLE" || l.mode === "BICYCLE_RENTAL");

        return (
          <TouchableOpacity
            key={i}
            onPress={() => onSelect(expanded ? -1 : i)}
            activeOpacity={0.8}
            style={[
              s.card,
              { backgroundColor: theme.input, borderColor: expanded ? r.tagColor : theme.border },
            ]}
          >
            {/* ── Kart başlığı: etiket | süre+meta | ücret | chevron ── */}
            <View style={s.cardHeader}>
              <View style={[s.tagBadge, { backgroundColor: r.tagColor + "22", borderColor: r.tagColor + "55" }]}>
                <Text style={[s.tagText, { color: r.tagColor }]}>{r.tag}</Text>
              </View>

              <View style={s.cardMid}>
                <Text style={[s.cardDur, { color: theme.text }]}>
                  {Math.round(r.totalDuration / 60)} dk
                </Text>
                <Text style={[s.cardMeta, { color: theme.muted }]}>
                  {r.totalDistance} km · {r.walkDistance} km yürüyüş · {r.transfers} aktarma
                </Text>
              </View>

              <Text style={[s.cardCost, { color: r.cost === 0 ? "#4ade80" : "#f97316" }]}>
                {r.cost === 0 ? "Ücretsiz" : `${r.cost} ₺`}
              </Text>
              <AppIcon
                name={expanded ? "chevronUp" : "chevronDown"}
                size={11}
                color={expanded ? r.tagColor : theme.muted}
              />
            </View>

            {/* ── Mod şeridi: her bacak için küçük çip ── */}
            <View style={s.legStrip}>
              {r.legs.map((leg, j) => (
                <React.Fragment key={j}>
                  {j > 0 && <View style={[s.stripSep, { backgroundColor: theme.border }]} />}
                  <View style={[s.stripChip, { backgroundColor: leg.color + "18" }]}>
                    <AppIcon name={leg.icon} size={9} color={leg.color} />
                    {leg.routeName ? (
                      <Text style={[s.stripLabel, { color: leg.color }]}>{leg.routeName}</Text>
                    ) : null}
                  </View>
                </React.Fragment>
              ))}
            </View>

            {/* ── Açık içerik: özet + ipuçları + bacak listesi ── */}
            {expanded && (
              <View style={[s.expandedBox, { borderTopColor: theme.border }]}>
                {/* Özet grid */}
                <View style={s.summaryRow}>
                  {[
                    { l: "Süre",    v: `${Math.round(r.totalDuration / 60)} dk`, color: "#60a5fa" },
                    // Aktarma sayısı zaten kart başlığında; burada toplam mesafeye yer açıldı
                    { l: "Mesafe",  v: `${r.totalDistance} km`,                  color: "#a78bfa" },
                    { l: "Yürüyüş", v: `${r.walkDistance} km`,                   color: "#4ade80" },
                    { l: "Ücret",   v: r.cost === 0 ? "Ücretsiz" : `${r.cost} ₺`, color: "#f97316" },
                  ].map((c, k) => (
                    <View key={k} style={[s.summaryCard, { backgroundColor: theme.input, borderColor: theme.border }]}>
                      <Text style={[s.summaryValue, { color: c.color }]}>{c.v}</Text>
                      <Text style={[s.summaryLabel, { color: theme.muted }]}>{c.l}</Text>
                    </View>
                  ))}
                </View>

                {/* İpuçları */}
                {co2 > 0 && (
                  <Text style={[s.hint, { color: carbonColor, backgroundColor: carbonColor + "15", borderColor: carbonColor + "40" }]}>
                    🌿 ~{co2}g CO₂ · {co2 < 100 ? "Düşük" : co2 < 300 ? "Orta" : "Yüksek"} emisyon
                  </Text>
                )}
                {bikeType === "RENT" && bikeLegs.length > 0 && (
                  <Text style={[s.hint, { color: "#4ade80", backgroundColor: "#4ade8012", borderColor: "#4ade8030" }]}>
                    🚲 {bikeLegs[0].from} · bisiklet kirala → {bikeLegs[bikeLegs.length - 1].to} · bırak
                  </Text>
                )}
                {r.walkWarning && (
                  <Text style={[s.hint, { color: "#f97316", backgroundColor: "#f9731612", borderColor: "#f9731630" }]}>
                    ⚠ {r.walkWarning}
                  </Text>
                )}

                {/* Bacak listesi */}
                {r.legs.map((leg, j) => {
                  const instruction = getLegInstruction(leg);
                  return (
                    <View key={j} style={[s.legCard, { backgroundColor: theme.input, borderColor: theme.border }]}>
                      <View style={[s.legIconBox, { backgroundColor: leg.color + "20" }]}>
                        <AppIcon name={leg.icon} size={16} color={leg.color} />
                      </View>
                      <View style={s.legContent}>
                        <Text style={[s.legMode, { color: leg.color }]}>
                          {leg.label}{leg.routeName ? ` · ${leg.routeName}` : ""}
                        </Text>
                        <Text style={[s.legRoute, { color: theme.text }]} numberOfLines={2}>
                          {instruction.title}
                        </Text>
                        <Text style={[s.legHint, { color: theme.muted }]} numberOfLines={1}>
                          {instruction.detail}
                        </Text>
                      </View>
                      <View style={s.legMetrics}>
                        <Text style={[s.legDur, { color: theme.muted }]}>
                          {Math.max(1, Math.round(leg.duration / 60))} dk
                        </Text>
                        <Text style={[s.legDist, { color: theme.muted }]}>
                          {formatDistance(leg.distanceMeters)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  // Durum ekranları
  stateBox:    { gap: 8 },
  loadingRow:  { flexDirection: "row", alignItems: "center", gap: 8 },
  statusText:  { fontSize: 13, fontWeight: "600" },
  errorText:   { color: "#f87171", fontSize: 13, fontWeight: "600" },
  timeTip: {
    fontSize: 12, borderWidth: 1,
    borderRadius: 8, padding: 8, lineHeight: 16,
  },
  actionBtn: {
    borderWidth: 1, borderRadius: 9,
    paddingVertical: 8, alignItems: "center",
  },
  actionContent: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionText:    { fontSize: 12, fontWeight: "700" },

  // Ana scroll
  scroll:      { maxHeight: 260 },
  timeTipTop: {
    fontSize: 10, borderRadius: 7,
    padding: 6, marginBottom: 6, lineHeight: 14,
  },

  // Kart
  card: {
    borderWidth: 1, borderRadius: 10,
    marginBottom: 5, overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row", alignItems: "center",
    gap: 7, paddingHorizontal: 9, paddingVertical: 7,
  },
  tagBadge: {
    borderWidth: 1, borderRadius: 5,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  tagText:  { fontSize: 8, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.4 },
  cardMid:  { flex: 1 },
  cardDur:  { fontSize: 13, fontWeight: "800" },
  cardMeta: { fontSize: 9, fontWeight: "600", marginTop: 1 },
  cardCost: { fontSize: 11, fontWeight: "700", marginRight: 3 },

  // Mod şeridi
  legStrip: {
    flexDirection: "row", flexWrap: "wrap",
    alignItems: "center", gap: 3,
    paddingHorizontal: 9, paddingBottom: 7,
  },
  stripChip: {
    flexDirection: "row", alignItems: "center",
    gap: 3, borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  stripLabel: { fontSize: 8, fontWeight: "700" },
  stripSep:   { width: 8, height: 1 },

  // Açık içerik
  expandedBox: {
    borderTopWidth: 1,
    paddingHorizontal: 8, paddingTop: 7, paddingBottom: 8,
    gap: 4,
  },
  summaryRow:  { flexDirection: "row", gap: 4, marginBottom: 2 },
  summaryCard: {
    flex: 1, borderWidth: 1,
    borderRadius: 7, padding: 4, alignItems: "center",
  },
  summaryValue: { fontSize: 11, fontWeight: "800" },
  summaryLabel: {
    fontSize: 8, fontWeight: "700",
    textTransform: "uppercase", letterSpacing: 0.4, marginTop: 1,
  },
  hint: {
    fontSize: 10, fontWeight: "700",
    borderWidth: 1, borderRadius: 7,
    padding: 6, lineHeight: 15,
  },
  legCard: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1, borderRadius: 9,
    padding: 7, marginTop: 3,
  },
  legIconBox:  { width: 26, height: 26, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  legContent:  { flex: 1 },
  legMode:     { fontSize: 9, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  legRoute:    { fontSize: 11, fontWeight: "600" },
  legHint:     { fontSize: 10, fontWeight: "600", marginTop: 1 },
  legMetrics:  { alignItems: "flex-end" },
  legDur:      { fontSize: 11, fontWeight: "700" },
  legDist:     { fontSize: 9, fontWeight: "600", marginTop: 1 },
});
