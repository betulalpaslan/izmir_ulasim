import { useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { tercihleriOku, TERCIH_ANAHTARI } from "../utils/prefs";
import {
  KAYITLI_YERLER_VARSAYILAN, kayitliYerleriOku, kayitliYerleriYaz, yeriAyarla,
} from "../utils/savedPlaces";

export const ALL_PROFILES = [
  { id: "bicycle", icon: "bike", label: "Bisiklet", color: "#22c55e" },
  { id: "car",     icon: "car",  label: "Araba",    color: "#f97316" },
  { id: "transit", icon: "bus",  label: "Transit",  color: "#8b5cf6" },
];

export function useSettings() {
  const [fareBase, setFareBase] = useState(35);
  const [farePerBoarding, setFarePerBoarding] = useState(false);
  const [profiles, setProfiles] = useState(ALL_PROFILES);
  const [savedPlaces, setSavedPlaces] = useState(KAYITLI_YERLER_VARSAYILAN);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          setSavedPlaces(await kayitliYerleriOku());

          const prefsRaw = await AsyncStorage.getItem(TERCIH_ANAHTARI);
          if (!prefsRaw) return;
          // Alan adları ve varsayılanlar sözleşmede: burada `?? 35` gibi
          // ikinci bir varsayılan tutmuyoruz, ikisi ayrışabiliyordu.
          const prefs = tercihleriOku(prefsRaw);

          setFareBase(prefs.fareBase);
          setFarePerBoarding(prefs.farePerBoarding);
          const visible = ALL_PROFILES.filter((p) => prefs.visibleProfiles.includes(p.id));
          setProfiles(visible.length > 0 ? visible : ALL_PROFILES);
        } catch {}
      })();
    }, [])
  );

  // Yazma başarısızsa listeyi de güncellemiyoruz: kaydedilmemiş bir yer
  // ekranda kayıtlı görünüp uygulama yeniden açıldığında kayboluyordu.
  const savePlace = async (placeId, coord, name) => {
    const updated = yeriAyarla(savedPlaces, placeId, { coord, name });
    if (!(await kayitliYerleriYaz(updated))) return false;
    setSavedPlaces(updated);
    return true;
  };

  return { fareBase, farePerBoarding, profiles, savedPlaces, savePlace };
}
