import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "../api/client";
import { toCollection } from "../api/payload";
import { useAuth } from "../auth/AuthProvider";
import { useWorkspaceContext } from "../workspace/WorkspaceContextProvider";
import { colors, radius, spacing } from "../ui/theme";

type EmploymentType="FULL_TIME"|"PART_TIME"|"CONTRACT"|"VISITING";
type EmployeeStatus="ACTIVE"|"ON_LEAVE"|"RESIGNED"|"TERMINATED"|"RETIRED";
type EligibleUser={id:string;firstName?:string;lastName?:string;email?:string;idNumber?:string;roles?:string[];[key:string]:unknown};
type Department={id:string;name?:string;code?:string;[key:string]:unknown};
type Employee={id:string;userId:string;employeeCode:string;designation:string;employmentType:EmploymentType;joiningDate:string;status:EmployeeStatus;qualification?:string|null;address?:string|null;departmentId?:string|null;department?:Department|null;user?:EligibleUser;[key:string]:unknown};
const employmentTypes:EmploymentType[]=["FULL_TIME","PART_TIME","CONTRACT","VISITING"];
const employeeStatuses:EmployeeStatus[]=["ACTIVE","ON_LEAVE","RESIGNED","TERMINATED","RETIRED"];
function rows<T>(v:unknown):T[]{return toCollection(v) as T[];}
function labelUser(u:EligibleUser){return [u.firstName,u.lastName].filter(Boolean).join(" ")||u.email||u.idNumber||"Institution user";}
function labelDepartment(d:Department){return [d.code,d.name].filter(Boolean).join(" · ")||"Department";}
function dateInput(s?:string){if(!s)return "";const d=new Date(s);return Number.isNaN(d.valueOf())?s.slice(0,10):d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function validDate(s:string){return /^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(new Date(s+"T12:00:00").valueOf());}

export function HRScreen(){
 const {user}=useAuth();
  const { context } = useWorkspaceContext();
  const workspaceKey = JSON.stringify(context?.scope ?? {});const client=useQueryClient();
 const canRead=Boolean(user?.permissions.includes("hr.read"));const canManage=Boolean(user?.permissions.includes("hr.manage"));
 const [search,setSearch]=useState("");const [status,setStatus]=useState<EmployeeStatus|"ALL">("ALL");const [employmentType,setEmploymentType]=useState<EmploymentType|"ALL">("ALL");
 const [editing,setEditing]=useState<Employee|null>(null);const [form,setForm]=useState(false);const [selectedUserId,setSelectedUserId]=useState<string|null>(null);const [selectedDepartmentId,setSelectedDepartmentId]=useState<string|null>(null);
 const [userSearch,setUserSearch]=useState("");const [employeeCode,setEmployeeCode]=useState("");const [designation,setDesignation]=useState("");const [joiningDate,setJoiningDate]=useState(dateInput(new Date().toISOString()));const [type,setType]=useState<EmploymentType>("FULL_TIME");const [employeeStatus,setEmployeeStatus]=useState<EmployeeStatus>("ACTIVE");
 const [qualification,setQualification]=useState("");const [address,setAddress]=useState("");const [emergencyName,setEmergencyName]=useState("");const [emergencyPhone,setEmergencyPhone]=useState("");

 const employeesQuery=useQuery({queryKey:["hr-employees",user?.id, workspaceKey,search,status,employmentType],queryFn:()=>apiRequest<unknown>("/hr/employees?page=1&pageSize=50"+(search.trim()?"&search="+encodeURIComponent(search.trim()):"")+(status!=="ALL"?"&status="+status:"")+(employmentType!=="ALL"?"&employmentType="+employmentType:"")),enabled:Boolean(user?.id&&canRead),staleTime:0});
 const usersQuery=useQuery({queryKey:["hr-eligible-users",user?.id, workspaceKey,userSearch],queryFn:()=>apiRequest<unknown>("/hr/eligible-users?search="+encodeURIComponent(userSearch.trim())),enabled:Boolean(user?.id&&canManage&&form&&!editing),staleTime:15000});
 const departmentsQuery=useQuery({queryKey:["hr-departments",user?.id],queryFn:()=>apiRequest<unknown>("/departments?page=1&pageSize=100"),enabled:Boolean(user?.id&&canManage&&form),staleTime:15000});
 const employees=useMemo(()=>rows<Employee>(employeesQuery.data).filter(e=>typeof e.id==="string"),[employeesQuery.data]);
 const eligible=useMemo(()=>rows<EligibleUser>(usersQuery.data).filter(u=>typeof u.id==="string"),[usersQuery.data]);
 const departments=useMemo(()=>rows<Department>(departmentsQuery.data).filter(d=>typeof d.id==="string"),[departmentsQuery.data]);

 async function invalidate(){await Promise.all([client.invalidateQueries({queryKey:["hr-employees",user?.id]}),client.invalidateQueries({queryKey:["hr-eligible-users",user?.id]}),client.invalidateQueries({queryKey:["my-work",user?.id]})]);}
 function clearForm(){setEditing(null);setForm(false);setSelectedUserId(null);setSelectedDepartmentId(null);setUserSearch("");setEmployeeCode("");setDesignation("");setJoiningDate(dateInput(new Date().toISOString()));setType("FULL_TIME");setEmployeeStatus("ACTIVE");setQualification("");setAddress("");setEmergencyName("");setEmergencyPhone("");}
 function beginCreate(){clearForm();setForm(true);}
 function beginEdit(e:Employee){setEditing(e);setSelectedUserId(e.userId);setSelectedDepartmentId(e.departmentId||null);setEmployeeCode(e.employeeCode);setDesignation(e.designation);setJoiningDate(dateInput(e.joiningDate));setType(e.employmentType);setEmployeeStatus(e.status);setQualification(e.qualification||"");setAddress(e.address||"");setEmergencyName(typeof e.emergencyContactName==="string"?e.emergencyContactName:"");setEmergencyPhone(typeof e.emergencyContactPhone==="string"?e.emergencyContactPhone:"");setForm(true);}

 const save=useMutation({
  mutationFn:async()=>{
   if(!canManage)throw new Error("Your session does not include hr.manage.");
   if(employeeCode.trim().length<1||employeeCode.trim().length>50)throw new Error("Employee code must contain 1–50 characters.");
   if(designation.trim().length<2||designation.trim().length>150)throw new Error("Designation must contain 2–150 characters.");
   if(!validDate(joiningDate))throw new Error("Joining date must use YYYY-MM-DD.");
   const common={employeeCode:employeeCode.trim().toUpperCase(),designation:designation.trim(),employmentType:type,joiningDate:new Date(joiningDate+"T12:00:00").toISOString(),qualification:qualification.trim()||undefined,address:address.trim()||undefined,emergencyContactName:emergencyName.trim()||undefined,emergencyContactPhone:emergencyPhone.trim()||undefined};
   if(editing)return apiRequest<Employee>("/hr/employees/"+encodeURIComponent(editing.id),{method:"PATCH",body:JSON.stringify({...common,departmentId:selectedDepartmentId,status:employeeStatus})});
   if(!selectedUserId)throw new Error("Choose an eligible institution user.");
   return apiRequest<Employee>("/hr/employees",{method:"POST",body:JSON.stringify({...common,...(selectedDepartmentId?{departmentId:selectedDepartmentId}:{}),userId:selectedUserId})});
  },
  onSuccess:async()=>{await invalidate();clearForm();}
 });
 const error=save.error;
 if(!canRead&&!canManage)return <View style={styles.state}><Text style={styles.title}>HR access unavailable</Text><Text style={styles.subtitle}>Your session does not include hr.read or hr.manage. The backend remains authoritative.</Text></View>;

 return <View style={styles.root}>
  <View style={styles.header}><Text style={styles.title}>Human resources</Text><Text style={styles.subtitle}>Employee records use the existing HR API and its institution-level authorization.</Text>
   <TextInput value={search} onChangeText={setSearch} style={styles.input} placeholder="Search employees" placeholderTextColor={colors.textMuted} accessibilityLabel="Search employees"/>
   <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
    <Pressable onPress={()=>setStatus("ALL")} style={[styles.chip,status==="ALL"?styles.chipSelected:null]}><Text style={[styles.chipText,status==="ALL"?styles.chipTextSelected:null]}>All statuses</Text></Pressable>
    {employeeStatuses.map(s=><Pressable key={s} onPress={()=>setStatus(s)} style={[styles.chip,status===s?styles.chipSelected:null]}><Text style={[styles.chipText,status===s?styles.chipTextSelected:null]}>{s.replace(/_/g," ")}</Text></Pressable>)}
   </ScrollView>
   <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
    <Pressable onPress={()=>setEmploymentType("ALL")} style={[styles.chip,employmentType==="ALL"?styles.chipSelected:null]}><Text style={[styles.chipText,employmentType==="ALL"?styles.chipTextSelected:null]}>All employment</Text></Pressable>
    {employmentTypes.map(t=><Pressable key={t} onPress={()=>setEmploymentType(t)} style={[styles.chip,employmentType===t?styles.chipSelected:null]}><Text style={[styles.chipText,employmentType===t?styles.chipTextSelected:null]}>{t.replace(/_/g," ")}</Text></Pressable>)}
   </ScrollView>
   {canManage?<Pressable onPress={form?clearForm:beginCreate} style={styles.primary}><Text style={styles.primaryText}>{form?"Close editor":"Add employee record"}</Text></Pressable>:null}
  </View>
  {form&&canManage?<ScrollView style={styles.formPanel} contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
   <Text style={styles.sectionTitle}>{editing?"Edit employee record":"Create employee record"}</Text>
   {!editing?<><Text style={styles.label}>Choose eligible institutional user</Text><TextInput value={userSearch} onChangeText={setUserSearch} style={styles.input} placeholder="Filter eligible users" placeholderTextColor={colors.textMuted}/>
    {usersQuery.isLoading?<ActivityIndicator color={colors.primary}/>:usersQuery.isError?<Text style={styles.error}>Eligible users could not be loaded. No raw user ID field is provided.</Text>:eligible.map(u=><Pressable key={u.id} onPress={()=>setSelectedUserId(u.id)} style={[styles.choice,selectedUserId===u.id?styles.selected:null]}><Text style={styles.choiceTitle}>{labelUser(u)}</Text><Text style={styles.meta}>{u.roles?.join(", ")||u.idNumber||""}{selectedUserId===u.id?" · Selected":""}</Text></Pressable>)}
   </>:<Text style={styles.helper}>The employee stays linked to the existing user account.</Text>}
   <Text style={styles.label}>Employee code</Text><TextInput value={employeeCode} onChangeText={setEmployeeCode} maxLength={50} autoCapitalize="characters" style={styles.input} placeholder="EMP-001" placeholderTextColor={colors.textMuted}/>
   <Text style={styles.label}>Designation</Text><TextInput value={designation} onChangeText={setDesignation} maxLength={150} style={styles.input} placeholder="Designation" placeholderTextColor={colors.textMuted}/>
   <Text style={styles.label}>Department (optional)</Text>{departmentsQuery.isLoading?<ActivityIndicator color={colors.primary}/>:departmentsQuery.isError?<Text style={styles.helper}>Department choices are unavailable; you may leave the department empty.</Text>:<><Pressable onPress={()=>setSelectedDepartmentId(null)} style={[styles.choice,selectedDepartmentId===null?styles.selected:null]}><Text style={styles.choiceTitle}>No department</Text></Pressable>{departments.map(d=><Pressable key={d.id} onPress={()=>setSelectedDepartmentId(d.id)} style={[styles.choice,selectedDepartmentId===d.id?styles.selected:null]}><Text style={styles.choiceTitle}>{labelDepartment(d)}</Text></Pressable>)}</>}
   <Text style={styles.label}>Employment type</Text><View style={styles.filters}>{employmentTypes.map(t=><Pressable key={t} onPress={()=>setType(t)} style={[styles.chip,type===t?styles.chipSelected:null]}><Text style={[styles.chipText,type===t?styles.chipTextSelected:null]}>{t.replace(/_/g," ")}</Text></Pressable>)}</View>
   <Text style={styles.label}>Joining date (YYYY-MM-DD)</Text><TextInput value={joiningDate} onChangeText={setJoiningDate} maxLength={10} style={styles.input} placeholder="2026-10-20" placeholderTextColor={colors.textMuted}/>
   {editing?<><Text style={styles.label}>Employee status</Text><View style={styles.filters}>{employeeStatuses.map(s=><Pressable key={s} onPress={()=>setEmployeeStatus(s)} style={[styles.chip,employeeStatus===s?styles.chipSelected:null]}><Text style={[styles.chipText,employeeStatus===s?styles.chipTextSelected:null]}>{s.replace(/_/g," ")}</Text></Pressable>)}</View></>:null}
   <Text style={styles.label}>Qualification (optional)</Text><TextInput value={qualification} onChangeText={setQualification} maxLength={300} style={styles.input} placeholder="Qualification" placeholderTextColor={colors.textMuted}/>
   <Text style={styles.label}>Address (optional)</Text><TextInput value={address} onChangeText={setAddress} maxLength={500} multiline style={styles.input} placeholder="Address" placeholderTextColor={colors.textMuted}/>
   <Text style={styles.label}>Emergency contact name</Text><TextInput value={emergencyName} onChangeText={setEmergencyName} maxLength={150} style={styles.input} placeholder="Name" placeholderTextColor={colors.textMuted}/>
   <Text style={styles.label}>Emergency contact phone</Text><TextInput value={emergencyPhone} onChangeText={setEmergencyPhone} maxLength={30} keyboardType="phone-pad" style={styles.input} placeholder="Phone" placeholderTextColor={colors.textMuted}/>
   {save.isError?<Text style={styles.error}>{save.error instanceof ApiError?save.error.message:save.error instanceof Error?save.error.message:"Employee record could not be saved."}</Text>:null}
   <Pressable disabled={save.isPending||(!editing&&!eligible.length)} onPress={()=>save.mutate()} style={styles.primary}>{save.isPending?<ActivityIndicator color={colors.white}/>:<Text style={styles.primaryText}>{editing?"Save employee changes":"Create employee record"}</Text>}</Pressable>
  </ScrollView>:null}
  {employeesQuery.isLoading?<View style={styles.state}><ActivityIndicator color={colors.primary}/><Text style={styles.subtitle}>Loading employee records…</Text></View>:employeesQuery.isError?<View style={styles.state}><Text style={styles.title}>Employee records unavailable</Text><Text style={styles.subtitle}>{employeesQuery.error instanceof Error?employeesQuery.error.message:"Try again."}</Text><Pressable onPress={()=>{void employeesQuery.refetch();}} style={styles.primary}><Text style={styles.primaryText}>Retry</Text></Pressable></View>:
  <FlatList data={employees} keyExtractor={e=>e.id} contentContainerStyle={styles.list} initialNumToRender={15} windowSize={7} renderItem={({item})=><View style={styles.card}>
   <View style={styles.row}><Text style={styles.choiceTitle}>{item.user?[item.user.firstName,item.user.lastName].filter(Boolean).join(" ")||item.user.email:item.employeeCode}</Text><Text style={styles.status}>{item.status}</Text></View>
   <Text style={styles.meta}>{item.employeeCode} · {item.designation}</Text><Text style={styles.meta}>{item.department?.name||"No department"} · {item.employmentType.replace(/_/g," ")}</Text><Text style={styles.meta}>Joined {dateInput(item.joiningDate)}</Text>
   {canManage?<Pressable onPress={()=>beginEdit(item)} style={styles.secondary}><Text style={styles.secondaryText}>Edit employee</Text></Pressable>:null}
  </View>} ListEmptyComponent={<View style={styles.state}><Text style={styles.title}>No employee records found</Text><Text style={styles.subtitle}>No employees matched the active filters and current scope.</Text></View>}/>}
  {error?<View style={styles.errorBanner}><Text style={styles.error}>{error instanceof Error?error.message:"HR action failed."}</Text></View>:null}
 </View>;
}
const styles=StyleSheet.create({
 root:{flex:1,backgroundColor:colors.canvas},header:{padding:spacing.lg,gap:8,backgroundColor:colors.surface,borderBottomWidth:1,borderColor:colors.border},
 title:{color:colors.text,fontSize:23,fontWeight:"900"},subtitle:{color:colors.textMuted,fontSize:12,lineHeight:18},input:{borderWidth:1,borderColor:colors.border,borderRadius:radius.md,backgroundColor:colors.surface,color:colors.text,paddingHorizontal:12,paddingVertical:10,fontSize:13},
 filters:{flexDirection:"row",flexWrap:"wrap",gap:6,paddingVertical:3},chip:{backgroundColor:colors.surfaceMuted,borderRadius:radius.pill,paddingHorizontal:10,paddingVertical:7},chipSelected:{backgroundColor:colors.primary},chipText:{color:colors.textMuted,fontSize:10,fontWeight:"800"},chipTextSelected:{color:colors.white},
 primary:{backgroundColor:colors.primary,borderRadius:radius.md,minHeight:40,alignItems:"center",justifyContent:"center",paddingHorizontal:13,paddingVertical:10,marginTop:3},primaryText:{color:colors.white,fontSize:11,fontWeight:"900"},
 formPanel:{maxHeight:540,backgroundColor:colors.surface,borderBottomWidth:1,borderColor:colors.border},form:{padding:spacing.lg,gap:7},sectionTitle:{color:colors.text,fontSize:16,fontWeight:"900"},label:{color:colors.text,fontSize:11,fontWeight:"800",marginTop:5},
 choice:{borderWidth:1,borderColor:colors.border,borderRadius:radius.md,padding:10,marginBottom:5},selected:{borderColor:colors.primary,backgroundColor:colors.primarySoft},choiceTitle:{color:colors.text,fontSize:13,fontWeight:"900"},meta:{color:colors.textMuted,fontSize:10,lineHeight:15,marginTop:4},helper:{color:colors.textMuted,fontSize:11,lineHeight:16},
 list:{padding:spacing.lg,paddingBottom:30},card:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,padding:spacing.lg,marginBottom:10},row:{flexDirection:"row",justifyContent:"space-between",alignItems:"flex-start",gap:8},status:{color:colors.primary,backgroundColor:colors.primarySoft,borderRadius:radius.pill,overflow:"hidden",paddingHorizontal:8,paddingVertical:4,fontSize:9,fontWeight:"900"},
 secondary:{alignSelf:"flex-start",marginTop:10,paddingHorizontal:11,paddingVertical:8,borderRadius:radius.sm,backgroundColor:colors.primarySoft},secondaryText:{color:colors.primary,fontSize:10,fontWeight:"900"},state:{flex:1,alignItems:"center",justifyContent:"center",padding:spacing.xl,gap:10},error:{color:colors.danger,fontSize:11,lineHeight:16},errorBanner:{padding:9,backgroundColor:colors.dangerSoft,borderTopWidth:1,borderColor:colors.border}
});