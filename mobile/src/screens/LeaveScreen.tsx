import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "../api/client";
import { toCollection } from "../api/payload";
import { useAuth } from "../auth/AuthProvider";
import { useWorkspaceContext } from "../workspace/WorkspaceContextProvider";
import { colors, radius, spacing } from "../ui/theme";

type Status = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
type LeaveType = { id: string; name: string; code: string; annualQuota: number; applicableRoles?: string[]; isActive?: boolean };
type Balance = { leaveTypeId: string; name: string; code: string; annualQuota: number; used: number; pending: number; remaining: number | null };
type Applicant = { id: string; firstName?: string; lastName?: string; email?: string; roles?: string[] };
type LeaveRequest = {
  id: string; fromDate: string; toDate: string; days: number; reason: string; status: Status;
  decisionNote?: string | null; createdAt?: string; leaveType?: { id: string; name: string; code: string };
  applicant?: Applicant;
};
type Tab = "MINE" | "BALANCES" | "APPROVALS" | "ALL" | "TYPES";
const statuses: Status[] = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"];
const typeRoles = ["INSTITUTION_ADMIN","DIRECTOR","MANAGEMENT","HOD","FACULTY","STAFF","STUDENT"] as const;
function rows<T>(value: unknown): T[] { return toCollection(value) as T[]; }
function dateString(value: string): string {
 const d=new Date(value); if(Number.isNaN(d.valueOf())) return value;
 return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}
function validDate(s: string) { return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s+"T12:00:00").valueOf()); }
function personLabel(a?: Applicant) { return a ? [a.firstName,a.lastName].filter(Boolean).join(" ") || a.email || "Institution member" : "My request"; }

export function LeaveScreen() {
 const {user}=useAuth();
  const { context } = useWorkspaceContext();
  const workspaceKey = JSON.stringify(context?.scope ?? {}); const client=useQueryClient();
 const canApply=Boolean(user?.permissions.includes("leave.apply"));
 const canApprove=Boolean(user?.permissions.includes("leave.approve"));
 const canRead=Boolean(user?.permissions.includes("leave.read"));
 const canManage=Boolean(user?.permissions.includes("leave.manage"));
 const [tab,setTab]=useState<Tab>("MINE");
 const [filterStatus,setFilterStatus]=useState<Status|"ALL">("ALL");
 const [selectedType,setSelectedType]=useState<string|null>(null);
 const [fromDate,setFromDate]=useState(dateString(new Date().toISOString()));
 const [toDate,setToDate]=useState(dateString(new Date().toISOString()));
 const [reason,setReason]=useState("");
 const [decisionNote,setDecisionNote]=useState("");
 const [selectedDecisionId,setSelectedDecisionId]=useState<string|null>(null);
 const [typeName,setTypeName]=useState(""); const [typeCode,setTypeCode]=useState(""); const [quota,setQuota]=useState("12");
 const [applicableRoles,setApplicableRoles]=useState<string[]>([]);
 const [editType,setEditType]=useState<LeaveType|null>(null);

 const typesQuery=useQuery({
  queryKey:["leave-types",user?.id, workspaceKey,canManage],
  queryFn:()=>apiRequest<unknown>(canManage?"/leave/types/manage":"/leave/types"),
  enabled:Boolean(user?.id&&canApply),
  staleTime:15000
 });
 const balancesQuery=useQuery({queryKey:["leave-balances",user?.id, workspaceKey],queryFn:()=>apiRequest<unknown>("/leave/balances"),enabled:Boolean(user?.id&&canApply&&tab==="BALANCES"),staleTime:0});
 const mineQuery=useQuery({queryKey:["leave-mine",user?.id, workspaceKey,filterStatus,selectedType],queryFn:()=>apiRequest<unknown>("/leave/requests/mine?page=1&pageSize=50"+(filterStatus!=="ALL"?"&status="+filterStatus:"")+(selectedType?"&leaveTypeId="+encodeURIComponent(selectedType):"")),enabled:Boolean(user?.id&&canApply&&tab==="MINE"),staleTime:0});
 const approvalsQuery=useQuery({queryKey:["leave-approvals",user?.id, workspaceKey,filterStatus,selectedType],queryFn:()=>apiRequest<unknown>("/leave/requests/approvals?page=1&pageSize=50"+(filterStatus!=="ALL"?"&status="+filterStatus:"")+(selectedType?"&leaveTypeId="+encodeURIComponent(selectedType):"")),enabled:Boolean(user?.id&&canApprove&&tab==="APPROVALS"),staleTime:0});
 const allQuery=useQuery({queryKey:["leave-all",user?.id, workspaceKey,filterStatus,selectedType],queryFn:()=>apiRequest<unknown>("/leave/requests/all?page=1&pageSize=50"+(filterStatus!=="ALL"?"&status="+filterStatus:"")+(selectedType?"&leaveTypeId="+encodeURIComponent(selectedType):"")),enabled:Boolean(user?.id&&canRead&&tab==="ALL"),staleTime:0});
 const types=useMemo(()=>rows<LeaveType>(typesQuery.data).filter(x=>typeof x.id==="string"),[typesQuery.data]);
 const mine=useMemo(()=>rows<LeaveRequest>(mineQuery.data).filter(x=>typeof x.id==="string"),[mineQuery.data]);
 const approvals=useMemo(()=>rows<LeaveRequest>(approvalsQuery.data).filter(x=>typeof x.id==="string"),[approvalsQuery.data]);
 const all=useMemo(()=>rows<LeaveRequest>(allQuery.data).filter(x=>typeof x.id==="string"),[allQuery.data]);
 const balances=useMemo(()=>rows<Balance>(balancesQuery.data),[balancesQuery.data]);

 async function invalidate(){
  await Promise.all([
   client.invalidateQueries({queryKey:["leave-types",user?.id]}),
   client.invalidateQueries({queryKey:["leave-balances",user?.id]}),
   client.invalidateQueries({queryKey:["leave-mine",user?.id]}),
   client.invalidateQueries({queryKey:["leave-approvals",user?.id]}),
   client.invalidateQueries({queryKey:["leave-all",user?.id]}),
   client.invalidateQueries({queryKey:["my-work",user?.id]})
  ]);
 }
 const apply=useMutation({
  mutationFn:async()=>{
   if(!canApply) throw new Error("Your session does not include leave.apply.");
   if(!selectedType) throw new Error("Choose a leave type.");
   if(!validDate(fromDate)||!validDate(toDate)||toDate<fromDate) throw new Error("Enter valid dates; the end date must not precede the start date.");
   if(reason.trim().length<5||reason.trim().length>1000) throw new Error("Reason must contain 5–1,000 characters.");
   return apiRequest("/leave/requests",{method:"POST",body:JSON.stringify({leaveTypeId:selectedType,fromDate:new Date(fromDate+"T12:00:00").toISOString(),toDate:new Date(toDate+"T12:00:00").toISOString(),reason:reason.trim()})});
  },
  onSuccess:async()=>{await invalidate();setReason("");Alert.alert("Leave request submitted","The request was saved by ACADLYX. Its status is determined by the existing approval workflow.");}
 });
 const cancel=useMutation({
  mutationFn:(id:string)=>apiRequest("/leave/requests/"+encodeURIComponent(id)+"/cancel",{method:"POST"}),
  onSuccess:invalidate
 });
 const decide=useMutation({
  mutationFn:async(input:{id:string,decision:"APPROVED"|"REJECTED"})=>{
   if(!canApprove) throw new Error("Your session does not include leave.approve.");
   if(input.decision==="REJECTED"&&!decisionNote.trim()) throw new Error("A note is required when rejecting a leave request.");
   if(decisionNote.trim().length>500) throw new Error("Decision note must be at most 500 characters.");
   return apiRequest("/leave/requests/"+encodeURIComponent(input.id)+"/decision",{method:"POST",body:JSON.stringify({decision:input.decision,note:decisionNote.trim()||undefined})});
  },
  onSuccess:async()=>{setSelectedDecisionId(null);setDecisionNote("");await invalidate();}
 });
 const saveType=useMutation({
  mutationFn:async()=>{
   if(!canManage) throw new Error("Your session does not include leave.manage.");
   if(typeName.trim().length<2||typeName.trim().length>100) throw new Error("Name must contain 2–100 characters.");
   if(!editType&&(!/^[A-Za-z0-9_-]{1,20}$/.test(typeCode.trim()))) throw new Error("Code must be 1–20 letters, digits, underscore or hyphen.");
   const n=Number(quota); if(!Number.isInteger(n)||n<0||n>366) throw new Error("Annual quota must be a whole number from 0 to 366.");
   return editType
    ? apiRequest("/leave/types/"+encodeURIComponent(editType.id),{method:"PATCH",body:JSON.stringify({name:typeName.trim(),annualQuota:n,applicableRoles,isActive:editType.isActive})})
    : apiRequest("/leave/types",{method:"POST",body:JSON.stringify({name:typeName.trim(),code:typeCode.trim().toUpperCase(),annualQuota:n,applicableRoles})});
  },
  onSuccess:async()=>{setTypeName("");setTypeCode("");setQuota("12");setApplicableRoles([]);setEditType(null);await invalidate();}
 });
 const toggleType=useMutation({
  mutationFn:(type:LeaveType)=>apiRequest("/leave/types/"+encodeURIComponent(type.id),{method:"PATCH",body:JSON.stringify({isActive:!type.isActive})}),
  onSuccess:invalidate
 });
 const mutationError=apply.error||cancel.error||decide.error||saveType.error||toggleType.error;
 const tabs:Array<{id:Tab,label:string,visible:boolean}>=[
  {id:"MINE",label:"My requests",visible:canApply},
  {id:"BALANCES",label:"Balances",visible:canApply},
  {id:"APPROVALS",label:"Approvals",visible:canApprove},
  {id:"ALL",label:"All requests",visible:canRead},
  {id:"TYPES",label:"Leave types",visible:canManage}
 ];
 const currentQuery=tab==="MINE"?mineQuery:tab==="BALANCES"?balancesQuery:tab==="APPROVALS"?approvalsQuery:tab==="ALL"?allQuery:typesQuery;
 const requestRows=tab==="MINE"?mine:tab==="APPROVALS"?approvals:all;

 return <View style={styles.root}>
  <View style={styles.header}>
   <Text style={styles.title}>Leave management</Text>
   <Text style={styles.subtitle}>Requests, balances and decisions use the institution-scoped leave service and its existing approval authority.</Text>
   <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
    {tabs.filter(t=>t.visible).map(t=><Pressable key={t.id} onPress={()=>setTab(t.id)} style={[styles.tab,tab===t.id?styles.tabSelected:null]}><Text style={[styles.tabText,tab===t.id?styles.tabTextSelected:null]}>{t.label}</Text></Pressable>)}
   </ScrollView>
  </View>

  {tab==="MINE"&&canApply?<ScrollView style={styles.applyForm} contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
   <Text style={styles.sectionTitle}>Apply for leave</Text>
   <Text style={styles.label}>Leave type</Text>
   {typesQuery.isLoading?<ActivityIndicator color={colors.primary}/>:types.map(t=><Pressable key={t.id} onPress={()=>setSelectedType(t.id)} style={[styles.choice,selectedType===t.id?styles.choiceSelected:null]}><Text style={styles.choiceTitle}>{t.name} ({t.code})</Text><Text style={styles.meta}>Annual quota: {t.annualQuota===0?"Policy-defined":String(t.annualQuota)}{selectedType===t.id?" · Selected":""}</Text></Pressable>)}
   <Text style={styles.label}>From date (YYYY-MM-DD)</Text><TextInput value={fromDate} onChangeText={setFromDate} maxLength={10} style={styles.input} placeholder="2026-10-20" placeholderTextColor={colors.textMuted}/>
   <Text style={styles.label}>To date (YYYY-MM-DD)</Text><TextInput value={toDate} onChangeText={setToDate} maxLength={10} style={styles.input} placeholder="2026-10-21" placeholderTextColor={colors.textMuted}/>
   <Text style={styles.label}>Reason</Text><TextInput value={reason} onChangeText={setReason} maxLength={1000} multiline textAlignVertical="top" style={[styles.input,styles.textArea]} placeholder="Reason for leave (5–1,000 characters)" placeholderTextColor={colors.textMuted}/>
   <Text style={styles.helper}>The backend enforces backdating, maximum duration, overlapping requests and available balance.</Text>
   {apply.isError?<Text style={styles.error}>{apply.error instanceof ApiError?apply.error.message:apply.error instanceof Error?apply.error.message:"Could not apply for leave."}</Text>:null}
   <Pressable disabled={apply.isPending||!types.length} onPress={()=>apply.mutate()} style={[styles.primaryButton,!types.length?styles.disabled:null]}>{apply.isPending?<ActivityIndicator color={colors.white}/>:<Text style={styles.buttonText}>Submit leave request</Text>}</Pressable>
  </ScrollView>:null}

  {tab==="TYPES"&&canManage?<ScrollView style={styles.typePanel} contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
   <Text style={styles.sectionTitle}>{editType?"Edit leave type":"Create leave type"}</Text>
   {!editType?<><Text style={styles.label}>Code</Text><TextInput value={typeCode} onChangeText={setTypeCode} autoCapitalize="characters" maxLength={20} style={styles.input} placeholder="CL" placeholderTextColor={colors.textMuted}/></>:null}
   <Text style={styles.label}>Name</Text><TextInput value={typeName} onChangeText={setTypeName} maxLength={100} style={styles.input} placeholder="Casual Leave" placeholderTextColor={colors.textMuted}/>
   <Text style={styles.label}>Annual quota (0–366)</Text><TextInput value={quota} onChangeText={setQuota} keyboardType="number-pad" maxLength={3} style={styles.input} placeholder="12" placeholderTextColor={colors.textMuted}/>
   <Text style={styles.label}>Applicable roles</Text><View style={styles.roleRow}>{typeRoles.map(role=><Pressable key={role} onPress={()=>setApplicableRoles(prev=>prev.includes(role)?prev.filter(x=>x!==role):[...prev,role])} style={[styles.roleChip,applicableRoles.includes(role)?styles.choiceSelected:null]}><Text style={styles.roleText}>{role.replace(/_/g," ")}</Text></Pressable>)}</View>
   <View style={styles.actionRow}><Pressable onPress={()=>{setEditType(null);setTypeName("");setTypeCode("");setQuota("12");setApplicableRoles([]);}} style={styles.secondaryButton}><Text style={styles.secondaryText}>Clear form</Text></Pressable><Pressable disabled={saveType.isPending} onPress={()=>saveType.mutate()} style={styles.primaryButton}>{saveType.isPending?<ActivityIndicator color={colors.white}/>:<Text style={styles.buttonText}>{editType?"Save changes":"Create leave type"}</Text>}</Pressable></View>
   <Text style={styles.sectionTitle}>Configured leave types</Text>
   {types.map(t=><View key={t.id} style={styles.card}><Text style={styles.choiceTitle}>{t.name} ({t.code})</Text><Text style={styles.meta}>Quota {t.annualQuota} · {t.isActive===false?"Inactive":"Active"}</Text><View style={styles.actionRow}><Pressable onPress={()=>{setEditType(t);setTypeName(t.name);setQuota(String(t.annualQuota));setApplicableRoles(t.applicableRoles||[]);}} style={styles.secondaryButton}><Text style={styles.secondaryText}>Edit</Text></Pressable><Pressable disabled={toggleType.isPending} onPress={()=>toggleType.mutate(t)} style={styles.secondaryButton}><Text style={styles.secondaryText}>{t.isActive===false?"Activate":"Deactivate"}</Text></Pressable></View></View>)}
  </ScrollView>:null}

  {tab==="BALANCES"?<FlatList data={balances} keyExtractor={x=>x.leaveTypeId} contentContainerStyle={styles.list} renderItem={({item})=><View style={styles.card}><Text style={styles.choiceTitle}>{item.name} ({item.code})</Text><View style={styles.balanceRow}><View style={styles.balanceCell}><Text style={styles.balanceValue}>{String(item.used)}</Text><Text style={styles.meta}>Used</Text></View><View style={styles.balanceCell}><Text style={styles.balanceValue}>{String(item.pending)}</Text><Text style={styles.meta}>Pending</Text></View><View style={styles.balanceCell}><Text style={styles.balanceValue}>{item.remaining===null?"—":String(item.remaining)}</Text><Text style={styles.meta}>Remaining</Text></View></View></View>} ListEmptyComponent={<View style={styles.state}><Text style={styles.sectionTitle}>No balances returned</Text></View>}/>:null}

  {(tab==="MINE"||tab==="APPROVALS"||tab==="ALL")?<><View style={styles.filterRow}><Text style={styles.label}>Filter status</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}><Pressable onPress={()=>setFilterStatus("ALL")} style={[styles.tab,filterStatus==="ALL"?styles.tabSelected:null]}><Text style={[styles.tabText,filterStatus==="ALL"?styles.tabTextSelected:null]}>ALL</Text></Pressable>{statuses.map(st=><Pressable key={st} onPress={()=>setFilterStatus(st)} style={[styles.tab,filterStatus===st?styles.tabSelected:null]}><Text style={[styles.tabText,filterStatus===st?styles.tabTextSelected:null]}>{st}</Text></Pressable>)}</ScrollView></View>
   {currentQuery.isLoading?<View style={styles.state}><ActivityIndicator color={colors.primary}/><Text style={styles.subtitle}>Loading leave requests…</Text></View>:currentQuery.isError?<View style={styles.state}><Text style={styles.sectionTitle}>Leave requests unavailable</Text><Text style={styles.subtitle}>{currentQuery.error instanceof Error?currentQuery.error.message:"Try again."}</Text><Pressable onPress={()=>{void currentQuery.refetch();}} style={styles.primaryButton}><Text style={styles.buttonText}>Retry</Text></Pressable></View>:<FlatList data={requestRows} keyExtractor={x=>x.id} contentContainerStyle={styles.list} initialNumToRender={12} windowSize={7} renderItem={({item})=><View style={styles.card}>
    <View style={styles.requestTop}><Text style={styles.choiceTitle}>{item.leaveType?.name||"Leave request"} · {String(item.days)} day(s)</Text><Text style={styles.status}>{item.status}</Text></View>
    {tab!=="MINE"?<Text style={styles.meta}>Applicant: {personLabel(item.applicant)}</Text>:null}
    <Text style={styles.meta}>{dateString(item.fromDate)} – {dateString(item.toDate)}</Text><Text style={styles.body}>{item.reason}</Text>
    {item.decisionNote?<Text style={styles.meta}>Decision note: {item.decisionNote}</Text>:null}
    {tab==="MINE"&&item.status==="PENDING"?<Pressable onPress={()=>Alert.alert("Cancel leave request","Cancel this pending request?",[{text:"Keep request",style:"cancel"},{text:"Cancel request",style:"destructive",onPress:()=>cancel.mutate(item.id)}])} style={styles.secondaryButton}><Text style={styles.secondaryText}>Cancel request</Text></Pressable>:null}
    {tab==="APPROVALS"&&item.status==="PENDING"?<View style={styles.actions}><Pressable onPress={()=>{setSelectedDecisionId(item.id);setDecisionNote("");}} style={styles.secondaryButton}><Text style={styles.secondaryText}>{selectedDecisionId===item.id?"Decision note below":"Add decision note"}</Text></Pressable><Pressable onPress={()=>Alert.alert("Approve leave","Approve this request through the existing authority-checked workflow?",[{text:"Back",style:"cancel"},{text:"Approve",onPress:()=>decide.mutate({id:item.id,decision:"APPROVED"})}])} style={styles.primaryButton}><Text style={styles.buttonText}>Approve</Text></Pressable><Pressable onPress={()=>{setSelectedDecisionId(item.id);setDecisionNote("");}} style={styles.rejectButton}><Text style={styles.rejectText}>Reject</Text></Pressable></View>:null}
    {tab==="APPROVALS"&&selectedDecisionId===item.id?<View style={styles.decisionBox}><Text style={styles.label}>Decision note (required to reject)</Text><TextInput value={decisionNote} onChangeText={setDecisionNote} maxLength={500} multiline style={styles.input} placeholder="Reason for decision" placeholderTextColor={colors.textMuted}/><View style={styles.actionRow}><Pressable onPress={()=>decide.mutate({id:item.id,decision:"REJECTED"})} style={styles.rejectButton}><Text style={styles.rejectText}>Confirm rejection</Text></Pressable><Pressable onPress={()=>decide.mutate({id:item.id,decision:"APPROVED"})} style={styles.secondaryButton}><Text style={styles.secondaryText}>Approve with note</Text></Pressable></View></View>:null}
   </View>} ListEmptyComponent={<View style={styles.state}><Text style={styles.sectionTitle}>No matching requests</Text><Text style={styles.subtitle}>No requests were returned for your authorized scope and filters.</Text></View>}/>}
  </>:null}
  {mutationError?<View style={styles.errorBanner}><Text style={styles.error}>{mutationError instanceof ApiError?mutationError.message:mutationError instanceof Error?mutationError.message:"Leave action failed."}</Text></View>:null}
 </View>;
}

const styles=StyleSheet.create({
 root:{flex:1,backgroundColor:colors.canvas},header:{padding:spacing.lg,backgroundColor:colors.surface,borderBottomWidth:1,borderColor:colors.border,gap:8},
 title:{color:colors.text,fontSize:23,fontWeight:"900"},subtitle:{color:colors.textMuted,fontSize:12,lineHeight:18},
 tabs:{gap:7,paddingVertical:4},tab:{paddingHorizontal:12,paddingVertical:8,borderRadius:radius.pill,backgroundColor:colors.surfaceMuted},
 tabSelected:{backgroundColor:colors.primary},tabText:{color:colors.textMuted,fontWeight:"800",fontSize:10},tabTextSelected:{color:colors.white},
 applyForm:{maxHeight:420,backgroundColor:colors.surface,borderBottomWidth:1,borderColor:colors.border},typePanel:{maxHeight:470,backgroundColor:colors.surface,borderBottomWidth:1,borderColor:colors.border},
 form:{padding:spacing.lg,gap:7},sectionTitle:{color:colors.text,fontSize:16,fontWeight:"900"},label:{color:colors.text,fontSize:11,fontWeight:"800",marginTop:6},
 input:{borderWidth:1,borderColor:colors.border,borderRadius:radius.md,backgroundColor:colors.surface,color:colors.text,paddingHorizontal:12,paddingVertical:10,fontSize:13},
 textArea:{minHeight:80},helper:{color:colors.textMuted,fontSize:11,lineHeight:16},primaryButton:{backgroundColor:colors.primary,borderRadius:radius.md,minHeight:40,paddingHorizontal:12,paddingVertical:10,alignItems:"center",justifyContent:"center"},
 buttonText:{color:colors.white,fontSize:11,fontWeight:"900"},secondaryButton:{backgroundColor:colors.primarySoft,borderRadius:radius.sm,paddingHorizontal:11,paddingVertical:9,alignSelf:"flex-start"},
 secondaryText:{color:colors.primary,fontSize:10,fontWeight:"900"},rejectButton:{backgroundColor:colors.dangerSoft,borderWidth:1,borderColor:colors.danger,borderRadius:radius.sm,paddingHorizontal:11,paddingVertical:9,alignSelf:"flex-start"},
 rejectText:{color:colors.danger,fontWeight:"900",fontSize:10},disabled:{opacity:.45},choice:{borderWidth:1,borderColor:colors.border,borderRadius:radius.md,padding:10,marginBottom:5,backgroundColor:colors.surface},
 choiceSelected:{borderColor:colors.primary,backgroundColor:colors.primarySoft},choiceTitle:{color:colors.text,fontSize:13,fontWeight:"900"},meta:{color:colors.textMuted,fontSize:10,lineHeight:15,marginTop:4},
 body:{color:colors.text,fontSize:12,lineHeight:18,marginTop:5},list:{padding:spacing.lg,paddingBottom:30},card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,padding:spacing.lg,marginBottom:10},
 requestTop:{flexDirection:"row",justifyContent:"space-between",alignItems:"flex-start",gap:8},status:{color:colors.primary,backgroundColor:colors.primarySoft,borderRadius:radius.pill,overflow:"hidden",paddingHorizontal:8,paddingVertical:4,fontSize:9,fontWeight:"900"},
 filterRow:{paddingHorizontal:spacing.lg,paddingVertical:5,backgroundColor:colors.surface},actionRow:{flexDirection:"row",alignItems:"center",flexWrap:"wrap",gap:7,marginTop:7},actions:{flexDirection:"row",alignItems:"center",flexWrap:"wrap",gap:7,marginTop:8},
 decisionBox:{marginTop:8,padding:10,borderRadius:radius.md,backgroundColor:colors.surfaceMuted,gap:7},roleRow:{flexDirection:"row",flexWrap:"wrap",gap:5},roleChip:{paddingHorizontal:8,paddingVertical:7,borderWidth:1,borderColor:colors.border,borderRadius:radius.pill},roleText:{color:colors.textMuted,fontSize:9,fontWeight:"800"},
 balanceRow:{flexDirection:"row",justifyContent:"space-between",marginTop:15,gap:7},balanceCell:{flex:1,padding:10,borderRadius:radius.sm,backgroundColor:colors.surfaceMuted},balanceValue:{color:colors.text,fontSize:21,fontWeight:"900"},
 state:{flex:1,alignItems:"center",justifyContent:"center",padding:spacing.xl,gap:9},error:{color:colors.danger,fontSize:11,lineHeight:16},errorBanner:{padding:9,backgroundColor:colors.dangerSoft,borderTopWidth:1,borderColor:colors.border}
});
