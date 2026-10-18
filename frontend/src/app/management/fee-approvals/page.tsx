import { FeeStructureApprovalQueue } from "@/components/accounts/FeeStructureApprovalQueue";

export default function ManagementFeeApprovalsPage() {
  return (
    <FeeStructureApprovalQueue
      role="MANAGEMENT"
      scope="institution"
      workspaceTitle="Management Fee Approvals"
      workspaceSubtitle="Institutional fee governance and maker-checker review"
      heading="Pending institutional fee approvals"
      description="Review fee structures awaiting approval within the institutional scope returned by the server. The creator cannot approve their own submission, and the API independently enforces workflow authority."
      emptyDescription="There are no fee structures awaiting institutional approval."
      approveLabel="Approve institutionally"
    />
  );
}
