import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import Svg, { Path, Circle, Defs, LinearGradient as SvgGradient, Stop } from "react-native-svg";
import { api } from "@/src/api/client";
import { colors, spacing, radius } from "@/src/theme";

type Weight = { id: string; weight_kg: number; date: string };

export default function ProgressScreen() {
  const [weights, setWeights] = useState<Weight[]>([]);
  const [glasses, setGlasses] = useState(0);
  const [waterGoal, setWaterGoal] = useState(8);
  const [newWeight, setNewWeight] = useState("");

  const load = useCallback(async () => {
    try {
      const [w, water, goals] = await Promise.all([
        api<Weight[]>("/weight"),
        api<{ glasses: number }>("/water"),
        api<{ water_glasses: number }>("/goals"),
      ]);
      setWeights(w);
      setGlasses(water.glasses || 0);
      setWaterGoal(goals.water_glasses || 8);
    } catch (e) {
      console.warn(e);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const addWeight = async () => {
    const val = parseFloat(newWeight);
    if (!val || val <= 0) return;
    try {
      await api("/weight", { method: "POST", body: JSON.stringify({ weight_kg: val }) });
      setNewWeight("");
      await load();
    } catch (e) {
      console.warn(e);
    }
  };

  const addGlass = async (delta: number) => {
    try {
      const r = await api<{ glasses: number }>(`/water/increment?delta=${delta}`, { method: "POST" });
      setGlasses(r.glasses);
      if (delta > 0 && Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (e) {
      console.warn(e);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 140 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Progress</Text>
          <Text style={styles.subtitle}>Weight & hydration</Text>

          {/* Weight Chart */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.cardTitle}>Weight</Text>
                <Text style={styles.cardSubtitle}>
                  {weights.length > 0
                    ? `Latest: ${weights[weights.length - 1].weight_kg.toFixed(1)} kg`
                    : "No entries yet"}
                </Text>
              </View>
              <Ionicons name="trending-up" size={20} color={colors.brand} />
            </View>
            <WeightChart data={weights} />
          </View>

          <View style={styles.inputRow}>
            <TextInput
              testID="weight-input"
              value={newWeight}
              onChangeText={setNewWeight}
              keyboardType="numeric"
              placeholder="Today's weight (kg)"
              placeholderTextColor={colors.onSurfaceTertiary}
              style={styles.input}
            />
            <Pressable testID="add-weight-button" onPress={addWeight} style={styles.addBtn}>
              <Ionicons name="add" size={22} color="#fff" />
            </Pressable>
          </View>

          {/* Water Tracker */}
          <View style={[styles.card, { marginTop: spacing.lg }]}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.cardTitle}>Water intake</Text>
                <Text style={styles.cardSubtitle}>Stay hydrated</Text>
              </View>
              <View style={styles.waterBadge}>
                <Ionicons name="water" size={14} color={colors.brand} />
                <Text style={styles.waterBadgeText}>{glasses} / {waterGoal}</Text>
              </View>
            </View>
            <View style={styles.glassesRow}>
              {Array.from({ length: waterGoal }).map((_, i) => {
                const filled = i < glasses;
                return (
                  <Pressable
                    key={i}
                    testID={`glass-${i}`}
                    onPress={() => addGlass(filled ? -1 : 1)}
                    style={styles.glassCell}
                  >
                    <Ionicons
                      name={filled ? "water" : "water-outline"}
                      size={26}
                      color={filled ? colors.brand : colors.onSurfaceTertiary}
                    />
                  </Pressable>
                );
              })}
            </View>
            <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.md }}>
              <Pressable testID="water-minus" onPress={() => addGlass(-1)} style={[styles.waterBtn, { backgroundColor: colors.surfaceTertiary }]}>
                <Ionicons name="remove" size={20} color={colors.onSurface} />
                <Text style={styles.waterBtnText}>Remove</Text>
              </Pressable>
              <Pressable testID="water-plus" onPress={() => addGlass(1)} style={[styles.waterBtn, { backgroundColor: colors.brand }]}>
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={[styles.waterBtnText, { color: "#fff" }]}>Add glass</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function WeightChart({ data }: { data: Weight[] }) {
  const width = Dimensions.get("window").width - spacing.xl * 2 - 32;
  const height = 160;
  const pad = 20;

  if (data.length === 0) {
    return (
      <View style={{ height, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: colors.onSurfaceTertiary }}>Add your first entry to see the chart.</Text>
      </View>
    );
  }

  const values = data.map((d) => d.weight_kg);
  const min = Math.min(...values) - 1;
  const max = Math.max(...values) + 1;
  const range = Math.max(0.1, max - min);

  const points = data.map((d, i) => {
    const x = pad + (i * (width - pad * 2)) / Math.max(1, data.length - 1);
    const y = pad + ((max - d.weight_kg) / range) * (height - pad * 2);
    return { x, y };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - pad} L ${points[0].x} ${height - pad} Z`;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <SvgGradient id="area" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.brand} stopOpacity="0.35" />
          <Stop offset="1" stopColor={colors.brand} stopOpacity="0" />
        </SvgGradient>
      </Defs>
      <Path d={areaPath} fill="url(#area)" />
      <Path d={linePath} stroke={colors.brand} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={3} fill={colors.brand} />
      ))}
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  title: { color: colors.onSurface, fontSize: 28, fontWeight: "800" },
  subtitle: { color: colors.onSurfaceSecondary, marginTop: 4, marginBottom: spacing.lg },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  cardTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "700" },
  cardSubtitle: { color: colors.onSurfaceSecondary, marginTop: 2, fontSize: 12 },
  inputRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.onSurface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addBtn: {
    width: 48,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  waterBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.brandTertiary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  waterBadgeText: { color: colors.onBrandTertiary, fontWeight: "700", fontSize: 12 },
  glassesRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: spacing.sm },
  glassCell: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  waterBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: radius.md,
  },
  waterBtnText: { color: colors.onSurface, fontWeight: "700" },
});
