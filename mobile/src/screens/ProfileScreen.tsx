import React, { useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { colors, radius, spacing } from "../ui/theme";
import { RootStackParamList } from "../navigation/RootNavigator";

export function ProfileScreen() {
  const { user, signOut, changePassword } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const updatePassword = useMutation({
    mutationFn: async () => {
      if (!currentPassword || !newPassword) throw new Error("Enter both password fields.");
      if (newPassword.length < 12) throw new Error("Use a new password with at least 12 characters.");
      if (newPassword !== confirmPassword) throw new Error("The new passwords do not match.");
      await changePassword(currentPassword, newPassword);
    },
    onSuccess: () => Alert.alert("Password changed", "For your security, you have been signed out. Sign in with your new password."),
    onError: (issue) => setError(issue instanceof ApiError ? issue.message : issue instanceof Error ? issue.message : "Password change failed.")
  });

  return <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{(user?.firstName || user?.email || "A").slice(0, 1).toUpperCase()}</Text></View>
        <Text style={styles.name}>{[user?.firstName, user?.lastName].filter((value) => typeof value === "string" && value).join(" ") || "ACADLYX Account"}</Text>
        <Text style={styles.email}>{user?.email || "Email not returned by the backend"}</Text>
        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>Assigned roles</Text>
        <View style={styles.roles}>{(user?.roles || []).map((role) => <View key={role} style={styles.rolePill}><Text style={styles.roleText}>{role.replace(/_/g, " ")}</Text></View>)}</View>
        <Text style={styles.meta}>The backend returned {String(user?.permissions.length || 0)} permissions for this session. Authorization is still checked on the server.</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={() => navigation.navigate("WorkspaceContext")} style={styles.contextButton}>
        <View style={styles.contextCopy}><Text style={styles.contextTitle}>Workspace & academic context</Text><Text style={styles.contextHint}>Manage the authorized campus and academic scope for this session.</Text></View>
        <Text style={styles.contextArrow}>›</Text>
      </Pressable>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Change password</Text>
        <Text style={styles.help}>The existing authenticated API processes the update. A successful change ends this mobile session.</Text>
        <Text style={styles.label}>Current password</Text>
        <TextInput value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry autoComplete="current-password" style={styles.input} placeholder="Current password" placeholderTextColor={colors.textMuted} />
        <Text style={styles.label}>New password</Text>
        <TextInput value={newPassword} onChangeText={setNewPassword} secureTextEntry autoComplete="new-password" style={styles.input} placeholder="At least 12 characters" placeholderTextColor={colors.textMuted} />
        <Text style={styles.label}>Confirm new password</Text>
        <TextInput value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoComplete="new-password" style={styles.input} placeholder="Repeat new password" placeholderTextColor={colors.textMuted} />
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <Pressable accessibilityRole="button" disabled={updatePassword.isPending} onPress={() => { setError(""); updatePassword.mutate(); }} style={[styles.button, updatePassword.isPending ? styles.disabled : null]}>
          {updatePassword.isPending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Update password</Text>}
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" onPress={() => Alert.alert("Sign out", "Sign out of ACADLYX on this device?", [
        { text: "Cancel", style: "cancel" },
        { text: "Sign out", style: "destructive", onPress: () => { void signOut(); } }
      ])} style={styles.signOut}><Text style={styles.signOutText}>Sign out</Text></Pressable>
      <Text style={styles.footer}>ACADLYX · Designed and maintained by Ayzent Solutions</Text>
    </ScrollView>
  </KeyboardAvoidingView>;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas }, content: { padding: spacing.lg, paddingBottom: 32, gap: 13 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.xl },
  avatar: { width: 54, height: 54, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center", marginBottom: 13 },
  avatarText: { color: colors.primary, fontSize: 25, fontWeight: "900" }, name: { color: colors.text, fontSize: 20, fontWeight: "900" },
  email: { color: colors.textMuted, fontSize: 13, marginTop: 4 }, divider: { height: 1, backgroundColor: colors.border, marginVertical: 18 },
  sectionTitle: { color: colors.text, fontWeight: "900", fontSize: 17 }, roles: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  rolePill: { backgroundColor: colors.primarySoft, paddingHorizontal: 9, paddingVertical: 6, borderRadius: radius.pill },
  roleText: { color: colors.primary, fontSize: 10, fontWeight: "800" }, meta: { color: colors.textMuted, fontSize: 11, lineHeight: 17, marginTop: 14 },
  contextButton: { flexDirection: "row", alignItems: "center", gap: 10, padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  contextCopy: { flex: 1, gap: 4 }, contextTitle: { color: colors.primary, fontWeight: "900", fontSize: 13 },
  contextHint: { color: colors.textMuted, fontSize: 11, lineHeight: 16 }, contextArrow: { color: colors.primary, fontWeight: "900", fontSize: 23 },
  help: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 7, marginBottom: 7 },
  label: { color: colors.text, fontSize: 12, fontWeight: "800", marginTop: 11, marginBottom: 6 },
  input: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 12, color: colors.text },
  button: { alignItems: "center", justifyContent: "center", minHeight: 46, backgroundColor: colors.primary, borderRadius: radius.md, marginTop: 18, padding: 12 },
  buttonText: { color: colors.white, fontWeight: "800" }, disabled: { opacity: 0.6 }, error: { color: colors.danger, fontSize: 12, marginTop: 9 },
  signOut: { alignItems: "center", padding: 15, borderWidth: 1, borderColor: colors.danger, borderRadius: radius.md, backgroundColor: colors.surface },
  signOutText: { color: colors.danger, fontWeight: "900" }, footer: { textAlign: "center", color: colors.textMuted, fontSize: 11, marginTop: 8 }
});