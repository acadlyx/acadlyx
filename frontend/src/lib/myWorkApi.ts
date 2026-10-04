import { authedFetch } from "@/lib/auth";

export type WorkPriority = "critical" | "high" | "normal";

export interface WorkItem {
  id: string;
  title: string;
  count: number;
  priority: WorkPriority;
  href: string;
  detail: string;
}

export interface MyWorkSummary {
  generatedAt: string;
  total: number;
  critical: number;
  high: number;
  items: WorkItem[];
}

export async function getMyWork(): Promise<MyWorkSummary> {
  const response = await authedFetch<{ success: true; data: MyWorkSummary }>("/my-work");
  return response.data;
}
