import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import AppIcon from "./AppIcon";
import { useTheme } from "../utils/ThemeContext";
import { getLegInstruction, guzergahZinciri } from "../utils/routeInstructions";
import { NON_TRANSIT_MODES, ucretYazi, SIRALAMA_TERCIHLERI, siralamayaGore } from "../utils/routeScoring";
import { formatDistance } from "../utils/geo";

// Birden fazla bilet çıktığında sebebini yazar; "neden 35 ₺?" sorusu kartta
// cevaplanmazsa hesap yanlış görünüyor.
// Kapalı kartta gösterilen en fazla durak sayısı.
const ZINCIR_TAVANI = 3;

const BILET_NOTU = {
  "sure-asimi": "90 dakikalık aktarma hakkı bu yolculuğa yetmiyor; süre dolduktan sonraki binişler yeni bilet sayılır.",
  "binis-basi": "Kredi/banka kartında aktarma hakkı yok; her biniş ayrı ücretlenir.",
};

export default function RoutePanel({ routes, selectedIdx, onSelect, loading, error, notice, origin, destination, originName, destName, onReset, bikeType, modBos, onAlternative }) {
  const { theme } = useTheme();
  const [tercih, setTercih] = useState("recommended");

  // Bacak metinleri "Başlangıç"/"Varış" yerine gerçek adı yazsın diye.
  // Ayrı bir uç şeridi YOK: aynı adlar arama kutularında ve kapalı panel
  // özetinde zaten duruyor.
  const uclar = { baslangic: originName, varis: destName };

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
      </View>
    );
  }

  const sirali = siralamayaGore(routes, tercih);

  // Tercihe dokununca o ölçünün en iyisi seçilsin: harita da onu çizer.
  const tercihSec = (id) => {
    setTercih(id);
    const [ilk] = siralamayaGore(routes, id);
    if (ilk) onSelect(ilk.idx);
  };

  return (
    <View>
      {routes.length > 1 && (
        <View style={s.tercihSatir}>
          {SIRALAMA_TERCIHLERI.map((t) => {
            const secili = tercih === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                onPress={() => tercihSec(t.id)}
                activeOpacity={0.75}
                style={[
                  s.tercihCip,
                  { backgroundColor: theme.input, borderColor: theme.border },
                  secili && { borderColor: theme.active, backgroundColor: theme.active + "18" },
                ]}
              >
                <AppIcon name={t.icon} size={11} color={secili ? theme.active : theme.muted} />
                <Text
                  style={[s.tercihMetin, { color: secili ? theme.active : theme.muted }]}
                  numberOfLines={1}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

    <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} nestedScrollEnabled>
      {bilgiSeridi}

      {sirali.map(({ rota: r, idx: i }) => {
        const expanded = selectedIdx === i;
        const bikeLegs = r.legs.filter((l) => l.mode === "BICYCLE" || l.mode === "BICYCLE_RENTAL");
        // Uzun yolculukta zincir kapalı kartta iki satır kaplıyor ve paneli
        // haritanın üstüne taşırıyordu; açık kartta tamamı zaten duruyor.
        const zincirTam = guzergahZinciri(r.legs);
        const zincir = expanded ? zincirTam : zincirTam.slice(0, ZINCIR_TAVANI);
        const gizliDurak = zincirTam.length - zincir.length;

        return (
          <TouchableOpacity
            key={r.kimlik ?? i}
            onPress={() => onSelect(expanded ? -1 : i)}
            activeOpacity={0.8}
            style={[
              s.card,
              { backgroundColor: theme.input, borderColor: expanded ? r.tagColor : theme.border },
            ]}
          >
            {/* ── Kart başlığı: etiket | süre+meta | ücret | chevron ── */}
            <View style={s.cardHeader}>
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

            {zincir.length > 1 && (
              <View style={s.zincirSatir}>
                {zincir.map((ad, k) => (
                  <React.Fragment key={`${ad}-${k}`}>
                    {k > 0 && (
                      <AppIcon name="chevronRight" size={9} color={theme.muted} />
                    )}
                    <Text style={[s.zincirAd, { color: theme.muted }]} numberOfLines={1}>
                      {ad}
                    </Text>
                  </React.Fragment>
                ))}
                {gizliDurak > 0 && (
                  <Text style={[s.zincirAd, { color: theme.muted }]}>+{gizliDurak} durak</Text>
                )}
              </View>
            )}

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

        
                {(r.ucretDetay?.bisim > 0 || r.ucretDetay?.biletAdedi > 1) && (
                  <View style={[s.ucretKutu, { backgroundColor: theme.input, borderColor: theme.border }]}>
                    <View style={s.ucretSatir}>
                      <Text style={[s.ucretEtiket, { color: theme.muted }]}>
                        {r.ucretDetay.biletAdedi > 1
                          ? `Toplu taşıma bileti · ${r.ucretDetay.biletAdedi} × ${ucretYazi(r.ucretDetay.biletBirim)} ₺`
                          : "Toplu taşıma bileti"}
                      </Text>
                      <Text style={[s.ucretDeger, { color: theme.text }]}>{ucretYazi(r.ucretDetay.bilet)} ₺</Text>
                    </View>
                    {r.ucretDetay.bisim > 0 && (
                      <View style={s.ucretSatir}>
                        <Text style={[s.ucretEtiket, { color: theme.muted }]}>
                          BİSİM · {r.ucretDetay.bisimDakika} dk
                        </Text>
                        <Text style={[s.ucretDeger, { color: theme.text }]}>{ucretYazi(r.ucretDetay.bisim)} ₺</Text>
                      </View>
                    )}
                    <View style={[s.ucretSatir, s.ucretToplam, { borderTopColor: theme.border }]}>
                      <Text style={[s.ucretEtiket, { color: theme.text, fontWeight: "800" }]}>Toplam</Text>
                      <Text style={[s.ucretDeger, { color: "#f97316", fontSize: 15 }]}>{ucretYazi(r.cost)} ₺</Text>
                    </View>
                    {BILET_NOTU[r.ucretDetay.biletSebebi] && (
                      <Text style={[s.ucretNot, { color: theme.muted }]}>
                        {BILET_NOTU[r.ucretDetay.biletSebebi]}
                      </Text>
                    )}
                    {r.ucretDetay.bisim > 0 && (
                      <Text style={[s.ucretNot, { color: theme.muted }]}>
                        Kiralamada kartından {ucretYazi(r.ucretDetay.provizyon)} ₺ ön provizyon bloke edilir; iade edilir.
                      </Text>
                    )}
                  </View>
                )}

  
                {bikeType === "RENT" && bikeLegs.length > 0 && (
                  <View style={[s.hint, { backgroundColor: "#22c55e12", borderColor: "#22c55e30" }]}>
                    <AppIcon name="bike" size={12} color="#22c55e" />
                    <Text style={[s.hintText, { color: "#22c55e" }]}>
                      Civarındaki BİSİM bisikletini al → {bikeLegs[bikeLegs.length - 1].to} yakınında bırak · hizmet alanı içinde her yere bırakabilirsin
                    </Text>
                  </View>
                )}
                {r.walkWarning && (
                  <View style={[s.hint, { backgroundColor: "#f9731612", borderColor: "#f9731630" }]}>
                    <AppIcon name="alert" size={12} color="#f97316" />
                    <Text style={[s.hintText, { color: "#f97316" }]}>{r.walkWarning}</Text>
                  </View>
                )}

              
                {r.legs.map((leg, j) => {
                  const instruction = getLegInstruction(leg, r.legs, j, uclar);
                  const buTransit  = !NON_TRANSIT_MODES.includes(leg.mode);
                  const onceTransit = j > 0 && !NON_TRANSIT_MODES.includes(r.legs[j - 1].mode);
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
                          {instruction.nereden && instruction.nereye
                            ? `${instruction.nereden} → ${instruction.nereye}`
                            : instruction.title}
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
    </View>
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
  actionBtn: {
    borderWidth: 1, borderRadius: 9,
    paddingVertical: 8, alignItems: "center",
  },
  actionContent: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionText:    { fontSize: 12, fontWeight: "700" },


  // Sıralama tercihleri
  tercihSatir: { flexDirection: "row", gap: 4, marginBottom: 6 },
  tercihCip: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 3, borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 4, flex: 1,
  },
  tercihMetin: { fontSize: 10, fontWeight: "700", flexShrink: 1 },

  // Ana scroll — panel ekranın yarısını geçmesin diye ölçülü tutuluyor
  scroll:      { maxHeight: 200 },

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

  // Durak zinciri
  zincirSatir: { flexDirection: "row", flexWrap: "wrap", alignItems: "center",
                 gap: 2, paddingHorizontal: 9, paddingBottom: 7, marginTop: -3 },
  zincirAd:    { flexShrink: 1, fontSize: 9, fontWeight: "700" },

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

  // İkon ilk satırın hizasında dursun diye flex-start; metin sarınca ikon
  // dikeyde ortalanıp kaymasın.
  hint: {
    flexDirection: "row", alignItems: "flex-start", gap: 5,
    borderWidth: 1, borderRadius: 7,
    padding: 6,
  },
  hintText: { flex: 1, fontSize: 10, fontWeight: "700", lineHeight: 15 },
  legCard: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1, borderRadius: 9,
    padding: 7,
  },
  
  legCardIlk: { marginTop: 4 },
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
