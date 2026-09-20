import { authedFetch } from "./auth";
import { buildQuery, Envelope, PagedEnvelope, PageMeta } from "./httpShared";

export const EVENT_TYPES = [
  "HOLIDAY",
  "EXAM",
  "EVENT",
  "DEADLINE",
  "ACADEMIC",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const AUDIENCES = ["ALL", "STUDENTS", "FACULTY", "STAFF"] as const;
export type Audience = (typeof AUDIENCES)[number];

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  eventType: EventType;
  startDate: string;
  endDate: string;
  audience: Audience;
  academicYearId: string | null;
  academicYear: { id: string; name: string } | null;
}

export interface EventListResult {
  items: CalendarEvent[];
  meta: PageMeta;
}

export async function listEvents(params: {
  page?: number;
  pageSize?: number;
  from?: string;
  to?: string;
  eventType?: EventType;
  audience?: Audience;
  academicYearId?: string;
  search?: string;
} = {}): Promise<EventListResult> {
  const res = await authedFetch<PagedEnvelope<CalendarEvent>>(
    `/calendar/events${buildQuery(params)}`
  );
  return { items: res.data, meta: res.meta };
}

export async function listUpcomingEvents(limit = 10): Promise<CalendarEvent[]> {
  const res = await authedFetch<Envelope<CalendarEvent[]>>(
    `/calendar/events/upcoming?limit=${limit}`
  );
  return res.data;
}

export interface EventInput {
  title: string;
  description?: string;
  eventType: EventType;
  startDate: string;
  endDate: string;
  audience: Audience;
  academicYearId?: string;
}

export async function createEvent(input: EventInput): Promise<CalendarEvent> {
  const res = await authedFetch<Envelope<CalendarEvent>>("/calendar/events", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function updateEvent(
  id: string,
  input: Partial<EventInput>
): Promise<CalendarEvent> {
  const res = await authedFetch<Envelope<CalendarEvent>>(
    `/calendar/events/${id}`,
    { method: "PATCH", body: JSON.stringify(input) }
  );
  return res.data;
}

export async function deleteEvent(id: string): Promise<void> {
  await authedFetch<Envelope<{ id: string }>>(`/calendar/events/${id}`, {
    method: "DELETE",
  });
}

export interface AcademicYearOption {
  id: string;
  name: string;
}

export async function listAcademicYearOptions(): Promise<AcademicYearOption[]> {
  const res = await authedFetch<PagedEnvelope<AcademicYearOption>>(
    "/academic-years?pageSize=100"
  );
  return res.data;
}
