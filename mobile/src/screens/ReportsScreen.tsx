import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { ApiError, apiRequest } from "../api/client";
import { safeRecordEntries, toCollection } from "../api/payload";
import { useAuth } from "../auth/AuthProvider";
import { useWorkspaceContext } from "../workspace/WorkspaceContextProvider";
import { colors, radius, spacing } from "../ui/theme";

type Row=Record<string,unknown>;
type QueryState={data:unknown;isLoading:boolean;isError:boolean;error:unknown;isRefetching:boolean;refetch:()=>Promise<unknown>};
function object(value:unknown):Row{return value&&typeof value==="object"&&!Array.isArray(value)?value as Row:{};}
function errorText(value:unknown):string{return value instanceof ApiError?value.message:value instanceof Error?value.message:"The report request failed.";}
function label(key:string):string{return key.replace(/([A-Z])/g," $1").replace(/[_-]/g," ").replace(/^./,v=>v.toUpperCase());}
function metricEntries(value:unknown):Array<[string,unknown]>{
 const root=object(value);const nested=object(root.summary);const metrics=object(root.metrics);const kpis=object(root.kpis);
 const candidates=[...safeRecordEntries(nested),...safeRecordEntries(metrics),...safeRecordEntries(kpis),...safeRecordEntries(root).filter(([k,v])=>!["summary","metrics","kpis","data","meta","items","records","results","recommendations"].includes(k)&&v!==null&&typeof v!=="object")];
 const unique=new Map<string,unknown>();for(const[k,v]of candidates){if(v===null||v===undefined)continue;if(["string","number","boolean"].includes(typeof v))unique.set(k,v);}
 return [...unique.entries()].slice(0,12);
}
function ReportCard({title,state,onRefresh}:{title:string;state:QueryState;onRefresh:()=>void}){
 const metrics=useMemo(()=>metricEntries(state.data),[state.data]);const records=toCollection(state.data);
 return <View style={styles.card}><View style={styles.cardHead}><View style={{flex:1}}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.muted}>Live API data · server-authorized workspace</Text></View><Pressable accessibilityRole="button" disabled={state.isLoading} onPress={onRefresh} style={styles.smallButton}><Text style={styles.smallButtonText}>Refresh</Text></Pressable></View>
 {state.isLoading?<View style={styles.state}><ActivityIndicator color={colors.primary}/><Text style={styles.muted}>Loading report…</Text></View>:null}
 {state.isError?<View style={styles.errorBox}><Text style={styles.errorText}>{errorText(state.error)}</Text><Text style={styles.muted}>Unavailable or denied metrics are not shown as zero.</Text></View>:null}
 {!state.isLoading&&!state.isError&&metrics.length?<View style={styles.metrics}>{metrics.map(([key,value])=><View key={key} style={styles.metric}><Text style={styles.metricLabel}>{label(key)}</Text><Text style={styles.metricValue}>{typeof value==="number"?value.toLocaleString("en-IN"):String(value)}</Text></View>)}</View>:null}
 {!state.isLoading&&!state.isError&&!metrics.length?<Text style={styles.muted}>{records.length?records.length+" records returned; this endpoint does not expose aggregate metrics in this response shape.":"No report rows or summary values were returned for this authorized scope."}</Text>:null}
 </View>;
}
export function ReportsScreen(){
 const {user}=useAuth();const {context}=useWorkspaceContext();const workspaceKey=JSON.stringify(context?.scope??{});const permissions=user?.permissions??[];const roles=user?.roles??[];
 const [period,setPeriod]=useState("month");const [from,setFrom]=useState("");const [to,setTo]=useState("");const [dateError,setDateError]=useState("");
 const hasFinance=permissions.includes("fees.read")||permissions.includes("fees.collection.read");
 const hasAdmissions=permissions.includes("admissions.read");
 const hasHr=permissions.includes("hr.read");
 const hasPlacements=permissions.includes("placements.read");
 const hasLibrary=permissions.includes("library.read")&&roles.includes("LIBRARIAN");
 const hasExams=permissions.includes("exams.read");
 const hasIntelligence=permissions.includes("intelligence.read");
 const finance=useQuery({queryKey:["mobile-reports",user?.id,workspaceKey,"finance",period],queryFn:()=>apiRequest<unknown>("/finance/command-center?period="+encodeURIComponent(period)),enabled:Boolean(user?.id&&hasFinance),staleTime:0});
 const admissions=useQuery({queryKey:["mobile-reports",user?.id,workspaceKey,"admissions"],queryFn:()=>apiRequest<unknown>("/admissions?page=1&pageSize=1"),enabled:Boolean(user?.id&&hasAdmissions),staleTime:0});
 const hr=useQuery({queryKey:["mobile-reports",user?.id,workspaceKey,"hr"],queryFn:()=>apiRequest<unknown>("/hr/employees?page=1&pageSize=1"),enabled:Boolean(user?.id&&hasHr),staleTime:0});
 const placements=useQuery({queryKey:["mobile-reports",user?.id,workspaceKey,"placements"],queryFn:()=>apiRequest<unknown>("/placements/metrics"),enabled:Boolean(user?.id&&hasPlacements),staleTime:0});
 const library=useQuery({queryKey:["mobile-reports",user?.id,workspaceKey,"library"],queryFn:()=>apiRequest<unknown>("/library/summary"),enabled:Boolean(user?.id&&hasLibrary),staleTime:0});
 const exams=useQuery({queryKey:["mobile-reports",user?.id,workspaceKey,"exams"],queryFn:()=>apiRequest<unknown>("/examinations/sessions?page=1&pageSize=1"),enabled:Boolean(user?.id&&hasExams),staleTime:0});
 const dates=useMemo(()=>{if(!from&&!to)return "";if((from&&!/^\d{4}-\d{2}-\d{2}$/.test(from))||(to&&!/^\d{4}-\d{2}-\d{2}$/.test(to)))throw new Error("Dates must use YYYY-MM-DD.");if(from&&to&&from>to)throw new Error("The start date must not be after the end date.");const query=new URLSearchParams();if(from)query.set("from",new Date(from+"T00:00:00.000Z").toISOString());if(to)query.set("to",new Date(to+"T23:59:59.999Z").toISOString());return query.toString();},[from,to]);
 const intelligence=useQuery({queryKey:["mobile-reports",user?.id,workspaceKey,"intelligence",from,to],queryFn:()=>apiRequest<unknown>("/intelligence/command-center"+(dates?"?"+dates:"")),enabled:Boolean(user?.id&&hasIntelligence&&!dateError),staleTime:0});
 const cards=useMemo(()=>[
  {id:"finance",title:"Finance & fees",query:finance,active:hasFinance},
  {id:"admissions",title:"Admissions pipeline",query:admissions,active:hasAdmissions},
  {id:"hr",title:"HR & workforce",query:hr,active:hasHr},
  {id:"placements",title:"Placement outcomes",query:placements,active:hasPlacements},
  {id:"library",title:"Library circulation",query:library,active:hasLibrary},
  {id:"exams",title:"Examinations & results",query:exams,active:hasExams},
  {id:"intelligence",title:"Institutional intelligence",query:intelligence,active:hasIntelligence},
 ].filter(item=>item.active),[finance,admissions,hr,placements,library,exams,intelligence,hasFinance,hasAdmissions,hasHr,hasPlacements,hasLibrary,hasExams,hasIntelligence]);
 const refreshAll=()=>{for(const card of cards)void card.query.refetch();};
 const anyRefetching=cards.some(card=>card.query.isRefetching);
 return <ScrollView style={styles.root} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={anyRefetching} onRefresh={refreshAll} tintColor={colors.primary}/>}>
  <View style={styles.header}><Text style={styles.eyebrow}>REPORTING & INTELLIGENCE</Text><Text style={styles.title}>Institutional reports</Text><Text style={styles.muted}>Reports come from existing ACADLYX APIs. Server-side authorization and tenant scope remain authoritative; inaccessible report families are not queried.</Text>
   {hasFinance?<View style={styles.field}><Text style={styles.label}>Finance period</Text><View style={styles.choices}>{["today","week","month","quarter","academic"].map(value=><Pressable key={value} accessibilityRole="button" accessibilityState={{selected:period===value}} onPress={()=>setPeriod(value)} style={[styles.choice,period===value?styles.selected:null]}><Text style={[styles.choiceText,period===value?styles.selectedText:null]}>{value==="week"?"Last 7 days":value==="academic"?"Academic year":value[0].toUpperCase()+value.slice(1)}</Text></Pressable>)}</View></View>:null}
   {hasIntelligence?<View style={styles.dateRow}><View style={styles.field}><Text style={styles.label}>From (YYYY-MM-DD)</Text><TextInput accessibilityLabel="Intelligence start date" value={from} onChangeText={value=>{setFrom(value);setDateError("");}} style={styles.input} placeholder="2026-01-01" placeholderTextColor={colors.textMuted}/></View><View style={styles.field}><Text style={styles.label}>To (YYYY-MM-DD)</Text><TextInput accessibilityLabel="Intelligence end date" value={to} onChangeText={value=>{setTo(value);setDateError("");}} style={styles.input} placeholder="2026-12-31" placeholderTextColor={colors.textMuted}/></View></View>:null}
   {hasIntelligence&&dateError?<Text accessibilityRole="alert" style={styles.errorText}>{dateError}</Text>:null}
   <Pressable accessibilityRole="button" onPress={refreshAll} style={styles.primary}><Text style={styles.primaryText}>Refresh all reports</Text></Pressable>
  </View>
  {cards.length?cards.map(card=><ReportCard key={card.id} title={card.title} state={card.query as QueryState} onRefresh={()=>void card.query.refetch()}/>):<View style={styles.state}><Text style={styles.cardTitle}>No report-read permission</Text><Text style={styles.muted}>This workspace does not have any matching reporting permissions.</Text></View>}
 </ScrollView>;
}
const styles=StyleSheet.create({root:{flex:1,backgroundColor:colors.canvas},content:{paddingBottom:spacing.xl},header:{padding:spacing.lg,gap:9},eyebrow:{fontSize:10,fontWeight:"900",letterSpacing:1.4,color:colors.primary},title:{fontSize:24,fontWeight:"900",color:colors.text},muted:{fontSize:12,lineHeight:18,color:colors.textMuted},field:{flex:1,gap:6},label:{fontSize:11,fontWeight:"800",color:colors.text},dateRow:{flexDirection:"row",gap:8},input:{borderWidth:1,borderColor:colors.border,borderRadius:radius.md,paddingHorizontal:10,paddingVertical:9,color:colors.text,backgroundColor:colors.surface,fontSize:12},choices:{flexDirection:"row",flexWrap:"wrap",gap:5},choice:{borderWidth:1,borderColor:colors.border,borderRadius:radius.md,paddingHorizontal:8,paddingVertical:7},selected:{borderColor:colors.primary,backgroundColor:colors.primarySoft},choiceText:{fontSize:10,fontWeight:"800",color:colors.textMuted},selectedText:{color:colors.primary},primary:{alignSelf:"flex-start",backgroundColor:colors.primary,borderRadius:radius.md,paddingHorizontal:13,paddingVertical:10},primaryText:{fontSize:11,fontWeight:"900",color:colors.white},card:{marginHorizontal:spacing.lg,marginBottom:spacing.md,padding:spacing.md,borderWidth:1,borderColor:colors.border,borderRadius:radius.lg,backgroundColor:colors.surface,gap:10},cardHead:{flexDirection:"row",alignItems:"center",gap:8},cardTitle:{fontSize:15,fontWeight:"900",color:colors.text},smallButton:{borderWidth:1,borderColor:colors.border,borderRadius:radius.md,paddingHorizontal:8,paddingVertical:6},smallButtonText:{fontSize:10,fontWeight:"900",color:colors.text},metrics:{flexDirection:"row",flexWrap:"wrap",gap:7},metric:{minWidth:"42%",flexGrow:1,padding:spacing.sm,borderRadius:radius.md,backgroundColor:colors.surfaceMuted},metricLabel:{fontSize:10,color:colors.textMuted,fontWeight:"700"},metricValue:{fontSize:14,color:colors.text,fontWeight:"900",marginTop:4},state:{margin:spacing.lg,padding:spacing.lg,alignItems:"center",gap:8,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,backgroundColor:colors.surface},errorBox:{padding:spacing.md,borderWidth:1,borderColor:colors.danger,borderRadius:radius.md,backgroundColor:colors.surface,gap:5},errorText:{fontSize:12,lineHeight:17,color:colors.danger}});
