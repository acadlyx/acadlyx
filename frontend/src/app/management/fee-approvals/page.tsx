import FinancePage from "@/components/accounts/FinancePage";

export default function ManagementFeeApprovalsPage() {
  return (
    <FinancePage
      view="fee-structures"
      allowedRoles={["MANAGEMENT"]}
      workspaceTitle="Management Fee Structure Approvals"
      workspaceSubtitle="Review and approve fee structures within your authorized institutional scope."
    />
  );
}
