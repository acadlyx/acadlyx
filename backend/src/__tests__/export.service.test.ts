import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import { makeFile } from "../services/export.service";

test("XLSX export is non-empty and parseable", () => {
  const file = makeFile([{ id: "1", name: "Student", active: true }], "students", "xlsx");
  assert.ok(file.buffer.length > 100);
  const workbook = XLSX.read(file.buffer, { type: "buffer" });
  assert.deepEqual(XLSX.utils.sheet_to_json(workbook.Sheets.Data), [{ id: "1", name: "Student", active: true }]);
});

test("empty XLSX export remains a valid workbook", () => {
  const file = makeFile([], "students", "xlsx");
  assert.ok(file.buffer.length > 100);
  const workbook = XLSX.read(file.buffer, { type: "buffer" });
  assert.ok(workbook.SheetNames.includes("Data"));
});
