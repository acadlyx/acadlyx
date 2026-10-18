import React from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "../api/client";
import { toCollection, displayValue, safeRecordEntries, recordTitle } from "../api/payload";
import { useAuth } from "../auth/AuthProvider";
import { useWorkspaceContext } from "../workspace/WorkspaceContextProvider";
import { colors, radius, spacing } from "../ui/theme";

export function NotificationsScreen() {
  const { user } = useAuth();
  const { context } = useWorkspaceContext();
  const workspaceKey = JSON.stringify(context?.scope ?? {});
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["module", user?.id, workspaceKey, "notifications"],
    queryFn: () => apiRequest<unknown>("/portal/notifications"),
    enabled: Boolean(user?.id),
    staleTime: 0
  });
  const invalidateNotifications = async () => {
    await client.invalidateQueries({ queryKey: ["module", user?.id] });
    await client.invalidateQueries({ queryKey: ["my-work", user?.id] });
  };
  const markAll = useMutation({
    mutationFn: () => apiRequest("/portal/notifications/read-all", { method: "POST" }),
    onSuccess: invalidateNotifications
  });
  const markOne = useMutation({
    mutationFn: (id: string) => apiRequest("/portal/notifications/" + encodeURIComponent(id), {
      method: "PATCH", body: JSON.stringify({ read: true })
    }),
    onSuccess: invalidateNotifications
  });
  const records = toCollection(query.data);

  return <View style={styles.root}>
    <View style={styles.header}>
      <Text style={styles.heading}>Notifications</Text>
      <Text style={styles.subtitle}>Messages returned by your authorized ACADLYX notification endpoint.</Text>
      <Pressable accessibilityRole="button" disabled={markAll.isPending || records.length === 0}
        onPress={() => markAll.mutate()} style={[styles.button, (markAll.isPending || records.length === 0) ? styles.disabled : null]}>
        <Text style={styles.buttonText}>{markAll.isPending ? "Updating…" : "Mark all as read"}</Text>
      </Pressable>
      {markAll.isError ? <Text style={styles.error}>{markAll.error instanceof ApiError ? markAll.error.message : "Could not update notifications."}</Text> : null}
      {markAll.isSuccess || markOne.isSuccess ? <Text style={styles.success}>Read status updated by the backend.</Text> : null}
      {markOne.isError ? <Text style={styles.error}>{markOne.error instanceof Error ? markOne.error.message : "Could not update this notification."}</Text> : null}
    </View>
    {query.isLoading ? <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /><Text style={styles.subtitle}>Loading notifications…</Text></View> :
      query.isError ? <View style={styles.center}>
        <Text style={styles.recordTitle}>Notifications unavailable</Text>
        <Text style={styles.subtitle}>{query.error instanceof Error ? query.error.message : "Try again."}</Text>
        <Pressable accessibilityRole="button" onPress={() => { void query.refetch(); }} style={styles.retry}><Text style={styles.buttonText}>Retry</Text></Pressable>
      </View> : <FlatList data={records} keyExtractor={(item, index) => {
        if (typeof item === "object" && item !== null) {
          const id = (item as Record<string, unknown>).id;
          if (typeof id === "string" || typeof id === "number") return String(id);
        }
        return "notification-" + index;
      }} contentContainerStyle={styles.list}
      renderItem={({ item, index }) => {
        const raw = typeof item === "object" && item !== null ? item as Record<string, unknown> : null;
        const notificationId = raw && (typeof raw.id === "string" || typeof raw.id === "number") ? String(raw.id) : null;
        const isRead = raw ? raw.read === true || raw.isRead === true || typeof raw.readAt === "string" : false;
        return <View style={styles.card}>
          <Text style={styles.recordTitle}>{recordTitle(item, "Notification " + String(index + 1))}</Text>
          {safeRecordEntries(item).slice(0, 6).map(([key, value]) => <View key={key} style={styles.field}>
            <Text style={styles.label}>{key.replace(/([A-Z])/g, " $1").replace(/[_-]/g, " ")}</Text><Text style={styles.value}>{displayValue(value)}</Text>
          </View>)}
          {notificationId && !isRead ? <Pressable disabled={markOne.isPending} onPress={() => markOne.mutate(notificationId)} style={styles.markRead}>
            <Text style={styles.markReadText}>{markOne.isPending ? "Updating…" : "Mark as read"}</Text>
          </Pressable> : null}
        </View>;
      }} ListEmptyComponent={<View style={styles.center}><Text style={styles.recordTitle}>No notifications</Text><Text style={styles.subtitle}>No notification records were returned for this account.</Text></View>}
      initialNumToRender={15} windowSize={7} />}
  </View>;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas }, header: { padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  heading: { color: colors.text, fontWeight: "900", fontSize: 23 }, subtitle: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 6 },
  button: { alignSelf: "flex-start", backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10, marginTop: 12 },
  disabled: { opacity: 0.5 }, buttonText: { color: colors.white, fontSize: 12, fontWeight: "800" },
  error: { color: colors.danger, fontSize: 12, marginTop: 8 }, success: { color: colors.success, fontSize: 12, marginTop: 8 },
  markRead: { alignSelf: "flex-start", marginTop: 10, paddingHorizontal: 11, paddingVertical: 8, backgroundColor: colors.primarySoft, borderRadius: radius.sm },
  markReadText: { color: colors.primary, fontSize: 11, fontWeight: "800" },
  list: { padding: spacing.lg, paddingBottom: 24 }, card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, marginBottom: 10 },
  recordTitle: { color: colors.text, fontSize: 15, fontWeight: "800" }, field: { borderTopColor: colors.surfaceMuted, borderTopWidth: 1, marginTop: 7, paddingTop: 7 },
  label: { color: colors.textMuted, fontSize: 10, fontWeight: "800", textTransform: "uppercase" }, value: { color: colors.text, fontSize: 13, marginTop: 3, lineHeight: 18 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: 10 }, retry: { backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: 15, paddingVertical: 10, marginTop: 4 }
});