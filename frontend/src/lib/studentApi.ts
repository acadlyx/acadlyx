import { authedFetch } from "./auth";
import { StudentDashboardData } from "@/types/dashboard";

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export async function getMyDashboard(): Promise<StudentDashboardData> {
  const res = await authedFetch<ApiEnvelope<StudentDashboardData>>(
    "/students/me/dashboard"
  );
  return res.data;
}
