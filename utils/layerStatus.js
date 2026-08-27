// Harita katmanı yüklenemediğinde kullanıcıya gösterilecek tek satır.
//
// Katmanlar eskiden `.catch(() => {})` ile yükleniyordu: hata yutuluyor,
// liste boş kalıyordu. Kullanıcı için "bu bölgede istasyon yok" ile
// "sunucuya ulaşılamıyor" aynı görünüyordu — ikisi de boş harita.
// Bu fonksiyon farkı tek cümlede söyler.
export function describeLayerError(katmanAdi, err) {
  // ApiError kendi kullanıcı mesajını taşır (ağ / 502 / 404 ayrımı yapılmış).
  // Başka bir hata türü geldiyse ayrıntısını göstermek anlamsız, genel metin yeterli.
  const sebep = err?.userMessage || "veri alınamadı";
  return `${katmanAdi} yüklenemedi — ${sebep}`;
}
