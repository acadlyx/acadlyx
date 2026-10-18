"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import DataTransferActions from "@/components/dashboard/DataTransferActions";
import { DataType, DATA_TYPES } from "@/lib/dataTransferApi";
import { AuthRequiredError, getCurrentUser } from "@/lib/auth";

const help: Record<DataType, string> = {
  users: "idNumber, email, firstName, lastName, phone, password, role, active",
  students: "idNumber, email, firstName, lastName, phone, password, admissionNumber, rollNumber, programCode, academicYear, section, dateOfBirth, guardianName, guardianPhone, status",
  faculty: "idNumber, email, firstName, lastName, phone, password, active",
  campuses: "code, name, address, active",
  departments: "code, name, campusCode, active",
  programs: "code, name, departmentCode, level, durationYears, active",
  "academic-years": "name, startDate, endDate, isCurrent",
  semesters: "programCode, academicYear, number, name, startDate, endDate, active",
  sections: "programCode, academicYear, semesterNumber, name, capacity, active",
  courses: "code, name, departmentCode, credits, description, active",
  "course-offerings": "courseCode, programCode, academicYear, semesterNumber, section, facultyEmail, active",
  exams: "courseCode, section, title, examDate, maxMarks",
  marks: "email or rollNumber, courseCode, section, component, marksObtained, maxMarks",
  attendance: "email or rollNumber, courseCode, section, date, status",
  fees: "email or rollNumber, title, amount, dueDate, status",
  "fee-payments": "invoiceNumber, amount, reference, paidAt",
  "fee-structures": "name, feeHeadCode, amount, status, currency, academicYear, programCode, semesterNumber, dueDays, installmentNumber, notes",
  notices: "title, body, audience, departmentCode, publishedAt, expiresAt",
  timetable: "courseCode, section, dayOfWeek, startTime, endTime, room",
  "parent-links": "parentEmail, studentEmail, relationship",
};

const IMPORT_PERMISSION_BY_TYPE: Record<DataType, string> = {
  users: "users.create",
  students: "students.create",
  faculty: "users.create",
  campuses: "campuses.create",
  departments: "departments.create",
  programs: "programs.create",
  "academic-years": "academic-years.create",
  semesters: "semesters.create",
  sections: "sections.create",
  courses: "courses.create",
  "course-offerings": "course-offerings.create",
  exams: "exams.manage",
  marks: "marks.enter",
  attendance: "attendance.mark",
  fees: "fees.manage",
  "fee-payments": "fees.pay",
  "fee-structures": "fees.manage",
  notices: "notices.manage",
  timetable: "timetable.manage",
  "parent-links": "parent-links.manage",
};

export default function ImportsPage() {
  const [type, setType] = useState<DataType>("students");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    void getCurrentUser()
      .then((user) => setPermissions(user?.permissions ?? []))
      .catch((error) => {
        if (error instanceof AuthRequiredError) setAuthError("Your session has expired. Please sign in again.");
      });
  }, []);

  const availableTypes = useMemo(
    () => DATA_TYPES.filter((item) => permissions.includes(IMPORT_PERMISSION_BY_TYPE[item])),
    [permissions],
  );

  useEffect(() => {
    if (availableTypes.length > 0 && !availableTypes.includes(type)) setType(availableTypes[0]);
  }, [availableTypes, type]);

  return (
    <DashboardShell title="Data Import & Export" subtitle="Bulk ERP data operations" allowedRoles={["INSTITUTION_ADMIN", "REGISTRAR", "HOD", "FACULTY", "ACCOUNTS", "EXAMINATION", "HR"]}>
      <div className="mx-auto max-w-6xl space-y-6">
        {authError ? <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{authError}</section> : null}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">No database access required</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">Excel / CSV Data Center</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Use human/business identifiers such as codes, names, academic-year labels, admission numbers and emails. Database UUIDs are resolved internally by ACADLYX.</p>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-5 md:grid-cols-[260px_1fr]">
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Module</label>
              <select value={type} onChange={(e) => setType(e.target.value as DataType)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm">
                {availableTypes.map((item) => <option key={item} value={item}>{item.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>)}
              </select>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Expected columns</p>
              <p className="mt-2 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">{help[type]}</p>
            </div>
          </div>
          <div className="mt-5 border-t border-slate-100 pt-5">
            {availableTypes.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No importable data types are assigned to this workspace.</p> : <DataTransferActions type={type} />}
          </div>
        </section>
        <section className="grid gap-4 md:grid-cols-3">
          {[
            ["1", "Prepare", "Use business identifiers such as department codes, program codes, course codes, academic years, semester numbers, admission numbers and emails."],
            ["2", "Import", "Choose Import, review the row count, then confirm. Relationship identifiers are resolved against the institution's authorized records."],
            ["3", "Export", "Use XLSX for office work or CSV for integrations and backups. Exports remain institution-scoped."],
          ].map(([number, title, text]) => <div key={number} className="rounded-2xl border border-slate-200 bg-white p-5"><span className="text-xs font-bold text-slate-400">{number}</span><h2 className="mt-2 font-semibold">{title}</h2><p className="mt-1 text-sm leading-6 text-slate-500">{text}</p></div>)}
        </section>
      </div>
    </DashboardShell>
  );
}
