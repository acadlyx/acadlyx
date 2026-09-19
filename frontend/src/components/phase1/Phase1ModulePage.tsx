"use client";

import { useMemo, useState } from "react";

type ModuleKey =
  | "calendar"
  | "notices"
  | "applications"
  | "forms"
  | "profile"
  | "fees"
  | "receipts"
  | "timetable"
  | "examinations"
  | "results"
  | "notifications"
  | "registration";

type ModuleConfig = {
  title: string;
  description: string;
  action: string;
  columns: string[];
  rows: string[][];
  metrics: [string, string, string][];
  formTitle: string;
  formFields: string[];
};

const moduleConfig: Record<ModuleKey, ModuleConfig> = {
  calendar: {
    title: "Academic Calendar",
    description:
      "Plan academic dates, holidays, examinations, and institutional events.",
    action: "Add event",
    formTitle: "Create academic event",
    formFields: ["Event title", "Event date", "Event category", "Description"],
    columns: ["Event", "Date", "Category", "Status"],
    rows: [
      ["Orientation Day", "24 Sep 2026", "Academic", "Published"],
      ["Mid-term examinations", "12 Oct 2026", "Examination", "Planned"],
      ["Diwali holiday", "09 Nov 2026", "Holiday", "Published"],
    ],
    metrics: [
      ["Upcoming events", "12", "Across this term"],
      ["Academic days", "78", "Configured"],
      ["Pending drafts", "3", "Need review"],
    ],
  },
  notices: {
    title: "Notice Board",
    description:
      "Publish targeted announcements for students, faculty, parents, and staff.",
    action: "Create notice",
    formTitle: "Create notice",
    formFields: ["Notice title", "Audience", "Publish date", "Notice content"],
    columns: ["Notice", "Audience", "Published", "Status"],
    rows: [
      [
        "Semester registration window",
        "Students",
        "20 Sep 2026",
        "Published",
      ],
      ["Faculty meeting reminder", "Faculty", "19 Sep 2026", "Published"],
      ["Campus maintenance update", "Everyone", "—", "Draft"],
    ],
    metrics: [
      ["Published notices", "24", "This month"],
      ["Drafts", "4", "Awaiting publishing"],
      ["Scheduled", "6", "Upcoming"],
    ],
  },
  applications: {
    title: "Student Applications",
    description:
      "Review student requests, supporting documents, and approval progress.",
    action: "New application",
    formTitle: "Create application",
    formFields: ["Application type", "Applicant name", "Submission date", "Remarks"],
    columns: ["Application", "Applicant", "Submitted", "Status"],
    rows: [
      ["Bonafide certificate", "Aarav Sharma", "20 Sep 2026", "Pending"],
      ["Leave request", "Ishita Verma", "19 Sep 2026", "Approved"],
      ["Fee concession", "Rohan Singh", "18 Sep 2026", "Under review"],
    ],
    metrics: [
      ["Total applications", "48", "Current cycle"],
      ["Pending review", "11", "Require action"],
      ["Approved", "29", "Completed"],
    ],
  },
  forms: {
    title: "Forms & Documents",
    description:
      "Centralize institutional forms, submissions, and document checklists.",
    action: "Create form",
    formTitle: "Create form",
    formFields: ["Form title", "Form type", "Submission deadline", "Description"],
    columns: ["Form", "Type", "Submissions", "Status"],
    rows: [
      ["Scholarship application", "Online form", "126", "Active"],
      ["Student information update", "Online form", "84", "Active"],
      ["Transfer certificate request", "Downloadable", "—", "Published"],
    ],
    metrics: [
      ["Active forms", "18", "Available to users"],
      ["Submissions", "342", "This month"],
      ["Needs review", "17", "Pending verification"],
    ],
  },
  profile: {
    title: "Student Profile",
    description:
      "View a unified academic, personal, attendance, and finance profile.",
    action: "Edit profile",
    formTitle: "Edit student profile",
    formFields: ["Student name", "Email address", "Phone number", "Department"],
    columns: ["Record", "Value", "Last updated", "Status"],
    rows: [
      ["Program", "B.Tech Computer Science", "01 Aug 2026", "Verified"],
      ["Semester", "Semester 5", "01 Aug 2026", "Active"],
      ["Academic standing", "Good standing", "20 Sep 2026", "Current"],
    ],
    metrics: [
      ["Attendance", "86%", "Overall"],
      ["CGPA", "8.42", "Current"],
      ["Pending documents", "2", "Action needed"],
    ],
  },
  fees: {
    title: "Student Fees",
    description:
      "Track fee obligations, installments, concessions, and payment history.",
    action: "View payment options",
    formTitle: "Create fee record",
    formFields: ["Fee category", "Amount", "Due date", "Remarks"],
    columns: ["Fee item", "Due date", "Amount", "Status"],
    rows: [
      ["Semester tuition fee", "30 Sep 2026", "₹48,000", "Pending"],
      ["Library fee", "30 Sep 2026", "₹1,500", "Paid"],
      ["Examination fee", "15 Oct 2026", "₹2,000", "Upcoming"],
    ],
    metrics: [
      ["Total payable", "₹50,000", "Current term"],
      ["Paid", "₹1,500", "Recorded"],
      ["Outstanding", "₹48,500", "Requires attention"],
    ],
  },
  receipts: {
    title: "Fee Payment & Receipts",
    description:
      "Review payment records and prepare receipts for future payment integration.",
    action: "Record payment",
    formTitle: "Record payment",
    formFields: ["Student name", "Payment amount", "Payment mode", "Transaction ID"],
    columns: ["Receipt", "Date", "Amount", "Mode"],
    rows: [
      ["REC-2026-0098", "20 Sep 2026", "₹1,500", "Online"],
      ["REC-2026-0091", "12 Sep 2026", "₹25,000", "Bank transfer"],
      ["REC-2026-0077", "02 Sep 2026", "₹10,000", "Cash"],
    ],
    metrics: [
      ["Total collected", "₹36,500", "Displayed mock data"],
      ["Receipts", "3", "Available"],
      ["Reconciliation", "Pending", "Backend required"],
    ],
  },
  timetable: {
    title: "Timetable",
    description:
      "View weekly classes, rooms, faculty assignments, and schedule conflicts.",
    action: "Add class",
    formTitle: "Add timetable entry",
    formFields: ["Course name", "Day", "Time", "Room"],
    columns: ["Day", "Time", "Course", "Room"],
    rows: [
      ["Monday", "09:00–10:00", "Data Structures", "B-204"],
      ["Tuesday", "11:00–12:00", "Operating Systems", "Lab-2"],
      ["Wednesday", "14:00–15:00", "Database Systems", "A-101"],
    ],
    metrics: [
      ["Weekly classes", "24", "Assigned"],
      ["Free periods", "8", "Available"],
      ["Conflicts", "0", "Current view"],
    ],
  },
  examinations: {
    title: "Examination Management",
    description:
      "Coordinate examination schedules, registrations, seating, and result publication.",
    action: "Create examination",
    formTitle: "Create examination",
    formFields: ["Examination name", "Start date", "End date", "Description"],
    columns: ["Examination", "Date", "Subjects", "Status"],
    rows: [
      ["Mid-term examination", "12 Oct 2026", "6", "Scheduled"],
      ["Practical assessment", "19 Oct 2026", "3", "Draft"],
      ["End-semester examination", "07 Dec 2026", "8", "Planned"],
    ],
    metrics: [
      ["Upcoming exams", "3", "Academic calendar"],
      ["Registrations", "428", "Mock count"],
      ["Draft schedules", "1", "Needs review"],
    ],
  },
  results: {
    title: "Results & Gradebook",
    description:
      "Review marks, grades, academic performance, and result publication status.",
    action: "Enter marks",
    formTitle: "Enter course marks",
    formFields: ["Course name", "Student name", "Marks", "Grade"],
    columns: ["Course", "Credits", "Grade", "Status"],
    rows: [
      ["Data Structures", "4", "A", "Published"],
      ["Operating Systems", "4", "B+", "Published"],
      ["Database Systems", "3", "A-", "Awaiting approval"],
    ],
    metrics: [
      ["Current SGPA", "8.42", "Displayed mock data"],
      ["Published courses", "5", "This semester"],
      ["Pending approval", "1", "Faculty action"],
    ],
  },
  notifications: {
    title: "Notifications Center",
    description:
      "Keep users informed about deadlines, approvals, payments, and academic updates.",
    action: "Create notification",
    formTitle: "Create notification",
    formFields: ["Notification title", "Audience", "Schedule", "Message"],
    columns: ["Notification", "Audience", "Sent", "Status"],
    rows: [
      ["Fee payment reminder", "Students", "20 Sep 2026", "Delivered"],
      ["Application status updated", "Aarav Sharma", "20 Sep 2026", "Read"],
      ["New timetable published", "Semester 5", "19 Sep 2026", "Unread"],
    ],
    metrics: [
      ["Unread", "7", "Requires attention"],
      ["Delivered", "128", "This month"],
      ["Scheduled", "9", "Upcoming"],
    ],
  },
  registration: {
    title: "Course Registration",
    description:
      "Select courses, electives, and semester registrations before deadlines.",
    action: "Register course",
    formTitle: "Register course",
    formFields: ["Course name", "Course type", "Credits", "Semester"],
    columns: ["Course", "Type", "Credits", "Registration"],
    rows: [
      ["Data Structures", "Core", "4", "Registered"],
      ["Cloud Computing", "Elective", "3", "Available"],
      ["Professional Ethics", "Core", "2", "Registered"],
    ],
    metrics: [
      ["Registered credits", "18", "Current semester"],
      ["Available electives", "4", "Choose carefully"],
      ["Deadline", "30 Sep", "Registration window"],
    ],
  },
};

export default function Phase1ModulePage({
  module,
}: {
  module: ModuleKey;
}) {
  const config = moduleConfig[module];

  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState("");

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return config.rows;
    }

    return config.rows.filter((row) =>
      row.join(" ").toLowerCase().includes(normalizedQuery),
    );
  }, [config.rows, query]);

  function handleSaveDraft() {
    setNotice("Draft saved locally for this frontend preview.");
    setShowForm(false);
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <section className="flex flex-col gap-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-sky-600">
            Core ERP · Phase 1
          </p>

          <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            {config.title}
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
            {config.description}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowForm((current) => !current);
            setNotice("");
          }}
          className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
        >
          {showForm ? "Close" : config.action}
        </button>
      </section>

      {notice && (
        <div
          role="status"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"
        >
          {notice}
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
        <section className="rounded-3xl border border-sky-200 bg-sky-50 p-6 sm:p-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-600">
              Frontend workflow
            </p>

            <h2 className="mt-2 text-2xl font-black text-slate-950">
              {config.formTitle}
            </h2>

            <p className="mt-2 text-sm text-slate-600">
              This form currently previews the interface. Backend persistence
              will be connected in the integration phase.
            </p>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {config.formFields.map((field) => (
              <label key={field} className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  {field}
                </span>

                {field.toLowerCase().includes("description") ||
                field.toLowerCase().includes("content") ||
                field.toLowerCase().includes("message") ||
                field.toLowerCase().includes("remarks") ? (
                  <textarea
                    rows={4}
                    placeholder={field}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                  />
                ) : (
                  <input
                    type="text"
                    placeholder={field}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                  />
                )}
              </label>
            ))}
          </div>

          <button
            type="button"
            onClick={handleSaveDraft}
            className="mt-6 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
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

          <label className="block">
            <span className="sr-only">Search records</span>

            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search records..."
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100 sm:w-72"
            />
          </label>
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
                <tr
                  key={`${module}-${rowIndex}`}
                  className="transition hover:bg-slate-50"
                >
                  {row.map((cell, cellIndex) => (
                    <td
                      key={`${module}-${rowIndex}-${cellIndex}`}
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
