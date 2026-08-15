import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import AppIcon from "./AppIcon";
import { useTheme } from "../utils/ThemeContext";
import { getLegInstruction } from "../utils/routeInstructions";
import { formatDistance, formatDuration } from "../utils/geo";

function arrivalClock(remainingSeconds) {
  const at = new Date(Date.now() + remainingSeconds * 1000);
  return at.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

export default function NavigationOverlay({
  progress,
  offRoute,
  waitingForFix,
  onRecalculate,
  onStop,
}) {
  const { theme } = useTheme();

  // Konum düzeltmesi gelene kadar rehberlik gösterilemez
  if (!progress) {
    return (
      <View style={[s.wrap, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[s.waiting, { color: theme.muted }]}>
          {waitingForFix ? "Konum alınıyor..." : "Navigasyon hazırlanıyor..."}
        </Text>
        <TouchableOpacity style={[s.stopBtn, { borderColor: theme.border }]} onPress={onStop}>
          <Text style={[s.stopText, { color: theme.danger }]}>Bitir</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (progress.arrived) {
    return (
      <View style={[s.wrap, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={s.arrivedRow}>
          <AppIcon name="check" size={22} color="#4ade80" />
          <Text style={[s.arrivedText, { color: theme.text }]}>Varış noktasına ulaştınız</Text>
        </View>
        <TouchableOpacity
          style={[s.stopBtn, s.stopBtnFilled, { backgroundColor: theme.active }]}
          onPress={onStop}
        >
          <Text style={s.stopTextFilled}>Navigasyonu kapat</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const leg = progress.currentLeg;
  const instruction = leg ? getLegInstruction(leg) : { title: "Rotayı izleyin", detail: "" };
  const legColor = leg?.color ?? theme.active;

  return (
    <View style={[s.wrap, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {offRoute && (
        <TouchableOpacity
          style={[s.offRoute, { borderColor: theme.danger + "60", backgroundColor: theme.danger + "14" }]}
          onPress={onRecalculate}
          activeOpacity={0.85}
        >
          <AppIcon name="refresh" size={15} color={theme.danger} />
          <Text style={[s.offRouteText, { color: theme.danger }]}>
            Rotadan {formatDistance(progress.distanceFromRoute)} uzaktasınız — yeniden hesapla
          </Text>
        </TouchableOpacity>
      )}

      {/* Şu anki adım */}
      <View style={s.stepRow}>
        <View style={[s.stepIcon, { borderColor: legColor, backgroundColor: legColor + "18" }]}>
          <AppIcon name={leg?.icon ?? "navigation"} size={22} color={legColor} />
        </View>
        <View style={s.stepTextBox}>
          <Text style={[s.stepTitle, { color: theme.text }]} numberOfLines={2}>
            {instruction.title}
          </Text>
          <Text style={[s.stepDetail, { color: theme.muted }]} numberOfLines={1}>
            {formatDistance(progress.distanceToLegEnd)} · {instruction.detail}
          </Text>
        </View>
      </View>

      {/* İlerleme çubuğu */}
      <View style={[s.progressTrack, { backgroundColor: theme.border }]}>
        <View
          style={[s.progressFill, { backgroundColor: legColor, width: `${progress.progressRatio * 100}%` }]}
        />
      </View>

      {/* Kalan süre / mesafe / varış saati */}
      <View style={s.footer}>
        <View style={s.metrics}>
          <Text style={[s.eta, { color: theme.text }]}>{formatDuration(progress.remainingSeconds)}</Text>
          <Text style={[s.metaText, { color: theme.muted }]}>
            {formatDistance(progress.remainingMeters)} · {arrivalClock(progress.remainingSeconds)}
          </Text>
        </View>

        {progress.nextLeg && (
          <View style={[s.nextChip, { backgroundColor: theme.input, borderColor: theme.border }]}>
            <Text style={[s.nextLabel, { color: theme.muted }]}>Sonra</Text>
            <AppIcon name={progress.nextLeg.icon ?? "walk"} size={13} color={progress.nextLeg.color ?? theme.muted} />
            <Text style={[s.nextText, { color: theme.text }]} numberOfLines={1}>
              {progress.nextLeg.routeName ?? progress.nextLeg.label}
            </Text>
          </View>
        )}

        <TouchableOpacity style={[s.stopBtn, { borderColor: theme.danger + "55" }]} onPress={onStop}>
          <Text style={[s.stopText, { color: theme.danger }]}>Bitir</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: "absolute", left: 12, right: 12, bottom: 12,
    borderRadius: 16, borderWidth: 1, padding: 14, gap: 10, zIndex: 20,
    shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { height: -3 },
    elevation: 12,
  },
  waiting: { fontSize: 13, fontWeight: "700", textAlign: "center" },
  arrivedRow: { flexDirection: "row", alignItems: "center", gap: 10, justifyContent: "center" },
  arrivedText: { fontSize: 15, fontWeight: "800" },
  offRoute: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8,
  },
  offRouteText: { flex: 1, fontSize: 12, fontWeight: "700" },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepIcon: {
    width: 46, height: 46, borderRadius: 23, borderWidth: 2,
    alignItems: "center", justifyContent: "center",
  },
  stepTextBox: { flex: 1 },
  stepTitle: { fontSize: 16, fontWeight: "800" },
  stepDetail: { fontSize: 12, fontWeight: "600", marginTop: 3 },
  progressTrack: { height: 4, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: 4, borderRadius: 2 },
  footer: { flexDirection: "row", alignItems: "center", gap: 10 },
  metrics: { minWidth: 90 },
  eta: { fontSize: 20, fontWeight: "900" },
  metaText: { fontSize: 11, fontWeight: "700", marginTop: 1 },
  nextChip: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 5,
    borderWidth: 1, borderRadius: 9, paddingHorizontal: 8, paddingVertical: 6,
  },
  nextLabel: { fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  nextText: { flex: 1, fontSize: 12, fontWeight: "700" },
  stopBtn: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 14, paddingVertical: 8 },
  stopBtnFilled: { borderWidth: 0, alignItems: "center" },
  stopText: { fontSize: 12, fontWeight: "800" },
  stopTextFilled: { fontSize: 13, fontWeight: "800", color: "#0f1117" },
});
