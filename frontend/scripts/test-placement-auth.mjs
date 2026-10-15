import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pages = [
  "src/app/student/placements/page.tsx",
  "src/app/student/placements/profile/page.tsx",
  "src/app/chairman/placements/page.tsx",
  "src/app/director/placements/page.tsx",
  "src/app/admin/placements/page.tsx",
  "src/app/management/placements/page.tsx",
  "src/app/registrar/placements/page.tsx",
  "src/app/dean/placements/page.tsx",
  "src/app/faculty/placements/page.tsx",
  "src/app/hod/placements/page.tsx",
  "src/app/parent/placements/page.tsx",
  "src/app/placements/page.tsx",
  "src/app/placements/companies/page.tsx",
  "src/app/placements/drives/page.tsx",
  "src/app/placements/interviews/page.tsx",
  "src/app/placements/offers/page.tsx",
  "src/app/placements/openings/page.tsx",
  "src/app/placements/reports/page.tsx",
  "src/app/placements/tests/page.tsx",
  "src/app/placements/visits/page.tsx",
];

for (const path of pages) {
  const source = readFileSync(new URL(path, `file://${process.cwd()}/`), "utf8");
  assert.match(
    source,
    /\bauthedFetch\s*(?:<|\()/,
    `${path} must use the centralized authenticated API client`,
  );
  assert.doesNotMatch(
    source,
    /\bapiFetch\b/,
    `${path} must not call the unauthenticated generic API client`,
  );
  assert.doesNotMatch(
    source,
    /ApiRequestError/,
    `${path} must not handle generic-client errors after switching to authedFetch`,
  );
}

process.stdout.write(`Placement authentication source checks passed for all ${pages.length} protected Placement pages.\n`);
