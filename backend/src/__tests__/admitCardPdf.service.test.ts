import assert from "node:assert/strict";
import test from "node:test";
import { createAdmitCardPdf } from "../services/admitCardPdf.service";

test("admit card PDF renderer produces a non-empty PDF", () => {
  const buffer = createAdmitCardPdf({
    institutionName: "ACADLYX Test Institution",
    examination: "End Semester Examination",
    sessionCode: "ESE-2026",
    serialNumber: "HT2026-000001",
    studentName: "Test Student",
    rollNumber: "CSE001",
    enrollmentNumber: "ENR001",
    program: "B.Tech CSE",
    department: "Computer Science",
    semester: "Semester 5",
    papers: [
      {
        code: "CS501",
        name: "Database Management Systems",
        date: "2026-10-10",
        startTime: "09:00",
        endTime: "12:00",
        room: "A-101",
        seat: "A101-001",
      },
    ],
  });

  assert.ok(buffer.length > 500);
  assert.equal(buffer.subarray(0, 8).toString("ascii"), "%PDF-1.4");
  assert.ok(buffer.toString("latin1").includes("%%EOF"));
});
