import FinancePage from "@/components/accounts/FinancePage";

export default function ChairmanFeeStructuresPage() {
  return <FinancePage view="fee-structures" allowedRoles={["CHAIRMAN"]} workspaceTitle="Chairman Fee Structure Management" workspaceSubtitle="Create drafts and publish institution-wide fee structures directly; Accounts assigns published structures to students." />;
}
