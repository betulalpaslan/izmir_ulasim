import { ApiError, apiGet, apiPost } from "../Services/apiClient";
import { describeLayerError } from "../utils/layerStatus";

const yanit = ({ ok = true, status = 200, body = {}, jsonThrows = false }) => ({
  ok,
  status,
  json: async () => {
    if (jsonThrows) throw new SyntaxError("Unexpected token < in JSON");
    return body;
  },
});

describe("apiGet — durum kodu okunur", () => {
  afterEach(() => { global.fetch = undefined; });

  test("200 yanıtta gövde döner", async () => {
    global.fetch = jest.fn(async () => yanit({ body: { stations: [{ id: 1 }] } }));
    await expect(apiGet("https://x/bisim/stations")).resolves.toEqual({ stations: [{ id: 1 }] });
  });

  // Asıl mesele bu: eskiden 502'de de `data.stations || []` çalışıyor ve
  // katman sessizce boş çiziliyordu.
  test("502 yanıt boş liste değil, ApiError üretir", async () => {
    global.fetch = jest.fn(async () => yanit({ ok: false, status: 502, body: { error: "BİSİM verisi alınamıyor." } }));
    const err = await apiGet("https://x/bisim/stations").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(502);
    expect(err.isUpstream).toBe(true);
    expect(err.isNetwork).toBe(false);
    expect(err.message).toContain("BİSİM verisi alınamıyor.");
  });

  test("hata gövdesi JSON değilse durum kodu yine de taşınır", async () => {
    global.fetch = jest.fn(async () => yanit({ ok: false, status: 503, jsonThrows: true }));
    const err = await apiGet("https://x/parking/stations").catch((e) => e);
    expect(err.status).toBe(503);
    expect(err.isUpstream).toBe(true);
  });

  test("ağ hatasında status null olur", async () => {
    global.fetch = jest.fn(async () => { throw new TypeError("Network request failed"); });
    const err = await apiGet("https://x/bisim/stations").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBeNull();
    expect(err.isNetwork).toBe(true);
    expect(err.userMessage).toBe("İnternet bağlantısı kurulamadı.");
  });

  // 200 döndü ama gövde JSON değil: araya giren bir portal/proxy'nin klasik
  // belirtisi. Boş liste dönmek bunu gizlerdi.
  test("200 ama bozuk gövde hata sayılır", async () => {
    global.fetch = jest.fn(async () => yanit({ jsonThrows: true }));
    const err = await apiGet("https://x/bisim/stations").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toContain("geçerli JSON değil");
  });

  test("zaman aşımında AbortController devreye girer", async () => {
    global.fetch = jest.fn(async (url, { signal }) => {
      const err = new Error("Aborted");
      err.name = "AbortError";
      expect(signal).toBeDefined();
      throw err;
    });
    const err = await apiGet("https://x/bisim/stations", { timeoutMs: 5 }).catch((e) => e);
    expect(err.isNetwork).toBe(true);
    expect(err.message).toContain("zaman aşımı");
  });
});

describe("apiPost", () => {
  afterEach(() => { global.fetch = undefined; });

  test("gövdeyi JSON olarak yollar ve Content-Type ekler", async () => {
    global.fetch = jest.fn(async () => yanit({ body: { itineraries: [] } }));
    await apiPost("https://x/get-route", { profile: "transit" });
    const [, opts] = global.fetch.mock.calls[0];
    expect(opts.method).toBe("POST");
    expect(opts.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(opts.body)).toEqual({ profile: "transit" });
  });
});

describe("ApiError.userMessage — kullanıcı ne yapabileceğini anlar", () => {
  const yap = (status) => new ApiError("x", { status });

  test("her durum için ayrı mesaj", () => {
    expect(yap(null).userMessage).toBe("İnternet bağlantısı kurulamadı.");
    expect(yap(502).userMessage).toContain("veri kaynağına ulaşamıyor");
    expect(yap(404).userMessage).toContain("güncellenmiş olabilir");
    expect(yap(500).userMessage).toBe("Sunucuda bir hata oluştu.");
    expect(yap(418).userMessage).toBe("Veri alınamadı.");
  });
});

describe("describeLayerError", () => {
  test("katman adını ve sebebi tek satırda birleştirir", () => {
    const err = new ApiError("HTTP 502", { status: 502 });
    expect(describeLayerError("BİSİM istasyonları", err))
      .toBe("BİSİM istasyonları yüklenemedi — Sunucu veri kaynağına ulaşamıyor, birazdan tekrar deneyin.");
  });

  test("ApiError olmayan hatada genel metne düşer", () => {
    expect(describeLayerError("Otoparklar", new Error("boom")))
      .toBe("Otoparklar yüklenemedi — veri alınamadı");
  });
});
