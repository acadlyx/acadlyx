import { RoleRedirect } from "@/components/navigation/RoleRedirect";

export default function LegacyFeeReceiptsPage() {
  return (
    <RoleRedirect
      destinations={{ ACCOUNTS: "/accounts/receipts" }}
      title="Opening Accounts receipts…"
    />
  );
}
