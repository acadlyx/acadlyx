import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "../api/client";
import { toCollection, displayValue, safeRecordEntries } from "../api/payload";
import { useAuth } from "../auth/AuthProvider";
import { useWorkspaceContext } from "../workspace/WorkspaceContextProvider";
import { colors, radius, spacing } from "../ui/theme";

type AdmissionStatus="SUBMITTED"|"UNDER_REVIEW"|"DOCUMENTS_PENDING"|"SELECTED"|"REJECTED"|"ENROLLED"|"WITHDRAWN";
type EditableStatus=Exclude<AdmissionStatus,"SUBMITTED"|"ENROLLED">;
type Program={id:string;name?:string;code?:string;[key:string]:unknown};
type AcademicYear={id:string;name?:string;label?:string;[key:string]:unknown};
type Semester={id:string;name?:string;number?:number;[key:string]:unknown};
type Section={id:string;name?:string;code?:string;[key:string]:unknown};
type Application={id:string;firstName:string;lastName:string;email:string;phone?:string;status:AdmissionStatus;programId?:string;academicYearId?:string;program?:Program;academicYear?:AcademicYear;createdAt?:string;remarks?:string;[key:string]:unknown};
const admissionStatuses:AdmissionStatus[]=["SUBMITTED","UNDER_REVIEW","DOCUMENTS_PENDING","SELECTED","REJECTED","ENROLLED","WITHDRAWN"];
const editableStatuses:EditableStatus[]=["UNDER_REVIEW","DOCUMENTS_PENDING","SELECTED","REJECTED","WITHDRAWN"];
function rows<T>(value:unknown):T[]{return toCollection(value) as T[];}
function labelProgram(p:Program){return [p.code,p.name].filter(Boolean).join(" · ")||"Programme";}
function labelYear(y:AcademicYear){return y.label||y.name||"Academic year";}
function labelSemester(s:Semester){return s.name||"Semester "+String(s.number??"");}
function labelSection(s:Section){return s.code?[s.code,s.name].filter(Boolean).join(" · "):s.name||"Section";}
function validDate(s:string){return /^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(new Date(s+"T12:00:00").valueOf());}

export function AdmissionsScreen(){
 const {user}=useAuth();
  const { context } = useWorkspaceContext();
  const workspaceKey = JSON.stringify(context?.scope ?? {});const client=useQueryClient();
 const canRead=Boolean(user?.permissions.includes("admissions.read"));
 const canManage=Boolean(user?.permissions.includes("admissions.manage"));
 const canEnroll=canManage&&Boolean(user?.permissions.includes("students.create"));
 const [search,setSearch]=useState("");const [filterStatus,setFilterStatus]=useState<AdmissionStatus|"ALL">("ALL");
 const [selectedId,setSelectedId]=useState<string|null>(null);const [form,setForm]=useState(false);const [statusForm,setStatusForm]=useState(false);const [enrollForm,setEnrollForm]=useState(false);
 const [firstName,setFirstName]=useState("");const [lastName,setLastName]=useState("");const [email,setEmail]=useState("");const [phone,setPhone]=useState("");const [dob,setDob]=useState("");const [gender,setGender]=useState("");
 const [guardianName,setGuardianName]=useState("");const [guardianPhone,setGuardianPhone]=useState("");const [previousInstitution,setPreviousInstitution]=useState("");const [previousPercentage,setPreviousPercentage]=useState("");const [remarks,setRemarks]=useState("");
 const [programId,setProgramId]=useState<string|null>(null);const [academicYearId,setAcademicYearId]=useState<string|null>(null);
 const [nextStatus,setNextStatus]=useState<EditableStatus>("UNDER_REVIEW");const [statusRemarks,setStatusRemarks]=useState("");
 const [idNumber,setIdNumber]=useState("");const [admissionNumber,setAdmissionNumber]=useState("");const [studentPassword,setStudentPassword]=useState("");const [semesterId,setSemesterId]=useState<string|null>(null);const [sectionId,setSectionId]=useState<string|null>(null);const [rollNumber,setRollNumber]=useState("");

 const list=useQuery({queryKey:["admissions",user?.id, workspaceKey,search,filterStatus],queryFn:()=>apiRequest<unknown>("/admissions?page=1&pageSize=50"+(search.trim()?"&search="+encodeURIComponent(search.trim()):"")+(filterStatus!=="ALL"?"&status="+filterStatus:"")),enabled:Boolean(user?.id&&canRead),staleTime:0});
 const detail=useQuery({queryKey:["admission",user?.id, workspaceKey,selectedId],queryFn:()=>apiRequest<Application>("/admissions/"+encodeURIComponent(selectedId as string)),enabled:Boolean(user?.id&&canRead&&selectedId),staleTime:0});
 const programsQuery=useQuery({queryKey:["admission-programs",user?.id, workspaceKey],queryFn:()=>apiRequest<unknown>("/programs?page=1&pageSize=100"),enabled:Boolean(user?.id&&canManage&&form),staleTime:15000});
 const yearsQuery=useQuery({queryKey:["admission-years",user?.id, workspaceKey],queryFn:()=>apiRequest<unknown>("/academic-years?page=1&pageSize=100"),enabled:Boolean(user?.id&&canManage&&form),staleTime:15000});
 const semestersQuery=useQuery({queryKey:["admission-semesters",user?.id, workspaceKey],queryFn:()=>apiRequest<unknown>("/semesters?page=1&pageSize=100"),enabled:Boolean(user?.id&&canEnroll&&enrollForm),staleTime:15000});
 const sectionsQuery=useQuery({queryKey:["admission-sections",user?.id, workspaceKey],queryFn:()=>apiRequest<unknown>("/sections?page=1&pageSize=100"),enabled:Boolean(user?.id&&canEnroll&&enrollForm),staleTime:15000});
 const apps=useMemo(()=>rows<Application>(list.data).filter(a=>typeof a.id==="string"),[list.data]);
 const programs=useMemo(()=>rows<Program>(programsQuery.data).filter(x=>typeof x.id==="string"),[programsQuery.data]);
 const years=useMemo(()=>rows<AcademicYear>(yearsQuery.data).filter(x=>typeof x.id==="string"),[yearsQuery.data]);
 const semesters=useMemo(()=>rows<Semester>(semestersQuery.data).filter(x=>typeof x.id==="string"),[semestersQuery.data]);
 const sections=useMemo(()=>rows<Section>(sectionsQuery.data).filter(x=>typeof x.id==="string"),[sectionsQuery.data]);
 const application=detail.data;

 async function invalidate(){await Promise.all([client.invalidateQueries({queryKey:["admissions",user?.id]}),client.invalidateQueries({queryKey:["admission", user?.id]}),client.invalidateQueries({queryKey:["my-work",user?.id]})]);}
 function resetForm(){setForm(false);setFirstName("");setLastName("");setEmail("");setPhone("");setDob("");setGender("");setGuardianName("");setGuardianPhone("");setPreviousInstitution("");setPreviousPercentage("");setRemarks("");setProgramId(null);setAcademicYearId(null);}
 function beginCreate(){setSelectedId(null);resetForm();setForm(true);}
 function beginEdit(a:Application){setFirstName(a.firstName||"");setLastName(a.lastName||"");setEmail(a.email||"");setPhone(typeof a.phone==="string"?a.phone:"");setDob(typeof a.dateOfBirth==="string"?a.dateOfBirth.slice(0,10):"");setGender(typeof a.gender==="string"?a.gender:"");setGuardianName(typeof a.guardianName==="string"?a.guardianName:"");setGuardianPhone(typeof a.guardianPhone==="string"?a.guardianPhone:"");setPreviousInstitution(typeof a.previousInstitution==="string"?a.previousInstitution:"");setPreviousPercentage(typeof a.previousPercentage==="number"?String(a.previousPercentage):"");setRemarks(typeof a.remarks==="string"?a.remarks:"");setProgramId(a.programId||null);setAcademicYearId(a.academicYearId||null);setForm(true);}
 const save=useMutation({
  mutationFn:async()=>{
   if(!canManage)throw new Error("Your session does not include admissions.manage.");
   if(firstName.trim().length<1||lastName.trim().length<1)throw new Error("First and last name are required.");
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))throw new Error("Enter a valid email address.");
   if(!programId||!academicYearId)throw new Error("Choose both a programme and academic year.");
   let pct: number|undefined; if(previousPercentage.trim()){pct=Number(previousPercentage);if(!Number.isFinite(pct)||pct<0||pct>100)throw new Error("Previous percentage must be between 0 and 100.");}
   if(dob.trim()&&!validDate(dob))throw new Error("Date of birth must use YYYY-MM-DD.");
   const payload={firstName:firstName.trim(),lastName:lastName.trim(),email:email.trim().toLowerCase(),programId,academicYearId,
    phone:phone.trim()||undefined,...(dob.trim()?{dateOfBirth:new Date(dob+"T12:00:00").toISOString()}:{}),gender:gender.trim()||undefined,
    guardianName:guardianName.trim()||undefined,guardianPhone:guardianPhone.trim()||undefined,
    previousInstitution:previousInstitution.trim()||undefined,...(pct!==undefined?{previousPercentage:pct}:{}),remarks:remarks.trim()||undefined};
   return selectedId
    ?apiRequest<Application>("/admissions/"+encodeURIComponent(selectedId),{method:"PATCH",body:JSON.stringify(payload)})
    :apiRequest<Application>("/admissions",{method:"POST",body:JSON.stringify(payload)});
  },
  onSuccess:async(result)=>{await invalidate();resetForm();if(result?.id)setSelectedId(result.id);}
 });
 const changeStatus=useMutation({
  mutationFn:async()=>{if(!selectedId)throw new Error("Select an application.");if(!canManage)throw new Error("Your session does not include admissions.manage.");if(statusRemarks.trim().length>1000)throw new Error("Remarks cannot exceed 1,000 characters.");return apiRequest<Application>("/admissions/"+encodeURIComponent(selectedId)+"/status",{method:"POST",body:JSON.stringify({status:nextStatus,remarks:statusRemarks.trim()||undefined})});},
  onSuccess:async()=>{setStatusForm(false);setStatusRemarks("");await invalidate();}
 });
 const enroll=useMutation({
  mutationFn:async()=>{if(!selectedId||!canEnroll)throw new Error("Enrollment requires admissions.manage and students.create.");if(!idNumber.trim()||!admissionNumber.trim())throw new Error("ID number and admission number are required.");if(studentPassword.length<8||studentPassword.length>128)throw new Error("Student password must contain 8–128 characters.");if(!semesterId)throw new Error("Select a semester.");return apiRequest("/admissions/"+encodeURIComponent(selectedId)+"/enroll",{method:"POST",body:JSON.stringify({idNumber:idNumber.trim().toUpperCase(),admissionNumber:admissionNumber.trim(),password:studentPassword,semesterId,...(sectionId?{sectionId}:{}),rollNumber:rollNumber.trim()||undefined})});},
  onSuccess:async()=>{setEnrollForm(false);setStudentPassword("");await invalidate();Alert.alert("Enrollment created","The existing admission service processed student enrollment. Verify the returned student record and onboarding flow.");}
 });
 const err=save.error||changeStatus.error||enroll.error;
 if(!canRead&&!canManage)return <View style={styles.state}><Text style={styles.title}>Admissions access unavailable</Text><Text style={styles.subtitle}>Your session does not include admissions.read or admissions.manage.</Text></View>;

 if(selectedId){
  return <ScrollView style={styles.root} contentContainerStyle={styles.details}>
   <Pressable onPress={()=>{setSelectedId(null);resetForm();setStatusForm(false);setEnrollForm(false);}}><Text style={styles.back}>‹ All applications</Text></Pressable>
   {detail.isLoading?<ActivityIndicator color={colors.primary}/>:detail.isError?<View style={styles.state}><Text style={styles.title}>Application unavailable</Text><Text style={styles.subtitle}>{detail.error instanceof Error?detail.error.message:"Could not load application."}</Text><Pressable onPress={()=>{void detail.refetch();}} style={styles.primary}><Text style={styles.primaryText}>Retry</Text></Pressable></View>:application?<><View style={styles.card}>
    <Text style={styles.title}>{application.firstName} {application.lastName}</Text><Text style={styles.meta}>{application.email}</Text><Text style={styles.meta}>{application.program?.name||"Programme"} · {application.academicYear?.name||"Academic year"}</Text><Text style={styles.status}>{application.status}</Text>
    {safeRecordEntries(application).slice(0,20).map(([k,v])=><View key={k} style={styles.field}><Text style={styles.label}>{k.replace(/([A-Z])/g," $1").replace(/[_-]/g," ")}</Text><Text style={styles.value}>{displayValue(v)}</Text></View>)}
   </View>
   {canManage?<View style={styles.card}><Text style={styles.sectionTitle}>Application actions</Text><View style={styles.actionRow}><Pressable onPress={()=>{beginEdit(application);}} style={styles.secondary}><Text style={styles.secondaryText}>Edit application</Text></Pressable><Pressable onPress={()=>{setStatusForm(v=>!v);setEnrollForm(false);}} style={styles.secondary}><Text style={styles.secondaryText}>Change status</Text></Pressable></View>
    {statusForm?<View style={styles.form}><Text style={styles.label}>New status</Text><View style={styles.options}>{editableStatuses.map(st=><Pressable key={st} onPress={()=>setNextStatus(st)} style={[styles.chip,nextStatus===st?styles.chipSelected:null]}><Text style={[styles.chipText,nextStatus===st?styles.chipTextSelected:null]}>{st.replace(/_/g," ")}</Text></Pressable>)}</View><TextInput value={statusRemarks} onChangeText={setStatusRemarks} style={styles.input} multiline maxLength={1000} placeholder="Optional status remarks" placeholderTextColor={colors.textMuted}/><Pressable disabled={changeStatus.isPending} onPress={()=>Alert.alert("Update admission status","Apply the selected status transition through the server?",[{text:"Cancel",style:"cancel"},{text:"Update",onPress:()=>changeStatus.mutate()}])} style={styles.primary}><Text style={styles.primaryText}>{changeStatus.isPending?"Saving…":"Save status"}</Text></Pressable></View>:null}
   </View>:null}
   {canEnroll&&application?.status==="SELECTED"?<View style={styles.card}><Text style={styles.sectionTitle}>Enroll selected applicant</Text><Text style={styles.subtitle}>Creates the student through the existing enrolment transaction; do not reuse or disclose the initial password.</Text><Pressable onPress={()=>setEnrollForm(v=>!v)} style={styles.primary}><Text style={styles.primaryText}>{enrollForm?"Close enrollment":"Start enrollment"}</Text></Pressable>
    {enrollForm?<View style={styles.form}><Text style={styles.label}>ID number</Text><TextInput value={idNumber} onChangeText={setIdNumber} autoCapitalize="characters" style={styles.input} placeholder="Institution ID" placeholderTextColor={colors.textMuted}/><Text style={styles.label}>Admission number</Text><TextInput value={admissionNumber} onChangeText={setAdmissionNumber} style={styles.input} placeholder="Admission number" placeholderTextColor={colors.textMuted}/><Text style={styles.label}>Initial password (8–128 characters)</Text><TextInput value={studentPassword} onChangeText={setStudentPassword} secureTextEntry style={styles.input} placeholder="Initial password" placeholderTextColor={colors.textMuted}/><Text style={styles.label}>Semester</Text>{semesters.map(sm=><Pressable key={sm.id} onPress={()=>setSemesterId(sm.id)} style={[styles.choice,semesterId===sm.id?styles.chipSelected:null]}><Text style={styles.value}>{labelSemester(sm)}</Text></Pressable>)}<Text style={styles.label}>Section (optional)</Text>{sections.map(sc=><Pressable key={sc.id} onPress={()=>setSectionId(sc.id===sectionId?null:sc.id)} style={[styles.choice,sectionId===sc.id?styles.chipSelected:null]}><Text style={styles.value}>{labelSection(sc)}</Text></Pressable>)}<Text style={styles.label}>Roll number (optional)</Text><TextInput value={rollNumber} onChangeText={setRollNumber} style={styles.input} placeholder="Roll number" placeholderTextColor={colors.textMuted}/><Pressable disabled={enroll.isPending||!semesters.length} onPress={()=>Alert.alert("Confirm student enrollment","This creates a student account and enrollment record. Confirm the identifiers and authorization before proceeding.",[{text:"Cancel",style:"cancel"},{text:"Enroll",onPress:()=>enroll.mutate()}])} style={styles.primary}><Text style={styles.primaryText}>{enroll.isPending?"Enrolling…":"Enroll applicant"}</Text></Pressable></View>:null}
   </View>:null}
   {form&&canManage?<View style={styles.card}><Text style={styles.sectionTitle}>{selectedId?"Edit application":"New application"}</Text>{/* The selected application stays in context while the editor opens. */}
    <Text style={styles.label}>First name</Text><TextInput value={firstName} onChangeText={setFirstName} maxLength={100} style={styles.input} placeholder="First name" placeholderTextColor={colors.textMuted}/>
    <Text style={styles.label}>Last name</Text><TextInput value={lastName} onChangeText={setLastName} maxLength={100} style={styles.input} placeholder="Last name" placeholderTextColor={colors.textMuted}/>
    <Text style={styles.label}>Email</Text><TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" maxLength={200} style={styles.input} placeholder="Email" placeholderTextColor={colors.textMuted}/>
    <Text style={styles.label}>Programme</Text>{programs.map(p=><Pressable key={p.id} onPress={()=>setProgramId(p.id)} style={[styles.choice,programId===p.id?styles.chipSelected:null]}><Text style={styles.value}>{labelProgram(p)}</Text></Pressable>)}
    <Text style={styles.label}>Academic year</Text>{years.map(y=><Pressable key={y.id} onPress={()=>setAcademicYearId(y.id)} style={[styles.choice,academicYearId===y.id?styles.chipSelected:null]}><Text style={styles.value}>{labelYear(y)}</Text></Pressable>)}
    <Text style={styles.label}>Phone</Text><TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={styles.input} placeholder="Phone" placeholderTextColor={colors.textMuted}/>
    <Text style={styles.label}>Date of birth (YYYY-MM-DD)</Text><TextInput value={dob} onChangeText={setDob} maxLength={10} style={styles.input} placeholder="2008-01-15" placeholderTextColor={colors.textMuted}/>
    <Text style={styles.label}>Gender (optional)</Text><TextInput value={gender} onChangeText={setGender} maxLength={30} style={styles.input} placeholder="Gender" placeholderTextColor={colors.textMuted}/>
    <Text style={styles.label}>Guardian name</Text><TextInput value={guardianName} onChangeText={setGuardianName} maxLength={150} style={styles.input} placeholder="Guardian name" placeholderTextColor={colors.textMuted}/>
    <Text style={styles.label}>Guardian phone</Text><TextInput value={guardianPhone} onChangeText={setGuardianPhone} keyboardType="phone-pad" maxLength={30} style={styles.input} placeholder="Guardian phone" placeholderTextColor={colors.textMuted}/>
    <Text style={styles.label}>Previous institution</Text><TextInput value={previousInstitution} onChangeText={setPreviousInstitution} maxLength={200} style={styles.input} placeholder="Previous school/college" placeholderTextColor={colors.textMuted}/>
    <Text style={styles.label}>Previous percentage (0–100)</Text><TextInput value={previousPercentage} onChangeText={setPreviousPercentage} keyboardType="decimal-pad" style={styles.input} placeholder="Optional percentage" placeholderTextColor={colors.textMuted}/>
    <Text style={styles.label}>Remarks</Text><TextInput value={remarks} onChangeText={setRemarks} maxLength={1000} multiline style={styles.input} placeholder="Optional remarks" placeholderTextColor={colors.textMuted}/>
    {save.isError?<Text style={styles.error}>{save.error instanceof ApiError?save.error.message:save.error instanceof Error?save.error.message:"Application could not be saved."}</Text>:null}
    <Pressable disabled={save.isPending||!programs.length||!years.length} onPress={()=>save.mutate()} style={styles.primary}><Text style={styles.primaryText}>{save.isPending?"Saving…":selectedId?"Save application":"Create application"}</Text></Pressable>
   </View>:null}
   {err?<Text style={styles.error}>{err instanceof Error?err.message:"Admission action failed."}</Text>:null}
  </>:null}
  </ScrollView>;
 }

 return <View style={styles.root}><View style={styles.header}><Text style={styles.title}>Admissions</Text><Text style={styles.subtitle}>Applications, status transitions and enrolment use the existing validated admission API.</Text><TextInput value={search} onChangeText={setSearch} style={styles.input} placeholder="Search applicant name or email" placeholderTextColor={colors.textMuted}/><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.options}><Pressable onPress={()=>setFilterStatus("ALL")} style={[styles.chip,filterStatus==="ALL"?styles.chipSelected:null]}><Text style={[styles.chipText,filterStatus==="ALL"?styles.chipTextSelected:null]}>ALL</Text></Pressable>{admissionStatuses.map(st=><Pressable key={st} onPress={()=>setFilterStatus(st)} style={[styles.chip,filterStatus===st?styles.chipSelected:null]}><Text style={[styles.chipText,filterStatus===st?styles.chipTextSelected:null]}>{st.replace(/_/g," ")}</Text></Pressable>)}</ScrollView>{canManage?<Pressable onPress={beginCreate} style={styles.primary}><Text style={styles.primaryText}>Create application</Text></Pressable>:null}</View>
  {form&&canManage?<ScrollView style={styles.formPanel} contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled"><Text style={styles.sectionTitle}>New application</Text><Text style={styles.label}>First name</Text><TextInput value={firstName} onChangeText={setFirstName} maxLength={100} style={styles.input} placeholder="First name" placeholderTextColor={colors.textMuted}/><Text style={styles.label}>Last name</Text><TextInput value={lastName} onChangeText={setLastName} maxLength={100} style={styles.input} placeholder="Last name" placeholderTextColor={colors.textMuted}/><Text style={styles.label}>Email</Text><TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" maxLength={200} style={styles.input} placeholder="Email" placeholderTextColor={colors.textMuted}/><Text style={styles.label}>Programme</Text>{programs.map(p=><Pressable key={p.id} onPress={()=>setProgramId(p.id)} style={[styles.choice,programId===p.id?styles.chipSelected:null]}><Text style={styles.value}>{labelProgram(p)}</Text></Pressable>)}<Text style={styles.label}>Academic year</Text>{years.map(y=><Pressable key={y.id} onPress={()=>setAcademicYearId(y.id)} style={[styles.choice,academicYearId===y.id?styles.chipSelected:null]}><Text style={styles.value}>{labelYear(y)}</Text></Pressable>)}<Pressable onPress={()=>setForm(false)} style={styles.secondary}><Text style={styles.secondaryText}>Cancel</Text></Pressable><Pressable disabled={save.isPending||!programs.length||!years.length} onPress={()=>save.mutate()} style={styles.primary}><Text style={styles.primaryText}>{save.isPending?"Saving…":"Create application"}</Text></Pressable></ScrollView>:null}
  {list.isLoading?<View style={styles.state}><ActivityIndicator color={colors.primary}/><Text style={styles.subtitle}>Loading applications…</Text></View>:list.isError?<View style={styles.state}><Text style={styles.title}>Applications unavailable</Text><Text style={styles.subtitle}>{list.error instanceof Error?list.error.message:"Try again."}</Text><Pressable onPress={()=>{void list.refetch();}} style={styles.primary}><Text style={styles.primaryText}>Retry</Text></Pressable></View>:<FlatList data={apps} keyExtractor={a=>a.id} contentContainerStyle={styles.list} initialNumToRender={15} windowSize={7} renderItem={({item})=><Pressable onPress={()=>{setSelectedId(item.id);setForm(false);}} style={styles.card}><View style={styles.requestTop}><Text style={styles.choiceTitle}>{item.firstName} {item.lastName}</Text><Text style={styles.status}>{item.status}</Text></View><Text style={styles.meta}>{item.email}</Text><Text style={styles.meta}>{item.program?.name||"Programme"} · {item.academicYear?.name||"Academic year"}</Text><Text style={styles.open}>Open application →</Text></Pressable>} ListEmptyComponent={<View style={styles.state}><Text style={styles.title}>No applications found</Text><Text style={styles.subtitle}>The backend returned no admissions matching the active filters.</Text></View>}/>}
 </View>;
}

const styles=StyleSheet.create({
 root:{flex:1,backgroundColor:colors.canvas},header:{padding:spacing.lg,gap:8,backgroundColor:colors.surface,borderBottomWidth:1,borderColor:colors.border},
 title:{color:colors.text,fontSize:22,fontWeight:"900"},subtitle:{color:colors.textMuted,fontSize:12,lineHeight:18},input:{borderWidth:1,borderColor:colors.border,borderRadius:radius.md,backgroundColor:colors.surface,color:colors.text,paddingHorizontal:12,paddingVertical:10,fontSize:13},
 options:{flexDirection:"row",flexWrap:"wrap",gap:6,paddingVertical:5},chip:{backgroundColor:colors.surfaceMuted,borderRadius:radius.pill,paddingHorizontal:9,paddingVertical:7},chipSelected:{backgroundColor:colors.primary},chipText:{color:colors.textMuted,fontSize:9,fontWeight:"900"},chipTextSelected:{color:colors.white},
 list:{padding:spacing.lg,paddingBottom:30},card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,padding:spacing.lg,marginBottom:10},requestTop:{flexDirection:"row",justifyContent:"space-between",alignItems:"flex-start",gap:8},choiceTitle:{color:colors.text,fontSize:14,fontWeight:"900"},status:{color:colors.primary,backgroundColor:colors.primarySoft,borderRadius:radius.pill,overflow:"hidden",paddingHorizontal:8,paddingVertical:4,fontSize:9,fontWeight:"900"},meta:{color:colors.textMuted,fontSize:10,lineHeight:16,marginTop:4},open:{color:colors.primary,fontWeight:"900",fontSize:11,marginTop:10},
 formPanel:{maxHeight:490,backgroundColor:colors.surface,borderBottomWidth:1,borderColor:colors.border},form:{padding:spacing.lg,gap:7},details:{padding:spacing.lg,paddingBottom:34,gap:12},sectionTitle:{color:colors.text,fontSize:16,fontWeight:"900"},label:{color:colors.text,fontSize:11,fontWeight:"800",marginTop:6},value:{color:colors.text,fontSize:12},field:{borderTopWidth:1,borderColor:colors.border,paddingVertical:8},primary:{backgroundColor:colors.primary,borderRadius:radius.md,minHeight:40,alignItems:"center",justifyContent:"center",paddingHorizontal:12,paddingVertical:10,marginTop:6},primaryText:{color:colors.white,fontSize:11,fontWeight:"900"},secondary:{backgroundColor:colors.primarySoft,borderRadius:radius.md,paddingHorizontal:12,paddingVertical:10,alignSelf:"flex-start"},secondaryText:{color:colors.primary,fontSize:11,fontWeight:"800"},choice:{borderWidth:1,borderColor:colors.border,borderRadius:radius.md,padding:10,marginVertical:3},actionRow:{flexDirection:"row",flexWrap:"wrap",gap:7,marginTop:6},back:{color:colors.primary,fontSize:13,fontWeight:"900"},state:{flex:1,alignItems:"center",justifyContent:"center",padding:spacing.xl,gap:9},error:{color:colors.danger,fontSize:11,lineHeight:16}
});