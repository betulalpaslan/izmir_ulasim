const VURGULAR = {
  bike:    "#14a05a",
  car:     "#f97316",
  transit: "#6d3bf5",
};

export const themes = {
  dark: {
    mode: "dark",
    bg: "#14111f",
    surface: "#1e1a2e",
    panel: "#262038",
    input: "#14111f",
    border: "#322a4a",
    text: "#ece9f7",
    muted: "#9b93b8",
    subtle: "#4a4166",
    active: "#8b5cf6",
    danger: "#f87171",
    shadow: "#000000",
    statusBar: "light-content",

    accentBike:    "#34d15f",
    accentCar:     "#fb923c",
    accentTransit: "#8b5cf6",
    tintBike:    "rgba(52,209,95,0.16)",
    tintCar:     "rgba(251,146,60,0.16)",
    tintTransit: "rgba(139,92,246,0.18)",
  },
  light: {
    mode: "light",
    bg: "#f2effc",
    surface: "#ffffff",
    panel: "#f5f2fe",
    input: "#ffffff",
    border: "#e9e4f9",
    text: "#1d1a33",
    muted: "#7a739a",
    subtle: "#cdc2ef",
    active: VURGULAR.transit,
    danger: "#dc2626",
    shadow: "#4c3594",
    statusBar: "dark-content",

    accentBike:    VURGULAR.bike,
    accentCar:     VURGULAR.car,
    accentTransit: VURGULAR.transit,
    tintBike:    "rgba(20,160,90,0.12)",
    tintCar:     "rgba(249,115,22,0.13)",
    tintTransit: "rgba(109,59,245,0.11)",
  },
};

export const RADIUS = { card: 18, control: 12, pill: 999 };

export const getTheme = (mode) => themes[mode] || themes.dark;

export function temaSec(kayitli, cihaz) {
  if (kayitli === "light" || kayitli === "dark") return kayitli;
  return cihaz === "light" ? "light" : "dark";
}
