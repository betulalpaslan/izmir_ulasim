// Backend ile konuşan tek kapı.
//
// Buradan önce her istek `const data = await res.json(); return data.stations || []`
// kalıbındaydı ve hiçbiri res.ok'a bakmıyordu. Sonuç: backend 502 dönünce
// katman sessizce boş çiziliyor, kullanıcı "İzmir'de bu bölgede istasyon yok"
// ile "sunucu veri kaynağına ulaşamıyor" arasındaki farkı göremiyordu.
// Backend'in 502/500 ayrımına gösterdiği özen istemcide hiç kullanılmıyordu.
//
// ApiError bu farkı taşır: hangi uç, hangi HTTP durumu, kullanıcıya ne
// denmeli. Katmanlar boş liste yerine hata alır ve arayüz nedenini gösterir.

export class ApiError extends Error {
  constructor(message, { status = null, endpoint = null, cause = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;      // HTTP durumu; ağ hatası/zaman aşımında null
    this.endpoint = endpoint;
    this.cause = cause;
  }

  // Cihaz sunucuya hiç ulaşamadı (bağlantı yok, DNS, zaman aşımı).
  get isNetwork() {
    return this.status === null;
  }

  // Sunucu ayakta ama arkasındaki kaynağa ulaşamıyor — tekrar denemek anlamlı.
  get isUpstream() {
    return this.status === 502 || this.status === 503 || this.status === 504;
  }

  // Arayüzde gösterilecek metin. Teknik ayrıntı değil, kullanıcının
  // yapabileceği şeyi söyler.
  get userMessage() {
    if (this.isNetwork)     return "İnternet bağlantısı kurulamadı.";
    if (this.isUpstream)    return "Sunucu veri kaynağına ulaşamıyor, birazdan tekrar deneyin.";
    if (this.status === 404) return "Sunucu bu isteği tanımıyor, uygulama güncellenmiş olabilir.";
    if (this.status >= 500) return "Sunucuda bir hata oluştu.";
    return "Veri alınamadı.";
  }
}

const DEFAULT_TIMEOUT = 15000;

// Zaman aşımı olmayan bir fetch, kopuk bağlantıda süresiz bekler ve katman
// sonsuza dek "yükleniyor" kalır — bu yüzden her istek AbortController ile
// sınırlanır.
async function request(url, { method = "GET", body = null, timeoutMs = DEFAULT_TIMEOUT } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(url, {
      method,
      signal: controller.signal,
      ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
    });
  } catch (err) {
    const zamanAsimi = err?.name === "AbortError";
    throw new ApiError(
      zamanAsimi ? `İstek zaman aşımına uğradı (${timeoutMs} ms)` : `Sunucuya ulaşılamadı: ${err?.message ?? err}`,
      { endpoint: url, cause: err }
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    // Backend hata gövdesini {error, detail} olarak döndürür; okunabiliyorsa
    // log'da gerçek sebep görünsün.
    let detay = null;
    try {
      const gövde = await res.json();
      detay = gövde?.error || gövde?.detail || null;
    } catch {
      // gövde JSON değil (proxy hata sayfası, boş yanıt) — durum kodu yeter
    }
    throw new ApiError(`HTTP ${res.status}${detay ? `: ${detay}` : ""}`, {
      status: res.status,
      endpoint: url,
    });
  }

  try {
    return await res.json();
  } catch (err) {
    // 200 döndü ama gövde JSON değil: araya giren bir portal/proxy'nin
    // klasik belirtisi. Boş liste dönmek bunu gizlerdi.
    throw new ApiError("Sunucu yanıtı okunamadı (geçerli JSON değil)", {
      status: res.status,
      endpoint: url,
      cause: err,
    });
  }
}

export function apiGet(url, options) {
  return request(url, options);
}

export function apiPost(url, body, options) {
  return request(url, { ...options, method: "POST", body });
}
