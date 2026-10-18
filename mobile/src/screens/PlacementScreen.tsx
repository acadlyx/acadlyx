import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "../api/client";
import { toCollection } from "../api/payload";
import { useAuth } from "../auth/AuthProvider";
import { useWorkspaceContext } from "../workspace/WorkspaceContextProvider";
import { colors, radius, spacing } from "../ui/theme";

type RecordValue = Record<string, unknown>;
type Drive = RecordValue & { id: string; title?: string; status?: string; company?: { name?: string }; companyName?: string; applicationDeadline?: string; driveDate?: string; venue?: string };
type Opportunity = RecordValue & { id: string; title?: string; organization?: string; deadline?: string; description?: string };
type Offer = RecordValue & { id: string; status?: string; role?: string; company?: { name?: string }; joiningDate?: string };
type Eligibility = { eligible?: boolean; reasons?: string[]; missingAttributes?: string[]; message?: string };

function value(input: unknown): string | null {
  if (typeof input === "string" && input.trim()) return input;
  if (typeof input === "number") return String(input);
  return null;
}
function date(valueInput: unknown): string | null {
  const raw = value(valueInput); if (!raw) return null;
  const parsed = new Date(raw); return Number.isNaN(parsed.valueOf()) ? raw : parsed.toLocaleDateString();
}
function errorText(error: unknown) { return error instanceof ApiError ? error.message : error instanceof Error ? error.message : "This placement action could not be completed."; }

export function PlacementScreen() {
  const { user } = useAuth();
  const { context } = useWorkspaceContext();
  const workspaceKey = JSON.stringify(context?.scope ?? {});
  const client = useQueryClient();
  const [eligibility, setEligibility] = useState<Record<string, Eligibility | undefined>>({});
  const canApply = Boolean(user?.permissions.includes("placements.apply"));
  const canManage = Boolean(user?.permissions.includes("placements.manage"));
  const keys = ["placements", user?.id, workspaceKey];
  const drives = useQuery({ queryKey: [...keys, "drives"], queryFn: () => apiRequest<unknown>("/placements/drives?page=1&pageSize=50"), enabled: Boolean(user?.id), staleTime: 10000 });
  const opportunities = useQuery({ queryKey: [...keys, "opportunities"], queryFn: () => apiRequest<unknown>("/placements/opportunities"), enabled: Boolean(user?.id), staleTime: 10000 });
  const offers = useQuery({ queryKey: [...keys, "offers"], queryFn: () => apiRequest<unknown>("/placements/offers"), enabled: Boolean(user?.id), staleTime: 10000 });
  const calendar = useQuery({ queryKey: [...keys, "calendar"], queryFn: () => apiRequest<unknown>("/placements/my-calendar"), enabled: Boolean(user?.id), staleTime: 10000 });
  const metrics = useQuery({ queryKey: [...keys, "metrics"], queryFn: () => apiRequest<RecordValue>("/placements/metrics"), enabled: Boolean(user?.id), staleTime: 10000 });
  const invalidate = () => client.invalidateQueries({ queryKey: keys });
  const applyDrive = useMutation({ mutationFn: (id: string) => apiRequest("/placements/drives/" + id + "/apply", { method: "POST" }), onSuccess: invalidate });
  const applyOpportunity = useMutation({ mutationFn: (id: string) => apiRequest("/placements/opportunities/" + id + "/apply", { method: "POST" }), onSuccess: invalidate });

  const driveRows = useMemo(() => toCollection(drives.data).filter((row): row is Drive => typeof row === "object" && row !== null && typeof (row as Drive).id === "string"), [drives.data]);
  const opportunityRows = useMemo(() => toCollection(opportunities.data).filter((row): row is Opportunity => typeof row === "object" && row !== null && typeof (row as Opportunity).id === "string"), [opportunities.data]);
  const offerRows = useMemo(() => toCollection(offers.data).filter((row): row is Offer => typeof row === "object" && row !== null && typeof (row as Offer).id === "string"), [offers.data]);
  const loading = drives.isLoading || opportunities.isLoading;
  const refresh = () => { void drives.refetch(); void opportunities.refetch(); void offers.refetch(); void calendar.refetch(); void metrics.refetch(); };

  async function inspectEligibility(id: string) {
    try { const result = await apiRequest<Eligibility>("/placements/drives/" + id + "/eligibility"); setEligibility((current) => ({ ...current, [id]: result })); }
    catch (issue) { Alert.alert("Eligibility unavailable", errorText(issue)); }
  }
  function confirmDrive(drive: Drive) {
    Alert.alert("Register for drive", "Submit your placement registration for " + (drive.title || "this drive") + "?", [{ text: "Cancel", style: "cancel" }, { text: "Register", onPress: () => applyDrive.mutate(drive.id) }]);
  }
  function confirmOpportunity(item: Opportunity) {
    Alert.alert("Apply", "Submit your application for " + (item.title || "this opportunity") + "?", [{ text: "Cancel", style: "cancel" }, { text: "Apply", onPress: () => applyOpportunity.mutate(item.id) }]);
  }
  const actionError = applyDrive.error || applyOpportunity.error;

  return <ScrollView style={styles.root} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={drives.isRefetching || opportunities.isRefetching} onRefresh={refresh} tintColor={colors.primary} />}>
    <View style={styles.hero}><Text style={styles.eyebrow}>CAREER & PLACEMENT</Text><Text style={styles.title}>Placement workspace</Text><Text style={styles.subtitle}>{canManage ? "Manage drives, candidates and outcomes in your authorized scope." : "Review opportunities relevant to your academic profile and track your applications."}</Text></View>
    {actionError ? <View style={styles.error}><Text accessibilityRole="alert" style={styles.errorText}>{errorText(actionError)}</Text></View> : null}
    {metrics.data ? <View style={styles.metrics}>{Object.entries(metrics.data).filter(([, v]) => typeof v === "number").slice(0, 4).map(([label, count]) => <View style={styles.metric} key={label}><Text style={styles.metricValue}>{String(count)}</Text><Text style={styles.metricLabel}>{label.replace(/([A-Z])/g, " $1")}</Text></View>)}</View> : null}
    <Text style={styles.heading}>Placement drives</Text>
    {loading ? <View style={styles.state}><ActivityIndicator color={colors.primary} /><Text style={styles.muted}>Loading authorized placement opportunities…</Text></View> : driveRows.length ? driveRows.map((drive) => <View style={styles.card} key={drive.id}><Text style={styles.cardTitle}>{drive.title || "Placement drive"}</Text><Text style={styles.detail}>{drive.company?.name || drive.companyName || "Company details available in the drive"}</Text>{date(drive.applicationDeadline) ? <Text style={styles.detail}>Apply by {date(drive.applicationDeadline)}</Text> : null}{date(drive.driveDate) ? <Text style={styles.detail}>Drive date {date(drive.driveDate)}</Text> : null}{drive.venue ? <Text style={styles.detail}>{drive.venue}</Text> : null}<Text style={styles.status}>{value(drive.status) || "OPEN"}</Text>{canApply ? <View style={styles.actions}><Pressable accessibilityRole="button" onPress={() => { void inspectEligibility(drive.id); }} style={styles.secondary}><Text style={styles.secondaryText}>Check eligibility</Text></Pressable><Pressable accessibilityRole="button" disabled={applyDrive.isPending} onPress={() => confirmDrive(drive)} style={[styles.primary, applyDrive.isPending ? styles.disabled : null]}><Text style={styles.primaryText}>Register</Text></Pressable></View> : null}{eligibility[drive.id] ? <View style={eligibility[drive.id]?.eligible ? styles.eligible : styles.ineligible}><Text style={styles.eligibilityTitle}>{eligibility[drive.id]?.eligible ? "Eligible to register" : "Action needed before registration"}</Text>{[...(eligibility[drive.id]?.reasons || []), ...(eligibility[drive.id]?.missingAttributes || [])].map((reason) => <Text key={reason} style={styles.detail}>• {reason}</Text>)}{eligibility[drive.id]?.message ? <Text style={styles.detail}>{eligibility[drive.id]?.message}</Text> : null}</View> : null}</View>) : <View style={styles.state}><Text style={styles.stateTitle}>No placement drives found</Text><Text style={styles.muted}>No drives are currently available in your authorized scope.</Text></View>}
    <Text style={styles.heading}>Job opportunities</Text>
    {opportunityRows.map((item) => <View style={styles.card} key={item.id}><Text style={styles.cardTitle}>{item.title || "Opportunity"}</Text>{item.organization ? <Text style={styles.detail}>{item.organization}</Text> : null}{item.description ? <Text style={styles.detail} numberOfLines={3}>{item.description}</Text> : null}{date(item.deadline) ? <Text style={styles.detail}>Deadline {date(item.deadline)}</Text> : null}{canApply ? <Pressable accessibilityRole="button" disabled={applyOpportunity.isPending} onPress={() => confirmOpportunity(item)} style={[styles.primary, applyOpportunity.isPending ? styles.disabled : null]}><Text style={styles.primaryText}>Apply</Text></Pressable> : null}</View>)}
    {offerRows.length ? <><Text style={styles.heading}>Offers & joining</Text>{offerRows.map((offer) => <View style={styles.card} key={offer.id}><Text style={styles.cardTitle}>{offer.role || "Placement offer"}</Text><Text style={styles.detail}>{offer.company?.name || "Offer details"}</Text>{offer.status ? <Text style={styles.status}>{offer.status}</Text> : null}{date(offer.joiningDate) ? <Text style={styles.detail}>Joining {date(offer.joiningDate)}</Text> : null}</View>)}</> : null}
    {toCollection(calendar.data).length ? <><Text style={styles.heading}>Upcoming placement calendar</Text>{toCollection(calendar.data).slice(0, 8).map((item, index) => <View style={styles.calendar} key={String((item as RecordValue)?.id || index)}><Text style={styles.cardTitle}>{value((item as RecordValue)?.title) || "Placement event"}</Text><Text style={styles.detail}>{date((item as RecordValue)?.startsAt || (item as RecordValue)?.scheduledAt) || "Schedule details available in the event"}</Text></View>)}</> : null}
    <Text style={styles.footnote}>Eligibility is evaluated by the placement API against your real academic profile. Missing academic data is shown as an actionable status rather than inferred by the app.</Text>
  </ScrollView>;
}

const styles = StyleSheet.create({ root:{flex:1,backgroundColor:colors.canvas},content:{padding:spacing.lg,paddingBottom:36},hero:{backgroundColor:colors.surface,borderColor:colors.border,borderWidth:1,borderRadius:radius.lg,padding:spacing.xl},eyebrow:{color:colors.primary,fontSize:10,fontWeight:"900",letterSpacing:1},title:{color:colors.text,fontSize:25,fontWeight:"900",marginTop:7},subtitle:{color:colors.textMuted,fontSize:13,lineHeight:20,marginTop:7},heading:{color:colors.text,fontWeight:"900",fontSize:18,marginTop:22,marginBottom:10},metrics:{flexDirection:"row",flexWrap:"wrap",gap:8,marginTop:12},metric:{flexGrow:1,flexBasis:"42%",backgroundColor:colors.surface,borderColor:colors.border,borderWidth:1,borderRadius:radius.md,padding:12},metricValue:{color:colors.text,fontSize:21,fontWeight:"900"},metricLabel:{color:colors.textMuted,fontSize:10,marginTop:3,textTransform:"capitalize"},card:{backgroundColor:colors.surface,borderColor:colors.border,borderWidth:1,borderRadius:radius.md,padding:spacing.lg,marginBottom:9,gap:6},cardTitle:{color:colors.text,fontWeight:"900",fontSize:15},detail:{color:colors.textMuted,fontSize:12,lineHeight:18},status:{color:colors.primary,fontWeight:"900",fontSize:10,textTransform:"uppercase",marginTop:2},actions:{flexDirection:"row",gap:8,marginTop:7},primary:{alignSelf:"flex-start",backgroundColor:colors.primary,borderRadius:radius.sm,paddingHorizontal:14,paddingVertical:10,marginTop:7},primaryText:{color:colors.white,fontSize:12,fontWeight:"900"},secondary:{alignSelf:"flex-start",backgroundColor:colors.primarySoft,borderRadius:radius.sm,paddingHorizontal:12,paddingVertical:10,marginTop:7},secondaryText:{color:colors.primary,fontSize:12,fontWeight:"900"},disabled:{opacity:.6},state:{backgroundColor:colors.surface,borderColor:colors.border,borderWidth:1,borderRadius:radius.md,padding:spacing.xl,alignItems:"center",gap:8},stateTitle:{color:colors.text,fontWeight:"900",fontSize:15},muted:{color:colors.textMuted,fontSize:12,lineHeight:18,textAlign:"center"},error:{backgroundColor:colors.dangerSoft,borderColor:colors.danger,borderWidth:1,borderRadius:radius.md,padding:spacing.md,marginTop:10},errorText:{color:colors.danger,fontSize:12,lineHeight:18},eligible:{backgroundColor:colors.primarySoft,borderRadius:radius.sm,padding:10,marginTop:4,gap:3},ineligible:{backgroundColor:colors.dangerSoft,borderRadius:radius.sm,padding:10,marginTop:4,gap:3},eligibilityTitle:{color:colors.text,fontWeight:"900",fontSize:12},calendar:{backgroundColor:colors.surfaceMuted,borderRadius:radius.md,padding:spacing.md,marginBottom:7,gap:4},footnote:{color:colors.textMuted,fontSize:10,lineHeight:16,textAlign:"center",marginTop:18} });
