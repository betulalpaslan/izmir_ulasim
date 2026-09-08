import AsyncStorage from "@react-native-async-storage/async-storage";

export const KAYITLI_YERLER_ANAHTARI = "savedPlaces";

export const KAYITLI_YERLER_VARSAYILAN = [
  { id: "home",   icon: "home",    label: "Ev",         address: null },
  { id: "school", icon: "student", label: "Okul",       address: null },
  { id: "work",   icon: "work",    label: "İş",         address: null },
  { id: "shop",   icon: "shop",    label: "Alışveriş",  address: null },
];

export function kayitliYerleriBirlestir(kayit) {
  if (!Array.isArray(kayit)) return KAYITLI_YERLER_VARSAYILAN;
  return KAYITLI_YERLER_VARSAYILAN.map((yer) => {
    const eski = kayit.find((k) => k?.id === yer.id);
    return eski?.address ? { ...yer, address: eski.address } : yer;
  });
}

export async function kayitliYerleriOku() {
  try {
    const raw = await AsyncStorage.getItem(KAYITLI_YERLER_ANAHTARI);
    return kayitliYerleriBirlestir(raw ? JSON.parse(raw) : null);
  } catch {
    return KAYITLI_YERLER_VARSAYILAN;
  }
}

export async function kayitliYerleriYaz(liste) {
  try {
    await AsyncStorage.setItem(KAYITLI_YERLER_ANAHTARI, JSON.stringify(liste));
    return true;
  } catch {
    return false;
  }
}
export function yeriAyarla(liste, placeId, address) {
  return liste.map((p) => (p.id === placeId ? { ...p, address } : p));
}
