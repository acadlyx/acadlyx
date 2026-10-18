import React, { useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { colors, radius, spacing } from "../ui/theme";

export function LoginScreen() {
  const { signIn, verifyMfa } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!challenge && (!identifier.trim() || !password)) {
      setError("Enter your institutional login and password.");
      return;
    }
    if (challenge && !code.trim()) { setError("Enter the verification code."); return; }
    setBusy(true); setError("");
    try {
      if (challenge) await verifyMfa(challenge, code);
      else {
        const result = await signIn(identifier, password);
        if (result.mfaRequired) setChallenge(result.challengeToken);
      }
    } catch (issue) {
      setError(issue instanceof ApiError ? issue.message : issue instanceof Error ? issue.message : "Sign-in failed. Check your details and try again.");
    } finally { setBusy(false); }
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Image source={require("../../assets/acadlyx-logo.png")} style={styles.brandLogo} resizeMode="contain" accessibilityLabel="ACADLYX logo" />
        <Text style={styles.subtitle}>Education ERP & Institutional Intelligence</Text>
        <View style={styles.panel}>
          <Text style={styles.heading}>{challenge ? "Verify your identity" : "Welcome back"}</Text>
          <Text style={styles.description}>{challenge ? "Enter the verification code from your authenticator." : "Sign in with the account issued by your institution."}</Text>
          {!challenge ? <>
            <Text style={styles.label}>Institutional email or login ID</Text>
            <TextInput value={identifier} onChangeText={setIdentifier} autoCapitalize="none" autoCorrect={false} autoComplete="username" keyboardType="email-address" placeholder="Email or login ID" placeholderTextColor={colors.textMuted} style={styles.input} editable={!busy} accessibilityLabel="Institutional email or login ID" />
            <Text style={styles.label}>Password</Text>
            <TextInput value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" placeholder="Password" placeholderTextColor={colors.textMuted} style={styles.input} editable={!busy} accessibilityLabel="Password" onSubmitEditing={submit} returnKeyType="go" />
          </> : <>
            <Text style={styles.label}>Verification code</Text>
            <TextInput value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" placeholder="Enter code" placeholderTextColor={colors.textMuted} style={styles.input} editable={!busy} accessibilityLabel="Multi-factor authentication code" onSubmitEditing={submit} returnKeyType="go" />
          </>}
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <Pressable accessibilityRole="button" disabled={busy} onPress={submit} style={({ pressed }) => [styles.button, pressed && !busy ? styles.buttonPressed : null, busy ? styles.disabled : null]}>
            {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>{challenge ? "Verify and continue" : "Sign in securely"}</Text>}
          </Pressable>
          {challenge ? <Pressable onPress={() => { setChallenge(null); setCode(""); setError(""); }} style={styles.secondary}><Text style={styles.secondaryText}>Back to sign in</Text></Pressable> :
            <Text style={styles.help}>For password recovery, contact your institution administrator. A recovery action was not available in the inspected backend auth routes.</Text>}
        </View>
        <Text style={styles.footer}>Designed and maintained by Ayzent Solutions</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  content: { flexGrow: 1, justifyContent: "center", padding: spacing.xl, paddingTop: 44, paddingBottom: 26 },
  brandLogo: { width: 180, height: 100, alignSelf: "center", marginBottom: 6 },
  subtitle: { marginTop: 7, marginBottom: 28, textAlign: "center", color: colors.textMuted, fontSize: 13 },
  panel: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, borderRadius: radius.lg },
  heading: { fontSize: 24, fontWeight: "800", color: colors.text },
  description: { color: colors.textMuted, fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 20 },
  label: { color: colors.text, fontWeight: "700", fontSize: 13, marginBottom: 7, marginTop: 12 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 13, color: colors.text, fontSize: 16 },
  button: { minHeight: 50, alignItems: "center", justifyContent: "center", padding: 14, backgroundColor: colors.primary, borderRadius: radius.md, marginTop: 22 },
  buttonPressed: { backgroundColor: colors.primaryPressed }, disabled: { opacity: 0.65 },
  buttonText: { color: colors.white, fontSize: 15, fontWeight: "800" },
  secondary: { alignItems: "center", padding: 13, marginTop: 8 }, secondaryText: { color: colors.primary, fontWeight: "700" },
  error: { color: colors.danger, backgroundColor: colors.dangerSoft, marginTop: 14, padding: 11, borderRadius: radius.sm, lineHeight: 19 },
  help: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 19 },
  footer: { color: colors.textMuted, fontSize: 12, textAlign: "center", marginTop: 24 }
});