"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { getManagedStudent, updateManagedStudent, ManagedStudent } from "@/lib/studentApi";

type Editable = {
  email: string; idNumber: string; firstName: string; lastName: string; phone: string;
  admissionNumber: string; dateOfBirth: string; gender: string; bloodGroup: string;
  nationality: string; address: string; city: string; state: string; postalCode: string;
  guardianName: string; guardianPhone: string; guardianEmail: string; admissionDate: string;
  status: ManagedStudent["profile"]["status"];
};

const labels: Record<keyof Editable, string> = {
  email: "Login email", idNumber: "ID number", firstName: "First name", lastName: "Last name",
  phone: "Phone", admissionNumber: "Admission number", dateOfBirth: "Date of birth",
  gender: "Gender", bloodGroup: "Blood group", nationality: "Nationality", address: "Address",
  city: "City", state: "State", postalCode: "Postal code", guardianName: "Guardian name",
  guardianPhone: "Guardian phone", guardianEmail: "Guardian email", admissionDate: "Admission date",
  status: "Status",
};

function emptyStudent(student: ManagedStudent): Editable {
  const p = student.profile;
  return {
    email: student.email, idNumber: student.idNumber || "", firstName: student.firstName, lastName: student.lastName,
    phone: student.phone || "", admissionNumber: p?.admissionNumber || "", dateOfBirth: p?.dateOfBirth?.slice(0, 10) || "",
    gender: p?.gender || "", bloodGroup: p?.bloodGroup || "", nationality: p?.nationality || "",
    address: p?.address || "", city: p?.city || "", state: p?.state || "", postalCode: p?.postalCode || "",
    guardianName: p?.guardianName || "", guardianPhone: p?.guardianPhone || "", guardianEmail: p?.guardianEmail || "",
    admissionDate: p?.admissionDate?.slice(0, 10) || "", status: p?.status || "ACTIVE",
  };
}

function missingFields(student: ManagedStudent, form: Editable) {
  const result: string[] = [];
  if (!form.email || form.email.includes("@invalid.acadlyx.local")) result.push("email");
  if (!form.idNumber || form.idNumber.startsWith("IMPORT-")) result.push("idNumber");
  if (!form.firstName || form.firstName === "Imported") result.push("firstName");
  if (!form.lastName || form.lastName === "Student") result.push("lastName");
  if (!form.phone) result.push("phone");
  if (!form.admissionNumber || form.admissionNumber.startsWith("IMPORT-")) result.push("admissionNumber");
  if (!form.dateOfBirth) result.push("dateOfBirth");
  if (!form.gender) result.push("gender");
  if (!form.guardianName) result.push("guardianName");
  if (!form.guardianPhone) result.push("guardianPhone");
  if (!student.currentEnrollment) result.push("enrollment");
  return result;
}

export default function CompleteImportedStudentsPage() {
  const params = useSearchParams();
  const ids = useMemo(() => (params.get("ids") || "").split(",").map((id) => id.trim()).filter(Boolean), [params]);
  const [students, setStudents] = useState<Array<{ student: ManagedStudent; form: Editable; saving: boolean; message: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void Promise.all(ids.map((id) => getManagedStudent(id)))
      .then((items) => {
        if (!active) return;
        setStudents(items.map((student) => ({ student, form: emptyStudent(student), saving: false, message: "" })));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [ids]);

  async function save(index: number) {
    const item = students[index];
    if (!item) return;
    const form = item.form;
    setStudents((current) => current.map((entry, i) => i === index ? { ...entry, saving: true, message: "" } : entry));
    try {
      const updated = await updateManagedStudent(item.student.id, {
        email: form.email && !form.email.includes("@invalid.acadlyx.local") ? form.email : undefined,
        idNumber: form.idNumber && !form.idNumber.startsWith("IMPORT-") ? form.idNumber : undefined,
        firstName: form.firstName !== "Imported" ? form.firstName : undefined,
        lastName: form.lastName !== "Student" ? form.lastName : undefined,
        phone: form.phone, admissionNumber: form.admissionNumber && !form.admissionNumber.startsWith("IMPORT-") ? form.admissionNumber : undefined,
        dateOfBirth: form.dateOfBirth, gender: form.gender, bloodGroup: form.bloodGroup, nationality: form.nationality,
        address: form.address, city: form.city, state: form.state, postalCode: form.postalCode,
        guardianName: form.guardianName, guardianPhone: form.guardianPhone, guardianEmail: form.guardianEmail,
        admissionDate: form.admissionDate, status: form.status,
      });
      setStudents((current) => current.map((entry, i) => i === index ? { ...entry, student: updated, form: emptyStudent(updated), saving: false, message: "Saved. You can continue completing the remaining fields." } : entry));
    } catch (error) {
      setStudents((current) => current.map((entry, i) => i === index ? { ...entry, saving: false, message: error instanceof Error ? error.message : "Could not save." } : entry));
    }
  }

  function update(index: number, key: keyof Editable, value: string) {
    setStudents((current) => current.map((entry, i) => i === index ? { ...entry, form: { ...entry.form, [key]: value }, message: "" } : entry));
  }

  return (
    <DashboardShell title="Complete Imported Students" subtitle="Imported records can be used now and completed later">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Import successful</p>
          <h1 className="mt-2 text-2xl font-black text-slate-950">Complete missing student information</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Missing columns did not block the import. Fill what you have now, save it, or use Upload Anyway / Finish Later and complete these students from their normal profiles.
          </p>
        </section>

        {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Loading imported students…</div> : null}

        {!loading && students.length === 0 ? (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
            <h2 className="font-bold text-emerald-900">Import completed</h2>
            <p className="mt-1 text-sm text-emerald-800">There are no incomplete imported student records to complete.</p>
          </section>
        ) : null}

        {students.map((item, index) => {
          const missing = missingFields(item.student, item.form);
          return (
            <section key={item.student.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-400">Imported row</p>
                  <h2 className="mt-1 text-lg font-black text-slate-950">{item.form.firstName} {item.form.lastName}</h2>
                  <p className="mt-1 text-xs text-slate-500">Student ID: {item.student.id}</p>
                </div>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">{missing.length} item(s) still incomplete</span>
              </div>

              {missing.length > 0 ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                  Missing: {missing.map((key) => labels[key as keyof Editable] || key).join(", ")}
                </div>
              ) : null}

              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {(Object.keys(labels) as Array<keyof Editable>).map((key) => (
                  <label key={key} className={key === "address" ? "sm:col-span-2 lg:col-span-3" : ""}>
                    <span className="text-xs font-bold text-slate-600">{labels[key]}</span>
                    {key === "status" ? (
                      <select value={item.form[key]} onChange={(e) => update(index, key, e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                        {["ACTIVE", "INACTIVE", "GRADUATED", "WITHDRAWN", "TRANSFERRED"].map((value) => <option key={value}>{value}</option>)}
                      </select>
                    ) : (
                      <input type={key.toLowerCase().includes("date") ? "date" : key.toLowerCase().includes("email") ? "email" : "text"} value={item.form[key]} onChange={(e) => update(index, key, e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
                    )}
                  </label>
                ))}
              </div>

              {!item.student.currentEnrollment ? (
                <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                  Academic placement is incomplete. The student is imported successfully; use <strong>Manage Enrollment</strong> from the Student Profile when the program, academic year, semester and section are available.
                </div>
              ) : null}

              {item.message ? <p className="mt-4 text-sm text-slate-600">{item.message}</p> : null}

              <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => { window.location.href = "/imports"; }} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700">Upload Anyway / Finish Later</button>
                <button type="button" disabled={item.saving} onClick={() => void save(index)} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{item.saving ? "Saving…" : "Save Details"}</button>
              </div>
            </section>
          );
        })}
      </div>
    </DashboardShell>
  );
}
