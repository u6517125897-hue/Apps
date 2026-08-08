import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable, Image } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { colors, spacing, radius } from "@/src/theme";
import CalorieRing from "@/src/components/CalorieRing";
import GlassCard from "@/src/components/GlassCard";

type Goals = {
  daily_calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  water_glasses: number;
};

type Totals = {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  calories_burned: number;
  water_glasses: number;
  meals_count: number;
};

type Food = {
  id: string;
  name: string;
  meal: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  servings: number;
};

const HERO_URL =
  "https://images.unsplash.com/photo-1534201640835-c6d455b79901?crop=entropy&cs=srgb&fm=jpg&w=1200&q=80";

export default function HomeScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [goals, setGoals] = useState<Goals | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [foods, setFoods] = useState<Food[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [g, s, f] = await Promise.all([
        api<Goals>("/goals"),
        api<{ totals: Totals }>("/summary/today"),
        api<Food[]>("/foods"),
      ]);
      setGoals(g);
      setTotals(s.totals);
      setFoods(f);
    } catch (e) {
      console.warn("home load", e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const calGoal = goals?.daily_calories ?? 2000;
  const calEaten = totals?.calories ?? 0;
  const calBurned = totals?.calories_burned ?? 0;
  const netRemaining = Math.max(0, calGoal - calEaten + calBurned);
  const progress = calGoal > 0 ? calEaten / calGoal : 0;

  const macros = [
    { key: "protein", label: "Protein", value: totals?.protein_g ?? 0, goal: goals?.protein_g ?? 0, color: "#FF8A6F" },
    { key: "carbs", label: "Carbs", value: totals?.carbs_g ?? 0, goal: goals?.carbs_g ?? 0, color: "#FBBF24" },
    { key: "fat", label: "Fat", value: totals?.fat_g ?? 0, goal: goals?.fat_g ?? 0, color: "#34D399" },
  ];

  const firstName = user?.name?.split(" ")[0] || "Athlete";

  return (
    <View style={styles.root} testID="home-screen">
      {/* Hero background */}
      <View style={styles.heroBg}>
        <Image source={{ uri: HERO_URL }} style={StyleSheet.absoluteFill} blurRadius={1} />
        <LinearGradient
          colors={["rgba(10,12,16,0.25)", "rgba(10,12,16,0.85)", colors.surface]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
        showsVerticalScrollIndicator={false}
      >
        <SafeAreaView edges={["left", "right"]} style={{ paddingHorizontal: spacing.xl }}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.hello}>Hey, {firstName}</Text>
              <Text style={styles.date}>
                {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
              </Text>
            </View>
            <View style={styles.streakPill}>
              <Ionicons name="flame" size={14} color={colors.brand} />
              <Text style={styles.streakText}>Day 1</Text>
            </View>
          </View>

          {/* Hero calorie card */}
          <GlassCard style={{ marginTop: spacing.xl }}>
            <View style={{ alignItems: "center" }}>
              <CalorieRing progress={progress}>
                <Text style={styles.ringLabel}>REMAINING</Text>
                <Text style={styles.ringValue} testID="calories-remaining">
                  {Math.round(netRemaining)}
                </Text>
                <Text style={styles.ringUnit}>kcal</Text>
              </CalorieRing>
              <View style={styles.ringStats}>
                <StatCol icon="restaurant" label="Eaten" value={Math.round(calEaten)} />
                <View style={styles.divider} />
                <StatCol icon="barbell" label="Burned" value={Math.round(calBurned)} />
                <View style={styles.divider} />
                <StatCol icon="trophy" label="Goal" value={calGoal} />
              </View>
            </View>
          </GlassCard>

          {/* Macros row */}
          <View style={styles.macroRow}>
            {macros.map((m) => {
              const p = m.goal > 0 ? Math.min(1, m.value / m.goal) : 0;
              return (
                <View key={m.key} style={styles.macroCard} testID={`macro-${m.key}`}>
                  <Text style={styles.macroLabel}>{m.label}</Text>
                  <Text style={styles.macroValue}>{Math.round(m.value)}g</Text>
                  <Text style={styles.macroGoal}>of {m.goal}g</Text>
                  <View style={styles.macroBarBg}>
                    <View style={[styles.macroBarFill, { width: `${p * 100}%`, backgroundColor: m.color }]} />
                  </View>
                </View>
              );
            })}
          </View>

          {/* Quick actions */}
          <View style={styles.quickRow}>
            <Pressable
              testID="scan-food-quick"
              onPress={() => router.push("/scan")}
              style={styles.quickCard}
            >
              <View style={[styles.quickIcon, { backgroundColor: colors.brandTertiary }]}>
                <Ionicons name="scan" size={20} color={colors.brand} />
              </View>
              <Text style={styles.quickTitle}>AI Scan</Text>
              <Text style={styles.quickSub}>Snap a meal</Text>
            </Pressable>
            <Pressable
              testID="log-food-quick"
              onPress={() => router.push("/(tabs)/log")}
              style={styles.quickCard}
            >
              <View style={[styles.quickIcon, { backgroundColor: "rgba(52,211,153,0.12)" }]}>
                <Ionicons name="add" size={22} color={colors.success} />
              </View>
              <Text style={styles.quickTitle}>Log Food</Text>
              <Text style={styles.quickSub}>Manual entry</Text>
            </Pressable>
            <Pressable
              testID="log-workout-quick"
              onPress={() => router.push("/(tabs)/profile")}
              style={styles.quickCard}
            >
              <View style={[styles.quickIcon, { backgroundColor: "rgba(251,191,36,0.12)" }]}>
                <Ionicons name="barbell" size={20} color={colors.warning} />
              </View>
              <Text style={styles.quickTitle}>Workout</Text>
              <Text style={styles.quickSub}>Burn calories</Text>
            </Pressable>
          </View>

          {/* Today's meals */}
          <Text style={styles.sectionTitle}>Today's meals</Text>
          {foods.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="restaurant-outline" size={28} color={colors.onSurfaceTertiary} />
              <Text style={styles.emptyText}>No meals yet. Tap "Log" to add your first entry.</Text>
            </View>
          ) : (
            foods.map((f) => (
              <View key={f.id} style={styles.mealRow} testID={`meal-row-${f.id}`}>
                <View style={styles.mealIcon}>
                  <Ionicons name={mealIcon(f.meal)} size={18} color={colors.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.mealName} numberOfLines={1}>
                    {f.name}
                  </Text>
                  <Text style={styles.mealMeta}>
                    {capitalize(f.meal)} · {Math.round(f.calories * (f.servings || 1))} kcal
                  </Text>
                </View>
                <Text style={styles.mealMacro}>
                  P{Math.round(f.protein_g * (f.servings || 1))}
                </Text>
              </View>
            ))
          )}
        </SafeAreaView>
      </ScrollView>
    </View>
  );
}

function mealIcon(meal: string): any {
  switch (meal) {
    case "breakfast":
      return "sunny";
    case "lunch":
      return "restaurant";
    case "dinner":
      return "moon";
    default:
      return "cafe";
  }
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function StatCol({ icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <Ionicons name={icon} size={16} color={colors.onSurfaceSecondary} />
      <Text style={{ color: colors.onSurface, fontWeight: "700", marginTop: 4 }}>{value}</Text>
      <Text style={{ color: colors.onSurfaceTertiary, fontSize: 11 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  heroBg: { position: "absolute", top: 0, left: 0, right: 0, height: 380 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  hello: { color: colors.onSurface, fontSize: 24, fontWeight: "700" },
  date: { color: colors.onSurfaceSecondary, marginTop: 2, fontSize: 13 },
  streakPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.brandTertiary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  streakText: { color: colors.onBrandTertiary, fontWeight: "700", fontSize: 12 },
  ringLabel: { color: colors.onSurfaceTertiary, fontSize: 11, letterSpacing: 2 },
  ringValue: { color: colors.onSurface, fontSize: 44, fontWeight: "800", marginTop: 2 },
  ringUnit: { color: colors.onSurfaceSecondary, fontSize: 12 },
  ringStats: {
    flexDirection: "row",
    marginTop: spacing.lg,
    width: "100%",
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm,
  },
  divider: { width: 1, height: 30, backgroundColor: colors.border },
  macroRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  macroCard: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  macroLabel: { color: colors.onSurfaceSecondary, fontSize: 12 },
  macroValue: { color: colors.onSurface, fontSize: 20, fontWeight: "700", marginTop: 2 },
  macroGoal: { color: colors.onSurfaceTertiary, fontSize: 11 },
  macroBarBg: {
    height: 4,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: 2,
    marginTop: 8,
    overflow: "hidden",
  },
  macroBarFill: { height: "100%", borderRadius: 2 },
  quickRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  quickCard: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  quickTitle: { color: colors.onSurface, fontWeight: "700", fontSize: 14 },
  quickSub: { color: colors.onSurfaceTertiary, fontSize: 11, marginTop: 2 },
  sectionTitle: {
    color: colors.onSurface,
    fontSize: 18,
    fontWeight: "700",
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  emptyCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.xl,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  emptyText: { color: colors.onSurfaceSecondary, textAlign: "center" },
  mealRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mealIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  mealName: { color: colors.onSurface, fontWeight: "700", fontSize: 14 },
  mealMeta: { color: colors.onSurfaceSecondary, fontSize: 12, marginTop: 2 },
  mealMacro: { color: colors.brand, fontWeight: "700", fontSize: 13 },
});
