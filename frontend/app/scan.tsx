import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/src/api/client";
import { colors, spacing, radius } from "@/src/theme";

const MEALS = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
  { key: "snack", label: "Snack" },
];

type Analysis = {
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  servings: number;
};

export default function ScanScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const initialMode = params.mode === "barcode" ? "barcode" : "ai";
  const [mode, setMode] = useState<"ai" | "barcode">(initialMode);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Analysis | null>(null);
  const [meal, setMeal] = useState("breakfast");
  const [error, setError] = useState<string | null>(null);
  const scannedRef = useRef(false);

  useEffect(() => {
    if (!permission) return;
    if (!permission.granted) requestPermission();
  }, [permission, requestPermission]);

  const capture = async () => {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.5,
        skipProcessing: true,
      });
      if (!photo?.base64) throw new Error("No image captured");
      const analysis = await api<Analysis>("/ai/analyze-food", {
        method: "POST",
        body: JSON.stringify({ image_base64: photo.base64 }),
      });
      setResult(analysis);
    } catch (e: any) {
      setError(e?.message || "Analysis failed");
    } finally {
      setBusy(false);
    }
  };

  const onBarcode = async ({ data }: { data: string }) => {
    if (scannedRef.current || busy) return;
    scannedRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const info = await api<any>(`/barcode/${data}`);
      setResult({
        name: info.name,
        calories: info.calories,
        protein_g: info.protein_g,
        carbs_g: info.carbs_g,
        fat_g: info.fat_g,
        servings: 1,
      });
    } catch (e: any) {
      setError(e?.message || "Barcode not found");
      setTimeout(() => { scannedRef.current = false; }, 2000);
    } finally {
      setBusy(false);
    }
  };

  const saveMeal = async () => {
    if (!result) return;
    try {
      await api("/foods", {
        method: "POST",
        body: JSON.stringify({
          name: result.name,
          meal,
          calories: result.calories,
          protein_g: result.protein_g,
          carbs_g: result.carbs_g,
          fat_g: result.fat_g,
          servings: result.servings,
        }),
      });
      router.back();
    } catch (e) {
      console.warn(e);
    }
  };

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.centered}>
        <Ionicons name="camera-outline" size={48} color={colors.onSurfaceSecondary} />
        <Text style={styles.permText}>We need camera access to scan food and barcodes.</Text>
        <Pressable testID="grant-camera" onPress={requestPermission} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>Grant access</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} style={{ marginTop: spacing.md }}>
          <Text style={{ color: colors.onSurfaceSecondary }}>Cancel</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>
      <CameraView
        ref={(r) => { cameraRef.current = r; }}
        style={StyleSheet.absoluteFill}
        facing="back"
        {...(mode === "barcode"
          ? {
              barcodeScannerSettings: { barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "qr"] },
              onBarcodeScanned: onBarcode,
            }
          : {})}
      />

      <SafeAreaView style={{ flex: 1, justifyContent: "space-between" }}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable testID="close-scan" onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="close" size={22} color="#fff" />
          </Pressable>
          <View style={styles.segControl}>
            <Pressable
              testID="scan-mode-ai"
              onPress={() => { setMode("ai"); setResult(null); scannedRef.current = false; }}
              style={[styles.segItem, mode === "ai" && styles.segItemActive]}
            >
              <Text style={[styles.segText, mode === "ai" && styles.segTextActive]}>AI Scan</Text>
            </Pressable>
            <Pressable
              testID="scan-mode-barcode"
              onPress={() => { setMode("barcode"); setResult(null); scannedRef.current = false; }}
              style={[styles.segItem, mode === "barcode" && styles.segItemActive]}
            >
              <Text style={[styles.segText, mode === "barcode" && styles.segTextActive]}>Barcode</Text>
            </Pressable>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Reticle */}
        {!result && (
          <View style={styles.reticleWrap} pointerEvents="none">
            <View style={styles.reticle}>
              {["tl","tr","bl","br"].map((c) => (
                <View key={c} style={[styles.corner, styles[`corner_${c}` as keyof typeof styles] as any]} />
              ))}
            </View>
            <Text style={styles.hint}>
              {mode === "ai" ? "Point at your meal, then capture" : "Center the barcode in the frame"}
            </Text>
          </View>
        )}

        {/* Bottom sheet */}
        <View style={styles.sheet}>
          {error && <Text style={styles.error}>{error}</Text>}

          {result ? (
            <ScrollView>
              <Text style={styles.resultTitle} testID="ai-result-name">{result.name}</Text>
              <View style={styles.resultRow}>
                <ResultChip label="kcal" value={Math.round(result.calories)} />
                <ResultChip label="protein" value={`${Math.round(result.protein_g)}g`} />
                <ResultChip label="carbs" value={`${Math.round(result.carbs_g)}g`} />
                <ResultChip label="fat" value={`${Math.round(result.fat_g)}g`} />
              </View>
              <Text style={styles.label}>Add to</Text>
              <View style={styles.mealChips}>
                {MEALS.map((m) => (
                  <Pressable
                    key={m.key}
                    testID={`scan-meal-${m.key}`}
                    onPress={() => setMeal(m.key)}
                    style={[styles.mealChip, meal === m.key && styles.mealChipActive]}
                  >
                    <Text style={[styles.mealChipText, meal === m.key && { color: colors.brand }]}>{m.label}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.md }}>
                <Pressable
                  testID="scan-retry"
                  onPress={() => { setResult(null); scannedRef.current = false; setError(null); }}
                  style={[styles.secondaryBtn, { flex: 1 }]}
                >
                  <Text style={styles.secondaryBtnText}>Retry</Text>
                </Pressable>
                <Pressable testID="scan-save" onPress={saveMeal} style={[styles.primaryBtn, { flex: 2 }]}>
                  <Ionicons name="checkmark" size={20} color="#fff" />
                  <Text style={styles.primaryBtnText}>Add to log</Text>
                </Pressable>
              </View>
            </ScrollView>
          ) : mode === "ai" ? (
            <Pressable
              testID="capture-button"
              onPress={capture}
              disabled={busy}
              style={styles.captureBtn}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <View style={styles.captureInner} />}
            </Pressable>
          ) : (
            <View style={{ alignItems: "center" }}>
              {busy ? (
                <ActivityIndicator color={colors.brand} />
              ) : (
                <Text style={{ color: colors.onSurfaceSecondary }}>Scanning for barcode…</Text>
              )}
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

function ResultChip({ label, value }: { label: string; value: any }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipValue}>{value}</Text>
      <Text style={styles.chipLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  centered: { flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
  permText: { color: colors.onSurface, textAlign: "center", fontSize: 15 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  segControl: {
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: radius.pill,
    padding: 4,
  },
  segItem: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill },
  segItemActive: { backgroundColor: colors.brand },
  segText: { color: "#ddd", fontWeight: "600", fontSize: 13 },
  segTextActive: { color: "#fff" },
  reticleWrap: { alignItems: "center", justifyContent: "center", gap: spacing.md },
  reticle: { width: 260, height: 260 },
  corner: { position: "absolute", width: 32, height: 32, borderColor: colors.brand },
  corner_tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 12 },
  corner_tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 12 },
  corner_bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 12 },
  corner_br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 12 },
  hint: { color: "#fff", fontSize: 13, backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  sheet: {
    backgroundColor: "rgba(10,12,16,0.92)",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    minHeight: 180,
    maxHeight: "70%",
  },
  captureBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },
  captureInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.brand },
  error: { color: colors.error, textAlign: "center", marginBottom: spacing.sm },
  resultTitle: { color: colors.onSurface, fontSize: 22, fontWeight: "800", marginBottom: spacing.md },
  resultRow: { flexDirection: "row", gap: spacing.sm },
  chip: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipValue: { color: colors.onSurface, fontWeight: "800", fontSize: 16 },
  chipLabel: { color: colors.onSurfaceTertiary, fontSize: 11, marginTop: 2 },
  label: { color: colors.onSurfaceSecondary, marginTop: spacing.md, marginBottom: 6 },
  mealChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  mealChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  mealChipActive: { borderColor: colors.brand, backgroundColor: colors.brandTertiary },
  mealChipText: { color: colors.onSurfaceSecondary, fontWeight: "600", fontSize: 13 },
  primaryBtn: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand,
    paddingVertical: 14,
    borderRadius: radius.pill,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  secondaryBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
  },
  secondaryBtnText: { color: colors.onSurface, fontWeight: "700" },
});
