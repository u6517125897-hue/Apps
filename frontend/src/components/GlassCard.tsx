import React from "react";
import { View, StyleSheet, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { colors, radius } from "@/src/theme";

type Props = { children: React.ReactNode; style?: any; intensity?: number };

export default function GlassCard({ children, style, intensity = 30 }: Props) {
  return (
    <View style={[styles.wrap, style]}>
      <BlurView
        intensity={Platform.OS === "ios" ? intensity + 10 : intensity}
        tint="dark"
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, styles.tint]} />
      <View style={styles.inner}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  tint: { backgroundColor: "rgba(20,23,31,0.55)" },
  inner: { padding: 16 },
});
