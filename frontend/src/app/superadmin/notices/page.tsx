import { redirect } from "next/navigation";

export default function SuperAdminNoticesRedirect() {
  // Platform Super Admin has no tenant notice scope. Keep this legacy route
  // as a harmless redirect rather than exposing the shared tenant notice page.
  redirect("/superadmin");
}
