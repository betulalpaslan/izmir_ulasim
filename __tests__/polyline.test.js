import { decodePolyline } from "../utils/polyline";

describe("decodePolyline", () => {
  it("Google'ın referans örneğini doğru çözer", () => {
    // https://developers.google.com/maps/documentation/utilities/polylinealgorithm
    const noktalar = decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
    expect(noktalar).toHaveLength(3);
    expect(noktalar[0].latitude).toBeCloseTo(38.5, 4);
    expect(noktalar[0].longitude).toBeCloseTo(-120.2, 4);
    expect(noktalar[1].latitude).toBeCloseTo(40.7, 4);
    expect(noktalar[1].longitude).toBeCloseTo(-120.95, 4);
    expect(noktalar[2].latitude).toBeCloseTo(43.252, 4);
    expect(noktalar[2].longitude).toBeCloseTo(-126.453, 4);
  });

  it("boş girdi için boş dizi döner", () => {
    expect(decodePolyline("")).toEqual([]);
  });

  it("tek noktalı çizgiyi çözer", () => {
    const noktalar = decodePolyline("_p~iF~ps|U");
    expect(noktalar).toHaveLength(1);
    expect(noktalar[0].latitude).toBeCloseTo(38.5, 4);
  });

  it("harita bileşeninin beklediği alan adlarını kullanır", () => {
    const [nokta] = decodePolyline("_p~iF~ps|U");
    expect(Object.keys(nokta).sort()).toEqual(["latitude", "longitude"]);
  });
});
