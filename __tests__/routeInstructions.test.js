import { getLegInstruction, guzergahZinciri } from "../utils/routeInstructions";

// buildRouteResult'ın ürettiği biçim: from/to düz metin, mod adı OTP'den.
const bacak = (mode, from, to, extra = {}) => ({ mode, from, to, duration: 600, ...extra });

const UCLAR = { baslangic: "Konak Meydanı", varis: "Alsancak Garı" };

describe("uç adları", () => {
  // OTP ilk ve son bacağın uçlarına "Başlangıç"/"Varış" yazıyor; gerçek adı
  // yalnız arayüz biliyor ve uclar ile geçiriyor.
  it("ilk bacağın kalkışını uclar'dan alır", () => {
    const legs = [bacak("WALK", "Başlangıç", "Poligon")];
    expect(getLegInstruction(legs[0], legs, 0, UCLAR).nereden).toBe("Konak Meydanı");
  });

  it("son bacağın varışını uclar'dan alır", () => {
    const legs = [bacak("WALK", "Kasap", "Varış")];
    expect(getLegInstruction(legs[0], legs, 0, UCLAR).nereye).toBe("Alsancak Garı");
  });

  it("ara bacağa uç adı sızmaz", () => {
    const legs = [
      bacak("WALK", "Başlangıç", "Poligon"),
      bacak("SUBWAY", "Varış", "Varış"),   // ortada, uç değil
      bacak("WALK", "Kasap", "Varış"),
    ];
    const orta = getLegInstruction(legs[1], legs, 1, UCLAR);
    expect(orta.nereden).toBeNull();
    expect(orta.nereye).toBeNull();
  });

  it("gerçek durak adı varsa uclar onu ezmez", () => {
    const legs = [bacak("WALK", "Basmane", "Poligon")];
    expect(getLegInstruction(legs[0], legs, 0, UCLAR).nereden).toBe("Basmane");
  });

  it("uclar verilmezse uç adları boş kalır", () => {
    const legs = [bacak("WALK", "Başlangıç", "Varış")];
    const a = getLegInstruction(legs[0], legs, 0);
    expect(a.nereden).toBeNull();
    expect(a.nereye).toBeNull();
  });
});

describe("adım metinleri", () => {
  it("transit öncesi yürüyüş durağı adlandırır", () => {
    const legs = [bacak("WALK", "Başlangıç", "Poligon"), bacak("SUBWAY", "Poligon", "Basmane")];
    expect(getLegInstruction(legs[0], legs, 0, UCLAR).title).toBe("Poligon durağına yürü");
  });

  it("son yürüyüşü varış adıyla ve 'son adım' notuyla yazar", () => {
    const legs = [bacak("SUBWAY", "Poligon", "Kasap"), bacak("WALK", "Kasap", "Varış")];
    const a = getLegInstruction(legs[1], legs, 1, UCLAR);
    expect(a.title).toBe("Alsancak Garı noktasına yürü");
    expect(a.detail).toContain("son adım");
  });

  it("transit bacağında biniş ve iniş durağını söyler", () => {
    const legs = [bacak("SUBWAY", "Poligon", "Basmane", { routeName: "M1" })];
    const a = getLegInstruction(legs[0], legs, 0);
    expect(a.title).toBe("M1 hattına Poligon durağından bin");
    expect(a.detail).toBe("Basmane durağında in");
  });

  it("hat adı yoksa label'a düşer", () => {
    const legs = [bacak("TRAM", "Konak", "Alsancak", { label: "Tramvay" })];
    expect(getLegInstruction(legs[0], legs, 0).title).toBe("Tramvay hattına Konak durağından bin");
  });

  // Bisiklet transitten önce VE sonra varsa yanında taşınıyor demektir.
  it("bisiklet yanındaysa transit detayında söyler", () => {
    const legs = [
      bacak("BICYCLE", "Başlangıç", "Poligon"),
      bacak("BUS", "Poligon", "Kasap"),
      bacak("BICYCLE", "Kasap", "Varış"),
    ];
    expect(getLegInstruction(legs[1], legs, 1).detail).toContain("bisikletin yanında");
  });

  it("bisiklet transitten sonra yoksa kilitlemeyi söyler", () => {
    const legs = [bacak("BICYCLE", "Başlangıç", "Poligon"), bacak("BUS", "Poligon", "Kasap")];
    expect(getLegInstruction(legs[0], legs, 0).detail).toContain("bisikleti burada kilitle");
  });

  it("bisiklet transitten sonra da varsa yanına almayı söyler", () => {
    const legs = [
      bacak("BICYCLE", "Başlangıç", "Poligon"),
      bacak("BUS", "Poligon", "Kasap"),
      bacak("BICYCLE", "Kasap", "Varış"),
    ];
    expect(getLegInstruction(legs[0], legs, 0).detail).toContain("bisikleti yanına al");
  });

  // BİSİM dockless: yuva aranmaz, hizmet alanı içinde bırakılır.
  it("son BİSİM bacağında hizmet alanına bırakmayı söyler", () => {
    const legs = [bacak("WALK", "Başlangıç", "x"), bacak("BICYCLE_RENTAL", "x", "Varış")];
    expect(getLegInstruction(legs[1], legs, 1).detail).toContain("hizmet alanı içinde bırak");
  });

  it("araba bacağını otoparka yönlendirir", () => {
    const legs = [bacak("CAR", "Başlangıç", "Bornova Katlı"), bacak("SUBWAY", "Bornova", "Konak")];
    expect(getLegInstruction(legs[0], legs, 0).title).toBe("Bornova Katlı otoparkına sür");
  });

  it("bir dakikadan kısa bacağı 1 dk gösterir", () => {
    const legs = [bacak("WALK", "a", "b", { duration: 20 })];
    expect(getLegInstruction(legs[0], legs, 0).detail).toContain("1 dk");
  });
});

describe("guzergahZinciri", () => {
  it("transit yoksa boş döner", () => {
    expect(guzergahZinciri([bacak("WALK", "a", "b"), bacak("BICYCLE", "b", "c")])).toEqual([]);
  });

  it("tek transitte biniş ve iniş durağını verir", () => {
    const legs = [bacak("WALK", "Başlangıç", "Konak"), bacak("TRAM", "Konak", "Alsancak")];
    expect(guzergahZinciri(legs)).toEqual(["Konak", "Alsancak"]);
  });

  it("aynı durakta aktarmada adı iki kez yazmaz", () => {
    const legs = [
      bacak("SUBWAY", "Konak", "Halkapınar"),
      bacak("RAIL", "Halkapınar", "Karşıyaka"),
    ];
    expect(guzergahZinciri(legs)).toEqual(["Konak", "Halkapınar", "Karşıyaka"]);
  });

  // Regresyon: yalnız biniş durakları toplandığında inilen durak zincirden
  // düşüyordu — kullanıcı nerede ineceğini göremiyordu.
  it("yürüyerek aktarmada inilen durağı düşürmez", () => {
    const legs = [
      bacak("SUBWAY", "A", "B"),
      bacak("WALK", "B", "C"),
      bacak("BUS", "C", "D"),
    ];
    expect(guzergahZinciri(legs)).toEqual(["A", "B", "C", "D"]);
  });

  it("adsız duraklara yer tutucu koyar", () => {
    expect(guzergahZinciri([bacak("BUS", "Başlangıç", "Varış")])).toEqual(["Durak", "Son durak"]);
  });

  it("liste değilse boş döner", () => {
    expect(guzergahZinciri(null)).toEqual([]);
  });
});
