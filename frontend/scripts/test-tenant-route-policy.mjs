import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const navigationSource = readFileSync(new URL("../src/lib/navigation.ts", import.meta.url), "utf8");
const boundarySource = readFileSync(new URL("../src/components/auth/ProtectedRouteBoundary.tsx", import.meta.url), "utf8");
const dashboardShellSource = readFileSync(new URL("../src/components/dashboard/DashboardShell.tsx", import.meta.url), "utf8");
const backendFeaturesSource = readFileSync(new URL("../../backend/src/config/features.ts", import.meta.url), "utf8");
const backendNoticeRoutesSource = readFileSync(new URL("../../backend/src/routes/erp.routes.ts", import.meta.url), "utf8");
const backendFeatureGuardSource = readFileSync(new URL("../../backend/src/middleware/requireFeature.ts", import.meta.url), "utf8");
const featureBlockStart = navigationSource.indexOf("const TENANT_FEATURE_BY_ROUTE");
const featureBlockEnd = navigationSource.indexOf("export function tenantFeaturesForPath", featureBlockStart);
assert.ok(featureBlockStart >= 0 && featureBlockEnd > featureBlockStart, "tenant feature route classifier must exist");

function parseRouteFeatureRules(source) {
  const block = source.slice(featureBlockStart, featureBlockEnd);
  const rules = [];
  for (const line of block.split("\n")) {
    const literalStart = line.indexOf("[/");
    if (literalStart < 0) continue;
    const slashStart = literalStart + 1;
    let escaped = false;
    let slashEnd = -1;
    for (let index = slashStart + 1; index < line.length; index += 1) {
      const character = line[index];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (character === "\\") {
        escaped = true;
        continue;
      }
      if (character === "/") {
        slashEnd = index;
        break;
      }
    }
    if (slashEnd < 0) continue;
    const feature = line.slice(slashEnd + 1).match(/^,\s*"([^"]+)"/)?.[1];
    if (!feature) continue;
    rules.push({ pattern: new RegExp(line.slice(slashStart + 1, slashEnd)), feature });
  }
  assert.ok(rules.length >= 60, "expected expanded tenant route policy; parsed " + rules.length + " rules");
  return rules;
}

const routeFeatureRules = parseRouteFeatureRules(navigationSource);
const featureArray = backendFeaturesSource.match(/export const TENANT_FEATURES = \[([\s\S]*?)\] as const/)?.[1] ?? "";
const canonicalFeatures = new Set([...featureArray.matchAll(/"([^"]+)"/g)].map((match) => match[1]));
assert.ok(canonicalFeatures.size >= 30, "backend tenant feature catalogue should be parsed");

function featuresForPath(pathname) {
  const [rawPath, rawQuery] = pathname.split("?");
  const normalizedPath = rawPath.replace(/\/+$/, "") || "/";
  const features = routeFeatureRules
    .filter(({ pattern }) => pattern.test(normalizedPath))
    .map(({ feature }) => feature);
  const query = new URLSearchParams(rawQuery || "");
  if (normalizedPath === "/hod" && query.get("tab") === "registrations") {
    features.push("registration");
  }
  return Array.from(new Set(features));
}

test("role-owned deep routes map to their canonical tenant entitlements", () => {
  const cases = [
    ["/admin/notices", "notices"],
    ["/admin/notifications", "notifications"],
    ["/admin/calendar", "calendar"],
    ["/admin/placements", "placements"],
    ["/management/placements", "placements"],
    ["/registrar/placements", "placements"],
    ["/admin/documents", "documents"],
    ["/student/documents", "documents"],
    ["/student/leave", "leave"],
    ["/leave-management", "leave"],
    ["/student/enrollment", "admissions"],
    ["/hod/enrollment-requests", "admissions"],
    ["/hod/course-registration-requests", "registration"],
    ["/hod?tab=registrations", "registration"],
    ["/student/admit-cards", "exams"],
    ["/student/marks", "results"],
    ["/student/examinations/performance", "results"],
    ["/student/examinations/results", "results"],
    ["/student/academic", "academics"],
    ["/registrar/academic-masters", "academics"],
    ["/admin/academic-years", "academics"],
    ["/admin/campuses", "academics"],
    ["/admin/course-offerings", "academics"],
    ["/admin/institutional-cms", "cms"],
    ["/admin/operations", "operations"],
    ["/director/imports", "import_export"],
    ["/it/imports", "import_export"],
    ["/club-president/notices", "notices"],
    ["/club-president/notifications", "notifications"],
    ["/site-content/notices", "notices"],
    ["/site-content/notifications", "notifications"],
    ["/admin/parent-links", "parent_portal"],
    ["/parent/profile", "parent_portal"],
  ];

  for (const [path, expectedFeature] of cases) {
    const actualFeatures = featuresForPath(path);
    assert.ok(
      actualFeatures.includes(expectedFeature),
      path + " must require " + expectedFeature + " entitlement (found: " + (actualFeatures.join(", ") || "none") + ")",
    );
  }
});

test("every mapped route feature exists in the backend canonical feature catalogue", () => {
  const missing = [...new Set(routeFeatureRules.map(({ feature }) => feature))]
    .filter((feature) => !canonicalFeatures.has(feature));
  assert.deepEqual(missing, [], "frontend route policy must not invent tenant feature keys");
});

test("Leave routes depend on Leave entitlement and not merely on HR", () => {
  for (const path of ["/student/leave", "/leave-management", "/faculty/leave", "/hod/leave", "/director/leave", "/dean/leave", "/registrar/leave", "/hr/leave"]) {
    const features = featuresForPath(path);
    assert.ok(features.includes("leave"), path + " must require leave");
    assert.ok(!features.includes("hr") || path === "/hr/leave", path + " must not be blocked solely because HR is disabled");
  }
});

test("nested Parent pages require Parent Portal as well as their module-specific entitlement", () => {
  assert.ok(featuresForPath("/parent/fees").includes("parent_portal"));
  assert.ok(featuresForPath("/parent/fees").includes("fees"));
  assert.ok(featuresForPath("/parent/placements").includes("parent_portal"));
  assert.ok(featuresForPath("/parent/placements").includes("placements"));
});

test("all tenant notice aliases enforce the notices entitlement and notice APIs use the backend feature guard", () => {
  const roleOwnedNoticePaths = [
    "/chairman/notices",
    "/management/notices",
    "/director/notices",
    "/dean/notices",
    "/registrar/notices",
    "/hod/notices",
    "/faculty/notices",
    "/accounts/notices",
    "/hr/notices",
    "/admissions/notices",
    "/examination/notices",
    "/library/notices",
    "/placements/notices",
    "/it/notices",
    "/student/notices",
    "/parent/notices",
    "/club-president/notices",
    "/staff/notices",
    "/site-content/notices",
    "/notices",
  ];
  for (const path of roleOwnedNoticePaths) {
    assert.ok(featuresForPath(path).includes("notices"), path + " must require the notices entitlement");
  }

  const noticeRoutesStart = backendNoticeRoutesSource.indexOf("/* Notices */");
  const noticeRoutesEnd = backendNoticeRoutesSource.indexOf("/* Exams and results */", noticeRoutesStart);
  const noticeRoutes = backendNoticeRoutesSource.slice(noticeRoutesStart, noticeRoutesEnd);
  assert.equal((noticeRoutes.match(/requireFeature\\("notices"\\)/g) || []).length, 4,
    "GET/POST/PATCH/DELETE notice endpoints must all enforce the notices entitlement");
  assert.match(noticeRoutes, /authorize\\("notices\\.read"\\)/, "notice reads must still require notices.read");
  assert.match(noticeRoutes, /authorize\\("notices\\.manage"\\)/, "notice mutations must still require notices.manage");
  assert.ok(backendFeatureGuardSource.includes("assertTenantFeature(req.user.institutionId, feature, subscriptionSnapshot)"),
    "API feature guards must check the active tenant subscription, not frontend navigation only");
  assert.ok(!featuresForPath("/superadmin/notices").includes("notices"),
    "the platform-only legacy alias is a redirect and must not expose tenant notice data");
});

test("direct-route and dashboard route guards both consult the tenant feature classifier", () => {
  const accessStart = navigationSource.indexOf("export function canAccessRoute");
  const homeStart = navigationSource.indexOf("export function workspaceHome", accessStart);
  const accessSource = navigationSource.slice(accessStart, homeStart);
  const featureGate = accessSource.indexOf("requiredTenantFeatures.some");
  const namespaceResolution = accessSource.indexOf("const matchingNamespace");
  assert.ok(featureGate >= 0 && namespaceResolution > featureGate, "tenant entitlement gate must run before namespace ownership");
  assert.ok(accessSource.includes("tenantFeaturesForPath(pathname)"), "query-backed destinations must be evaluated with their query parameters");
  assert.ok(boundarySource.includes("destination === route"), "unauthorized query-backed views must return to the role home instead of forcing a login loop");
  assert.ok(boundarySource.includes("canAccessRoute(route, currentUser.roles, currentUser.permissions, currentUser.tenantFeatures || [])"), "global direct-route boundary must enforce entitlement decisions");
  assert.ok(dashboardShellSource.includes("canAccessRoute(pathname, roles, permissions, tenantFeatures)"), "dashboard route guard must enforce entitlement decisions");
});
