import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const finance = readFileSync(resolve(process.cwd(), "src/components/accounts/FinancePage.tsx"), "utf8");

assert.match(finance, /describeFinanceError/);
assert.match(finance, /title:"Permission denied"/);
assert.match(finance, /title:"Feature disabled by institution policy"/);
assert.match(finance, /title:"Network error"/);
assert.match(finance, /title:"Server error"/);
assert.match(finance, /No fee structures have been created for this institution yet/);
assert.match(finance, /No fee heads have been configured for this institution yet/);
assert.match(finance, /Retry setup options/);
assert.match(finance, /useEffect\(\(\)=>\{if\(!canCreate\)return/);

process.stdout.write("Finance access/error-state source checks passed.\n");
