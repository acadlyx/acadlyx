import FinancePage from "@/components/accounts/FinancePage";

export default function DirectorFeeCollectionsPage() {
  return <FinancePage view="collections" allowedRoles={["DIRECTOR"]} />;
}
