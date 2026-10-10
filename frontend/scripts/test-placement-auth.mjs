import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pages = [
  "src/app/student/placements/page.tsx",
  "src/app/student/placements/profile/page.tsx",
];

for (const path of pages) {
  const source = readFileSync(new URL(path, `file://${process.cwd()}/`), "utf8");
  assert.match(source, /\bauthedFetch\s*</, `${path} must use the centralized authenticated API client`);
  assert.match(source, /AuthRequiredError/, `${path} must handle sessions that cannot be restored`);
  assert.doesNotMatch(source, /\bapiFetch\s*</, `${path} must not call the unauthenticated generic API client`);
  assert.doesNotMatch(source, /ApiRequestError/, `${path} must handle errors from the authenticated client`);
}

process.stdout.write("Placement authentication source checks passed.\n");
