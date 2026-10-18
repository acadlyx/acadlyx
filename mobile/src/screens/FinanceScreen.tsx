import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Platform,
  Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "../api/client";
import { toCollection } from "../api/payload";
import { useAuth } from "../auth/AuthProvider";
import { useWorkspaceContext } from "../workspace/WorkspaceContextProvider";
import { colors, radius, spacing } from "../ui/theme";

export type Section = "structures" | "invoices" | "payments" | "refunds";
type Entry = Record<string, unknown>;
type StructureAction = { id: string; action: "submit" | "publish" | "approve" | "reject"; reason?: string };
type RefundAction = { kind: "request"; paymentId: string; amount: string; reason: string } | { kind: "approve" | "process"; id: string };

function record(value: unknown): Entry | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Entry : null;
}
function field(value: Entry, key: string): string {
  const v = value[key];
  return v === null || v === undefined ? "" : String(v);
}
function money(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : String(value);
}
function dateLabel(value: unknown): string {
  if (typeof value !== "string" || !value) return "—";
  const stamp = Date.parse(value);
  return Number.isNaN(stamp) ? value : new Date(stamp).toLocaleDateString();
}
function statusLabel(value: unknown): string {
  return typeof value === "string" && value ? value.replace(/_/g, " ") : "UNKNOWN";
}
function studentLabel(value: unknown): string {
  const student = record(value);
  if (!student) return "Student record";
  const name = [student.firstName, student.lastName].filter(x => typeof x === "string" && x.trim()).join(" ");
  const profile = record(student.profile);
  return name || (profile && typeof profile.admissionNumber === "string" ? profile.admissionNumber : "Student record");
}

export function FinanceScreen({ initialTab }: { initialTab?: Section }) {
  const { user } = useAuth();
  const { context } = useWorkspaceContext();
  const workspaceKey = JSON.stringify(context?.scope ?? {});
  const client = useQueryClient();
  const permissions = user?.permissions ?? [];
  const permissionSignature = [...permissions].sort().join("|");
  const has = (...required: string[]) => required.some(item => permissions.includes(item));
  const sections = useMemo<Section[]>(() => {
    const result: Section[] = [];
    if (has("fees.structure.read")) result.push("structures");
    if (has("fees.read", "fees.invoice.read")) result.push("invoices");
    if (has("fees.read", "fees.payment.read")) result.push("payments");
    if (has("fees.read", "fees.refund.read", "fees.refund.approve", "fees.refund.process")) result.push("refunds");
    return result;
  }, [permissionSignature]);

  const [active, setActive] = useState<Section>(initialTab || "invoices");
  const [refundPayment, setRefundPayment] = useState<Entry | null>(null);
  const [rejectStructure, setRejectStructure] = useState<Entry | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [modalError, setModalError] = useState("");
  const sectionSignature = sections.join("|");

  useEffect(() => {
    setActive(current => initialTab && sections.includes(initialTab) ? initialTab : sections.includes(current) ? current : sections[0] || current);
  }, [initialTab, sectionSignature]);

  const invalidate = async () => {
    await client.invalidateQueries({ queryKey: ["finance", user?.id] });
    await client.invalidateQueries({ queryKey: ["my-work", user?.id] });
  };
  const structuresQuery = useQuery({
    queryKey: ["finance", user?.id, workspaceKey, "structures"],
    queryFn: () => apiRequest<unknown>("/erp/fee-structures"),
    enabled: Boolean(user?.id && active === "structures" && has("fees.structure.read")),
    staleTime: 0
  });
  const invoicesQuery = useQuery({
    queryKey: ["finance", user?.id, workspaceKey, "invoices"],
    queryFn: () => apiRequest<unknown>("/finance/invoices?page=1&pageSize=25"),
    enabled: Boolean(user?.id && active === "invoices" && has("fees.read", "fees.invoice.read")),
    staleTime: 0
  });
  const paymentsQuery = useQuery({
    queryKey: ["finance", user?.id, workspaceKey, "payments"],
    queryFn: () => apiRequest<unknown>("/finance/payments"),
    enabled: Boolean(user?.id && active === "payments" && has("fees.read", "fees.payment.read")),
    staleTime: 0
  });
  const refundsQuery = useQuery({
    queryKey: ["finance", user?.id, workspaceKey, "refunds"],
    queryFn: () => apiRequest<unknown>("/finance/refunds"),
    enabled: Boolean(user?.id && active === "refunds" && has("fees.read", "fees.refund.read", "fees.refund.approve", "fees.refund.process")),
    staleTime: 0
  });

  const structureMutation = useMutation({
    mutationFn: ({ id, action, reason: rejectionReason }: StructureAction) => apiRequest<unknown>(
      "/erp/fee-structures/" + encodeURIComponent(id) + "/" + action,
      { method: "POST", ...(rejectionReason ? { body: JSON.stringify({ reason: rejectionReason }) } : {}) }
    ),
    onSuccess: async (_data, input) => {
      setModalError("");
      if (input.action === "reject") setRejectStructure(null);
      setReason("");
      await invalidate();
    }
  });
  const refundMutation = useMutation({
    mutationFn: (input: RefundAction) => input.kind === "request"
      ? apiRequest<unknown>("/finance/payments/" + encodeURIComponent(input.paymentId) + "/refunds", {
          method: "POST", body: JSON.stringify({ amount: input.amount, reason: input.reason })
        })
      : apiRequest<unknown>("/finance/refunds/" + encodeURIComponent(input.id) + "/" + (input.kind === "approve" ? "approve" : "process"), { method: "POST" }),
    onSuccess: async (_data, input) => {
      setModalError("");
      if (input.kind === "request") setRefundPayment(null);
      setAmount("");
      setReason("");
      await invalidate();
    }
  });

  const visibleSection = sections.includes(active) ? active : sections[0];
  const query = visibleSection === "structures" ? structuresQuery : visibleSection === "invoices" ? invoicesQuery : visibleSection === "payments" ? paymentsQuery : refundsQuery;
  const items = useMemo(() => toCollection(query.data).flatMap(value => {
    const item = record(value);
    return item ? [item] : [];
  }), [query.data]);

  const canManageStructure = has("fees.structure.manage");
  const canApproveStructure = has("fees.structure.approve");
  const canPublishStructure = has("fees.structure.publish") && Boolean(user?.roles?.includes("CHAIRMAN"));
  const canRequestRefund = has("fees.refund.request");
  const canApproveRefund = has("fees.refund.approve");
  const canProcessRefund = has("fees.refund.process");

  const closeModal = () => { setRefundPayment(null); setRejectStructure(null); setAmount(""); setReason(""); setModalError(""); };
  const submitModal = () => {
    if (refundPayment) {
      const value = Number(amount);
      if (!Number.isFinite(value) || value <= 0) { setModalError("Enter a refund amount greater than zero."); return; }
      if (reason.trim().length < 3) { setModalError("Enter a reason with at least 3 characters."); return; }
      const paymentId = field(refundPayment, "id");
      if (!paymentId) { setModalError("Payment identifier missing. Refresh and try again."); return; }
      refundMutation.mutate({ kind: "request", paymentId, amount: amount.trim(), reason: reason.trim() });
    } else if (rejectStructure) {
      if (reason.trim().length < 3) { setModalError("Enter a rejection reason with at least 3 characters."); return; }
      const id = field(rejectStructure, "id");
      if (id) structureMutation.mutate({ id, action: "reject", reason: reason.trim() });
    }
  };
  const structureAction = (item: Entry, action: "submit" | "publish" | "approve") => {
    const id = field(item, "id");
    if (!id) return;
    const prompt = action === "submit" ? ["Submit fee structure?", "This sends the draft to the existing approval workflow."]
      : action === "publish" ? ["Publish fee structure?", "The server will enforce Chairman authority, scope and draft state."]
      : ["Approve fee structure?", "The server will check scope, pending state and maker-checker rules."];
    Alert.alert(prompt[0], prompt[1], [
      { text: "Cancel", style: "cancel" },
      { text: action === "submit" ? "Submit" : action === "publish" ? "Publish" : "Approve", onPress: () => structureMutation.mutate({ id, action }) }
    ]);
  };
  const refundAction = (item: Entry, kind: "approve" | "process") => {
    const id = field(item, "id");
    if (!id) return;
    Alert.alert(kind === "approve" ? "Approve refund?" : "Process approved refund?",
      kind === "approve" ? "The server will re-check state and financial scope." : "This invokes the existing refund-processing workflow.",
      [{ text: "Cancel", style: "cancel" }, { text: kind === "approve" ? "Approve" : "Process", onPress: () => refundMutation.mutate({ kind, id }) }]);
  };

  const title = visibleSection === "structures" ? "fee structures & approvals" : visibleSection === "invoices" ? "fee invoices" : visibleSection === "payments" ? "payments & status" : "refund requests";
  const mutationError = structureMutation.isError ? (structureMutation.error instanceof Error ? structureMutation.error.message : "Fee-structure action failed.")
    : refundMutation.isError ? (refundMutation.error instanceof Error ? refundMutation.error.message : "Refund action failed.") : null;

  return <View style={styles.root}>
    <View style={styles.header}>
      <Text style={styles.title}>Finance workspace</Text>
      <Text style={styles.subtitle}>Live ACADLYX APIs. Tenant, workspace scope and workflow authority remain enforced by the backend.</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {sections.map(section => <Pressable key={section} accessibilityRole="button" accessibilityState={{ selected: visibleSection === section }}
          onPress={() => setActive(section)} style={[styles.tab, visibleSection === section ? styles.tabActive : null]}>
          <Text style={[styles.tabText, visibleSection === section ? styles.tabTextActive : null]}>
            {section === "structures" ? "Fee structures" : section === "invoices" ? "Invoices" : section === "payments" ? "Payments" : "Refunds"}
          </Text>
        </Pressable>)}
      </ScrollView>
    </View>
    {!sections.length ? <View style={styles.center}>
      <Text style={styles.cardTitle}>No finance workflow is granted</Text><Text style={styles.muted}>Your session has no matching finance read permission. Ask an administrator to review role and scope.</Text>
    </View> : query.isLoading ? <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.muted}>Loading {title}…</Text></View>
    : query.isError ? <View style={styles.center}>
      <Text style={styles.cardTitle}>Could not load {title}</Text>
      <Text style={styles.muted}>{query.error instanceof Error ? query.error.message : "The request failed."}</Text>
      {query.error instanceof ApiError && query.error.requestId ? <Text style={styles.requestId}>Request reference: {query.error.requestId}</Text> : null}
      <Button label="Retry" onPress={() => { void query.refetch(); }} />
    </View> : <FlatList data={items} key={visibleSection} keyExtractor={(item, index) => field(item, "id") || field(item, "invoiceNumber") || field(item, "name") || "finance-" + index}
      contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => { void query.refetch(); }} tintColor={colors.primary} />}
      renderItem={({ item }) => {
        const status = field(item, "status").toUpperCase();
        if (visibleSection === "structures") {
          const creator = Boolean(user?.id && field(item, "createdById") === user.id);
          return <View style={styles.card}><View style={styles.cardTop}>
            <Text style={styles.cardTitle}>{field(item, "name") || "Fee structure"}</Text>
            <Text style={[styles.status, status === "ACTIVE" ? styles.good : status === "REJECTED" ? styles.bad : styles.pending]}>{statusLabel(status)}</Text>
          </View>
          <Text style={styles.detail}>Currency: {field(item, "currency") || "—"}</Text><Text style={styles.detail}>Updated: {dateLabel(item.updatedAt || item.createdAt)}</Text>
          {typeof item.notes === "string" && item.notes.trim() ? <Text style={styles.detail}>Notes: {item.notes}</Text> : null}
          <View style={styles.actions}>
            {status === "DRAFT" && canManageStructure && creator ? <Button label="Submit for approval" disabled={structureMutation.isPending} onPress={() => structureAction(item, "submit")} /> : null}
            {status === "DRAFT" && canPublishStructure ? <Button label="Publish as Chairman" disabled={structureMutation.isPending} onPress={() => structureAction(item, "publish")} /> : null}
            {status === "PENDING_APPROVAL" && canApproveStructure && !creator ? <>
              <Button label="Approve" disabled={structureMutation.isPending} onPress={() => structureAction(item, "approve")} />
              <Button label="Reject" secondary disabled={structureMutation.isPending} onPress={() => { setRejectStructure(item); setRefundPayment(null); setReason(""); setModalError(""); }} />
            </> : null}
          </View>
          {status === "PENDING_APPROVAL" && canApproveStructure && creator ? <Text style={styles.mutedSmall}>The creator cannot approve their own submission.</Text> : null}
          </View>;
        }
        if (visibleSection === "invoices") return <View style={styles.card}>
          <View style={styles.cardTop}><Text style={styles.cardTitle}>{field(item, "invoiceNumber") || field(item, "title") || "Invoice"}</Text>
            <Text style={[styles.status, status === "PAID" ? styles.good : status === "OVERDUE" ? styles.bad : styles.pending]}>{statusLabel(status)}</Text></View>
          <Text style={styles.detail}>Student: {studentLabel(item.student)}</Text><Text style={styles.detail}>Amount: {money(item.amount)}</Text>
          <Text style={styles.detail}>Paid: {money(item.paidAmount)}</Text><Text style={styles.detail}>Due: {dateLabel(item.dueDate)}</Text>
        </View>;
        if (visibleSection === "payments") {
          const invoice = record(item.invoice);
          const successful = status === "SUCCESS";
          return <View style={styles.card}><View style={styles.cardTop}>
            <Text style={styles.cardTitle}>{invoice ? field(invoice, "invoiceNumber") || field(invoice, "title") || "Payment" : "Payment"}</Text>
            <Text style={[styles.status, successful ? styles.good : status === "FAILED" ? styles.bad : styles.pending]}>{statusLabel(status)}</Text></View>
            {invoice ? <Text style={styles.detail}>Student: {studentLabel(invoice.student)}</Text> : null}
            <Text style={styles.detail}>Amount: {money(item.amount)}</Text><Text style={styles.detail}>Method: {field(item, "method") || "—"}</Text>
            <Text style={styles.detail}>Paid at: {dateLabel(item.paidAt)}</Text>
            {successful && canRequestRefund ? <View style={styles.actions}><Button label="Request refund" disabled={refundMutation.isPending} onPress={() => {
              setRefundPayment(item); setRejectStructure(null); setAmount(field(item, "amount")); setReason(""); setModalError("");
            }} /></View> : null}
          </View>;
        }
        return <View style={styles.card}><View style={styles.cardTop}><Text style={styles.cardTitle}>Refund request</Text>
          <Text style={[styles.status, status === "PROCESSED" ? styles.good : status === "REJECTED" ? styles.bad : styles.pending]}>{statusLabel(status)}</Text></View>
          <Text style={styles.detail}>Amount: {money(item.amount)}</Text><Text style={styles.detail}>Reason: {field(item, "reason") || "—"}</Text>
          <Text style={styles.detail}>Requested: {dateLabel(item.createdAt)}</Text>
          {status === "REQUESTED" && canApproveRefund ? <View style={styles.actions}><Button label="Approve refund" disabled={refundMutation.isPending} onPress={() => refundAction(item, "approve")} /></View> : null}
          {status === "APPROVED" && canProcessRefund ? <View style={styles.actions}><Button label="Process approved refund" disabled={refundMutation.isPending} onPress={() => refundAction(item, "process")} /></View> : null}
        </View>;
      }}
      ListEmptyComponent={<View style={styles.empty}><Text style={styles.cardTitle}>No {title} found</Text><Text style={styles.muted}>The authorized API returned no records for this view and workspace.</Text></View>}
      initialNumToRender={12} windowSize={7} />}
    {structureMutation.isSuccess || refundMutation.isSuccess ? <Text style={styles.success}>The server accepted the last action; refreshing records.</Text> : null}
    {mutationError ? <Text style={styles.error}>{mutationError}</Text> : null}
    <View style={styles.footer}><Text style={styles.footerText}>Buttons are permission-gated for usability. Backend authorization, scope and state validation are authoritative.</Text></View>
    <Modal visible={Boolean(refundPayment || rejectStructure)} transparent animationType="slide" onRequestClose={closeModal}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>{refundPayment ? "Request a refund" : "Reject fee structure"}</Text>
          <Text style={styles.muted}>{refundPayment ? "The server validates the remaining refundable balance." : "A rejection reason is required; the structure will not become active."}</Text>
          {refundPayment ? <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="Refund amount"
            placeholderTextColor={colors.textMuted} style={styles.input} accessibilityLabel="Refund amount" /> : null}
          <TextInput value={reason} onChangeText={setReason} multiline placeholder={refundPayment ? "Reason for refund" : "Reason for rejection"}
            placeholderTextColor={colors.textMuted} style={[styles.input, styles.reasonInput]} accessibilityLabel={refundPayment ? "Reason for refund" : "Reason for rejection"} />
          {modalError ? <Text style={styles.error}>{modalError}</Text> : null}
          {refundMutation.isError && refundPayment ? <Text style={styles.error}>{refundMutation.error instanceof Error ? refundMutation.error.message : "Refund request failed."}</Text> : null}
          {structureMutation.isError && rejectStructure ? <Text style={styles.error}>{structureMutation.error instanceof Error ? structureMutation.error.message : "Rejection failed."}</Text> : null}
          <View style={styles.actions}><Button label="Cancel" secondary disabled={refundMutation.isPending || structureMutation.isPending} onPress={closeModal} />
            <Button label={refundPayment ? "Send request" : "Reject structure"} disabled={refundMutation.isPending || structureMutation.isPending} onPress={submitModal} /></View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  </View>;
}

function Button({ label, onPress, disabled, secondary }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}
    style={[styles.button, secondary ? styles.buttonSecondary : null, disabled ? styles.disabled : null]}>
    <Text style={[styles.buttonText, secondary ? styles.buttonTextSecondary : null]}>{label}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { color: colors.text, fontSize: 23, fontWeight: "900" }, subtitle: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 6 },
  tabs: { gap: 8, paddingTop: spacing.md, paddingBottom: spacing.xs },
  tab: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted },
  tabActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary }, tabText: { color: colors.textMuted, fontWeight: "800", fontSize: 12 }, tabTextActive: { color: colors.primary },
  list: { padding: spacing.lg, paddingBottom: spacing.md },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: 10 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  cardTitle: { flex: 1, color: colors.text, fontWeight: "900", fontSize: 15 },
  status: { fontSize: 10, textTransform: "uppercase", fontWeight: "900", paddingHorizontal: 8, paddingVertical: 5, borderRadius: radius.pill, overflow: "hidden" },
  good: { backgroundColor: colors.primarySoft, color: colors.primary }, pending: { backgroundColor: colors.surfaceMuted, color: colors.warning }, bad: { backgroundColor: colors.dangerSoft, color: colors.danger },
  detail: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 5 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  button: { backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 9, borderRadius: radius.sm },
  buttonText: { color: colors.white, fontSize: 11, fontWeight: "900" },
  buttonSecondary: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border }, buttonTextSecondary: { color: colors.text }, disabled: { opacity: 0.5 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 10, padding: spacing.xl },
  empty: { alignItems: "center", gap: 8, padding: spacing.xl, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md },
  muted: { color: colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: "center" }, mutedSmall: { color: colors.textMuted, fontSize: 11, marginTop: 9 },
  requestId: { color: colors.textMuted, fontSize: 11, marginTop: 4 }, primaryButton: { marginTop: 5 },
  success: { color: colors.success, fontSize: 11, marginHorizontal: spacing.lg, marginTop: 4 }, error: { color: colors.danger, fontSize: 12, marginTop: 6 },
  footer: { borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface, padding: spacing.md }, footerText: { color: colors.textMuted, fontSize: 10, lineHeight: 15, textAlign: "center" },
  backdrop: { flex: 1, backgroundColor: "rgba(10,20,14,0.45)", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  modal: { width: "100%", maxWidth: 480, backgroundColor: colors.surface, borderRadius: radius.lg, borderColor: colors.border, borderWidth: 1, padding: spacing.lg, gap: 10 },
  modalTitle: { color: colors.text, fontSize: 19, fontWeight: "900" }, input: { backgroundColor: colors.surface, color: colors.text, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 13, paddingVertical: 11, fontSize: 13 },
  reasonInput: { minHeight: 88, textAlignVertical: "top" }
});