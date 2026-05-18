import { View, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import AppIcon from "./AppIcon";
import { useTheme } from "../utils/ThemeContext";

export default function SearchBar({
  value, onChangeText, onFocus, placeholder,
  dotColor, rightIcon, onRightPress,
}) {
  const { theme } = useTheme();

  return (
    <View style={[
      s.row,
      { backgroundColor: theme.input, borderColor: theme.border },
      value ? { borderColor: dotColor + "60" } : null,
    ]}>
      <View style={[s.dot, { backgroundColor: dotColor }]} />
      <TextInput
        style={[s.input, { color: theme.text }]}
        placeholder={placeholder}
        placeholderTextColor={theme.muted}
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
      />
      {rightIcon ? (
        <TouchableOpacity onPress={onRightPress} style={s.iconBtn} activeOpacity={0.7}>
          <AppIcon name={rightIcon} size={18} color={theme.muted} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1,
    borderRadius: 9, paddingHorizontal: 10, paddingVertical: 1, marginBottom: 4,
  },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  input: { flex: 1, color: "#e8eaf0", fontSize: 13, fontWeight: "600", paddingVertical: 5 },
  iconBtn: { padding: 4 },
});
