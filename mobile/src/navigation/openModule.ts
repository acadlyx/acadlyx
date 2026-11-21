import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "./RootNavigator";

type ModuleNavigation = Pick<NativeStackNavigationProp<RootStackParamList>, "navigate">;

/**
 * Keep module entry points consistent across the dashboard, catalogue, and
 * search results. Modules with a native workflow use that workflow; other
 * modules retain the canonical Module screen, including its dedicated finance,
 * examinations, internal-marks, and documents branches.
 */
export function openModule(navigation: ModuleNavigation, moduleId: string): void {
  switch (moduleId) {
    case "assignments": return navigation.navigate("Assignments");
    case "notices": return navigation.navigate("Notices");
    case "timetable": return navigation.navigate("Timetable");
    case "library": return navigation.navigate("Library");
    case "calendar": return navigation.navigate("Calendar");
    case "attendance": return navigation.navigate("Attendance");
    case "leave": return navigation.navigate("Leave");
    case "parent-children": return navigation.navigate("Parent");
    case "hr": return navigation.navigate("HR");
    case "admissions": return navigation.navigate("Admissions");
    case "placements": return navigation.navigate("Placement");
    case "lms": return navigation.navigate("Lms");
    case "student-dashboard": return navigation.navigate("StudentPortal", { initialTab: "OVERVIEW" });
    case "student-attendance": return navigation.navigate("StudentPortal", { initialTab: "ATTENDANCE" });
    case "student-marks": return navigation.navigate("StudentPortal", { initialTab: "MARKS" });
    case "student-results": return navigation.navigate("StudentPortal", { initialTab: "RESULTS" });
    case "student-assignments": return navigation.navigate("StudentPortal", { initialTab: "ASSIGNMENTS" });
    case "student-timetable": return navigation.navigate("StudentPortal", { initialTab: "TIMETABLE" });
    default: return navigation.navigate("Module", { moduleId });
  }
}
