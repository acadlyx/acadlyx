const base = process.env.ACADLYX_SMOKE_BASE_URL || "http://127.0.0.1:3000";

const routes = [
  "/chairman/operations",
  "/chairman/intelligence",
  "/chairman/fees",
  "/chairman/fee-approvals",
  "/chairman/examinations",
  "/chairman/examinations/operations",
  "/chairman/students",
  "/chairman/students/smoke-student-id",
  "/chairman/reports",
  "/director/operations",
  "/director/intelligence",
  "/director/fees",
  "/director/fee-approvals",
  "/director/examinations",
  "/director/examinations/operations",
  "/director/students",
  "/director/students/smoke-student-id",
  "/director/reports",
];

async function waitForServer() {
  let lastError;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(base + "/login", { redirect: "manual" });
      if (response.status < 500) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error("Next.js server did not become ready: " + String(lastError ?? "no response"));
}

await waitForServer();
const failures = [];
for (const route of routes) {
  try {
    const response = await fetch(base + route, { redirect: "manual" });
    await response.text();
    if (response.status !== 200) {
      failures.push(route + " returned HTTP " + response.status);
    }
  } catch (error) {
    failures.push(route + " request failed: " + String(error));
  }
}
if (failures.length) {
  console.error("Chairman/Director route smoke test failed:\n" + failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Chairman/Director route smoke test passed for " + routes.length + " routes.");
}
