import React, { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Linking, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, ApiError } from "../api/client";
import { toCollection } from "../api/payload";
import { useAuth } from "../auth/AuthProvider";
import { useWorkspaceContext } from "../workspace/WorkspaceContextProvider";
import { colors, radius, spacing } from "../ui/theme";

type DocumentRecord = { id: string; title: string; url: string; type?: string; createdAt?: string };

function dateLabel(value?: string): string {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleDateString();
}
function asDocument(value: unknown): DocumentRecord | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== "string" || typeof item.title !== "string" || typeof item.url !== "string") return null;
  return {
    id: item.id,
    title: item.title,
    url: item.url,
    type: typeof item.type === "string" ? item.type : "Document",
    createdAt: typeof item.createdAt === "string" ? item.createdAt : undefined
  };
}

export function DocumentsScreen() {
  const { user } = useAuth();
  const { context } = useWorkspaceContext();
  const workspaceKey = JSON.stringify(context?.scope ?? {});
  const [openError, setOpenError] = useState("");
  const query = useQuery({
    queryKey: ["documents", user?.id],
    queryFn: () => apiRequest<unknown>("/portal/documents/me"),
    enabled: Boolean(user?.id && user.permissions.includes("documents.read")),
    staleTime: 0
  });
  const documents = useMemo(() => toCollection(query.data).map(asDocument).filter((item): item is DocumentRecord => item !== null), [query.data]);

  const openDocument = async (document: DocumentRecord) => {
    setOpenError("");
    // The API returns the document URL from the institution-scoped record.
    // Permit web URLs only; do not pass arbitrary schemes into the OS resolver.
    if (!/^https?:\/\/\S+$/i.test(document.url)) {
      setOpenError("This document does not contain a supported web URL. Ask the institution administrator to correct its document record.");
      return;
    }
    try {
      await Linking.openURL(document.url);
    } catch (error) {
      setOpenError(error instanceof Error ? error.message : "The document could not be opened on this device.");
    }
  };

  return <View style={styles.root}>
    <View style={styles.header}>
      <Text style={styles.eyebrow}>MY RECORDS</Text>
      <Text style={styles.title}>Documents</Text>
      <Text style={styles.subtitle}>Institution documents and academic records assigned to your authenticated account. The API enforces ownership and institution scope.</Text>
      <Pressable accessibilityRole="button" disabled={query.isRefetching} onPress={() => { setOpenError(""); void query.refetch(); }}
        style={[styles.refresh, query.isRefetching ? styles.disabled : null]}>
        <Text style={styles.refreshText}>{query.isRefetching ? "Refreshing…" : "Refresh documents"}</Text>
      </Pressable>
    </View>

    {openError ? <View style={styles.warning}><Text style={styles.warningTitle}>Could not open document</Text><Text style={styles.warningText}>{openError}</Text></View> : null}
    {!user?.permissions.includes("documents.read") ? <View style={styles.center}>
      <Text style={styles.cardTitle}>Document access is not granted</Text>
      <Text style={styles.muted}>Your current session does not include documents.read.</Text>
    </View> : query.isLoading ? <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} /><Text style={styles.muted}>Loading your documents…</Text>
    </View> : query.isError ? <View style={styles.center}>
      <Text style={styles.cardTitle}>Documents could not be loaded</Text>
      <Text style={styles.muted}>{query.error instanceof ApiError ? query.error.message : query.error instanceof Error ? query.error.message : "The request failed."}</Text>
      {query.error instanceof ApiError && query.error.requestId ? <Text style={styles.requestId}>Request reference: {query.error.requestId}</Text> : null}
      <Pressable accessibilityRole="button" onPress={() => { void query.refetch(); }} style={styles.primary}><Text style={styles.primaryText}>Retry</Text></Pressable>
    </View> : <FlatList
      data={documents}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => { void query.refetch(); }} tintColor={colors.primary} />}
      renderItem={({ item }) => <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.copy}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.meta}>{item.type || "Document"} · {dateLabel(item.createdAt)}</Text>
          </View>
          <Text style={styles.fileIcon}>↗</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={"Open document " + item.title}
          onPress={() => { void openDocument(item); }} style={styles.primary}>
          <Text style={styles.primaryText}>Open document</Text>
        </Pressable>
      </View>}
      ListEmptyComponent={<View style={styles.empty}>
        <Text style={styles.cardTitle}>No documents available</Text>
        <Text style={styles.muted}>Documents published for your account will appear here.</Text>
      </View>}
      initialNumToRender={12} windowSize={7}
    />}
    <View style={styles.footer}><Text style={styles.footerText}>Only documents returned by the authenticated /portal/documents/me endpoint are shown. Opening a document uses its institution-provided web URL; upload and document-management actions are not enabled in this viewer.</Text></View>
  </View>;
}

const styles = StyleSheet.create({
  root:{flex:1,backgroundColor:colors.canvas},
  header:{padding:spacing.lg,gap:7,backgroundColor:colors.surface,borderBottomWidth:1,borderColor:colors.border},
  eyebrow:{fontSize:10,fontWeight:"900",letterSpacing:1,color:colors.primary},
  title:{fontSize:23,fontWeight:"900",color:colors.text},
  subtitle:{fontSize:12,lineHeight:18,color:colors.textMuted},
  refresh:{alignSelf:"flex-start",backgroundColor:colors.primarySoft,paddingHorizontal:12,paddingVertical:9,borderRadius:radius.md,marginTop:3},
  refreshText:{color:colors.primary,fontWeight:"900",fontSize:11},
  list:{padding:spacing.lg,paddingBottom:28},
  card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,padding:spacing.md,marginBottom:10},
  cardHeader:{flexDirection:"row",alignItems:"flex-start",gap:8},
  copy:{flex:1},
  cardTitle:{fontSize:14,fontWeight:"900",color:colors.text},
  fileIcon:{fontSize:20,color:colors.primary,fontWeight:"900"},
  meta:{fontSize:11,lineHeight:16,color:colors.textMuted,marginTop:5},
  primary:{alignSelf:"flex-start",backgroundColor:colors.primary,borderRadius:radius.sm,paddingHorizontal:13,paddingVertical:10,marginTop:12},
  primaryText:{fontSize:11,fontWeight:"900",color:colors.white},
  center:{flex:1,alignItems:"center",justifyContent:"center",padding:spacing.xl,gap:10},
  empty:{alignItems:"center",gap:8,padding:spacing.xl,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.md},
  muted:{fontSize:12,lineHeight:18,color:colors.textMuted,textAlign:"center"},
  requestId:{fontSize:10,color:colors.textMuted},
  warning:{margin:spacing.lg,marginBottom:0,padding:spacing.md,borderWidth:1,borderColor:colors.warning,borderRadius:radius.md,backgroundColor:colors.surface},
  warningTitle:{fontSize:12,fontWeight:"900",color:colors.warning},
  warningText:{fontSize:11,lineHeight:17,color:colors.textMuted,marginTop:4},
  disabled:{opacity:.5},
  footer:{padding:spacing.md,borderTopWidth:1,borderColor:colors.border,backgroundColor:colors.surface},
  footerText:{fontSize:10,lineHeight:16,color:colors.textMuted,textAlign:"center"}
});