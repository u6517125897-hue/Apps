import { View, Text, StyleSheet, Pressable, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/src/context/AuthContext";
import { colors, spacing, radius } from "@/src/theme";

export default function LoginScreen() {
  const { signIn } = useAuth();

  return (
    <View style={styles.root}>
      <Image
        source={{
          uri: "https://images.unsplash.com/photo-1534201640835-c6d455b79901?crop=entropy&cs=srgb&fm=jpg&w=1200&q=80",
        }}
        style={StyleSheet.absoluteFill}
        blurRadius={2}
      />
      <LinearGradient
        colors={["rgba(10,12,16,0.4)", "rgba(10,12,16,0.85)", colors.surface]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safe}>
        <View style={styles.top}>
          <View style={styles.badge}>
            <Ionicons name="flame" size={16} color={colors.brand} />
            <Text style={styles.badgeText}>MACROLENS</Text>
          </View>
        </View>

        <View style={styles.center}>
          <Text style={styles.headline}>Track every calorie.</Text>
          <Text style={styles.headline}>Own every workout.</Text>
          <Text style={styles.sub}>
            AI-powered food scanning, macro tracking and progress charts — built for the way you train.
          </Text>
        </View>

        <View style={styles.bottom}>
          <Pressable
            testID="google-signin-button"
            onPress={signIn}
            style={({ pressed }) => [styles.googleBtn, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name="logo-google" size={20} color="#fff" />
            <Text style={styles.googleText}>Continue with Google</Text>
          </Pressable>
          <Text style={styles.terms}>By continuing you agree to our Terms & Privacy Policy.</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  safe: { flex: 1, paddingHorizontal: spacing.xl, justifyContent: "space-between" },
  top: { paddingTop: spacing.lg, alignItems: "flex-start" },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(20,23,31,0.6)",
  },
  badgeText: { color: colors.onSurface, fontSize: 11, letterSpacing: 2, fontWeight: "600" },
  center: { flex: 1, justifyContent: "center" },
  headline: {
    color: colors.onSurface,
    fontSize: 34,
    fontWeight: "700",
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  sub: {
    color: colors.onSurfaceSecondary,
    marginTop: spacing.lg,
    fontSize: 15,
    lineHeight: 22,
  },
  bottom: { paddingBottom: spacing.lg, gap: spacing.md },
  googleBtn: {
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  googleText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  terms: {
    color: colors.onSurfaceTertiary,
    fontSize: 12,
    textAlign: "center",
  },
});
