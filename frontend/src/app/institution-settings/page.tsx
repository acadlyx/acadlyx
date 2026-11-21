import { RoleRedirect } from "@/components/navigation/RoleRedirect";

export default function InstitutionSettingsLegacyRoute() {
  return (
    <RoleRedirect
      destinations={{ INSTITUTION_ADMIN: "/admin" }}
      title="Opening Institution Administration…"
    />
  );
}
