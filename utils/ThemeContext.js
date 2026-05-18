import { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getTheme } from "./theme";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState("dark");

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem("themeMode");
        if (saved === "light" || saved === "dark") setMode(saved);
      } catch {}
    })();
  }, []);

  const setThemeMode = async (nextMode) => {
    setMode(nextMode);
    try {
      await AsyncStorage.setItem("themeMode", nextMode);
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
