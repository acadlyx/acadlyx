function esc(v: unknown): string {
  return String(v ?? "")
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

type Line = { text: string; x: number; y: number; size: number; bold?: boolean };

function addLine(lines: Line[], text: unknown, x: number, y: number, size: number, bold = false): void {
  lines.push({ text: esc(text), x, y, size, bold });
}

export function createMarksheetPdf(input: {
  institutionName: string;
  studentName: string;
  enrollmentNumber?: string | null;
  program?: string | null;
  department?: string | null;
  semester?: string | null;
  examination: string;
  sessionCode: string;
  rows: Array<{
    code: string;
    name: string;
    marks: number | null;
    max: number;
    pass: number;
    absent: boolean;
  }>;
}): Buffer {
  const pageSize = 28;
  const pages = Math.max(1, Math.ceil(input.rows.length / pageSize));
  const chunks = Array.from({ length: pages }, (_, pageIndex) =>
    input.rows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize)
  );

  const total = input.rows.reduce(
    (sum, row) => sum + (row.absent || row.marks === null ? 0 : row.marks),
    0,
  );
  const maxTotal = input.rows.reduce((sum, row) => sum + row.max, 0);
  const percentage = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
  const hasFailure = input.rows.some(
    (row) => !row.absent && row.marks !== null && row.marks < row.pass,
  );

  const pageObjects: string[] = [];
  const pageContents: string[] = [];

  for (let pageIndex = 0; pageIndex < chunks.length; pageIndex += 1) {
    const lines: Line[] = [];
    const rows = chunks[pageIndex];

    addLine(lines, input.institutionName, 50, 790, 18, true);
    addLine(lines, "OFFICIAL MARKSHEET", 215, 752, 15, true);
    addLine(lines, input.examination, 50, 725, 11, true);
    addLine(lines, "Session: " + input.sessionCode, 50, 705, 9);
    addLine(lines, "Student: " + input.studentName, 50, 680, 10, true);
    if (input.enrollmentNumber) addLine(lines, "Enrollment: " + input.enrollmentNumber, 50, 662, 9);
    if (input.program) addLine(lines, "Program: " + input.program, 50, 644, 9);
    if (input.department) addLine(lines, "Department: " + input.department, 50, 626, 9);
    if (input.semester) addLine(lines, "Semester: " + input.semester, 50, 608, 9);

    addLine(lines, "SUBJECT / PAPER", 50, 575, 9, true);
    addLine(lines, "MAX", 380, 575, 9, true);
    addLine(lines, "PASS", 430, 575, 9, true);
    addLine(lines, "MARKS", 480, 575, 9, true);

    let y = 555;
    for (const row of rows) {
      addLine(lines, (row.code + " — " + row.name).slice(0, 52), 50, y, 8);
      addLine(lines, row.max, 380, y, 8);
      addLine(lines, row.pass, 430, y, 8);
      addLine(lines, row.absent ? "AB" : row.marks, 480, y, 8, true);
      y -= 18;
    }

    if (pageIndex === chunks.length - 1) {
      y = Math.max(y - 12, 100);
      addLine(lines, "TOTAL", 50, y, 10, true);
      addLine(lines, total + " / " + maxTotal, 380, y, 10, true);
      addLine(lines, "PERCENTAGE", 50, y - 22, 9, true);
      addLine(lines, percentage.toFixed(2) + "%", 380, y - 22, 9, true);
      addLine(lines, "RESULT STATUS", 50, y - 44, 9, true);
      addLine(lines, hasFailure ? "FAIL" : "PASS", 380, y - 44, 9, true);
      addLine(lines, "SGPA / CGPA", 50, y - 66, 9, true);
      addLine(lines, "As per institutional grade scheme / transcript", 380, y - 66, 8);
    }

    addLine(lines, "Page " + (pageIndex + 1) + " of " + pages, 470, 55, 7);
    addLine(
      lines,
      pageIndex === pages - 1
        ? "This is an official result document generated from published examination marks."
        : "Continued on next page.",
      50,
      55,
      7,
    );

    pageContents.push([
      "q",
      "50 55 495 705 re S",
      "50 675 495 2 re f",
      "0 0 0 rg",
      ...lines.map(
        (line) =>
          "BT /" +
          (line.bold ? "F2" : "F1") +
          " " +
          line.size +
          " Tf " +
          line.x +
          " " +
          line.y +
          " Td (" +
          line.text +
          ") Tj ET",
      ),
      "Q",
    ].join("\n"));
  }

  const objects: string[] = [];
  const pageIds: number[] = [];
  const contentIds: number[] = [];

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  // Reserve the Pages object. Its Kids array is filled after page object IDs are known.
  objects.push("");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  for (const content of pageContents) {
    const pageId = objects.length + 1;
    const contentId = pageId + 1;
    pageIds.push(pageId);
    contentIds.push(contentId);
    objects.push("");
    objects.push(
      "<< /Length " +
        Buffer.byteLength(content, "latin1") +
        " >>\\nstream\\n" +
        content +
        "\\nendstream",
    );
  }

  objects[1] =
    "<< /Type /Pages /Kids [" +
    pageIds.map((id) => id + " 0 R").join(" ") +
    "] /Count " +
    pageIds.length +
    " >>";

  for (let index = 0; index < pageIds.length; index += 1) {
    objects[pageIds[index] - 1] =
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] " +
      "/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> " +
      "/Contents " +
      contentIds[index] +
      " 0 R >>";
  }

  let output = "%PDF-1.4\n";
  const offsets: number[] = [0];

  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(output, "latin1"));
    output += index + 1 + " 0 obj\n" + objects[index] + "\nendobj\n";
  }

  const xref = Buffer.byteLength(output, "latin1");
  output +=
    "xref\n0 " +
    (objects.length + 1) +
    "\n0000000000 65535 f \n";
  for (let index = 1; index <= objects.length; index += 1) {
    output += String(offsets[index]).padStart(10, "0") + " 00000 n \n";
  }
  output +=
    "trailer\n<< /Size " +
    (objects.length + 1) +
    " /Root 1 0 R >>\nstartxref\n" +
    xref +
    "\n%%EOF\n";

  const buffer = Buffer.from(output, "latin1");
  if (
    buffer.length < 500 ||
    !buffer.subarray(0, 8).toString("ascii").startsWith("%PDF-1.") ||
    !buffer.toString("latin1").includes("%%EOF")
  ) {
    throw new Error("Marksheet PDF generation produced an invalid document.");
  }
  return buffer;
}
