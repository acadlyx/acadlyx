import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDownloadPdf, apiRequest, ApiError } from "../api/client";
import * as Sharing from "expo-sharing";
import { displayValue, safeRecordEntries, toCollection } from "../api/payload";
import { useAuth } from "../auth/AuthProvider";
import { useWorkspaceContext } from "../workspace/WorkspaceContextProvider";
import { colors, radius, spacing } from "../ui/theme";

type StudentTab="OVERVIEW"|"ATTENDANCE"|"MARKS"|"RESULTS"|"ASSIGNMENTS"|"TIMETABLE";
type AssignmentSubmission={id?:string;content?:string;status?:string;marksAwarded?:number|null;feedback?:string|null;submittedAt?:string};
type StudentAssignment={id:string;title:string;description?:string;dueDate?:string;maxMarks?:number;status?:string;courseCode?:string;courseOffering?:{course?:{code?:string;name?:string}};mySubmission?:AssignmentSubmission|null;submission?:AssignmentSubmission|null;[key:string]:unknown};
const tabs:Array<{id:StudentTab,label:string,endpoint:string}>=[
 {id:"OVERVIEW",label:"Overview",endpoint:"/students/me/dashboard"},
 {id:"ATTENDANCE",label:"Attendance",endpoint:"/students/me/attendance"},
 {id:"MARKS",label:"Performance",endpoint:"/examinations/my/performance"},
 {id:"RESULTS",label:"Published results",endpoint:"/examinations/my/results"},
 {id:"ASSIGNMENTS",label:"Assignments",endpoint:"/students/me/assignments"},
 {id:"TIMETABLE",label:"Timetable",endpoint:"/students/me/timetable"}
];
function rows<T>(v:unknown):T[]{return toCollection(v) as T[];}
function dateLabel(s?:string){if(!s)return "No due date";const d=new Date(s);return Number.isNaN(d.valueOf())?s:d.toLocaleDateString();}
function object(value:unknown):Record<string,unknown>{return typeof value==="object"&&value!==null&&!Array.isArray(value)?value as Record<string,unknown>:{};}

export function StudentPortalScreen({initialTab="OVERVIEW"}:{initialTab?:StudentTab}){
 const {user}=useAuth();
  const { context } = useWorkspaceContext();
  const workspaceKey = JSON.stringify(context?.scope ?? {});const client=useQueryClient();
 const [tab,setTab]=useState<StudentTab>(initialTab);const [selectedAssignmentId,setSelectedAssignmentId]=useState<string|null>(null);const [submissionText,setSubmissionText]=useState("");
 const [downloadBusy,setDownloadBusy]=useState<string|null>(null);const [downloadError,setDownloadError]=useState("");
 useEffect(()=>{setTab(initialTab);setSelectedAssignmentId(null);setSubmissionText("");setDownloadError("");},[initialTab]);
 const canSubmit=Boolean(user?.permissions.includes("assignments.submit"));
 const current=tabs.find(t=>t.id===tab)||tabs[0];
 const query=useQuery({queryKey:["student-self-service",user?.id, workspaceKey,tab],queryFn:()=>apiRequest<unknown>(current.endpoint),enabled:Boolean(user?.id&&user?.roles.includes("STUDENT")),staleTime:0});
 const internalMarksQuery=useQuery({queryKey:["student-self-service",user?.id, workspaceKey,"INTERNAL_MARKS"],queryFn:()=>apiRequest<unknown>("/students/me/marks"),enabled:Boolean(user?.id&&user?.roles.includes("STUDENT")&&tab==="MARKS"),staleTime:0});
 const assignments=useMemo(()=>rows<StudentAssignment>(tab==="ASSIGNMENTS"?query.data:null).filter(a=>typeof a.id==="string"),[query.data,tab]);
 const examMarks=useMemo(()=>rows<unknown>(tab==="MARKS"?query.data:null).map(object),[query.data,tab]);
 const publishedResults=useMemo(()=>rows<unknown>(tab==="RESULTS"?query.data:null).map(object),[query.data,tab]);
 const internalMarks=useMemo(()=>rows<unknown>(tab==="MARKS"?internalMarksQuery.data:null).map(object),[internalMarksQuery.data,tab]);
 const publishedSessions=useMemo(()=>{const unique=new Map<string,Record<string,unknown>>();for(const result of publishedResults){if(typeof result.examSessionId==="string"&&result.examSessionId&&!unique.has(result.examSessionId))unique.set(result.examSessionId,result);}return [...unique.entries()].map(([id,result])=>({id,name:String(result.examName||"Examination")}));},[query.data,tab]);
 const selected=assignments.find(a=>a.id===selectedAssignmentId)||null;
 const downloadMarksheet=async(sessionId:string)=>{setDownloadBusy(sessionId);setDownloadError("");try{const file=await apiDownloadPdf("/examinations/sessions/"+encodeURIComponent(sessionId)+"/marksheet.pdf","ACADLYX_"+sessionId+"_Marksheet.pdf");if(await Sharing.isAvailableAsync())await Sharing.shareAsync(file.uri,{dialogTitle:"Share or save ACADLYX marksheet",mimeType:"application/pdf"});else throw new Error("Native sharing is not available on this device.");}catch(error){setDownloadError(error instanceof Error?error.message:"Unable to download the marksheet. Please retry.");}finally{setDownloadBusy(null);}};
 const submit=useMutation({
  mutationFn:async()=>{
   if(!canSubmit)throw new Error("Your session does not include assignments.submit.");
   if(!selected)throw new Error("Select one of your published assignments first.");
   if(!submissionText.trim()||submissionText.trim().length>20000)throw new Error("Submission text must contain 1–20,000 characters.");
   return apiRequest("/assignments/"+encodeURIComponent(selected.id)+"/submit",{method:"POST",body:JSON.stringify({content:submissionText.trim()})});
  },
  onSuccess:async()=>{
   setSubmissionText("");
   await Promise.all([client.invalidateQueries({queryKey:["student-self-service", user?.id]}),client.invalidateQueries({queryKey:["my-work",user?.id]})]);
   await query.refetch();
  }
 });
 if(!user?.roles.includes("STUDENT"))return <View style={styles.state}><Text style={styles.title}>Student portal</Text><Text style={styles.muted}>This workspace is only available to accounts with the backend-assigned STUDENT role.</Text></View>;
 const dashboard=object(query.data);
 const student=object(dashboard.student);
 const headline=[student.firstName,student.lastName].filter(v=>typeof v==="string").join(" ")||user.firstName||"Student";
 const attendancePercentage=typeof dashboard.attendancePercentage==="number"?dashboard.attendancePercentage:null;
 const subjectAttendance=rows<unknown>(dashboard.subjectAttendance);
 const upcomingEvents=rows<unknown>(dashboard.upcomingEvents);
 const notices=rows<unknown>(dashboard.announcements);
 return <View style={styles.root}>
  <View style={styles.header}>
   <Text style={styles.eyebrow}>STUDENT WORKSPACE</Text>
   <Text style={styles.title}>{tab==="OVERVIEW"?"Welcome, "+headline:current.label}</Text>
   <Text style={styles.subtitle}>All information is read from the authenticated student endpoints. The API verifies student ownership on every request.</Text>
   <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
    {tabs.map(t=><Pressable key={t.id} onPress={()=>{setTab(t.id);setSelectedAssignmentId(null);setSubmissionText("");}} style={[styles.tab,tab===t.id?styles.tabSelected:null]}><Text style={[styles.tabText,tab===t.id?styles.tabTextSelected:null]}>{t.label}</Text></Pressable>)}
   </ScrollView>
  </View>
  {query.isLoading?<View style={styles.state}><ActivityIndicator size="large" color={colors.primary}/><Text style={styles.muted}>Loading your {tab.toLowerCase()}…</Text></View>:
   query.isError&&!(tab==="MARKS"&&internalMarksQuery.data!==undefined)?<View style={styles.state}><Text style={styles.title}>Could not load this section</Text><Text style={styles.muted}>{query.error instanceof ApiError?query.error.message:query.error instanceof Error?query.error.message:"Check your connection and try again."}</Text><Pressable onPress={()=>{void query.refetch();}} style={styles.primary}><Text style={styles.primaryText}>Retry</Text></Pressable></View>:
   <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={()=>{void query.refetch();}} tintColor={colors.primary}/>}>
    {tab==="OVERVIEW"?<>
     <View style={styles.hero}><Text style={styles.studentName}>{headline}</Text><Text style={styles.meta}>{String(student.email||user.email||"")}</Text>
      <Text style={styles.meta}>{displayValue(object(dashboard.program).name)} · {displayValue(object(dashboard.academicYear).name)}</Text>
      {typeof student.rollNumber==="string"?<Text style={styles.meta}>Roll number: {student.rollNumber}</Text>:null}
     </View>
     <View style={styles.metricRow}>
      {attendancePercentage!==null?<View style={styles.metric}><Text style={styles.metricValue}>{String(attendancePercentage)}%</Text><Text style={styles.metricLabel}>Attendance</Text></View>:null}
      {typeof dashboard.academicRisk==="string"?<View style={styles.metric}><Text style={styles.metricValue}>{dashboard.academicRisk}</Text><Text style={styles.metricLabel}>Academic risk</Text></View>:null}
      {typeof dashboard.assignmentsCompletionPercent==="number"?<View style={styles.metric}><Text style={styles.metricValue}>{String(dashboard.assignmentsCompletionPercent)}%</Text><Text style={styles.metricLabel}>Submissions</Text></View>:null}
     </View>
     {dashboard.academicHealth&&typeof dashboard.academicHealth==="object"?<View style={styles.card}><Text style={styles.sectionTitle}>Academic health</Text>{safeRecordEntries(dashboard.academicHealth).map(([k,v])=><View key={k} style={styles.field}><Text style={styles.fieldLabel}>{k.replace(/([A-Z])/g," $1")}</Text><Text style={styles.value}>{displayValue(v)}</Text></View>)}</View>:null}
     {subjectAttendance.length?<View style={styles.card}><Text style={styles.sectionTitle}>Subject attendance</Text>{subjectAttendance.slice(0,8).map((it,i)=><View key={String(i)} style={styles.field}>{safeRecordEntries(it).map(([k,v])=><View key={k} style={styles.inline}><Text style={styles.fieldLabel}>{k}</Text><Text style={styles.value}>{displayValue(v)}</Text></View>)}</View>)}</View>:null}
     {upcomingEvents.length?<View style={styles.card}><Text style={styles.sectionTitle}>Upcoming events</Text>{upcomingEvents.slice(0,6).map((it,i)=><View key={String(i)} style={styles.field}>{safeRecordEntries(it).slice(0,4).map(([k,v])=><View key={k} style={styles.inline}><Text style={styles.fieldLabel}>{k}</Text><Text style={styles.value}>{displayValue(v)}</Text></View>)}</View>)}</View>:null}
     {notices.length?<View style={styles.card}><Text style={styles.sectionTitle}>Announcements</Text>{notices.slice(0,6).map((it,i)=><View key={String(i)} style={styles.field}><Text style={styles.rowTitle}>{displayValue(object(it).title||object(it).name||"Announcement")}</Text><Text style={styles.meta}>{displayValue(object(it).body||object(it).message||object(it).createdAt)}</Text></View>)}</View>:null}
    </>:null}
    {tab==="ATTENDANCE"?<><View style={styles.card}><Text style={styles.sectionTitle}>Attendance summary</Text>{attendancePercentage!==null?<Text style={styles.metricValue}>{String(attendancePercentage)}%</Text>:null}{safeRecordEntries(query.data).map(([k,v])=><View key={k} style={styles.field}><Text style={styles.fieldLabel}>{k.replace(/([A-Z])/g," $1").replace(/[_-]/g," ")}</Text><Text style={styles.value}>{displayValue(v)}</Text></View>)}</View></>:null}
    {tab==="MARKS"?<>
     {query.isError?<View style={styles.warning}><Text style={styles.warningTitle}>Examination performance could not load</Text><Text style={styles.warningText}>{query.error instanceof Error?query.error.message:"The examination request failed."}</Text></View>:null}
     <View style={styles.card}>
      <Text style={styles.sectionTitle}>Examination performance</Text>
      {examMarks.map((mark,i)=><View key={String(mark.examScheduleId||i)} style={styles.resultRow}>
       <View style={styles.resultHeading}><View style={styles.resultMain}><Text style={styles.rowTitle}>{String(mark.courseCode||"Course")} — {String(mark.courseName||"Course name unavailable")}</Text><Text style={styles.meta}>{String(mark.examName||"Examination")} · {dateLabel(typeof mark.examDate==="string"?mark.examDate:undefined)}</Text></View>
        <Text style={styles.score}>{mark.isAbsent===true?"AB":mark.marksObtained===null||mark.marksObtained===undefined?"Not recorded":String(mark.marksObtained)+"/"+String(mark.maxMarks??"—")}</Text>
       </View>
       <Text style={styles.meta}>Status: {String(mark.status||"Unavailable")}{mark.passMarks!==null&&mark.passMarks!==undefined?" · Pass mark "+String(mark.passMarks):""}</Text>
      </View>)}
      {!query.isLoading&&examMarks.length===0&&!query.isError?<Text style={styles.muted}>No approved examination marks are available yet.</Text>:null}
      {query.isLoading?<Text style={styles.muted}>Loading examination performance…</Text>:null}
     </View>
     <View style={styles.card}>
      <Text style={styles.sectionTitle}>Internal assessment marks</Text>
      <Text style={styles.meta}>Internal component marks are shown separately from examination marks.</Text>
      {internalMarksQuery.isLoading?<Text style={styles.muted}>Loading internal assessment marks…</Text>:null}
      {internalMarksQuery.isError?<View style={styles.warning}><Text style={styles.warningTitle}>Internal marks could not load</Text><Text style={styles.warningText}>{internalMarksQuery.error instanceof Error?internalMarksQuery.error.message:"The internal marks request failed."}</Text><Pressable onPress={()=>{void internalMarksQuery.refetch();}} style={styles.retry}><Text style={styles.retryText}>Retry internal marks</Text></Pressable></View>:null}
      {internalMarks.map((mark,i)=>{const offering=object(mark.courseOffering);const course=object(offering.course);return <View key={String(mark.id||i)} style={styles.resultRow}><View style={styles.resultHeading}><View style={styles.resultMain}><Text style={styles.rowTitle}>{String(course.code||"Course")} — {String(course.name||"Course name unavailable")}</Text><Text style={styles.meta}>{String(mark.component||"Assessment component")}</Text></View><Text style={styles.score}>{String(mark.marksObtained??"—")}/{String(mark.maxMarks??"—")}</Text></View></View>;})}
      {!internalMarksQuery.isLoading&&!internalMarksQuery.isError&&internalMarks.length===0?<Text style={styles.muted}>No internal assessment marks are available yet.</Text>:null}
     </View>
    </>:null}
    {tab==="RESULTS"?<View style={styles.card}>
     <Text style={styles.sectionTitle}>Published examination results</Text>
     <Text style={styles.meta}>Only results published by the institution appear here. Draft and pending-approval marks are excluded by the backend.</Text>
     {publishedResults.map((result,i)=><View key={String(result.examScheduleId||i)} style={styles.resultRow}>
      <View style={styles.resultHeading}><View style={styles.resultMain}><Text style={styles.rowTitle}>{String(result.courseCode||"Course")} — {String(result.courseName||"Course name unavailable")}</Text><Text style={styles.meta}>{String(result.examName||"Examination")} · {dateLabel(typeof result.examDate==="string"?result.examDate:undefined)}</Text></View>
       <Text style={styles.score}>{result.isAbsent===true?"AB":result.marksObtained===null||result.marksObtained===undefined?"Not recorded":String(result.marksObtained)+"/"+String(result.maxMarks??"—")}</Text>
      </View>
      <Text style={styles.meta}>Published: {dateLabel(typeof result.publishedAt==="string"?result.publishedAt:undefined)}</Text>
      {typeof result.remarks==="string"&&result.remarks.trim()?<Text style={styles.meta}>Remarks: {result.remarks}</Text>:null}
     </View>)}
     {query.isLoading?<Text style={styles.muted}>Loading published results…</Text>:null}
     {!query.isLoading&&!query.isError&&publishedResults.length===0?<Text style={styles.muted}>No published examination results are available yet.</Text>:null}
     {publishedSessions.map(session=><View key={session.id} style={styles.downloadRow}><Text style={styles.rowTitle}>{session.name}</Text><Pressable accessibilityRole="button" disabled={downloadBusy===session.id} onPress={()=>{void downloadMarksheet(session.id);}} style={[styles.primary,downloadBusy===session.id?styles.disabled:null]}><Text style={styles.primaryText}>{downloadBusy===session.id?"Preparing PDF…":"Download marksheet PDF"}</Text></Pressable></View>)}
     {publishedResults.some(result=>result.examSessionId===null||result.examSessionId===undefined)?<Text style={styles.meta}>Some older result records have no downloadable examination session; they remain visible above.</Text>:null}
     {downloadError?<View style={styles.warning}><Text style={styles.warningTitle}>Marksheet download failed</Text><Text style={styles.warningText}>{downloadError}</Text></View>:null}
    </View>:null}
    {tab==="TIMETABLE"?<>{rows(query.data).sort((a,b)=>Number(object(a).dayOfWeek||0)-Number(object(b).dayOfWeek||0)).map((it,i)=><View key={String(i)} style={styles.card}><Text style={styles.rowTitle}>{displayValue(object(it).courseCode||object(object(it).course).code||"Class") } · {displayValue(object(it).startTime)}–{displayValue(object(it).endTime)}</Text>{safeRecordEntries(it).map(([k,v])=><View key={k} style={styles.inline}><Text style={styles.fieldLabel}>{k}</Text><Text style={styles.value}>{displayValue(v)}</Text></View>)}</View>)}{rows(query.data).length===0?<View style={styles.card}><Text style={styles.muted}>No timetable entries have been returned. This may mean your enrolment/section is not yet configured.</Text></View>:null}</>:null}
    {tab==="ASSIGNMENTS"?<>
     {selected?<View style={styles.card}>
      <Pressable onPress={()=>{setSelectedAssignmentId(null);setSubmissionText("");}}><Text style={styles.back}>‹ All assignments</Text></Pressable>
      <Text style={styles.sectionTitle}>{selected.title}</Text><Text style={styles.meta}>{selected.courseCode||selected.courseOffering?.course?.code||""} · Due {dateLabel(selected.dueDate)}</Text>
      {selected.description?<Text style={styles.body}>{selected.description}</Text>:null}
      {selected.mySubmission||selected.submission?<View style={styles.submission}><Text style={styles.rowTitle}>Submission recorded</Text><Text style={styles.meta}>Status: {(selected.mySubmission||selected.submission)?.status||"Submitted"}</Text>{(selected.mySubmission||selected.submission)?.marksAwarded!=null?<Text style={styles.meta}>Marks: {String((selected.mySubmission||selected.submission)?.marksAwarded)}</Text>:null}{(selected.mySubmission||selected.submission)?.feedback?<Text style={styles.body}>Feedback: {(selected.mySubmission||selected.submission)?.feedback}</Text>:null}{(selected.mySubmission||selected.submission)?.status!=="REOPENED"?<Text style={styles.muted}>A resubmission is available only after an authorized reviewer reopens the assignment.</Text>:null}</View>:canSubmit?<><Text style={styles.label}>Your submission</Text><TextInput value={submissionText} onChangeText={setSubmissionText} multiline maxLength={20000} textAlignVertical="top" style={[styles.input,styles.textArea]} placeholder="Write or paste your work" placeholderTextColor={colors.textMuted}/><Text style={styles.meta}>{submissionText.length}/20000 characters</Text>{submit.isError?<Text style={styles.error}>{submit.error instanceof Error?submit.error.message:"Submission failed."}</Text>:null}<Pressable disabled={submit.isPending||!submissionText.trim()} onPress={()=>submit.mutate()} style={[styles.primary,!submissionText.trim()?styles.disabled:null]}><Text style={styles.primaryText}>{submit.isPending?"Submitting…":"Submit assignment"}</Text></Pressable></>:<Text style={styles.muted}>Your account does not include assignment submission permission.</Text>}
     </View>:assignments.map(a=><Pressable key={a.id} onPress={()=>{setSelectedAssignmentId(a.id);setSubmissionText("");}} style={styles.card}><Text style={styles.rowTitle}>{a.title}</Text><Text style={styles.meta}>{a.courseCode||a.courseOffering?.course?.code||"Course"} · Due {dateLabel(a.dueDate)}</Text><Text style={styles.meta}>{a.maxMarks!==undefined?"Maximum marks: "+String(a.maxMarks):""}</Text><Text style={styles.open}>{a.mySubmission||a.submission?"View submitted work":"Open assignment →"}</Text></Pressable>)}
     {!selected&&assignments.length===0?<View style={styles.card}><Text style={styles.sectionTitle}>No published assignments due</Text><Text style={styles.muted}>The student self-service API returned no upcoming assignments.</Text></View>:null}
    </>:null}
    <Text style={styles.footnote}>Student data is sourced from authenticated self-service APIs. Published results exclude draft and pending examination marks; no records are generated locally.</Text>
   </ScrollView>}
 </View>;
}
const styles=StyleSheet.create({
 root:{flex:1,backgroundColor:colors.canvas},header:{padding:spacing.lg,backgroundColor:colors.surface,borderBottomWidth:1,borderColor:colors.border,gap:8},
 eyebrow:{color:colors.primary,fontSize:10,fontWeight:"900",letterSpacing:1},title:{color:colors.text,fontSize:22,fontWeight:"900"},subtitle:{color:colors.textMuted,fontSize:12,lineHeight:18},
 tabs:{gap:6,paddingVertical:4},tab:{backgroundColor:colors.surfaceMuted,borderRadius:radius.pill,paddingHorizontal:11,paddingVertical:8},tabSelected:{backgroundColor:colors.primary},
 tabText:{color:colors.textMuted,fontSize:10,fontWeight:"800"},tabTextSelected:{color:colors.white},content:{padding:spacing.lg,paddingBottom:36,gap:10},
 hero:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.lg,padding:spacing.xl},studentName:{color:colors.text,fontSize:20,fontWeight:"900"},
 meta:{color:colors.textMuted,fontSize:11,lineHeight:17,marginTop:4},metricRow:{flexDirection:"row",flexWrap:"wrap",gap:8},metric:{flexGrow:1,flexBasis:"30%",backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,padding:12},
 metricValue:{color:colors.text,fontSize:22,fontWeight:"900"},metricLabel:{color:colors.textMuted,fontSize:10,marginTop:4},card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,padding:spacing.lg,marginBottom:3},
 sectionTitle:{color:colors.text,fontSize:15,fontWeight:"900",marginBottom:8},field:{borderTopWidth:1,borderColor:colors.border,paddingVertical:8},fieldLabel:{color:colors.textMuted,fontSize:10,fontWeight:"800",textTransform:"uppercase",flex:1},value:{color:colors.text,fontSize:12,lineHeight:18,flex:1,textAlign:"right"},
 inline:{flexDirection:"row",alignItems:"flex-start",gap:10,paddingVertical:2},rowTitle:{color:colors.text,fontSize:13,fontWeight:"900"},body:{color:colors.text,fontSize:13,lineHeight:20,marginTop:8},open:{color:colors.primary,fontSize:11,fontWeight:"900",marginTop:9},back:{color:colors.primary,fontSize:12,fontWeight:"900",marginBottom:10},
 primary:{backgroundColor:colors.primary,borderRadius:radius.md,paddingHorizontal:14,paddingVertical:12,alignItems:"center",justifyContent:"center",marginTop:10},primaryText:{color:colors.white,fontSize:12,fontWeight:"900"},disabled:{opacity:.45},
 label:{color:colors.text,fontSize:12,fontWeight:"800",marginTop:10},input:{borderWidth:1,borderColor:colors.border,borderRadius:radius.md,backgroundColor:colors.surface,color:colors.text,paddingHorizontal:12,paddingVertical:10,fontSize:13},
 textArea:{minHeight:140,marginTop:8},submission:{backgroundColor:colors.surfaceMuted,borderRadius:radius.md,padding:12,marginTop:10,gap:5},error:{color:colors.danger,fontSize:11,lineHeight:17,marginTop:8},
 state:{flex:1,alignItems:"center",justifyContent:"center",padding:spacing.xl,gap:10},muted:{color:colors.textMuted,fontSize:12,lineHeight:18},warning:{borderWidth:1,borderColor:colors.warning,borderRadius:radius.md,backgroundColor:colors.surface,padding:spacing.md,marginBottom:8},warningTitle:{color:colors.warning,fontWeight:"900",fontSize:12},warningText:{color:colors.textMuted,fontSize:11,lineHeight:17,marginTop:4},resultRow:{borderTopWidth:1,borderColor:colors.border,paddingVertical:10,gap:5},resultHeading:{flexDirection:"row",alignItems:"flex-start",justifyContent:"space-between",gap:10},resultMain:{flex:1},score:{color:colors.text,fontWeight:"900",fontSize:12,textAlign:"right",maxWidth:112},downloadRow:{borderTopWidth:1,borderColor:colors.border,paddingVertical:9,gap:5},retry:{alignSelf:"flex-start",paddingVertical:8},retryText:{color:colors.primary,fontWeight:"900",fontSize:11},footnote:{color:colors.textMuted,fontSize:10,lineHeight:16,textAlign:"center",marginTop:8}
});