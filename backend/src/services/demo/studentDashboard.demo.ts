/**
 * TEMPORARY DEMO DATA ABSTRACTION — Student Dashboard
 * ====================================================
 * Attendance (Phase 5), Assignments (Phase 5), and Internal Marks
 * (Phase 5) are now REAL — see attendanceStats.service.ts,
 * assignment.service.ts, and internalMark.service.ts. This file has
 * shrunk accordingly: what's left is only what still has no real
 * module — class scheduling (Phase 7 Timetable), Announcements
 * (Phase 7), Placements/Fees (Phase 11+), and "engagement" (no
 * proxy yet, pending Phase 12 Student Intelligence design). When a
 * real module ships, replace the corresponding function here; every
 * consumer's shape stays the same.
 *
 * Where real data already exists (the student's actual course
 * offerings), functions accept it as input so the demo content at
 * least references real course codes instead of inventing courses
 * that don't exist for this student.
 */

export interface DemoCourseRef {
  code: string;
  name: string;
}

export interface TodayClassSlot {
  time: string;
  courseCode: string;
  courseName: string;
  location: string;
  isDemoSchedule: true; // no Timetable model yet (Phase 7)
}

export interface DemoAnnouncement {
  id: string;
  title: string;
  postedLabel: string;
}

export interface DemoUpcomingEvent {
  id: string;
  title: string;
  whenLabel: string;
}

export interface AcademicHealth {
  attendance: number; // 0-100
  assignments: number; // 0-100
  internalMarks: number; // 0-100
  engagement: number; // 0-100
}

export type AcademicRisk = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

const FALLBACK_ROOMS = ["Room 204", "Lab 3", "Room 105", "Room 210", "Lab 1"];
const DEMO_TIME_SLOTS = ["10:00", "11:00", "02:00", "03:30", "04:30"];

/**
 * Today's class schedule. Course code/name come from the student's
 * REAL course offerings when available; time slots and rooms are
 * placeholders (isDemoSchedule: true) until Phase 7 (Timetable).
 */
export function getDemoTodaysClasses(
  realCourses: DemoCourseRef[]
): TodayClassSlot[] {
  const source: DemoCourseRef[] =
    realCourses.length > 0
      ? realCourses
      : [
          { code: "DBMS", name: "Database Management Systems" },
          { code: "AI", name: "Artificial Intelligence" },
          { code: "OS", name: "Operating Systems" },
        ];

  return source.slice(0, 3).map((course, i) => ({
    time: DEMO_TIME_SLOTS[i] ?? `0${i + 9}:00`,
    courseCode: course.code,
    courseName: course.name,
    location: FALLBACK_ROOMS[i] ?? "TBA",
    isDemoSchedule: true,
  }));
}

/** Demo announcements. Real module: Phase 7 (Announcements/Notifications). */
export function getDemoAnnouncements(): DemoAnnouncement[] {
  return [
    {
      id: "demo-announcement-1",
      title: "Mid-Sem Schedule Released",
      postedLabel: "2 days ago",
    },
  ];
}

/** Demo upcoming events. Real modules: Placements (Phase 11), Fees (later). */
export function getDemoUpcomingEvents(): DemoUpcomingEvent[] {
  return [
    { id: "demo-upcoming-1", title: "Placement Drive", whenLabel: "Next week" },
    { id: "demo-upcoming-2", title: "Hackathon", whenLabel: "In 10 days" },
    { id: "demo-upcoming-3", title: "Fee Deadline", whenLabel: "This month" },
  ];
}

/**
 * The one piece of "academic health" with no real proxy yet —
 * everything else (attendance, assignment completion, internal
 * marks average) is now computed from real data by the controller.
 * A fixed mid-range placeholder on purpose: not tied to any specific
 * behavior, so it doesn't silently masquerade as a measurement.
 */
export function getDemoEngagementScore(): number {
  return 60;
}

/**
 * Risk banding over the (now mostly real) health numbers. A plain
 * threshold rule, explicitly labeled as such — not AI, never
 * presented as AI. Real module: Phase 12 (Student Intelligence).
 */
export function getDemoAcademicRisk(health: AcademicHealth): AcademicRisk {
  const average =
    (health.attendance + health.assignments + health.internalMarks + health.engagement) /
    4;
  if (average >= 80) return "LOW";
  if (average >= 65) return "MEDIUM";
  if (average >= 50) return "HIGH";
  return "CRITICAL";
}

export function getDemoRecommendations(
  health: AcademicHealth,
  realCourses: DemoCourseRef[]
): string[] {
  const primaryCourse = realCourses[0]?.code ?? "DBMS";
  const secondaryCourse = realCourses[1]?.code ?? "OS";

  const recommendations: string[] = [];
  if (health.attendance < 85) {
    recommendations.push(`Improve ${primaryCourse} attendance`);
  }
  if (health.assignments < 80) {
    recommendations.push(`Submit ${secondaryCourse} assignment`);
  }
  recommendations.push("Attend placement session");

  return recommendations;
}
