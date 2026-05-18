import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import AppIcon from "./AppIcon";
import { useTheme } from "../utils/ThemeContext";

export default function ProfileTabs({ profiles, activeProfile, onSelect }) {
  const { theme } = useTheme();

  return (
    <View style={s.bar}>
      {profiles.map((p) => {
        const active = activeProfile === p.id;
        return (
          <TouchableOpacity
            key={p.id}
            style={[
              s.tab,
              { backgroundColor: theme.input, borderColor: theme.border },
              active && { borderColor: p.color, backgroundColor: p.color + "18" },
            ]}
            onPress={() => onSelect(p.id)}
            activeOpacity={0.75}
          >
            <AppIcon name={p.icon} size={13} color={active ? p.color : theme.muted} />
            <Text style={[s.label, { color: theme.muted }, active && { color: p.color }]}>{p.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: "row", gap: 4, marginBottom: 8 },
  tab: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 4, borderWidth: 1,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, flex: 1,
  },
  label: { fontSize: 11, fontWeight: "700" },
});
