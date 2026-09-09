import { Text, TextInput, TouchableOpacity } from "react-native";
import { act, create } from "react-test-renderer";
import SearchPanel from "../Components/SearchPanel";

jest.mock("../utils/ThemeContext", () => ({
  useTheme: () => ({
    theme: {
      text: "#000", muted: "#666", border: "#ccc", input: "#fff", panel: "#eee",
      surface: "#fff", shadow: "#000", subtle: "#999", active: "#00f",
      accentBike: "#0f0", accentCar: "#f80", danger: "#f00",
    },
  }),
}));

const profiller = [
  { id: "transit", label: "Toplu Taşıma", icon: "bus", color: "#8b5cf6" },
  { id: "bicycle", label: "Bisiklet",     icon: "bike", color: "#22c55e" },
];

function ciz(props = {}) {
  let agac;
  act(() => {
    agac = create(
      <SearchPanel
        profiles={profiller}
        profile="transit"
        onSelectProfile={() => {}}
        bikeType={null}
        onSelectBikeType={() => {}}
        carMode={null}
        onToggleCarMode={() => {}}
        originText=""
        destText=""
        onChangeText={() => {}}
        onFocusField={() => {}}
        onSwap={() => {}}
        onLocateMe={() => {}}
        hasUserLocation={false}
        suggestions={[]}
        onSelectSuggestion={() => {}}
        savedPlaces={[]}
        savedPlacesOpen={false}
        onToggleSavedPlaces={() => {}}
        onUsePlace={() => {}}
        onSavePlace={() => {}}
        {...props}
      />
    );
  });
  return agac;
}

const tumMetin = (agac) =>
  agac.root.findAllByType(Text).map((t) => {
    const c = t.props.children;
    return Array.isArray(c) ? c.flat().map((x) => String(x ?? "")).join("") : String(c ?? "");
  }).join(" | ");

const alanSayisi = (agac) => agac.root.findAllByType(TextInput).length;
const basligaDokun = (agac) =>
  act(() => { agac.root.findAllByType(TouchableOpacity)[0].props.onPress(); });

describe("arama paneli katlanması", () => {
  test("açık başlar: adres alanları ve profiller görünür", () => {
    const agac = ciz();
    expect(alanSayisi(agac)).toBe(2);
    expect(tumMetin(agac)).toContain("Toplu Taşıma");
  });

  test("başlığa dokununca kapanır, alanlar gizlenir", () => {
    const agac = ciz({ originText: "Konak", destText: "Alsancak" });
    basligaDokun(agac);
    expect(alanSayisi(agac)).toBe(0);
    expect(tumMetin(agac)).not.toContain("Toplu Taşıma");
  });

  test("kapalıyken nereden nereye özeti kalır", () => {
    const agac = ciz({ originText: "Konak", destText: "Alsancak" });
    basligaDokun(agac);
    expect(tumMetin(agac)).toContain("Konak → Alsancak");
  });

  test("uçlar boşken özet yönlendirici metindir", () => {
    const agac = ciz();
    basligaDokun(agac);
    expect(tumMetin(agac)).toContain("Nereden nereye?");
  });

  test("yalnız başlangıç doluysa varış yerine etiket yazar", () => {
    const agac = ciz({ originText: "Konak" });
    basligaDokun(agac);
    expect(tumMetin(agac)).toContain("Konak → Varış");
  });

  test("özet satırına dokununca yeniden açılır", () => {
    const agac = ciz({ originText: "Konak", destText: "Alsancak" });
    basligaDokun(agac);
    expect(alanSayisi(agac)).toBe(0);
    act(() => { agac.root.findAllByType(TouchableOpacity)[1].props.onPress(); });
    expect(alanSayisi(agac)).toBe(2);
  });
});
