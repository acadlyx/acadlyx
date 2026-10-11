# Chairman & Director RBAC / Scope Matrix

Status is based on source inspection at the implementation baseline; confirm each capability against live permission seeds and workflow policy before release.

| Capability | Chairman | Director | Required backend boundary |
|---|---|---|---|
| Dashboard KPIs | Read/analyze within assigned institution(s) | Read/analyze assigned campus(es) only | Scope every aggregate before grouping |
| Campus comparison | Across authorized campuses in assigned institution | Only between assigned campuses | CampusAccess-derived campus IDs |
| Department/program drill-down | Authorized institution | Departments/programs belonging to assigned campus(es) | Resolve entity → campus → institution |
| Student details | Tenant-scoped | Active enrollment must resolve to assigned campus | Check enrollment/department scope per record |
| Fee structure approval | Only if `fees.structure.approve` and workflow assigns Chairman | No Chairman-level approval | Permission + state + authority + audit |
| Campus expenditure | Institution policy / designated approval chain | Only within delegated limits and assigned campus | Amount threshold + current state + actor separation |
| Institution-level proposal | Final decision where configured | Recommend/submit; cannot finalize Chairman-only decision | Separate recommendation from final approval |
| Examination/result publication | Only where workflow assigns this authority | Campus readiness/exception workflow only | Canonical examination lifecycle + action permission |
| Read-only analytics | Allowed by read permission | Allowed by read permission within campus | Read permission does not imply mutation |
| Reject/return/escalate | Explicit action permission and required reason | Explicit campus action permission and required reason | Validate state transition transactionally |
| Export/report | Authorized institution-wide dataset | Authorized campus-only dataset | Reuse same scoped query as screen |
| Audit history | Authorized decision/resource scope | Authorized campus/resource scope | Actor identity from server session |

## Mandatory negative cases

1. Chairman cannot access a different institution by changing route, query, request body, or record ID.
2. Director cannot access an unassigned campus even when it belongs to the same institution.
3. Director with student-read permission cannot bypass enrollment scope.
4. A read-only user cannot approve.
5. Revoked campus access is enforced on the next backend request.
6. Stale workflow state and duplicate submissions do not produce duplicate decisions.
7. Aggregates, search, pagination, and exports must not reveal out-of-scope rows.

## Known limitation

The current application has many canonical role and permission helpers, but this matrix is not proof that every existing endpoint uses them correctly. Release approval requires endpoint-by-endpoint testing and a review of role/permission seed data.
