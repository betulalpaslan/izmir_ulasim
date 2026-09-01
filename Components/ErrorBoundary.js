import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <View style={s.container}>
          <Text style={s.title}>HATA MESAJI</Text>
          <ScrollView>
            <Text style={s.message}>{this.state.error?.toString()}</Text>
            <Text style={s.stack}>{this.state.error?.stack}</Text>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#14111f", padding: 20, paddingTop: 60 },
  title: { color: "#f87171", fontSize: 16, fontWeight: "800", marginBottom: 16 },
  message: { color: "#ffffff", fontSize: 14, marginBottom: 12, lineHeight: 22 },
  stack: { color: "#9b93b8", fontSize: 11, lineHeight: 18 },
});
