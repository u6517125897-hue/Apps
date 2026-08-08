import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { api } from "@/src/api/client";
import { colors, spacing, radius } from "@/src/theme";

const MEALS = [
  { key: "breakfast", label: "Breakfast", icon: "sunny" as const },
  { key: "lunch", label: "Lunch", icon: "restaurant" as const },
  { key: "dinner", label: "Dinner", icon: "moon" as const },
  { key: "snack", label: "Snack", icon: "cafe" as const },
];

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

export default function LogScreen() {
  const router = useRouter();
  const [meal, setMeal] = useState("breakfast");
  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [servings, setServings] = useState("1");
  const [saving, setSaving] = useState(false);
  const [today, setToday] = useState<Food[]>([]);

  const loadToday = useCallback(async () => {
    try {
      const list = await api<Food[]>("/foods");
      setToday(list);
    } catch (e) {
      console.warn(e);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadToday();
  }, [loadToday]));

  const submit = async () => {
    if (!name.trim() || !calories) return;
    setSaving(true);
    try {
      await api("/foods", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          meal,
          calories: parseFloat(calories) || 0,
          protein_g: parseFloat(protein) || 0,
          carbs_g: parseFloat(carbs) || 0,
          fat_g: parseFloat(fat) || 0,
          servings: parseFloat(servings) || 1,
        }),
      });
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setName("");
      setCalories("");
      setProtein("");
      setCarbs("");
      setFat("");
      setServings("1");
      await loadToday();
    } catch (e) {
      console.warn(e);
    } finally {
      setSaving(false);
    }
  };

  const deleteFood = async (id: string) => {
    try {
      await api(`/foods/${id}`, { method: "DELETE" });
      await loadToday();
    } catch (e) {
      console.warn(e);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing.xl, paddingBottom: 140 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Log a meal</Text>
          <Text style={styles.subtitle}>Scan, search or enter manually.</Text>

          <View style={styles.actionRow}>
            <Pressable
              testID="open-ai-scan"
              onPress={() => router.push("/scan")}
              style={[styles.action, { backgroundColor: colors.brand }]}
            >
              <Ionicons name="scan" size={20} color="#fff" />
              <Text style={styles.actionText}>AI Camera</Text>
            </Pressable>
            <Pressable
              testID="open-barcode"
              onPress={() => router.push({ pathname: "/scan", params: { mode: "barcode" } })}
              style={styles.actionSecondary}
            >
              <Ionicons name="barcode" size={20} color={colors.brand} />
              <Text style={[styles.actionText, { color: colors.onSurface }]}>Barcode</Text>
            </Pressable>
          </View>

          {/* Meal picker */}
          <Text style={styles.label}>Meal</Text>
          <View style={styles.mealRow}>
            {MEALS.map((m) => (
              <Pressable
                key={m.key}
                testID={`meal-chip-${m.key}`}
                onPress={() => setMeal(m.key)}
                style={[styles.mealChip, meal === m.key && styles.mealChipActive]}
              >
                <Ionicons
                  name={m.icon}
                  size={14}
                  color={meal === m.key ? colors.brand : colors.onSurfaceSecondary}
                />
                <Text style={[styles.mealChipText, meal === m.key && { color: colors.brand }]}>{m.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Form */}
          <Text style={styles.label}>Food name</Text>
          <TextInput
            testID="food-name-input"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Grilled chicken breast"
            placeholderTextColor={colors.onSurfaceTertiary}
            style={styles.input}
          />

          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Calories</Text>
              <TextInput
                testID="food-cal-input"
                value={calories}
                onChangeText={setCalories}
                keyboardType="numeric"
                placeholder="250"
                placeholderTextColor={colors.onSurfaceTertiary}
                style={styles.input}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Servings</Text>
              <TextInput
                value={servings}
                onChangeText={setServings}
                keyboardType="numeric"
                placeholder="1"
                placeholderTextColor={colors.onSurfaceTertiary}
                style={styles.input}
              />
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Protein (g)</Text>
              <TextInput
                value={protein}
                onChangeText={setProtein}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.onSurfaceTertiary}
                style={styles.input}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Carbs (g)</Text>
              <TextInput
                value={carbs}
                onChangeText={setCarbs}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.onSurfaceTertiary}
                style={styles.input}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Fat (g)</Text>
              <TextInput
                value={fat}
                onChangeText={setFat}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.onSurfaceTertiary}
                style={styles.input}
              />
            </View>
          </View>

          <Pressable
            testID="save-food-button"
            onPress={submit}
            disabled={saving || !name || !calories}
            style={({ pressed }) => [
              styles.saveBtn,
              (saving || !name || !calories) && { opacity: 0.5 },
              pressed && { opacity: 0.85 },
            ]}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={styles.saveText}>Add to today</Text>
              </>
            )}
          </Pressable>

          <Text style={[styles.sectionTitle]}>Today's log ({today.length})</Text>
          {today.length === 0 && (
            <Text style={{ color: colors.onSurfaceTertiary, marginTop: 4 }}>Nothing logged yet.</Text>
          )}
          {today.map((f) => (
            <View key={f.id} style={styles.todayRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.todayName} numberOfLines={1}>
                  {f.name}
                </Text>
                <Text style={styles.todayMeta}>
                  {f.meal} · {Math.round(f.calories * (f.servings || 1))} kcal · P{Math.round(f.protein_g * (f.servings || 1))} C{Math.round(f.carbs_g * (f.servings || 1))} F{Math.round(f.fat_g * (f.servings || 1))}
                </Text>
              </View>
              <Pressable
                testID={`delete-food-${f.id}`}
                onPress={() => deleteFood(f.id)}
                hitSlop={10}
                style={styles.deleteBtn}
              >
                <Ionicons name="trash-outline" size={18} color={colors.error} />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  title: { color: colors.onSurface, fontSize: 28, fontWeight: "800" },
  subtitle: { color: colors.onSurfaceSecondary, marginTop: 4, marginBottom: spacing.lg },
  actionRow: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.lg },
  action: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.md,
  },
  actionSecondary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  actionText: { color: "#fff", fontWeight: "700" },
  label: { color: colors.onSurfaceSecondary, fontSize: 12, marginTop: spacing.md, marginBottom: 6, letterSpacing: 0.5 },
  input: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.onSurface,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 15,
  },
  mealRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  mealChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  mealChipActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandTertiary,
  },
  mealChipText: { color: colors.onSurfaceSecondary, fontSize: 13, fontWeight: "600" },
  saveBtn: {
    marginTop: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.brand,
    paddingVertical: 16,
    borderRadius: radius.pill,
  },
  saveText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  sectionTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "700", marginTop: spacing.xl },
  todayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  todayName: { color: colors.onSurface, fontWeight: "700" },
  todayMeta: { color: colors.onSurfaceSecondary, fontSize: 12, marginTop: 2 },
  deleteBtn: { padding: 8 },
});
