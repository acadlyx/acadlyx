import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { apiRequest, ApiError } from "../api/client";
import { toCollection } from "../api/payload";
import { useAuth } from "../auth/AuthProvider";
import { useWorkspaceContext } from "../workspace/WorkspaceContextProvider";
import { colors, radius, spacing } from "../ui/theme";
import { RootStackParamList } from "../navigation/RootNavigator";

type SearchResult = { type: "person" | "course" | "notice"; id: string; title: string; subtitle: string; href?: string };

function resultTypeLabel(type: SearchResult["type"]): string {
  if (type === "person") return "PERSON";
  if (type === "course") return "COURSE";
  return "NOTICE";
}

export function GlobalSearchScreen() {
  const { user } = useAuth();
  const { context } = useWorkspaceContext();
  const workspaceKey = JSON.stringify(context?.scope ?? {});
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [input, setInput] = useState("");
  const [queryText, setQueryText] = useState("");

  useEffect(() => {
    const handle = setTimeout(() => setQueryText(input.trim()), 300);
    return () => clearTimeout(handle);
  }, [input]);

  const query = useQuery({
    queryKey: ["global-search", user?.id, workspaceKey, queryText],
    queryFn: () => apiRequest<unknown>("/search?q=" + encodeURIComponent(queryText)),
    enabled: Boolean(user?.id && queryText.length >= 2),
    staleTime: 10000,
    retry: false
  });

  const results = toCollection(query.data).filter((value): value is SearchResult =>
    typeof value === "object" && value !== null &&
    typeof (value as SearchResult).id === "string" &&
    typeof (value as SearchResult).title === "string" &&
    typeof (value as SearchResult).type === "string"
  );

  function openResult(result: SearchResult) {
    // Do not follow the backend's web href on native. Each destination issues
    // its own authorized API request, so a result that has become unavailable
    // between search and navigation cannot expose a stale record.
    if (result.type === "notice") navigation.navigate("Notices");
    else navigation.navigate("Module", { moduleId: result.type === "person" ? "students" : "courses" });
  }

  return <View style={styles.root}>
    <View style={styles.header}>
      <Text style={styles.title}>Search ACADLYX</Text>
      <Text style={styles.subtitle}>Search people, courses and notices available to your authenticated role and institution scope.</Text>
      <TextInput
        value={input}
        onChangeText={setInput}
        placeholder="Enter at least 2 characters"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel="Search ACADLYX"
        style={styles.input}
      />
      <Text style={styles.hint}>{input.trim().length < 2 ? "Type at least two characters to search." : query.isFetching ? "Searching authorized records…" : String(results.length) + " result(s)"}</Text>
    </View>

    {input.trim().length < 2 ? <View style={styles.empty}>
      <Text style={styles.emptyTitle}>Start with a short search</Text>
      <Text style={styles.muted}>The server filters results by your role, institution and permitted data scope.</Text>
    </View> : query.isLoading || query.isFetching && !query.data ? <View style={styles.empty}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.muted}>Searching…</Text>
    </View> : query.isError ? <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{query.error instanceof ApiError && query.error.status === 403 ? "Search access unavailable" : "Search could not be completed"}</Text>
      <Text style={styles.muted}>{query.error instanceof Error ? query.error.message : "Check your connection and try again."}</Text>
      <Pressable accessibilityRole="button" onPress={() => { void query.refetch(); }} style={styles.button}><Text style={styles.buttonText}>Try again</Text></Pressable>
    </View> : <FlatList
      data={results}
      keyExtractor={(item) => item.type + ":" + item.id}
      refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => { void query.refetch(); }} tintColor={colors.primary} />}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={"Open " + item.title} onPress={() => openResult(item)} style={({ pressed }) => [styles.result, pressed ? styles.pressed : null]}>
        <View style={styles.resultTop}>
          <Text style={styles.resultTitle}>{item.title}</Text>
          <View style={styles.badge}><Text style={styles.badgeText}>{resultTypeLabel(item.type)}</Text></View>
        </View>
        {item.subtitle ? <Text style={styles.resultSubtitle}>{item.subtitle}</Text> : null}
        <Text style={styles.open}>Open authorized record ›</Text>
      </Pressable>}
      ListEmptyComponent={<View style={styles.empty}>
        <Text style={styles.emptyTitle}>No matching records</Text>
        <Text style={styles.muted}>No results were returned for this query in your authorized scope.</Text>
      </View>}
      initialNumToRender={12}
      windowSize={7}
    />}
    <Text style={styles.footnote}>Search results are read-only. The API returns only records allowed by its server-side scope rules.</Text>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  header: { backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: 9 },
  title: { color: colors.text, fontSize: 23, fontWeight: "900" },
  subtitle: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, color: colors.text, paddingHorizontal: 13, paddingVertical: 12, fontSize: 14 },
  hint: { color: colors.textMuted, fontSize: 11 },
  list: { padding: spacing.lg, paddingBottom: 24 },
  result: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.lg, marginBottom: 9, gap: 7 }, pressed: { opacity: 0.72 },
  resultTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  resultTitle: { color: colors.text, fontSize: 14, fontWeight: "800", flex: 1 },
  resultSubtitle: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  badge: { backgroundColor: colors.primarySoft, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill },
  badgeText: { color: colors.primary, fontSize: 9, fontWeight: "900" },
  open: { color: colors.primary, fontSize: 11, fontWeight: "900", marginTop: 3 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: 10 },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: "900", textAlign: "center" },
  muted: { color: colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: "center" },
  button: { backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: 15, paddingVertical: 10 },
  buttonText: { color: colors.white, fontSize: 12, fontWeight: "900" },
  footnote: { color: colors.textMuted, fontSize: 10, lineHeight: 15, textAlign: "center", paddingHorizontal: spacing.lg, paddingBottom: spacing.md }
});
