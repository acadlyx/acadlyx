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

export type StudentTimetableEntry = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string | null;
  course: { code: string; name: string };
  faculty: string | null;
};

export async function getMyTimetable(): Promise<StudentTimetableEntry[]> {
  const res = await authedFetch<ApiEnvelope<StudentTimetableEntry[]>>(
    "/students/me/timetable"
  );
  return res.data;
}
