export function describeLayerError(katmanAdi, err) {
  const sebep = err?.userMessage || "veri alınamadı";
  return `${katmanAdi} yüklenemedi — ${sebep}`;
}
