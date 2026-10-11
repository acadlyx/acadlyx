# Chairman & Director Route-to-Action Inventory

Baseline: `879a0dc54797d2bee70ed5df80117af456e16c98`. This inventory is deliberately evidence-based: it lists existing route trees found in the repository and separates route existence from verified behavior.

| Workspace | Existing route | Intended capability | Initial verification |
|---|---|---|---|
| Chairman | `/chairman` | Executive command center | Page exists; dashboard reads `/erp/me/workspace`; scope of each statistic requires endpoint verification |
| Chairman | `/chairman/operations` | Operational overview | Page exists; destinations and backend actions require interaction audit |
| Chairman | `/chairman/fee-approvals` | Fee-structure decision queue | Page exists; uses canonical fee structure list/approve/reject API; test maker-checker and scope |
| Chairman | `/chairman/fees` | Finance overview | Page exists; verify query filters and tenant scope |
| Chairman | `/chairman/fees/collections` | Collections analytics | Page exists; verify aggregation and report scope |
| Chairman | `/chairman/examinations` | Examination oversight | Page exists; verify canonical lifecycle and role-specific authority |
| Chairman | `/chairman/intelligence` | Institutional intelligence | Page exists; verify all metrics are sourced and scoped |
| Chairman | `/chairman/obe` | Outcome-based education | Page exists; verify source queries and scope |
| Chairman | `/chairman/placements` | Placement outcomes | Page exists; verify sensitive student data minimization |
| Chairman | `/chairman/reports` | Institutional reports | Page exists; verify export authorization and context |
| Chairman | `/chairman/students` | Enrollment/student lifecycle | Page exists; verify institution scope per record |
| Director | `/director` | Campus command center | Page exists; dashboard reads `/erp/me/workspace`; campus scoping of statistics requires endpoint verification |
| Director | `/director/operations` | Campus operational overview | Page exists; some links currently lead to global routes such as `/students` and `/admissions`; must verify their campus scope |
| Director | `/director/fees` | Campus finance overview | Page exists; verify assigned-campus filter |
| Director | `/director/fees/collections` | Campus collections analytics | Page exists; verify aggregation and export scope |
| Director | `/director/examinations` | Campus examination oversight | Page exists; verify campus-level policy |
| Director | `/director/obe` | Campus OBE oversight | Page exists; verify campus scope |
| Director | `/director/placements` | Campus placement outcomes | Page exists; verify campus scope and field minimization |
| Director | `/director/reports` | Campus reporting | Page exists; verify exports |
| Director | `/director/students` | Campus student lifecycle | Page exists; verify entity and campus boundaries |
| Director | `/director/imports` | Campus import review | Page exists; verify mutations and upload scoping |

## Action inventory rule

For each interactive element, record: source page, label, destination/endpoint, required permission, scope resolver, validation, loading/error/success behavior, idempotency, audit event, and test ID. Do not mark an action complete merely because its button renders. This inventory remains an audit worklist until automated browser coverage exists for every visible action.
