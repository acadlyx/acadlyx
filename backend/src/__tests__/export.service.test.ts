import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import { createCsv, createDocx, createPdf } from "../services/exportDocuments.service";
import { computeExportInvoiceBalance, makeFile } from "../services/export.service";
import { exportJobSchema } from "../validators/export.validators";

test("XLSX export is non-empty and parseable", () => {
  const file = makeFile([{ id: "1", name: "Student", active: true }], "students", "xlsx");
  assert.ok(file.buffer.length > 100);
  const workbook = XLSX.read(file.buffer, { type: "buffer" });
  assert.deepEqual(XLSX.utils.sheet_to_json(workbook.Sheets.Data), [{ id: "1", name: "Student", active: true }]);
  assert.equal(file.contentType, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
});

test("empty XLSX export remains a valid workbook", () => {
  const file = makeFile([], "students", "xlsx");
  assert.ok(file.buffer.length > 100);
  const workbook = XLSX.read(file.buffer, { type: "buffer" });
  assert.ok(workbook.SheetNames.includes("Data"));
});

test("CSV export quotes data and neutralizes spreadsheet formulas", () => {
  const csv = createCsv([{ name: 'Doe, "Jane"', note: "=HYPERLINK(\"https://example.invalid\")", amount: 12 }]).toString("utf8");
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes('"Doe, ""Jane"""'));
  assert.ok(csv.includes("'=HYPERLINK"));
  assert.ok(csv.includes("12"));
});

test("DOCX output is a ZIP package containing the OOXML document", () => {
  const file = makeFile([{ id: "42", name: "A & B" }], "students", "docx");
  assert.equal(file.contentType, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  assert.equal(file.buffer.readUInt32LE(0), 0x04034b50);
  assert.ok(file.buffer.includes(Buffer.from("[Content_Types].xml")));
  assert.ok(file.buffer.includes(Buffer.from("word/document.xml")));
  assert.ok(file.buffer.includes(Buffer.from("A &amp; B")));
  assert.equal(file.buffer.readUInt32LE(file.buffer.length - 22), 0x06054b50);
});

test("PDF output has a valid header, page tree and EOF marker", () => {
  const file = makeFile([{ id: "42", name: "Student" }], "students", "pdf");
  const content = file.buffer.toString("ascii");
  assert.equal(file.contentType, "application/pdf");
  assert.ok(content.startsWith("%PDF-1.4"));
  assert.ok(content.includes("/Type /Pages"));
  assert.ok(content.includes("Record 1"));
  assert.ok(content.endsWith("%%EOF\n"));
});

test("JSON export is parseable and empty exports stay valid", () => {
  const file = makeFile([{ id: "42", amount: 12 }], "fees", "json");
  assert.equal(file.contentType, "application/json; charset=utf-8");
  assert.deepEqual(JSON.parse(file.buffer.toString("utf8")), [{ id: "42", amount: 12 }]);
  assert.deepEqual(JSON.parse(makeFile([], "fees", "json").buffer.toString("utf8")), []);
});

test("document writers handle empty datasets without throwing", () => {
  assert.ok(createDocx([], "students").length > 100);
  assert.ok(createPdf([], "students").toString("ascii").startsWith("%PDF-1.4"));
  assert.equal(createCsv([]).toString("utf8"), "\uFEFF");
});

test("negative numeric ledger values are not prefixed as formulas in CSV", () => {
  const csv = createCsv([{ refund: -25 }]).toString("utf8");
  assert.ok(csv.includes("-25"));
  assert.ok(!csv.includes("'-25"));
});

test("invoice balance does not subtract refunded amounts twice after paidAmount is netted", () => {
  assert.equal(computeExportInvoiceBalance(100, 80), 20);
  assert.equal(computeExportInvoiceBalance(100, 100), 0);
  assert.equal(computeExportInvoiceBalance(100, 120), 0);
  assert.equal(computeExportInvoiceBalance(100, Number.NaN), 100);
});


test("placement activity schedule exports support every advertised document format", () => {
  for (const type of ["placement-visits", "placement-tests", "placement-interviews"] as const) {
    const rows = [{ id: "activity-1", title: "Recruiter session", status: "SCHEDULED", startsAt: "2030-04-01T10:00:00.000Z" }];
    for (const format of ["xlsx", "csv", "docx", "pdf", "json"] as const) {
      const file = makeFile(rows, type, format);
      assert.ok(file.buffer.length > 0, `${type} ${format} export should be non-empty`);
    }
  }
});


test("background export job options validate formats, selections and bounded filters", () => {
  assert.deepEqual(exportJobSchema.parse({ format: "csv", selection: "selected", ids: ["row-1"] }), {
    format: "csv", selection: "selected", ids: ["row-1"],
  });
  assert.deepEqual(exportJobSchema.parse({}), { format: "xlsx", selection: "all-filtered" });
  assert.equal(exportJobSchema.safeParse({ selection: "selected" }).success, false);
  assert.equal(exportJobSchema.safeParse({ selection: "all-filtered", ids: ["row-1"] }).success, false);
  assert.equal(exportJobSchema.safeParse({ format: "exe" }).success, false);
  assert.equal(exportJobSchema.safeParse({ filters: { search: "x".repeat(201) } }).success, false);
});
