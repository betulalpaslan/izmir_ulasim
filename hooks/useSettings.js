import { useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";

export const ALL_PROFILES = [
  { id: "bicycle", icon: "bike", label: "Bisiklet", color: "#4ade80" },
  { id: "car",     icon: "car",  label: "Araba",    color: "#f97316" },
  { id: "transit", icon: "bus",  label: "Transit",  color: "#60a5fa" },
];

const SAVED_PLACES_DEFAULT = [
  { id: "home",   icon: "home",    label: "Ev",         address: null },
  { id: "school", icon: "student", label: "Okul",       address: null },
  { id: "work",   icon: "work",    label: "İş",         address: null },
  { id: "shop",   icon: "shop",    label: "Alışveriş",  address: null },
];

export function useSettings() {
  const [fareBase, setFareBase] = useState(35);
  const [farePerBoarding, setFarePerBoarding] = useState(false);
  const [profiles, setProfiles] = useState(ALL_PROFILES);
  const [savedPlaces, setSavedPlaces] = useState(SAVED_PLACES_DEFAULT);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const placesRaw = await AsyncStorage.getItem("savedPlaces");
          if (placesRaw) setSavedPlaces(JSON.parse(placesRaw));

          const prefsRaw = await AsyncStorage.getItem("userPrefs");
          if (!prefsRaw) return;
          const prefs = JSON.parse(prefsRaw);

          setFareBase(prefs.fareBase ?? 35);
          setFarePerBoarding(prefs.farePerBoarding ?? false);
          if (prefs.visibleProfiles) {
            const visible = ALL_PROFILES.filter((p) => prefs.visibleProfiles.includes(p.id));
            setProfiles(visible.length > 0 ? visible : ALL_PROFILES);
          }
        } catch {}
      })();
    }, [])
  );

  const savePlace = async (placeId, coord, name) => {
    const updated = savedPlaces.map((p) =>
      p.id === placeId ? { ...p, address: { coord, name } } : p
    );
    setSavedPlaces(updated);
    await AsyncStorage.setItem("savedPlaces", JSON.stringify(updated));
  };

  return { fareBase, farePerBoarding, profiles, savedPlaces, savePlace };
}
