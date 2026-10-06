"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AuthRequiredError, authedFetch, getCachedCurrentUser } from "@/lib/auth";
import { deleteAdminUser, requestAdminUserPermanentDeletion } from "@/lib/adminApi";
import { ModalPortal } from "@/components/ui/ModalPortal";
import { DetailDrawer, DetailField } from "@/components/ui/DetailDrawer";

type Lookup = { id: string; name?: string; code?: string; number?: number; programId?: string; academicYearId?: string; departmentId?: string; semesterId?: string; capacity?: number | null; isActive?: boolean; isCurrent?: boolean; department?: { id: string; name: string; code?: string | null } };
type Student = { id: string; idNumber: string; email: string; firstName: string; lastName: string; phone?: string | null; isActive: boolean; enrollmentState?: "PROFILE_MISSING" | "MISSING" | "INVALID" | "ENROLLED"; profile?: { admissionNumber: string; dateOfBirth?: string | null; gender?: string | null; bloodGroup?: string | null; nationality?: string | null; address?: string | null; city?: string | null; state?: string | null; postalCode?: string | null; guardianName?: string | null; guardianPhone?: string | null; guardianEmail?: string | null; emergencyContactName?: string | null; emergencyContactPhone?: string | null; admissionDate?: string | null; status: string } | null; enrollments?: Enrollment[]; currentEnrollment?: Enrollment | null };
type Enrollment = { id: string; academicYearId: string; programId: string; semesterId?: string | null; sectionId?: string | null; rollNumber?: string | null; status: string; enrolledAt?: string; program?: Lookup; academicYear?: Lookup; semester?: Lookup; section?: Lookup };
type ListResponse<T> = { success?: boolean; data?: T[]; meta?: { total?: number; page?: number; pageSize?: number; totalPages?: number } };
type Props = { onChanged?: () => void | Promise<void>; departmentId?: string };

const statuses = ["ACTIVE", "INACTIVE", "GRADUATED", "WITHDRAWN", "TRANSFERRED"];
const enrollmentStatuses = ["ACTIVE", "COMPLETED", "DROPPED", "TRANSFERRED"];
function inputClass() { return "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-50"; }
function labelClass() { return "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500"; }
function dateValue(value?: string | null) {
  if (!value) return "";
  const raw = String(value);
  const dateOnly = raw.match(/^\d{4}-\d{2}-\d{2}/);
  if (dateOnly) return dateOnly[0];
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? raw.slice(0, 10) : new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
function optionLabel(item: Lookup) { if (item.code && item.name) return `${item.code} — ${item.name}`; if (item.number !== undefined && item.name) return `Semester ${item.number} — ${item.name}`; return item.name || item.code || item.id; }
function statusClass(status: string) { if (status === "ACTIVE") return "bg-emerald-50 text-emerald-700"; if (status === "GRADUATED" || status === "COMPLETED") return "bg-blue-50 text-blue-700"; if (status === "WITHDRAWN" || status === "DROPPED" || status === "TRANSFERRED") return "bg-amber-50 text-amber-700"; return "bg-slate-100 text-slate-600"; }
function Field({ label, children, required }: { label: string; children: ReactNode; required?: boolean }) { return <label><span className={labelClass()}>{label}{required ? " *" : ""}</span>{children}</label>; }
function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) { return <section className="rounded-2xl border border-slate-200 bg-white p-5"><div className="mb-4"><h3 className="font-semibold text-slate-950">{title}</h3>{description && <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>}</div>{children}</section>; }

export function StudentManagement({ onChanged, departmentId }: Props) {
  const [students, setStudents] = useState<Student[]>([]); const [page, setPage] = useState(1); const [totalPages, setTotalPages] = useState(1); const [totalStudents, setTotalStudents] = useState(0); const [permissions, setPermissions] = useState<string[]>([]); const [departments, setDepartments] = useState<Lookup[]>([]); const [programs, setPrograms] = useState<Lookup[]>([]); const [academicYears, setAcademicYears] = useState<Lookup[]>([]); const [semesters, setSemesters] = useState<Lookup[]>([]); const [sections, setSections] = useState<Lookup[]>([]); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const [success, setSuccess] = useState(""); const [search, setSearch] = useState(""); const [statusFilter, setStatusFilter] = useState(""); const [programFilter, setProgramFilter] = useState(""); const [semesterFilter, setSemesterFilter] = useState(""); const [sectionFilter, setSectionFilter] = useState(""); const [showForm, setShowForm] = useState(false); const [editing, setEditing] = useState<Student | null>(null); const [selected, setSelected] = useState<Student | null>(null); const [showEnrollment, setShowEnrollment] = useState(false);
  const emptyForm = { idNumber:"", email:"", firstName:"", lastName:"", phone:"", password:"", admissionNumber:"", dateOfBirth:"", gender:"", bloodGroup:"", nationality:"Indian", address:"", city:"", state:"", postalCode:"", guardianName:"", guardianPhone:"", guardianEmail:"", emergencyContactName:"", emergencyContactPhone:"", admissionDate:"", status:"ACTIVE", programId:"", academicYearId:"", semesterId:"", sectionId:"", rollNumber:"" };
  const [form, setForm] = useState(emptyForm); const [enrollment, setEnrollment] = useState({ academicYearId:"", programId:"", semesterId:"", sectionId:"", rollNumber:"", status:"ACTIVE" });
  const studentFilterReady = useRef(false);
  const loadLookups = useCallback(async () => {
    const [d,y] = await Promise.all([
      departmentId
        ? authedFetch<{data:Lookup}>(`/departments/${encodeURIComponent(departmentId)}`)
        : authedFetch<ListResponse<Lookup>>("/departments?page=1&pageSize=100&isActive=true"),
      authedFetch<ListResponse<Lookup>>("/academic-years?page=1&pageSize=100")
    ]);
    const departmentItems = Array.isArray(d.data) ? d.data : d.data ? [d.data] : [];\n    setDepartments(departmentItems);
    setAcademicYears(y.data||[]);
  },[departmentId]);
  const loadPrograms = useCallback(async (departmentId: string) => { if (!departmentId) { setPrograms([]); return []; } const r=await authedFetch<ListResponse<Lookup>>(`/programs?page=1&pageSize=100&isActive=true&departmentId=${encodeURIComponent(departmentId)}`); const items=r.data||[]; setPrograms(items); return items; },[]);
  const loadSemesters = useCallback(async (programId: string, academicYearId: string) => { if (!programId || !academicYearId) { setSemesters([]); return []; } const r=await authedFetch<ListResponse<Lookup>>(`/semesters?page=1&pageSize=100&isActive=true&programId=${encodeURIComponent(programId)}&academicYearId=${encodeURIComponent(academicYearId)}`); const items=r.data||[]; setSemesters(items); return items; },[]);
  const loadSections = useCallback(async (semesterId: string) => { if (!semesterId) { setSections([]); return []; } const r=await authedFetch<ListResponse<Lookup>>(`/sections?page=1&pageSize=100&isActive=true&semesterId=${encodeURIComponent(semesterId)}`); const items=r.data||[]; setSections(items); return items; },[]);
  const loadStudents = useCallback(async () => { setLoading(true); setError(""); try { const params=new URLSearchParams({page:String(page),pageSize:"50"}); if(departmentId) params.set("departmentId",departmentId); else if(departmentFilter) params.set("departmentId",departmentFilter); if(search.trim())params.set("search",search.trim()); if(statusFilter)params.set("status",statusFilter); if(programFilter)params.set("programId",programFilter); if(semesterFilter)params.set("semesterId",semesterFilter); if(sectionFilter)params.set("sectionId",sectionFilter); const response=await authedFetch<ListResponse<Student>>(`/students?${params.toString()}`); const nextStudents=response.data||[]; setStudents(nextStudents); setTotalStudents(response.meta?.total ?? nextStudents.length); setTotalPages(Math.max(1,response.meta?.totalPages ?? 1)); } catch(err){ if(err instanceof AuthRequiredError)throw err; setError(err instanceof Error?err.message:"Unable to load students."); } finally{setLoading(false);} },[search,statusFilter,departmentFilter,programFilter,semesterFilter,sectionFilter,departmentId,page]);
  useEffect(()=>{void(async()=>{try{const currentUser=getCachedCurrentUser();setPermissions(currentUser?.permissions??[]);await Promise.all([loadLookups(),loadStudents(),departmentId ? loadPrograms(departmentId) : Promise.resolve([])]);}catch(err){setError(err instanceof Error?err.message:"Unable to load student management.");}})();},[loadLookups,loadStudents,loadPrograms,departmentId]);
  useEffect(()=>{setPage(1);},[search,statusFilter,departmentFilter,programFilter,semesterFilter,sectionFilter,departmentId]);
  useEffect(()=>{if(!studentFilterReady.current){studentFilterReady.current=true;return;}const timer=window.setTimeout(()=>{void loadStudents();},250);return()=>window.clearTimeout(timer);},[loadStudents]);
  const filteredPrograms=programs;
  const filteredSemesters=semesters;
  const filteredSections=sections;
  const enrollmentSemesters=semesters;
  const enrollmentSections=sections;
  function setField(key:keyof typeof form,value:string){setForm(previous=>({...previous,[key]:value}));}
  function resetForm(){setForm(emptyForm);setEditing(null);setShowForm(false);}
  function startCreate(){setSuccess("");setError("");setEditing(null);setForm({...emptyForm,academicYearId:academicYears.find(x=>x.isCurrent)?.id||""});setShowForm(true);if(departmentId)void loadPrograms(departmentId);}
  async function startEdit(student:Student){const p=student.profile;const e=student.currentEnrollment;setSuccess("");setError("");setEditing(student);setDepartments(current=>current);setForm({idNumber:student.idNumber,email:student.email,firstName:student.firstName,lastName:student.lastName,phone:student.phone||"",password:"",admissionNumber:p?.admissionNumber||"",dateOfBirth:dateValue(p?.dateOfBirth),gender:p?.gender||"",bloodGroup:p?.bloodGroup||"",nationality:p?.nationality||"",address:p?.address||"",city:p?.city||"",state:p?.state||"",postalCode:p?.postalCode||"",guardianName:p?.guardianName||"",guardianPhone:p?.guardianPhone||"",guardianEmail:p?.guardianEmail||"",emergencyContactName:p?.emergencyContactName||"",emergencyContactPhone:p?.emergencyContactPhone||"",admissionDate:dateValue(p?.admissionDate),status:p?.status||"ACTIVE",programId:e?.programId||"",academicYearId:e?.academicYearId||"",semesterId:e?.semesterId||"",sectionId:e?.sectionId||"",rollNumber:e?.rollNumber||""});setShowForm(true);if(e?.program?.department?.id){await loadPrograms(e.program.department.id);if(e.programId&&e.academicYearId){await loadSemesters(e.programId,e.academicYearId);}if(e.semesterId){await loadSections(e.semesterId);}}}
  async function saveStudent(event:FormEvent){event.preventDefault();setSaving(true);setError("");setSuccess("");try{if(!editing){const payload:Record<string,unknown>={...form,password:form.password,sectionId:form.sectionId||""};delete payload.password;payload.password=form.password;await authedFetch("/students",{method:"POST",body:JSON.stringify(payload)});setSuccess("Student account, master profile and first enrollment created successfully.");}else{const payload:Record<string,unknown>={idNumber:form.idNumber,email:form.email,firstName:form.firstName,lastName:form.lastName,phone:form.phone,admissionNumber:form.admissionNumber,dateOfBirth:form.dateOfBirth,gender:form.gender,bloodGroup:form.bloodGroup,nationality:form.nationality,address:form.address,city:form.city,state:form.state,postalCode:form.postalCode,guardianName:form.guardianName,guardianPhone:form.guardianPhone,guardianEmail:form.guardianEmail,emergencyContactName:form.emergencyContactName,emergencyContactPhone:form.emergencyContactPhone,admissionDate:form.admissionDate,status:form.status};await authedFetch(`/students/${editing.id}`,{method:"PATCH",body:JSON.stringify(payload)});if(form.programId&&form.academicYearId&&form.semesterId)await authedFetch(`/students/${editing.id}/enrollments`,{method:"POST",body:JSON.stringify({programId:form.programId,academicYearId:form.academicYearId,semesterId:form.semesterId,sectionId:form.sectionId||"",rollNumber:form.rollNumber,status:"ACTIVE"})});setSuccess("Student profile and academic enrollment updated successfully.");}resetForm();await loadStudents();await onChanged?.();}catch(err){setError(err instanceof Error?err.message:"Unable to save student.");}finally{setSaving(false);}}
  async function softDeleteStudent(student:Student){if(!permissions.includes("users.delete"))return;const confirmed=window.confirm(`Move ${student.firstName} ${student.lastName} to Deleted Users? The account will be disabled and recoverable for 90 days.`);if(!confirmed)return;const reason=window.prompt("Required deletion reason:","")?.trim();if(!reason){setError("A deletion reason is required.");return;}setSaving(true);setError("");setSuccess("");try{await deleteAdminUser(student.id,reason);setStudents(current=>current.filter(item=>item.id!==student.id));setSelected(null);setSuccess("Student moved to Deleted Users. The 90-day recovery period has started.");await onChanged?.();}catch(err){setError(err instanceof Error?err.message:"Unable to delete student.");}finally{setSaving(false);}}
  async function permanentlyDeleteStudent(student:Student){if(!permissions.includes("users.delete"))return;const confirmed=window.confirm(`PERMANENTLY DELETE ${student.firstName} ${student.lastName}?\n\nThis permanently removes the student account and related records allowed by the database relations. This cannot be undone.`);if(!confirmed)return;const reason=window.prompt("Optional permanent deletion reason:","")?.trim()||undefined;setSaving(true);setError("");setSuccess("");try{const result=await requestAdminUserPermanentDeletion(student.id,reason);if(result.permanentlyDeleted){setStudents(current=>current.filter(item=>item.id!==student.id));setSelected(null);setSuccess("Student permanently deleted.");}else setSuccess(result.message||"Permanent deletion request submitted for higher-authority approval.");await onChanged?.();}catch(err){setError(err instanceof Error?err.message:"Unable to permanently delete student.");}finally{setSaving(false);}}
  async function openStudent(student:Student){setError("");try{const response=await authedFetch<{success?:boolean;data?:Student}>(`/students/${student.id}`);setSelected(response.data||student);}catch(err){setError(err instanceof Error?err.message:"Unable to open student.");}}
  async function startEnrollment(student:Student){const e=student.currentEnrollment;const contextDepartmentId=departmentId||e?.program?.department?.id||"";setSelected(student);setEnrollment({academicYearId:academicYears.find(x=>x.isCurrent)?.id||e?.academicYearId||"",programId:e?.programId||"",semesterId:e?.semesterId||"",sectionId:e?.sectionId||"",rollNumber:e?.rollNumber||"",status:"ACTIVE"});setShowEnrollment(true);if(contextDepartmentId){await loadPrograms(contextDepartmentId);if(e.programId&&e.academicYearId){await loadSemesters(e.programId,e.academicYearId);}if(e.semesterId){await loadSections(e.semesterId);}}}
  async function saveEnrollment(event:FormEvent){event.preventDefault();if(!selected)return;setSaving(true);setError("");setSuccess("");try{await authedFetch(`/students/${selected.id}/enrollments`,{method:"POST",body:JSON.stringify({...enrollment,sectionId:enrollment.sectionId||""})});const response=await authedFetch<{success?:boolean;data?:Student}>(`/students/${selected.id}`);const authoritative=response.data||selected;setSelected(authoritative);setShowEnrollment(false);setSuccess("Academic enrollment updated successfully.");await loadStudents();await onChanged?.();}catch(err){setError(err instanceof Error?err.message:"Unable to save enrollment.");}finally{setSaving(false);}}

  function EnrollmentRowAction({ student, onOpen }: { student: Student; onOpen: (student: Student) => void }) {
    if (student.enrollmentState === "PROFILE_MISSING") return <button onClick={() => void startEdit(student)} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100">Create Profile</button>;
    if (student.enrollmentState === "ENROLLED") return <span className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">✓ Enrolled</span>;
    if (student.enrollmentState === "INVALID") return <button onClick={() => void onOpen(student)} className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700">Fix Enrollment</button>;
    return <button onClick={() => void onOpen(student)} className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800">Manage Enrollment</button>;
  }

  return <div className="space-y-5">
    {error&&<div className="flex items-start justify-between rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><span>{error}</span><button onClick={()=>setError("")} className="font-semibold">Dismiss</button></div>}
    {success&&<div className="flex items-start justify-between rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"><span>{success}</span><button onClick={()=>setSuccess("")} className="font-semibold">Dismiss</button></div>}
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Student Master</p><h2 className="mt-1 text-2xl font-bold text-slate-950">Students</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">Manage student identities, admission records, guardians and academic enrollment from one tenant-safe workspace.</p></div>{permissions.includes("students.create")?<button onClick={startCreate} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">+ Add Student</button>:null}</div>
    <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-2 xl:grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, email or admission no." className={inputClass()}/><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className={inputClass()}><option value="">All statuses</option>{statuses.map(x=><option key={x} value={x}>{x.replace("_"," ")}</option>)}</select><select value={departmentFilter} onChange={e=>{setDepartmentFilter(e.target.value);setProgramFilter("");setSemesterFilter("");setSectionFilter("");void loadPrograms(e.target.value)}} className={inputClass()} disabled={Boolean(departmentId)}><option value="">All departments</option>{departments.map(x=><option key={x.id} value={x.id}>{optionLabel(x)}</option>)}</select><select value={programFilter} onChange={e=>setProgramFilter(e.target.value)} className={inputClass()}><option value="">All programs</option>{programs.map(x=><option key={x.id} value={x.id}>{optionLabel(x)}</option>)}</select><select value={semesterFilter} onChange={e=>setSemesterFilter(e.target.value)} className={inputClass()}><option value="">All semesters</option>{semesters.map(x=><option key={x.id} value={x.id}>{optionLabel(x)}</option>)}</select><select value={sectionFilter} onChange={e=>setSectionFilter(e.target.value)} className={inputClass()}><option value="">All sections</option>{sections.map(x=><option key={x.id} value={x.id}>{optionLabel(x)}</option>)}</select></div>
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {loading && <div className="p-10 text-center text-sm text-slate-500">Loading students…</div>}
      {!loading && students.length === 0 && (
        <div className="p-10 text-center">
          <p className="font-semibold text-slate-900">No students found</p>
          <p className="mt-1 text-sm text-slate-500">Create a student or adjust your filters.</p>
          {permissions.includes("students.create") && (
            <button onClick={startCreate} className="mt-4 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Add Student</button>
          )}
        </div>
      )}
      {!loading && students.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3">Student</th><th className="px-4 py-3">Admission</th><th className="px-4 py-3">Department</th><th className="px-4 py-3">Program</th><th className="px-4 py-3">Academic Year</th><th className="px-4 py-3">Semester / Section</th><th className="px-4 py-3">Roll No.</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map(student => {
                  const e = student.currentEnrollment;
                  return (
                    <tr key={student.id} className="hover:bg-slate-50">
                      <td className="px-4 py-4"><button onClick={() => void openStudent(student)} className="text-left"><p className="font-semibold text-slate-900">{student.firstName} {student.lastName}</p><p className="text-xs text-slate-400">{student.email}</p></button></td>
                      <td className="px-4 py-4 font-medium text-slate-700">{student.profile?.admissionNumber || "—"}</td>
                      <td className="px-4 py-4 text-slate-600">{e?.program?.department?.name || "—"}</td>
                      <td className="px-4 py-4 text-slate-600">{e?.program?.name || "Not enrolled"}</td>
                      <td className="px-4 py-4 text-slate-600">{e?.academicYear?.name || "—"}</td>
                      <td className="px-4 py-4 text-slate-600">{e?.semester?.name || "—"}{e?.section?.name ? ` / ${e.section.name}` : ""}</td>
                      <td className="px-4 py-4 text-slate-600">{e?.rollNumber || "—"}</td>
                      <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(student.profile?.status || "INACTIVE")}`}>{student.profile?.status || "INACTIVE"}</span></td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => void openStudent(student)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-white">View</button>
                          {permissions.includes("students.update") && <button onClick={() => startEdit(student)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-white">Edit</button>}
                          {(permissions.includes("students.create") || permissions.includes("students.update")) && <EnrollmentRowAction student={student} onOpen={startEnrollment} />}
                          {permissions.includes("users.delete") && (
                            <>
                              <button onClick={() => void softDeleteStudent(student)} disabled={saving} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Archive</button>
                              <button onClick={() => void permanentlyDeleteStudent(student)} disabled={saving} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">Delete permanently</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>{totalStudents.toLocaleString("en-IN")} students · Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPage(value => Math.max(1, value - 1))} disabled={page <= 1 || loading} className="rounded-lg border border-slate-200 bg-white px-3 py-2 disabled:opacity-40">Previous</button>
              <button type="button" onClick={() => setPage(value => Math.min(totalPages, value + 1))} disabled={page >= totalPages || loading} className="rounded-lg border border-slate-200 bg-white px-3 py-2 disabled:opacity-40">Next</button>
            </div>
          </div>
        </>
      )}
    </div>
    {showForm&&<ModalPortal layer="base" className="bg-slate-950/50"><div className="my-2 flex h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-2xl sm:my-4 sm:h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-2rem)] sm:rounded-3xl"><div className="sticky top-0 z-10 flex items-center justify-between rounded-t-3xl border-b border-slate-200 bg-white px-6 py-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Student Master</p><h3 className="text-xl font-bold text-slate-950">{editing?"Edit Student":"Add Student"}</h3></div><button onClick={resetForm} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold">Close</button></div><form onSubmit={saveStudent} className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-5"><Section title="Account & admission" description="A new student creates the login account, master profile and first enrollment atomically."><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"><Field label="First name" required><input required value={form.firstName} onChange={e=>setField("firstName",e.target.value)} className={inputClass()}/></Field><Field label="Last name" required><input required value={form.lastName} onChange={e=>setField("lastName",e.target.value)} className={inputClass()}/></Field><Field label="Email" required><input required type="email" value={form.email} onChange={e=>setField("email",e.target.value)} className={inputClass()}/></Field><Field label="ID number / Login ID" required><input value={form.idNumber} onChange={e=>setField("idNumber",e.target.value)} className={inputClass()} required/></Field><Field label="Phone"><input value={form.phone} onChange={e=>setField("phone",e.target.value)} className={inputClass()}/></Field>{!editing&&<Field label="Temporary password" required><input required minLength={8} type="password" value={form.password} onChange={e=>setField("password",e.target.value)} className={inputClass()}/></Field>}<Field label="Admission number" required><input required value={form.admissionNumber} onChange={e=>setField("admissionNumber",e.target.value)} className={inputClass()}/></Field><Field label="Admission date"><input type="date" value={form.admissionDate} onChange={e=>setField("admissionDate",e.target.value)} className={inputClass()}/></Field><Field label="Student status"><select value={form.status} onChange={e=>setField("status",e.target.value)} className={inputClass()}>{statuses.map(x=><option key={x}>{x}</option>)}</select></Field></div></Section><Section title="Personal information"><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"><Field label="Date of birth"><input type="date" value={form.dateOfBirth} onChange={e=>setField("dateOfBirth",e.target.value)} className={inputClass()}/></Field><Field label="Gender"><select value={form.gender} onChange={e=>setField("gender",e.target.value)} className={inputClass()}><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option></select></Field><Field label="Blood group"><input value={form.bloodGroup} onChange={e=>setField("bloodGroup",e.target.value)} className={inputClass()}/></Field><Field label="Nationality"><input value={form.nationality} onChange={e=>setField("nationality",e.target.value)} className={inputClass()}/></Field></div></Section><Section title="Address"><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"><Field label="Address"><input value={form.address} onChange={e=>setField("address",e.target.value)} className={inputClass()}/></Field><Field label="City"><input value={form.city} onChange={e=>setField("city",e.target.value)} className={inputClass()}/></Field><Field label="State"><input value={form.state} onChange={e=>setField("state",e.target.value)} className={inputClass()}/></Field><Field label="Postal code"><input value={form.postalCode} onChange={e=>setField("postalCode",e.target.value)} className={inputClass()}/></Field></div></Section><Section title="Guardian & emergency contact"><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"><Field label="Guardian name"><input value={form.guardianName} onChange={e=>setField("guardianName",e.target.value)} className={inputClass()}/></Field><Field label="Guardian phone"><input value={form.guardianPhone} onChange={e=>setField("guardianPhone",e.target.value)} className={inputClass()}/></Field><Field label="Guardian email"><input type="email" value={form.guardianEmail} onChange={e=>setField("guardianEmail",e.target.value)} className={inputClass()}/></Field><Field label="Emergency contact name"><input value={form.emergencyContactName} onChange={e=>setField("emergencyContactName",e.target.value)} className={inputClass()}/></Field><Field label="Emergency contact phone"><input value={form.emergencyContactPhone} onChange={e=>setField("emergencyContactPhone",e.target.value)} className={inputClass()}/></Field></div></Section><Section title="Academic placement" description="Choose the academic hierarchy from human-readable records. The server validates every relationship and your authorization scope."><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"><Field label="Department" required><select required value={form.programId ? (programs.find(x=>x.id===form.programId)?.department?.id||"") : ""} onChange={e=>{setPrograms([]);setSemesters([]);setSections([]);setForm(p=>({...p,programId:"",semesterId:"",sectionId:""}));void loadPrograms(e.target.value)}} className={inputClass()} disabled={Boolean(departmentId)}><option value="">Select department</option>{departments.map(x=><option key={x.id} value={x.id}>{optionLabel(x)}</option>)}</select></Field><Field label="Program" required><select required value={form.programId} onChange={e=>{setSemesters([]);setSections([]);setForm(p=>({...p,programId:e.target.value,semesterId:"",sectionId:""}));void loadSemesters(e.target.value,form.academicYearId)}} className={inputClass()}><option value="">Select program</option>{filteredPrograms.map(x=><option key={x.id} value={x.id}>{optionLabel(x)}</option>)}</select></Field><Field label="Academic year" required><select required value={form.academicYearId} onChange={e=>{setSemesters([]);setSections([]);setForm(p=>({...p,academicYearId:e.target.value,semesterId:"",sectionId:""}));if(form.programId)void loadSemesters(form.programId,e.target.value)}} className={inputClass()}><option value="">Select year</option>{academicYears.map(x=><option key={x.id} value={x.id}>{optionLabel(x)}</option>)}</select></Field><Field label="Semester" required><select required value={form.semesterId} onChange={e=>{setSections([]);setForm(p=>({...p,semesterId:e.target.value,sectionId:""}));void loadSections(e.target.value)}} className={inputClass()}><option value="">Select semester</option>{filteredSemesters.map(x=><option key={x.id} value={x.id}>{optionLabel(x)}</option>)}</select></Field><Field label="Section"><select value={form.sectionId} onChange={e=>setField("sectionId",e.target.value)} className={inputClass()}><option value="">No section</option>{filteredSections.map(x=><option key={x.id} value={x.id}>{optionLabel(x)}</option>)}</select></Field><Field label="Roll number"><input value={form.rollNumber} onChange={e=>setField("rollNumber",e.target.value)} className={inputClass()}/></Field></div></Section><div className="flex justify-end gap-2 rounded-2xl border border-slate-200 bg-white p-4"><button type="button" onClick={resetForm} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">Cancel</button><button disabled={saving} type="submit" className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving?"Saving…":editing?"Save Student":"Create Student"}</button></div></form></div></ModalPortal>}

    {selected&&!showEnrollment&&(<DetailDrawer
      eyebrow="Student profile"
      title={`${selected.firstName} ${selected.lastName}`}
      subtitle={selected.profile?.admissionNumber ? `${selected.profile.admissionNumber} · ${selected.email}` : selected.email}
      onClose={()=>setSelected(null)}
      footer={
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={()=>setSelected(null)} className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">Close</button>{permissions.includes("students.update")?<button type="button" onClick={()=>{setSelected(null);startEdit(selected)}} className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">Edit Profile</button>:null}
          {selected.enrollmentState === "PROFILE_MISSING" ? <button type="button" onClick={()=>{setSelected(null);void startEdit(selected)}} disabled={saving} className="inline-flex min-h-10 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-black text-amber-800">Create Profile</button> : selected.enrollmentState === "ENROLLED" ? <span className="inline-flex min-h-10 items-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-black text-emerald-700">✓ Enrolled</span> : <button type="button" onClick={()=>void startEnrollment(selected)} disabled={saving} className="inline-flex min-h-10 items-center justify-center rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">{selected.enrollmentState === "INVALID" ? "Fix Enrollment" : "Manage Enrollment"}</button>}
        </div>
      }
    >
      <section className="space-y-1">
        <h3 className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-slate-400">Personal & contact</h3>
        <DetailField label="Phone" value={selected.phone||"—"} />
        <DetailField label="Date of birth" value={dateValue(selected.profile?.dateOfBirth)||"—"} />
        <DetailField label="Gender" value={selected.profile?.gender||"—"} />
        <DetailField label="Blood group" value={selected.profile?.bloodGroup||"—"} />
        <DetailField label="Nationality" value={selected.profile?.nationality||"—"} />
        <DetailField label="Address" value={selected.profile?.address||"—"} />
      </section>
      <section className="space-y-1 border-t border-slate-200 pt-4">
        <h3 className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-slate-400">Guardian</h3>
        <DetailField label="Name" value={selected.profile?.guardianName||"—"} />
        <DetailField label="Phone" value={selected.profile?.guardianPhone||"—"} />
        <DetailField label="Email" value={selected.profile?.guardianEmail||"—"} />
        <DetailField label="Emergency contact" value={`${selected.profile?.emergencyContactName||"—"} ${selected.profile?.emergencyContactPhone||""}`.trim()} />
      </section>
      <section className="border-t border-slate-200 pt-4">
        <h3 className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-slate-400">Enrollment history</h3>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-[0.14em] text-slate-400">
              <tr><th className="px-3 py-2.5">Academic year</th><th className="px-3 py-2.5">Program</th><th className="px-3 py-2.5">Semester</th><th className="px-3 py-2.5">Section</th><th className="px-3 py-2.5">Roll</th><th className="px-3 py-2.5">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(selected.enrollments||[]).map(e=><tr key={e.id}>
                <td className="px-3 py-2.5">{e.academicYear?.name||"—"}</td>
                <td className="px-3 py-2.5">{e.program?.name||"—"}</td>
                <td className="px-3 py-2.5">{e.semester?.name||"—"}</td>
                <td className="px-3 py-2.5">{e.section?.name||"—"}</td>
                <td className="px-3 py-2.5">{e.rollNumber||"—"}</td>
                <td className="px-3 py-2.5"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass(e.status)}`}>{e.status}</span></td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </section>
    </DetailDrawer>)}

    {selected&&showEnrollment&&(<DetailDrawer
      eyebrow="Academic enrollment"
      title={`${selected.firstName} ${selected.lastName}`}
      subtitle="Update the student's current academic placement"
      onClose={()=>setShowEnrollment(false)}
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={()=>setShowEnrollment(false)} className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50">Cancel</button>
          <button form="acadlyx-student-enrollment-form" disabled={saving} type="submit" className="inline-flex min-h-10 items-center justify-center rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-black text-white disabled:opacity-50">{saving?"Enrolling…":"Save Enrollment"}</button>
        </div>
      }
    >
      <form id="acadlyx-student-enrollment-form" onSubmit={saveEnrollment} className="space-y-4">
        <Field label="Academic year" required><select required value={enrollment.academicYearId} onChange={e=>{setSemesters([]);setSections([]);setEnrollment(p=>({...p,academicYearId:e.target.value,semesterId:"",sectionId:""}));if(enrollment.programId)void loadSemesters(enrollment.programId,e.target.value)}} className={inputClass()}><option value="">Select year</option>{academicYears.map(x=><option key={x.id} value={x.id}>{optionLabel(x)}</option>)}</select></Field>
        <Field label="Department" required><select required value={enrollment.programId ? (programs.find(x=>x.id===enrollment.programId)?.department?.id||"") : ""} onChange={e=>{setPrograms([]);setSemesters([]);setSections([]);setEnrollment(p=>({...p,programId:"",semesterId:"",sectionId:""}));void loadPrograms(e.target.value)}} className={inputClass()} disabled={Boolean(departmentId)}><option value="">Select department</option>{departments.map(x=><option key={x.id} value={x.id}>{optionLabel(x)}</option>)}</select></Field>
        <Field label="Program" required><select required value={enrollment.programId} onChange={e=>{setSemesters([]);setSections([]);setEnrollment(p=>({...p,programId:e.target.value,semesterId:"",sectionId:""}));void loadSemesters(e.target.value,enrollment.academicYearId)}} className={inputClass()}><option value="">Select program</option>{programs.map(x=><option key={x.id} value={x.id}>{optionLabel(x)}</option>)}</select></Field>
        <Field label="Semester" required><select required value={enrollment.semesterId} onChange={e=>{setSections([]);setEnrollment(p=>({...p,semesterId:e.target.value,sectionId:""}));void loadSections(e.target.value)}} className={inputClass()}><option value="">Select semester</option>{enrollmentSemesters.map(x=><option key={x.id} value={x.id}>{optionLabel(x)}</option>)}</select></Field>
        <Field label="Section"><select value={enrollment.sectionId} onChange={e=>setEnrollment(p=>({...p,sectionId:e.target.value}))} className={inputClass()}><option value="">No section</option>{enrollmentSections.map(x=><option key={x.id} value={x.id}>{optionLabel(x)}</option>)}</select></Field>
        <Field label="Roll number"><input value={enrollment.rollNumber} onChange={e=>setEnrollment(p=>({...p,rollNumber:e.target.value}))} className={inputClass()}/></Field>
        <Field label="Enrollment status"><select value={enrollment.status} onChange={e=>setEnrollment(p=>({...p,status:e.target.value}))} className={inputClass()}>{enrollmentStatuses.map(x=><option key={x}>{x}</option>)}</select></Field>
      </form>
    </DetailDrawer>)}
  </div>;
}

export default StudentManagement;
