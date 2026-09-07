import React from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Appearance } from "react-native";
import { getTheme, temaSec } from "../utils/theme";

// Ağacın tamamını saran son durak. İki şey değişti:
//
//   • Ekran artık bir geliştirici ekranı değil. Kullanıcı "HATA MESAJI"
//     başlığı ve yığın izi görüyordu; ne olduğunu anlamıyor, ne yapacağını
//     bilmiyordu. Ayrıntı yalnız __DEV__ altında açılıyor.
//   • Hata bir yere BİLDİRİLİYOR. Eskiden hiçbir yere gitmiyordu:
//     kullanıcı çöküşü görüyor, geliştirici hiç duymuyordu. `onError`
//     propu bir raporlayıcıya bağlanabilir; yoksa konsola düşer.
//
// Tema: bu bileşen ThemeProvider'ın DIŞINDA (provider'ın kendisi patlarsa
// da yakalayabilsin diye), o yüzden kullanıcının kayıtlı tercihini
// okuyamıyor — cihaz ayarına bakıyor. Yanlış tema, yakalanmamış çöküşten
// iyi bir takas.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (this.props.onError) {
      this.props.onError(error, info);
    } else {
      console.error("Yakalanmamış hata:", error, info?.componentStack);
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    const theme = getTheme(temaSec(null, Appearance.getColorScheme()));

    return (
      <View style={[s.container, { backgroundColor: theme.bg }]}>
        <View style={s.box}>
          <Text style={[s.title, { color: theme.text }]}>Bir şeyler ters gitti</Text>
          <Text style={[s.desc, { color: theme.muted }]}>
            Uygulama beklenmedik bir hatayla karşılaştı. Yeniden deneyebilir,
            sorun sürerse uygulamayı kapatıp açabilirsiniz.
          </Text>

          <TouchableOpacity
            style={[s.btn, { backgroundColor: theme.active }]}
            onPress={() => this.setState({ error: null })}
            activeOpacity={0.85}
          >
            <Text style={s.btnText}>Yeniden dene</Text>
          </TouchableOpacity>

          {__DEV__ && (
            <ScrollView style={[s.devBox, { borderColor: theme.border, backgroundColor: theme.surface }]}>
              <Text style={[s.devTitle, { color: theme.danger }]}>
                Geliştirici ayrıntısı — bu bölüm yayın sürümünde görünmez
              </Text>
              <Text style={[s.devMessage, { color: theme.text }]}>
                {this.state.error?.toString()}
              </Text>
              <Text style={[s.devStack, { color: theme.muted }]}>{this.state.error?.stack}</Text>
            </ScrollView>
          )}
        </View>
      </View>
    );
  }
}

const s = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center" },
  box: { gap: 12 },
  title: { fontSize: 22, fontWeight: "800" },
  desc: { fontSize: 14, lineHeight: 21 },
  btn: { paddingVertical: 15, borderRadius: 12, alignItems: "center", marginTop: 8 },
  btnText: { color: "#ffffff", fontSize: 15, fontWeight: "800", letterSpacing: 0.3 },
  devBox: { marginTop: 20, maxHeight: 260, borderWidth: 1, borderRadius: 12, padding: 14 },
  devTitle: { fontSize: 11, fontWeight: "800", marginBottom: 8, letterSpacing: 0.4 },
  devMessage: { fontSize: 13, lineHeight: 20, marginBottom: 10 },
  devStack: { fontSize: 11, lineHeight: 17 },
});
