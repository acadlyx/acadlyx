import React, { useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { WorkspaceItem, useWorkspaceContext } from "../workspace/WorkspaceContextProvider";
import { colors, radius, spacing } from "../ui/theme";
import { WorkspaceContextIds } from "../api/client";

type DimensionKey = keyof WorkspaceContextIds;
type Dimension = { key: DimensionKey; label: string; items: WorkspaceItem[] };

const DEFAULT_LABEL = "Institution / default scope";

export function WorkspaceContextScreen() {
  const { context, loading, saving, error, refresh, changeContext } = useWorkspaceContext();
  const [activeDimension, setActiveDimension] = useState<DimensionKey | null>(null);
  // `context.role` is server-derived using the canonical effective-role
  // policy. A Faculty+Student account must not be locked to the secondary
  // Student enrollment scope.
  const fixedStudentScope = context?.role === "STUDENT";

  const dimensions = useMemo<Dimension[]>(() => context ? [
    { key: "campusId", label: "Campus", items: context.children.campuses || [] },
    { key: "departmentId", label: "Department", items: context.children.departments || [] },
    { key: "programId", label: "Programme", items: context.children.programs || [] },
    { key: "academicYearId", label: "Academic year", items: context.children.academicYears || [] },
    { key: "batchId", label: "Batch", items: context.children.batches || [] },
    { key: "semesterId", label: "Semester", items: context.children.semesters || [] },
    { key: "sectionId", label: "Section", items: context.children.sections || [] }
  ] : [], [context]);

  const selectedDimension = dimensions.find((dimension) => dimension.key === activeDimension) ?? null;

  function selectedName(dimension: Dimension): string {
    const id = context?.scope[dimension.key];
    if (typeof id !== "string" || !id) return dimension.key === "campusId" || dimension.key === "departmentId"
      ? DEFAULT_LABEL : "Not selected";
    const selected = dimension.items.find((item) => item.id === id);
    return selected ? selected.name + (selected.code ? " · " + selected.code : "") : "Selected scope";
  }

  async function choose(dimension: Dimension, item: WorkspaceItem | null) {
    if (!context) return;
    const clearAcademicDescendants = { semesterId: null, sectionId: null };
    const clearProgramDescendants = { programId: null, academicYearId: null, batchId: null, semesterId: null, sectionId: null };
    let patch: Partial<Record<DimensionKey, string | null>> = {};

    switch (dimension.key) {
      case "campusId":
        patch = {
          campusId: item?.id ?? null,
          departmentId: null,
          ...clearProgramDescendants
        };
        break;
      case "departmentId":
        patch = {
          campusId: item?.campus?.id ?? context.scope.campusId ?? null,
          departmentId: item?.id ?? null,
          ...clearProgramDescendants
        };
        break;
      case "programId":
        patch = {
          departmentId: item?.departmentId ?? context.scope.departmentId ?? null,
          programId: item?.id ?? null,
          academicYearId: null,
          batchId: null,
          ...clearAcademicDescendants
        };
        break;
      case "academicYearId":
        patch = { academicYearId: item?.id ?? null, ...clearAcademicDescendants };
        break;
      case "batchId":
        patch = { programId: item?.programId ?? context.scope.programId ?? null, batchId: item?.id ?? null };
        break;
      case "semesterId":
        patch = {
          departmentId: item?.program?.departmentId ?? context.scope.departmentId ?? null,
          programId: item?.programId ?? context.scope.programId ?? null,
          academicYearId: item?.academicYearId ?? context.scope.academicYearId ?? null,
          batchId: null,
          semesterId: item?.id ?? null,
          sectionId: null
        };
        break;
      case "sectionId":
        patch = { semesterId: item?.semesterId ?? context.scope.semesterId ?? null, sectionId: item?.id ?? null };
        break;
    }

    setActiveDimension(null);
    try { await changeContext(patch); } catch { /* The provider displays the server error. */ }
  }

  return <ScrollView style={styles.root} contentContainerStyle={styles.content}>
    <View style={styles.hero}>
      <Text style={styles.eyebrow}>AUTHORIZED WORKSPACE</Text>
      <Text style={styles.title}>Workspace & context</Text>
      <Text style={styles.subtitle}>Choose the academic scope for this session. ACADLYX validates each change through the existing backend before activating it.</Text>
      {context ? <>
        <View style={styles.divider} />
        <Text style={styles.institution}>{context.institution?.name || "Your institution"}</Text>
        <Text style={styles.role}>Active role: {(context.role || "USER").replace(/_/g, " ")}</Text>
      </> : null}
    </View>

    {loading && !context ? <View style={styles.stateCard}><ActivityIndicator color={colors.primary} /><Text style={styles.muted}>Loading authorized workspaces…</Text></View> : null}
    {error ? <View style={styles.errorCard}><Text accessibilityRole="alert" style={styles.errorText}>{error}</Text><Pressable accessibilityRole="button" onPress={() => { void refresh(); }} style={styles.retry}><Text style={styles.retryText}>Retry workspace loading</Text></Pressable></View> : null}

    {context ? <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Academic scope</Text>
        {saving ? <ActivityIndicator size="small" color={colors.primary} /> : null}
      </View>
      <Text style={styles.help}>Changing scope clears stale query data and refetches active screens. The server remains the authorization boundary.</Text>

      {dimensions.map((dimension) => <Pressable key={dimension.key} accessibilityRole="button"
        accessibilityLabel={dimension.label + ": " + selectedName(dimension)}
        disabled={saving || fixedStudentScope}
        onPress={() => setActiveDimension(dimension.key)}
        style={({ pressed }) => [styles.field, pressed ? styles.pressed : null, saving || fixedStudentScope ? styles.disabled : null]}>
        <View style={styles.fieldText}>
          <Text style={styles.label}>{dimension.label}</Text>
          <Text style={styles.value}>{selectedName(dimension)}</Text>
        </View>
        <Text style={styles.chevron}>{fixedStudentScope ? "🔒" : "⌄"}</Text>
      </Pressable>)}

      {fixedStudentScope ? <Text style={styles.help}>Student academic scope is determined by the active enrollment and cannot be changed from the mobile app.</Text> : null}
      <Pressable accessibilityRole="button" disabled={loading || saving} onPress={() => { void refresh(); }} style={[styles.refreshButton, loading || saving ? styles.disabled : null]}>
        <Text style={styles.refreshText}>Refresh authorized options</Text>
      </Pressable>
      <View style={styles.note}>
        <Text style={styles.noteTitle}>Scope safety</Text>
        <Text style={styles.noteText}>Only server-returned options are shown. A selection is not activated unless the workspace-context API accepts it. Context IDs are passed to API requests as filters; every endpoint must still enforce its own permissions and scope.</Text>
      </View>
    </> : null}

    <Modal transparent visible={Boolean(selectedDimension)} animationType="slide" onRequestClose={() => setActiveDimension(null)}>
      <View style={styles.modalBackdrop}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close selector" style={StyleSheet.absoluteFill} onPress={() => setActiveDimension(null)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Select {selectedDimension?.label.toLowerCase()}</Text>
            <Pressable accessibilityRole="button" onPress={() => setActiveDimension(null)}><Text style={styles.close}>Close</Text></Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.options}>
            {selectedDimension ? <Pressable accessibilityRole="button" onPress={() => { void choose(selectedDimension, null); }} style={styles.option}>
              <View style={styles.optionCopy}><Text style={styles.optionTitle}>{selectedDimension.key === "campusId" || selectedDimension.key === "departmentId" ? DEFAULT_LABEL : "Clear selection"}</Text><Text style={styles.optionSubtitle}>Use the server's default scope for this level</Text></View>
              <Text style={styles.optionArrow}>↺</Text>
            </Pressable> : null}
            {selectedDimension?.items.map((item) => <Pressable accessibilityRole="button" key={item.id} onPress={() => { void choose(selectedDimension, item); }} style={styles.option}>
              <View style={styles.optionCopy}>
                <Text style={styles.optionTitle}>{item.name}</Text>
                {item.code ? <Text style={styles.optionSubtitle}>{item.code}</Text> : null}
              </View>
              <Text style={styles.optionArrow}>›</Text>
            </Pressable>)}
            {selectedDimension && selectedDimension.items.length === 0 ? <View style={styles.empty}><Text style={styles.muted}>No options are available for this level in the current authorized context.</Text></View> : null}
          </ScrollView>
          {saving ? <View style={styles.saving}><ActivityIndicator color={colors.primary} /><Text style={styles.muted}>Validating and applying scope…</Text></View> : null}
        </View>
      </View>
    </Modal>
  </ScrollView>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.lg, paddingBottom: 36, gap: 10 },
  hero: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: spacing.xl },
  eyebrow: { color: colors.primary, fontSize: 10, letterSpacing: 1.1, fontWeight: "900" },
  title: { color: colors.text, fontSize: 25, lineHeight: 32, fontWeight: "900", marginTop: 7 },
  subtitle: { color: colors.textMuted, fontSize: 13, lineHeight: 20, marginTop: 8 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 16 },
  institution: { color: colors.text, fontWeight: "900", fontSize: 16 },
  role: { color: colors.textMuted, fontSize: 12, marginTop: 5 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14 },
  sectionTitle: { color: colors.text, fontWeight: "900", fontSize: 18 },
  help: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginBottom: 5 },
  field: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 65 },
  fieldText: { flex: 1, gap: 4 }, label: { color: colors.textMuted, fontSize: 11, fontWeight: "800" },
  value: { color: colors.text, fontWeight: "800", fontSize: 14 }, chevron: { color: colors.primary, fontSize: 21, marginLeft: 8 },
  pressed: { opacity: 0.75 }, disabled: { opacity: 0.6 },
  refreshButton: { borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: "center", padding: spacing.md, marginTop: 3 },
  refreshText: { color: colors.primary, fontWeight: "900" },
  note: { marginTop: 8, padding: spacing.lg, backgroundColor: colors.surfaceMuted, borderRadius: radius.md, gap: 6 },
  noteTitle: { color: colors.text, fontWeight: "900", fontSize: 13 }, noteText: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  stateCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.xl, alignItems: "center", gap: 10 },
  muted: { color: colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: "center" },
  errorCard: { backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: colors.danger, padding: spacing.lg, borderRadius: radius.md, gap: 10 },
  errorText: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  retry: { alignSelf: "flex-start", backgroundColor: colors.surface, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 9 },
  retryText: { color: colors.primary, fontWeight: "900", fontSize: 12 },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(20, 34, 26, 0.36)" },
  sheet: { maxHeight: "82%", backgroundColor: colors.canvas, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: spacing.xxl },
  sheetHandle: { width: 42, height: 4, borderRadius: 3, backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.md },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  sheetTitle: { color: colors.text, fontSize: 18, fontWeight: "900" }, close: { color: colors.primary, fontWeight: "900", padding: 6 },
  options: { gap: 7, paddingBottom: spacing.lg },
  option: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  optionCopy: { flex: 1, gap: 3 }, optionTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  optionSubtitle: { color: colors.textMuted, fontSize: 11 }, optionArrow: { color: colors.primary, fontSize: 20, fontWeight: "800" },
  empty: { padding: spacing.xl, alignItems: "center" }, saving: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingTop: spacing.md, gap: 9 }
});
