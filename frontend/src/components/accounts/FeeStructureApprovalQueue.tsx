"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageContainer,
  PageHeader,
} from "@/components/ui/AcadlyxDesignSystem";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AuthRequiredError, getCurrentUser } from "@/lib/auth";
import { getPrimaryRole } from "@/lib/authority";
import {
  approveFeeStructure,
  listFeeStructures,
  rejectFeeStructure,
  type FeeStructure,
} from "@/lib/erpApi";

type ApprovalRole = "DIRECTOR" | "MANAGEMENT";
type ApprovalScope = "campus" | "institution";

export function FeeStructureApprovalQueue({
  role,
  scope,
  workspaceTitle,
  workspaceSubtitle,
  heading,
  description,
  emptyDescription,
  approveLabel,
}: {
  role: ApprovalRole;
  scope: ApprovalScope;
  workspaceTitle: string;
  workspaceSubtitle: string;
  heading: string;
  description: string;
  emptyDescription: string;
  approveLabel: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<FeeStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [canApprove, setCanApprove] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const scopeLabel = scope === "campus" ? "campus" : "institutional";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const user = await getCurrentUser({ force: true });
      if (
        getPrimaryRole(user.roles) !== role ||
        !user.permissions.includes("fees.structure.approve") ||
        !user.permissions.includes("fees.structure.read")
      ) {
        setCanApprove(false);
        setRows([]);
        return;
      }
      setCanApprove(true);
      setRows(await listFeeStructures({ status: "PENDING_APPROVAL" }));
    } catch (loadError) {
      if (loadError instanceof AuthRequiredError) {
        router.replace("/login");
      } else {
        setError(`Pending ${scopeLabel} fee approvals could not be loaded. Please retry.`);
      }
    } finally {
      setLoading(false);
    }
  }, [role, router, scopeLabel]);

  useEffect(() => {
    void load();
  }, [load]);

  async function approve(row: FeeStructure) {
    if (
      busyId ||
      !window.confirm(
        `Approve “${row.name}” within your assigned ${scopeLabel} scope?`,
      )
    ) {
      return;
    }

    setBusyId(row.id);
    setError("");
    try {
      await approveFeeStructure(row.id);
      await load();
    } catch {
      setError("This fee structure could not be approved. Refresh the queue and review its current status.");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(row: FeeStructure) {
    if (busyId) return;
    const reason = window.prompt("Enter the rejection reason (at least 3 characters):");
    if (reason === null) return;
    if (reason.trim().length < 3) {
      setError("Enter a rejection reason of at least 3 characters.");
      return;
    }

    setBusyId(row.id);
    setError("");
    try {
      await rejectFeeStructure(row.id, reason);
      await load();
    } catch {
      setError("This fee structure could not be rejected. Refresh the queue and review its current status.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <DashboardShell
      title={workspaceTitle}
      subtitle={workspaceSubtitle}
      allowedRoles={[role]}
    >
      <PageContainer className="space-y-5">
        <PageHeader title={heading} description={description} />

        {error ? (
          <ErrorState title="Approval queue needs attention" description={error} />
        ) : null}

        {loading ? (
          <Card className="p-5">
            <LoadingState label={`Loading pending ${scopeLabel} fee approvals…`} />
          </Card>
        ) : !canApprove ? (
          <ErrorState
            title="Approval permission required"
            description="Your current workspace does not have both fee-structure read and approval permissions. No approval actions are available."
          />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No pending fee approvals"
            description={emptyDescription}
          />
        ) : (
          <div className="space-y-4">
            {rows.map((row) => (
              <Card key={row.id} className="p-5">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-[var(--acadlyx-text)]">{row.name}</h2>
                    <p className="mt-1 break-words text-xs text-[var(--acadlyx-muted)]">
                      Academic year: {row.academicYearId || "Not specified"} · Program: {row.programId || "Not specified"} · Semester: {row.semesterId || "Not specified"}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[var(--acadlyx-text)]">
                      Total: {new Intl.NumberFormat("en-IN", { style: "currency", currency: row.currency || "INR" }).format(row.totalAmount)}
                    </p>
                  </div>
                  <span className="inline-flex w-fit items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900">
                    Pending approval
                  </span>
                </div>

                <div className="acadlyx-table-wrap mt-4">
                  <table className="acadlyx-table">
                    <thead>
                      <tr>
                        <th scope="col">Fee head</th>
                        <th scope="col">Installment</th>
                        <th scope="col" className="text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {row.items.map((item) => (
                        <tr key={item.id}>
                          <td>{item.feeHeadName}</td>
                          <td>{item.installmentNumber}</td>
                          <td className="text-right">
                            {new Intl.NumberFormat("en-IN", { style: "currency", currency: row.currency || "INR" }).format(item.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {row.notes ? (
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm text-[var(--acadlyx-muted)]">
                    Notes: {row.notes}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    disabled={busyId !== null || loading}
                    loading={busyId === row.id}
                    onClick={() => void approve(row)}
                  >
                    {approveLabel}
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    disabled={busyId !== null || loading}
                    loading={busyId === row.id}
                    onClick={() => void reject(row)}
                  >
                    Reject with reason
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </PageContainer>
    </DashboardShell>
  );
}
