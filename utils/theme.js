export const themes = {
  dark: {
    mode: "dark",
    bg: "#0f1117",
    surface: "#181c25",
    panel: "#1e2330",
    input: "#0f1117",
    border: "#2a2f3d",
    text: "#e8eaf0",
    muted: "#7a8299",
    subtle: "#3a3f4d",
    active: "#60a5fa",
    danger: "#f87171",
    shadow: "#000000",
    statusBar: "light-content",
  },
  light: {
    mode: "light",
    bg: "#f5f7fb",
    surface: "#ffffff",
    panel: "#eef2f7",
    input: "#ffffff",
    border: "#d8dee9",
    text: "#172033",
    muted: "#687386",
    subtle: "#a0a8b8",
    active: "#2563eb",
    danger: "#dc2626",
    shadow: "#1f2937",
    statusBar: "dark-content",
  },
};

export const getTheme = (mode) => themes[mode] || themes.dark;
