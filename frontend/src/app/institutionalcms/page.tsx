import { RoleRedirect } from "@/components/navigation/RoleRedirect";

export default function InstitutionalCmsLegacyRoute() {
  return (
    <RoleRedirect
      destinations={{
        INSTITUTION_ADMIN: "/admin/institutional-cms",
        CHAIRMAN: "/admin/institutional-cms",
        MANAGEMENT: "/admin/institutional-cms",
        DIRECTOR: "/admin/institutional-cms",
      }}
      title="Opening the authorized institutional CMS workflow…"
    />
  );
}
