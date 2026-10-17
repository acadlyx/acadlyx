import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path) => readFileSync(resolve(process.cwd(), path), "utf8");
const actions = read("src/components/dashboard/DataTransferActions.tsx");
const api = read("src/lib/dataTransferApi.ts");
const backendRoute = read("../backend/src/routes/import.routes.ts");
const handler = read("../backend/src/jobs/handlers/import.handler.ts");

assert.match(api, /export interface ImportJobSubmission[\s\S]*?jobId: string[\s\S]*?status: string/);
assert.match(api, /export async function commitImport\(type: DataType, file: File\): Promise<ImportJobSubmission>/);
assert.match(api, /did not return a valid import job receipt/);
assert.match(backendRoute, /controller\.commit/);
assert.match(handler, /return \{ \.\.\.result, fileId \}/);
assert.match(actions, /const MAX_IMPORT_STATUS_CHECKS = 300/);
assert.match(actions, /job\.status === "COMPLETED" \|\| job\.status === "PARTIAL"/);
assert.match(actions, /job\.status === "FAILED" \|\| job\.status === "CANCELLED"/);
assert.match(actions, /const queued = await commitImport\(type, file\);[\s\S]*?waitForJob\(queued\.jobId\)/);
assert.match(actions, /Check import status/);
assert.match(actions, /result\.rolledBack/);
assert.match(actions, /setErrors\(rowErrors\.map/);
assert.match(actions, /Complete imported student details/);
assert.doesNotMatch(actions, /window\.location\.href = `\/imports\/students\/complete/);

process.stdout.write("Queued import completion, timeout, rollback, and row-error source checks passed.\n");
