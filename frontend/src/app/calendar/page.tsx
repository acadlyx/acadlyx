"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import {
  AuthRequiredError,
  AuthUser,
  getCurrentUser,
  isAuthenticated,
} from "@/lib/auth";
import {
  AUDIENCES,
  AcademicYearOption,
  Audience,
  CalendarEvent,
  EVENT_TYPES,
  EventType,
  createEvent,
  deleteEvent,
  listAcademicYearOptions,
  listEvents,
  updateEvent,
} from "@/lib/calendarApi";

type ViewState = "loading" | "ready" | "error";

const TYPE_STYLES: Record<EventType, string> = {
  HOLIDAY: "bg-emerald-100 text-emerald-700",
  EXAM: "bg-red-100 text-red-700",
  EVENT: "bg-indigo-100 text-indigo-700",
  DEADLINE: "bg-amber-100 text-amber-700",
  ACADEMIC: "bg-slate-100 text-slate-700",
};

const emptyForm = {
  title: "",
  description: "",
  eventType: "EVENT" as EventType,
  startDate: "",
  endDate: "",
  audience: "ALL" as Audience,
  academicYearId: "",
};

const day = (value: string) => new Date(value).toLocaleDateString();

export default function CalendarPage() {
  const router = useRouter();
  const [state, setState] = useState<ViewState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [actionError, setActionError] = useState("");

  const [user, setUser] = useState<AuthUser | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [years, setYears] = useState<AcademicYearOption[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [search, setSearch] = useState("");
  const [eventType, setEventType] = useState<EventType | "">("");
  const [audience, setAudience] = useState<Audience | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canManage = user?.permissions.includes("calendar.manage") ?? false;

  const load = useCallback(async () => {
    try {
      const me = await getCurrentUser();
      setUser(me);

      const [list, yearOptions] = await Promise.all([
        listEvents({
          page,
          search: search || undefined,
          eventType: eventType || undefined,
          audience: audience || undefined,
          from: from || undefined,
          to: to || undefined,
        }),
        me.permissions.includes("calendar.manage")
          ? listAcademicYearOptions().catch(() => [])
          : Promise.resolve([]),
      ]);

      setEvents(list.items);
      setTotalPages(list.meta.totalPages);
      setYears(yearOptions);
      setState("ready");
    } catch (err) {
      if (err instanceof AuthRequiredError) {
        router.replace("/login");
        return;
      }
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to load the calendar"
      );
      setState("error");
    }
  }, [page, search, eventType, audience, from, to, router]);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    load();
  }, [load, router]);

  function startEdit(event: CalendarEvent) {
    setEditingId(event.id);
    setShowForm(true);
    setFormError("");
    setForm({
      title: event.title,
      description: event.description ?? "",
      eventType: event.eventType,
      startDate: event.startDate.slice(0, 10),
      endDate: event.endDate.slice(0, 10),
      audience: event.audience,
      academicYearId: event.academicYearId ?? "",
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!form.title || !form.startDate || !form.endDate) {
      setFormError("Title, start date and end date are required.");
      return;
    }
    if (form.endDate < form.startDate) {
      setFormError("The end date must not be before the start date.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        title: form.title,
        description: form.description || undefined,
        eventType: form.eventType,
        startDate: form.startDate,
        endDate: form.endDate,
        audience: form.audience,
        academicYearId: form.academicYearId || undefined,
      };
      if (editingId) {
        await updateEvent(editingId, payload);
      } else {
        await createEvent(payload);
      }
      setForm(emptyForm);
      setEditingId(null);
      setShowForm(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save event");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    setActionError("");
    try {
      await deleteEvent(id);
      await load();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to delete event"
      );
    }
  }

  if (state === "loading") {
    return (
      <DashboardShell title="Academic Calendar" subtitle="Institutional dates">
        <div className="p-8 text-sm text-slate-500">Loading calendar…</div>
      </DashboardShell>
    );
  }

  if (state === "error") {
    return (
      <DashboardShell title="Academic Calendar" subtitle="Institutional dates">
        <div className="m-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {errorMessage}
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title="Academic Calendar"
      subtitle="Holidays, examinations, deadlines and events"
    >
      <main className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
        <section className="flex flex-wrap items-end gap-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <input
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder="Search events"
            className="min-w-[200px] flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <select
            value={eventType}
            onChange={(e) => {
              setPage(1);
              setEventType(e.target.value as EventType | "");
            }}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">All types</option>
            {EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          {canManage && (
            <select
              value={audience}
              onChange={(e) => {
                setPage(1);
                setAudience(e.target.value as Audience | "");
              }}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">All audiences</option>
              {AUDIENCES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          )}
          <label className="text-sm text-slate-600">
            <span className="mb-1 block font-medium">From</span>
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setPage(1);
                setFrom(e.target.value);
              }}
              className="rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="text-sm text-slate-600">
            <span className="mb-1 block font-medium">To</span>
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setPage(1);
                setTo(e.target.value);
              }}
              className="rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
          {canManage && (
            <button
              type="button"
              onClick={() => {
                setShowForm((v) => !v);
                setEditingId(null);
                setForm(emptyForm);
                setFormError("");
              }}
              className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white"
            >
              {showForm ? "Cancel" : "Add event"}
            </button>
          )}
        </section>

        {showForm && canManage && (
          <form
            onSubmit={handleSubmit}
            className="grid gap-3 rounded-3xl border border-indigo-200 bg-indigo-50 p-6 sm:grid-cols-2"
          >
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-slate-600">Title</span>
              <input
                value={form.title}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, title: e.target.value }))
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-600">
                Start date
              </span>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, startDate: e.target.value }))
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-600">
                End date
              </span>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, endDate: e.target.value }))
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-600">Type</span>
              <select
                value={form.eventType}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    eventType: e.target.value as EventType,
                  }))
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
              >
                {EVENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-600">
                Audience
              </span>
              <select
                value={form.audience}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    audience: e.target.value as Audience,
                  }))
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
              >
                {AUDIENCES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-600">
                Academic year
              </span>
              <select
                value={form.academicYearId}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    academicYearId: e.target.value,
                  }))
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
              >
                <option value="">Not year-specific</option>
                {years.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-slate-600">
                Description
              </span>
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, description: e.target.value }))
                }
                rows={3}
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
            <div className="flex items-center gap-3 sm:col-span-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {submitting
                  ? "Saving…"
                  : editingId
                    ? "Update event"
                    : "Create event"}
              </button>
              {formError && (
                <span className="text-sm text-red-600">{formError}</span>
              )}
            </div>
          </form>
        )}

        {actionError && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {actionError}
          </p>
        )}

        <section className="space-y-3">
          {events.map((event) => (
            <article
              key={event.id}
              className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">
                    {event.title}
                  </h3>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${TYPE_STYLES[event.eventType]}`}
                  >
                    {event.eventType}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                    {event.audience}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {day(event.startDate)}
                  {event.endDate !== event.startDate
                    ? ` → ${day(event.endDate)}`
                    : ""}
                  {event.academicYear ? ` · ${event.academicYear.name}` : ""}
                </p>
                {event.description && (
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                    {event.description}
                  </p>
                )}
              </div>
              {canManage && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(event)}
                    className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(event.id)}
                    className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white"
                  >
                    Delete
                  </button>
                </div>
              )}
            </article>
          ))}
          {events.length === 0 && (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              No calendar entries for this filter.
            </p>
          )}
        </section>

        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </main>
    </DashboardShell>
  );
}
