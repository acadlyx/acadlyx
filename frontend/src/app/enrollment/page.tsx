import { RoleRedirect } from "@/components/navigation/RoleRedirect";

export default function EnrollmentLegacyRoute() {
  return (
    <RoleRedirect
      destinations={{ ADMISSIONS: "/admissions" }}
      title="Opening Admissions…"
    />
  );
}
