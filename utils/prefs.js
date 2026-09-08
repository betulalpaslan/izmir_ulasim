import { biletTarifesi, VARSAYILAN_BILET } from "./routeScoring";

export const TERCIH_ANAHTARI = "userPrefs";

// Profil sırası ekranda göründüğü sıra. Transit her zaman var — araç
// sahibi olmayan da toplu taşımayla gidiyor.
export const PROFIL_SIRASI = ["bicycle", "car", "transit"];

// Onboarding eskiden student/adult/senior yazıyordu, tarife tablosu
// tam/genc/… kimliklerini kullanıyor. Eşleşmeyen kimlik ayarlar ekranında
// hiçbir kartı seçili göstermiyordu; eski kurulumlar burada çevriliyor.
export const ESKI_YOLCU_TIPI = { student: "genc", adult: "tam", senior: "yas60" };

export function profilleriKur(hasVehicle) {
  return PROFIL_SIRASI.filter(
    (id) => id === "transit" || hasVehicle?.[id] === true
  );
}

export function tercihGovdesi({ hasVehicle, passengerType, onboardingDone = true } = {}) {
  const tarife = biletTarifesi(passengerType || VARSAYILAN_BILET);
  const araclar = {
    bicycle: hasVehicle?.bicycle === true,
    car: hasVehicle?.car === true,
  };
  return {
    hasVehicle: araclar,
    passengerType: tarife.id,
    fareBase: tarife.base,
    farePerBoarding: tarife.perBoarding,
    visibleProfiles: profilleriKur(araclar),
    onboardingDone: onboardingDone === true,
  };
}

export function tercihleriOku(raw) {
  let veri = raw;
  if (typeof raw === "string") {
    try { veri = JSON.parse(raw); } catch { veri = null; }
  }
  if (!veri || typeof veri !== "object" || Array.isArray(veri)) {
    return tercihGovdesi({ onboardingDone: false });
  }

  const kimlik = ESKI_YOLCU_TIPI[veri.passengerType] || veri.passengerType;
  const govde = tercihGovdesi({
    hasVehicle: veri.hasVehicle,
    passengerType: kimlik,
    onboardingDone: veri.onboardingDone === true,
  });

  const bilinenKimlik = biletTarifesi(kimlik).id === kimlik;
  if (!bilinenKimlik && typeof veri.fareBase === "number") {
    govde.fareBase = veri.fareBase;
    govde.farePerBoarding = veri.farePerBoarding === true;
  }
  if (Array.isArray(veri.visibleProfiles)) {
    const gecerli = veri.visibleProfiles.filter((id) => PROFIL_SIRASI.includes(id));
    if (gecerli.length > 0) govde.visibleProfiles = gecerli;
  }

  return govde;
}
