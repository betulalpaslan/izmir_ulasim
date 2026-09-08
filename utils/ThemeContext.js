import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getTheme, temaSec } from "./theme";

const ThemeContext = createContext(null);

export const TEMA_ANAHTARI = "themeMode";

export function ThemeProvider({ children }) {
  const cihazTemasi = useColorScheme();
  const [kayitli, setKayitli] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(TEMA_ANAHTARI);
        if (saved === "light" || saved === "dark") setKayitli(saved);
      } catch {}
    })();
  }, []);

  const mode = temaSec(kayitli, cihazTemasi);

  const setThemeMode = async (nextMode) => {
    setKayitli(nextMode);
    try {
      await AsyncStorage.setItem(TEMA_ANAHTARI, nextMode);
    } catch {}
  };

  const value = useMemo(
    () => ({
      mode,
      theme: getTheme(mode),
      isDark: mode === "dark",
      setThemeMode,
    }),
    [mode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside ThemeProvider");
  return value;
}
