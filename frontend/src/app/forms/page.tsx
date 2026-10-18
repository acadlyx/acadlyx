import { RoleRedirect } from "@/components/navigation/RoleRedirect";

export default function FormsLegacyRoute() {
  return (
    <RoleRedirect
      destinations={{ REGISTRAR: "/certificates" }}
      title="Opening the authorized Registrar forms workspace…"
    />
  );
}
