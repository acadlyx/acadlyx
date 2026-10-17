import { RoleRedirect } from "@/components/navigation/RoleRedirect";

export default function PaymentsRouteAlias() {
  return (
    <RoleRedirect
      destinations={{
        ACCOUNTS: "/accounts/payments",
        STUDENT: "/student/fees",
        PARENT: "/parent/children",
      }}
      title="Opening your authorized payments workspace…"
    />
  );
}
