/**
 * TEMPORARY DEMO DATA ABSTRACTION — Faculty Dashboard
 * =====================================================
 * Same rule as backend/src/services/demo/studentDashboard.demo.ts:
 * this is the ONLY file allowed to invent faculty dashboard content.
 * Attendance AND Assignments are now REAL (see
 * services/attendanceSession.service.ts, services/faculty.service.ts,
 * and services/assignment.service.ts) — what's left here is only
 * class scheduling (no Timetable model yet, Phase 7) and Lecture
 * Plans (no model planned yet; revisit if/when that becomes real).
 *
 * Where real course data exists, functions accept it as input so demo
 * content references real course codes instead of inventing courses
 * this faculty member doesn't actually teach.
 */

export interface DemoCourseRef {
  code: string;
  name: string;
  sectionName: string;
}

export interface TodayClassSlot {
  time: string;
  courseCode: string;
  courseName: string;
  sectionName: string;
  isDemoSchedule: true; // no Timetable model yet (Phase 7)
}

const DEMO_TIME_SLOTS = ["09:00", "10:00", "11:00", "01:00", "02:00", "03:30"];

/**
 * Today's teaching slots. Course/section come from the faculty's
 * REAL assigned course offerings; the time is a placeholder
 * (isDemoSchedule: true) until Phase 7 (Timetable).
 */
export function getDemoTodaysClasses(
  realOfferings: DemoCourseRef[]
): TodayClassSlot[] {
  return realOfferings.slice(0, 6).map((o, i) => ({
    time: DEMO_TIME_SLOTS[i] ?? `0${i + 9}:00`,
    courseCode: o.code,
    courseName: o.name,
    sectionName: o.sectionName,
    isDemoSchedule: true,
  }));
}

/** No Lecture Plans model exists yet — revisit if/when it becomes a real module. */
export function getDemoLecturePlansPending(): number {
  return 1;
}
