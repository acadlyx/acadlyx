"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { AuthRequiredError, authedFetch } from "@/lib/auth";

type Lookup = {
  id: string;
  name?: string;
  code?: string;
  number?: number;
  programId?: string;
  academicYearId?: string;
  semesterId?: string;
  capacity?: number | null;
  isActive?: boolean;
  isCurrent?: boolean;
};

type Student = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  isActive: boolean;
  profile?: {
    admissionNumber: string;
    dateOfBirth?: string | null;
    gender?: string | null;
    bloodGroup?: string | null;
    nationality?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    guardianName?: string | null;
    guardianPhone?: string | null;
    guardianEmail?: string | null;
    emergencyContactName?: string | null;
    emergencyContactPhone?: string | null;
    admissionDate?: string | null;
    status: string;
  } | null;
  enrollments?: Enrollment[];
  currentEnrollment?: Enrollment | null;
};

type Enrollment = {
  id: string;
  academicYearId: string;
  programId: string;
  semesterId?: string | null;
  sectionId?: string | null;
  rollNumber?: string | null;
  status: string;
  enrolledAt?: string;
  program?: Lookup;
  academicYear?: Lookup;
  semester?: Lookup;
  section?: Lookup;
};

type ListResponse<T> = {
  success?: boolean;
  data?: T[];
  meta?: {
    total?: number;
    page?: number;
    pageSize?: number;
    totalPages?: number;
  };
};

type Props = {
  onChanged?: () => void | Promise<void>;
};

const statuses = [
  "ACTIVE",
  "INACTIVE",
  "GRADUATED",
  "WITHDRAWN",
  "TRANSFERRED",
];

const enrollmentStatuses = [
  "ACTIVE",
  "COMPLETED",
  "DROPPED",
  "TRANSFERRED",
];

function inputClass() {
  return "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100 disabled:bg-slate-50";
}

function labelClass() {
  return "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500";
}

function dateValue(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value).slice(0, 10) : d.toISOString().slice(0, 10);
}

function optionLabel(item: Lookup) {
  if (item.code && item.name) return `${item.code} — ${item.name}`;
  if (item.number !== undefined && item.name) return `Semester ${item.number} — ${item.name}`;
  return item.name || item.code || item.id;
}

function statusClass(status: string) {
  if (status === "ACTIVE") return "bg-emerald-50 text-emerald-700";
  if (status === "GRADUATED" || status === "COMPLETED") return "bg-blue-50 text-blue-700";
  if (status === "WITHDRAWN" || status === "DROPPED" || status === "TRANSFERRED") return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label>
      <span className={labelClass()}>
        {label}{required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-4">
        <h3 className="font-semibold text-slate-950">{title}</h3>
        {description && <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function StudentManagement({ onChanged }: Props) {
  const [students, setStudents] = useState<Student[]>([]);
  const [programs, setPrograms] = useState<Lookup[]>([]);
  const [academicYears, setAcademicYears] = useState<Lookup[]>([]);
  const [semesters, setSemesters] = useState<Lookup[]>([]);
  const [sections, setSections] = useState<Lookup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [programFilter, setProgramFilter] = useState("");
  const [semesterFilter, setSemesterFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [selected, setSelected] = useState<Student | null>(null);
  const [showEnrollment, setShowEnrollment] = useState(false);

  const emptyForm = {
    email: "",
    firstName: "",
    lastName: "",
    phone: "",
    password: "",
    admissionNumber: "",
    dateOfBirth: "",
    gender: "",
    bloodGroup: "",
    nationality: "Indian",
    address: "",
    city: "",
    state: "",
    postalCode: "",
    guardianName: "",
    guardianPhone: "",
    guardianEmail: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    admissionDate: "",
    status: "ACTIVE",
    programId: "",
    academicYearId: "",
    semesterId: "",
    sectionId: "",
    rollNumber: "",
  };

  const [form, setForm] = useState(emptyForm);
  const [enrollment, setEnrollment] = useState({
    academicYearId: "",
    programId: "",
    semesterId: "",
    sectionId: "",
    rollNumber: "",
    status: "ACTIVE",
  });

  async function loadLookups() {
    const [p, y, s, sec] = await Promise.all([
      authedFetch<ListResponse<Lookup>>("/programs?page=1&pageSize=100"),
      authedFetch<ListResponse<Lookup>>("/academic-years?page=1&pageSize=100"),
      authedFetch<ListResponse<Lookup>>("/semesters?page=1&pageSize=500"),
      authedFetch<ListResponse<Lookup>>("/sections?page=1&pageSize=500"),
    ]);
    setPrograms(p.data || []);
    setAcademicYears(y.data || []);
    setSemesters(s.data || []);
    setSections(sec.data || []);
  }

  async function loadStudents() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "100",
      });
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter) params.set("status", statusFilter);
      if (programFilter) params.set("programId", programFilter);
      if (semesterFilter) params.set("semesterId", semesterFilter);
      if (sectionFilter) params.set("sectionId", sectionFilter);

      const response = await authedFetch<ListResponse<Student>>(`/students?${params.toString()}`);
      setStudents(response.data || []);
    } catch (err) {
      if (err instanceof AuthRequiredError) throw err;
      setError(err instanceof Error ? err.message : "Unable to load students.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        await Promise.all([loadLookups(), loadStudents()]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load student management.");
      }
    })();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadStudents();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search, statusFilter, programFilter, semesterFilter, sectionFilter]);

  const filteredSemesters = useMemo(
    () =>
      semesters.filter(
        (item) =>
          (!form.programId || item.programId === form.programId) &&
          (!form.academicYearId || item.academicYearId === form.academicYearId)
      ),
    [semesters, form.programId, form.academicYearId]
  );

  const filteredSections = useMemo(
    () => sections.filter((item) => !form.semesterId || item.semesterId === form.semesterId),
    [sections, form.semesterId]
  );

  const enrollmentSemesters = useMemo(
    () =>
      semesters.filter(
        (item) =>
          (!enrollment.programId || item.programId === enrollment.programId) &&
          (!enrollment.academicYearId || item.academicYearId === enrollment.academicYearId)
      ),
    [semesters, enrollment.programId, enrollment.academicYearId]
  );

  const enrollmentSections = useMemo(
    () => sections.filter((item) => !enrollment.semesterId || item.semesterId === enrollment.semesterId),
    [sections, enrollment.semesterId]
  );

  function setField(key: keyof typeof form, value: string) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditing(null);
    setShowForm(false);
  }

  function startCreate() {
    setSuccess("");
    setError("");
    setEditing(null);
    setForm({
      ...emptyForm,
      academicYearId: academicYears.find((x) => x.isCurrent)?.id || "",
    });
    setShowForm(true);
  }

  function startEdit(student: Student) {
    const p = student.profile;
    const e = student.currentEnrollment;
    setSuccess("");
    setError("");
    setEditing(student);
    setForm({
      email: student.email,
      firstName: student.firstName,
      lastName: student.lastName,
      phone: student.phone || "",
      password: "",
      admissionNumber: p?.admissionNumber || "",
      dateOfBirth: dateValue(p?.dateOfBirth),
      gender: p?.gender || "",
      bloodGroup: p?.bloodGroup || "",
      nationality: p?.nationality || "",
      address: p?.address || "",
      city: p?.city || "",
      state: p?.state || "",
      postalCode: p?.postalCode || "",
      guardianName: p?.guardianName || "",
      guardianPhone: p?.guardianPhone || "",
      guardianEmail: p?.guardianEmail || "",
      emergencyContactName: p?.emergencyContactName || "",
      emergencyContactPhone: p?.emergencyContactPhone || "",
      admissionDate: dateValue(p?.admissionDate),
      status: p?.status || "ACTIVE",
      programId: e?.programId || "",
      academicYearId: e?.academicYearId || "",
      semesterId: e?.semesterId || "",
      sectionId: e?.sectionId || "",
      rollNumber: e?.rollNumber || "",
    });
    setShowForm(true);
  }

  async function saveStudent(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      if (!editing) {
        const payload: Record<string, unknown> = {
          ...form,
          password: form.password,
          sectionId: form.sectionId || "",
        };
        delete payload.password;
        payload.password = form.password;

        await authedFetch("/students", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setSuccess("Student account, master profile and first enrollment created successfully.");
      } else {
        const payload: Record<string, unknown> = {
          email: form.email,
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.phone,
          admissionNumber: form.admissionNumber,
          dateOfBirth: form.dateOfBirth,
          gender: form.gender,
          bloodGroup: form.bloodGroup,
          nationality: form.nationality,
          address: form.address,
          city: form.city,
          state: form.state,
          postalCode: form.postalCode,
          guardianName: form.guardianName,
          guardianPhone: form.guardianPhone,
          guardianEmail: form.guardianEmail,
          emergencyContactName: form.emergencyContactName,
          emergencyContactPhone: form.emergencyContactPhone,
          admissionDate: form.admissionDate,
          status: form.status,
        };

        await authedFetch(`/students/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });

        if (
          form.programId &&
          form.academicYearId &&
          form.semesterId
        ) {
          await authedFetch(`/students/${editing.id}/enrollments`, {
            method: "POST",
            body: JSON.stringify({
              programId: form.programId,
              academicYearId: form.academicYearId,
              semesterId: form.semesterId,
              sectionId: form.sectionId || "",
              rollNumber: form.rollNumber,
              status: "ACTIVE",
            }),
          });
        }

        setSuccess("Student profile and academic enrollment updated successfully.");
      }

      resetForm();
      await loadStudents();
      await onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save student.");
    } finally {
      setSaving(false);
    }
  }

  async function openStudent(student: Student) {
    setError("");
    try {
      const response = await authedFetch<{ success?: boolean; data?: Student }>(
        `/students/${student.id}`
      );
      setSelected(response.data || student);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to open student.");
    }
  }

  function startEnrollment(student: Student) {
    const e = student.currentEnrollment;
    setSelected(student);
    setEnrollment({
      academicYearId: academicYears.find((x) => x.isCurrent)?.id || e?.academicYearId || "",
      programId: e?.programId || "",
      semesterId: e?.semesterId || "",
      sectionId: e?.sectionId || "",
      rollNumber: e?.rollNumber || "",
      status: "ACTIVE",
    });
    setShowEnrollment(true);
  }

  async function saveEnrollment(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await authedFetch(`/students/${selected.id}/enrollments`, {
        method: "POST",
        body: JSON.stringify({
          ...enrollment,
          sectionId: enrollment.sectionId || "",
        }),
      });
      const response = await authedFetch<{ success?: boolean; data?: Student }>(
        `/students/${selected.id}`
      );
      setSelected(response.data || selected);
      setShowEnrollment(false);
      setSuccess("Academic enrollment updated successfully.");
      await loadStudents();
      await onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save enrollment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex items-start justify-between rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={() => setError("")} className="font-semibold">Dismiss</button>
        </div>
      )}
      {success && (
        <div className="flex items-start justify-between rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <span>{success}</span>
          <button onClick={() => setSuccess("")} className="font-semibold">Dismiss</button>
        </div>
      )}

      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Student Master</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-950">Students</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
            Manage student identities, admission records, guardians and academic enrollment from one tenant-safe workspace.
          </p>
        </div>
        <button
          onClick={startCreate}
          className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          + Add Student
        </button>
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-2 xl:grid-cols-5">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email or admission no."
          className={inputClass()}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputClass()}>
          <option value="">All statuses</option>
          {statuses.map((x) => <option key={x} value={x}>{x.replace("_", " ")}</option>)}
        </select>
        <select value={programFilter} onChange={(e) => setProgramFilter(e.target.value)} className={inputClass()}>
          <option value="">All programs</option>
          {programs.map((x) => <option key={x.id} value={x.id}>{optionLabel(x)}</option>)}
        </select>
        <select value={semesterFilter} onChange={(e) => setSemesterFilter(e.target.value)} className={inputClass()}>
          <option value="">All semesters</option>
          {semesters.map((x) => <option key={x.id} value={x.id}>{optionLabel(x)}</option>)}
        </select>
        <select value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)} className={inputClass()}>
          <option value="">All sections</option>
          {sections.map((x) => <option key={x.id} value={x.id}>{optionLabel(x)}</option>)}
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">Loading students…</div>
        ) : students.length === 0 ? (
          <div className="p-10 text-center">
            <p className="font-semibold text-slate-900">No students found</p>
            <p className="mt-1 text-sm text-slate-500">Create a student or adjust your filters.</p>
            <button onClick={startCreate} className="mt-4 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Add Student</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Admission</th>
                  <th className="px-4 py-3">Program</th>
                  <th className="px-4 py-3">Semester / Section</th>
                  <th className="px-4 py-3">Roll No.</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((student) => {
                  const e = student.currentEnrollment;
                  return (
                    <tr key={student.id} className="hover:bg-slate-50">
                      <td className="px-4 py-4">
                        <button onClick={() => void openStudent(student)} className="text-left">
                          <p className="font-semibold text-slate-900">{student.firstName} {student.lastName}</p>
                          <p className="text-xs text-slate-400">{student.email}</p>
                        </button>
                      </td>
                      <td className="px-4 py-4 font-medium text-slate-700">{student.profile?.admissionNumber || "—"}</td>
                      <td className="px-4 py-4 text-slate-600">{e?.program?.name || "Not enrolled"}</td>
                      <td className="px-4 py-4 text-slate-600">
                        {e?.semester?.name || "—"}{e?.section?.name ? ` / ${e.section.name}` : ""}
                      </td>
                      <td className="px-4 py-4 text-slate-600">{e?.rollNumber || "—"}</td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(student.profile?.status || "INACTIVE")}`}>
                          {student.profile?.status || "INACTIVE"}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => void openStudent(student)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-white">View</button>
                          <button onClick={() => startEdit(student)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-white">Edit</button>
                          <button onClick={() => startEnrollment(student)} className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800">Enroll</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-4">
          <div className="mx-auto my-8 max-w-5xl rounded-3xl bg-slate-50 shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-3xl border-b border-slate-200 bg-white px-6 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Student Master</p>
                <h3 className="text-xl font-bold text-slate-950">{editing ? "Edit Student" : "Add Student"}</h3>
              </div>
              <button onClick={resetForm} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold">Close</button>
            </div>

            <form onSubmit={saveStudent} className="space-y-4 p-5">
              <Section title="Account & admission" description="A new student creates the login account, master profile and first enrollment atomically.">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <Field label="First name" required><input required value={form.firstName} onChange={(e) => setField("firstName", e.target.value)} className={inputClass()} /></Field>
                  <Field label="Last name" required><input required value={form.lastName} onChange={(e) => setField("lastName", e.target.value)} className={inputClass()} /></Field>
                  <Field label="Email" required><input required type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} className={inputClass()} /></Field>
                  <Field label="Phone"><input value={form.phone} onChange={(e) => setField("phone", e.target.value)} className={inputClass()} /></Field>
                  {!editing && <Field label="Temporary password" required><input required minLength={8} type="password" value={form.password} onChange={(e) => setField("password", e.target.value)} className={inputClass()} /></Field>}
                  <Field label="Admission number" required><input required value={form.admissionNumber} onChange={(e) => setField("admissionNumber", e.target.value)} className={inputClass()} /></Field>
                  <Field label="Admission date"><input type="date" value={form.admissionDate} onChange={(e) => setField("admissionDate", e.target.value)} className={inputClass()} /></Field>
                  <Field label="Student status"><select value={form.status} onChange={(e) => setField("status", e.target.value)} className={inputClass()}>{statuses.map((x) => <option key={x}>{x}</option>)}</select></Field>
                </div>
              </Section>

              <Section title="Personal information">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Field label="Date of birth"><input type="date" value={form.dateOfBirth} onChange={(e) => setField("dateOfBirth", e.target.value)} className={inputClass()} /></Field>
                  <Field label="Gender"><select value={form.gender} onChange={(e) => setField("gender", e.target.value)} className={inputClass()}><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option></select></Field>
                  <Field label="Blood group"><input value={form.bloodGroup} onChange={(e) => setField("bloodGroup", e.target.value)} className={inputClass()} /></Field>
                  <Field label="Nationality"><input value={form.nationality} onChange={(e) => setField("nationality", e.target.value)} className={inputClass()} /></Field>
                </div>
              </Section>

              <Section title="Address">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Field label="Address"><input value={form.address} onChange={(e) => setField("address", e.target.value)} className={inputClass()} /></Field>
                  <Field label="City"><input value={form.city} onChange={(e) => setField("city", e.target.value)} className={inputClass()} /></Field>
                  <Field label="State"><input value={form.state} onChange={(e) => setField("state", e.target.value)} className={inputClass()} /></Field>
                  <Field label="Postal code"><input value={form.postalCode} onChange={(e) => setField("postalCode", e.target.value)} className={inputClass()} /></Field>
                </div>
              </Section>

              <Section title="Guardian & emergency contact">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <Field label="Guardian name"><input value={form.guardianName} onChange={(e) => setField("guardianName", e.target.value)} className={inputClass()} /></Field>
                  <Field label="Guardian phone"><input value={form.guardianPhone} onChange={(e) => setField("guardianPhone", e.target.value)} className={inputClass()} /></Field>
                  <Field label="Guardian email"><input type="email" value={form.guardianEmail} onChange={(e) => setField("guardianEmail", e.target.value)} className={inputClass()} /></Field>
                  <Field label="Emergency contact name"><input value={form.emergencyContactName} onChange={(e) => setField("emergencyContactName", e.target.value)} className={inputClass()} /></Field>
                  <Field label="Emergency contact phone"><input value={form.emergencyContactPhone} onChange={(e) => setField("emergencyContactPhone", e.target.value)} className={inputClass()} /></Field>
                </div>
              </Section>

              <Section title="Academic placement" description="The API verifies that program, academic year, semester and section belong to the same institution and hierarchy.">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                  <Field label="Program" required><select required value={form.programId} onChange={(e) => setForm((p) => ({ ...p, programId: e.target.value, semesterId: "", sectionId: "" }))} className={inputClass()}><option value="">Select program</option>{programs.map((x) => <option key={x.id} value={x.id}>{optionLabel(x)}</option>)}</select></Field>
                  <Field label="Academic year" required><select required value={form.academicYearId} onChange={(e) => setForm((p) => ({ ...p, academicYearId: e.target.value, semesterId: "", sectionId: "" }))} className={inputClass()}><option value="">Select year</option>{academicYears.map((x) => <option key={x.id} value={x.id}>{optionLabel(x)}</option>)}</select></Field>
                  <Field label="Semester" required><select required value={form.semesterId} onChange={(e) => setForm((p) => ({ ...p, semesterId: e.target.value, sectionId: "" }))} className={inputClass()}><option value="">Select semester</option>{filteredSemesters.map((x) => <option key={x.id} value={x.id}>{optionLabel(x)}</option>)}</select></Field>
                  <Field label="Section"><select value={form.sectionId} onChange={(e) => setField("sectionId", e.target.value)} className={inputClass()}><option value="">No section</option>{filteredSections.map((x) => <option key={x.id} value={x.id}>{optionLabel(x)}</option>)}</select></Field>
                  <Field label="Roll number"><input value={form.rollNumber} onChange={(e) => setField("rollNumber", e.target.value)} className={inputClass()} /></Field>
                </div>
              </Section>

              <div className="flex justify-end gap-2 rounded-2xl border border-slate-200 bg-white p-4">
                <button type="button" onClick={resetForm} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">Cancel</button>
                <button disabled={saving} type="submit" className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                  {saving ? "Saving…" : editing ? "Save Student" : "Create Student"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selected && !showEnrollment && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-4">
          <div className="mx-auto my-8 max-w-4xl rounded-3xl bg-slate-50 shadow-2xl">
            <div className="flex items-center justify-between rounded-t-3xl border-b border-slate-200 bg-white px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Student profile</p>
                <h3 className="text-2xl font-bold text-slate-950">{selected.firstName} {selected.lastName}</h3>
                <p className="text-sm text-slate-500">{selected.profile?.admissionNumber || "No admission number"} · {selected.email}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => startEnrollment(selected)} className="rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white">Enrollment</button>
                <button onClick={() => setSelected(null)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold">Close</button>
              </div>
            </div>
            <div className="grid gap-4 p-5 lg:grid-cols-2">
              <Section title="Personal & contact">
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <dt className="text-slate-400">Phone</dt><dd className="text-slate-700">{selected.phone || "—"}</dd>
                  <dt className="text-slate-400">DOB</dt><dd className="text-slate-700">{dateValue(selected.profile?.dateOfBirth) || "—"}</dd>
                  <dt className="text-slate-400">Gender</dt><dd className="text-slate-700">{selected.profile?.gender || "—"}</dd>
                  <dt className="text-slate-400">Blood group</dt><dd className="text-slate-700">{selected.profile?.bloodGroup || "—"}</dd>
                  <dt className="text-slate-400">Nationality</dt><dd className="text-slate-700">{selected.profile?.nationality || "—"}</dd>
                  <dt className="text-slate-400">Address</dt><dd className="col-span-1 text-slate-700">{selected.profile?.address || "—"}</dd>
                </dl>
              </Section>
              <Section title="Guardian">
                <dl className="space-y-3 text-sm">
                  <div><dt className="text-slate-400">Name</dt><dd className="text-slate-700">{selected.profile?.guardianName || "—"}</dd></div>
                  <div><dt className="text-slate-400">Phone</dt><dd className="text-slate-700">{selected.profile?.guardianPhone || "—"}</dd></div>
                  <div><dt className="text-slate-400">Email</dt><dd className="text-slate-700">{selected.profile?.guardianEmail || "—"}</dd></div>
                  <div><dt className="text-slate-400">Emergency</dt><dd className="text-slate-700">{selected.profile?.emergencyContactName || "—"} {selected.profile?.emergencyContactPhone || ""}</dd></div>
                </dl>
              </Section>
              <div className="lg:col-span-2">
                <Section title="Enrollment history" description="Historical academic-year records remain available.">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-xs uppercase tracking-wide text-slate-400"><tr><th className="py-2 pr-4">Academic year</th><th className="py-2 pr-4">Program</th><th className="py-2 pr-4">Semester</th><th className="py-2 pr-4">Section</th><th className="py-2 pr-4">Roll</th><th className="py-2">Status</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {(selected.enrollments || []).map((e) => (
                          <tr key={e.id}>
                            <td className="py-3 pr-4">{e.academicYear?.name || "—"}</td>
                            <td className="py-3 pr-4">{e.program?.name || "—"}</td>
                            <td className="py-3 pr-4">{e.semester?.name || "—"}</td>
                            <td className="py-3 pr-4">{e.section?.name || "—"}</td>
                            <td className="py-3 pr-4">{e.rollNumber || "—"}</td>
                            <td className="py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass(e.status)}`}>{e.status}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Section>
              </div>
            </div>
          </div>
        </div>
      )}

      {selected && showEnrollment && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-950/50 p-4">
          <div className="mx-auto my-16 max-w-2xl rounded-3xl bg-slate-50 shadow-2xl">
            <div className="flex items-center justify-between rounded-t-3xl border-b border-slate-200 bg-white px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Academic enrollment</p>
                <h3 className="text-xl font-bold text-slate-950">{selected.firstName} {selected.lastName}</h3>
              </div>
              <button onClick={() => setShowEnrollment(false)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold">Close</button>
            </div>
            <form onSubmit={saveEnrollment} className="space-y-4 p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Academic year" required><select required value={enrollment.academicYearId} onChange={(e) => setEnrollment((p) => ({ ...p, academicYearId: e.target.value, semesterId: "", sectionId: "" }))} className={inputClass()}><option value="">Select year</option>{academicYears.map((x) => <option key={x.id} value={x.id}>{optionLabel(x)}</option>)}</select></Field>
                <Field label="Program" required><select required value={enrollment.programId} onChange={(e) => setEnrollment((p) => ({ ...p, programId: e.target.value, semesterId: "", sectionId: "" }))} className={inputClass()}><option value="">Select program</option>{programs.map((x) => <option key={x.id} value={x.id}>{optionLabel(x)}</option>)}</select></Field>
                <Field label="Semester" required><select required value={enrollment.semesterId} onChange={(e) => setEnrollment((p) => ({ ...p, semesterId: e.target.value, sectionId: "" }))} className={inputClass()}><option value="">Select semester</option>{enrollmentSemesters.map((x) => <option key={x.id} value={x.id}>{optionLabel(x)}</option>)}</select></Field>
                <Field label="Section"><select value={enrollment.sectionId} onChange={(e) => setEnrollment((p) => ({ ...p, sectionId: e.target.value }))} className={inputClass()}><option value="">No section</option>{enrollmentSections.map((x) => <option key={x.id} value={x.id}>{optionLabel(x)}</option>)}</select></Field>
                <Field label="Roll number"><input value={enrollment.rollNumber} onChange={(e) => setEnrollment((p) => ({ ...p, rollNumber: e.target.value }))} className={inputClass()} /></Field>
                <Field label="Enrollment status"><select value={enrollment.status} onChange={(e) => setEnrollment((p) => ({ ...p, status: e.target.value }))} className={inputClass()}>{enrollmentStatuses.map((x) => <option key={x}>{x}</option>)}</select></Field>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowEnrollment(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold">Cancel</button>
                <button disabled={saving} type="submit" className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Save Enrollment"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default StudentManagement;
