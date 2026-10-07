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


test("admit card renderer applies template controls and produces verification content", () => {
  const pdf = createAdmitCardPdf({
    institutionName: "ACADLYX Test Institution",
    institutionPrimaryColor: "#7c3aed",
    examination: "End Semester Examination",
    sessionCode: "ESE-2026",
    serialNumber: "HT2026-0001",
    studentName: "Sample Student",
    rollNumber: "CSE001",
    enrollmentNumber: "ADM001",
    program: "B.Tech CSE",
    department: "Computer Science",
    semester: "Semester 3",
    verificationValue: "A1B2C3D4E5F6",
    config: {
      showQr: true,
      showInstructions: false,
      showProgram: true,
      showDepartment: true,
      accent: "#7c3aed",
      title: "FINAL ADMIT CARD",
    },
    papers: [{
      code: "CS301", name: "Data Structures", date: "2026-10-10",
      startTime: "10:00", endTime: "13:00", room: "R101", seat: "A01",
    }],
  });
  assert.ok(pdf.length > 500);
  assert.match(pdf.toString("latin1"), /FINAL ADMIT CARD/);
  assert.match(pdf.toString("latin1"), /A1B2C3D4E5F6/);
});


import { createMarksheetPdf } from "../services/marksheetPdf.service";

test("marksheet renderer preserves all rows across pages", () => {
  const rows = Array.from({ length: 35 }, (_, index) => ({
    code: "CS" + String(index + 1).padStart(3, "0"),
    name: "Course " + (index + 1),
    marks: 70,
    max: 100,
    pass: 40,
    absent: false,
  }));
  const pdf = createMarksheetPdf({
    institutionName: "ACADLYX Test Institution",
    studentName: "Test Student",
    enrollmentNumber: "ENR001",
    program: "B.Tech CSE",
    department: "Computer Science",
    semester: "Semester 5",
    examination: "End Semester Examination",
    sessionCode: "ESE-2026",
    rows,
  });
  const text = pdf.toString("latin1");
  assert.ok(pdf.length > 1000);
  assert.equal(text.startsWith("%PDF-1.4"), true);
  assert.match(text, /Page 1 of 2/);
  assert.match(text, /Page 2 of 2/);
  assert.match(text, /CS035/);
  assert.match(text, /Course 35/);
  assert.match(text, /%%EOF/);
});
