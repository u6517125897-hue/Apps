import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/context/AuthContext";
import { colors, spacing, radius } from "@/src/theme";

type Goals = {
  daily_calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  water_glasses: number;
  target_weight_kg: number | null;
};

type Workout = {
  id: string;
  name: string;
  duration_min: number;
  calories_burned: number;
  date: string;
};

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [goals, setGoals] = useState<Goals | null>(null);
  const [saving, setSaving] = useState(false);
  const [workouts, setWorkouts] = useState<Workout[]>([]);

  // workout form
  const [wName, setWName] = useState("");
  const [wDuration, setWDuration] = useState("");
  const [wBurn, setWBurn] = useState("");

  const load = useCallback(async () => {
    try {
      const [g, w] = await Promise.all([
        api<Goals>("/goals"),
        api<Workout[]>("/workouts"),
      ]);
      setGoals(g);
      setWorkouts(w);
    } catch (e) {
      console.warn(e);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const updateGoal = (key: keyof Goals, value: string) => {
    if (!goals) return;
    const num = value === "" ? 0 : parseFloat(value);
    setGoals({ ...goals, [key]: isNaN(num) ? 0 : num } as Goals);
  };

  const saveGoals = async () => {
    if (!goals) return;
    setSaving(true);
    try {
      await api("/goals", { method: "PUT", body: JSON.stringify(goals) });
    } catch (e) {
      console.warn(e);
    } finally {
      setSaving(false);
    }
  };

  const addWorkout = async () => {
    if (!wName || !wDuration || !wBurn) return;
    try {
      await api("/workouts", {
        method: "POST",
        body: JSON.stringify({
          name: wName.trim(),
          duration_min: parseInt(wDuration) || 0,
          calories_burned: parseFloat(wBurn) || 0,
        }),
      });
      setWName("");
      setWDuration("");
      setWBurn("");
      await load();
    } catch (e) {
      console.warn(e);
    }
  };

  const deleteWorkout = async (id: string) => {
    try {
      await api(`/workouts/${id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      console.warn(e);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 140 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            {user?.picture ? (
              <Image source={{ uri: user.picture }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitials}>{(user?.name || "?").slice(0, 1).toUpperCase()}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>{user?.name || "Athlete"}</Text>
              <Text style={styles.email} numberOfLines={1}>{user?.email || ""}</Text>
            </View>
            <Pressable testID="logout-button" onPress={signOut} hitSlop={12} style={styles.logoutBtn}>
              <Ionicons name="log-out-outline" size={22} color={colors.error} />
            </Pressable>
          </View>

          {/* Goals */}
          <Text style={styles.sectionTitle}>Daily goals</Text>
          {goals && (
            <View style={styles.card}>
              <GoalRow icon="flame" label="Calories (kcal)" value={goals.daily_calories.toString()} onChange={(v) => updateGoal("daily_calories", v)} testID="goal-calories" />
              <GoalRow icon="barbell" label="Protein (g)" value={goals.protein_g.toString()} onChange={(v) => updateGoal("protein_g", v)} testID="goal-protein" />
              <GoalRow icon="leaf" label="Carbs (g)" value={goals.carbs_g.toString()} onChange={(v) => updateGoal("carbs_g", v)} testID="goal-carbs" />
              <GoalRow icon="water" label="Fat (g)" value={goals.fat_g.toString()} onChange={(v) => updateGoal("fat_g", v)} testID="goal-fat" />
              <GoalRow icon="cafe" label="Water (glasses)" value={goals.water_glasses.toString()} onChange={(v) => updateGoal("water_glasses", v)} testID="goal-water" />
              <GoalRow icon="trophy" label="Target weight (kg)" value={(goals.target_weight_kg ?? "").toString()} onChange={(v) => updateGoal("target_weight_kg", v)} testID="goal-target-weight" />
              <Pressable testID="save-goals-button" onPress={saveGoals} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.6 }]}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save goals</Text>}
              </Pressable>
            </View>
          )}

          {/* Workouts */}
          <Text style={styles.sectionTitle}>Log a workout</Text>
          <View style={styles.card}>
            <TextInput
              testID="workout-name-input"
              value={wName}
              onChangeText={setWName}
              placeholder="e.g. Morning run"
              placeholderTextColor={colors.onSurfaceTertiary}
              style={styles.input}
            />
            <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.sm }}>
              <TextInput
                testID="workout-duration-input"
                value={wDuration}
                onChangeText={setWDuration}
                keyboardType="numeric"
                placeholder="Minutes"
                placeholderTextColor={colors.onSurfaceTertiary}
                style={[styles.input, { flex: 1 }]}
              />
              <TextInput
                testID="workout-burn-input"
                value={wBurn}
                onChangeText={setWBurn}
                keyboardType="numeric"
                placeholder="kcal burned"
                placeholderTextColor={colors.onSurfaceTertiary}
                style={[styles.input, { flex: 1 }]}
              />
            </View>
            <Pressable
              testID="add-workout-button"
              onPress={addWorkout}
              disabled={!wName || !wDuration || !wBurn}
              style={[styles.saveBtn, (!wName || !wDuration || !wBurn) && { opacity: 0.5 }]}
            >
              <Text style={styles.saveText}>Add workout</Text>
            </Pressable>
          </View>

          {workouts.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Recent workouts</Text>
              {workouts.slice(0, 10).map((w) => (
                <View key={w.id} style={styles.workoutRow}>
                  <View style={styles.workoutIcon}>
                    <Ionicons name="barbell" size={18} color={colors.brand} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.workoutName}>{w.name}</Text>
                    <Text style={styles.workoutMeta}>{w.duration_min} min · {Math.round(w.calories_burned)} kcal · {w.date}</Text>
                  </View>
                  <Pressable testID={`delete-workout-${w.id}`} onPress={() => deleteWorkout(w.id)} hitSlop={10} style={{ padding: 8 }}>
                    <Ionicons name="trash-outline" size={18} color={colors.error} />
                  </Pressable>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function GoalRow({
  icon,
  label,
  value,
  onChange,
  testID,
}: {
  icon: any;
  label: string;
  value: string;
  onChange: (v: string) => void;
  testID?: string;
}) {
  return (
    <View style={styles.goalRow}>
      <View style={styles.goalIcon}>
        <Ionicons name={icon} size={16} color={colors.brand} />
      </View>
      <Text style={styles.goalLabel}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChange}
        keyboardType="numeric"
        style={styles.goalInput}
        placeholderTextColor={colors.onSurfaceTertiary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: { color: colors.brand, fontSize: 24, fontWeight: "800" },
  name: { color: colors.onSurface, fontSize: 18, fontWeight: "700" },
  email: { color: colors.onSurfaceSecondary, fontSize: 13, marginTop: 2 },
  logoutBtn: {
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: "rgba(248,113,113,0.1)",
  },
  sectionTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "700", marginTop: spacing.xl, marginBottom: spacing.md },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  goalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  goalIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  goalLabel: { color: colors.onSurface, flex: 1, fontSize: 14 },
  goalInput: {
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.onSurface,
    minWidth: 80,
    textAlign: "right",
  },
  saveBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.brand,
    paddingVertical: 14,
    borderRadius: radius.pill,
    alignItems: "center",
  },
  saveText: { color: "#fff", fontWeight: "700" },
  input: {
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.onSurface,
  },
  workoutRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  workoutIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  workoutName: { color: colors.onSurface, fontWeight: "700" },
  workoutMeta: { color: colors.onSurfaceSecondary, fontSize: 12, marginTop: 2 },
});
