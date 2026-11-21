import React, { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, ApiError } from "../api/client";
import { displayValue, recordTitle, safeRecordEntries, toCollection } from "../api/payload";
import { useAuth } from "../auth/AuthProvider";
import { useWorkspaceContext } from "../workspace/WorkspaceContextProvider";
import { colors, radius, spacing } from "../ui/theme";

type Child = { id: string; firstName?: string; lastName?: string; fullName?: string; name?: string; rollNumber?: string; admissionNumber?: string; programme?: string; [key: string]: unknown };
type ChildTab = "OVERVIEW" | "ATTENDANCE" | "RESULTS" | "FEES" | "COURSEWORK" | "CALENDAR" | "NOTICES";
const childTabs: Array<{ id: ChildTab; label: string; suffix: string }> = [
 {id:"OVERVIEW",label:"Overview",suffix:""},
 {id:"ATTENDANCE",label:"Attendance",suffix:"/attendance"},
 {id:"RESULTS",label:"Results",suffix:"/results"},
 {id:"FEES",label:"Fees",suffix:"/fees"},
 {id:"COURSEWORK",label:"Coursework",suffix:"/coursework"},
 {id:"CALENDAR",label:"Calendar",suffix:"/calendar"},
 {id:"NOTICES",label:"Notices",suffix:"/notices"}
];
function children(value: unknown): Child[] {
 return toCollection(value).filter((x):x is Child=>typeof x==="object"&&x!==null&&typeof (x as Record<string,unknown>).id==="string");
}
function childName(c: Child) {
 return c.fullName||c.name||[c.firstName,c.lastName].filter(Boolean).join(" ")||c.admissionNumber||c.rollNumber||"Linked student";
}
function collection(value: unknown): unknown[] { return toCollection(value); }

export function ParentScreen() {
 const {user}=useAuth();
  const { context } = useWorkspaceContext();
  const workspaceKey = JSON.stringify(context?.scope ?? {});
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const [tab,setTab]=useState<ChildTab>("OVERVIEW");
 const childList=useQuery({
  queryKey:["parent-children",user?.id],
  queryFn:()=>apiRequest<unknown>("/parent/children"),
  enabled:Boolean(user?.id&&user?.roles.includes("PARENT")),
  staleTime:0
 });
 const kids=useMemo(()=>children(childList.data),[childList.data]);
 const selected=kids.find(c=>c.id===selectedId)||null;
 const endpoint=tab==="OVERVIEW"?"/parent/children/"+encodeURIComponent(selectedId||""):"/parent/children/"+encodeURIComponent(selectedId||"")+childTabs.find(t=>t.id===tab)!.suffix;
 const detail=useQuery({
  queryKey:["parent-child",user?.id, workspaceKey,selectedId,tab],
  queryFn:()=>apiRequest<unknown>(endpoint+(tab==="NOTICES"?"?page=1&pageSize=30":"")),
  enabled:Boolean(user?.id&&selectedId&&selected),
  staleTime:0
 });
 const data=detail.data;
 const rows=useMemo(()=>collection(data),[data]);

 if(!user?.roles.includes("PARENT")){
  return <View style={styles.state}><Text style={styles.title}>Parent portal</Text><Text style={styles.muted}>This screen requires the backend-assigned PARENT role. The server still validates the parent-to-student link for each request.</Text></View>;
 }
 if(selectedId&&!selected){
  return <View style={styles.state}><Text style={styles.title}>Linked student changed</Text><Text style={styles.muted}>The selected student is no longer in the current authorized children list. Select a currently linked child again.</Text><Pressable onPress={()=>setSelectedId(null)} style={styles.primary}><Text style={styles.primaryText}>Back to children</Text></Pressable></View>;
 }

 return <View style={styles.root}>
  {!selected?<><View style={styles.header}><Text style={styles.title}>Parent portal</Text><Text style={styles.muted}>Only children returned by the authenticated parent-link service are shown. Each child-data request is re-authorized by the backend.</Text></View>
   {childList.isLoading?<View style={styles.state}><ActivityIndicator color={colors.primary}/><Text style={styles.muted}>Loading linked children…</Text></View>:childList.isError?<View style={styles.state}><Text style={styles.title}>Children unavailable</Text><Text style={styles.muted}>{childList.error instanceof ApiError?childList.error.message:childList.error instanceof Error?childList.error.message:"Could not load linked children."}</Text><Pressable onPress={()=>{void childList.refetch();}} style={styles.primary}><Text style={styles.primaryText}>Retry</Text></Pressable></View>:
   <FlatList data={kids} keyExtractor={x=>x.id} contentContainerStyle={styles.list} renderItem={({item})=><Pressable onPress={()=>{setSelectedId(item.id);setTab("OVERVIEW");}} style={styles.card}>
    <Text style={styles.childTitle}>{childName(item)}</Text><Text style={styles.meta}>{item.admissionNumber||item.rollNumber||"Student record"}{typeof item.programme==="string"?" · "+item.programme:""}</Text><Text style={styles.open}>Open overview and records →</Text>
   </Pressable>} ListEmptyComponent={<View style={styles.state}><Text style={styles.title}>No linked children</Text><Text style={styles.muted}>The server returned no children linked to this parent account.</Text></View>}/>}
  </>:<>
   <View style={styles.header}>
    <Pressable onPress={()=>{setSelectedId(null);setTab("OVERVIEW");}}><Text style={styles.back}>‹ All children</Text></Pressable>
    <Text style={styles.title}>{childName(selected)}</Text>
    <Text style={styles.muted}>Every record below is requested through the existing parent API; do not change student IDs in the UI.</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
     {childTabs.map(t=><Pressable key={t.id} onPress={()=>setTab(t.id)} style={[styles.tab,tab===t.id?styles.tabSelected:null]}><Text style={[styles.tabText,tab===t.id?styles.tabTextSelected:null]}>{t.label}</Text></Pressable>)}
    </ScrollView>
   </View>
   {detail.isLoading?<View style={styles.state}><ActivityIndicator color={colors.primary}/><Text style={styles.muted}>Loading {tab.toLowerCase()}…</Text></View>:detail.isError?<View style={styles.state}><Text style={styles.title}>Record unavailable</Text><Text style={styles.muted}>{detail.error instanceof ApiError?detail.error.message:detail.error instanceof Error?detail.error.message:"Could not load this child record."}</Text><Pressable onPress={()=>{void detail.refetch();}} style={styles.primary}><Text style={styles.primaryText}>Retry</Text></Pressable></View>:
   tab==="OVERVIEW"?<ScrollView contentContainerStyle={styles.details}>{safeRecordEntries(data).map(([key,value])=><View key={key} style={styles.field}><Text style={styles.fieldLabel}>{key.replace(/([A-Z])/g," $1").replace(/[_-]/g," ")}</Text><Text style={styles.fieldValue}>{displayValue(value)}</Text></View>)}</ScrollView>:
   <FlatList data={rows} keyExtractor={(item,index)=>{if(typeof item==="object"&&item!==null){const v=item as Record<string,unknown>;if(typeof v.id==="string"||typeof v.id==="number")return String(v.id)}return tab+"-"+index;}} contentContainerStyle={styles.list} renderItem={({item,index})=><View style={styles.card}>
    <Text style={styles.childTitle}>{recordTitle(item,tab.slice(0,1)+tab.slice(1).toLowerCase()+" record "+String(index+1))}</Text>
    {safeRecordEntries(item).slice(0,12).map(([key,value])=><View key={key} style={styles.field}><Text style={styles.fieldLabel}>{key.replace(/([A-Z])/g," $1").replace(/[_-]/g," ")}</Text><Text style={styles.fieldValue}>{displayValue(value)}</Text></View>)}
   </View>} ListEmptyComponent={<View style={styles.state}><Text style={styles.title}>No records returned</Text><Text style={styles.muted}>The parent-scoped endpoint returned no visible records for this section.</Text></View>}/>}
  </>}
 </View>;
}
const styles=StyleSheet.create({
 root:{flex:1,backgroundColor:colors.canvas},header:{padding:spacing.lg,gap:8,backgroundColor:colors.surface,borderBottomWidth:1,borderColor:colors.border},
 title:{color:colors.text,fontSize:22,fontWeight:"900"},muted:{color:colors.textMuted,fontSize:12,lineHeight:18},list:{padding:spacing.lg,paddingBottom:32},
 card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,padding:spacing.lg,marginBottom:10},
 childTitle:{color:colors.text,fontSize:15,fontWeight:"900"},meta:{color:colors.textMuted,fontSize:11,marginTop:5},open:{color:colors.primary,fontSize:11,fontWeight:"800",marginTop:12},
 back:{color:colors.primary,fontSize:13,fontWeight:"900"},tabs:{gap:6,paddingTop:5,paddingBottom:3},
 tab:{backgroundColor:colors.surfaceMuted,borderRadius:radius.pill,paddingHorizontal:11,paddingVertical:8},tabSelected:{backgroundColor:colors.primary},
 tabText:{color:colors.textMuted,fontSize:10,fontWeight:"800"},tabTextSelected:{color:colors.white},
 details:{padding:spacing.lg},field:{borderBottomWidth:1,borderColor:colors.border,paddingVertical:10},
 fieldLabel:{color:colors.textMuted,fontSize:10,fontWeight:"800",textTransform:"uppercase"},fieldValue:{color:colors.text,fontSize:13,lineHeight:19,marginTop:4},
 state:{flex:1,alignItems:"center",justifyContent:"center",padding:spacing.xl,gap:10},
 primary:{backgroundColor:colors.primary,borderRadius:radius.md,paddingHorizontal:16,paddingVertical:10,marginTop:6},primaryText:{color:colors.white,fontSize:12,fontWeight:"900"}
});