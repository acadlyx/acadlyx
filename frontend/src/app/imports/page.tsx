"use client";

import { useState } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import DataTransferActions from "@/components/dashboard/DataTransferActions";
import { DataType, DATA_TYPES } from "@/lib/dataTransferApi";

const help: Record<DataType, string> = {
  users: "email, firstName, lastName, phone, password, role, active",
  students: "email, firstName, lastName, phone, password, admissionNumber, rollNumber, programCode, academicYear, section, dateOfBirth, guardianName, guardianPhone, status",
  faculty: "email, firstName, lastName, phone, password, active",
  campuses: "code, name, address, active",
  departments: "code, name, campusId, active",
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
  "fee-payments": "invoiceId, amount, reference, paidAt",
  "fee-structures": "name, feeHeadCode, amount, status, currency, academicYear, programCode, semesterId, dueDays, installmentNumber, notes",
  notices: "title, body, audience, departmentId, publishedAt, expiresAt",
  timetable: "courseCode, section, dayOfWeek, startTime, endTime, room",
  "parent-links": "parentEmail, studentEmail, relationship",
};

export default function ImportsPage() {
  const [type, setType] = useState<DataType>("students");

  return (
    <DashboardShell title="Data Import & Export" subtitle="Bulk ERP data operations" allowedRoles={["SUPER_ADMIN", "INSTITUTION_ADMIN", "DIRECTOR", "MANAGEMENT", "STAFF"]}>
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">No database access required</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">Excel / CSV Data Center</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Administrators can bulk import and export operational data directly from ACADLYX. Imports are previewed before they are committed and remain institution-scoped.</p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-5 md:grid-cols-[260px_1fr]">
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Module</label>
              <select value={type} onChange={(e) => setType(e.target.value as DataType)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm">
                {DATA_TYPES.map((item) => <option key={item} value={item}>{item.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>)}
              </select>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Expected columns</p>
              <p className="mt-2 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">{help[type]}</p>
            </div>
          </div>
          <div className="mt-5 border-t border-slate-100 pt-5">
            <DataTransferActions type={type} />
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            ["1", "Prepare", "Use the expected column names and keep identifiers such as email, course code and admission number consistent."],
            ["2", "Import", "Choose Import, review the row count, then confirm. Failed validation stops the transaction instead of partially corrupting data."],
            ["3", "Export", "Use XLSX for office work or CSV for integrations and backups. Exports are generated from live application data."],
          ].map(([number, title, text]) => <div key={number} className="rounded-2xl border border-slate-200 bg-white p-5"><span className="text-xs font-bold text-slate-400">{number}</span><h2 className="mt-2 font-semibold">{title}</h2><p className="mt-1 text-sm leading-6 text-slate-500">{text}</p></div>)}
        </section>
      </div>
    </DashboardShell>
  );
}
