import { RoleRedirect } from "@/components/navigation/RoleRedirect";

export default function CmsLegacyRoute() {
  return (
    <RoleRedirect
      destinations={{
        SUPER_ADMIN: "/site-content",
        CMS: "/site-content",
      }}
      title="Opening the authorized CMS workspace…"
    />
  );
}
