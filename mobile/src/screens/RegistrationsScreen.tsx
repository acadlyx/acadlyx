import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiRequest } from "../api/client";
import { displayValue, recordTitle, safeRecordEntries, toCollection } from "../api/payload";
import { useAuth } from "../auth/AuthProvider";
import { useWorkspaceContext } from "../workspace/WorkspaceContextProvider";
import { colors, radius, spacing } from "../ui/theme";

type Row = Record<string, unknown>;
const PAGE_SIZE=50;
const statusOptions=["ALL","REQUESTED","APPROVED","REJECTED","NEEDS_CORRECTION","DROPPED"] as const;
type FilterStatus=typeof statusOptions[number];
type Decision="APPROVED"|"REJECTED"|"NEEDS_CORRECTION";
function object(value:unknown):Row{return value&&typeof value==="object"&&!Array.isArray(value)?value as Row:{};}
function idOf(value:Row):string{return typeof value.id==="string"?value.id:"";}
function text(value:unknown):string{return value===null||value===undefined?"":String(value);}
function errorText(value:unknown):string{return value instanceof ApiError?value.message:value instanceof Error?value.message:"The request failed. Try again.";}
function relatedTitle(row:Row):string {
  const offering=object(row.courseOffering);const course=object(offering.course);const semester=object(offering.semester);
  const student=object(row.student);
  const courseName=[text(course.code),text(course.name)].filter(Boolean).join(" · ");
  return courseName||text(row.courseName)||text(row.title)||text(student.email)||recordTitle(row,"Registration");
}
function labelOf(row:Row):string {
  const course=object(row.course);const section=object(row.section);
  return [text(course.code)||text(row.code),text(course.name)||text(row.name),text(section.name)?("Section "+text(section.name)):""].filter(Boolean).join(" · ")||recordTitle(row,"Course offering");
}
export function RegistrationsScreen(){
  const {user}=useAuth();
  const {context}=useWorkspaceContext();
  const workspaceKey=JSON.stringify(context?.scope??{});
  const client=useQueryClient();
  const permissions=user?.permissions??[];
  const isStudent=Boolean(user?.roles?.includes("STUDENT"));
  const canRead=permissions.includes("registration.read");
  const canSubmit=permissions.includes("registration.submit");
  const canApprove=permissions.includes("registration.approve");
  const [status,setStatus]=useState<FilterStatus>("ALL");
  const [page,setPage]=useState(1);
  const [search,setSearch]=useState("");
  const [selectedId,setSelectedId]=useState("");
  const [decision,setDecision]=useState<Decision>("APPROVED");
  const [remarks,setRemarks]=useState("");
  const [dropReason,setDropReason]=useState("");
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");

  const listQuery=useQuery({
    queryKey:["registrations",user?.id,workspaceKey,page,status],
    queryFn:()=>apiRequest<unknown>("/registrations?page="+page+"&pageSize="+PAGE_SIZE+(status!=="ALL"?"&status="+status:"")),
    enabled:Boolean(user?.id&&canRead),
    staleTime:0
  });
  const mineQuery=useQuery({
    queryKey:["registration-mine",user?.id,workspaceKey],
    queryFn:()=>apiRequest<unknown>("/registrations/mine"),
    enabled:Boolean(user?.id&&isStudent&&canSubmit),
    staleTime:0
  });
  const offeringsQuery=useQuery({
    queryKey:["registration-available",user?.id,workspaceKey],
    queryFn:()=>apiRequest<unknown>("/registrations/offerings/available?page=1&pageSize=100"),
    enabled:Boolean(user?.id&&isStudent&&canSubmit),
    staleTime:0
  });
  const rows=useMemo(()=>toCollection(listQuery.data).map(object),[listQuery.data]);
  const minePayload=object(mineQuery.data);
  const ownRows=useMemo(()=>Array.isArray(minePayload.items)?minePayload.items.map(object):[],[minePayload.items]);
  const available=useMemo(()=>toCollection(offeringsQuery.data).map(object),[offeringsQuery.data]);
  const selected=rows.find(row=>idOf(row)===selectedId)||ownRows.find(row=>idOf(row)===selectedId)||null;
  const registeredCredits=typeof minePayload.registeredCredits==="number"?minePayload.registeredCredits:null;
  const minCredits=typeof minePayload.minCredits==="number"?minePayload.minCredits:null;
  const maxCredits=typeof minePayload.maxCredits==="number"?minePayload.maxCredits:null;

  const invalidate=async()=>{
    await Promise.all([
      client.invalidateQueries({queryKey:["registrations",user?.id]}),
      client.invalidateQueries({queryKey:["registration-mine",user?.id]}),
      client.invalidateQueries({queryKey:["registration-available",user?.id]}),
      client.invalidateQueries({queryKey:["module",user?.id]}),
      client.invalidateQueries({queryKey:["dashboard-work",user?.id]})
    ]);
  };
  const registerMutation=useMutation({
    mutationFn:async(offering:Row)=>{
      if(!user||!isStudent||!canSubmit)throw new Error("Only an authorized Student workspace can submit self-registration.");
      const offeringId=idOf(offering);
      if(!offeringId)throw new Error("The selected offering has no valid record identifier.");
      return apiRequest<unknown>("/registrations",{method:"POST",body:JSON.stringify({courseOfferingId:offeringId})});
    },
    onSuccess:async()=>{setMessage("Registration request submitted.");setError("");await invalidate();},
    onError:(reason:unknown)=>setError(errorText(reason))
  });
  const decisionMutation=useMutation({
    mutationFn:async()=> {
      if(!canApprove||!selectedId)throw new Error("Registration approval permission is not granted.");
      if(decision!=="APPROVED"&&!remarks.trim())throw new Error("Remarks are required when rejecting or requesting correction.");
      return apiRequest<unknown>("/registrations/"+encodeURIComponent(selectedId)+"/decision",{method:"POST",body:JSON.stringify({decision,remarks:remarks.trim()||undefined})});
    },
    onSuccess:async()=>{setMessage("Registration decision saved.");setError("");setRemarks("");await invalidate();},
    onError:(reason:unknown)=>setError(errorText(reason))
  });
  const dropMutation=useMutation({
    mutationFn:async(row:Row)=>{
      if(!isStudent||!canSubmit)throw new Error("Only the active Student workspace may drop its own registration.");
      const id=idOf(row);if(!id)throw new Error("Registration identifier is unavailable.");
      return apiRequest<unknown>("/registrations/"+encodeURIComponent(id)+"/drop",{method:"POST",body:JSON.stringify({reason:dropReason.trim()||undefined})});
    },
    onSuccess:async()=>{setMessage("Registration drop request completed.");setError("");setDropReason("");await invalidate();},
    onError:(reason:unknown)=>setError(errorText(reason))
  });

  const visibleRows=useMemo(()=>{
    const base=rows.filter(row=>status==="ALL"||text(row.status)===status);
    const q=search.trim().toLowerCase();
    return q?base.filter(row=>JSON.stringify(row).toLowerCase().includes(q)):base;
  },[rows,status,search]);
  const selectRecord=(row:Row)=>{setSelectedId(idOf(row));setRemarks("");setError("");setMessage("");};
  const canDrop=(row:Row)=>isStudent&&canSubmit&&["REQUESTED","APPROVED"].includes(text(row.status));
  const renderRecord=(row:Row,index:number,own=false)=>{
    const id=idOf(row);const active=selectedId===id;
    const offering=object(row.courseOffering);const course=object(offering.course);const student=object(row.student);
    return <View key={id||String(index)} style={[styles.card,active?styles.selectedCard:null]}>
      <Pressable accessibilityRole="button" accessibilityState={{selected:active}} onPress={()=>selectRecord(row)} style={styles.rowHead}>
        <View style={{flex:1,gap:3}}><Text style={styles.recordTitle}>{relatedTitle(row)}</Text><Text style={styles.muted}>{own?"My registration":(text(student.firstName)+" "+text(student.lastName)).trim()||text(student.email)||"Student record"} · {text(row.createdAt).slice(0,10)||"Date unavailable"}</Text></View>
        <Text style={[styles.status,styles["status_"+(text(row.status)||"UNKNOWN") as keyof typeof styles] as object]}>{text(row.status)||"UNKNOWN"}</Text>
      </Pressable>
      {active?<View style={styles.details}>
        {safeRecordEntries(row).filter(([key])=>!["id","studentId","courseOfferingId","institutionId"].includes(key)).slice(0,14).map(([key,value])=><View key={key} style={styles.detailLine}><Text style={styles.detailLabel}>{key.replace(/([A-Z])/g," $1").replace(/[_-]/g," ")}</Text><Text style={styles.detailValue}>{displayValue(value)}</Text></View>)}
        {canApprove&&!own&&["REQUESTED","NEEDS_CORRECTION"].includes(text(row.status))?<View style={styles.decisionBox}>
          <Text style={styles.fieldLabel}>Decision</Text><View style={styles.choices}>{(["APPROVED","REJECTED","NEEDS_CORRECTION"] as const).map(value=><Pressable key={value} accessibilityRole="button" accessibilityState={{selected:decision===value}} onPress={()=>setDecision(value)} style={[styles.choice,decision===value?styles.choiceSelected:null]}><Text style={[styles.choiceText,decision===value?styles.choiceSelectedText:null]}>{value.replace(/_/g," ")}</Text></Pressable>)}</View>
          {decision!=="APPROVED"?<TextInput accessibilityLabel="Decision remarks" value={remarks} onChangeText={setRemarks} style={styles.input} placeholder="Required remarks for rejection/correction" placeholderTextColor={colors.textMuted} multiline/>:null}
          <Pressable accessibilityRole="button" disabled={decisionMutation.isPending} onPress={()=>decisionMutation.mutate()} style={[styles.primary,decisionMutation.isPending?styles.disabled:null]}><Text style={styles.primaryText}>{decisionMutation.isPending?"Saving…":"Save decision"}</Text></Pressable>
        </View>:null}
        {canDrop(row)?<View style={styles.decisionBox}><TextInput accessibilityLabel="Drop reason" value={dropReason} onChangeText={setDropReason} style={styles.input} placeholder="Reason for dropping (optional)" placeholderTextColor={colors.textMuted}/><Pressable accessibilityRole="button" disabled={dropMutation.isPending} onPress={()=>Alert.alert("Drop registration?","The server validates the registration state and the active student identity.",[{text:"Cancel",style:"cancel"},{text:"Drop",style:"destructive",onPress:()=>dropMutation.mutate(row)}])} style={styles.danger}><Text style={styles.dangerText}>{dropMutation.isPending?"Processing…":"Drop registration"}</Text></Pressable></View>:null}
      </View>:null}
    </View>;
  };

  return <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={listQuery.isRefetching||mineQuery.isRefetching||offeringsQuery.isRefetching} onRefresh={()=>{if(canRead)void listQuery.refetch();if(isStudent&&canSubmit){void mineQuery.refetch();void offeringsQuery.refetch();}}} tintColor={colors.primary}/>}>
    <View style={styles.header}><Text style={styles.eyebrow}>ACADEMIC REGISTRATION</Text><Text style={styles.title}>Course registrations</Text><Text style={styles.muted}>Course requests, approval decisions and drops use the canonical registration lifecycle. The server remains responsible for semester, section, capacity and credit checks.</Text></View>
    {message?<Text style={styles.success}>{message}</Text>:null}
    {error?<View accessibilityRole="alert" style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>:null}
    {isStudent&&canSubmit?<View style={styles.summary}>
      <Text style={styles.sectionTitle}>My semester registration</Text>
      {mineQuery.isLoading?<ActivityIndicator color={colors.primary}/>:mineQuery.isError?<Text style={styles.errorText}>{errorText(mineQuery.error)}</Text>:<View style={styles.choices}>
        {registeredCredits!==null?<View style={styles.metric}><Text style={styles.metricValue}>{registeredCredits}</Text><Text style={styles.muted}>Registered credits</Text></View>:null}
        {minCredits!==null?<View style={styles.metric}><Text style={styles.metricValue}>{minCredits}</Text><Text style={styles.muted}>Minimum credits</Text></View>:null}
        {maxCredits!==null?<View style={styles.metric}><Text style={styles.metricValue}>{maxCredits}</Text><Text style={styles.muted}>Maximum credits</Text></View>:null}
        {typeof minePayload.meetsMinimum==="boolean"?<Text style={[styles.muted,minePayload.meetsMinimum?styles.positive:styles.negative]}>{minePayload.meetsMinimum?"Minimum credit threshold met":"Minimum credit threshold not yet met"}</Text>:null}
      </View>}
      <Text style={styles.formTitle}>Available course offerings</Text>
      {offeringsQuery.isLoading?<ActivityIndicator color={colors.primary}/>:offeringsQuery.isError?<Text style={styles.errorText}>{errorText(offeringsQuery.error)}</Text>:available.length?available.map((offering,index)=>{
        const id=idOf(offering);const course=object(offering.course);const section=object(offering.section);
        return <View key={id||String(index)} style={styles.offering}><View style={{flex:1,gap:3}}><Text style={styles.recordTitle}>{labelOf(offering)}</Text><Text style={styles.muted}>{text(course.credits)} credits · {text(section.name)||"Section not assigned"}</Text><Text style={styles.muted}>{offering.registrationOpen===false?"Registration closed":"Registration availability determined by server"}</Text></View><Pressable accessibilityRole="button" disabled={registerMutation.isPending||offering.registrationOpen===false} onPress={()=>registerMutation.mutate(offering)} style={[styles.primary,registerMutation.isPending||offering.registrationOpen===false?styles.disabled:null]}><Text style={styles.primaryText}>{registerMutation.isPending&&registerMutation.variables===offering?"Submitting…":"Register"}</Text></Pressable></View>;
      }):<Text style={styles.muted}>No eligible offerings were returned for your active enrollment context.</Text>}
      {ownRows.length?<><Text style={styles.formTitle}>My requests</Text>{ownRows.map((row,index)=>renderRecord(row,index,true))}</>:null}
    </View>:null}
    {canRead?<View style={styles.section}>
      <Text style={styles.sectionTitle}>Authorized registration queue</Text>
      <TextInput accessibilityLabel="Search registrations" value={search} onChangeText={setSearch} style={styles.input} placeholder="Search loaded registrations" placeholderTextColor={colors.textMuted}/>
      <View style={styles.choices}>{statusOptions.map(value=><Pressable key={value} accessibilityRole="button" accessibilityState={{selected:status===value}} onPress={()=>{setStatus(value);setPage(1);}} style={[styles.choice,status===value?styles.choiceSelected:null]}><Text style={[styles.choiceText,status===value?styles.choiceSelectedText:null]}>{value==="ALL"?"All statuses":value.replace(/_/g," ")}</Text></Pressable>)}</View>
      {listQuery.isLoading?<View style={styles.state}><ActivityIndicator color={colors.primary}/><Text style={styles.muted}>Loading registration records…</Text></View>:null}
      {listQuery.isError?<View style={styles.state}><Text style={styles.sectionTitle}>{listQuery.error instanceof ApiError&&listQuery.error.status===403?"Access not granted":"Registration queue unavailable"}</Text><Text style={styles.errorText}>{errorText(listQuery.error)}</Text><Pressable onPress={()=>{void listQuery.refetch();}} style={styles.secondary}><Text style={styles.secondaryText}>Retry</Text></Pressable></View>:null}
      {!listQuery.isLoading&&!listQuery.isError&&!visibleRows.length?<View style={styles.state}><Text style={styles.sectionTitle}>No matching registrations</Text><Text style={styles.muted}>The authorized query returned no rows for these filters.</Text></View>:null}
      {visibleRows.map((row,index)=>renderRecord(row,index,false))}
      {!listQuery.isLoading&&!listQuery.isError?<View style={styles.pagination}><Pressable accessibilityRole="button" disabled={page<=1} onPress={()=>setPage(v=>Math.max(1,v-1))} style={[styles.secondary,page<=1?styles.disabled:null]}><Text style={styles.secondaryText}>Previous</Text></Pressable><Text style={styles.muted}>Page {page}</Text><Pressable accessibilityRole="button" disabled={rows.length<PAGE_SIZE} onPress={()=>setPage(v=>v+1)} style={[styles.secondary,rows.length<PAGE_SIZE?styles.disabled:null]}><Text style={styles.secondaryText}>Next</Text></Pressable></View>:null}
    </View>:null}
    {!canRead&&!canSubmit?<View style={styles.state}><Text style={styles.sectionTitle}>Registration access not granted</Text><Text style={styles.muted}>The active session has neither registration.read nor registration.submit.</Text></View>:null}
  </ScrollView>;
}

const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:colors.canvas},content:{paddingBottom:spacing.xl},header:{padding:spacing.lg,gap:8},eyebrow:{fontSize:10,fontWeight:"900",letterSpacing:1.4,color:colors.primary},title:{fontSize:24,fontWeight:"900",color:colors.text},muted:{fontSize:12,lineHeight:18,color:colors.textMuted},positive:{color:colors.success,fontWeight:"800"},negative:{color:colors.danger,fontWeight:"800"},summary:{marginHorizontal:spacing.lg,marginBottom:spacing.lg,padding:spacing.md,borderWidth:1,borderColor:colors.border,borderRadius:radius.lg,backgroundColor:colors.surface,gap:10},section:{paddingHorizontal:spacing.lg,gap:9},sectionTitle:{fontSize:17,fontWeight:"900",color:colors.text},formTitle:{fontSize:14,fontWeight:"900",color:colors.text,marginTop:8},choices:{flexDirection:"row",flexWrap:"wrap",gap:6},choice:{borderWidth:1,borderColor:colors.border,borderRadius:radius.md,paddingHorizontal:8,paddingVertical:7},choiceSelected:{borderColor:colors.primary,backgroundColor:colors.primarySoft},choiceText:{fontSize:10,fontWeight:"800",color:colors.textMuted},choiceSelectedText:{color:colors.primary},input:{borderWidth:1,borderColor:colors.border,borderRadius:radius.md,paddingHorizontal:11,paddingVertical:10,color:colors.text,backgroundColor:colors.surface,fontSize:12},primary:{backgroundColor:colors.primary,borderRadius:radius.md,paddingHorizontal:12,paddingVertical:9,alignItems:"center",justifyContent:"center"},primaryText:{fontSize:11,fontWeight:"900",color:colors.white},secondary:{borderWidth:1,borderColor:colors.border,borderRadius:radius.md,paddingHorizontal:11,paddingVertical:9,alignItems:"center",justifyContent:"center"},secondaryText:{fontSize:11,fontWeight:"800",color:colors.text},danger:{borderWidth:1,borderColor:colors.danger,borderRadius:radius.md,paddingHorizontal:10,paddingVertical:8},dangerText:{fontSize:11,fontWeight:"900",color:colors.danger},disabled:{opacity:.45},metric:{padding:10,minWidth:95,backgroundColor:colors.surfaceMuted,borderRadius:radius.md},metricValue:{fontSize:18,fontWeight:"900",color:colors.text},offering:{flexDirection:"row",alignItems:"center",gap:8,padding:spacing.md,borderWidth:1,borderColor:colors.border,borderRadius:radius.md},card:{marginTop:8,padding:spacing.md,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,backgroundColor:colors.surface},selectedCard:{borderColor:colors.primary},rowHead:{flexDirection:"row",alignItems:"flex-start",gap:8},recordTitle:{fontSize:12,fontWeight:"900",color:colors.text},status:{fontSize:9,fontWeight:"900",paddingHorizontal:7,paddingVertical:4,borderRadius:radius.pill,overflow:"hidden",color:colors.textMuted,backgroundColor:colors.surfaceMuted},status_REQUESTED:{color:colors.warning},status_APPROVED:{color:colors.success,backgroundColor:colors.primarySoft},status_REJECTED:{color:colors.danger},status_NEEDS_CORRECTION:{color:colors.warning},status_DROPPED:{color:colors.textMuted},details:{marginTop:9,paddingTop:8,borderTopWidth:1,borderTopColor:colors.border,gap:8},detailLine:{borderBottomWidth:1,borderBottomColor:colors.surfaceMuted,paddingBottom:5},detailLabel:{fontSize:9,fontWeight:"900",color:colors.textMuted,textTransform:"uppercase"},detailValue:{fontSize:12,color:colors.text,lineHeight:17,marginTop:2},decisionBox:{padding:spacing.sm,backgroundColor:colors.surfaceMuted,borderRadius:radius.md,gap:8},fieldLabel:{fontSize:11,fontWeight:"900",color:colors.text},state:{padding:spacing.lg,alignItems:"center",gap:8},errorBox:{marginHorizontal:spacing.lg,padding:spacing.md,borderWidth:1,borderColor:colors.danger,borderRadius:radius.md,marginBottom:spacing.md},errorText:{fontSize:12,lineHeight:17,color:colors.danger},success:{marginHorizontal:spacing.lg,marginBottom:spacing.md,fontSize:12,fontWeight:"800",color:colors.success},pagination:{flexDirection:"row",alignItems:"center",justifyContent:"center",gap:14,paddingVertical:spacing.md}
});
