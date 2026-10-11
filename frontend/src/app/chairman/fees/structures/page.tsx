import FinancePage from "@/components/accounts/FinancePage";

export default function ChairmanFeeStructuresPage() {
  return <FinancePage view="fee-structures" allowedRoles={["CHAIRMAN"]} />;
}
