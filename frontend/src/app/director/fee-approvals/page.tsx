import { FeeStructureApprovalQueue } from "@/components/accounts/FeeStructureApprovalQueue";

export default function DirectorFeeApprovalsPage() {
  return (
    <FeeStructureApprovalQueue
      role="DIRECTOR"
      scope="campus"
      workspaceTitle="Campus Fee Approvals"
      workspaceSubtitle="Review pending fee structures within your assigned campus scope"
      heading="Pending campus fee approvals"
      description="Only fee structures linked to programs in your assigned campuses are returned by the server. Approval and rejection are independently checked against campus scope and maker-checker rules."
      emptyDescription="There are no fee structures awaiting approval in your assigned campus scope."
      approveLabel="Approve for campus"
    />
  );
}
