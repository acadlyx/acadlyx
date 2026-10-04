import { authedFetch } from "@/lib/auth";

type Envelope<T> = { success: boolean; data: T };
export type AdmitCardTemplate = {
  id: string;
  name: string;
  description: string | null;
  status: "DRAFT" | "ACTIVE" | "INACTIVE";
  config: Record<string, unknown>;
};

export async function listAdmitCardTemplates() {
  const res = await authedFetch<Envelope<AdmitCardTemplate[]>>("/examinations/admit-card-templates");
  return res.data;
}

export async function createAdmitCardTemplate(input: {
  name: string;
  description?: string;
  config?: Record<string, unknown>;
}) {
  const res = await authedFetch<Envelope<AdmitCardTemplate>>("/examinations/admit-card-templates", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function updateAdmitCardTemplate(id: string, input: Record<string, unknown>) {
  const res = await authedFetch<Envelope<AdmitCardTemplate>>(`/examinations/admit-card-templates/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function deleteAdmitCardTemplate(id: string) {
  return authedFetch<Envelope<{ deleted: boolean }>>(`/examinations/admit-card-templates/${id}`, {
    method: "DELETE",
  });
}
