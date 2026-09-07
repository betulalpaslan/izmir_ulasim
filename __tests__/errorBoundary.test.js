import { Text } from "react-native";
import { act, create } from "react-test-renderer";
import ErrorBoundary from "../Components/ErrorBoundary";

// Patlayan bir çocuk bileşen. `should` state'e bakıyor ki "yeniden dene"
// sonrası sağlıklı hâle dönebilelim.
let patla = true;
function Patlayan() {
  if (patla) throw new Error("test çöküşü");
  return <Text>iyileşti</Text>;
}

function metinler(agac) {
  return agac.root.findAllByType(Text).map((t) =>
    (Array.isArray(t.props.children) ? t.props.children.join("") : String(t.props.children ?? ""))
  );
}

let hataLogu;
beforeEach(() => {
  patla = true;
  // React yakalanan hatayı ayrıca konsola basıyor; test çıktısını kirletmesin.
  hataLogu = jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => hataLogu.mockRestore());

function kur(props = {}) {
  let agac;
  act(() => {
    agac = create(
      <ErrorBoundary {...props}>
        <Patlayan />
      </ErrorBoundary>
    );
  });
  return agac;
}

test("sağlıklı ağaç olduğu gibi çiziliyor", () => {
  patla = false;
  const agac = kur();
  expect(metinler(agac)).toContain("iyileşti");
});

test("çöküşte kullanıcıya sade bir mesaj ve çıkış yolu gösteriliyor", () => {
  const agac = kur();
  const yazilar = metinler(agac);
  expect(yazilar).toContain("Bir şeyler ters gitti");
  expect(yazilar).toContain("Yeniden dene");
  // Eski ekran kullanıcıya bunu gösteriyordu.
  expect(yazilar).not.toContain("HATA MESAJI");
});

test("hata bildiriliyor — sessizce yutulmuyor", () => {
  const onError = jest.fn();
  kur({ onError });
  expect(onError).toHaveBeenCalledTimes(1);
  expect(onError.mock.calls[0][0].message).toBe("test çöküşü");
});

test("onError verilmemişse konsola düşüyor", () => {
  kur();
  expect(hataLogu.mock.calls.some((c) => c[0] === "Yakalanmamış hata:")).toBe(true);
});

test("yeniden dene ağacı tekrar çiziyor", () => {
  const agac = kur();
  patla = false;
  const btn = agac.root.findAll((n) => typeof n.props.onPress === "function")[0];
  act(() => btn.props.onPress());
  expect(metinler(agac)).toContain("iyileşti");
});

test("yığın izi yalnız geliştirme kipinde", () => {
  const agac = kur();
  const devBasligi = "Geliştirici ayrıntısı — bu bölüm yayın sürümünde görünmez";
  expect(metinler(agac).includes(devBasligi)).toBe(__DEV__);
});
