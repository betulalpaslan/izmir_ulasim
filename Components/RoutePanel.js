import React from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import AppIcon from "./AppIcon";
import { useTheme } from "../utils/ThemeContext";
import { getLegInstruction } from "../utils/routeInstructions";
import { NON_TRANSIT_MODES, ucretYazi } from "../utils/routeScoring";
import { formatDistance } from "../utils/geo";

export default function RoutePanel({ routes, selectedIdx, onSelect, loading, error, notice, timeTip, origin, destination, onReset, bikeType, modBos, onAlternative }) {
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
    // Seçilen mod bu yolculukta işini göremiyorsa "Tekrar dene" işe yaramaz —
    // aynı arama aynı sonucu verir. Ölçülmüş bir alternatif varsa çıkış olarak
    // sunulur. Mod kartı DEĞİLDİR ve öyle görünmemeli: kullanıcı bunu seçerek
    // moddan çıktığını bilmeli, yoksa vaat sessizce bozulmuş olur.
    const alternatifDk =
      modBos?.alternatifSn != null ? Math.round(modBos.alternatifSn / 60) : null;
    return (
      <View style={s.stateBox}>
        <Text style={s.errorText}>{error}</Text>
        {alternatifDk != null && onAlternative && (
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: theme.input, borderColor: "#8b5cf6" }]}
            onPress={onAlternative}
          >
            <View style={s.actionContent}>
              <AppIcon name="bus" size={15} color="#8b5cf6" />
              <Text style={[s.actionText, { color: "#8b5cf6" }]}>
                Toplu taşıma: {alternatifDk} dk
              </Text>
            </View>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[s.actionBtn, { backgroundColor: theme.input, borderColor: theme.border }]} onPress={onReset}>
          <View style={s.actionContent}>
            <AppIcon name="refresh" size={15} color={theme.muted} />
            <Text style={[s.actionText, { color: theme.muted }]}>Tekrar dene</Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  // Sonuç geçerli ama seçilen moddan farklı bir şey gösteriliyorsa sebebini
  // söyle. Sessizce transit rotası göstermek kullanıcıyı yanıltır.
  const bilgiSeridi = notice ? (
    <View style={[s.noticeBox, { borderColor: theme.border }]}>
      <AppIcon name="info" size={14} color={theme.muted} />
      <Text style={[s.noticeText, { color: theme.muted }]}>{notice}</Text>
    </View>
  ) : null;

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
      {bilgiSeridi}
      {timeTip ? (
        <Text style={[s.timeTipTop, { color: theme.active, backgroundColor: theme.active + "12" }]}>
          {timeTip}
        </Text>
      ) : null}

      {routes.map((r, i) => {
        const expanded = selectedIdx === i;
        const co2 = r.carbonGrams;
        const carbonColor = co2 < 100 ? "#22c55e" : co2 < 300 ? "#f97316" : "#f87171";
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
              {/* Bir güzergâh birden çok üstünlüğe sahip olabilir (aynı anda
                  hem önerilen hem en hızlı gibi). İkincil etiketler daha
                  soluk rozetlerde alt alta durur; eskiden bu bilgi hiç
                  gösterilmiyordu. */}
              <View style={s.tagSutun}>
                <View style={[s.tagBadge, { backgroundColor: r.tagColor + "22", borderColor: r.tagColor + "55" }]}>
                  <Text style={[s.tagText, { color: r.tagColor }]}>{r.tag}</Text>
                </View>
                {(r.etiketler || []).filter((e) => e !== r.tag).map((e) => (
                  <View key={e} style={[s.tagBadge, { borderColor: theme.border }]}>
                    <Text style={[s.tagText, { color: theme.muted }]}>{e}</Text>
                  </View>
                ))}
              </View>

              <View style={s.cardMid}>
                <Text style={[s.cardDur, { color: theme.text }]}>
                  {Math.round(r.totalDuration / 60)} dk
                </Text>
                <Text style={[s.cardMeta, { color: theme.muted }]}>
                  {r.totalDistance} km · {r.walkDistance} km yürüyüş · {r.transfers} aktarma
                </Text>
              </View>

              <Text style={[s.cardCost, { color: r.cost === 0 ? "#22c55e" : "#f97316" }]}>
                {r.cost === 0 ? "Ücretsiz" : `${ucretYazi(r.cost)} ₺`}
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
                    { l: "Süre",    v: `${Math.round(r.totalDuration / 60)} dk`, color: "#8b5cf6" },
                    // Aktarma sayısı zaten kart başlığında; burada toplam mesafeye yer açıldı
                    { l: "Mesafe",  v: `${r.totalDistance} km`,                  color: "#a78bfa" },
                    { l: "Yürüyüş", v: `${r.walkDistance} km`,                   color: "#22c55e" },
                    { l: "Ücret",   v: r.cost === 0 ? "Ücretsiz" : `${ucretYazi(r.cost)} ₺`, color: "#f97316" },
                  ].map((c, k) => (
                    <View key={k} style={[s.summaryCard, { backgroundColor: theme.input, borderColor: theme.border }]}>
                      <Text style={[s.summaryValue, { color: c.color }]}>{c.v}</Text>
                      <Text style={[s.summaryLabel, { color: theme.muted }]}>{c.l}</Text>
                    </View>
                  ))}
                </View>

                {/* ÜCRET DÖKÜMÜ — yalnız iki kalem varsa.
                    BİSİM kiralaması bilete dahil değil; tek bir toplam
                    rakam "neden bu kadar" sorusunu cevaplamıyordu.
                    Provizyon ayrı satır: tahsilat değil, bloke. */}
                {r.ucretDetay?.bisim > 0 && (
                  <View style={[s.ucretKutu, { backgroundColor: theme.input, borderColor: theme.border }]}>
                    <View style={s.ucretSatir}>
                      <Text style={[s.ucretEtiket, { color: theme.muted }]}>Toplu taşıma bileti</Text>
                      <Text style={[s.ucretDeger, { color: theme.text }]}>{ucretYazi(r.ucretDetay.bilet)} ₺</Text>
                    </View>
                    <View style={s.ucretSatir}>
                      <Text style={[s.ucretEtiket, { color: theme.muted }]}>
                        BİSİM · {r.ucretDetay.bisimDakika} dk
                      </Text>
                      <Text style={[s.ucretDeger, { color: theme.text }]}>{ucretYazi(r.ucretDetay.bisim)} ₺</Text>
                    </View>
                    <View style={[s.ucretSatir, s.ucretToplam, { borderTopColor: theme.border }]}>
                      <Text style={[s.ucretEtiket, { color: theme.text, fontWeight: "800" }]}>Toplam</Text>
                      <Text style={[s.ucretDeger, { color: "#f97316", fontSize: 15 }]}>{ucretYazi(r.cost)} ₺</Text>
                    </View>
                    <Text style={[s.ucretNot, { color: theme.muted }]}>
                      Kiralamada kartından {ucretYazi(r.ucretDetay.provizyon)} ₺ ön provizyon bloke edilir; iade edilir.
                    </Text>
                  </View>
                )}

                {/* İpuçları */}
                {co2 > 0 && (
                  <Text style={[s.hint, { color: carbonColor, backgroundColor: carbonColor + "15", borderColor: carbonColor + "40" }]}>
                    🌿 ~{co2}g CO₂ · {co2 < 100 ? "Düşük" : co2 < 300 ? "Orta" : "Yüksek"} emisyon
                  </Text>
                )}
                {/* BİSİM dockless: bisiklet bir istasyona bağlı değil, hizmet
                    alanı içinde her yere bırakılabilir. Metin bu yüzden bir
                    ALMA NOKTASI adı vermiyor — canlı bisiklet konumu
                    yayınlanmıyor, backend'in OTP'ye verdiği noktalar bisiklet
                    yolu koridoru üzerinde örneklenmiş varsayımlar
                    (bkz. BisimBolgeService.serbestBisikletler). Kullanıcıya
                    olmayan bir kesinlik vaat etmemek için "civarında" denir. */}
                {bikeType === "RENT" && bikeLegs.length > 0 && (
                  <Text style={[s.hint, { color: "#22c55e", backgroundColor: "#22c55e12", borderColor: "#22c55e30" }]}>
                    🚲 Civarındaki BİSİM bisikletini al → {bikeLegs[bikeLegs.length - 1].to} yakınında bırak · hizmet alanı içinde her yere bırakabilirsin
                  </Text>
                )}
                {r.walkWarning && (
                  <Text style={[s.hint, { color: "#f97316", backgroundColor: "#f9731612", borderColor: "#f9731630" }]}>
                    ⚠ {r.walkWarning}
                  </Text>
                )}

                {/* ── Bacak listesi ──
                    Bunlar SIRAYLA yapılacak adımlardır, seçenek listesi değil.
                    Kullanıcı bildirimi: ardışık iki otobüs kartı (912 ve 447)
                    görünce "ikisine de mi biniyorum, birine mi?" diye sordu.
                    Kartlar eşit boyutlu, aralarında boşluk olan kutulardı ve
                    hiçbir şey sıralı olduklarını söylemiyordu.

                    Üç işaret eklendi: adım numarası, kartları birbirine bağlayan
                    çizgi, ve ardışık iki TRANSİT bacağı arasında açık bir
                    "AKTARMA" şeridi. Aktarma şeridi asıl belirsizliği çözer:
                    912'den inip 447'ye binileceğini, inilecek durağın adıyla
                    birlikte söyler. */}
                {r.legs.map((leg, j) => {
                  // Tüm liste veriliyor: bir yürüyüşün anlamı ARDINDAN
                  // geleni, bisikletin park mı edildiği yoksa yanına mı
                  // alındığı ise transitten SONRA bisikletin devam edip
                  // etmediğini bilmeyi gerektiriyor.
                  const instruction = getLegInstruction(leg, r.legs, j);
                  const buTransit  = !NON_TRANSIT_MODES.includes(leg.mode);
                  const onceTransit = j > 0 && !NON_TRANSIT_MODES.includes(r.legs[j - 1].mode);
                  // Araya yürüyüş girmeyen iki transit bacağı = aynı durakta
                  // araç değiştirme. Yürüyüşlü aktarmada zaten bir yürüyüş
                  // kartı var, ikinci bir şerit gürültü olurdu.
                  const aktarma = buTransit && onceTransit;
                  return (
                    <React.Fragment key={j}>
                      {j > 0 && (aktarma ? (
                        <View style={s.aktarmaSatir}>
                          <View style={[s.baglayici, { backgroundColor: theme.border }]} />
                          <View style={[s.aktarmaRozet, { backgroundColor: theme.input, borderColor: theme.border }]}>
                            <AppIcon name="refresh" size={9} color={theme.muted} />
                            <Text style={[s.aktarmaMetin, { color: theme.muted }]} numberOfLines={1}>
                              Aktarma · {leg.from}
                            </Text>
                          </View>
                        </View>
                      ) : (
                        <View style={[s.baglayici, { backgroundColor: theme.border }]} />
                      ))}
                    <View style={[s.legCard, j === 0 && s.legCardIlk, { backgroundColor: theme.input, borderColor: theme.border }]}>
                      <View style={[s.legIconBox, { backgroundColor: leg.color + "20" }]}>
                        <AppIcon name={leg.icon} size={16} color={leg.color} />
                      </View>
                      <View style={s.legContent}>
                        <Text style={[s.legMode, { color: leg.color }]}>
                          {j + 1}. {leg.label}{leg.routeName ? ` · ${leg.routeName}` : ""}
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
                    </React.Fragment>
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
  noticeBox:   { flexDirection: "row", alignItems: "center", gap: 7,
                 paddingHorizontal: 11, paddingVertical: 8, marginBottom: 8,
                 borderRadius: 8, borderWidth: 1 },
  noticeText:  { flex: 1, fontSize: 12, fontWeight: "600", lineHeight: 16 },
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
  tagSutun: { gap: 3, alignItems: "flex-start" },
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
  // Ücret dökümü
  ucretKutu: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 7, marginTop: 4 },
  ucretSatir: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  ucretToplam: { borderTopWidth: 1, paddingTop: 7, marginTop: 1 },
  ucretEtiket: { fontSize: 12 },
  ucretDeger: { fontSize: 13, fontWeight: "700" },
  ucretNot: { fontSize: 10, lineHeight: 14, marginTop: 2 },

  hint: {
    fontSize: 10, fontWeight: "700",
    borderWidth: 1, borderRadius: 7,
    padding: 6, lineHeight: 15,
  },
  legCard: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1, borderRadius: 9,
    padding: 7,
  },
  // Aradaki boşluğu artık bağlayıcı çizgi veriyor; yalnız ilk kartın
  // üstündeki ipuçlarından ayrılması gerekiyor.
  legCardIlk: { marginTop: 4 },
  // Kartları birbirine bağlayan dikey çizgi. marginLeft, kartın iç boşluğu
  // (7) + kenarlığı (1) + ikon kutusunun yarısı (13) ile hizalı: çizgi
  // ikonların tam altından geçer.
  baglayici:    { width: 2, height: 7, marginLeft: 20, borderRadius: 1 },
  aktarmaSatir: { flexDirection: "row", alignItems: "center", gap: 6 },
  aktarmaRozet: { flexDirection: "row", alignItems: "center", gap: 4,
                  borderWidth: 1, borderRadius: 6,
                  paddingHorizontal: 6, paddingVertical: 2, flexShrink: 1 },
  aktarmaMetin: { fontSize: 9, fontWeight: "800", letterSpacing: 0.4, flexShrink: 1 },
  legIconBox:  { width: 26, height: 26, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  legContent:  { flex: 1 },
  legMode:     { fontSize: 9, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  legRoute:    { fontSize: 11, fontWeight: "600" },
  legHint:     { fontSize: 10, fontWeight: "600", marginTop: 1 },
  legMetrics:  { alignItems: "flex-end" },
  legDur:      { fontSize: 11, fontWeight: "700" },
  legDist:     { fontSize: 9, fontWeight: "600", marginTop: 1 },
});
