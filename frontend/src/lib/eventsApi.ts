import { authedFetch } from "./auth";

export type EventMedia = {
  id: string;
  fileAssetId: string;
  url: string;
  publicId?: string | null;
  title?: string | null;
  altText?: string | null;
  displayOrder: number;
};

export type InstitutionalEvent = {
  id: string;
  title: string;
  slug: string;
  shortDescription?: string | null;
  description?: string | null;
  eventDate: string;
  startTime?: string | null;
  endTime?: string | null;
  venue?: string | null;
  organizers?: Array<Record<string, unknown>> | null;
  speakers?: Array<Record<string, unknown>> | null;
  highlights?: string[] | null;
  videoUrls?: string[] | null;
  tags?: string[] | null;
  status: string;
  publicationStatus: string;
  isFeatured: boolean;
  coverImageUrl?: string | null;
  coverFileId?: string | null;
  publishedAt?: string | null;
  category?: { id: string; name: string; slug: string } | null;
  department?: { id: string; name: string; code: string } | null;
  media: EventMedia[];
};

export async function listEvents(params: Record<string, string | number | boolean | undefined> = {}) {
  const query = new URLSearchParams();
  for (const [key,value] of Object.entries(params)) if (value !== undefined && value !== "") query.set(key,String(value));
  return authedFetch<InstitutionalEvent[]>(`/events${query.size ? `?${query.toString()}` : ""}`);
}
export async function getEvent(id: string) { return authedFetch<InstitutionalEvent>(`/events/${id}`); }
export async function getEventCategories() { return authedFetch<Array<{id:string;name:string;slug:string}>>("/events/categories"); }
export async function createEvent(payload: Record<string, unknown>) { return authedFetch<InstitutionalEvent>("/events",{method:"POST",body:JSON.stringify(payload)}); }
export async function updateEvent(id:string,payload:Record<string, unknown>) { return authedFetch<InstitutionalEvent>(`/events/${id}`,{method:"PATCH",body:JSON.stringify(payload)}); }
export async function deleteEvent(id:string) { return authedFetch<{id:string;deleted:boolean}>(`/events/${id}`,{method:"DELETE"}); }
export async function uploadEventMedia(file: File) {
  const form = new FormData();
  form.append("file",file);
  return authedFetch<{id:string;url:string;publicId:string}>("/events/media/upload",{method:"POST",body:form});
}
export async function addEventMedia(id:string,payload:Record<string,unknown>) { return authedFetch<EventMedia>(`/events/${id}/media`,{method:"POST",body:JSON.stringify(payload)}); }
export async function removeEventMedia(mediaId:string) { return authedFetch<{id:string;deleted:boolean}>(`/events/media/${mediaId}`,{method:"DELETE"}); }
export async function reorderEventMedia(id:string,ids:string[]) { return authedFetch<EventMedia[]>(`/events/${id}/media/reorder`,{method:"POST",body:JSON.stringify({ids})}); }
