"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { AuthRequiredError, isAuthenticated } from "@/lib/auth";
import { createAssignment, listAssignments } from "@/lib/academicsApi";
import { getMyFacultyCourseOfferings } from "@/lib/facultyApi";
import { AssignmentData } from "@/types/academics";
import { FacultyCourseOffering } from "@/types/faculty";

type ViewState = "loading" | "ready" | "error";

export default function FacultyAssignmentsPage() {
  const router = useRouter();
  const [state, setState] = useState<ViewState>("loading");
  const [assignments, setAssignments] = useState<AssignmentData[]>([]);
  const [offerings, setOfferings] = useState<FacultyCourseOffering[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [courseOfferingId, setCourseOfferingId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [maxMarks, setMaxMarks] = useState(50);
  const [publishNow, setPublishNow] = useState(true);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const [a, o] = await Promise.all([
      listAssignments({}),
      getMyFacultyCourseOfferings(),
    ]);
    setAssignments(a);
    setOfferings(o);
    if (o.length > 0 && !courseOfferingId) setCourseOfferingId(o[0].id);
  }

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    load()
      .then(() => setState("ready"))
      .catch((err: Error) => {
        if (err instanceof AuthRequiredError) {
          router.replace("/login");
          return;
        }
        setErrorMessage(err.message);
        setState("error");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!courseOfferingId || !title || !dueDate) {
      setFormError("Course, title, and due date are required.");
      return;
    }
    setSubmitting(true);
    try {
      await createAssignment({
        courseOfferingId,
        title,
        description: description || undefined,
        dueDate: new Date(dueDate).toISOString(),
        maxMarks,
        status: publishNow ? "PUBLISHED" : "DRAFT",
      });
      setTitle("");
      setDescription("");
      setDueDate("");
      setShowForm(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create assignment");
    } finally {
      setSubmitting(false);
    }
  }

  if (state === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-400">Loading assignments…</p>
      </main>
    );
  }

  if (state === "error") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-4 text-center">
        <p className="text-sm font-medium text-red-600">Couldn&apos;t load assignments</p>
        <p className="text-sm text-slate-500">{errorMessage}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-16">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <Link href="/faculty" className="text-xs font-medium text-slate-500 hover:text-slate-800">
          ← Back to dashboard
        </Link>

        <div className="mt-3 mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-slate-900">Assignments</h1>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="rounded-lg bg-acadlyx-primary px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            {showForm ? "Cancel" : "New Assignment"}
          </button>
        </div>

        {showForm && (
          <DashboardCard title="Create Assignment" className="mb-6">
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Course & Section</label>
                <select
                  value={courseOfferingId}
                  onChange={(e) => setCourseOfferingId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {offerings.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.course.code} — Section {o.section.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Max Marks</label>
                  <input
                    type="number"
                    value={maxMarks}
                    onChange={(e) => setMaxMarks(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={publishNow}
                  onChange={(e) => setPublishNow(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Publish immediately (students can see it right away)
              </label>
              {formError && <p className="text-sm text-red-600">{formError}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-acadlyx-primary px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? "Creating…" : "Create"}
              </button>
            </form>
          </DashboardCard>
        )}

        <DashboardCard>
          {assignments.length === 0 ? (
            <p className="text-sm text-slate-400">No assignments yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {assignments.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <Link
                      href={`/faculty/assignments/${a.id}`}
                      className="text-sm font-medium text-slate-800 hover:text-acadlyx-primary hover:underline"
                    >
                      {a.courseOffering.course.code} — {a.title}
                    </Link>
                    <p className="text-xs text-slate-400">
                      Section {a.courseOffering.section.name} · Due{" "}
                      {new Date(a.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </p>
                  </div>
                  <StatusBadge tone={a.status === "PUBLISHED" ? "success" : "neutral"}>
                    {a.status}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </DashboardCard>
      </div>
    </main>
  );
}
