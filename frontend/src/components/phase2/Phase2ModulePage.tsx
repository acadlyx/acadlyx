"use client";

import { useMemo, useState } from "react";

export type Phase2Module =
  | "admissions"
  | "enrollment"
  | "promotion"
  | "library"
  | "faculty"
  | "hr"
  | "leave"
  | "reports"
  | "users"
  | "settings";

type ModuleConfig = {
  title: string;
  description: string;
  action: string;
  columns: string[];
  rows: string[][];
  metrics: [string, string, string][];
  fields: string[];
};

const configs: Record<Phase2Module, ModuleConfig> = {
  admissions: {
    title: "Admission Management",
    description:
      "Manage admission enquiries, applications, document verification, and selection workflows.",
    action: "New admission",
    columns: ["Applicant", "Program", "Applied on", "Status"],
    rows: [
      ["Aarav Sharma", "B.Tech CSE", "20 Sep 2026", "Under review"],
      ["Ananya Gupta", "BBA", "19 Sep 2026", "Documents pending"],
      ["Kabir Singh", "BCA", "18 Sep 2026", "Selected"],
    ],
    metrics: [
      ["Total applicants", "248", "Current admission cycle"],
      ["Under review", "64", "Awaiting verification"],
      ["Selected", "112", "Current cycle"],
    ],
    fields: ["Applicant name", "Program", "Application date", "Remarks"],
  },
  enrollment: {
    title: "Enrollment Management",
    description:
      "Track student enrollment, registration status, and academic onboarding.",
    action: "New enrollment",
    columns: ["Student", "Enrollment ID", "Program", "Status"],
    rows: [
      ["Aarav Sharma", "ENR-2026-001", "B.Tech CSE", "Active"],
      ["Ishita Verma", "ENR-2026-002", "BBA", "Pending"],
      ["Rohan Singh", "ENR-2026-003", "BCA", "Verified"],
    ],
    metrics: [
      ["Total enrollments", "1,248", "Institution-wide"],
      ["Active students", "1,102", "Current records"],
      ["Pending verification", "36", "Requires action"],
    ],
    fields: ["Student name", "Enrollment ID", "Program", "Admission year"],
  },
  promotion: {
    title: "Student Promotion & Transfer",
    description:
      "Process semester promotions, academic transfers, and student movement records.",
    action: "Create request",
    columns: ["Student", "Current level", "Requested action", "Status"],
    rows: [
      ["Aarav Sharma", "Semester 4", "Promote to Semester 5", "Approved"],
      ["Ishita Verma", "Semester 2", "Department transfer", "Pending"],
      ["Rohan Singh", "Semester 6", "Program transfer", "Under review"],
    ],
    metrics: [
      ["Promotion requests", "186", "Current cycle"],
      ["Approved", "142", "Completed"],
      ["Pending", "29", "Awaiting review"],
    ],
    fields: ["Student name", "Current program", "Requested action", "Remarks"],
  },
  library: {
    title: "Library Management",
    description:
      "Manage books, issue records, returns, reservations, and library inventory.",
    action: "Add book",
    columns: ["Book title", "Author", "Available copies", "Status"],
    rows: [
      ["Database Systems", "R. Elmasri", "8", "Available"],
      ["Operating System Concepts", "Silberschatz", "3", "Available"],
      ["Clean Code", "Robert C. Martin", "0", "Issued"],
    ],
    metrics: [
      ["Total books", "8,420", "Library inventory"],
      ["Issued books", "1,248", "Current circulation"],
      ["Overdue returns", "36", "Requires follow-up"],
    ],
    fields: ["Book title", "Author", "ISBN", "Number of copies"],
  },
  faculty: {
    title: "Faculty Management",
    description:
      "Maintain faculty profiles, departments, teaching assignments, and workload information.",
    action: "Add faculty",
    columns: ["Faculty member", "Department", "Designation", "Status"],
    rows: [
      ["Dr. Neha Kapoor", "Computer Science", "Professor", "Active"],
      ["Dr. Amit Verma", "Management", "Associate Professor", "Active"],
      ["Ms. Priya Sharma", "Commerce", "Assistant Professor", "On leave"],
    ],
    metrics: [
      ["Faculty members", "126", "Institution-wide"],
      ["Active faculty", "119", "Current staff"],
      ["On leave", "7", "Current period"],
    ],
    fields: ["Faculty name", "Department", "Designation", "Email address"],
  },
  hr: {
    title: "HR Management",
    description:
      "Manage employee records, departments, joining details, and employment information.",
    action: "Add employee",
    columns: ["Employee", "Department", "Joining date", "Status"],
    rows: [
      ["Neha Kapoor", "Academics", "12 Jul 2020", "Active"],
      ["Amit Verma", "Administration", "08 Jan 2022", "Active"],
      ["Priya Sharma", "Finance", "18 Mar 2021", "On leave"],
    ],
    metrics: [
      ["Total employees", "184", "Institution-wide"],
      ["Active employees", "176", "Current records"],
      ["Open positions", "8", "Recruitment required"],
    ],
    fields: ["Employee name", "Department", "Joining date", "Employment type"],
  },
  leave: {
    title: "Leave Management",
    description:
      "Review, approve, and track student, faculty, and employee leave requests.",
    action: "New leave request",
    columns: ["Applicant", "Leave type", "Duration", "Status"],
    rows: [
      ["Priya Sharma", "Casual leave", "2 days", "Pending"],
      ["Amit Verma", "Medical leave", "4 days", "Approved"],
      ["Rohan Singh", "Student leave", "1 day", "Under review"],
    ],
    metrics: [
      ["Total requests", "42", "Current month"],
      ["Pending requests", "11", "Awaiting approval"],
      ["Approved", "27", "Current month"],
    ],
    fields: ["Applicant name", "Leave type", "Start date", "Reason"],
  },
  reports: {
    title: "Reports Center",
    description:
      "Access institutional reports covering students, academics, finance, and operations.",
    action: "Generate report",
    columns: ["Report name", "Category", "Generated on", "Status"],
    rows: [
      ["Student enrollment report", "Academic", "20 Sep 2026", "Ready"],
      ["Fee collection report", "Finance", "19 Sep 2026", "Ready"],
      ["Faculty workload report", "HR", "18 Sep 2026", "Processing"],
    ],
    metrics: [
      ["Available reports", "36", "Configured reports"],
      ["Generated this month", "128", "Report activity"],
      ["Scheduled reports", "12", "Upcoming"],
    ],
    fields: ["Report name", "Report category", "Date range", "Format"],
  },
  users: {
    title: "User & Role Management",
    description:
      "Manage accounts, roles, permissions, and access to institutional modules.",
    action: "Add user",
    columns: ["User", "Email", "Role", "Status"],
    rows: [
      ["Aarav Sharma", "aarav@example.com", "Student", "Active"],
      ["Neha Kapoor", "neha@example.com", "Faculty", "Active"],
      ["Admin User", "admin@example.com", "Administrator", "Active"],
    ],
    metrics: [
      ["Total users", "2,486", "Registered accounts"],
      ["Active users", "2,421", "Current accounts"],
      ["Pending invitations", "18", "Awaiting acceptance"],
    ],
    fields: ["Full name", "Email address", "Role", "Account status"],
  },
  settings: {
    title: "Institution Settings",
    description:
      "Configure institution identity, academic structure, contact details, and platform preferences.",
    action: "Add setting",
    columns: ["Setting", "Category", "Current value", "Status"],
    rows: [
      ["Institution name", "General", "ACADLYX Institute", "Configured"],
      ["Academic session", "Academic", "2026–2027", "Configured"],
      ["Primary timezone", "Regional", "Asia/Kolkata", "Configured"],
    ],
    metrics: [
      ["Configured settings", "42", "Platform configuration"],
      ["Pending setup", "4", "Requires attention"],
      ["Last updated", "Today", "Configuration activity"],
    ],
    fields: ["Setting name", "Category", "Value", "Description"],
  },
};

export default function Phase2ModulePage({
  module,
}: {
  module: Phase2Module;
}) {
  const config = configs[module];
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");

  const filteredRows = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) return config.rows;

    return config.rows.filter((row) =>
      row.join(" ").toLowerCase().includes(value),
    );
  }, [config.rows, search]);

  function saveDraft() {
    setMessage("Draft saved locally for this frontend preview.");
    setShowForm(false);
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="flex flex-col gap-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">
            Institutional Operations · Phase 2
          </p>

          <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            {config.title}
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
            {config.description}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowForm((value) => !value);
            setMessage("");
          }}
          className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
        >
          {showForm ? "Close" : config.action}
        </button>
      </section>

      {message && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {message}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        {config.metrics.map(([label, value, caption]) => (
          <article
            key={label}
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm font-semibold text-slate-500">{label}</p>
            <p className="mt-3 text-3xl font-black tracking-tight text-slate-950">
              {value}
            </p>
            <p className="mt-1 text-xs text-slate-400">{caption}</p>
          </article>
        ))}
      </section>

      {showForm && (
        <section className="rounded-3xl border border-indigo-200 bg-indigo-50 p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">
            Frontend workflow
          </p>

          <h2 className="mt-2 text-2xl font-black text-slate-950">
            {config.action}
          </h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {config.fields.map((field) => (
              <label key={field} className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  {field}
                </span>

                {field.toLowerCase().includes("description") ||
                field.toLowerCase().includes("reason") ? (
                  <textarea
                    rows={4}
                    placeholder={field}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                ) : (
                  <input
                    type="text"
                    placeholder={field}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                )}
              </label>
            ))}
          </div>

          <button
            type="button"
            onClick={saveDraft}
            className="mt-6 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800"
          >
            Save draft
          </button>
        </section>
      )}

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-950">Records</h2>
            <p className="mt-1 text-sm text-slate-500">
              Sample interface data · API integration pending
            </p>
          </div>

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search records..."
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 sm:w-72"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                {config.columns.map((column) => (
                  <th key={column} className="whitespace-nowrap px-5 py-4 font-bold">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredRows.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-slate-50">
                  {row.map((cell, cellIndex) => (
                    <td
                      key={`${rowIndex}-${cellIndex}`}
                      className="whitespace-nowrap px-5 py-4 font-medium text-slate-700"
                    >
                      {cellIndex === row.length - 1 ? (
                        <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                          {cell}
                        </span>
                      ) : (
                        cell
                      )}
                    </td>
                  ))}
                </tr>
              ))}

              {filteredRows.length === 0 && (
                <tr>
                  <td
                    colSpan={config.columns.length}
                    className="px-5 py-14 text-center text-sm text-slate-500"
                  >
                    No matching records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
